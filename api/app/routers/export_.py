"""Export endpoints — PDF, Excel, CSV generation."""

from __future__ import annotations

import csv
import io
import json
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import PlainTextResponse, Response
from asyncpg import Connection

from app.dependencies import get_db
from app.models.export_ import ExportDraft
from app.models.common import ErrorResponse
from app.auth import require_auth
from app.services.calculators import bucefalo_precio, calcular_vigencia, sanitize_filename
from app.services.pdf_generator import generate_cotizacion_pdf
from app.services.excel_generator import generate_cotizacion_excel

router = APIRouter(prefix="/export", tags=["Export"])


async def _load_branding(db: Connection) -> dict[str, str]:
    rows = await db.fetch('SELECT clave, valor FROM "Configuracion"')
    return {r["clave"]: r["valor"] for r in rows}


def _build_pdf_data_from_draft(draft: ExportDraft, branding: dict[str, str]) -> dict[str, Any]:
    fecha = datetime.now()
    if draft.fecha:
        try:
            fecha = datetime.fromisoformat(draft.fecha.replace("Z", "+00:00"))
        except ValueError:
            try:
                fecha = datetime.strptime(draft.fecha, "%Y-%m-%d")
            except ValueError:
                pass

    vigencia = calcular_vigencia(fecha)
    logo_raw = branding.get("logo_base64", "")
    logo_mime = None
    logo_b64 = None
    if logo_raw and ":" in logo_raw:
        parts = logo_raw.split(":", 1)
        logo_mime = parts[0]
        logo_b64 = parts[1]
    elif logo_raw:
        logo_b64 = logo_raw

    return {
        "numero": "BORRADOR",
        "clienteNombre": draft.clienteNombre,
        "clienteEmpresa": draft.clienteEmpresa,
        "asesorNombre": draft.asesorNombre,
        "fecha": fecha,
        "vigencia": vigencia,
        "moneda": draft.moneda,
        "tipoCambio": draft.tipoCambio,
        "proyecto": draft.proyecto,
        "esquemaPago": draft.esquemaPago,
        "servicios": [
            {
                "nombre": s.nombre,
                "fase": s.fase,
                "tipoPago": s.tipoPago,
                "precio": s.precio,
                "tiempoEntrega": s.tiempoEntrega,
                "entregables": s.entregables,
            }
            for s in draft.servicios
        ],
        "planBucefaloNivel": draft.planBucefaloNivel,
        "planBucefaloPrecio": bucefalo_precio(draft.planBucefaloNivel) if draft.planBucefaloNivel else 0,
        "incluirBonos": draft.incluirBonos,
        "colorPrimario": branding.get("color_primario", "#2563eb"),
        "colorSecundario": branding.get("color_secundario", "#1e293b"),
        "logoBase64": logo_b64,
        "logoMime": logo_mime,
        "configBancaria": branding,
        "razonSocial": branding.get("razon_social", "Cotizador E3"),
    }


async def _build_pdf_data_from_db(db: Connection, cotizacion_id: str) -> dict[str, Any] | None:
    cot = await db.fetchrow(
        """SELECT c.*, cl.nombre as cliente_nombre, cl.empresa as cliente_empresa,
                  u.name as asesor_nombre
           FROM "Cotizacion" c
           LEFT JOIN "Cliente" cl ON cl.id = c."clienteId"
           LEFT JOIN "User" u ON u.id = c."asesorId"
           WHERE c.id = $1""",
        cotizacion_id,
    )
    if not cot:
        return None

    servicios = await db.fetch(
        """SELECT sc.fase, sc."tipoPago", sc.precio, sc."tiempoEntrega", sc.entregables,
                  s.nombre
           FROM "ServicioCotizado" sc
           JOIN "ServicioCatalogo" s ON s.id = sc."servicioCatalogoId"
           WHERE sc."cotizacionId" = $1 AND sc.seleccionado = true
           ORDER BY sc.fase, sc.id""",
        cotizacion_id,
    )

    plan = await db.fetchrow(
        'SELECT nivel, precio FROM "PlanBucefaloCotizacion" WHERE "cotizacionId" = $1',
        cotizacion_id,
    )

    branding = await _load_branding(db)

    logo_raw = branding.get("logo_base64", "")
    logo_mime = None
    logo_b64 = None
    if logo_raw and ":" in logo_raw:
        parts = logo_raw.split(":", 1)
        logo_mime = parts[0]
        logo_b64 = parts[1]
    elif logo_raw:
        logo_b64 = logo_raw

    servicios_list = []
    for s in servicios:
        ent = s["entregables"]
        if isinstance(ent, str):
            try:
                ent = json.loads(ent)
            except (json.JSONDecodeError, TypeError):
                ent = []
        servicios_list.append({
            "nombre": s["nombre"],
            "fase": s["fase"],
            "tipoPago": s["tipoPago"],
            "precio": float(s["precio"]),
            "tiempoEntrega": s["tiempoEntrega"],
            "entregables": ent or [],
        })

    plan_nivel = plan["nivel"] if plan else None

    return {
        "numero": cot["numero"],
        "clienteNombre": cot["cliente_nombre"] or "",
        "clienteEmpresa": cot["cliente_empresa"] or "",
        "asesorNombre": cot["asesor_nombre"] or "",
        "fecha": cot["fecha"],
        "vigencia": cot["vigencia"],
        "moneda": cot["moneda"],
        "tipoCambio": cot["tipoCambio"],
        "proyecto": cot["proyecto"],
        "esquemaPago": cot["esquemaPago"],
        "servicios": servicios_list,
        "planBucefaloNivel": plan_nivel,
        "planBucefaloPrecio": float(plan["precio"]) if plan else 0,
        "incluirBonos": cot["incluirBonos"],
        "colorPrimario": branding.get("color_primario", "#2563eb"),
        "colorSecundario": branding.get("color_secundario", "#1e293b"),
        "logoBase64": logo_b64,
        "logoMime": logo_mime,
        "configBancaria": branding,
        "razonSocial": branding.get("razon_social", "Cotizador E3"),
    }


