import asyncio
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import jwt
import pytest
from sqlalchemy import func, select

from app.core.config import get_settings
from app.models import College, Course, User
from seed.seed import seed_data
from tests.conftest import option, register


async def test_discovery_and_sources(api):
    client, _ = api
    response = await client.get("/api/colleges")
    assert response.status_code == 200
    assert response.json()["total"] == 19
    detail = (await client.get("/api/colleges/iit-bombay")).json()
    assert detail["dataStatus"] == "demo"
    assert detail["source"]["status"] == "demo"
    assert detail["source"]["url"] is None
    assert detail["courses"][0]["durationMonths"] == 48
    assert detail["courses"][0]["source"]["verifiedAt"] is None
    assert "rating" not in detail and "reviews" not in detail and "_count" not in detail
    assert len(detail["metrics"]) == 3
    assert (await client.get("/api/colleges/not-a-college")).status_code == 404
    filters = (await client.get("/api/colleges/filters")).json()
    assert "B.Tech" in filters["degrees"] and "Maharashtra" in filters["states"]
    assert len((await client.get("/api/colleges/catalog")).json()) == 19


async def test_course_filters_apply_to_the_same_course(api):
    client, _ = api
    result = (
        await client.get(
            "/api/colleges",
            params={
                "search": "COMPUTER SCIENCE",
                "degree": "B.Tech",
                "budget": 100000,
            },
        )
    ).json()
    assert all(college["slug"] != "iit-bombay" for college in result["data"])
    assert result["total"] == 0
    found = (await client.get("/api/colleges", params={"search": "Mumbai"})).json()
    assert any(item["slug"] == "iit-bombay" for item in found["data"])


@pytest.mark.parametrize(
    "params",
    [
        {"sort": "rating"},
        {"budget": -1},
        {"page": 0},
        {"limit": 51},
        {"degree": "x" * 101},
    ],
)
async def test_query_validation(api, params):
    client, _ = api
    assert (await client.get("/api/colleges", params=params)).status_code == 422


async def test_pagination_and_literal_search(api):
    client, _ = api
    result = (await client.get("/api/colleges", params={"page": 999, "limit": 8})).json()
    assert result["page"] == result["totalPages"] == 3
    assert len(result["data"]) == 3
    assert (await client.get("/api/colleges", params={"search": "%"})).json()["total"] == 0


async def test_matching_and_preference_overrides(api):
    client, _ = api
    body = {
        "query": {},
        "preferences": {
            "degree": "B.Tech",
            "states": ["Maharashtra"],
            "strictLocation": True,
            "budget": 250000,
            "strictBudget": True,
        },
    }
    result = (await client.post("/api/matches", json=body)).json()
    assert [college["slug"] for college in result["data"]] == ["iit-bombay"]
    body["preferences"]["budget"] = 0
    assert (await client.post("/api/matches", json=body)).json()["total"] == 0


async def test_auth_and_case_insensitive_duplicates(api):
    client, _ = api
    headers = await register(client, "Student@Example.com")
    me = (await client.get("/api/auth/me", headers=headers)).json()
    assert me["email"] == "student@example.com" and "passwordHash" not in me
    duplicate = await client.post(
        "/api/auth/register",
        json={
            "name": "Other Student",
            "email": "STUDENT@example.com",
            "password": "student1234",
        },
    )
    assert duplicate.status_code == 409
    bad = await client.post(
        "/api/auth/login",
        json={
            "email": me["email"],
            "password": "incorrect",
        },
    )
    assert bad.status_code == 401
    good = await client.post(
        "/api/auth/login",
        json={
            "email": "STUDENT@example.com",
            "password": "student1234",
        },
    )
    assert good.status_code == 200 and "access_token" in good.json()
    assert (await client.get("/api/workspace")).status_code == 401


async def test_unicode_password_limit(api):
    client, _ = api
    response = await client.post(
        "/api/auth/register",
        json={
            "email": "unicode@example.com",
            "name": "Unicode Student",
            "password": "😀" * 20,
        },
    )
    assert response.status_code == 422


