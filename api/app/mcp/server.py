"""MCP Server for the Cotizador API.

Provides MCP tools and resources for AI agents (OpenClaw, Claude, ChatGPT, etc.)
to interact with the quotation system.
"""

from __future__ import annotations

import json
from datetime import datetime

from mcp.server import Server
from mcp.types import Resource, TextContent, Tool

from app.database import get_pool
from app.mcp.tools import RESOURCES, TOOLS
from app.services.calculators import (
    BONOS,
    PLANES_BUCEFALO,
    calcular_financiamiento,
    bucefalo_precio,
)

server = Server("cotizador-e3")


@server.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name=t["name"],
            description=t["description"],
            inputSchema=t["inputSchema"],
        )
        for t in TOOLS
    ]


@server.list_resources()
async def list_resources() -> list[Resource]:
    return [
        Resource(
            uri=r["uri"],
            name=r["name"],
            description=r["description"],
            mimeType=r["mimeType"],
        )
        for r in RESOURCES
    ]


@server.read_resource()
async def read_resource(uri: str) -> str:
    pool = await get_pool()
    async with pool.acquire() as conn:
        if uri == "cotizador://servicios":
            rows = await conn.fetch(
                """SELECT s.id, s.nombre, s.descripcion, s.fase, s."tipoPago",
                          s."precioBase", s."tiempoEntrega", s."entregablesDefault",
                          s.variante, s.activo, s.orden,
                          c.nombre as categoria_nombre
                   FROM "ServicioCatalogo" s
                   LEFT JOIN "Categoria" c ON s."categoriaId" = c.id
                   WHERE s.activo = true
                   ORDER BY s.fase ASC, s.orden ASC"""
            )
            return json.dumps([dict(r) for r in rows], default=str)

        elif uri == "cotizador://categorias":
            rows = await conn.fetch(
                'SELECT id, nombre, descripcion, color, activo, orden FROM "Categoria" ORDER BY orden ASC'
            )
            return json.dumps([dict(r) for r in rows], default=str)

        elif uri == "cotizador://configuracion":
            rows = await conn.fetch('SELECT clave, valor FROM "Configuracion"')
            return json.dumps({r["clave"]: r["valor"] for r in rows})

        return json.dumps({"error": f"Unknown resource: {uri}"})


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        result = await _handle_tool(conn, name, arguments)
        return [TextContent(type="text", text=json.dumps(result, default=str, ensure_ascii=False))]


async def _handle_tool(conn, name: str, arguments: dict) -> dict:
    if name == "buscar_servicios":
        return await _buscar_servicios(conn, arguments)
    elif name == "crear_cotizacion":
        return await _crear_cotizacion(conn, arguments)
    elif name == "obtener_cotizacion":
        return await _obtener_cotizacion(conn, arguments)
    elif name == "listar_cotizaciones":
        return await _listar_cotizaciones(conn, arguments)
    elif name == "cambiar_estado_cotizacion":
        return await _cambiar_estado(conn, arguments)
    elif name == "actualizar_precio_servicio":
        return await _actualizar_precio(conn, arguments)
    elif name == "duplicar_cotizacion":
        return await _duplicar_cotizacion(conn, arguments)
    elif name == "calcular_financiamiento":
        return await _calcular_financiamiento(arguments)
    elif name == "generar_pdf_cotizacion":
        return await _generar_pdf(conn, arguments)
    elif name == "obtener_configuracion":
        return await _obtener_configuracion(conn)
    elif name == "listar_bonos":
        return {"bonos": BONOS}
    elif name == "listar_planes_bucefalo":
        return {"planes": PLANES_BUCEFALO}
    else:
        return {"error": f"Unknown tool: {name}"}


async def _buscar_servicios(conn, args: dict) -> dict:
    conditions = ['s.activo = true']
    params = []
    idx = 1

    if args.get("fase") is not None:
        conditions.append(f's.fase = ${idx}')
        params.append(args["fase"])
        idx += 1
    if args.get("tipo_pago"):
        conditions.append(f's."tipoPago" = ${idx}')
        params.append(args["tipo_pago"])
        idx += 1
    if args.get("categoria"):
        conditions.append(f'LOWER(c.nombre) = LOWER(${idx})')
        params.append(args["categoria"])
        idx += 1
    if args.get("busqueda"):
        conditions.append(f'(LOWER(s.nombre) LIKE LOWER(${idx}) OR LOWER(s.descripcion) LIKE LOWER(${idx}))')
        params.append(f"%{args['busqueda']}%")
        idx += 1

    where = " AND ".join(conditions)
    query = f"""SELECT s.id, s.nombre, s.descripcion, s.fase, s."tipoPago",
                       s."precioBase", s."tiempoEntrega", s."entregablesDefault",
                       s.variante, c.nombre as categoria
                FROM "ServicioCatalogo" s
                LEFT JOIN "Categoria" c ON s."categoriaId" = c.id
                WHERE {where}
                ORDER BY s.fase ASC, s.orden ASC"""

    rows = await conn.fetch(query, *params)
    servicios = []
    for r in rows:
        d = dict(r)
        if d.get("entregablesDefault") and isinstance(d["entregablesDefault"], str):
            try:
                d["entregablesDefault"] = json.loads(d["entregablesDefault"])
            except (json.JSONDecodeError, TypeError):
                pass
        servicios.append(d)

    return {"servicios": servicios, "total": len(servicios)}


