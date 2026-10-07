from uuid import UUID

from pydantic import EmailStr, Field, field_validator

from app.schemas.base import APIModel


class LoginIn(APIModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)

    @field_validator("password")
    @classmethod
    def bcrypt_limit(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password must be at most 72 UTF-8 bytes")
        return value


class RegisterIn(LoginIn):
    name: str = Field(min_length=2, max_length=80)
    password: str = Field(min_length=8, max_length=72)

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Name must contain at least two characters")
        return value


class UserOut(APIModel):
    id: UUID
    name: str
    email: str


class AuthOut(APIModel):
    access_token: str = Field(alias="access_token")
    user: UserOut
