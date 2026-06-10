from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from app.database import get_pool
from app.dependencies import get_db
from app.auth import require_auth
from app.models.paquete import (
    PaqueteCreate,
    PaqueteUpdate,
    PaqueteResponse,
    FasePaqueteResponse,
    ManageAction,
)
from app.models.common import ErrorResponse, OkResponse

router = APIRouter(prefix="/paquetes", tags=["Paquetes"])


async def _build_paquetes_responses(conn, paquete_rows: list[dict]) -> list[dict]:
    """Build PaqueteResponse dicts for several paquetes with 2 queries in total
    (instead of 1 + N fases per paquete)."""
    if not paquete_rows:
        return []

    paquete_ids = [p["id"] for p in paquete_rows]
    fases_rows = await conn.fetch(
        'SELECT id, "paqueteId", nombre, orden, "createdAt", "updatedAt"'
        ' FROM "FasePaquete" WHERE "paqueteId" = ANY($1::text[]) ORDER BY orden ASC',
        paquete_ids,
    )

    fase_ids = [f["id"] for f in fases_rows]
    servicios_rows = []
    if fase_ids:
        servicios_rows = await conn.fetch(
            'SELECT sp.id, sp."servicioCatalogoId", sp."fasePaqueteId",'
            ' sp."createdAt", sp."updatedAt",'
            ' sc.id AS "sc_id", sc.nombre AS "sc_nombre", sc.descripcion AS "sc_descripcion",'
            ' sc.fase AS "sc_fase", sc."tipoPago" AS "sc_tipoPago",'
            ' sc."precioBase" AS "sc_precioBase", sc."tiempoEntrega" AS "sc_tiempoEntrega",'
            ' sc."entregablesDefault" AS "sc_entregablesDefault",'
            ' sc."categoriaId" AS "sc_categoriaId", sc.variante AS "sc_variante",'
            ' sc.activo AS "sc_activo", sc.orden AS "sc_orden",'
            ' sc."createdAt" AS "sc_createdAt", sc."updatedAt" AS "sc_updatedAt",'
            ' cat.id AS "cat_id", cat.nombre AS "cat_nombre", cat.descripcion AS "cat_descripcion",'
            ' cat.color AS "cat_color", cat.activo AS "cat_activo", cat.orden AS "cat_orden",'
            ' cat."createdAt" AS "cat_createdAt", cat."updatedAt" AS "cat_updatedAt"'
            ' FROM "ServicioPaquete" sp'
            ' JOIN "ServicioCatalogo" sc ON sc.id = sp."servicioCatalogoId"'
            ' LEFT JOIN "Categoria" cat ON cat.id = sc."categoriaId"'
            ' WHERE sp."fasePaqueteId" = ANY($1::text[])',
            fase_ids,
        )

    servicios_por_fase: dict[str, list[dict]] = {}
    for s in servicios_rows:
        cat = None
        if s["cat_id"]:
            cat = {
                "id": s["cat_id"],
                "nombre": s["cat_nombre"],
                "descripcion": s["cat_descripcion"],
                "color": s["cat_color"],
                "activo": s["cat_activo"],
                "orden": s["cat_orden"],
                "createdAt": s["cat_createdAt"],
                "updatedAt": s["cat_updatedAt"],
            }
        servicios_por_fase.setdefault(s["fasePaqueteId"], []).append({
            "id": s["id"],
            "servicioCatalogoId": s["servicioCatalogoId"],
            "fasePaqueteId": s["fasePaqueteId"],
            "createdAt": s["createdAt"],
            "updatedAt": s["updatedAt"],
            "servicio": {
                "id": s["sc_id"],
                "nombre": s["sc_nombre"],
                "descripcion": s["sc_descripcion"],
                "fase": s["sc_fase"],
                "tipoPago": s["sc_tipoPago"],
                "precioBase": s["sc_precioBase"],
                "tiempoEntrega": s["sc_tiempoEntrega"],
                "entregablesDefault": s["sc_entregablesDefault"],
                "categoriaId": s["sc_categoriaId"],
                "variante": s["sc_variante"],
                "activo": s["sc_activo"],
                "orden": s["sc_orden"],
                "createdAt": s["sc_createdAt"],
                "updatedAt": s["sc_updatedAt"],
                "categoriaRel": cat,
            },
        })

    fases_por_paquete: dict[str, list[dict]] = {}
    for fase in fases_rows:
        fases_por_paquete.setdefault(fase["paqueteId"], []).append({
            "id": fase["id"],
            "paqueteId": fase["paqueteId"],
            "nombre": fase["nombre"],
            "orden": fase["orden"],
            "createdAt": fase["createdAt"],
            "updatedAt": fase["updatedAt"],
            "servicios": servicios_por_fase.get(fase["id"], []),
        })

    return [
        {
            "id": p["id"],
            "nombre": p["nombre"],
            "descripcion": p["descripcion"],
            "activo": p["activo"],
            "createdAt": p["createdAt"],
            "updatedAt": p["updatedAt"],
            "fases": fases_por_paquete.get(p["id"], []),
        }
        for p in paquete_rows
    ]