async def _crear_cotizacion(conn, args: dict) -> dict:
    cliente_data = args["cliente"]
    servicios_data = args["servicios"]
    plan_bucefalo = args.get("plan_bucefalo")
    moneda = args.get("moneda", "MXN")
    proyecto = args.get("proyecto", "MKT Digital")
    esquema = args.get("esquema_pago", "Pago Unico/Mensual")
    es_doble = bool(args.get("es_doble", False))
    opciones_metadata = args.get("opciones_metadata") if es_doble else None

    cliente = await conn.fetchrow(
        'SELECT id FROM "Cliente" WHERE nombre = $1 AND empresa = $2',
        cliente_data["nombre"],
        cliente_data.get("empresa", ""),
    )
    if not cliente:
        cliente = await conn.fetchrow(
            'INSERT INTO "Cliente" (id, nombre, empresa, email, telefono, rfc, "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW(), NOW()) RETURNING id',
            cliente_data["nombre"],
            cliente_data.get("empresa", ""),
            cliente_data.get("email", ""),
            cliente_data.get("telefono", ""),
            cliente_data.get("rfc", "") or None,
        )

    cliente_id = cliente["id"]

    now = datetime.now()
    numero = f"UJ{str(now.year)[-2:]}{now.month:02d}AGENT001"

    from app.services.calculators import calcular_vigencia
    vigencia = calcular_vigencia(now)

    async with conn.transaction():
        cot = await conn.fetchrow(
            """INSERT INTO "Cotizacion" (id, numero, fecha, vigencia, moneda, "tipoCambio", proyecto, "esquemaPago",
               estado, "incluirBonos", "incluirFinanciamiento", "esDoble", "opcionesMetadata", observaciones, "clienteId", "asesorId", "createdAt", "updatedAt")
               VALUES (gen_random_uuid(), $1, $2, $3, $4, 'NA', $5, $6, 'borrador', false, false, $7, $8, '', $9, $10, NOW(), NOW())
               RETURNING id, numero""",
            numero, now, vigencia, moneda, proyecto, esquema,
            es_doble,
            json.dumps(opciones_metadata) if opciones_metadata else None,
            cliente_id, "agent",
        )
        cot_id = cot["id"]

        for srv in servicios_data:
            catalogo_id = srv["servicio_id"]
            cat_row = await conn.fetchrow(
                'SELECT id, "precioBase", "tiempoEntrega", "entregablesDefault", fase, "tipoPago" FROM "ServicioCatalogo" WHERE id = $1',
                catalogo_id,
            )
            if not cat_row:
                continue

            precio = srv.get("precio_personalizado") or cat_row["precioBase"]
            entregables = cat_row["entregablesDefault"]
            if isinstance(entregables, str):
                try:
                    entregables = json.loads(entregables)
                except (json.JSONDecodeError, TypeError):
                    entregables = []

            opcion = (srv.get("opcion") or "ambas") if es_doble else None

            await conn.fetchrow(
                """INSERT INTO "ServicioCotizado" (id, "cotizacionId", "servicioCatalogoId", fase, "tipoPago",
                   precio, "tiempoEntrega", entregables, opcion, seleccionado, "createdAt", "updatedAt")
                   VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, true, NOW(), NOW())""",
                cot_id, catalogo_id, cat_row["fase"], cat_row["tipoPago"],
                precio, cat_row["tiempoEntrega"], json.dumps(entregables or []), opcion,
            )

        if plan_bucefalo:
            nivel = plan_bucefalo if isinstance(plan_bucefalo, str) else plan_bucefalo.get("nivel", "basico")
            precio_bp = bucefalo_precio(nivel)
            await conn.fetchrow(
                """INSERT INTO "PlanBucefaloCotizacion" (id, "cotizacionId", nivel, precio, seleccionado, "createdAt", "updatedAt")
                   VALUES (gen_random_uuid(), $1, $2, $3, true, NOW(), NOW())""",
                cot_id, nivel, precio_bp,
            )

    return {"cotizacion_id": str(cot_id), "numero": numero, "estado": "borrador", "cliente_id": str(cliente_id)}


