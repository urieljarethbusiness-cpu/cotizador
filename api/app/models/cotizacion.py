from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class ServicioCotizadoInput(BaseModel):
    catalogoId: str = Field(..., min_length=1, description="ID del servicio del catálogo o 'custom-...' para partidas personalizadas")
    nombre: str = Field(..., min_length=1, description="Nombre del servicio")
    fase: int = Field(..., ge=0, le=3)
    tipoPago: str = Field(..., pattern="^(unico|mensual)$")
    precio: float = Field(..., ge=0, description="Precio (puede diferir del precioBase)")
    tiempoEntrega: str
    entregables: list[str] = Field(default_factory=list)
    # Partidas por tiempo (sin catálogo). modeloCobro: "fijo" | "horas" | "retainer".
    esPersonalizado: bool = False
    horas: float | None = Field(None, ge=0)
    tarifaHora: float | None = Field(None, ge=0)
    modeloCobro: str | None = Field(None, pattern="^(fijo|horas|retainer)$")
    montoMinimo: float | None = Field(None, ge=0)
    horasIncluidas: float | None = Field(None, ge=0)
    # Doble propuesta: "1" | "2" | "ambas". None en cotizaciones normales.
    opcion: str | None = Field(None, pattern="^(1|2|ambas)$")


class MetaOpcionInput(BaseModel):
    titulo: str | None = None
    descripcion: str | None = None
    noIncluye: str | None = None


class PlanBucefaloInput(BaseModel):
    nivel: str = Field(..., description="Nivel: basico, estandar, premium, empresarial")
    precio: float = Field(..., ge=0)


class ClienteInput(BaseModel):
    nombre: str = Field(..., min_length=1)
    empresa: str = ""
    email: str = ""
    telefono: str = ""


class CotizacionCreate(BaseModel):
    numero: str = Field(..., min_length=1, description="Número de cotización (formato UJ{YY}{MM}{init}{seq})")
    fecha: datetime
    vigencia: datetime
    moneda: str = Field("MXN", pattern="^(MXN|USD)$")
    tipoCambio: str = "NA"
    proyecto: str = "MKT Digital"
    esquemaPago: str = Field("Pago Unico/Mensual", pattern="^(Pago Unico|Mensual|Pago Unico/Mensual)$")
    incluirBonos: bool = False
    incluirFinanciamiento: bool = False
    esDoble: bool = False
    opciones: dict[str, MetaOpcionInput] | None = None
    observaciones: str = ""
    asesorId: str = Field(..., min_length=1)
    cliente: ClienteInput
    servicios: list[ServicioCotizadoInput] = Field(..., min_length=1)
    planBucefalo: PlanBucefaloInput | None = None

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "numero": "UJ2605AG001",
                    "fecha": "2026-05-03",
                    "vigencia": "2026-05-24",
                    "moneda": "MXN",
                    "tipoCambio": "NA",
                    "proyecto": "MKT Digital",
                    "esquemaPago": "Pago Unico/Mensual",
                    "incluirBonos": False,
                    "incluirFinanciamiento": False,
                    "observaciones": "",
                    "asesorId": "cuid-asesor",
                    "cliente": {
                        "nombre": "Juan Pérez",
                        "empresa": "ACME Corp",
                        "email": "juan@acme.com",
                        "telefono": "4421234567",
                    },
                    "servicios": [
                        {
                            "catalogoId": "cuid-servicio",
                            "nombre": "SEO On-Page",
                            "fase": 3,
                            "tipoPago": "mensual",
                            "precio": 2900,
                            "tiempoEntrega": "7 - 14 dias",
                            "entregables": ["Keyword research"],
                        }
                    ],
                    "planBucefalo": {"nivel": "basico", "precio": 1000},
                }
            ]
        }
    }


class CotizacionUpdate(BaseModel):
    fecha: datetime | None = None
    vigencia: datetime | None = None
    moneda: str | None = Field(None, pattern="^(MXN|USD)$")
    tipoCambio: str | None = None
    proyecto: str | None = None
    esquemaPago: str | None = Field(None, pattern="^(Pago Unico|Mensual|Pago Unico/Mensual)$")
    incluirBonos: bool | None = None
    incluirFinanciamiento: bool | None = None
    esDoble: bool | None = None
    opciones: dict[str, MetaOpcionInput] | None = None
    observaciones: str | None = None
    estado: str | None = Field(None, pattern="^(borrador|enviada|aprobada|rechazada)$")
    cliente: ClienteInput | None = None
    servicios: list[ServicioCotizadoInput] | None = None
    planBucefalo: PlanBucefaloInput | None = None


class CambiarEstadoRequest(BaseModel):
    estado: str = Field(..., pattern="^(borrador|enviada|aprobada|rechazada)$")


class ActualizarPrecioRequest(BaseModel):
    servicioId: str = Field(..., min_length=1)
    precio: float = Field(..., ge=0)


class CotizacionResponse(BaseModel):
    id: str
    numero: str
    fecha: datetime
    vigencia: datetime
    moneda: str
    tipoCambio: str
    proyecto: str
    esquemaPago: str
    estado: str
    incluirBonos: bool
    incluirFinanciamiento: bool
    esDoble: bool = False
    opcionesMetadata: dict[str, Any] | None = None
    observaciones: str | None
    clienteId: str
    asesorId: str
    createdAt: datetime
    updatedAt: datetime
    cliente: dict[str, Any] | None = None
    asesor: dict[str, Any] | None = None
    servicios: list[dict[str, Any]] | None = None
    planBucefalo: dict[str, Any] | None = None

    model_config = {"from_attributes": True}