async def _build_paquete_response(conn, paquete_row: dict) -> dict:
    """Build a PaqueteResponse dict with nested fases and servicios."""
    results = await _build_paquetes_responses(conn, [paquete_row])
    return results[0]


@router.get("", response_model=list[PaqueteResponse])
async def list_paquetes(
    _auth: dict = Depends(require_auth),
    conn=Depends(get_db),
):
    rows = await conn.fetch(
        'SELECT id, nombre, descripcion, activo, "createdAt", "updatedAt"'
        ' FROM "Paquete" WHERE activo = true ORDER BY "createdAt" ASC'
    )
    return await _build_paquetes_responses(conn, [dict(row) for row in rows])


@router.post(
    "",
    response_model=PaqueteResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_paquete(
    body: PaqueteCreate,
    _auth: dict = Depends(require_auth),
    conn=Depends(get_db),
):
    now = datetime.now(timezone.utc)
    paquete_row = await conn.fetchrow(
        'INSERT INTO "Paquete" (id, nombre, descripcion, "createdAt", "updatedAt")'
        " VALUES (gen_random_uuid(), $1, $2, $3, $3)"
        ' RETURNING id, nombre, descripcion, activo, "createdAt", "updatedAt"',
        body.nombre,
        body.descripcion,
        now,
    )

    paquete_id = paquete_row["id"]
    for fase in body.fases:
        await conn.execute(
            'INSERT INTO "FasePaquete" (id, "paqueteId", nombre, orden, "createdAt", "updatedAt")'
            " VALUES (gen_random_uuid(), $1, $2, $3, $4, $4)",
            paquete_id,
            fase.nombre,
            fase.orden,
            now,
        )

    return await _build_paquete_response(conn, dict(paquete_row))


@router.get(
    "/{paquete_id}",
    response_model=PaqueteResponse,
    responses={404: {"model": ErrorResponse}},
)
async def get_paquete(
    paquete_id: str,
    _auth: dict = Depends(require_auth),
    conn=Depends(get_db),
):
    row = await conn.fetchrow(
        'SELECT id, nombre, descripcion, activo, "createdAt", "updatedAt"'
        ' FROM "Paquete" WHERE id = $1',
        paquete_id,
    )
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Paquete no encontrado",
        )
    return await _build_paquete_response(conn, dict(row))


@router.put(
    "/{paquete_id}",
    response_model=PaqueteResponse,
    responses={404: {"model": ErrorResponse}},
)
async def update_paquete(
    paquete_id: str,
    body: PaqueteUpdate,
    _auth: dict = Depends(require_auth),
    conn=Depends(get_db),
):
    existing = await conn.fetchrow(
        'SELECT id FROM "Paquete" WHERE id = $1', paquete_id
    )
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Paquete no encontrado",
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
    if body.activo is not None:
        updates.append(f"activo = ${idx}")
        params.append(body.activo)
        idx += 1

    if not updates:
        row = await conn.fetchrow(
            'SELECT id, nombre, descripcion, activo, "createdAt", "updatedAt"'
            ' FROM "Paquete" WHERE id = $1',
            paquete_id,
        )
        return await _build_paquete_response(conn, dict(row))

    updates.append(f'"updatedAt" = ${idx}')
    params.append(datetime.now(timezone.utc))
    idx += 1

    params.append(paquete_id)
    row = await conn.fetchrow(
        f'UPDATE "Paquete" SET {", ".join(updates)} WHERE id = ${idx}'
        ' RETURNING id, nombre, descripcion, activo, "createdAt", "updatedAt"',
        *params,
    )
    return await _build_paquete_response(conn, dict(row))


@router.delete(
    "/{paquete_id}",
    response_model=OkResponse,
    responses={404: {"model": ErrorResponse}},
)
async def delete_paquete(
    paquete_id: str,
    _auth: dict = Depends(require_auth),
    conn=Depends(get_db),
):
    result = await conn.execute(
        'DELETE FROM "Paquete" WHERE id = $1', paquete_id
    )
    if result == "DELETE 0":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Paquete no encontrado",
        )
    return OkResponse(ok=True)


