from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.auth import require_auth
from app.database import get_pool
from app.dependencies import PaginationParams, parse_date
from app.models.common import Meta, OkResponse, PaginatedResponse
from app.models.cotizacion import (
    ActualizarPrecioRequest,
    CambiarEstadoRequest,
    CotizacionCreate,
    CotizacionResponse,
    CotizacionUpdate,
)
from app.services.calculators import ESTADOS_COTIZACION

router = APIRouter(prefix="/cotizaciones", tags=["Cotizaciones"])


def _cuid() -> str:
    return uuid.uuid4().hex[:25]


def _build_cotizacion_dict(cot, cliente=None, asesor=None, servicios=None, plan=None) -> dict:
    d = dict(cot)
    d["cliente"] = dict(cliente) if cliente else None
    d["asesor"] = dict(asesor) if asesor else None
    d["servicios"] = [dict(s) for s in servicios] if servicios else []
    d["planBucefalo"] = dict(plan) if plan else None
    return d


async def _fetch_cotizacion_full(conn, cot_id: str) -> dict | None:
    cot = await conn.fetchrow('SELECT * FROM "Cotizacion" WHERE id = $1', cot_id)
    if not cot:
        return None

    cliente = await conn.fetchrow('SELECT * FROM "Cliente" WHERE id = $1', cot["clienteId"])
    asesor = await conn.fetchrow('SELECT id, email, name, role FROM "User" WHERE id = $1', cot["asesorId"])
    servicios = await conn.fetch(
        """
        SELECT sc.*, sc."servicioCatalogoId" as "catalogoId",
               s.nombre, s.descripcion, s."categoriaId"
        FROM "ServicioCotizado" sc
        JOIN "ServicioCatalogo" s ON s.id = sc."servicioCatalogoId"
        WHERE sc."cotizacionId" = $1
        ORDER BY sc.fase, sc.id
        """,
        cot_id,
    )
    plan = await conn.fetchrow('SELECT * FROM "PlanBucefaloCotizacion" WHERE "cotizacionId" = $1', cot_id)

    return _build_cotizacion_dict(cot, cliente, asesor, servicios, plan)


async def _resolve_bucefalo_servicio(conn) -> str | None:
    row = await conn.fetchrow(
        """
        SELECT s.id FROM "ServicioCatalogo" s
        JOIN "Categoria" c ON c.id = s."categoriaId"
        WHERE c.nombre = 'CRM' AND s."tipoPago" = 'mensual' AND s.activo = true
        ORDER BY s.orden LIMIT 1
        """
    )
    return row["id"] if row else None


async def _find_or_create_cliente(conn, nombre: str, empresa: str, email: str, telefono: str) -> str:
    row = await conn.fetchrow(
        'SELECT id FROM "Cliente" WHERE nombre = $1 AND COALESCE(empresa, \'\') = $2',
        nombre,
        empresa or "",
    )
    if row:
        if email or telefono:
            await conn.execute(
                'UPDATE "Cliente" SET email = COALESCE($1, email), telefono = COALESCE($2, telefono), "updatedAt" = NOW() WHERE id = $3',
                email or None,
                telefono or None,
                row["id"],
            )
        return row["id"]

    new_id = _cuid()
    await conn.execute(
        'INSERT INTO "Cliente" (id, nombre, empresa, email, telefono, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, NOW(), NOW())',
        new_id,
        nombre,
        empresa or None,
        email or None,
        telefono or None,
    )
    return new_id