async def test_expired_token(api):
    client, factory = api
    await register(client)
    async with factory() as db:
        user = await db.scalar(select(User))
    token = jwt.encode(
        {
            "sub": str(user.id),
            "iat": datetime.now(UTC) - timedelta(days=8),
            "exp": datetime.now(UTC) - timedelta(seconds=1),
        },
        get_settings().jwt_secret,
        algorithm="HS256",
    )
    assert (
        await client.get(
            "/api/auth/me",
            headers={
                "Authorization": f"Bearer {token}",
            },
        )
    ).status_code == 401


async def test_profile_round_trip(api):
    client, _ = api
    headers = await register(client)
    assert (await client.get("/api/profile", headers=headers)).json() is None
    preferences = {
        "degree": "MBA",
        "states": ["Delhi", "Delhi"],
        "budget": 0,
        "strictBudget": True,
        "strictLocation": False,
    }
    result = await client.put("/api/profile", headers=headers, json=preferences)
    assert result.status_code == 200
    assert result.json()["states"] == ["Delhi"] and result.json()["budget"] == 0
    assert (await client.get("/api/profile", headers=headers)).json() == result.json()


async def test_workspace_crud_revision_and_owner_isolation(api):
    client, _ = api
    first = await register(client)
    second = await register(client, "other@example.com")
    payload = {
        **await option(client),
        "notes": "My notes",
        "targetDate": "2026-11-01",
        "scenario": {"tuition": 220000, "living": None, "other": 0, "oneTime": 0},
    }
    created = await client.post("/api/workspace", headers=first, json=payload)
    assert created.status_code == 201, created.text
    entry = created.json()
    assert entry["revision"] == 1 and entry["scenario"]["living"] is None
    assert (await client.get("/api/workspace", headers=second)).json() == []
    assert (
        await client.patch(
            f"/api/workspace/{entry['id']}", headers=second, json={"revision": 1, "notes": "stolen"}
        )
    ).status_code == 404
    patch = await client.patch(
        f"/api/workspace/{entry['id']}",
        headers=first,
        json={"revision": 1, "stage": "Shortlisted", "targetDate": None},
    )
    assert patch.status_code == 200 and patch.json()["revision"] == 2
    stale = await client.patch(
        f"/api/workspace/{entry['id']}", headers=first, json={"revision": 1, "notes": "stale"}
    )
    assert stale.status_code == 409 and stale.json()["detail"]["current"]["revision"] == 2
    assert (
        await client.delete(f"/api/workspace/{entry['id']}?revision=1", headers=first)
    ).status_code == 409
    assert (
        await client.delete(f"/api/workspace/{entry['id']}?revision=2", headers=first)
    ).status_code == 204


async def test_null_course_duplicates_and_distinct_course_options(api):
    client, _ = api
    headers = await register(client)
    selected = await option(client)
    payload = {"collegeId": selected["collegeId"], "courseId": None}
    assert (await client.post("/api/workspace", headers=headers, json=payload)).status_code == 201
    assert (await client.post("/api/workspace", headers=headers, json=payload)).status_code == 409
    assert (await client.post("/api/workspace", headers=headers, json=selected)).status_code == 201
    assert len((await client.get("/api/workspace", headers=headers)).json()) == 2


async def test_wrong_course_and_bad_scenario(api):
    client, _ = api
    headers = await register(client)
    first, second = await option(client), await option(client, "iit-delhi")
    invalid = {"collegeId": first["collegeId"], "courseId": second["courseId"]}
    assert (await client.post("/api/workspace", headers=headers, json=invalid)).status_code == 422
    invalid = {**first, "scenario": {"tuition": -1, "living": 0, "other": 0, "oneTime": 0}}
    assert (await client.post("/api/workspace", headers=headers, json=invalid)).status_code == 422


