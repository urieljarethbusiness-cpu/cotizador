"""PDF Generator for Cotizador E3 — port of pdf-generator.ts using ReportLab."""

from __future__ import annotations

import base64
import io
from datetime import datetime
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader

from app.services.calculators import FASES_SHORT, PLANES_BUCEFALO, bucefalo_precio, detalle_modelo, calcular_totales_opcion

PRIMARY_DEFAULT = "#2563eb"
DARK_DEFAULT = "#1e293b"
MUTED = "#64748b"
BORDER = "#cbd5e1"
LIGHT_BG = "#f1f5f9"
WHITE = "#ffffff"

PAGE_W, PAGE_H = LETTER
MARGIN_TOP = 45
MARGIN_BOTTOM = 55
MARGIN_LEFT = 50
MARGIN_RIGHT = 50
CONTENT_W = PAGE_W - MARGIN_LEFT - MARGIN_RIGHT


def _hex_to_rgb(hex_color: str) -> colors.Color:
    h = hex_color.lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return colors.Color(r / 255, g / 255, b / 255)


def _fmt_currency(n: float) -> str:
    return f"${n:,.2f}"


def _wrap_text(c, text: str, font: str, size: float, max_width: float) -> list[str]:
    """Envuelve texto en lineas que caben en max_width (respeta saltos de linea)."""
    lines: list[str] = []
    for paragraph in str(text or "").split("\n"):
        words = paragraph.split()
        line = ""
        for word in words:
            test = f"{line} {word}".strip()
            if c.stringWidth(test, font, size) > max_width and line:
                lines.append(line)
                line = word
            else:
                line = test
        lines.append(line)
    return lines


def _fmt_date(d: datetime) -> str:
    months = [
        "enero", "febrero", "marzo", "abril", "mayo", "junio",
        "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
    ]
    return f"{d.day} de {months[d.month - 1]} de {d.year}"


def _load_logo(logo_base64: str | None, logo_mime: str | None) -> ImageReader | None:
    if not logo_base64:
        return None
    try:
        raw = base64.b64decode(logo_base64)
        return io.BytesIO(raw)
    except Exception:
        return None