# ---------------------------------------------------------------------------
# 1. GET /cotizaciones — List with filters + pagination
# ---------------------------------------------------------------------------
@router.get("", response_model=PaginatedResponse[CotizacionResponse])
async def list_cotizaciones(
    pagination: PaginationParams = Depends(),
    estado: str | None = Query(None),
    asesorId: str | None = Query(None),
    clienteId: str | None = Query(None),
    q: str | None = Query(None),
    desde: str | None = Query(None),
    hasta: str | None = Query(None),
    _auth: dict = Depends(require_auth),
):
    pool = await get_pool()

    conditions: list[str] = []
    params: list = []
    idx = 1

    if estado:
        conditions.append(f'c.estado = ${idx}')
        params.append(estado)
        idx += 1
    if asesorId:
        conditions.append(f'c."asesorId" = ${idx}')
        params.append(asesorId)
        idx += 1
    if clienteId:
        conditions.append(f'c."clienteId" = ${idx}')
        params.append(clienteId)
        idx += 1
    if q:
        conditions.append(
            f'(c.numero ILIKE ${idx} OR cl.nombre ILIKE ${idx} OR c.proyecto ILIKE ${idx})'
        )
        params.append(f"%{q}%")
        idx += 1
    desde_dt = parse_date(desde)
    if desde_dt:
        conditions.append(f'c.fecha >= ${idx}')
        params.append(desde_dt)
        idx += 1
    hasta_dt = parse_date(hasta)
    if hasta_dt:
        conditions.append(f'c.fecha <= ${idx}')
        params.append(hasta_dt)
        idx += 1

    where = "WHERE " + " AND ".join(conditions) if conditions else ""

    count_row = await pool.fetchrow(
        f'SELECT COUNT(*) FROM "Cotizacion" c LEFT JOIN "Cliente" cl ON cl.id = c."clienteId" {where}',
        *params,
    )
    total = count_row["count"]

    rows = await pool.fetch(
        f"""
        SELECT c.* FROM "Cotizacion" c
        LEFT JOIN "Cliente" cl ON cl.id = c."clienteId"
        {where}
        ORDER BY c."createdAt" DESC
        LIMIT ${idx} OFFSET ${idx + 1}
        """,
        *params,
        pagination.limit,
        pagination.offset,
    )

    cotizaciones = []
    for r in rows:
        full = await _fetch_cotizacion_full(pool, r["id"])
        if full:
            cotizaciones.append(full)

    pages = (total + pagination.limit - 1) // pagination.limit if total > 0 else 0

    return PaginatedResponse(
        data=cotizaciones,
        meta=Meta(total=total, page=pagination.page, limit=pagination.limit, pages=pages),
    )