async def _obtener_cotizacion(conn, args: dict) -> dict:
    cot = await conn.fetchrow(
        """SELECT c.*, cl.nombre as cliente_nombre, cl.empresa as cliente_empresa,
                  cl.email as cliente_email, cl.telefono as cliente_telefono,
                  cl.rfc as cliente_rfc
           FROM "Cotizacion" c
           LEFT JOIN "Cliente" cl ON c."clienteId" = cl.id
           WHERE c.id = $1""",
        args["cotizacion_id"],
    )
    if not cot:
        return {"error": "Cotización no encontrada"}

    servicios = await conn.fetch(
        """SELECT sc.*, s.nombre as servicio_nombre, s.fase as servicio_fase, s."tipoPago" as "servicio_tipoPago"
           FROM "ServicioCotizado" sc
           LEFT JOIN "ServicioCatalogo" s ON sc."servicioCatalogoId" = s.id
           WHERE sc."cotizacionId" = $1""",
        args["cotizacion_id"],
    )

    plan = await conn.fetchrow(
        'SELECT * FROM "PlanBucefaloCotizacion" WHERE "cotizacionId" = $1',
        args["cotizacion_id"],
    )

    result = dict(cot)
    result["cliente"] = {
        "nombre": cot["cliente_nombre"],
        "empresa": cot["cliente_empresa"],
        "email": cot["cliente_email"],
        "telefono": cot["cliente_telefono"],
        "rfc": cot["cliente_rfc"],
    }
    result["servicios"] = [dict(s) for s in servicios]
    result["planBucefalo"] = dict(plan) if plan else None

    for k in ["cliente_nombre", "cliente_empresa", "cliente_email", "cliente_telefono", "cliente_rfc"]:
        result.pop(k, None)

    return result


async def _listar_cotizaciones(conn, args: dict) -> dict:
    conditions = []
    params = []
    idx = 1

    if args.get("estado"):
        conditions.append(f'c.estado = ${idx}')
        params.append(args["estado"])
        idx += 1
    if args.get("cliente_nombre"):
        conditions.append(f'LOWER(cl.nombre) LIKE LOWER(${idx})')
        params.append(f"%{args['cliente_nombre']}%")
        idx += 1
    if args.get("busqueda"):
        conditions.append(
            f'(LOWER(c.numero) LIKE LOWER(${idx}) OR LOWER(c.proyecto) LIKE LOWER(${idx}) OR LOWER(cl.nombre) LIKE LOWER(${idx}))'
        )
        params.append(f"%{args['busqueda']}%")
        idx += 1

    where = "WHERE " + " AND ".join(conditions) if conditions else ""
    query = f"""SELECT c.id, c.numero, c.fecha, c.vigencia, c.estado, c.proyecto,
                       c.moneda, c."esquemaPago",
                       cl.nombre as cliente_nombre, cl.empresa as cliente_empresa
                FROM "Cotizacion" c
                LEFT JOIN "Cliente" cl ON c."clienteId" = cl.id
                {where}
                ORDER BY c."createdAt" DESC
                LIMIT 50"""

    rows = await conn.fetch(query, *params)
    cotizaciones = []
    for r in rows:
        d = dict(r)
        d["cliente"] = {"nombre": d.pop("cliente_nombre"), "empresa": d.pop("cliente_empresa")}
        cotizaciones.append(d)

    return {"cotizaciones": cotizaciones, "total": len(cotizaciones)}


async def _cambiar_estado(conn, args: dict) -> dict:
    cot_id = args["cotizacion_id"]
    estado = args["estado"]

    cot = await conn.fetchrow('SELECT id FROM "Cotizacion" WHERE id = $1', cot_id)
    if not cot:
        return {"error": "Cotización no encontrada"}

    await conn.execute('UPDATE "Cotizacion" SET estado = $1, "updatedAt" = NOW() WHERE id = $2', estado, cot_id)
    return {"ok": True, "cotizacion_id": cot_id, "nuevo_estado": estado}


