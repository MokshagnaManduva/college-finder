from copy import deepcopy

import pytest
from pydantic import ValidationError
from sqlalchemy import func, select

from app.models import CatalogRelease, College, CollegeMetric, Course, CourseFact, User
from seed import catalog
from seed.seed import seed_data
from tests.conftest import register


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
    assert mba.facts[1].raw_unit == "INR/installment"
    assert mba.facts[1].normalized_value == 1_310_000


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
    manifest, digest = catalog.load_catalog()
    async with factory() as db, db.begin():
        assert await catalog.apply_catalog(db, manifest, digest)
    upgraded = (await client.get("/api/colleges/catalog")).json()
    assert len(upgraded) == 19 and sum(len(p["courses"]) for p in upgraded) == 28
    for p in upgraded:
        assert p["image"] == "" and p["facilities"] == [] and p["accreditation"] == ""
        assert p["placements"]["avgPackage"] is None
        assert p["placements"]["highestPackage"] is None
        assert p["placements"]["placementRate"] is None
        assert all(c["seats"] is None and c["feeBasis"] != "demo-assumption" for c in p["courses"])
    bombay = next(p for p in upgraded if p["slug"] == "iit-bombay")
    assert bombay["id"] == previous["id"]
    assert bombay["courses"][0]["id"] == previous["courses"][0]["id"]
    assert bombay["courses"][0]["annualTuition"] == 200000
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
