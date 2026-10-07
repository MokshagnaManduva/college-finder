from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class APIModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, from_attributes=True, extra="forbid"
    )


class PaginationMeta(APIModel):
    total: int
    page: int
    limit: int
    total_pages: int
    has_next: bool
    has_prev: bool


def pagination(total: int, page: int, limit: int) -> PaginationMeta:
    return PaginationMeta(
        total=total,
        page=page,
        limit=limit,
        total_pages=(total + limit - 1) // limit,
        has_next=page * limit < total,
        has_prev=page > 1,
    )
