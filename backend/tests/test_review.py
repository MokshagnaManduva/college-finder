import copy
import hashlib
import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from pydantic import ValidationError
from sqlalchemy import func, select

from app.models import CourseFact
from app.schemas.review import ReviewedFact, ReviewManifest
from app.services.review import import_review
from seed.review import run, verify_documents
from seed.seed import seed_data
from tests.conftest import option, register


def payload():
    return json.loads(
        (Path(__file__).parents[1] / "seed/data/reviewed_iit_bombay_2026.json").read_text()
    )


async def test_review_preview_apply_replay_and_demo_seed_protection(api):
    client, factory = api
    headers = await register(client)
    selected = await option(client)
    await client.post("/api/workspace", headers=headers, json={**selected, "notes": "Keep notes"})
    manifest = ReviewManifest.model_validate(payload())
    async with factory() as db, db.begin():
        changes = await import_review(db, manifest)
        assert changes[0]["before"] == 220000 and changes[0]["after"] == 200000
        assert await db.scalar(select(func.count()).select_from(CourseFact)) == 0
    for _ in range(2):
        async with factory() as db, db.begin():
            await import_review(db, manifest, apply=True)
    detail = (await client.get("/api/colleges/iit-bombay")).json()
    course = detail["courses"][0]
    assert course["annualTuition"] == 200000 and course["feeBasis"] == "reported"
    assert course["tuitionEvidence"]["rawValue"] == 100000
    assert course["tuitionEvidence"]["factor"] == 2
    assert course["tuitionEvidence"]["source"]["status"] == "verified"
    assert course["durationEvidence"]["normalizedValue"] == 48
    assert course["durationEvidence"]["rawValue"] == 4
    assert course["durationEvidence"]["rawUnit"] == "years"
    assert course["source"]["status"] == detail["dataStatus"] == "demo"
    assert detail["metrics"][0]["source"]["status"] == "demo"
    async with factory() as db:
        assert await db.scalar(select(func.count()).select_from(CourseFact)) == 2
        await seed_data(db)
    again = (await client.get("/api/colleges/iit-bombay")).json()["courses"][0]
    assert again["annualTuition"] == 200000 and again["feeBasis"] == "reported"
    assert (await client.get("/api/workspace", headers=headers)).json()[0]["notes"] == "Keep notes"


async def test_review_invalid_target_is_atomic(api):
    client, factory = api
    data = payload()
    other = copy.deepcopy(data["courses"][0])
    other["courseId"] = (await option(client, "iit-delhi"))["courseId"]
    data["courses"].append(other)
    async with factory() as db:
        with pytest.raises(ValueError, match="does not belong"):
            async with db.begin():
                await import_review(db, ReviewManifest.model_validate(data), apply=True)
        assert await db.scalar(select(func.count()).select_from(CourseFact)) == 0
    assert (await client.get("/api/colleges/iit-bombay")).json()["courses"][0][
        "annualTuition"
    ] == 220000


async def test_review_rejects_stale_or_conflicting_evidence(api):
    _, factory = api
    data = payload()
    async with factory() as db, db.begin():
        await import_review(db, ReviewManifest.model_validate(data), apply=True)
    data["courses"][0]["facts"][0]["rawValue"] = 150000
    async with factory() as db:
        with pytest.raises(ValueError, match="newer review"):
            async with db.begin():
                await import_review(db, ReviewManifest.model_validate(data), apply=True)
    data["courses"][0]["facts"][0]["source"]["verifiedAt"] = "2026-10-06T00:00:00Z"
    async with factory() as db:
        with pytest.raises(ValueError, match="newer review"):
            async with db.begin():
                await import_review(db, ReviewManifest.model_validate(data), apply=True)


@pytest.mark.parametrize("change", ["period", "duration", "future", "url", "duplicate", "blank"])
def test_review_validation(change):
    data = payload()
    fact = data["courses"][0]["facts"][0]
    if change == "period":
        fact["rawUnit"] = "months"
    elif change == "duration":
        data["courses"][0]["facts"][1]["rawValue"] = 0
    elif change == "future":
        fact["source"]["verifiedAt"] = (datetime.now(UTC) + timedelta(days=1)).isoformat()
    elif change == "url":
        fact["source"]["url"] = "http://example.com/fees"
    elif change == "duplicate":
        data["courses"][0]["facts"] = [fact, fact]
    else:
        fact["notes"] = "  "
    with pytest.raises(ValidationError):
        ReviewManifest.model_validate(data)


async def test_same_source_url_can_have_distinct_claim_metadata(api):
    client, factory = api
    data = payload()
    data["courses"][0]["facts"][1]["source"]["title"] = "Duration evidence in the fee circular"
    async with factory() as db, db.begin():
        await import_review(db, ReviewManifest.model_validate(data), apply=True)
    course = (await client.get("/api/colleges/iit-bombay")).json()["courses"][0]
    assert (
        course["tuitionEvidence"]["source"]["title"]
        == data["courses"][0]["facts"][0]["source"]["title"]
    )
    assert course["durationEvidence"]["source"]["title"] == "Duration evidence in the fee circular"
    assert course["tuitionEvidence"]["source"]["id"] != course["durationEvidence"]["source"]["id"]