async def _actualizar_precio(conn, args: dict) -> dict:
    cot_id = args["cotizacion_id"]
    servicio_id = args["servicio_id"]
    nuevo_precio = args["nuevo_precio"]

    srv = await conn.fetchrow(
        'SELECT id FROM "ServicioCotizado" WHERE id = $1 AND "cotizacionId" = $2',
        servicio_id, cot_id,
    )
    if not srv:
        return {"error": "Servicio no encontrado en esta cotización"}

    await conn.execute(
        'UPDATE "ServicioCotizado" SET precio = $1, "updatedAt" = NOW() WHERE id = $2',
        nuevo_precio, servicio_id,
    )
    return {"ok": True, "servicio_id": servicio_id, "nuevo_precio": nuevo_precio}


async def _duplicar_cotizacion(conn, args: dict) -> dict:
    cot_id = args["cotizacion_id"]

    original = await conn.fetchrow('SELECT * FROM "Cotizacion" WHERE id = $1', cot_id)
    if not original:
        return {"error": "Cotización no encontrada"}

    now = datetime.now()
    new_numero = f"{original['numero']}-COPY"

    async with conn.transaction():
        new_cot = await conn.fetchrow(
            """INSERT INTO "Cotizacion" (id, numero, fecha, vigencia, moneda, "tipoCambio", proyecto, "esquemaPago",
               estado, "incluirBonos", "incluirFinanciamiento", "esDoble", "opcionesMetadata", observaciones, "clienteId", "asesorId", "createdAt", "updatedAt")
               VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, 'borrador', $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
               RETURNING id, numero""",
            new_numero, now, original["vigencia"], original["moneda"], original["tipoCambio"],
            original["proyecto"], original["esquemaPago"], original["incluirBonos"],
            original["incluirFinanciamiento"], original["esDoble"], original["opcionesMetadata"],
            original["observaciones"], original["clienteId"], original["asesorId"],
        )
        new_id = new_cot["id"]

        servicios = await conn.fetch(
            'SELECT * FROM "ServicioCotizado" WHERE "cotizacionId" = $1', cot_id
        )
        for s in servicios:
            await conn.fetchrow(
                """INSERT INTO "ServicioCotizado" (id, "cotizacionId", "servicioCatalogoId", fase, "tipoPago",
                   precio, "tiempoEntrega", entregables, notas, opcion, seleccionado, "createdAt", "updatedAt")
                   VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())""",
                new_id, s["servicioCatalogoId"], s["fase"], s["tipoPago"],
                s["precio"], s["tiempoEntrega"], s["entregables"], s["notas"], s["opcion"], s["seleccionado"],
            )

        plan = await conn.fetchrow(
            'SELECT * FROM "PlanBucefaloCotizacion" WHERE "cotizacionId" = $1', cot_id
        )
        if plan:
            await conn.fetchrow(
                """INSERT INTO "PlanBucefaloCotizacion" (id, "cotizacionId", nivel, precio, seleccionado, "createdAt", "updatedAt")
                   VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), NOW())""",
                new_id, plan["nivel"], plan["precio"], plan["seleccionado"],
            )

    return {"cotizacion_id": str(new_id), "numero": new_numero, "estado": "borrador"}


async def _calcular_financiamiento(args: dict) -> dict:
    monto = args["monto"]
    meses = args["meses"]

    plan = next((p for p in FINANCIAMIENTO_PLANES if p["meses"] == meses), None)
    if not plan:
        from app.services.calculators import FINANCIAMIENTO_PLANES
        plan = next((p for p in FINANCIAMIENTO_PLANES if p["meses"] == meses), None)

    if not plan:
        return {"error": f"Plan de {meses} meses no disponible"}

    result = calcular_financiamiento(monto, meses, plan["tasa"], plan["comision"])
    result["meses"] = meses
    result["tasa"] = plan["tasa"]
    result["comision"] = plan["comision"]
    return result


async def _generar_pdf(conn, args: dict) -> dict:
    cot_id = args["cotizacion_id"]
    cot = await conn.fetchrow(
        """SELECT c.*, cl.nombre as cliente_nombre, cl.empresa as cliente_empresa
           FROM "Cotizacion" c
           LEFT JOIN "Cliente" cl ON c."clienteId" = cl.id
           WHERE c.id = $1""",
        cot_id,
    )
    if not cot:
        return {"error": "Cotización no encontrada"}

    return {
        "status": "pdf_generated",
        "cotizacion_id": cot_id,
        "numero": cot["numero"],
        "filename": f"{cot['cliente_nombre']} - {cot['numero']}.pdf",
        "message": "PDF generation will be implemented with reportlab",
    }


async def _obtener_configuracion(conn) -> dict:
    rows = await conn.fetch('SELECT clave, valor FROM "Configuracion"')
    return {"config": {r["clave"]: r["valor"] for r in rows}}


from app.services.calculators import FINANCIAMIENTO_PLANES
