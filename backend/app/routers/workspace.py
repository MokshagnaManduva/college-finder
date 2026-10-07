from uuid import UUID

from fastapi import APIRouter, Query, Response

from app.core.deps import Database
from app.routers.auth import CurrentUser
from app.schemas.workspace import EntryCreate, EntryOut, EntryPatch, ImportRequest, Preferences
from app.services import workspace

router = APIRouter(tags=["Workspace"])


@router.get("/profile", response_model=Preferences | None)
async def profile(user: CurrentUser, db: Database):
    return await workspace.get_profile(db, user.id)


@router.put("/profile", response_model=Preferences)
async def save_profile(payload: Preferences, user: CurrentUser, db: Database):
    return await workspace.save_profile(db, user.id, payload)


@router.get("/workspace", response_model=list[EntryOut])
async def list_entries(user: CurrentUser, db: Database):
    return await workspace.list_entries(db, user.id)


@router.post("/workspace", response_model=EntryOut, status_code=201)
async def create_entry(payload: EntryCreate, user: CurrentUser, db: Database):
    return await workspace.create_entry(db, user.id, payload)


@router.post("/workspace/import")
async def import_entries(payload: ImportRequest, user: CurrentUser, db: Database):
    return await workspace.import_entries(db, user.id, payload)


@router.patch("/workspace/{entry_id}", response_model=EntryOut)
async def patch_entry(entry_id: UUID, payload: EntryPatch, user: CurrentUser, db: Database):
    return await workspace.patch_entry(db, user.id, entry_id, payload)


@router.delete("/workspace/{entry_id}", status_code=204)
async def delete_entry(
    entry_id: UUID,
    user: CurrentUser,
    db: Database,
    revision: int = Query(ge=1),
):
    await workspace.delete_entry(db, user.id, entry_id, revision)
    return Response(status_code=204)