@router.post(
    "/{paquete_id}/manage",
    responses={400: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
)
async def manage_paquete(
    paquete_id: str,
    body: ManageAction,
    _auth: dict = Depends(require_auth),
    conn=Depends(get_db),
):
    paquete = await conn.fetchrow(
        'SELECT id FROM "Paquete" WHERE id = $1', paquete_id
    )
    if not paquete:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Paquete no encontrado",
        )

    now = datetime.now(timezone.utc)
    action = body.action

    if action == "addFase":
        if not body.nombre:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El campo 'nombre' es requerido para addFase",
            )
        row = await conn.fetchrow(
            'INSERT INTO "FasePaquete" (id, "paqueteId", nombre, orden, "createdAt", "updatedAt")'
            " VALUES (gen_random_uuid(), $1, $2, $3, $4, $4)"
            ' RETURNING id, "paqueteId", nombre, orden, "createdAt", "updatedAt"',
            paquete_id,
            body.nombre,
            body.orden or 0,
            now,
        )
        return dict(row), status.HTTP_201_CREATED

    if action == "updateFase":
        if not body.faseId:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El campo 'faseId' es requerido para updateFase",
            )
        updates: list[str] = []
        params: list = []
        idx = 1
        if body.nombre is not None:
            updates.append(f"nombre = ${idx}")
            params.append(body.nombre)
            idx += 1
        if body.orden is not None:
            updates.append(f"orden = ${idx}")
            params.append(body.orden)
            idx += 1
        if not updates:
            row = await conn.fetchrow(
                'SELECT id, "paqueteId", nombre, orden, "createdAt", "updatedAt"'
                ' FROM "FasePaquete" WHERE id = $1 AND "paqueteId" = $2',
                body.faseId,
                paquete_id,
            )
            if not row:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Fase no encontrada",
                )
            return dict(row)
        updates.append(f'"updatedAt" = ${idx}')
        params.append(now)
        idx += 1
        params.extend([body.faseId, paquete_id])
        row = await conn.fetchrow(
            f'UPDATE "FasePaquete" SET {", ".join(updates)}'
            f" WHERE id = ${idx} AND \"paqueteId\" = ${idx + 1}"
            ' RETURNING id, "paqueteId", nombre, orden, "createdAt", "updatedAt"',
            *params,
        )
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Fase no encontrada",
            )
        return dict(row)

    if action == "deleteFase":
        if not body.faseId:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El campo 'faseId' es requerido para deleteFase",
            )
        result = await conn.execute(
            'DELETE FROM "FasePaquete" WHERE id = $1 AND "paqueteId" = $2',
            body.faseId,
            paquete_id,
        )
        if result == "DELETE 0":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Fase no encontrada",
            )
        return {"ok": True}

    if action == "addServicio":
        if not body.servicioCatalogoId or not body.fasePaqueteId:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Los campos 'servicioCatalogoId' y 'fasePaqueteId' son requeridos para addServicio",
            )
        fase = await conn.fetchrow(
            'SELECT id FROM "FasePaquete" WHERE id = $1 AND "paqueteId" = $2',
            body.fasePaqueteId,
            paquete_id,
        )
        if not fase:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Fase no encontrada en este paquete",
            )
        try:
            row = await conn.fetchrow(
                'INSERT INTO "ServicioPaquete" (id, "servicioCatalogoId", "fasePaqueteId", "createdAt", "updatedAt")'
                " VALUES (gen_random_uuid(), $1, $2, $3, $3)"
                ' RETURNING id, "servicioCatalogoId", "fasePaqueteId", "createdAt", "updatedAt"',
                body.servicioCatalogoId,
                body.fasePaqueteId,
                now,
            )
        except Exception as e:
            if "unique" in str(e).lower() or "duplicate" in str(e).lower():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Este servicio ya está asignado a esta fase",
                )
            raise
        return dict(row), status.HTTP_201_CREATED

    if action == "removeServicio":
        if not body.servicioCatalogoId or not body.fasePaqueteId:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Los campos 'servicioCatalogoId' y 'fasePaqueteId' son requeridos para removeServicio",
            )
        result = await conn.execute(
            'DELETE FROM "ServicioPaquete"'
            ' WHERE "servicioCatalogoId" = $1 AND "fasePaqueteId" = $2',
            body.servicioCatalogoId,
            body.fasePaqueteId,
        )
        if result == "DELETE 0":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Servicio no encontrado en esta fase",
            )
        return {"ok": True}

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Acción desconocida: '{action}'. Acciones válidas: addFase, updateFase, deleteFase, addServicio, removeServicio",
    )
