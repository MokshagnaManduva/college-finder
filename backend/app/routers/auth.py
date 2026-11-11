from typing import Annotated

from anyio import to_thread
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.core.deps import Database, get_current_user
from app.core.ratelimit import client_host, limiter
from app.core.security import create_access_token, hash_password, verify_password
from app.models import User
from app.schemas.auth import (
    AuthOut,
    DeleteAccountIn,
    LoginIn,
    PasswordChangeIn,
    RegisterIn,
    UserOut,
)

router = APIRouter(prefix="/auth", tags=["Auth"])
CurrentUser = Annotated[User, Depends(get_current_user)]
DUMMY_HASH = hash_password("dummy-password-for-timing")
WINDOW = 15 * 60
ACCOUNT_FAILURES = 8  # per address and account
ADDRESS_FAILURES = 40  # per address across accounts
REGISTRATIONS = 10  # per address and hour


def response(user: User) -> AuthOut:
    return AuthOut(
        access_token=create_access_token(user.id, user.email, user.name, user.token_version),
        user=UserOut.model_validate(user),
    )


async def confirm_password(request: Request, user: User, password: str) -> None:
    """Re-authenticate a signed-in user before a sensitive change, with attempt limits."""
    attempts = limiter(request)
    key = f"confirm:{user.id}"
    attempts.check(key, ACCOUNT_FAILURES, WINDOW)
    if not await to_thread.run_sync(verify_password, password, user.password_hash):
        attempts.record(key, WINDOW)
        raise HTTPException(403, "Current password is incorrect")
    attempts.reset(key)


@router.post("/register", response_model=AuthOut, status_code=201)
async def register(payload: RegisterIn, request: Request, db: Database):
    attempts = limiter(request)
    key = f"register:{client_host(request)}"
    attempts.check(key, REGISTRATIONS, 3600)
    attempts.record(key, 3600)
    user = User(
        email=str(payload.email).lower(),
        name=payload.name,
        password_hash=await to_thread.run_sync(hash_password, payload.password),
    )
    db.add(user)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        if getattr(exc.orig, "sqlstate", None) != "23505":
            raise
        raise HTTPException(409, "An account with this email already exists") from exc
    await db.refresh(user)
    return response(user)


@router.post("/login", response_model=AuthOut)
async def login(payload: LoginIn, request: Request, db: Database):
    email = str(payload.email).lower()
    host = client_host(request)
    attempts = limiter(request)
    account_key, address_key = f"login:{host}:{email}", f"login:{host}"
    attempts.check(account_key, ACCOUNT_FAILURES, WINDOW)
    attempts.check(address_key, ADDRESS_FAILURES, WINDOW)
    user = await db.scalar(select(User).where(func.lower(User.email) == email))
    valid = await to_thread.run_sync(
        verify_password,
        payload.password,
        user.password_hash if user else DUMMY_HASH,
    )
    if not user or not valid:
        attempts.record(account_key, WINDOW)
        attempts.record(address_key, WINDOW)
        raise HTTPException(401, "Email or password is incorrect")
    attempts.reset(account_key)
    return response(user)


@router.get("/me", response_model=UserOut)
async def me(user: CurrentUser):
    return user


@router.post("/password", response_model=AuthOut)
async def change_password(
    payload: PasswordChangeIn, request: Request, user: CurrentUser, db: Database
):
    await confirm_password(request, user, payload.current_password)
    if payload.new_password == payload.current_password:
        raise HTTPException(422, "Choose a password different from the current one")
    user.password_hash = await to_thread.run_sync(hash_password, payload.new_password)
    # Other devices must sign in again; this response carries the replacement token.
    user.token_version += 1
    await db.commit()
    await db.refresh(user)
    return response(user)


@router.post("/logout-all", response_model=AuthOut)
async def logout_everywhere(user: CurrentUser, db: Database):
    user.token_version += 1
    await db.commit()
    await db.refresh(user)
    return response(user)


@router.post("/delete-account", status_code=204)
async def delete_account(
    payload: DeleteAccountIn, request: Request, user: CurrentUser, db: Database
):
    await confirm_password(request, user, payload.password)
    # Profile, workspace entries and import records cascade with the user row.
    await db.delete(user)
    await db.commit()
    return Response(status_code=204)
