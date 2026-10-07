"""Opt-in initialization of an empty hosted demo; never creates users or resets data."""

import asyncio
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.session import get_engine, get_session_factory
from app.models import College
from app.schemas.review import ReviewManifest
from app.services.review import import_review
from seed.review import verify_documents
from seed.seed import seed_data


async def bootstrap_catalog(db: AsyncSession) -> bool:
    if not get_settings().bootstrap_demo_catalog:
        return False
    root = Path(__file__).parent
    manifest = ReviewManifest.model_validate_json(
        (root / "data/reviewed_directory_2026.json").read_text()
    )
    verify_documents(manifest, root / "evidence")
    async with db.begin():
        if await db.scalar(select(func.count()).select_from(College)):
            return False
        await seed_data(db, commit=False)
        await import_review(db, manifest, apply=True)
    return True


async def run():
    try:
        async with get_session_factory()() as db:
            initialized = await bootstrap_catalog(db)
        print("Hosted demo catalog initialized." if initialized else "Catalog left unchanged.")
    finally:
        await get_engine().dispose()


if __name__ == "__main__":
    asyncio.run(run())