def test_retained_evidence_is_verified_and_rejects_missing_or_modified_bytes(tmp_path):
    data = payload()
    content = b"retained test evidence"
    digest = hashlib.sha256(content).hexdigest()
    for fact in data["courses"][0]["facts"]:
        fact["source"]["documentSha256"] = digest
    manifest = ReviewManifest.model_validate(data)
    with pytest.raises(ValueError, match="Missing retained"):
        verify_documents(manifest, tmp_path)
    document = tmp_path / (digest + ".pdf")
    document.write_bytes(content)
    verify_documents(manifest, tmp_path)
    document.write_bytes(b"modified")
    with pytest.raises(ValueError, match="checksum mismatch"):
        verify_documents(manifest, tmp_path)


async def test_cli_apply_requires_evidence_before_connecting_to_database():
    with pytest.raises(ValueError, match="requires --evidence-dir"):
        await run(Path(__file__).parents[1] / "seed/data/reviewed_iit_bombay_2026.json", True)


async def test_expanded_batch_reviews_four_courses_without_overwriting_other_data(api):
    client, factory = api
    path = Path(__file__).parents[1] / "seed/data/reviewed_iits_2026.json"
    manifest = ReviewManifest.model_validate_json(path.read_text())
    verify_documents(manifest, path.parent.parent / "evidence")
    async with factory() as db, db.begin():
        assert len(await import_review(db, manifest, apply=True)) == 8
    catalog = (await client.get("/api/colleges/catalog")).json()
    courses = [course for college in catalog for course in college["courses"]]
    assert sum(course["tuitionEvidence"] is not None for course in courses) == 4
    assert sum(course["durationEvidence"] is not None for course in courses) == 4
    assert all(course["annualTuition"] == 200000 for course in courses if course["tuitionEvidence"])
    assert all(course["durationMonths"] == 48 for course in courses if course["durationEvidence"])
    assert all(
        course["tuitionEvidence"]["documentSha256"]
        for course in courses
        if course["tuitionEvidence"]
    )
    assert len(catalog) == 19 and len(courses) == 57
    assert all(college["dataStatus"] == "demo" for college in catalog)


@pytest.mark.parametrize(
    ("kind", "value", "valid"),
    [("duration", 8, True), ("duration", 24, True), ("duration", 25, False), ("tuition", 8, False)],
)
def test_semester_duration_conversion_and_unit_boundaries(kind, value, valid):
    fact = payload()["courses"][0]["facts"][1]
    fact.update(kind=kind, rawValue=value, rawUnit="semesters")
    if valid:
        review = ReviewedFact.model_validate(fact)
        assert review.factor == 6 and review.normalized_value == value * 6
    else:
        with pytest.raises(ValidationError):
            ReviewedFact.model_validate(fact)


async def test_directory_review_keeps_annual_and_semester_units_and_protects_reseeding(api):
    client, factory = api
    path = Path(__file__).parents[1] / "seed/data/reviewed_directory_2026.json"
    manifest = ReviewManifest.model_validate_json(path.read_text())
    verify_documents(manifest, path.parent.parent / "evidence")
    for _ in range(2):
        async with factory() as db, db.begin():
            assert len(await import_review(db, manifest, apply=True)) == 18
    async with factory() as db:
        await seed_data(db)
    catalog = (await client.get("/api/colleges/catalog")).json()
    courses = [course for college in catalog for course in college["courses"]]
    reviewed = [course for course in courses if course["tuitionEvidence"]]
    assert len(reviewed) == 9
    assert sum(course["durationEvidence"] is not None for course in courses) == 9
    hashes = {
        course[key]["documentSha256"]
        for course in reviewed
        for key in ("tuitionEvidence", "durationEvidence")
    }
    assert len(hashes) == 8
    expected_fees = {"iit-madras": 200000, "nit-trichy": 125000, "iisc-bangalore": 80000}
    for college in catalog:
        for course in college["courses"]:
            if college["slug"] in expected_fees and course["tuitionEvidence"]:
                assert course["annualTuition"] == expected_fees[college["slug"]]
                assert course["durationMonths"] == 48 and course["feeBasis"] == "reported"
                if college["slug"] == "iisc-bangalore":
                    assert course["tuitionEvidence"]["factor"] == 1
                else:
                    assert course["durationEvidence"]["rawUnit"] == "semesters"
                    assert course["durationEvidence"]["rawValue"] == 8
                    assert course["durationEvidence"]["factor"] == 6
    assert len(catalog) == 19 and len(courses) == 57
    assert all(college["dataStatus"] == "demo" for college in catalog)
