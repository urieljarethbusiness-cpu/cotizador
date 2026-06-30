from datetime import datetime, timezone

from fastapi import APIRouter

from app.database import get_pool
from app.models.common import ErrorResponse, HealthResponse, APIInfoResponse

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse)
async def health_check():
    pool = await get_pool()
    try:
        async with pool.acquire() as conn:
            await conn.execute("SELECT 1")
        db_status = "connected"
    except Exception:
        db_status = "disconnected"

    return HealthResponse(
        status="ok",
        timestamp=datetime.now(timezone.utc).isoformat(),
        database=db_status,
    )


@router.get("/api-info", response_model=APIInfoResponse)
async def api_info():
    return APIInfoResponse(
        name="Cotizador API",
        version="1.0.0",
        description="API para el sistema de cotizaciones de Uriel Jareth Consulting",
        capabilities=[
            "Gestión de cotizaciones",
            "Catálogo de servicios",
            "Planes Bucéfalo CRM",
            "Exportación PDF/Excel",
            "Autenticación JWT",
            "Financiamiento Openpay",
        ],
    )
