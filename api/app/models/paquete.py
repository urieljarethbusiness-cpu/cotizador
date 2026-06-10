from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class FasePaqueteInput(BaseModel):
    nombre: str = Field(..., min_length=1)
    orden: int = Field(0, ge=0)


class PaqueteCreate(BaseModel):
    nombre: str = Field(..., min_length=1, description="Nombre del paquete")
    descripcion: str | None = None
    fases: list[FasePaqueteInput] = Field(default_factory=list)


class PaqueteUpdate(BaseModel):
    nombre: str | None = Field(None, min_length=1)
    descripcion: str | None = None
    activo: bool | None = None


class ManageAction(BaseModel):
    action: str = Field(..., description="Acción: addFase, updateFase, deleteFase, addServicio, removeServicio")
    faseId: str | None = None
    nombre: str | None = None
    orden: int | None = None
    servicioCatalogoId: str | None = None
    fasePaqueteId: str | None = None


class FasePaqueteResponse(BaseModel):
    id: str
    paqueteId: str
    nombre: str
    orden: int
    createdAt: datetime
    updatedAt: datetime
    servicios: list[dict] | None = None

    model_config = {"from_attributes": True}


class PaqueteResponse(BaseModel):
    id: str
    nombre: str
    descripcion: str | None
    activo: bool
    createdAt: datetime
    updatedAt: datetime
    fases: list[FasePaqueteResponse] | None = None

    model_config = {"from_attributes": True}
