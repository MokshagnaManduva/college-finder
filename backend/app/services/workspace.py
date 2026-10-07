import hashlib
import json
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import StudentProfile, User, WorkspaceEntry, WorkspaceImport
from app.schemas.workspace import EntryCreate, EntryOut, EntryPatch, ImportRequest, Preferences
from app.services.colleges import validate_option


def serialize_entry(entry: WorkspaceEntry) -> EntryOut:
    return EntryOut.model_validate(entry)


async def list_entries(db: AsyncSession, user_id: UUID) -> list[EntryOut]:
    entries = await db.scalars(
        select(WorkspaceEntry)
        .where(WorkspaceEntry.user_id == user_id)
        .order_by(WorkspaceEntry.created_at, WorkspaceEntry.id)
    )
    return [serialize_entry(entry) for entry in entries]


async def get_owned(db: AsyncSession, user_id: UUID, entry_id: UUID, *, lock: bool = False):
    statement = select(WorkspaceEntry).where(
        WorkspaceEntry.id == entry_id,
        WorkspaceEntry.user_id == user_id,
    )
    if lock:
        statement = statement.with_for_update()
    entry = await db.scalar(statement)
    if entry is None:
        raise HTTPException(404, "Workspace entry not found")
    return entry


async def create_entry(db: AsyncSession, user_id: UUID, payload: EntryCreate) -> EntryOut:
    await validate_option(db, payload.college_id, payload.course_id)
    entry = WorkspaceEntry(user_id=user_id, **payload.model_dump())
    db.add(entry)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        if getattr(exc.orig, "sqlstate", None) != "23505":
            raise
        raise HTTPException(409, "This college/course option is already in your workspace") from exc
    await db.refresh(entry)
    return serialize_entry(entry)


def require_revision(entry: WorkspaceEntry, revision: int) -> None:
    if entry.revision != revision:
        raise HTTPException(
            409,
            {
                "message": "This option changed in another session. Review the latest version.",
                "current": serialize_entry(entry).model_dump(mode="json", by_alias=True),
            },
        )


async def patch_entry(
    db: AsyncSession,
    user_id: UUID,
    entry_id: UUID,
    payload: EntryPatch,
) -> EntryOut:
    entry = await get_owned(db, user_id, entry_id, lock=True)
    require_revision(entry, payload.revision)
    for key, value in payload.model_dump(exclude_unset=True, exclude={"revision"}).items():
        setattr(entry, key, value)
    entry.revision += 1
    await db.commit()
    await db.refresh(entry)
    return serialize_entry(entry)


async def delete_entry(db: AsyncSession, user_id: UUID, entry_id: UUID, revision: int):
    entry = await get_owned(db, user_id, entry_id, lock=True)
    require_revision(entry, revision)
    await db.delete(entry)
    await db.commit()


async def get_profile(db: AsyncSession, user_id: UUID) -> Preferences | None:
    profile = await db.get(StudentProfile, user_id)
    return Preferences.model_validate(profile.preferences) if profile else None


async def save_profile(db: AsyncSession, user_id: UUID, preferences: Preferences) -> Preferences:
    await db.execute(
        insert(StudentProfile)
        .values(
            user_id=user_id,
            preferences=preferences.model_dump(),
        )
        .on_conflict_do_update(
            index_elements=[StudentProfile.user_id],
            set_={"preferences": preferences.model_dump()},
        )
    )
    await db.commit()
    return preferences


async def import_entries(db: AsyncSession, user_id: UUID, payload: ImportRequest):
    # Serialize imports for this user. Unique option constraints also protect concurrent creates.
    await db.scalar(select(User.id).where(User.id == user_id).with_for_update())
    canonical = payload.model_dump(mode="json", exclude={"key"})
    digest = hashlib.sha256(json.dumps(canonical, sort_keys=True).encode()).hexdigest()
    previous = await db.scalar(
        select(WorkspaceImport).where(
            WorkspaceImport.user_id == user_id,
            WorkspaceImport.key == payload.key,
        )
    )
    if previous:
        if previous.payload_hash != digest:
            raise HTTPException(409, "Import key was already used with a different payload")
        return previous.response
    seen = set()
    for incoming in payload.entries:
        pair = (incoming.college_id, incoming.course_id)
        if pair in seen:
            raise HTTPException(422, "Import includes a duplicate college/course option")
        seen.add(pair)
        await validate_option(db, *pair)
    imported, conflicts = [], []
    for incoming in payload.entries:
        values = incoming.model_dump(exclude={"client_id"})
        # ON CONFLICT waits for any concurrent creator without aborting this transaction.
        statement = insert(WorkspaceEntry).values(user_id=user_id, **values)
        entry_id = await db.scalar(
            statement.on_conflict_do_nothing(
                constraint="uq_workspace_user_option",
            ).returning(WorkspaceEntry.id)
        )
        entry = await db.scalar(
            select(WorkspaceEntry)
            .where(
                WorkspaceEntry.user_id == user_id,
                WorkspaceEntry.college_id == incoming.college_id,
                WorkspaceEntry.course_id == incoming.course_id,
            )
            .with_for_update()
        )
        await db.refresh(entry)
        current = serialize_entry(entry).model_dump(mode="json", by_alias=True)
        comparable = EntryCreate.model_validate(
            EntryOut.model_validate(current).model_dump(
                exclude={"id", "revision", "created_at", "updated_at"},
            )
        ).model_dump(mode="json")
        guest = incoming.model_dump(mode="json", by_alias=True, exclude={"client_id"})
        normalized_guest = EntryCreate.model_validate(values).model_dump(mode="json")
        if entry_id is not None or comparable == normalized_guest:
            imported.append({"clientId": str(incoming.client_id), "entryId": str(entry.id)})
        else:
            conflicts.append(
                {
                    "clientId": str(incoming.client_id),
                    "guest": guest,
                    "account": current,
                }
            )
    response = {"imported": imported, "conflicts": conflicts}
    db.add(
        WorkspaceImport(user_id=user_id, key=payload.key, payload_hash=digest, response=response)
    )
    await db.commit()
    return response