# ── PDF ENDPOINTS ──────────────────────────────────

@router.post("/pdf")
async def export_pdf_draft(
    body: ExportDraft,
    _auth: dict = Depends(require_auth),
    db: Connection = Depends(get_db),
):
    branding = await _load_branding(db)
    pdf_data = _build_pdf_data_from_draft(body, branding)
    pdf_bytes = generate_cotizacion_pdf(pdf_data)

    empresa = body.clienteEmpresa or body.clienteNombre or "Cotizacion"
    filename = f"{sanitize_filename(empresa)} - BORRADOR.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/pdf/{cotizacion_id}")
async def export_pdf_saved(
    cotizacion_id: str,
    _auth: dict = Depends(require_auth),
    db: Connection = Depends(get_db),
):
    pdf_data = await _build_pdf_data_from_db(db, cotizacion_id)
    if not pdf_data:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")

    pdf_bytes = generate_cotizacion_pdf(pdf_data)

    empresa = pdf_data["clienteEmpresa"] or pdf_data["clienteNombre"]
    filename = f"{sanitize_filename(empresa)} - {sanitize_filename(pdf_data['numero'])}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── EXCEL ENDPOINTS ────────────────────────────────

@router.post("/excel")
async def export_excel_draft(
    body: ExportDraft,
    _auth: dict = Depends(require_auth),
    db: Connection = Depends(get_db),
):
    branding = await _load_branding(db)
    excel_data = _build_pdf_data_from_draft(body, branding)
    excel_bytes = generate_cotizacion_excel(excel_data, saved=False)

    empresa = body.clienteEmpresa or body.clienteNombre or "Cotizacion"
    filename = f"{sanitize_filename(empresa)} - {sanitize_filename(body.clienteNombre)} - BORRADOR.xlsx"

    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/excel/{cotizacion_id}")
async def export_excel_saved(
    cotizacion_id: str,
    _auth: dict = Depends(require_auth),
    db: Connection = Depends(get_db),
):
    excel_data = await _build_pdf_data_from_db(db, cotizacion_id)
    if not excel_data:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")

    excel_bytes = generate_cotizacion_excel(excel_data, saved=True)

    empresa = excel_data["clienteEmpresa"] or excel_data["clienteNombre"]
    filename = f"{sanitize_filename(empresa)} - {sanitize_filename(excel_data['numero'])}.xlsx"

    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── CSV ENDPOINTS ──────────────────────────────────

@router.get("/catalogo", response_class=PlainTextResponse)
async def export_catalogo_csv(
    _auth: dict = Depends(require_auth),
    db: Connection = Depends(get_db),
):
    rows = await db.fetch(
        """SELECT s.id, s.nombre, s.descripcion, s.fase, s."tipoPago",
                  s."precioBase", s."tiempoEntrega", s."entregablesDefault",
                  s.variante, s.orden, c.nombre AS categoria
           FROM "ServicioCatalogo" s
           LEFT JOIN "Categoria" c ON c.id = s."categoriaId"
           WHERE s.activo = true
           ORDER BY s.fase, s.orden"""
    )

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "Nombre", "Categoria", "Fase", "Tipo de Pago", "Precio Base",
        "Tiempo de Entrega", "Entregables", "Variante",
    ])
    for r in rows:
        entregables = r["entregablesDefault"] or []
        if isinstance(entregables, list):
            entregables = " | ".join(entregables)
        elif isinstance(entregables, str):
            try:
                ent_list = json.loads(entregables)
                entregables = " | ".join(ent_list) if isinstance(ent_list, list) else entregables
            except (json.JSONDecodeError, TypeError):
                pass
        writer.writerow([
            r["nombre"], r["categoria"], r["fase"], r["tipoPago"],
            r["precioBase"], r["tiempoEntrega"], entregables, r["variante"],
        ])

    return PlainTextResponse(
        content=buf.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=catalogo-servicios.csv"},
    )


@router.get("/catalogo/plantilla", response_class=PlainTextResponse)
async def export_catalogo_template(db: Connection = Depends(get_db)):
    cats = await db.fetch(
        'SELECT nombre FROM "Categoria" WHERE activo = true ORDER BY orden'
    )
    cat_names = [r["nombre"] for r in cats]

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "nombre", "descripcion", "fase", "tipoPago",
        "precioBase", "tiempoEntrega", "entregablesDefault", "variante", "categoria",
    ])
    writer.writerow([
        "SEO On-Page", "Optimización on-page para buscadores", "Contenido y SEO", "mensual",
        "2900", "7 - 14 dias", "Keyword research | On-page optimization", "", "SEO",
    ])
    writer.writerow([
        "", "", "", "", "", "", "", "", "",
    ])
    writer.writerow([f"CATEGORIAS: {', '.join(cat_names)}"])
    writer.writerow(["FASES: Auditoria, Setup e Infraestructura, Publicidad y Manejo, Contenido y SEO"])
    writer.writerow(["TIPOS DE PAGO: unico, mensual"])

    return PlainTextResponse(
        content=buf.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=plantilla-catalogo.csv"},
    )
