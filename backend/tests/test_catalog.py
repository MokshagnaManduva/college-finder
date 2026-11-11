from copy import deepcopy
from pathlib import Path

import pytest
from pydantic import ValidationError
from sqlalchemy import func, select

from app.models import CatalogRelease, College, CollegeMetric, Course, CourseFact, User
from app.schemas.review import ReviewedFact, ReviewedSource, ReviewManifest
from app.services.review import import_review
from seed import catalog
from seed.seed import seed_data
from tests.conftest import register


async def test_fee_correction_withdraws_only_the_matching_old_claim_and_keeps_notes(api):
    client, factory = api
    manifest, digest = catalog.load_catalog()
    sibm = next(p for p in manifest.colleges if p.slug == "symbiosis-pune")
    source = manifest.sources["sibm-fees"]
    old_fact = ReviewedFact(
        kind="tuition",
        raw_value=655000,
        raw_unit="INR/installment",
        notes="Previous bundled academic fee incorrectly entered as tuition.",
        source=ReviewedSource(
            title=source.title,
            url=source.url,
            reporting_year=source.reporting_year,
            verified_at=source.verified_at,
            reviewer="Previous source review",
            document_sha256=source.document_sha256,
            document_format=source.document_format,
        ),
    )
    previous = deepcopy(manifest)
    previous.version = "official-test-before-fee-correction"
    previous.withdrawals = []
    next(p for p in previous.colleges if p.slug == sibm.slug).courses[0].facts.append(old_fact)
    async with factory() as db, db.begin():
        await catalog.apply_catalog(db, previous, "a" * 64)
    assert (await client.get(f"/api/colleges/{sibm.slug}")).json()["courses"][0][
        "annualTuition"
    ] == 1310000
    auth = await register(client)
    college = (await client.get(f"/api/colleges/{sibm.slug}")).json()
    entry = await client.post(
        "/api/workspace",
        headers=auth,
        json={
            "collegeId": college["id"],
            "courseId": str(sibm.courses[0].id),
            "notes": "Keep my SIBM research",
            "stage": "Shortlisted",
        },
    )
    assert entry.status_code == 201
    different = deepcopy(manifest)
    different.withdrawals[0].expected_value += 1
    with pytest.raises(ValueError, match="different reviewed claim"):
        async with factory() as db, db.begin():
            await catalog.apply_catalog(db, different, digest)
    async with factory() as db:
        assert await db.get(CatalogRelease, manifest.version) is None
    async with factory() as db, db.begin():
        await catalog.apply_catalog(db, manifest, digest)
    corrected = (await client.get(f"/api/colleges/{sibm.slug}")).json()["courses"][0]
    assert corrected["annualTuition"] is None and corrected["tuitionEvidence"] is None
    assert corrected["durationMonths"] == 24 and corrected["durationEvidence"] is not None
    entries = (await client.get("/api/workspace", headers=auth)).json()
    assert entries[0]["notes"] == "Keep my SIBM research"


def test_catalog_requires_evidence_and_correct_claim_units(tmp_path):
    manifest, digest = catalog.load_catalog()
    assert len(manifest.colleges) == 19
    assert len(digest) == 64
    assert sum(len(p.courses) for p in manifest.colleges) == 28
    with pytest.raises(ValueError, match="Missing retained evidence"):
        catalog.load_catalog(evidence_dir=tmp_path)
    data = manifest.model_dump(mode="json", by_alias=True)
    bad = deepcopy(data)
    bad["colleges"][0]["courses"][0]["durationMonths"] = 36
    with pytest.raises(ValidationError, match="differs from its evidence"):
        catalog.OfficialCatalog.model_validate(bad)
    bad = deepcopy(data)
    bad["colleges"][1]["courses"][0]["id"] = bad["colleges"][0]["courses"][0]["id"]
    with pytest.raises(ValidationError, match="Duplicate programme"):
        catalog.OfficialCatalog.model_validate(bad)
    bad = deepcopy(data)
    bad["sources"][bad["colleges"][0]["sourceKey"]]["documentSha256"] = None
    with pytest.raises(ValidationError, match="retained bytes"):
        catalog.OfficialCatalog.model_validate(bad)
    mbbs = next(p for p in manifest.colleges if p.slug == "aiims-delhi").courses[0]
    assert mbbs.facts[0].raw_value == 5.5 and mbbs.facts[0].normalized_value == 66
    mba = next(p for p in manifest.colleges if p.slug == "symbiosis-pune").courses[0]
    assert all(fact.kind != "tuition" for fact in mba.facts)
    assert manifest.withdrawals[0].course_id == mba.id
    assert manifest.withdrawals[0].expected_value == 1_310_000


