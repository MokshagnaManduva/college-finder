"""Offline, atomic catalog release. No accounts or workspace records are modified."""

import argparse
import asyncio
import hashlib
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal
from uuid import UUID

from pydantic import AwareDatetime, Field, HttpUrl, model_validator
from sqlalchemy import delete, select, text, update

from app.db.session import get_engine, get_session_factory
from app.models import CatalogRelease, College, CollegeMetric, Course, DataSource
from app.schemas.base import APIModel
from app.schemas.review import ReviewedCourse, ReviewedFact, ReviewManifest
from app.services.review import import_review
from seed.review import verify_documents
from seed.seed import seed_data, stable_id, upsert

ROOT = Path(__file__).parent
MANIFEST = ROOT / "data/official_catalog_2026.json"


class CatalogSource(APIModel):
    title: str = Field(min_length=1, max_length=300)
    url: HttpUrl
    status: Literal["verified", "unverified"] = "verified"
    reporting_year: int | None = Field(default=None, ge=1900, le=2100)
    verified_at: AwareDatetime | None = None
    document_sha256: str | None = Field(default=None, pattern=r"^[a-f0-9]{64}$")
    document_format: Literal["pdf", "html"] | None = None
    notes: str = Field(min_length=1, max_length=2000)

    @model_validator(mode="after")
    def evidence(self):
        if self.url.scheme != "https" or self.url.username or self.url.password:
            raise ValueError("Official sources require HTTPS without credentials")
        if self.verified_at and self.verified_at > datetime.now(UTC):
            raise ValueError("Source review cannot be in the future")
        if self.status == "verified" and not all(
            (self.verified_at, self.document_sha256, self.document_format)
        ):
            raise ValueError("A checked source requires retained bytes and a review date")
        if bool(self.document_sha256) != bool(self.document_format):
            raise ValueError("Specify both document checksum and format")
        return self


class CatalogCourse(APIModel):
    id: UUID
    name: str = Field(min_length=1, max_length=300)
    degree: str = Field(min_length=1, max_length=100)
    duration_months: int = Field(ge=1, le=144)
    source_key: str
    facts: list[ReviewedFact] = Field(default_factory=list, max_length=2)

    @model_validator(mode="after")
    def duration_matches(self):
        if len({fact.kind for fact in self.facts}) != len(self.facts):
            raise ValueError("Duplicate course claim")
        for fact in self.facts:
            if fact.kind == "duration" and fact.normalized_value != self.duration_months:
                raise ValueError("Programme duration differs from its evidence")
        return self


class Outcomes(APIModel):
    median: int = Field(ge=0)
    graduates: int = Field(ge=0)
    placed: int = Field(ge=0)
    higher_studies: int = Field(ge=0)
    scope: str = Field(min_length=1, max_length=1000)
    source_key: str

    @model_validator(mode="after")
    def population(self):
        if self.placed > self.graduates or self.higher_studies > self.graduates:
            raise ValueError("Outcome counts exceed the graduating cohort")
        return self


class CatalogProfile(APIModel):
    slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    name: str = Field(min_length=1, max_length=300)
    city: str
    state: str
    type: str
    established: int | None = Field(default=None, ge=1800, le=2100)
    description: str = Field(min_length=1, max_length=3000)
    source_key: str
    courses: list[CatalogCourse] = Field(min_length=1, max_length=100)
    outcomes: Outcomes | None = None


class OfficialCatalog(APIModel):
    version: str = Field(pattern=r"^official-[a-z0-9-]+$")
    sources: dict[str, CatalogSource]
    colleges: list[CatalogProfile] = Field(min_length=1, max_length=1000)

    @model_validator(mode="after")
    def references(self):
        if len({college.slug for college in self.colleges}) != len(self.colleges):
            raise ValueError("Duplicate institution slug")
        ids = [course.id for college in self.colleges for course in college.courses]
        if len(set(ids)) != len(ids):
            raise ValueError("Duplicate programme ID")
        for college in self.colleges:
            keys = [college.source_key, *(course.source_key for course in college.courses)]
            if college.outcomes:
                keys.append(college.outcomes.source_key)
            if any(key not in self.sources for key in keys):
                raise ValueError("Unknown source key")
            if college.outcomes:
                source = self.sources[college.outcomes.source_key]
                if source.status != "verified" or source.reporting_year is None:
                    raise ValueError("Outcomes require a checked source and graduating year")
        return self

    @property
    def review(self):
        return ReviewManifest(
            version=1,
            courses=[
                ReviewedCourse(college_slug=college.slug, course_id=course.id, facts=course.facts)
                for college in self.colleges
                for course in college.courses
                if course.facts
            ],
        )


