from __future__ import annotations

from fastapi import APIRouter, Depends

from app.auth import require_auth
from app.models.export_ import BonoResponse
from app.services.calculators import BONOS

router = APIRouter(prefix="/bonos", tags=["Bonos"])


@router.get("", response_model=list[BonoResponse])
async def get_bonos(_auth: dict = Depends(require_auth)):
    return [BonoResponse(**b) for b in BONOS]
