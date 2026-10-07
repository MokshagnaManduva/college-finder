from math import ceil
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import case, func, literal, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import College, CollegeMetric, Course, CourseFact
from app.schemas.college import (
    CollegeOut,
    CollegeQuery,
    CollegesResponse,
    CourseOut,
    FiltersOut,
    PlacementsOut,
)
from app.schemas.workspace import Preferences

LOADS = (
    selectinload(College.source),
    selectinload(College.courses).selectinload(Course.source),
    selectinload(College.courses).selectinload(Course.facts).selectinload(CourseFact.source),
    selectinload(College.metrics).selectinload(CollegeMetric.source),
)


def serialize_college(college: College) -> CollegeOut:
    values = {metric.kind: metric for metric in college.metrics}
    median = values.get("medianPackage")
    placements = PlacementsOut(
        median_package=int(median.amount) if median else None,
        graduates=int(values["graduates"].amount) if "graduates" in values else None,
        placed=int(values["placed"].amount) if "placed" in values else None,
        higher_studies=int(values["higherStudies"].amount) if "higherStudies" in values else None,
        reporting_year=median.source.reporting_year if median else None,
        scope=median.scope if median else None,
        source=median.source if median else None,
        avg_package=int(values["avgPackage"].amount) if "avgPackage" in values else None,
        highest_package=int(values["highestPackage"].amount)
        if "highestPackage" in values
        else None,
        placement_rate=float(values["placementRate"].amount) if "placementRate" in values else None,
    )
    return CollegeOut(
        id=college.id,
        name=college.name,
        slug=college.slug,
        location=college.location,
        city=college.city,
        state=college.state,
        type=college.type,
        established=college.established,
        description=college.description,
        image=college.image,
        accreditation=college.accreditation,
        facilities=college.facilities,
        data_status=college.source.status,
        source=college.source,
        courses=[
            CourseOut(
                **{
                    key: getattr(course, key)
                    for key in (
                        "id",
                        "name",
                        "degree",
                        "duration_months",
                        "annual_tuition",
                        "fee_basis",
                        "seats",
                        "source",
                    )
                },
                tuition_evidence=next(
                    (fact for fact in course.facts if fact.kind == "tuition"), None
                ),
                duration_evidence=next(
                    (fact for fact in course.facts if fact.kind == "duration"), None
                ),
            )
            for course in college.courses
            if course.published
        ],
        placements=placements,
        metrics=college.metrics,
    )


def literal_pattern(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def qualifying_courses(query: CollegeQuery, preferences: Preferences | None):
    conditions = [Course.published.is_(True)]
    if query.search.strip():
        pattern = f"%{literal_pattern(query.search.strip())}%"
        conditions.append(
            or_(
                *(
                    column.ilike(pattern, escape="\\")
                    for column in (
                        College.name,
                        College.location,
                        College.city,
                        College.state,
                        College.type,
                        Course.name,
                        Course.degree,
                    )
                )
            )
        )
    if query.state:
        conditions.append(func.lower(College.state) == query.state.lower())
    if query.degree:
        conditions.append(func.lower(Course.degree) == query.degree.lower())
    if query.budget is not None:
        conditions.append(Course.annual_tuition <= query.budget)
    score = literal(0)
    if preferences:
        if preferences.degree:
            conditions.append(func.lower(Course.degree) == preferences.degree.lower())
            score = score + 1
        if preferences.states:
            location_match = func.lower(College.state).in_(
                [state.lower() for state in preferences.states]
            )
            if preferences.strict_location:
                conditions.append(location_match)
            score = score + case((location_match, 1), else_=0)
        if preferences.budget is not None:
            budget_match = Course.annual_tuition <= preferences.budget
            if preferences.strict_budget:
                conditions.append(budget_match)
            score = score + case((budget_match, 1), else_=0)
    return (
        select(Course.college_id, Course.annual_tuition, score.label("score"))
        .join(College, College.id == Course.college_id)
        .where(*conditions)
        .cte("qualifying")
    )


async def list_colleges(
    db: AsyncSession,
    query: CollegeQuery,
    preferences: Preferences | None = None,
) -> CollegesResponse:
    courses = qualifying_courses(query, preferences)
    grouped = (
        select(
            courses.c.college_id,
            func.max(courses.c.score).label("score"),
            func.min(courses.c.annual_tuition).label("tuition"),
        )
        .group_by(courses.c.college_id)
        .cte("matching")
    )
    total = await db.scalar(select(func.count()).select_from(grouped)) or 0
    total_pages = max(1, ceil(total / query.limit))
    page = min(query.page, total_pages)
    orders = [grouped.c.score.desc()]
    if query.sort == "tuition":
        orders.append(grouped.c.tuition.asc().nulls_last())
    elif query.sort == "established":
        orders.append(College.established.asc().nulls_last())
    orders.extend([func.lower(College.name).asc(), College.slug.asc()])
    records = await db.scalars(
        select(College)
        .join(grouped, grouped.c.college_id == College.id)
        .options(*LOADS)
        .order_by(*orders)
        .offset((page - 1) * query.limit)
        .limit(query.limit)
    )
    return CollegesResponse(
        data=[serialize_college(college) for college in records],
        total=total,
        total_pages=total_pages,
        page=page,
    )


async def get_catalog(db: AsyncSession) -> list[CollegeOut]:
    records = await db.scalars(select(College).options(*LOADS).order_by(College.name))
    return [serialize_college(college) for college in records]


async def get_filters(db: AsyncSession) -> FiltersOut:
    states = await db.scalars(select(College.state).distinct().order_by(College.state))
    degrees = await db.scalars(
        select(Course.degree).where(Course.published.is_(True)).distinct().order_by(Course.degree)
    )
    low, high = (
        await db.execute(
            select(func.min(Course.annual_tuition), func.max(Course.annual_tuition)).where(
                Course.published.is_(True)
            )
        )
    ).one()
    return FiltersOut(
        states=list(states), degrees=list(degrees), tuition_range={"min": low, "max": high}
    )


async def get_by_slug(db: AsyncSession, slug: str) -> CollegeOut:
    college = await db.scalar(select(College).where(College.slug == slug).options(*LOADS))
    if college is None:
        raise HTTPException(404, "College not found")
    return serialize_college(college)


async def validate_option(db: AsyncSession, college_id: UUID, course_id: UUID | None):
    if await db.get(College, college_id) is None:
        raise HTTPException(404, "College not found")
    if course_id is not None:
        course = await db.get(Course, course_id)
        if course is None or course.college_id != college_id:
            raise HTTPException(422, "Course must belong to the selected college")


async def compare_options(db: AsyncSession, options):
    pairs = [(option.college_id, option.course_id) for option in options]
    if len(set(pairs)) != len(pairs):
        raise HTTPException(422, "Comparison options must be distinct")
    output = []
    for option in options:
        await validate_option(db, option.college_id, option.course_id)
        if option.course_id is not None:
            course = await db.get(Course, option.course_id)
            if not course.published:
                raise HTTPException(422, "Selected programme is archived; workspace notes are kept")
        college = await db.scalar(
            select(College).where(College.id == option.college_id).options(*LOADS)
        )
        output.append(
            {
                "college": serialize_college(college).model_dump(mode="json", by_alias=True),
                "courseId": str(option.course_id) if option.course_id else None,
            }
        )
    return output
