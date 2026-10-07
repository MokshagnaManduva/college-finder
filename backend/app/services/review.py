import json

from sqlalchemy import select

from app.models import College, Course, CourseFact, DataSource
from app.schemas.review import ReviewManifest
from seed.seed import stable_id, upsert


async def import_review(db, manifest: ReviewManifest, *, apply: bool = False):
    """Validate the whole review before writes. Caller owns the transaction."""
    targets = []
    for item in sorted(manifest.courses, key=lambda course: str(course.course_id)):
        course = await db.scalar(
            select(Course)
            .join(College)
            .where(
                Course.id == item.course_id,
                College.slug == item.college_slug,
            )
            .with_for_update()
        )
        if course is None:
            raise ValueError(f"Course {item.course_id} does not belong to {item.college_slug}")
        for fact in item.facts:
            existing = await db.scalar(
                select(CourseFact).where(
                    CourseFact.course_id == course.id,
                    CourseFact.kind == fact.kind,
                )
            )
            payload = fact.model_dump(mode="json", by_alias=True)
            if existing and (
                existing.reviewed_at > fact.source.verified_at
                or (existing.reviewed_at == fact.source.verified_at and existing.payload != payload)
            ):
                raise ValueError("An equal or newer review already exists with different evidence")
            targets.append((course, fact, payload))
    summary = [
        {
            "courseId": str(course.id),
            "claim": fact.kind,
            "before": course.annual_tuition if fact.kind == "tuition" else course.duration_months,
            "after": fact.normalized_value,
        }
        for course, fact, _ in targets
    ]
    if not apply:
        return summary
    for course, fact, payload in targets:
        source = fact.source
        # Distinct claim scopes/editions of the same URL must not overwrite each other.
        source_id = stable_id("source", json.dumps(source.model_dump(mode="json"), sort_keys=True))
        await upsert(
            db,
            DataSource,
            {
                "id": source_id,
                "title": source.title,
                "status": "verified",
                "url": str(source.url),
                "reporting_year": source.reporting_year,
                "verified_at": source.verified_at,
            },
        )
        await upsert(
            db,
            CourseFact,
            {
                "id": stable_id("course-fact", str(course.id) + "/" + fact.kind),
                "course_id": course.id,
                "kind": fact.kind,
                "raw_value": fact.raw_value,
                "raw_unit": fact.raw_unit,
                "factor": fact.factor,
                "normalized_value": fact.normalized_value,
                "notes": fact.notes,
                "reviewer": source.reviewer,
                "reviewed_at": source.verified_at,
                "payload": payload,
                "source_id": source_id,
            },
        )
        if fact.kind == "tuition":
            course.annual_tuition = fact.normalized_value
            course.fee_basis = "reported"
        else:
            course.duration_months = fact.normalized_value
    await db.flush()
    return summary
