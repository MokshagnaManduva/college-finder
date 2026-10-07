import pytest
from sqlalchemy import delete, func, select

from app.core.config import get_settings
from app.models import College, Course, CourseFact, User
from seed import bootstrap


async def test_hosted_demo_bootstrap_is_opt_in_atomic_and_never_creates_users(api, monkeypatch):
    _, factory = api
    monkeypatch.setattr(get_settings(), "bootstrap_demo_catalog", False)
    async with factory() as db:
        await db.execute(delete(College))
        await db.commit()
        assert not await bootstrap.bootstrap_catalog(db)
        assert await db.scalar(select(func.count()).select_from(College)) == 0
    monkeypatch.setattr(get_settings(), "bootstrap_demo_catalog", True)
    original_import = bootstrap.import_review

    async def failed_review(*args, **kwargs):
        raise ValueError("Review failed")

    monkeypatch.setattr(bootstrap, "import_review", failed_review)
    async with factory() as db:
        with pytest.raises(ValueError, match="Review failed"):
            await bootstrap.bootstrap_catalog(db)
        assert await db.scalar(select(func.count()).select_from(College)) == 0
    monkeypatch.setattr(bootstrap, "import_review", original_import)
    async with factory() as db:
        assert await bootstrap.bootstrap_catalog(db)
        assert await db.scalar(select(func.count()).select_from(College)) == 19
        assert await db.scalar(select(func.count()).select_from(Course)) == 57
        assert await db.scalar(select(func.count()).select_from(CourseFact)) == 18
        assert await db.scalar(select(func.count()).select_from(User)) == 0
    async with factory() as db:
        college = await db.scalar(select(College).limit(1))
        college.description = "Keep this operator edit"
        await db.commit()
        assert not await bootstrap.bootstrap_catalog(db)
        assert await db.scalar(select(College.description).where(College.id == college.id)) == (
            "Keep this operator edit"
        )
