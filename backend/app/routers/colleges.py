from typing import Annotated

from fastapi import APIRouter, Query

from app.core.deps import Database
from app.schemas.college import CollegeOut, CollegeQuery, CollegesResponse, FiltersOut
from app.schemas.workspace import CompareRequest, MatchQuery
from app.services import colleges

router = APIRouter(tags=["Colleges"])


@router.get("/colleges", response_model=CollegesResponse)
async def list_colleges(db: Database, query: Annotated[CollegeQuery, Query()]):
    return await colleges.list_colleges(db, query)


@router.get("/colleges/catalog", response_model=list[CollegeOut])
async def catalog(db: Database):
    return await colleges.get_catalog(db)


@router.get("/colleges/filters", response_model=FiltersOut)
async def filters(db: Database):
    return await colleges.get_filters(db)


@router.get("/colleges/{slug}", response_model=CollegeOut)
async def detail(slug: str, db: Database):
    return await colleges.get_by_slug(db, slug)


@router.post("/matches", response_model=CollegesResponse)
async def matches(payload: MatchQuery, db: Database):
    return await colleges.list_colleges(db, payload.query, payload.preferences)


@router.post("/compare")
async def compare(payload: CompareRequest, db: Database):
    return await colleges.compare_options(db, payload.options)
