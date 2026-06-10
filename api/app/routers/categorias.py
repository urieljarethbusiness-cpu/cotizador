from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from app.database import get_pool
from app.dependencies import get_db
from app.auth import require_auth
from app.models.catalogo import CategoriaCreate, CategoriaUpdate, CategoriaResponse
from app.models.common import ErrorResponse, OkResponse

router = APIRouter(prefix="/categorias", tags=["Categorias"])


@router.get("", response_model=list[CategoriaResponse])
async def list_categorias(
    _auth: dict = Depends(require_auth),
    conn=Depends(get_db),
):
    rows = await conn.fetch(
        'SELECT id, nombre, descripcion, color, activo, orden, "createdAt", "updatedAt"'
        ' FROM "Categoria" ORDER BY orden ASC'
    )
    return [dict(r) for r in rows]


@router.post(
    "",
    response_model=CategoriaResponse,
    status_code=status.HTTP_201_CREATED,
    responses={409: {"model": ErrorResponse}},
)
async def create_categoria(
    body: CategoriaCreate,
    _auth: dict = Depends(require_auth),
    conn=Depends(get_db),
):
    now = datetime.now(timezone.utc)
    try:
        row = await conn.fetchrow(
            'INSERT INTO "Categoria" (id, nombre, descripcion, color, orden, "createdAt", "updatedAt")'
            " VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $5)"
            ' RETURNING id, nombre, descripcion, color, activo, orden, "createdAt", "updatedAt"',
            body.nombre,
            body.descripcion,
            body.color,
            body.orden,
            now,
        )
    except Exception as e:
        if "unique" in str(e).lower() or "duplicate" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ya existe una categoría con el nombre '{body.nombre}'",
            )
        raise
    return dict(row)


@router.get(
    "/{categoria_id}",
    responses={404: {"model": ErrorResponse}},
)
async def get_categoria(
    categoria_id: str,
    _auth: dict = Depends(require_auth),
    conn=Depends(get_db),
):
    row = await conn.fetchrow(
        'SELECT c.id, c.nombre, c.descripcion, c.color, c.activo, c.orden,'
        ' c."createdAt", c."updatedAt",'
        ' COUNT(s.id)::int AS "serviciosCount"'
        ' FROM "Categoria" c'
        ' LEFT JOIN "ServicioCatalogo" s ON s."categoriaId" = c.id'
        " WHERE c.id = $1"
        " GROUP BY c.id",
        categoria_id,
    )
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoría no encontrada",
        )
    return dict(row)


@router.put(
    "/{categoria_id}",
    response_model=CategoriaResponse,
    responses={404: {"model": ErrorResponse}, 409: {"model": ErrorResponse}},
)
async def update_categoria(
    categoria_id: str,
    body: CategoriaUpdate,
    _auth: dict = Depends(require_auth),
    conn=Depends(get_db),
):
    existing = await conn.fetchrow(
        'SELECT id FROM "Categoria" WHERE id = $1', categoria_id
    )
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoría no encontrada",
        )

    updates: list[str] = []
    params: list = []
    idx = 1

    if body.nombre is not None:
        updates.append(f"nombre = ${idx}")
        params.append(body.nombre)
        idx += 1
    if body.descripcion is not None:
        updates.append(f"descripcion = ${idx}")
        params.append(body.descripcion)
        idx += 1
    if body.color is not None:
        updates.append(f"color = ${idx}")
        params.append(body.color)
        idx += 1
    if body.orden is not None:
        updates.append(f"orden = ${idx}")
        params.append(body.orden)
        idx += 1
    if body.activo is not None:
        updates.append(f"activo = ${idx}")
        params.append(body.activo)
        idx += 1

    if not updates:
        row = await conn.fetchrow(
            'SELECT id, nombre, descripcion, color, activo, orden, "createdAt", "updatedAt"'
            ' FROM "Categoria" WHERE id = $1',
            categoria_id,
        )
        return dict(row)

    updates.append(f'"updatedAt" = ${idx}')
    params.append(datetime.now(timezone.utc))
    idx += 1

    params.append(categoria_id)
    try:
        row = await conn.fetchrow(
            f'UPDATE "Categoria" SET {", ".join(updates)} WHERE id = ${idx}'
            ' RETURNING id, nombre, descripcion, color, activo, orden, "createdAt", "updatedAt"',
            *params,
        )
    except Exception as e:
        if "unique" in str(e).lower() or "duplicate" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ya existe una categoría con el nombre '{body.nombre}'",
            )
        raise
    return dict(row)


@router.delete(
    "/{categoria_id}",
    response_model=OkResponse,
    responses={404: {"model": ErrorResponse}, 409: {"model": ErrorResponse}},
)
async def delete_categoria(
    categoria_id: str,
    _auth: dict = Depends(require_auth),
    conn=Depends(get_db),
):
    existing = await conn.fetchrow(
        'SELECT id FROM "Categoria" WHERE id = $1', categoria_id
    )
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoría no encontrada",
        )

    count = await conn.fetchval(
        'SELECT COUNT(*)::int FROM "ServicioCatalogo" WHERE "categoriaId" = $1',
        categoria_id,
    )
    if count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Tiene {count} servicios asociados",
        )

    await conn.execute('DELETE FROM "Categoria" WHERE id = $1', categoria_id)
    return OkResponse(ok=True)
