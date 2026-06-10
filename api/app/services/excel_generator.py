"""Excel Generator for Cotizador E3 — port of export/excel/route.ts using openpyxl."""

from __future__ import annotations

import io
import re
from datetime import datetime
from typing import Any

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

from app.services.calculators import FASES_SHORT, bucefalo_precio

FASES_MAP = {0: "FASE 0", 1: "FASE 1", 2: "FASE 2", 3: "FASE 3"}


def _hex_to_fill(hex_color: str) -> PatternFill:
    h = hex_color.lstrip("#")
    return PatternFill(start_color=f"FF{h.upper()}", end_color=f"FF{h.upper()}", fill_type="solid")


def _argb(hex_color: str, alpha: str = "FF") -> str:
    h = hex_color.lstrip("#")
    if len(h) > 6:
        h = h[:6]
    return f"{alpha}{h.upper()}"


def _thin_border(color: str = "FFD1D5DB") -> Border:
    side = Side(style="thin", color=color)
    return Border(top=side, left=side, bottom=side, right=side)


def _sanitize_sheet_name(name: str) -> str:
    name = name[:31]
    return re.sub(r"[/\\*?\[\]:]", "", name)


def _set_col_widths(ws, widths: list[tuple[str, float]]):
    for col_letter, width in widths:
        ws.column_dimensions[col_letter].width = width


