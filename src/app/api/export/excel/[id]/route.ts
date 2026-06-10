import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import ExcelJS from "exceljs";
import { getConfigBranding, getConfigBancaria } from "@/lib/config-helpers";
import { sanitizeFilename } from "@/lib/calculators";

function hexToArgb(hex: string): string {
  const h = hex.replace("#", "");
  return "FF" + h.toUpperCase();
}

function applyThinBorder(cell: ExcelJS.Cell, color?: string) {
  const bc: Partial<ExcelJS.Border> = { style: "thin", color: { argb: color || "FFD1D5DB" } };
  cell.border = { top: bc, left: bc, bottom: bc, right: bc };
}

function fillRow(ws: ExcelJS.Worksheet, row: number, startCol: string, endCol: string, argb: string) {
  for (let c = ws.getColumn(startCol).number; c <= ws.getColumn(endCol).number; c++) {
    ws.getCell(row, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const cot = await prisma.cotizacion.findUnique({
      where: { id },
      include: {
        cliente: true,
        asesor: true,
        servicios: { include: { servicioCatalogo: true } },
        planBucefalo: true,
      },
    });

    if (!cot) {
      return NextResponse.json({ error: "Cotizacion no encontrada" }, { status: 404 });
    }

    const empresa = cot.cliente.empresa || cot.cliente.nombre;
    const branding = await getConfigBranding();
    const bancaria = await getConfigBancaria();
    const configColor = branding.colorPrimario || "#2563eb";
    const PRIMARY = hexToArgb(configColor);
    const PRIMARY_LIGHT = hexToArgb(configColor + "18");
    const SECONDARY = hexToArgb(branding.colorSecundario || "#1e293b");
    const WHITE = "FFFFFFFF";
    const LIGHT_BG = "FFF8FAFC";
    const MUTED = "FF64748B";
    const BORDER_COLOR = "FFE2E8F0";

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Cotizador E3";
    workbook.created = new Date();

    const headerFont: Partial<ExcelJS.Font> = { bold: true, size: 10, name: "Calibri", color: { argb: WHITE } };
    const labelFont: Partial<ExcelJS.Font> = { bold: true, size: 10, name: "Calibri", color: { argb: MUTED } };
    const valueFont: Partial<ExcelJS.Font> = { size: 10, name: "Calibri" };
    const boldFont: Partial<ExcelJS.Font> = { bold: true, size: 10, name: "Calibri" };
    const totalFont: Partial<ExcelJS.Font> = { bold: true, size: 11, name: "Calibri" };
    const smallFont: Partial<ExcelJS.Font> = { italic: true, size: 9, name: "Calibri", color: { argb: MUTED } };
    const faseFont: Partial<ExcelJS.Font> = { bold: true, size: 11, name: "Calibri", color: { argb: PRIMARY } };

    const ws = workbook.addWorksheet("HOJA RESUMEN");
    ws.columns = [
      { width: 3 },
      { width: 22 }, { width: 22 }, { width: 16 },
      { width: 38 }, { width: 5 },
      { width: 20 }, { width: 5 },
      { width: 20 }, { width: 5 },
      { width: 18 },
    ];
    ws.views = [{ showGridLines: false }];

    // ── HEADER BANNER ──
    ws.mergeCells("B2:K2");
    ws.getCell("B2").value = bancaria.razon_social || "Cotizador E3";
    ws.getCell("B2").font = { bold: true, size: 16, name: "Calibri", color: { argb: WHITE } };
    ws.getCell("B2").alignment = { vertical: "middle" };
    fillRow(ws, 2, "A", "K", PRIMARY);

    ws.mergeCells("B3:K3");
    ws.getCell("B3").value = cot.numero;
    ws.getCell("B3").font = { bold: true, size: 11, name: "Calibri", color: { argb: WHITE } };
    ws.getCell("B3").alignment = { vertical: "middle" };
    fillRow(ws, 3, "A", "K", SECONDARY);

    // ── CLIENTE / PROYECTO ──
    const infoStart = 5;
    const infoLabels: [string, string, string, string][] = [
      ["B", "En atencion a:", "C", cot.cliente.nombre],
      ["E", "Empresa:", "F", cot.cliente.empresa || "—"],
      ["B", "Proyecto:", "C", cot.proyecto],
      ["E", "Moneda:", "F", cot.moneda],
      ["B", "Asesor:", "C", cot.asesor.name],
      ["E", "Tipo de Cambio:", "F", cot.tipoCambio],
      ["B", "Fecha:", "C", ""],
      ["E", "Esquema de Pago:", "F", cot.esquemaPago],
    ];

    for (let i = 0; i < infoLabels.length; i += 2) {
      const r = infoStart + (i / 2);
      const [lc1, lv1, vc1, vv1] = infoLabels[i];
      const [lc2, lv2, vc2, vv2] = infoLabels[i + 1];

      ws.getCell(`${lc1}${r}`).value = lv1;
      ws.getCell(`${lc1}${r}`).font = labelFont;
      ws.getCell(`${vc1}${r}`).value = vv1;
      ws.getCell(`${vc1}${r}`).font = valueFont;

      ws.getCell(`${lc2}${r}`).value = lv2;
      ws.getCell(`${lc2}${r}`).font = labelFont;
      ws.getCell(`${vc2}${r}`).value = vv2;
      ws.getCell(`${vc2}${r}`).font = valueFont;
    }

    const fechaCell = ws.getCell(`C${infoStart + 6}`);
    fechaCell.value = cot.fecha;
    fechaCell.numFmt = "DD/MM/YYYY";
    fechaCell.font = valueFont;

    const vigenciaCell = ws.getCell(`C${infoStart + 7}`);
    ws.getCell(`B${infoStart + 7}`).value = "Vigencia:";
    ws.getCell(`B${infoStart + 7}`).font = labelFont;
    vigenciaCell.value = cot.vigencia;
    vigenciaCell.numFmt = "DD/MM/YYYY";
    vigenciaCell.font = valueFont;

    // ── TABLA SERVICIOS ──
    const tableStart = infoStart + 9;
    const cols = ["B", "C", "D", "E", "K"];
    const headers = ["Fase", "Tipo de Pago", "Servicio", "", "Precio"];

    ws.mergeCells(`D${tableStart}:J${tableStart}`);
    for (let i = 0; i < cols.length; i++) {
      const cell = ws.getCell(`${cols[i]}${tableStart}`);
      cell.value = headers[i];
      cell.font = headerFont;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PRIMARY } };
      cell.alignment = { horizontal: i === cols.length - 1 ? "right" : "left", vertical: "middle" };
      applyThinBorder(cell, PRIMARY);
    }
    ws.getRow(tableStart).height = 24;

    const fases: Record<number, string> = { 0: "FASE 0", 1: "FASE 1", 2: "FASE 2", 3: "FASE 3" };
    const serviciosUnicos = cot.servicios.filter(s => s.tipoPago === "unico" && s.seleccionado);
    const serviciosMensuales = cot.servicios.filter(s => s.tipoPago === "mensual" && s.seleccionado);

    let row = tableStart + 1;
    let currentFase = -1;

    for (const serv of [...serviciosUnicos, ...serviciosMensuales]) {
      if (serv.fase !== currentFase) {
        currentFase = serv.fase;
        ws.mergeCells(`B${row}:K${row}`);
        ws.getCell(`B${row}`).value = fases[serv.fase] || `FASE ${serv.fase}`;
        ws.getCell(`B${row}`).font = faseFont;
        fillRow(ws, row, "B", "K", PRIMARY_LIGHT);
        row++;
      }

      const isAlt = row % 2 === 0;
      const rowBg = isAlt ? LIGHT_BG : WHITE;

      ws.getCell(`B${row}`).value = "";
      ws.getCell(`C${row}`).value = serv.tipoPago === "unico" ? "Unico" : "Mensual";
      ws.getCell(`C${row}`).font = valueFont;
      ws.mergeCells(`D${row}:J${row}`);
      ws.getCell(`D${row}`).value = serv.servicioCatalogo?.nombre || "Servicio";
      ws.getCell(`D${row}`).font = valueFont;
      ws.getCell(`K${row}`).value = serv.precio;
      ws.getCell(`K${row}`).numFmt = '$#,##0.00';
      ws.getCell(`K${row}`).font = valueFont;
      ws.getCell(`K${row}`).alignment = { horizontal: "right" };

      for (const c of cols) {
        ws.getCell(`${c}${row}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowBg } };
        applyThinBorder(ws.getCell(`${c}${row}`), BORDER_COLOR);
      }
      row++;
    }

    // ── TOTALES ──
    row++;
    const totalUnico = serviciosUnicos.reduce((s, x) => s + x.precio, 0);
    ws.mergeCells(`B${row}:J${row}`);
    ws.getCell(`B${row}`).value = "Total Pago Unico";
    ws.getCell(`B${row}`).font = totalFont;
    ws.getCell(`K${row}`).value = totalUnico;
    ws.getCell(`K${row}`).numFmt = '$#,##0.00';
    ws.getCell(`K${row}`).font = totalFont;
    ws.getCell(`K${row}`).alignment = { horizontal: "right" };
    for (const c of cols) {
      applyThinBorder(ws.getCell(`${c}${row}`), PRIMARY);
      ws.getCell(`${c}${row}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: PRIMARY_LIGHT } };
    }
    row++;
    ws.mergeCells(`B${row}:J${row}`);
    ws.getCell(`B${row}`).value = "(+ IVA)";
    ws.getCell(`B${row}`).font = { ...smallFont, italic: false };
    row++;

    const totalMensual = serviciosMensuales.reduce((s, x) => s + x.precio, 0);
    ws.mergeCells(`B${row}:J${row}`);
    ws.getCell(`B${row}`).value = "Total Pago Mensual";
    ws.getCell(`B${row}`).font = totalFont;
    ws.getCell(`K${row}`).value = totalMensual;
    ws.getCell(`K${row}`).numFmt = '$#,##0.00';
    ws.getCell(`K${row}`).font = totalFont;
    ws.getCell(`K${row}`).alignment = { horizontal: "right" };
    for (const c of cols) {
      applyThinBorder(ws.getCell(`${c}${row}`), PRIMARY);
      ws.getCell(`${c}${row}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: PRIMARY_LIGHT } };
    }
    row++;
    ws.mergeCells(`B${row}:J${row}`);
    ws.getCell(`B${row}`).value = "(+ IVA)";
    ws.getCell(`B${row}`).font = { ...smallFont, italic: false };
    row += 2;

    if (cot.planBucefalo) {
      ws.mergeCells(`B${row}:J${row}`);
      ws.getCell(`B${row}`).value = `CRM Bucefalo - ${cot.planBucefalo.nivel.charAt(0).toUpperCase() + cot.planBucefalo.nivel.slice(1)}`;
      ws.getCell(`B${row}`).font = boldFont;
      ws.getCell(`K${row}`).value = cot.planBucefalo.precio;
      ws.getCell(`K${row}`).numFmt = '$#,##0.00';
      ws.getCell(`K${row}`).font = boldFont;
      ws.getCell(`K${row}`).alignment = { horizontal: "right" };
      for (const c of cols) {
        applyThinBorder(ws.getCell(`${c}${row}`), PRIMARY);
        ws.getCell(`${c}${row}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: PRIMARY_LIGHT } };
      }
      row += 2;
    }

    // ── NOTA AL PIE ──
    ws.mergeCells(`B${row}:K${row}`);
    ws.getCell(`B${row}`).value = "Todos los precios son en Moneda Nacional (MX), los precios no incluyen IVA. Vigencia de 15 dias habiles.";
    ws.getCell(`B${row}`).font = smallFont;

    // ── HOJAS DETALLADAS POR SERVICIO ──
    for (const serv of cot.servicios.filter(s => s.seleccionado)) {
      const nombre = serv.servicioCatalogo?.nombre || "Servicio";
      const safeName = nombre.substring(0, 31).replace(/[/\\*?[\]:]/g, "");
      const dw = workbook.addWorksheet(safeName);
      dw.columns = [
        { width: 3 },
        { width: 35 }, { width: 5 }, { width: 15 },
        { width: 5 },
        { width: 35 }, { width: 5 }, { width: 15 },
        { width: 5 }, { width: 18 },
      ];
      dw.views = [{ showGridLines: false }];

      // Banner
      dw.mergeCells("B1:J1");
      dw.getCell("B1").value = `${fases[serv.fase] || "FASE " + serv.fase} — ${nombre}`;
      dw.getCell("B1").font = { bold: true, size: 14, name: "Calibri", color: { argb: WHITE } };
      dw.getCell("B1").alignment = { vertical: "middle" };
      fillRow(dw, 1, "A", "J", PRIMARY);
      dw.getRow(1).height = 30;

      // Info
      let r = 3;
      dw.getCell(`B${r}`).value = "Cliente:";
      dw.getCell(`B${r}`).font = labelFont;
      dw.getCell(`C${r}`).value = cot.cliente.empresa || cot.cliente.nombre;
      dw.getCell(`C${r}`).font = boldFont;
      dw.getCell(`F${r}`).value = "No. Cotizacion:";
      dw.getCell(`F${r}`).font = labelFont;
      dw.getCell(`G${r}`).value = cot.numero;
      dw.getCell(`G${r}`).font = boldFont;
      r += 2;

      // Servicio header
      dw.getCell(`B${r}`).value = "Servicio:";
      dw.getCell(`B${r}`).font = labelFont;
      dw.getCell(`C${r}`).value = nombre;
      dw.getCell(`C${r}`).font = { ...boldFont, size: 12, color: { argb: PRIMARY } };
      dw.getCell(`F${r}`).value = "Tiempo de Entrega:";
      dw.getCell(`F${r}`).font = labelFont;
      dw.getCell(`G${r}`).value = serv.tiempoEntrega;
      dw.getCell(`G${r}`).font = valueFont;
      r += 2;

      // Tabla entregables
      const tableCols = ["B", "C"];
      const thCols = ["B", "I"];
      for (const c of thCols) {
        dw.getCell(`${c}${r}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: PRIMARY } };
        dw.getCell(`${c}${r}`).font = headerFont;
        dw.getCell(`${c}${r}`).border = { bottom: { style: "thin", color: { argb: PRIMARY } } };
      }
      dw.getCell(`B${r}`).value = "Entregable";
      dw.getCell(`I${r}`).value = "";
      r++;

      const entregables = Array.isArray(serv.entregables) ? serv.entregables as string[] : [];
      for (let i = 0; i < entregables.length; i++) {
        const isAlt = i % 2 === 1;
        dw.getCell(`B${i + r}`).value = `${i + 1}. ${entregables[i]}`;
        dw.getCell(`B${i + r}`).font = valueFont;
        const bg = isAlt ? LIGHT_BG : WHITE;
        for (const c of tableCols) {
          dw.getCell(`${c}${i + r}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        }
        applyThinBorder(dw.getCell(`B${i + r}`), BORDER_COLOR);
      }
      r += entregables.length + 1;

      // Precio
      for (const c of ["B", "I"]) {
        dw.getCell(`${c}${r}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: PRIMARY_LIGHT } };
        applyThinBorder(dw.getCell(`${c}${r}`), PRIMARY);
      }
      dw.getCell(`B${r}`).value = `Total Pago ${serv.tipoPago === "unico" ? "Unico" : "Mensual"}`;
      dw.getCell(`B${r}`).font = totalFont;
      dw.getCell(`I${r}`).value = serv.precio;
      dw.getCell(`I${r}`).numFmt = '$#,##0.00';
      dw.getCell(`I${r}`).font = totalFont;
      dw.getCell(`I${r}`).alignment = { horizontal: "right" };
      r++;
      dw.getCell(`B${r}`).value = "(+ IVA)";
      dw.getCell(`B${r}`).font = { ...smallFont, italic: false };
      r += 2;

      // Footer
      dw.mergeCells(`B${r}:J${r}`);
      dw.getCell(`B${r}`).value = "Esta cotizacion tiene una vigencia de 15 dias habiles. Todos los precios en MXN, precios + IVA.";
      dw.getCell(`B${r}`).font = smallFont;
      r += 2;

      dw.getCell(`B${r}`).value = bancaria.razon_social || "Cotizador E3";
      dw.getCell(`B${r}`).font = { ...boldFont, color: { argb: PRIMARY } };
      if (bancaria.domicilio_fiscal) {
        r++;
        dw.mergeCells(`B${r}:J${r}`);
        dw.getCell(`B${r}`).value = bancaria.domicilio_fiscal;
        dw.getCell(`B${r}`).font = { ...smallFont, italic: false };
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${sanitizeFilename(empresa)} - ${sanitizeFilename(cot.cliente.nombre)} - ${cot.numero}.xlsx"`,
      },
    });
  } catch (error: unknown) {
    console.error("Error exporting Excel:", error);
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
