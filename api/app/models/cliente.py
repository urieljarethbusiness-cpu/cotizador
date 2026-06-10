from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class ClienteBase(BaseModel):
    nombre: str = Field(..., min_length=1, description="Nombre completo del contacto")
    empresa: str | None = Field(None, description="Nombre de la empresa")
    email: str | None = Field(None, description="Email de contacto")
    telefono: str | None = Field(None, description="Teléfono de contacto")


class ClienteCreate(ClienteBase):
    pass


class ClienteUpdate(BaseModel):
    nombre: str | None = Field(None, min_length=1)
    empresa: str | None = None
    email: str | None = None
    telefono: str | None = None


class ClienteResponse(ClienteBase):
    id: str
    createdAt: datetime
    updatedAt: datetime

    model_config = {"from_attributes": True}


class ClienteWithCotizaciones(ClienteResponse):
    cotizaciones: list[dict] | None = None