def generate_cotizacion_excel(data: dict[str, Any], saved: bool = False) -> bytes:
    """Generate a multi-sheet Excel workbook for a quotation.

    Args:
        data: dict with quotation data (same as PDF generator)
        saved: if True, uses real quotation number instead of "BORRADOR"
    """
    config_color = data.get("colorPrimario", "#2563eb")
    PRIMARY = _argb(config_color)
    PRIMARY_LIGHT = _argb(config_color, alpha="18")
    SECONDARY = _argb(data.get("colorSecundario", "#1e293b"))
    WHITE = "FFFFFFFF"
    LIGHT_BG = "FFF8FAFC"
    MUTED = "FF64748B"
    BORDER_COLOR = "FFE2E8F0"

    header_font = Font(bold=True, size=10, name="Calibri", color=WHITE)
    label_font = Font(bold=True, size=10, name="Calibri", color=MUTED)
    value_font = Font(size=10, name="Calibri")
    bold_font = Font(bold=True, size=10, name="Calibri")
    total_font = Font(bold=True, size=11, name="Calibri")
    small_font = Font(italic=True, size=9, name="Calibri", color=MUTED)
    fase_font = Font(bold=True, size=11, name="Calibri", color=PRIMARY)

    primary_fill = PatternFill(start_color=PRIMARY, end_color=PRIMARY, fill_type="solid")
    primary_light_fill = PatternFill(start_color=PRIMARY_LIGHT, end_color=PRIMARY_LIGHT, fill_type="solid")
    secondary_fill = PatternFill(start_color=SECONDARY, end_color=SECONDARY, fill_type="solid")
    light_fill = PatternFill(start_color=LIGHT_BG, end_color=LIGHT_BG, fill_type="solid")
    white_fill = PatternFill(start_color=WHITE, end_color=WHITE, fill_type="solid")

    razon_social = data.get("razonSocial", "Cotizador E3")
    cliente_nombre = data.get("clienteNombre", "")
    cliente_empresa = data.get("clienteEmpresa", "")
    asesor_nombre = data.get("asesorNombre", "")
    fecha = data.get("fecha", datetime.now())
    vigencia = data.get("vigencia", datetime.now())
    moneda = data.get("moneda", "MXN")
    tipo_cambio = data.get("tipoCambio", "NA")
    proyecto = data.get("proyecto", "MKT Digital")
    esquema = data.get("esquemaPago", "Pago Unico/Mensual")
    servicios = data.get("servicios", [])
    plan_nivel = data.get("planBucefaloNivel")
    numero_label = data.get("numero", "BORRADOR") if saved else "BORRADOR"
    empresa = cliente_empresa or cliente_nombre

    wb = Workbook()
    wb.properties.creator = "Cotizador E3"

    # ── HOJA RESUMEN ──────────────────────────────
    ws = wb.active
    ws.title = "HOJA RESUMEN"
    ws.sheet_view.showGridLines = False

    _set_col_widths(ws, [
        ("A", 3), ("B", 22), ("C", 22), ("D", 16),
        ("E", 38), ("F", 5), ("G", 20), ("H", 5),
        ("I", 20), ("J", 5), ("K", 18),
    ])

    # Header banner
    ws.merge_cells("B2:K2")
    cell = ws["B2"]
    cell.value = razon_social
    cell.font = Font(bold=True, size=16, name="Calibri", color=WHITE)
    cell.alignment = Alignment(vertical="center")
    for col in range(1, 12):
        ws.cell(row=2, column=col).fill = primary_fill

    ws.merge_cells("B3:K3")
    cell = ws["B3"]
    cell.value = numero_label
    cell.font = Font(bold=True, size=11, name="Calibri", color=WHITE)
    cell.alignment = Alignment(vertical="center")
    for col in range(1, 12):
        ws.cell(row=3, column=col).fill = secondary_fill

    # Info section
    info_start = 5
    info_rows = [
        [("B", "En atencion a:"), ("C", cliente_nombre), ("E", "Empresa:"), ("F", cliente_empresa or "\u2014")],
        [("B", "Proyecto:"), ("C", proyecto), ("E", "Moneda:"), ("F", moneda)],
        [("B", "Asesor:"), ("C", asesor_nombre), ("E", "Tipo de Cambio:"), ("F", tipo_cambio)],
        [("B", "Fecha:"), ("C", fecha), ("E", "Esquema de Pago:"), ("F", esquema)],
    ]

    for i, row_data in enumerate(info_rows):
        r = info_start + i
        for col_letter, label, is_value in [
            (row_data[0][0], row_data[0][1], False),
            (row_data[1][0], row_data[1][1], True),
            (row_data[2][0], row_data[2][1], False),
            (row_data[3][0], row_data[3][1], True),
        ]:
            cell = ws[f"{col_letter}{r}"]
            cell.value = label
            cell.font = value_font if is_value else label_font

    # Vigencia
    vigencia_row = info_start + 4
    ws[f"B{vigencia_row}"].value = "Vigencia:"
    ws[f"B{vigencia_row}"].font = label_font
    ws[f"C{vigencia_row}"].value = vigencia
    ws[f"C{vigencia_row}"].number_format = "DD/MM/YYYY"
    ws[f"C{vigencia_row}"].font = value_font

    # Services table
    table_start = info_start + 6
    cols = ["B", "C", "D", "K"]
    headers = ["Fase", "Tipo de Pago", "Servicio", "Precio"]

    ws.merge_cells(f"D{table_start}:J{table_start}")
    for i, col_letter in enumerate(cols):
        cell = ws[f"{col_letter}{table_start}"]
        cell.value = headers[i]
        cell.font = header_font
        cell.fill = primary_fill
        cell.alignment = Alignment(
            horizontal="right" if i == len(cols) - 1 else "left",
            vertical="center",
        )
        cell.border = _thin_border(PRIMARY)
    ws.row_dimensions[table_start].height = 24

    servicios_unicos = [s for s in servicios if s.get("tipoPago") == "unico"]
    servicios_mensuales = [s for s in servicios if s.get("tipoPago") == "mensual"]

    row = table_start + 1
    current_fase = -1

    for serv in servicios_unicos + servicios_mensuales:
        fase = serv.get("fase", 0)
        if fase != current_fase:
            current_fase = fase
            ws.merge_cells(f"B{row}:K{row}")
            ws[f"B{row}"].value = FASES_MAP.get(fase, f"FASE {fase}")
            ws[f"B{row}"].font = fase_font
            for col in range(2, 12):
                ws.cell(row=row, column=col).fill = primary_light_fill
            row += 1

        row_bg = light_fill if row % 2 == 0 else white_fill

        ws[f"B{row}"].value = ""
        ws[f"C{row}"].value = "Unico" if serv.get("tipoPago") == "unico" else "Mensual"
        ws[f"C{row}"].font = value_font
        ws.merge_cells(f"D{row}:J{row}")
        ws[f"D{row}"].value = serv.get("nombre", "")
        ws[f"D{row}"].font = value_font
        ws[f"K{row}"].value = serv.get("precio", 0)
        ws[f"K{row}"].number_format = "$#,##0.00"
        ws[f"K{row}"].font = value_font
        ws[f"K{row}"].alignment = Alignment(horizontal="right")

        for col_letter in cols:
            ws[f"{col_letter}{row}"].fill = row_bg
            ws[f"{col_letter}{row}"].border = _thin_border(BORDER_COLOR)
        row += 1

    row += 1
    total_unico = sum(s.get("precio", 0) for s in servicios_unicos)
    ws.merge_cells(f"B{row}:J{row}")
    ws[f"B{row}"].value = "Total Pago Unico"
    ws[f"B{row}"].font = total_font
    ws[f"K{row}"].value = total_unico
    ws[f"K{row}"].number_format = "$#,##0.00"
    ws[f"K{row}"].font = total_font
    ws[f"K{row}"].alignment = Alignment(horizontal="right")
    for col_letter in cols:
        ws[f"{col_letter}{row}"].border = _thin_border(PRIMARY)
        ws[f"{col_letter}{row}"].fill = primary_light_fill
    row += 1
    ws.merge_cells(f"B{row}:J{row}")
    ws[f"B{row}"].value = "(+ IVA)"
    ws[f"B{row}"].font = Font(italic=False, size=9, name="Calibri", color=MUTED)
    row += 1

    total_mensual = sum(s.get("precio", 0) for s in servicios_mensuales)
    ws.merge_cells(f"B{row}:J{row}")
    ws[f"B{row}"].value = "Total Pago Mensual"
    ws[f"B{row}"].font = total_font
    ws[f"K{row}"].value = total_mensual
    ws[f"K{row}"].number_format = "$#,##0.00"
    ws[f"K{row}"].font = total_font
    ws[f"K{row}"].alignment = Alignment(horizontal="right")
    for col_letter in cols:
        ws[f"{col_letter}{row}"].border = _thin_border(PRIMARY)
        ws[f"{col_letter}{row}"].fill = primary_light_fill
    row += 1
    ws.merge_cells(f"B{row}:J{row}")
    ws[f"B{row}"].value = "(+ IVA)"
    ws[f"B{row}"].font = Font(italic=False, size=9, name="Calibri", color=MUTED)
    row += 2

    if plan_nivel:
        ws.merge_cells(f"B{row}:J{row}")
        ws[f"B{row}"].value = f"CRM Bucefalo - {plan_nivel.capitalize()}"
        ws[f"B{row}"].font = bold_font
        ws[f"K{row}"].value = bucefalo_precio(plan_nivel)
        ws[f"K{row}"].number_format = "$#,##0.00"
        ws[f"K{row}"].font = bold_font
        ws[f"K{row}"].alignment = Alignment(horizontal="right")
        for col_letter in cols:
            ws[f"{col_letter}{row}"].border = _thin_border(PRIMARY)
            ws[f"{col_letter}{row}"].fill = primary_light_fill
        row += 2

    ws.merge_cells(f"B{row}:K{row}")
    ws[f"B{row}"].value = "Todos los precios son en Moneda Nacional (MX), los precios no incluyen IVA. Vigencia de 15 dias habiles."
    ws[f"B{row}"].font = small_font

    # ── DETAIL SHEETS ──────────────────────────────
    for serv in servicios:
        safe_name = _sanitize_sheet_name(serv.get("nombre", "Servicio"))
        dw = wb.create_sheet(title=safe_name)
        dw.sheet_view.showGridLines = False

        _set_col_widths(dw, [
            ("A", 3), ("B", 35), ("C", 5), ("D", 15), ("E", 5),
            ("F", 35), ("G", 5), ("H", 15), ("I", 5), ("J", 18),
        ])

        fase = serv.get("fase", 0)
        dw.merge_cells("B1:J1")
        dw["B1"].value = f"{FASES_MAP.get(fase, f'FASE {fase}')} \u2014 {serv.get('nombre', '')}"
        dw["B1"].font = Font(bold=True, size=14, name="Calibri", color=WHITE)
        dw["B1"].alignment = Alignment(vertical="center")
        for col in range(1, 11):
            dw.cell(row=1, column=col).fill = primary_fill
        dw.row_dimensions[1].height = 30

        r = 3
        dw[f"B{r}"].value = "Cliente:"
        dw[f"B{r}"].font = label_font
        dw[f"C{r}"].value = cliente_empresa or cliente_nombre
        dw[f"C{r}"].font = bold_font
        dw[f"F{r}"].value = "No. Cotizacion:"
        dw[f"F{r}"].font = label_font
        dw[f"G{r}"].value = numero_label
        dw[f"G{r}"].font = bold_font
        r += 2

        dw[f"B{r}"].value = "Servicio:"
        dw[f"B{r}"].font = label_font
        dw[f"C{r}"].value = serv.get("nombre", "")
        dw[f"C{r}"].font = Font(bold=True, size=12, name="Calibri", color=PRIMARY)
        dw[f"F{r}"].value = "Tiempo de Entrega:"
        dw[f"F{r}"].font = label_font
        dw[f"G{r}"].value = serv.get("tiempoEntrega", "")
        dw[f"G{r}"].font = value_font
        r += 2

        # Entregables header
        for col_letter in ["B", "I"]:
            dw[f"{col_letter}{r}"].fill = primary_fill
            dw[f"{col_letter}{r}"].font = header_font
        dw[f"B{r}"].value = "Entregable"
        r += 1

        entregables = serv.get("entregables", [])
        for i, ent in enumerate(entregables):
            bg = light_fill if i % 2 == 1 else white_fill
            dw[f"B{i + r}"].value = f"{i + 1}. {ent}"
            dw[f"B{i + r}"].font = value_font
            dw[f"B{i + r}"].fill = bg
            dw[f"B{i + r}"].border = _thin_border(BORDER_COLOR)
        r += len(entregables) + 1

        # Total
        for col_letter in ["B", "I"]:
            dw[f"{col_letter}{r}"].fill = primary_light_fill
            dw[f"{col_letter}{r}"].border = _thin_border(PRIMARY)
        tipo_label = "Unico" if serv.get("tipoPago") == "unico" else "Mensual"
        dw[f"B{r}"].value = f"Total Pago {tipo_label}"
        dw[f"B{r}"].font = total_font
        dw[f"I{r}"].value = serv.get("precio", 0)
        dw[f"I{r}"].number_format = "$#,##0.00"
        dw[f"I{r}"].font = total_font
        dw[f"I{r}"].alignment = Alignment(horizontal="right")
        r += 1
        dw[f"B{r}"].value = "(+ IVA)"
        dw[f"B{r}"].font = Font(italic=False, size=9, name="Calibri", color=MUTED)
        r += 2

        dw.merge_cells(f"B{r}:J{r}")
        dw[f"B{r}"].value = "Esta cotizacion tiene una vigencia de 15 dias habiles. Todos los precios en MXN, precios + IVA."
        dw[f"B{r}"].font = small_font
        r += 2

        dw[f"B{r}"].value = razon_social
        dw[f"B{r}"].font = Font(bold=True, size=10, name="Calibri", color=PRIMARY)

    output = io.BytesIO()
    wb.save(output)
    return output.getvalue()