async def test_upgrade_preserves_private_notes_archives_options_and_cannot_be_reseeded(api):
    client, factory = api
    auth = await register(client)
    previous = (await client.get("/api/colleges/iit-bombay")).json()
    archived = previous["courses"][2]
    payload = {
        "collegeId": previous["id"],
        "courseId": archived["id"],
        "stage": "Applying",
        "notes": "Keep my original research",
        "nextAction": "Ask admissions",
    }
    entry = await client.post("/api/workspace", headers=auth, json=payload)
    assert entry.status_code == 201
    # Reproduce an existing hosted catalog that already contains the nine-course pilot.
    pilot = ReviewManifest.model_validate_json(
        (Path(__file__).parents[1] / "seed/data/reviewed_directory_2026.json").read_text()
    )
    async with factory() as db, db.begin():
        await import_review(db, pilot, apply=True)
    manifest, digest = catalog.load_catalog()
    async with factory() as db, db.begin():
        assert await catalog.apply_catalog(db, manifest, digest)
    upgraded = (await client.get("/api/colleges/catalog")).json()
    assert len(upgraded) == 19 and sum(len(p["courses"]) for p in upgraded) == 28
    for p in upgraded:
        assert (
            p["image"] == ""
            and p["facilities"] == [f["name"] for f in p["facilityEvidence"]]
            and p["accreditation"] == ""
        )
        assert p["placements"]["avgPackage"] is None
        assert p["placements"]["highestPackage"] is None
        assert p["placements"]["placementRate"] is None
        assert all(
            c["feeBasis"] != "demo-assumption"
            and (c["seats"] is None or c["seatsEvidence"] is not None)
            for c in p["courses"]
        )
    expected = {str(c.id): c for p in manifest.colleges for c in p.courses}
    for p in upgraded:
        for c in p["courses"]:
            assert c["durationMonths"] == expected[c["id"]].duration_months
    bangalore = next(p for p in upgraded if p["slug"] == "iim-bangalore")
    assert next(c for c in bangalore["courses"] if "PGPEM" in c["name"])["durationMonths"] == 24
    bombay = next(p for p in upgraded if p["slug"] == "iit-bombay")
    assert bombay["id"] == previous["id"]
    assert bombay["courses"][0]["id"] == previous["courses"][0]["id"]
    assert bombay["courses"][0]["annualTuition"] == 200000
    manipal = next(p for p in upgraded if p["slug"] == "manipal-university")["courses"][0]
    assert manipal["annualTuition"] == 376000
    assert manipal["tuitionEvidence"]["rawUnit"] == "INR/year"
    assert "other fees" in manipal["tuitionEvidence"]["notes"]
    amity = next(p for p in upgraded if p["slug"] == "amity-university-noida")["courses"][0]
    assert amity["durationEvidence"]["source"]["reportingYear"] == 2026
    assert amity["annualTuition"] is None
    sibm = next(p for p in upgraded if p["slug"] == "symbiosis-pune")["courses"][0]
    assert sibm["annualTuition"] is None and sibm["tuitionEvidence"] is None
    assert "academic fees total ₹13,10,000" in sibm["source"]["notes"]
    assert archived["id"] not in [c["id"] for c in bombay["courses"]]
    comparison = await client.post(
        "/api/compare",
        json={
            "options": [
                {"collegeId": bombay["id"], "courseId": archived["id"]},
                {"collegeId": bombay["id"], "courseId": bombay["courses"][0]["id"]},
            ]
        },
    )
    assert comparison.status_code == 422
    saved = (await client.get("/api/workspace", headers=auth)).json()[0]
    assert saved["id"] == entry.json()["id"]
    assert saved["notes"] == payload["notes"] and saved["courseId"] == archived["id"]
    assert saved["revision"] == entry.json()["revision"]
    madras = next(p for p in upgraded if p["slug"] == "iit-madras")
    assert madras["placements"]["medianPackage"] == 1778000
    assert madras["placements"]["reportingYear"] == 2025
    assert madras["placements"]["placed"] == 631
    assert madras["placements"]["source"]["documentSha256"]
    du = next(p for p in upgraded if p["slug"] == "delhi-university")
    assert all(c["annualTuition"] is None for c in du["courses"])
    limited = (await client.get("/api/colleges?degree=B.Tech&budget=100000")).json()
    assert limited["total"] == 0
    hidden = (await client.get("/api/colleges?search=Data%20Science&degree=M.Tech")).json()
    assert hidden["total"] == 0
    async with factory() as db:
        assert (await db.get(Course, archived["id"])).published is False
        assert await db.scalar(select(func.count()).select_from(User)) == 1
        await seed_data(db)
    assert (await client.get("/api/colleges/catalog")).json() == upgraded
    async with factory() as db, db.begin():
        assert not await catalog.apply_catalog(db, manifest, digest)
        with pytest.raises(ValueError, match="cannot be changed"):
            await catalog.apply_catalog(db, manifest, "0" * 64)
    assert (await client.get("/api/workspace", headers=auth)).json()[0] == saved


