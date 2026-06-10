from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from asyncpg import Connection

from app.dependencies import get_db
from app.models.export_ import (
    FinanciamientoRequest,
    FinanciamientoResponse,
    BonoResponse,
    PlanBucefaloResponse,
)
from app.models.common import ErrorResponse
from app.auth import require_auth
from app.services.calculators import (
    calcular_financiamiento,
    FINANCIAMIENTO_PLANES,
    PLANES_BUCEFALO,
)

router = APIRouter(prefix="/financiamiento", tags=["Financiamiento"])


class PlanResponse(FinanciamientoResponse):
    meses: int
    tasa: float
    comision: float


@router.get("/planes", response_model=list[PlanResponse])
async def get_planes(_auth: dict = Depends(require_auth)):
    return [
        PlanResponse(
            meses=p["meses"],
            tasa=p["tasa"],
            comision=p["comision"],
            **calcular_financiamiento(1000, p["meses"], p["tasa"], p["comision"]),
        )
        for p in sorted(FINANCIAMIENTO_PLANES, key=lambda x: x["meses"])
    ]


@router.post(
    "/calcular",
    response_model=FinanciamientoResponse,
    responses={400: {"model": ErrorResponse}},
)
async def calcular(
    body: FinanciamientoRequest,
    _auth: dict = Depends(require_auth),
):
    plan = next((p for p in FINANCIAMIENTO_PLANES if p["meses"] == body.meses), None)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No financing plan available for {body.meses} months",
        )
    if body.monto < plan["montoMinimo"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Minimum amount for {body.meses} months is ${plan['montoMinimo']}",
        )

    result = calcular_financiamiento(body.monto, body.meses, plan["tasa"], plan["comision"])
    return FinanciamientoResponse(
        **result,
        meses=body.meses,
        tasa=plan["tasa"],
        comision=plan["comision"],
    )


@router.get(
    "/simulacion/{cotizacion_id}",
    response_model=list[FinanciamientoResponse],
    responses={404: {"model": ErrorResponse}},
)
async def simulacion(
    cotizacion_id: str,
    _auth: dict = Depends(require_auth),
    db: Connection = Depends(get_db),
):
    cot = await db.fetchrow(
        'SELECT id FROM "Cotizacion" WHERE id = $1', cotizacion_id
    )
    if not cot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cotización not found",
        )

    rows = await db.fetch(
        'SELECT precio FROM "ServicioCotizado" WHERE "cotizacionId" = $1 AND seleccionado = true',
        cotizacion_id,
    )
    total = sum(float(r["precio"]) for r in rows)

    plan_buc = await db.fetchrow(
        'SELECT precio FROM "PlanBucefaloCotizacion" WHERE "cotizacionId" = $1',
        cotizacion_id,
    )
    if plan_buc:
        total += float(plan_buc["precio"])

    if total <= 0:
        return []

    results = []
    for plan in FINANCIAMIENTO_PLANES:
        if total < plan["montoMinimo"]:
            continue
        result = calcular_financiamiento(total, plan["meses"], plan["tasa"], plan["comision"])
        results.append(
            FinanciamientoResponse(
                **result,
                meses=plan["meses"],
                tasa=plan["tasa"],
                comision=plan["comision"],
            )
        )

    return results