# ---------------------------------------------------------------------------
# 2. POST /cotizaciones — Create
# ---------------------------------------------------------------------------
@router.post("", response_model=CotizacionResponse, status_code=status.HTTP_201_CREATED)
async def create_cotizacion(body: CotizacionCreate, _auth: dict = Depends(require_auth)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            cliente_id = await _find_or_create_cliente(
                conn,
                body.cliente.nombre,
                body.cliente.empresa,
                body.cliente.email,
                body.cliente.telefono,
            )

            cot_id = _cuid()
            now = datetime.now(timezone.utc)
            await conn.execute(
                """
                INSERT INTO "Cotizacion"
                    (id, numero, fecha, vigencia, moneda, "tipoCambio", proyecto, "esquemaPago",
                     estado, "incluirBonos", "incluirFinanciamiento", observaciones,
                     "clienteId", "asesorId", "createdAt", "updatedAt")
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'borrador',$9,$10,$11,$12,$13,$14,$14)
                """,
                cot_id,
                body.numero,
                body.fecha,
                body.vigencia,
                body.moneda,
                body.tipoCambio,
                body.proyecto,
                body.esquemaPago,
                body.incluirBonos,
                body.incluirFinanciamiento,
                body.observaciones or None,
                cliente_id,
                body.asesorId,
                now,
            )

            bucefalo_servicio_id = await _resolve_bucefalo_servicio(conn)

            for svc in body.servicios:
                catalogo_id = svc.catalogoId
                if catalogo_id.startswith("bucefalo-") and bucefalo_servicio_id:
                    catalogo_id = bucefalo_servicio_id

                await conn.execute(
                    """
                    INSERT INTO "ServicioCotizado"
                        (id, "cotizacionId", "servicioCatalogoId", fase, "tipoPago", precio,
                         "tiempoEntrega", entregables, notas, seleccionado, "createdAt", "updatedAt")
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,$10,$10)
                    """,
                    _cuid(),
                    cot_id,
                    catalogo_id,
                    svc.fase,
                    svc.tipoPago,
                    svc.precio,
                    svc.tiempoEntrega,
                    json.dumps(svc.entregables),
                    None,
                    now,
                )

            if body.planBucefalo:
                await conn.execute(
                    """
                    INSERT INTO "PlanBucefaloCotizacion"
                        (id, "cotizacionId", nivel, precio, seleccionado, "createdAt", "updatedAt")
                    VALUES ($1,$2,$3,$4,true,$5,$5)
                    """,
                    _cuid(),
                    cot_id,
                    body.planBucefalo.nivel,
                    body.planBucefalo.precio,
                    now,
                )

    row = await pool.fetchrow('SELECT * FROM "Cotizacion" WHERE id = $1', cot_id)
    return dict(row)


# ---------------------------------------------------------------------------
# 3. GET /cotizaciones/{id} — Get with relations
# ---------------------------------------------------------------------------
@router.get("/{cotizacion_id}", response_model=CotizacionResponse)
async def get_cotizacion(cotizacion_id: str, _auth: dict = Depends(require_auth)):
    pool = await get_pool()
    full = await _fetch_cotizacion_full(pool, cotizacion_id)
    if not full:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")
    return full


# ---------------------------------------------------------------------------
# 4. PUT /cotizaciones/{id} — Update
# ---------------------------------------------------------------------------
@router.put("/{cotizacion_id}", response_model=CotizacionResponse)
async def update_cotizacion(
    cotizacion_id: str,
    body: CotizacionUpdate,
    _auth: dict = Depends(require_auth),
):
    pool = await get_pool()
    async with pool.acquire() as conn:
        existing = await conn.fetchrow('SELECT * FROM "Cotizacion" WHERE id = $1', cotizacion_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Cotización no encontrada")

        async with conn.transaction():
            cliente_id = existing["clienteId"]
            if body.cliente:
                cliente_id = await _find_or_create_cliente(
                    conn,
                    body.cliente.nombre,
                    body.cliente.empresa,
                    body.cliente.email,
                    body.cliente.telefono,
                )

            updates: list[str] = []
            params: list = []
            idx = 1

            def _add(field: str, col: str, val):
                nonlocal idx
                if val is not None:
                    updates.append(f'{col} = ${idx}')
                    params.append(val)
                    idx += 1

            _add("fecha", "fecha", body.fecha)
            _add("vigencia", "vigencia", body.vigencia)
            _add("moneda", "moneda", body.moneda)
            _add("tipoCambio", '"tipoCambio"', body.tipoCambio)
            _add("proyecto", "proyecto", body.proyecto)
            _add("esquemaPago", '"esquemaPago"', body.esquemaPago)
            _add("incluirBonos", '"incluirBonos"', body.incluirBonos)
            _add("incluirFinanciamiento", '"incluirFinanciamiento"', body.incluirFinanciamiento)
            _add("observaciones", "observaciones", body.observaciones)
            _add("estado", "estado", body.estado)

            if cliente_id != existing["clienteId"]:
                updates.append(f'"clienteId" = ${idx}')
                params.append(cliente_id)
                idx += 1

            if updates:
                updates.append(f'"updatedAt" = ${idx}')
                params.append(datetime.now(timezone.utc))
                idx += 1
                params.append(cotizacion_id)
                await conn.execute(
                    f'UPDATE "Cotizacion" SET {", ".join(updates)} WHERE id = ${idx}',
                    *params,
                )

            if body.servicios is not None:
                await conn.execute('DELETE FROM "ServicioCotizado" WHERE "cotizacionId" = $1', cotizacion_id)
                bucefalo_servicio_id = await _resolve_bucefalo_servicio(conn)
                now = datetime.now(timezone.utc)
                for svc in body.servicios:
                    catalogo_id = svc.catalogoId
                    if catalogo_id.startswith("bucefalo-") and bucefalo_servicio_id:
                        catalogo_id = bucefalo_servicio_id
                    await conn.execute(
                        """
                        INSERT INTO "ServicioCotizado"
                            (id, "cotizacionId", "servicioCatalogoId", fase, "tipoPago", precio,
                             "tiempoEntrega", entregables, notas, seleccionado, "createdAt", "updatedAt")
                        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,$10,$10)
                        """,
                        _cuid(),
                        cotizacion_id,
                        catalogo_id,
                        svc.fase,
                        svc.tipoPago,
                        svc.precio,
                        svc.tiempoEntrega,
                        json.dumps(svc.entregables),
                        None,
                        now,
                    )

            if body.planBucefalo is not None:
                existing_plan = await conn.fetchrow(
                    'SELECT id FROM "PlanBucefaloCotizacion" WHERE "cotizacionId" = $1',
                    cotizacion_id,
                )
                now = datetime.now(timezone.utc)
                if existing_plan:
                    await conn.execute(
                        'UPDATE "PlanBucefaloCotizacion" SET nivel = $1, precio = $2, "updatedAt" = $3 WHERE id = $4',
                        body.planBucefalo.nivel,
                        body.planBucefalo.precio,
                        now,
                        existing_plan["id"],
                    )
                else:
                    await conn.execute(
                        """
                        INSERT INTO "PlanBucefaloCotizacion"
                            (id, "cotizacionId", nivel, precio, seleccionado, "createdAt", "updatedAt")
                        VALUES ($1,$2,$3,$4,true,$5,$5)
                        """,
                        _cuid(),
                        cotizacion_id,
                        body.planBucefalo.nivel,
                        body.planBucefalo.precio,
                        now,
                    )
            elif body.planBucefalo is None and "planBucefalo" in body.model_fields_set:
                await conn.execute(
                    'DELETE FROM "PlanBucefaloCotizacion" WHERE "cotizacionId" = $1',
                    cotizacion_id,
                )

    full = await _fetch_cotizacion_full(pool, cotizacion_id)
    return full


# ---------------------------------------------------------------------------
# 5. DELETE /cotizaciones/{id}
# ---------------------------------------------------------------------------
@router.delete("/{cotizacion_id}", response_model=OkResponse)
async def delete_cotizacion(cotizacion_id: str, _auth: dict = Depends(require_auth)):
    pool = await get_pool()
    existing = await pool.fetchrow('SELECT id FROM "Cotizacion" WHERE id = $1', cotizacion_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")
    await pool.execute('DELETE FROM "Cotizacion" WHERE id = $1', cotizacion_id)
    return OkResponse(ok=True)


# ---------------------------------------------------------------------------
# 6. PATCH /cotizaciones/{id}/precio
# ---------------------------------------------------------------------------
@router.patch("/{cotizacion_id}/precio", response_model=OkResponse)
async def update_precio_servicio(
    cotizacion_id: str,
    body: ActualizarPrecioRequest,
    _auth: dict = Depends(require_auth),
):
    pool = await get_pool()
    cot = await pool.fetchrow('SELECT id FROM "Cotizacion" WHERE id = $1', cotizacion_id)
    if not cot:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")

    svc = await pool.fetchrow(
        'SELECT id FROM "ServicioCotizado" WHERE id = $1 AND "cotizacionId" = $2',
        body.servicioId,
        cotizacion_id,
    )
    if not svc:
        raise HTTPException(status_code=404, detail="Servicio no pertenece a esta cotización")

    await pool.execute(
        'UPDATE "ServicioCotizado" SET precio = $1, "updatedAt" = NOW() WHERE id = $2',
        body.precio,
        body.servicioId,
    )
    return OkResponse(ok=True)


# ---------------------------------------------------------------------------
# 7. PATCH /cotizaciones/{id}/estado
# ---------------------------------------------------------------------------
@router.patch("/{cotizacion_id}/estado", response_model=OkResponse)
async def cambiar_estado(
    cotizacion_id: str,
    body: CambiarEstadoRequest,
    _auth: dict = Depends(require_auth),
):
    if body.estado not in ESTADOS_COTIZACION:
        raise HTTPException(
            status_code=422,
            detail=f"Estado inválido. Permitidos: {', '.join(ESTADOS_COTIZACION)}",
        )

    pool = await get_pool()
    result = await pool.execute(
        'UPDATE "Cotizacion" SET estado = $1, "updatedAt" = NOW() WHERE id = $2',
        body.estado,
        cotizacion_id,
    )
    if result == "UPDATE 0":
        raise HTTPException(status_code=404, detail="Cotización no encontrada")
    return OkResponse(ok=True)


# ---------------------------------------------------------------------------
# 8. POST /cotizaciones/{id}/duplicate
# ---------------------------------------------------------------------------
@router.post("/{cotizacion_id}/duplicate", response_model=CotizacionResponse, status_code=status.HTTP_201_CREATED)
async def duplicate_cotizacion(cotizacion_id: str, _auth: dict = Depends(require_auth)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        original = await conn.fetchrow('SELECT * FROM "Cotizacion" WHERE id = $1', cotizacion_id)
        if not original:
            raise HTTPException(status_code=404, detail="Cotización no encontrada")

        servicios = await conn.fetch(
            'SELECT * FROM "ServicioCotizado" WHERE "cotizacionId" = $1',
            cotizacion_id,
        )
        plan = await conn.fetchrow(
            'SELECT * FROM "PlanBucefaloCotizacion" WHERE "cotizacionId" = $1',
            cotizacion_id,
        )

        async with conn.transaction():
            now = datetime.now(timezone.utc)
            new_id = _cuid()
            new_numero = original["numero"] + "-COPY"

            await conn.execute(
                """
                INSERT INTO "Cotizacion"
                    (id, numero, fecha, vigencia, moneda, "tipoCambio", proyecto, "esquemaPago",
                     estado, "incluirBonos", "incluirFinanciamiento", observaciones,
                     "clienteId", "asesorId", "createdAt", "updatedAt")
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'borrador',$9,$10,$11,$12,$13,$14,$14)
                """,
                new_id,
                new_numero,
                original["fecha"],
                original["vigencia"],
                original["moneda"],
                original["tipoCambio"],
                original["proyecto"],
                original["esquemaPago"],
                original["incluirBonos"],
                original["incluirFinanciamiento"],
                original["observaciones"],
                original["clienteId"],
                original["asesorId"],
                now,
            )

            for svc in servicios:
                await conn.execute(
                    """
                    INSERT INTO "ServicioCotizado"
                        (id, "cotizacionId", "servicioCatalogoId", fase, "tipoPago", precio,
                         "tiempoEntrega", entregables, notas, seleccionado, "createdAt", "updatedAt")
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)
                    """,
                    _cuid(),
                    new_id,
                    svc["servicioCatalogoId"],
                    svc["fase"],
                    svc["tipoPago"],
                    svc["precio"],
                    svc["tiempoEntrega"],
                    svc["entregables"],
                    svc["notas"],
                    svc["seleccionado"],
                    now,
                )

            if plan:
                await conn.execute(
                    """
                    INSERT INTO "PlanBucefaloCotizacion"
                        (id, "cotizacionId", nivel, precio, seleccionado, "createdAt", "updatedAt")
                    VALUES ($1,$2,$3,$4,$5,$6,$6)
                    """,
                    _cuid(),
                    new_id,
                    plan["nivel"],
                    plan["precio"],
                    plan["seleccionado"],
                    now,
                )

    full = await _fetch_cotizacion_full(pool, new_id)
    return full
