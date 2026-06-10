from __future__ import annotations

from pydantic import BaseModel, Field

ALLOWED_CONFIG_KEYS: set[str] = {
    "color_primario",
    "color_secundario",
    "logo_base64",
    "razon_social",
    "rfc",
    "domicilio_fiscal",
    "cuenta_nacional",
    "clabe_interbancaria",
    "cuenta_internacional",
    "cuenta_internacional_swift",
    "hora_centinela",
    "anualidad_hosting",
    "iva",
    "terminos_condiciones",
    "no_incluye",
    "notas_adicionales",
}


class ConfigUpdate(BaseModel):
    config: dict[str, str] = Field(
        ...,
        description="Key-value config pairs. Only whitelisted keys are processed.",
        json_schema_extra={
            "examples": [
                {"color_primario": "#ff0000", "razon_social": "Nueva Empresa SA de CV"}
            ]
        },
    )

    def get_allowed(self) -> dict[str, str]:
        return {k: v for k, v in self.config.items() if k in ALLOWED_CONFIG_KEYS}


class ConfigResponse(BaseModel):
    config: dict[str, str]
