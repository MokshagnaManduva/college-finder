"""Idempotent demo seed. Never truncates records, users, or workspace notes."""

import argparse
import asyncio
import json
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

from sqlalchemy import case, exists, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.session import get_engine, get_session_factory
from app.models import College, CollegeMetric, Course, CourseFact, DataSource, User

DATA = Path(__file__).parent / "data" / "colleges.json"


def stable_id(kind: str, key: str):
    return uuid5(NAMESPACE_URL, f"college-finder/{kind}/{key}")


async def upsert(db: AsyncSession, model, values: dict):
    statement = insert(model).values(**values)
    updates = {key: value for key, value in values.items() if key != "id"}
    if model is Course:
        for key, kind in (
            ("annual_tuition", "tuition"),
            ("fee_basis", "tuition"),
            ("duration_months", "duration"),
        ):
            if key in updates:
                reviewed = exists().where(
                    CourseFact.course_id == Course.id, CourseFact.kind == kind
                )
                updates[key] = case((reviewed, getattr(Course, key)), else_=updates[key])
    await db.execute(statement.on_conflict_do_update(index_elements=["id"], set_=updates))


async def seed_data(db: AsyncSession, *, commit: bool = True):
    source_id = stable_id("source", "legacy-demo")
    await upsert(
        db,
        DataSource,
        {
            "id": source_id,
            "title": "Legacy CollegeFind sample fixtures",
            "status": "demo",
            "url": None,
            "reporting_year": None,
            "verified_at": None,
        },
    )
    records = json.loads(DATA.read_text())
    for record in records:
        college_id = stable_id("college", record["slug"])
        values = {
            key: record[key]
            for key in [
                "name",
                "slug",
                "location",
                "city",
                "state",
                "type",
                "established",
                "description",
                "image",
                "accreditation",
                "facilities",
            ]
        }
        await upsert(db, College, {"id": college_id, "source_id": source_id, **values})
        for position, course in enumerate(record["courses"]):
            await upsert(
                db,
                Course,
                {
                    "id": stable_id("course", record["slug"] + "/" + course["name"]),
                    "college_id": college_id,
                    "name": course["name"],
                    "degree": course["degree"],
                    "duration_months": course["duration"] * 12,
                    "annual_tuition": course["fees"],
                    "fee_basis": "demo-assumption",
                    "seats": course["seats"],
                    "position": position,
                    "source_id": source_id,
                },
            )
        for kind in ["avgPackage", "highestPackage", "placementRate"]:
            await upsert(
                db,
                CollegeMetric,
                {
                    "id": stable_id("metric", record["slug"] + "/" + kind),
                    "college_id": college_id,
                    "kind": kind,
                    "amount": record["placements"][kind],
                    "unit": "percent" if kind == "placementRate" else "INR/year",
                    "scope": None,
                    "source_id": source_id,
                },
            )
    if commit:
        await db.commit()
    return {"colleges": len(records), "courses": sum(len(item["courses"]) for item in records)}


async def run(demo_user: bool):
    if not get_settings().allow_demo_seed:
        raise SystemExit(
            "Demo seed is disabled. Set ALLOW_DEMO_SEED=true for a local demo database."
        )
    async with get_session_factory()() as db:
        counts = await seed_data(db)
        if demo_user:
            existing = await db.scalar(select(User).where(User.email == "demo@college.in"))
            if not existing:
                db.add(
                    User(
                        email="demo@college.in",
                        name="Demo Student",
                        password_hash=hash_password("demo1234"),
                    )
                )
                await db.commit()
        print(f"Demo seed ready: {counts['colleges']} colleges, {counts['courses']} courses.")
    await get_engine().dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--demo-user", action="store_true", help="Create a local demo login if absent"
    )
    asyncio.run(run(parser.parse_args().demo_user))