def generate_cotizacion_pdf(data: dict[str, Any]) -> bytes:
    """Generate a professional quotation PDF.

    Args:
        data: dict with keys matching CotizacionPDFData interface:
            numero, clienteNombre, clienteEmpresa, asesorNombre, fecha, vigencia,
            moneda, tipoCambio, proyecto, esquemaPago, servicios[],
            planBucefaloNivel, planBucefaloPrecio, incluirBonos,
            configBancaria{}, colorPrimario, colorSecundario, logoBase64, logoMime
    """
    PRIMARY = data.get("colorPrimario") or PRIMARY_DEFAULT
    DARK = data.get("colorSecundario") or DARK_DEFAULT
    primary_rgb = _hex_to_rgb(PRIMARY)
    dark_rgb = _hex_to_rgb(DARK)
    muted_rgb = _hex_to_rgb(MUTED)
    border_rgb = _hex_to_rgb(BORDER)
    light_rgb = _hex_to_rgb(LIGHT_BG)
    white_rgb = _hex_to_rgb(WHITE)

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=LETTER)
    c.setTitle(f"Cotizacion {data.get('numero', '')}")

    logo = _load_logo(data.get("logoBase64"), data.get("logoMime"))

    servicios = data.get("servicios", [])
    plan_nivel = data.get("planBucefaloNivel")
    plan_precio = data.get("planBucefaloPrecio", 0)
    incluir_bonos = data.get("incluirBonos", False)
    cfg_bancaria = data.get("configBancaria") or {}

    # ── PAGE 1: COVER ──────────────────────────────
    c.setFillColor(white_rgb)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

    y = PAGE_H - 80
    if logo:
        try:
            c.drawImage(logo, MARGIN_LEFT, y - 20, width=65, height=65, preserveAspectRatio=True, mask="auto")
            y -= 85
        except Exception:
            logo = None

    if not logo:
        c.setFont("Helvetica-Bold", 28)
        c.setFillColor(primary_rgb)
        c.drawString(MARGIN_LEFT, y, "UJ")
        c.setFont("Helvetica", 9)
        c.setFillColor(muted_rgb)
        c.drawString(MARGIN_LEFT + 48, y - 15, "Uriel Jareth Consulting")
        y -= 40

    bar_y = y
    c.setFillColor(primary_rgb)
    c.rect(MARGIN_LEFT, bar_y, CONTENT_W, 4, fill=1, stroke=0)

    c.setFont("Helvetica-Bold", 36)
    c.setFillColor(dark_rgb)
    c.drawString(MARGIN_LEFT, bar_y - 40, "Cotizacion")
    c.setFont("Helvetica", 18)
    c.setFillColor(primary_rgb)
    c.drawString(MARGIN_LEFT, bar_y - 65, data.get("numero", ""))

    iy = bar_y - 100
    cL = MARGIN_LEFT
    cR = MARGIN_LEFT + CONTENT_W * 0.52

    info_l = [
        ("Cliente", data.get("clienteNombre", "")),
        ("Empresa", data.get("clienteEmpresa", "")),
        ("Proyecto", data.get("proyecto", "")),
        ("Asesor", data.get("asesorNombre", "")),
    ]
    info_r = [
        ("Fecha", _fmt_date(data.get("fecha", datetime.now()))),
        ("Vigencia", _fmt_date(data.get("vigencia", datetime.now()))),
        ("Moneda", data.get("moneda", "MXN")),
        ("Esquema", data.get("esquemaPago", "")),
    ]

    for i in range(max(len(info_l), len(info_r))):
        if i < len(info_l) and info_l[i][1]:
            c.setFont("Helvetica", 9)
            c.setFillColor(muted_rgb)
            c.drawString(cL, iy, info_l[i][0])
            c.setFont("Helvetica", 11)
            c.setFillColor(dark_rgb)
            c.drawString(cL, iy - 14, info_l[i][1])
        if i < len(info_r) and info_r[i][1]:
            c.setFont("Helvetica", 9)
            c.setFillColor(muted_rgb)
            c.drawString(cR, iy, info_r[i][0])
            c.setFont("Helvetica", 11)
            c.setFillColor(dark_rgb)
            c.drawString(cR, iy - 14, str(info_r[i][1]))
        iy -= 32

    # ── PAGE 2+: RESUMEN ──────────────────────────
    c.showPage()
    y = PAGE_H - MARGIN_TOP

    if logo:
        try:
            c.drawImage(logo, MARGIN_LEFT + CONTENT_W - 70, y - 5, width=22, height=22, preserveAspectRatio=True, mask="auto")
        except Exception:
            pass

    c.setFillColor(primary_rgb)
    c.rect(MARGIN_LEFT, y - 16, 4, 16, fill=1, stroke=0)
    c.setFont("Helvetica-Bold", 15)
    c.setFillColor(dark_rgb)
    c.drawString(MARGIN_LEFT + 12, y - 15, "Hoja Resumen")
    y -= 28

    cliente_ref = data.get("clienteEmpresa") or data.get("clienteNombre", "")
    c.setFont("Helvetica", 8)
    c.setFillColor(muted_rgb)
    c.drawString(MARGIN_LEFT, y, f"En atencion a: {cliente_ref}")
    c.drawString(MARGIN_LEFT + CONTENT_W * 0.45, y, f"No. Cotizacion: {data.get('numero', '')}")
    y -= 11
    c.drawString(MARGIN_LEFT, y, f"Asesor: {data.get('asesorNombre', '')}")
    c.drawString(MARGIN_LEFT + CONTENT_W * 0.45, y, f"Fecha: {_fmt_date(data.get('fecha', datetime.now()))}  |  Moneda: {data.get('moneda', 'MXN')}")
    y -= 18

    col_nombre = MARGIN_LEFT
    col_tipo = MARGIN_LEFT + CONTENT_W - 200
    col_tiempo = MARGIN_LEFT + CONTENT_W - 120
    col_precio = MARGIN_LEFT + CONTENT_W - 60

    es_doble = bool(data.get("esDoble"))
    opciones_meta = data.get("opcionesMetadata") or {}

    def _draw_table_header(y_pos):
        c.setFillColor(light_rgb)
        c.rect(MARGIN_LEFT, y_pos - 2, CONTENT_W, 16, fill=1, stroke=0)
        c.setFont("Helvetica-Bold", 7)
        c.setFillColor(dark_rgb)
        c.drawString(col_nombre + 6, y_pos + 3, "Servicio")
        c.drawString(col_tipo + 4, y_pos + 3, "Tipo")
        c.drawString(col_tiempo + 4, y_pos + 3, "Entrega")
        c.drawRightString(col_precio + 60, y_pos + 3, "Precio")
        y_pos -= 4
        c.setStrokeColor(border_rgb)
        c.setLineWidth(0.3)
        c.line(MARGIN_LEFT, y_pos, MARGIN_LEFT + CONTENT_W, y_pos)
        return y_pos - 14

    unicos = [s for s in servicios if s.get("tipoPago") == "unico"]
    mensuales = [s for s in servicios if s.get("tipoPago") == "mensual"]

    def _draw_section(srv_list, tipo_label, titulo_total, y_pos):
        if not srv_list:
            return y_pos
        current_fase = -1
        max_y = PAGE_H - MARGIN_BOTTOM - 5

        for serv in srv_list:
            fase = serv.get("fase", 0)
            if fase != current_fase:
                current_fase = fase
                if y_pos - 20 < max_y - PAGE_H:
                    c.showPage()
                    y_pos = PAGE_H - MARGIN_TOP
                c.setFillColor(light_rgb)
                c.rect(MARGIN_LEFT, y_pos - 14, CONTENT_W, 14, fill=1, stroke=0)
                c.setFont("Helvetica-Bold", 7)
                c.setFillColor(primary_rgb)
                c.drawString(MARGIN_LEFT + 6, y_pos - 11, FASES_SHORT.get(fase, f"FASE {fase}"))
                y_pos -= 18

            c.setFont("Helvetica", 8)
            c.setFillColor(dark_rgb)
            nombre = serv.get("nombre", "")
            c.drawString(col_nombre + 6, y_pos - 10, nombre[:60])
            c.setFont("Helvetica", 7)
            c.setFillColor(muted_rgb)
            c.drawString(col_tipo + 4, y_pos - 10, tipo_label)
            c.drawString(col_tiempo + 4, y_pos - 10, serv.get("tiempoEntrega", "")[:15])
            c.setFont("Helvetica-Bold", 8)
            c.setFillColor(dark_rgb)
            c.drawRightString(col_precio + 60, y_pos - 10, _fmt_currency(serv.get("precio", 0)))
            y_pos -= 14

            detalle = detalle_modelo(serv)
            if detalle:
                c.setFont("Helvetica-Oblique", 6.5)
                c.setFillColor(muted_rgb)
                c.drawString(col_nombre + 10, y_pos - 7, detalle[:90])
                y_pos -= 9

            entregables = serv.get("entregables", [])
            if entregables:
                half = (len(entregables) + 1) // 2
                for idx in range(half):
                    e1 = entregables[idx]
                    e2 = entregables[idx + half] if idx + half < len(entregables) else None
                    c.setFont("Helvetica", 6)
                    c.setFillColor(muted_rgb)
                    c.drawString(col_nombre + 10, y_pos - 8, f"\u2022 {e1[:50]}")
                    if e2:
                        c.drawString(col_nombre + CONTENT_W * 0.48, y_pos - 8, f"\u2022 {e2[:50]}")
                    y_pos -= 9

            c.setStrokeColor(_hex_to_rgb("#e5e7eb"))
            c.setLineWidth(0.2)
            c.line(col_nombre + 6, y_pos, MARGIN_LEFT + CONTENT_W, y_pos)
            y_pos -= 6

        total = sum(s.get("precio", 0) for s in srv_list)
        y_pos -= 4
        c.setFillColor(_hex_to_rgb("#f8fafc"))
        c.rect(MARGIN_LEFT, y_pos - 2, CONTENT_W, 18, fill=1, stroke=0)
        c.setFont("Helvetica-Bold", 8.5)
        c.setFillColor(primary_rgb)
        c.drawString(col_nombre + 6, y_pos + 3, titulo_total)
        c.drawRightString(col_precio + 60, y_pos + 3, _fmt_currency(total))
        y_pos -= 18
        c.setFont("Helvetica", 6)
        c.setFillColor(muted_rgb)
        c.drawString(col_nombre + 6, y_pos, "(Precios en Moneda Nacional, no incluyen IVA)")
        y_pos -= 14
        return y_pos

    def _draw_opcion_header(op, y_pos):
        meta = opciones_meta.get(op) or {}
        max_y = PAGE_H - MARGIN_BOTTOM - 5
        if y_pos - 30 < max_y:
            c.showPage()
            y_pos = PAGE_H - MARGIN_TOP
        titulo = meta.get("titulo")
        c.setFillColor(primary_rgb)
        c.rect(MARGIN_LEFT, y_pos - 18, CONTENT_W, 18, fill=1, stroke=0)
        c.setFont("Helvetica-Bold", 10)
        c.setFillColor(white_rgb)
        c.drawString(MARGIN_LEFT + 8, y_pos - 13, f"OPCION {op}" + (f": {titulo}" if titulo else ""))
        y_pos -= 24
        desc = meta.get("descripcion")
        if desc:
            c.setFont("Helvetica", 7.5)
            c.setFillColor(dark_rgb)
            for line in _wrap_text(c, desc, "Helvetica", 7.5, CONTENT_W - 12):
                c.drawString(MARGIN_LEFT + 6, y_pos - 8, line)
                y_pos -= 10
            y_pos -= 2
        no_incluye = meta.get("noIncluye")
        if no_incluye:
            c.setFont("Helvetica-Oblique", 7)
            c.setFillColor(muted_rgb)
            for line in _wrap_text(c, f"No incluye: {no_incluye}", "Helvetica-Oblique", 7, CONTENT_W - 12):
                c.drawString(MARGIN_LEFT + 6, y_pos - 8, line)
                y_pos -= 10
            y_pos -= 4
        return y_pos

    def _draw_comparativa(y_pos):
        t1 = calcular_totales_opcion(servicios, "1")
        t2 = calcular_totales_opcion(servicios, "2")
        max_y = PAGE_H - MARGIN_BOTTOM - 5
        if y_pos - 90 < max_y:
            c.showPage()
            y_pos = PAGE_H - MARGIN_TOP
        y_pos -= 6
        c.setFillColor(primary_rgb)
        c.rect(MARGIN_LEFT, y_pos - 10, 3, 10, fill=1, stroke=0)
        c.setFont("Helvetica-Bold", 10)
        c.setFillColor(dark_rgb)
        c.drawString(MARGIN_LEFT + 10, y_pos - 8, "Comparativa de opciones")
        y_pos -= 22
        c_label = MARGIN_LEFT
        c_op1 = MARGIN_LEFT + CONTENT_W * 0.45
        c_op2 = MARGIN_LEFT + CONTENT_W * 0.72
        t1_tit = (opciones_meta.get("1") or {}).get("titulo")
        t2_tit = (opciones_meta.get("2") or {}).get("titulo")
        c.setFillColor(light_rgb)
        c.rect(MARGIN_LEFT, y_pos - 2, CONTENT_W, 16, fill=1, stroke=0)
        c.setFont("Helvetica-Bold", 7.5)
        c.setFillColor(dark_rgb)
        c.drawString(c_label + 6, y_pos + 3, "Concepto")
        c.drawString(c_op1, y_pos + 3, f"Opcion 1" + (f" - {t1_tit}" if t1_tit else ""))
        c.drawString(c_op2, y_pos + 3, f"Opcion 2" + (f" - {t2_tit}" if t2_tit else ""))
        y_pos -= 18
        filas = [
            ("Total unico (c/IVA)", _fmt_currency(t1["totalUnico"] * 1.16), _fmt_currency(t2["totalUnico"] * 1.16)),
            ("Total mensual (c/IVA)", _fmt_currency(t1["totalMensual"] * 1.16), _fmt_currency(t2["totalMensual"] * 1.16)),
            ("Horas estimadas", f"{t1['horas']:g} h", f"{t2['horas']:g} h"),
        ]
        for lab, v1, v2 in filas:
            c.setFont("Helvetica", 8)
            c.setFillColor(dark_rgb)
            c.drawString(c_label + 6, y_pos - 8, lab)
            c.setFont("Helvetica-Bold", 8)
            c.drawString(c_op1, y_pos - 8, v1)
            c.drawString(c_op2, y_pos - 8, v2)
            c.setStrokeColor(_hex_to_rgb("#e5e7eb"))
            c.setLineWidth(0.2)
            c.line(c_label + 6, y_pos - 12, MARGIN_LEFT + CONTENT_W, y_pos - 12)
            y_pos -= 14
        return y_pos - 8

    if es_doble:
        for op in ("1", "2"):
            y = _draw_opcion_header(op, y)
            y = _draw_table_header(y)
            u = [s for s in unicos if s.get("opcion") in (op, "ambas")]
            me = [s for s in mensuales if s.get("opcion") in (op, "ambas")]
            if u:
                y = _draw_section(u, "Unico", f"Total Pago Unico - Opcion {op}", y)
            if me:
                y = _draw_section(me, "Mensual", f"Total Pago Mensual - Opcion {op}", y)
        y = _draw_comparativa(y)
    else:
        y = _draw_table_header(y)
        if unicos:
            y = _draw_section(unicos, "Unico", "Total Pago Unico", y)
        if mensuales:
            y = _draw_section(mensuales, "Mensual", "Total Pago Mensual", y)

    if plan_nivel:
        label = plan_nivel.capitalize()
        c.setFillColor(light_rgb)
        c.rect(MARGIN_LEFT, y - 2, CONTENT_W, 14, fill=1, stroke=0)
        c.setFont("Helvetica-Bold", 7.5)
        c.setFillColor(dark_rgb)
        c.drawString(col_nombre + 6, y + 3, f"Plan Bucefalo CRM - {label}")
        c.drawRightString(col_precio + 60, y + 3, _fmt_currency(plan_precio))
        y -= 20

    if incluir_bonos:
        y -= 6
        c.setFillColor(primary_rgb)
        c.rect(MARGIN_LEFT, y - 10, 3, 10, fill=1, stroke=0)
        c.setFont("Helvetica-Bold", 9)
        c.setFillColor(dark_rgb)
        c.drawString(MARGIN_LEFT + 10, y - 8, "Bonos (Pago en una exhibicion)")
        y -= 20
        bonos = [
            "Bono 1: 30 min mensuales en servicios Centinela (Sitio Web)",
            "Bono 2: Workshop Estrategico de Buyer Persona",
            "Bono 3: Workshop de Propuestas de Valor y Oferta Irresistible",
            "Bono 4: 1 ano de Membresia Premium",
            "Bono 5: Un mes gratis de Bucefalo CRM",
            "Bono 6: Script de Ventas con mas de 100 complementos",
        ]
        for b in bonos:
            c.setFont("Helvetica", 7)
            c.setFillColor(dark_rgb)
            c.drawString(MARGIN_LEFT + 8, y - 8, f"\u2713  {b}")
            y -= 12

    # ── T&C PAGE ──────────────────────────────────
    c.showPage()
    y = PAGE_H - MARGIN_TOP

    if logo:
        try:
            c.drawImage(logo, MARGIN_LEFT + CONTENT_W - 70, y - 5, width=22, height=22, preserveAspectRatio=True, mask="auto")
        except Exception:
            pass

    c.setFillColor(primary_rgb)
    c.rect(MARGIN_LEFT, y - 16, 4, 16, fill=1, stroke=0)
    c.setFont("Helvetica-Bold", 15)
    c.setFillColor(dark_rgb)
    c.drawString(MARGIN_LEFT + 12, y - 15, "Terminos y Condiciones")
    y -= 30

    def _section_title(title, yy):
        c.setFillColor(primary_rgb)
        c.rect(MARGIN_LEFT, yy - 9, 3, 9, fill=1, stroke=0)
        c.setFont("Helvetica-Bold", 9)
        c.setFillColor(dark_rgb)
        c.drawString(MARGIN_LEFT + 10, yy - 8, title)
        return yy - 20

    def _draw_bullets(title, items, yy):
        yy = _section_title(title, yy)
        for t in items:
            c.setFont("Helvetica", 7.5)
            c.setFillColor(dark_rgb)
            # Simple text wrapping
            words = t.split()
            line = ""
            for word in words:
                test = f"{line} {word}".strip()
                if c.stringWidth(test, "Helvetica", 7.5) > CONTENT_W - 10:
                    c.drawString(MARGIN_LEFT + 2, yy - 8, f"\u2022  {line}")
                    yy -= 11
                    line = word
                else:
                    line = test
            if line:
                c.drawString(MARGIN_LEFT + 2, yy - 8, f"\u2022  {line}")
                yy -= 11
        return yy - 8

    y = _draw_bullets("Condiciones", [
        "Esta cotizacion tiene una vigencia de 15 dias habiles.",
        "Cualquier ajuste al proyecto despues de la aprobacion del contenido afectara la fecha de entrega y por consiguiente el costo.",
        "El cliente debera proporcionar la informacion solicitada por Uriel Jareth Consulting en tiempo y forma.",
        "Si la falta de informacion provoca un excedente en los plazos de entrega del proyecto, las horas adicionales de servicio se cotizaran por separado.",
        "Los pagos correspondientes a los servicios mensuales deberan realizarse en los primeros 5 dias del mes.",
        "Todo el material e informacion necesarios para la realizacion del sitio web deberan ser entregados en un plazo maximo de 40 dias naturales a partir del arranque del proyecto.",
    ], y)

    y = _draw_bullets("Que no incluye el proyecto?", [
        "Generacion de disenos, videos, traducciones, cambios de divisas y unidades, o cualquier servicio externo a lo cotizado.",
        "Redaccion de entradas de Blog.",
        "Integracion de Servicios de terceros ajenos a los cotizados.",
        "Servicio de Recuperacion de Accesos de: Google Analytics, Google Tag Manager, Google Search Console, Google Ads, y Meta Ads.",
        "Creacion de Redes Sociales (En caso de requerir el servicio incluira un costo adicional).",
    ], y)

    y = _draw_bullets("Notas", [
        "El presente proyecto debera tener un responsable oficial.",
        "La Hora Centinela tiene un precio de $700.00 MXN.",
        "Los archivos editables/fuente (AI, PSD) son propiedad intelectual de la agencia. Si requiere los archivos editables, estos pueden ser adquiridos abonando una tarifa de liberacion (buy-out fee).",
        "Si el proyecto se pausa por razones ajenas a Uriel Jareth Consulting, esto generara costo extra del 15% al 30% para retomar el proyecto.",
    ], y)

    y -= 8
    c.setFillColor(primary_rgb)
    c.rect(MARGIN_LEFT, y - 9, 3, 9, fill=1, stroke=0)
    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(dark_rgb)
    c.drawString(MARGIN_LEFT + 10, y - 8, "Datos Bancarios")
    y -= 20

    razon_social = cfg_bancaria.get("razon_social", "URIEL JARETH ALVARADO ORTIZ")
    rfc = cfg_bancaria.get("rfc", "AAOU970201SU7")
    clabe_nac = cfg_bancaria.get("clabe_interbancaria", cfg_bancaria.get("cuenta_nacional", ""))
    cuenta_nac = cfg_bancaria.get("cuenta_nacional", "")
    banco_nac = "BBVA" if cuenta_nac else ""

    box_h = 48
    c.setFillColor(light_rgb)
    c.setStrokeColor(border_rgb)
    c.rect(MARGIN_LEFT, y - box_h, CONTENT_W, box_h, fill=1, stroke=1)
    c.setFont("Helvetica-Bold", 7)
    c.setFillColor(dark_rgb)
    c.drawString(MARGIN_LEFT + 8, y - 12, "Transferencia Nacional")
    c.setFont("Helvetica", 6.5)
    if cuenta_nac:
        c.drawString(MARGIN_LEFT + 8, y - 24, f"Cuenta: {cuenta_nac}")
    if clabe_nac:
        c.drawString(MARGIN_LEFT + CONTENT_W * 0.45, y - 24, f"CLABE: {clabe_nac}")
    c.drawString(MARGIN_LEFT + 8, y - 35, f"Razon Social: {razon_social}")
    c.drawString(MARGIN_LEFT + CONTENT_W * 0.45, y - 35, f"RFC: {rfc}")
    if banco_nac:
        c.drawString(MARGIN_LEFT + 8, y - 46, f"Banco: {banco_nac}")
    y -= box_h + 8

    c.setFillColor(light_rgb)
    c.rect(MARGIN_LEFT, y - box_h, CONTENT_W, box_h, fill=1, stroke=1)
    c.setFont("Helvetica-Bold", 7)
    c.setFillColor(dark_rgb)
    c.drawString(MARGIN_LEFT + 8, y - 12, "Transferencia Internacional")
    c.setFont("Helvetica", 6.5)
    c.drawString(MARGIN_LEFT + 8, y - 24, f"Beneficiario: {razon_social}")
    c.drawString(MARGIN_LEFT + 8, y - 35, "Banco: BBVA Mexico")
    c.drawString(MARGIN_LEFT + CONTENT_W * 0.45, y - 35, "SWIFT: BCMRMXMMPYM")

    # ── FOOTER ON ALL PAGES ──────────────────────
    page_count = c.getPageNumber()
    for i in range(1, page_count + 1):
        c.setPageSize(LETTER)
        c.setFont("Helvetica", 6)
        c.setFillColor(muted_rgb)
        c.setStrokeColor(border_rgb)
        c.setLineWidth(0.5)
        c.line(MARGIN_LEFT, MARGIN_BOTTOM - 10, MARGIN_LEFT + CONTENT_W, MARGIN_BOTTOM - 10)
        c.drawCentredString(PAGE_W / 2, MARGIN_BOTTOM - 22, "Uriel Jareth Consulting")
        c.drawCentredString(PAGE_W / 2, MARGIN_BOTTOM - 32, "urieljareth.com  |  contacto@urieljareth.com  |  (445) 182 9943")

    c.save()
    return buf.getvalue()