async def test_guest_import_retry_and_conflicts(api):
    client, _ = api
    headers = await register(client)
    selected = await option(client)
    payload = {
        "key": str(uuid4()),
        "entries": [
            {
                **selected,
                "clientId": str(uuid4()),
                "notes": "Guest notes",
            }
        ],
    }
    imported = await client.post("/api/workspace/import", headers=headers, json=payload)
    assert imported.status_code == 200, imported.text
    assert len(imported.json()["imported"]) == 1 and imported.json()["conflicts"] == []
    replay = await client.post("/api/workspace/import", headers=headers, json=payload)
    assert replay.json() == imported.json()
    assert len((await client.get("/api/workspace", headers=headers)).json()) == 1
    payload["entries"][0]["notes"] = "Different notes"
    assert (
        await client.post("/api/workspace/import", headers=headers, json=payload)
    ).status_code == 409
    payload["key"] = str(uuid4())
    conflict = (await client.post("/api/workspace/import", headers=headers, json=payload)).json()
    assert conflict["conflicts"][0]["account"]["notes"] == "Guest notes"
    assert conflict["conflicts"][0]["guest"]["notes"] == "Different notes"


async def test_import_is_atomic_and_validates_every_option(api):
    client, _ = api
    headers = await register(client)
    payload = {
        "key": str(uuid4()),
        "entries": [
            {**await option(client), "clientId": str(uuid4())},
            {"collegeId": str(uuid4()), "courseId": None, "clientId": str(uuid4())},
        ],
    }
    assert (
        await client.post("/api/workspace/import", headers=headers, json=payload)
    ).status_code == 404
    assert (await client.get("/api/workspace", headers=headers)).json() == []


async def test_concurrent_imports_do_not_duplicate_entries(api):
    client, _ = api
    headers = await register(client)
    selected = await option(client)
    payload = {"key": str(uuid4()), "entries": [{**selected, "clientId": str(uuid4())}]}
    responses = await asyncio.gather(
        *[client.post("/api/workspace/import", headers=headers, json=payload) for _ in range(3)]
    )
    assert all(response.status_code == 200 for response in responses)
    assert len((await client.get("/api/workspace", headers=headers)).json()) == 1


async def test_compare_preserves_order_and_validates_options(api):
    client, _ = api
    first, second = await option(client), await option(client, "iit-delhi")
    response = await client.post("/api/compare", json={"options": [second, first]})
    assert response.status_code == 200
    assert [item["college"]["slug"] for item in response.json()] == ["iit-delhi", "iit-bombay"]
    assert (await client.post("/api/compare", json={"options": [first, first]})).status_code == 422


async def test_seed_is_idempotent_and_preserves_users_and_notes(api):
    client, factory = api
    headers = await register(client)
    await client.post(
        "/api/workspace", headers=headers, json={**await option(client), "notes": "Keep"}
    )
    async with factory() as db:
        await seed_data(db)
        assert await db.scalar(select(func.count()).select_from(College)) == 19
        assert await db.scalar(select(func.count()).select_from(Course)) == 57
    assert (await client.get("/api/workspace", headers=headers)).json()[0]["notes"] == "Keep"


async def test_password_change_revokes_old_tokens_and_requires_current_password(api):
    client, _ = api
    old = await register(client)
    wrong = await client.post(
        "/api/auth/password",
        headers=old,
        json={"currentPassword": "not-the-password", "newPassword": "replacement123"},
    )
    assert wrong.status_code == 403
    same = await client.post(
        "/api/auth/password",
        headers=old,
        json={"currentPassword": "student1234", "newPassword": "student1234"},
    )
    assert same.status_code == 422
    changed = await client.post(
        "/api/auth/password",
        headers=old,
        json={"currentPassword": "student1234", "newPassword": "replacement123"},
    )
    assert changed.status_code == 200, changed.text
    new = {"Authorization": f"Bearer {changed.json()['access_token']}"}
    assert (await client.get("/api/auth/me", headers=old)).status_code == 401
    assert (await client.get("/api/auth/me", headers=new)).status_code == 200
    credentials = {"email": "student@example.com"}
    assert (
        await client.post("/api/auth/login", json={**credentials, "password": "student1234"})
    ).status_code == 401
    assert (
        await client.post("/api/auth/login", json={**credentials, "password": "replacement123"})
    ).status_code == 200
    everywhere = await client.post("/api/auth/logout-all", headers=new)
    assert everywhere.status_code == 200
    assert (await client.get("/api/auth/me", headers=new)).status_code == 401


