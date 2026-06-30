from __future__ import annotations

from typing import Any, Generic, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class Meta(BaseModel):
    total: int = 0
    page: int = 1
    limit: int = 50
    pages: int = 0


class PaginatedResponse(BaseModel, Generic[T]):
    data: list[T]
    meta: Meta


class ErrorResponse(BaseModel):
    error: str
    detail: str | None = None
    code: str | None = None


class OkResponse(BaseModel):
    ok: bool = True


class ArchivedResponse(BaseModel):
    ok: bool = True
    archived: bool


class HealthResponse(BaseModel):
    status: str = "ok"
    timestamp: str
    database: str = "connected"


class APIInfoResponse(BaseModel):
    name: str = "Cotizador API"
    version: str = "1.0.0"
    description: str = "API para sistema de cotizaciones de marketing digital"
    capabilities: list[str] = Field(default_factory=list)


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    user: dict[str, Any]
    token: str | None = None