def load_catalog(path: Path = MANIFEST, evidence_dir: Path = ROOT / "evidence"):
    data = path.read_bytes()
    if len(data) > 2_000_000:
        raise ValueError("Catalog manifests must be smaller than 2 MB")
    catalog = OfficialCatalog.model_validate_json(data)
    for source in catalog.sources.values():
        if not source.document_sha256:
            continue
        document = evidence_dir / f"{source.document_sha256}.{source.document_format}"
        if not document.is_file():
            raise ValueError(f"Missing retained evidence: {document.name}")
        if hashlib.sha256(document.read_bytes()).hexdigest() != source.document_sha256:
            raise ValueError(f"Retained evidence checksum mismatch: {document.name}")
    verify_documents(catalog.review, evidence_dir)
    return catalog, hashlib.sha256(data).hexdigest()


async def apply_catalog(db, catalog: OfficialCatalog, digest: str) -> bool:
    """Caller owns the transaction; serialize startup upgrades across API instances."""
    await db.execute(text("SELECT pg_advisory_xact_lock(7047618026)"))
    release = await db.get(CatalogRelease, catalog.version)
    if release:
        if release.manifest_sha256 != digest:
            raise ValueError("An applied catalog version cannot be changed; create a new release")
        return False
    await seed_data(db, commit=False)
    source_ids = {}
    for key, source in catalog.sources.items():
        source_id = stable_id("official-source", catalog.version + "/" + key)
        source_ids[key] = source_id
        values = source.model_dump(mode="python", by_alias=False)
        values["url"] = str(source.url)
        await upsert(db, DataSource, {"id": source_id, **values})
    for profile in catalog.colleges:
        college_id = stable_id("college", profile.slug)
        await upsert(
            db,
            College,
            {
                "id": college_id,
                "slug": profile.slug,
                "name": profile.name,
                "location": profile.city,
                "city": profile.city,
                "state": profile.state,
                "type": profile.type,
                "established": profile.established,
                "description": profile.description,
                "image": "",
                "accreditation": "",
                "facilities": [],
                "source_id": source_ids[profile.source_key],
                "catalog_release": catalog.version,
            },
        )
        # Keep old rows for workspace/backups; hide unsupported sample options and amounts.
        await db.execute(
            update(Course)
            .where(Course.college_id == college_id)
            .values(published=False, annual_tuition=None, fee_basis="unknown", seats=None)
        )
        demo_sources = select(DataSource.id).where(DataSource.status == "demo")
        await db.execute(
            delete(CollegeMetric).where(
                CollegeMetric.college_id == college_id, CollegeMetric.source_id.in_(demo_sources)
            )
        )
        for position, course in enumerate(profile.courses):
            existing = await db.get(Course, course.id)
            if existing and existing.college_id != college_id:
                raise ValueError("A programme ID cannot move between institutions")
            await upsert(
                db,
                Course,
                {
                    "id": course.id,
                    "college_id": college_id,
                    "name": course.name,
                    "degree": course.degree,
                    "duration_months": course.duration_months,
                    "annual_tuition": None,
                    "fee_basis": "unknown",
                    "seats": None,
                    "position": position,
                    "published": True,
                    "source_id": source_ids[course.source_key],
                },
            )
        if profile.outcomes:
            outcome = profile.outcomes
            for kind, amount in (
                ("medianPackage", outcome.median),
                ("graduates", outcome.graduates),
                ("placed", outcome.placed),
                ("higherStudies", outcome.higher_studies),
            ):
                await upsert(
                    db,
                    CollegeMetric,
                    {
                        "id": stable_id("metric", profile.slug + "/" + kind),
                        "college_id": college_id,
                        "kind": kind,
                        "amount": amount,
                        "unit": "INR/year" if kind == "medianPackage" else "students",
                        "scope": outcome.scope,
                        "source_id": source_ids[outcome.source_key],
                    },
                )
    unpublished_demo = await db.scalar(
        select(College.id).join(DataSource).where(DataSource.status == "demo").limit(1)
    )
    if unpublished_demo:
        raise ValueError("Release leaves sample institution profiles public")
    await import_review(db, catalog.review, apply=True)
    db.add(CatalogRelease(version=catalog.version, manifest_sha256=digest))
    await db.flush()
    return True


async def run(apply: bool):
    catalog, digest = load_catalog()
    if not apply:
        print(
            json.dumps(
                {
                    "mode": "validated",
                    "version": catalog.version,
                    "institutions": len(catalog.colleges),
                    "programmes": sum(len(p.courses) for p in catalog.colleges),
                    "sources": len(catalog.sources),
                },
                indent=2,
            )
        )
        return
    try:
        async with get_session_factory()() as db, db.begin():
            changed = await apply_catalog(db, catalog, digest)
        print("Official catalog applied." if changed else "Official catalog already current.")
    finally:
        await get_engine().dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    asyncio.run(run(parser.parse_args().apply))
