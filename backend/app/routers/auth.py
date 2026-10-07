from typing import Annotated

from anyio import to_thread
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.core.deps import Database, get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.models import User
from app.schemas.auth import AuthOut, LoginIn, RegisterIn, UserOut

router = APIRouter(prefix="/auth", tags=["Auth"])
CurrentUser = Annotated[User, Depends(get_current_user)]
DUMMY_HASH = hash_password("dummy-password-for-timing")


def response(user: User) -> AuthOut:
    return AuthOut(
        access_token=create_access_token(user.id, user.email, user.name),
        user=UserOut.model_validate(user),
    )


@router.post("/register", response_model=AuthOut, status_code=201)
async def register(payload: RegisterIn, db: Database):
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
async def login(payload: LoginIn, db: Database):
    user = await db.scalar(select(User).where(func.lower(User.email) == str(payload.email).lower()))
    valid = await to_thread.run_sync(
        verify_password,
        payload.password,
        user.password_hash if user else DUMMY_HASH,
    )
    if not user or not valid:
        raise HTTPException(401, "Email or password is incorrect")
    return response(user)


@router.get("/me", response_model=UserOut)
async def me(user: CurrentUser):
    return user
