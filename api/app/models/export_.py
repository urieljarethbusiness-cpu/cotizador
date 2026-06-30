from __future__ import annotations

from pydantic import BaseModel, Field


class ServicioDraft(BaseModel):
    nombre: str
    fase: int
    tipoPago: str
    precio: float
    tiempoEntrega: str
    entregables: list[str] = Field(default_factory=list)
    beneficios: list[str] = Field(default_factory=list)
    esPersonalizado: bool = False
    horas: float | None = None
    tarifaHora: float | None = None
    modeloCobro: str | None = None
    montoMinimo: float | None = None
    horasIncluidas: float | None = None
    # Doble propuesta: "1" | "2" | "ambas".
    opcion: str | None = None


class MetaOpcionDraft(BaseModel):
    titulo: str | None = None
    descripcion: str | None = None
    noIncluye: str | None = None


class ExportDraft(BaseModel):
    clienteNombre: str = ""
    clienteEmpresa: str = ""
    clienteRfc: str = ""
    asesorNombre: str = ""
    fecha: str = ""
    moneda: str = "MXN"
    tipoCambio: str = "NA"
    proyecto: str = "MKT Digital"
    esquemaPago: str = "Pago Unico/Mensual"
    incluirBonos: bool = False
    incluirIva: bool = True
    servicios: list[ServicioDraft] = Field(default_factory=list)
    planBucefaloNivel: str | None = None
    observaciones: str = ""
    esDoble: bool = False
    opciones: dict[str, MetaOpcionDraft] | None = None


class FinanciamientoRequest(BaseModel):
    monto: float = Field(..., ge=0, description="Monto total a financiar en MXN")
    meses: int = Field(..., ge=3, le=12, description="Plazo en meses: 3, 6, 9, o 12")


class FinanciamientoResponse(BaseModel):
    pagoMensual: float
    ivaMensual: float
    totalMensual: float
    comisionTotal: float
    granTotal: float
    meses: int
    tasa: float
    comision: float


class BonoResponse(BaseModel):
    id: str
    numero: int
    titulo: str
    descripcion: str
    activo: bool


class PlanBucefaloResponse(BaseModel):
    nivel: str
    label: str
    precio: float