async def test_account_deletion_requires_password_and_removes_private_records(api):
    client, factory = api
    headers = await register(client)
    other = await register(client, "other@example.com")
    for owner in (headers, other):
        created = await client.post("/api/workspace", headers=owner, json=await option(client))
        assert created.status_code == 201
    await client.put("/api/profile", headers=headers, json={"degree": "B.Tech"})
    refused = await client.post(
        "/api/auth/delete-account", headers=headers, json={"password": "incorrect"}
    )
    assert refused.status_code == 403
    assert (await client.get("/api/auth/me", headers=headers)).status_code == 200
    removed = await client.post(
        "/api/auth/delete-account", headers=headers, json={"password": "student1234"}
    )
    assert removed.status_code == 204
    assert (await client.get("/api/auth/me", headers=headers)).status_code == 401
    assert len((await client.get("/api/workspace", headers=other)).json()) == 1
    async with factory() as db:
        assert await db.scalar(select(func.count()).select_from(User)) == 1
    again = await register(client)
    assert (await client.get("/api/workspace", headers=again)).json() == []


async def test_repeated_login_failures_are_limited_per_account(api):
    client, _ = api
    await register(client)
    credentials = {"email": "student@example.com", "password": "incorrect"}
    for _ in range(8):
        assert (await client.post("/api/auth/login", json=credentials)).status_code == 401
    blocked = await client.post(
        "/api/auth/login", json={"email": "Student@example.com", "password": "student1234"}
    )
    assert blocked.status_code == 429 and int(blocked.headers["retry-after"]) > 0
    # Another account from the same address is unaffected.
    other = await register(client, "other@example.com")
    assert (await client.get("/api/auth/me", headers=other)).status_code == 200
    assert (
        await client.post(
            "/api/auth/login", json={"email": "other@example.com", "password": "student1234"}
        )
    ).status_code == 200


async def test_security_headers_origins_and_body_limit(api, monkeypatch):
    client, _ = api
    response = await client.get("/api/health")
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    private = await client.get("/api/workspace")
    assert private.status_code == 401 and private.headers["cache-control"] == "no-store"
    large = await client.post(
        "/api/auth/login",
        content=b"x" * 2_000_001,
        headers={"Content-Type": "application/json"},
    )
    assert large.status_code == 413
    settings = get_settings().model_copy(
        update={"frontend_url": "https://one.example/, https://two.example , *"}
    )
    assert settings.frontend_origins == ["https://one.example", "https://two.example"]


async def test_workspace_capacity_is_bounded(api, monkeypatch):
    client, _ = api
    monkeypatch.setattr("app.services.workspace.MAX_ENTRIES", 1)
    headers = await register(client)
    first, second = await option(client), await option(client, "iit-delhi")
    assert (await client.post("/api/workspace", headers=headers, json=first)).status_code == 201
    assert (await client.post("/api/workspace", headers=headers, json=second)).status_code == 409
    payload = {"key": str(uuid4()), "entries": [{**second, "clientId": str(uuid4())}]}
    assert (
        await client.post("/api/workspace/import", headers=headers, json=payload)
    ).status_code == 409
    replay = {"key": str(uuid4()), "entries": [{**first, "clientId": str(uuid4())}]}
    assert (
        await client.post("/api/workspace/import", headers=headers, json=replay)
    ).status_code == 200
