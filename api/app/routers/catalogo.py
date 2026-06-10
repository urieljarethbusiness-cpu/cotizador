from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, Query, status
from asyncpg import Connection

from app.auth import require_auth
from app.dependencies import get_db
from app.models.catalogo import (
    ServicioCatalogoCreate,
    ServicioCatalogoUpdate,
    ServicioCatalogoResponse,
    CategoriaResponse,
)
from app.models.common import ArchivedResponse, ErrorResponse, OkResponse

router = APIRouter(prefix="/catalogo", tags=["Catalogo"])


def _row_to_response(row, categoria_row=None) -> ServicioCatalogoResponse:
    entregables = row["entregablesDefault"]
    if isinstance(entregables, str):
        entregables = json.loads(entregables)

    categoria = None
    if categoria_row:
        categoria = CategoriaResponse(
            id=categoria_row["id"],
            nombre=categoria_row["nombre"],
            descripcion=categoria_row["descripcion"],
            color=categoria_row["color"],
            orden=categoria_row["orden"],
            activo=categoria_row["activo"],
            createdAt=categoria_row["createdAt"],
            updatedAt=categoria_row["updatedAt"],
        )

    return ServicioCatalogoResponse(
        id=row["id"],
        nombre=row["nombre"],
        descripcion=row["descripcion"],
        fase=row["fase"],
        tipoPago=row["tipoPago"],
        precioBase=float(row["precioBase"]),
        tiempoEntrega=row["tiempoEntrega"],
        entregablesDefault=entregables,
        categoriaId=row["categoriaId"],
        variante=row["variante"],
        nivel=row["nivel"],
        activo=row["activo"],
        orden=row["orden"],
        createdAt=row["createdAt"],
        updatedAt=row["updatedAt"],
        categoriaRel=categoria,
    )


@router.get(
    "",
    response_model=list[ServicioCatalogoResponse],
    summary="List active catalog services with filters",
)
async def list_catalogo(
    db: Connection = Depends(get_db),
    auth: dict = Depends(require_auth),
    fase: int | None = Query(None, ge=0, le=3),
    tipoPago: str | None = Query(None, pattern="^(unico|mensual)$"),
    categoriaId: str | None = Query(None),
    q: str | None = Query(None, description="Search by nombre or descripcion"),
):
    where_clauses: list[str] = ['activo = true']
    params: list = []
    idx = 1

    if fase is not None:
        where_clauses.append(f"fase = ${idx}")
        params.append(fase)
        idx += 1

    if tipoPago:
        where_clauses.append(f'"tipoPago" = ${idx}')
        params.append(tipoPago)
        idx += 1

    if categoriaId:
        where_clauses.append(f'"categoriaId" = ${idx}')
        params.append(categoriaId)
        idx += 1

    if q:
        where_clauses.append(f"(nombre ILIKE ${idx} OR descripcion ILIKE ${idx})")
        params.append(f"%{q}%")
        idx += 1

    where_sql = f"WHERE {' AND '.join(where_clauses)}"

    rows = await db.fetch(
        f'SELECT * FROM "ServicioCatalogo" {where_sql} ORDER BY fase ASC, orden ASC',
        *params,
    )

    # Una sola query para todas las categorías referenciadas (evita N+1).
    cat_ids = list({r["categoriaId"] for r in rows if r["categoriaId"]})
    cat_map: dict = {}
    if cat_ids:
        cat_rows = await db.fetch(
            'SELECT * FROM "Categoria" WHERE id = ANY($1::text[])', cat_ids
        )
        cat_map = {c["id"]: c for c in cat_rows}

    return [_row_to_response(r, cat_map.get(r["categoriaId"])) for r in rows]


@router.post(
    "",
    response_model=ServicioCatalogoResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new catalog service",
)
async def create_catalogo(
    body: ServicioCatalogoCreate,
    db: Connection = Depends(get_db),
    auth: dict = Depends(require_auth),
):
    if body.categoriaId:
        cat = await db.fetchrow(
            'SELECT id FROM "Categoria" WHERE id = $1', body.categoriaId
        )
        if not cat:
            raise HTTPException(status_code=400, detail="Categoria no encontrada")

    entregables_json = json.dumps(body.entregablesDefault)

    row = await db.fetchrow(
        'INSERT INTO "ServicioCatalogo" '
        '(nombre, descripcion, fase, "tipoPago", "precioBase", "tiempoEntrega", '
        '"entregablesDefault", "categoriaId", variante, nivel, activo, orden) '
        "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, $11) RETURNING *",
        body.nombre,
        body.descripcion,
        body.fase,
        body.tipoPago,
        body.precioBase,
        body.tiempoEntrega,
        entregables_json,
        body.categoriaId,
        body.variante,
        body.nivel,
        body.orden,
    )

    cat_row = None
    if row["categoriaId"]:
        cat_row = await db.fetchrow(
            'SELECT * FROM "Categoria" WHERE id = $1', row["categoriaId"]
        )

    return _row_to_response(row, cat_row)


