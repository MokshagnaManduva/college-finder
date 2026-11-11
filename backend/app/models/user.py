from sqlalchemy import Index, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, Timestamps, UUIDPrimaryKey


class User(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(unique=True)
    name: Mapped[str]
    password_hash: Mapped[str]
    # Incremented when credentials change so previously issued tokens stop working.
    token_version: Mapped[int] = mapped_column(default=0, server_default="0")

    __table_args__ = (Index("uq_users_email_lower", func.lower(email), unique=True),)
