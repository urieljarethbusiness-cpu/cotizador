from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class CategoriaBase(BaseModel):
    nombre: str = Field(..., min_length=1, description="Nombre de la categoría")
    descripcion: str | None = None
    color: str = Field("#6b7280", description="Color hex para UI")
    orden: int = Field(0, ge=0)


class CategoriaCreate(CategoriaBase):
    pass


class CategoriaUpdate(BaseModel):
    nombre: str | None = Field(None, min_length=1)
    descripcion: str | None = None
    color: str | None = None
    orden: int | None = Field(None, ge=0)
    activo: bool | None = None


class CategoriaResponse(CategoriaBase):
    id: str
    activo: bool
    createdAt: datetime
    updatedAt: datetime

    model_config = {"from_attributes": True}


class ServicioCatalogoBase(BaseModel):
    nombre: str = Field(..., min_length=1, description="Nombre del servicio")
    descripcion: str | None = None
    fase: int = Field(..., ge=0, le=3, description="Fase: 0=Auditoría, 1=Setup, 2=Publicidad, 3=Contenido/SEO")
    tipoPago: str = Field(..., pattern="^(unico|mensual)$", description="Tipo de pago")
    precioBase: float = Field(..., ge=0, description="Precio base en la moneda local")
    tiempoEntrega: str = Field("7 - 14 dias", description="Tiempo de entrega estimado")
    entregablesDefault: list[str] = Field(default_factory=list, description="Lista de entregables")
    categoriaId: str = Field(..., min_length=1, description="ID de la categoría")
    variante: str | None = None
    orden: int = Field(0, ge=0)


class ServicioCatalogoCreate(ServicioCatalogoBase):
    pass


class ServicioCatalogoUpdate(BaseModel):
    nombre: str | None = Field(None, min_length=1)
    descripcion: str | None = None
    fase: int | None = Field(None, ge=0, le=3)
    tipoPago: str | None = Field(None, pattern="^(unico|mensual)$")
    precioBase: float | None = Field(None, ge=0)
    tiempoEntrega: str | None = None
    entregablesDefault: list[str] | None = None
    categoriaId: str | None = None
    variante: str | None = None
    activo: bool | None = None
    orden: int | None = Field(None, ge=0)


class ServicioCatalogoResponse(ServicioCatalogoBase):
    id: str
    activo: bool
    createdAt: datetime
    updatedAt: datetime
    categoriaRel: CategoriaResponse | None = None

    model_config = {"from_attributes": True}


from app.models.cliente import ClienteResponse