@router.get(
    "/{servicio_id}",
    response_model=ServicioCatalogoResponse,
    responses={404: {"model": ErrorResponse}},
    summary="Get catalog service by ID with categoria join",
)
async def get_catalogo(
    servicio_id: str,
    db: Connection = Depends(get_db),
    auth: dict = Depends(require_auth),
):
    row = await db.fetchrow(
        'SELECT * FROM "ServicioCatalogo" WHERE id = $1', servicio_id
    )
    if not row:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")

    cat_row = None
    if row["categoriaId"]:
        cat_row = await db.fetchrow(
            'SELECT * FROM "Categoria" WHERE id = $1', row["categoriaId"]
        )

    return _row_to_response(row, cat_row)


@router.put(
    "/{servicio_id}",
    response_model=ServicioCatalogoResponse,
    responses={404: {"model": ErrorResponse}},
    summary="Update a catalog service",
)
async def update_catalogo(
    servicio_id: str,
    body: ServicioCatalogoUpdate,
    db: Connection = Depends(get_db),
    auth: dict = Depends(require_auth),
):
    existing = await db.fetchrow(
        'SELECT id FROM "ServicioCatalogo" WHERE id = $1', servicio_id
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")

    if body.categoriaId:
        cat = await db.fetchrow(
            'SELECT id FROM "Categoria" WHERE id = $1', body.categoriaId
        )
        if not cat:
            raise HTTPException(status_code=400, detail="Categoria no encontrada")

    field_map = {
        "nombre": "nombre",
        "descripcion": "descripcion",
        "fase": "fase",
        "tipoPago": '"tipoPago"',
        "precioBase": '"precioBase"',
        "tiempoEntrega": '"tiempoEntrega"',
        "entregablesDefault": '"entregablesDefault"',
        "categoriaId": '"categoriaId"',
        "variante": "variante",
        "nivel": "nivel",
        "activo": "activo",
        "orden": "orden",
    }

    updates: list[str] = []
    params: list = []
    idx = 1

    for field, col in field_map.items():
        value = getattr(body, field, None)
        if value is not None:
            if field == "entregablesDefault":
                value = json.dumps(value)
            updates.append(f"{col} = ${idx}")
            params.append(value)
            idx += 1

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    params.append(servicio_id)
    row = await db.fetchrow(
        f'UPDATE "ServicioCatalogo" SET {", ".join(updates)} WHERE id = ${idx} RETURNING *',
        *params,
    )

    cat_row = None
    if row["categoriaId"]:
        cat_row = await db.fetchrow(
            'SELECT * FROM "Categoria" WHERE id = $1', row["categoriaId"]
        )

    return _row_to_response(row, cat_row)


@router.delete(
    "/{servicio_id}",
    response_model=ArchivedResponse,
    responses={404: {"model": ErrorResponse}},
    summary="Delete or soft-delete a catalog service",
)
async def delete_catalogo(
    servicio_id: str,
    db: Connection = Depends(get_db),
    auth: dict = Depends(require_auth),
):
    existing = await db.fetchrow(
        'SELECT id FROM "ServicioCatalogo" WHERE id = $1', servicio_id
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")

    ref_count = await db.fetchval(
        'SELECT COUNT(*) FROM "ServicioCotizado" WHERE "servicioCatalogoId" = $1',
        servicio_id,
    )

    if ref_count > 0:
        await db.execute(
            'UPDATE "ServicioCatalogo" SET activo = false WHERE id = $1', servicio_id
        )
        return ArchivedResponse(ok=True, archived=True)

    await db.execute('DELETE FROM "ServicioCatalogo" WHERE id = $1', servicio_id)
    return ArchivedResponse(ok=True, archived=False)
