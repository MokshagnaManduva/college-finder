"""Opt-in, versioned official catalog initialization or upgrade; no users are created."""

import asyncio

from app.core.config import get_settings
from app.db.session import get_engine, get_session_factory
from seed.catalog import apply_catalog, load_catalog


async def bootstrap_catalog(db) -> bool:
    # Retain the existing hosted environment key so deployments upgrade in place.
    if not get_settings().bootstrap_demo_catalog:
        return False
    catalog, digest = load_catalog()
    async with db.begin():
        return await apply_catalog(db, catalog, digest)


async def run():
    try:
        async with get_session_factory()() as db:
            changed = await bootstrap_catalog(db)
        print("Official catalog upgraded." if changed else "Catalog already current or disabled.")
    finally:
        await get_engine().dispose()


if __name__ == "__main__":
    asyncio.run(run())
