from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from asyncpg import Connection

from app.dependencies import get_db
from app.models.configuracion import ConfigUpdate, ConfigResponse, ALLOWED_CONFIG_KEYS
from app.models.common import ErrorResponse, OkResponse
from app.auth import require_auth

router = APIRouter(prefix="/configuracion", tags=["Configuración"])


@router.get("", response_model=ConfigResponse)
async def get_configuracion(
    _auth: dict = Depends(require_auth),
    db: Connection = Depends(get_db),
):
    rows = await db.fetch("SELECT clave, valor FROM Configuracion")
    config = {row["clave"]: row["valor"] for row in rows}
    return ConfigResponse(config=config)


@router.put("", response_model=OkResponse, responses={400: {"model": ErrorResponse}})
async def update_configuracion(
    body: ConfigUpdate,
    _auth: dict = Depends(require_auth),
    db: Connection = Depends(get_db),
):
    allowed = body.get_allowed()
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid config keys provided",
        )

    async with db.transaction():
        for clave, valor in allowed.items():
            await db.execute(
                """
                INSERT INTO "Configuracion" (id, clave, valor, "updatedAt")
                VALUES (gen_random_uuid(), $1, $2, now())
                ON CONFLICT (clave) DO UPDATE SET valor = $2, "updatedAt" = now()
                """,
                clave,
                valor,
            )

    return OkResponse()