async def test_catalog_upgrade_rolls_back_all_catalog_changes_on_failure(api, monkeypatch):
    client, factory = api
    before = (await client.get("/api/colleges/catalog")).json()
    manifest, digest = catalog.load_catalog()

    async def fail(*args, **kwargs):
        raise ValueError("Evidence import failed")

    monkeypatch.setattr(catalog, "import_review", fail)
    async with factory() as db:
        with pytest.raises(ValueError, match="Evidence import failed"):
            async with db.begin():
                await catalog.apply_catalog(db, manifest, digest)
        assert await db.scalar(select(func.count()).select_from(CatalogRelease)) == 0
        assert await db.scalar(select(func.count()).select_from(CourseFact)) == 0
        assert await db.scalar(select(func.count()).select_from(CollegeMetric)) == 57
        assert await db.scalar(select(func.count()).select_from(College)) == 19
    assert (await client.get("/api/colleges/catalog")).json() == before


async def test_expanded_evidence_keeps_bundled_fees_intake_and_outcomes_in_their_scope(api):
    client, factory = api
    manifest, digest = catalog.load_catalog()
    async with factory() as db, db.begin():
        await catalog.apply_catalog(db, manifest, digest)
    profiles = {p["slug"]: p for p in (await client.get("/api/colleges/catalog")).json()}
    for slug, amount, unit, year in (
        ("symbiosis-pune", 1310000, "INR/installment", 2026),
        ("amity-university-noida", 438000, "INR/semester", 2026),
        ("christ-university", 580000, "INR/year", 2027),
        ("pune-university", 163983, "INR/admission", 2026),
    ):
        course = profiles[slug]["courses"][0]
        assert course["annualTuition"] is None and course["feeBasis"] == "unknown"
        assert course["tuitionEvidence"] is None
        assert course["durationMonths"] in (24, 48)
        fee = course["academicFeeEvidence"]
        assert fee["normalizedValue"] == amount and fee["rawUnit"] == unit
        assert fee["source"]["reportingYear"] == year
        assert fee["source"]["status"] == "verified" and fee["documentSha256"]
        if unit == "INR/admission":
            assert fee["factor"] == 1
    expected_intake = {
        "iit-bombay": [199, 112],
        "iit-delhi": [99, 85],
        "iit-madras": [87, 104],
        "nit-trichy": [118, 119],
    }
    for slug, counts in expected_intake.items():
        for course, count in zip(profiles[slug]["courses"], counts, strict=True):
            assert course["seats"] == count
            assert course["seatsEvidence"]["normalizedValue"] == count
            assert course["seatsEvidence"]["source"]["reportingYear"] == 2026
    vit = profiles["vit-vellore"]
    assert vit["facilities"] == ["Central library", "Hostels", "Sports facilities"]
    assert all(
        f["source"]["status"] == "verified" and f["source"]["documentSha256"]
        for f in vit["facilityEvidence"]
    )
    assert "campuses" in vit["placements"]["scope"]
    assert vit["placements"]["medianPackage"] == 600000
    assert vit["placements"]["placed"] == 7023
    bangalore = profiles["iim-bangalore"]
    assert bangalore["source"]["status"] == "verified"
    assert bangalore["courses"][0]["durationEvidence"]["normalizedValue"] == 24
    assert bangalore["courses"][1]["source"]["status"] == "unverified"
    assert bangalore["courses"][1]["durationEvidence"] is None
    assert bangalore["placements"]["reportingYear"] == 2024
    assert bangalore["placements"]["medianPackage"] == 3250000
    # Bundled fees and admission payments do not silently qualify a tuition-only budget.
    for slug in (
        "symbiosis-pune",
        "amity-university-noida",
        "christ-university",
        "pune-university",
    ):
        response = await client.get(
            "/api/colleges", params={"search": profiles[slug]["name"], "budget": 2000000}
        )
        assert response.json()["total"] == 0


def test_expanded_claim_units_reject_admission_as_tuition_and_fractional_intake():
    manifest, _ = catalog.load_catalog()
    course = next(p for p in manifest.colleges if p.slug == "pune-university").courses[0]
    payment = next(f for f in course.facts if f.kind == "academicFee")
    data = payment.model_dump(mode="json", by_alias=True)
    with pytest.raises(ValidationError, match="Tuition requires"):
        ReviewedFact.model_validate({**data, "kind": "tuition"})
    with pytest.raises(ValidationError, match="Intake requires"):
        ReviewedFact.model_validate({**data, "kind": "seats"})
    with pytest.raises(ValidationError, match="normalize to whole"):
        ReviewedFact.model_validate(
            {**data, "kind": "seats", "rawUnit": "students", "rawValue": 59.5}
        )
    valid = ReviewedFact.model_validate(
        {**data, "kind": "seats", "rawUnit": "students", "rawValue": 60}
    )
    assert valid.factor == 1 and valid.normalized_value == 60
