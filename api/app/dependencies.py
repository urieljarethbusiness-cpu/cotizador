from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Query

from app.database import get_pool


async def get_db():
    pool = await get_pool()
    async with pool.acquire() as conn:
        yield conn


class PaginationParams:
    def __init__(
        self,
        page: Annotated[int, Query(ge=1)] = 1,
        limit: Annotated[int, Query(ge=1, le=200)] = 50,
    ):
        self.page = page
        self.limit = limit
        self.offset = (page - 1) * limit


def parse_date(date_str: str | None):
    if not date_str:
        return None
    from datetime import datetime
    try:
        return datetime.fromisoformat(date_str.replace("Z", "+00:00"))
    except ValueError:
        try:
            return datetime.strptime(date_str, "%Y-%m-%d")
        except ValueError:
            return None
