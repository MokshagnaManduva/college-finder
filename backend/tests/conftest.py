import os
from uuid import uuid4

import httpx
import pytest
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import get_settings
from app.core.deps import get_db
from app.db.base import Base
from app.main import create_app
from seed.seed import seed_data


@pytest.fixture
async def api():
    test_url = os.getenv("TEST_DATABASE_URL")
    if not test_url:
        pytest.skip("Set TEST_DATABASE_URL to a separate disposable PostgreSQL database")
    url = make_url(test_url)
    main = make_url(get_settings().database_url)
    if not url.database or not url.database.endswith("_test") or url.database == main.database:
        raise RuntimeError("Tests require a separate database whose name ends in _test")
    schema = "test_" + uuid4().hex
    admin = create_async_engine(test_url, poolclass=NullPool)
    async with admin.begin() as connection:
        await connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    engine = create_async_engine(
        test_url,
        poolclass=NullPool,
        connect_args={"server_settings": {"search_path": schema}},
    )
    try:
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        factory = async_sessionmaker(engine, expire_on_commit=False)
        async with factory() as db:
            await seed_data(db)
        app = create_app()

        async def test_db():
            async with factory() as db:
                yield db

        app.dependency_overrides[get_db] = test_db
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            yield client, factory
    finally:
        await engine.dispose()
        async with admin.begin() as connection:
            await connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        await admin.dispose()


async def register(client, email="student@example.com"):
    response = await client.post(
        "/api/auth/register",
        json={
            "name": "Test Student",
            "email": email,
            "password": "student1234",
        },
    )
    assert response.status_code == 201, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


async def option(client, slug="iit-bombay"):
    response = await client.get(f"/api/colleges/{slug}")
    college = response.json()
    return {"collegeId": college["id"], "courseId": college["courses"][0]["id"]}
