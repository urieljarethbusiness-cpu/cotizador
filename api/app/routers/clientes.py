from __future__ import annotations

import math

from fastapi import APIRouter, Depends, HTTPException, Query, status
from asyncpg import Connection

from app.auth import require_auth
from app.dependencies import PaginationParams, get_db
from app.models.cliente import ClienteCreate, ClienteUpdate, ClienteResponse
from app.models.common import PaginatedResponse, Meta, ErrorResponse, OkResponse

router = APIRouter(prefix="/clientes", tags=["Clientes"])


@router.get(
    "",
    response_model=PaginatedResponse[ClienteResponse],
    summary="List clients with pagination and search",
)
async def list_clientes(
    db: Connection = Depends(get_db),
    auth: dict = Depends(require_auth),
    pagination: PaginationParams = Depends(PaginationParams),
    q: str | None = Query(None, description="Search by nombre, empresa, or email"),
):
    where_clauses: list[str] = []
    params: list = []
    idx = 1

    if q:
        where_clauses.append(
            f"(nombre ILIKE ${idx} OR empresa ILIKE ${idx} OR email ILIKE ${idx})"
        )
        params.append(f"%{q}%")
        idx += 1

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    count_row = await db.fetchrow(
        f"SELECT COUNT(*) AS total FROM \"Cliente\" {where_sql}", *params
    )
    total = count_row["total"]
    pages = math.ceil(total / pagination.limit) if total > 0 else 0

    rows = await db.fetch(
        f'SELECT * FROM "Cliente" {where_sql} ORDER BY "createdAt" DESC '
        f"LIMIT ${idx} OFFSET ${idx + 1}",
        *params,
        pagination.limit,
        pagination.offset,
    )

    data = [
        ClienteResponse(
            id=r["id"],
            nombre=r["nombre"],
            empresa=r["empresa"],
            email=r["email"],
            telefono=r["telefono"],
            rfc=r["rfc"],
            createdAt=r["createdAt"],
            updatedAt=r["updatedAt"],
        )
        for r in rows
    ]

    return PaginatedResponse(
        data=data,
        meta=Meta(total=total, page=pagination.page, limit=pagination.limit, pages=pages),
    )


@router.post(
    "",
    response_model=ClienteResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new client",
)
async def create_cliente(
    body: ClienteCreate,
    db: Connection = Depends(get_db),
    auth: dict = Depends(require_auth),
):
    row = await db.fetchrow(
        'INSERT INTO "Cliente" (nombre, empresa, email, telefono, rfc) '
        "VALUES ($1, $2, $3, $4, $5) RETURNING *",
        body.nombre,
        body.empresa,
        body.email,
        body.telefono,
        body.rfc,
    )
    return ClienteResponse(
        id=row["id"],
        nombre=row["nombre"],
        empresa=row["empresa"],
        email=row["email"],
        telefono=row["telefono"],
        rfc=row["rfc"],
        createdAt=row["createdAt"],
        updatedAt=row["updatedAt"],
    )


@router.get(
    "/{cliente_id}",
    response_model=ClienteResponse,
    responses={404: {"model": ErrorResponse}},
    summary="Get client by ID with recent cotizaciones",
)
async def get_cliente(
    cliente_id: str,
    db: Connection = Depends(get_db),
    auth: dict = Depends(require_auth),
):
    row = await db.fetchrow('SELECT * FROM "Cliente" WHERE id = $1', cliente_id)
    if not row:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    cotizaciones = await db.fetch(
        'SELECT * FROM "Cotizacion" WHERE "clienteId" = $1 '
        'ORDER BY "createdAt" DESC LIMIT 10',
        cliente_id,
    )

    cliente = ClienteResponse(
        id=row["id"],
        nombre=row["nombre"],
        empresa=row["empresa"],
        email=row["email"],
        telefono=row["telefono"],
        rfc=row["rfc"],
        createdAt=row["createdAt"],
        updatedAt=row["updatedAt"],
    )

    return cliente.model_copy(
        update={"cotizaciones": [dict(c) for c in cotizaciones]}
    )


@router.put(
    "/{cliente_id}",
    response_model=ClienteResponse,
    responses={404: {"model": ErrorResponse}},
    summary="Update a client",
)
async def update_cliente(
    cliente_id: str,
    body: ClienteUpdate,
    db: Connection = Depends(get_db),
    auth: dict = Depends(require_auth),
):
    existing = await db.fetchrow('SELECT id FROM "Cliente" WHERE id = $1', cliente_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    updates: list[str] = []
    params: list = []
    idx = 1

    for field in ("nombre", "empresa", "email", "telefono", "rfc"):
        value = getattr(body, field, None)
        if value is not None:
            updates.append(f"{field} = ${idx}")
            params.append(value)
            idx += 1

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    params.append(cliente_id)
    row = await db.fetchrow(
        f'UPDATE "Cliente" SET {", ".join(updates)} WHERE id = ${idx} RETURNING *',
        *params,
    )

    return ClienteResponse(
        id=row["id"],
        nombre=row["nombre"],
        empresa=row["empresa"],
        email=row["email"],
        telefono=row["telefono"],
        rfc=row["rfc"],
        createdAt=row["createdAt"],
        updatedAt=row["updatedAt"],
    )


@router.delete(
    "/{cliente_id}",
    response_model=OkResponse,
    responses={409: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
    summary="Delete a client (fails if cotizaciones exist)",
)
async def delete_cliente(
    cliente_id: str,
    db: Connection = Depends(get_db),
    auth: dict = Depends(require_auth),
):
    existing = await db.fetchrow('SELECT id FROM "Cliente" WHERE id = $1', cliente_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    cot_count = await db.fetchval(
        'SELECT COUNT(*) FROM "Cotizacion" WHERE "clienteId" = $1', cliente_id
    )
    if cot_count > 0:
        raise HTTPException(
            status_code=409,
            detail="No se puede eliminar: el cliente tiene cotizaciones asociadas",
        )

    await db.execute('DELETE FROM "Cliente" WHERE id = $1', cliente_id)
    return OkResponse()
