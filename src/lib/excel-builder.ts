import ExcelJS from "exceljs";
import {
  formatCurrency,
  calcularTotalesOpcion,
  bucefaloPrecio,
  detalleModelo,
  precioDisplay,
  type MetaOpcion,
} from "./calculators";
import { logoToPngBuffer } from "./logo";

export interface ExcelServicio {
  nombre: string;
  fase: number;
  tipoPago: string;
  precio: number;
  tiempoEntrega: string;
  entregables: string[];
  beneficios?: string[];
  modeloCobro?: string | null;
  esPersonalizado?: boolean | null;
  horas?: number | null;
  tarifaHora?: number | null;
  montoMinimo?: number | null;
  horasIncluidas?: number | null;
  opcion?: string | null;
}

export interface ExcelData {
  razonSocial: string;
  domicilioFiscal?: string;
  numero: string;
  clienteNombre: string;
  clienteEmpresa: string;
  clienteRfc?: string;
  asesorNombre: string;
  fecha: Date;
  vigencia: Date;
  moneda: string;
  tipoCambio: string;
  proyecto: string;
  esquemaPago: string;
  servicios: ExcelServicio[];
  esDoble: boolean;
  // false = proyecto sin factura; no se muestran "+ IVA" ni totales c/IVA.
  incluirIva?: boolean;
  opcionesMetadata?: { "1"?: MetaOpcion; "2"?: MetaOpcion } | null;
  planBucefaloNivel?: string | null;
  planBucefaloPrecio?: number | null;
  colorPrimario?: string;
  colorSecundario?: string;
  logoBase64?: string;
  logoMime?: string;
}

type VAlign = "top" | "middle" | "bottom";
type HAlign = "left" | "center" | "right";

// Convierte "#RRGGBB" a ARGB de 8 caracteres. `alpha` es el canal alfa (2 hex):
// "FF" = opaco, "18" = ~9% (tinte claro). Espejo de _argb() en el generador Python.
function argb(hex: string, alpha = "FF"): string {
  let h = hex.replace("#", "");
  if (h.length > 6) h = h.slice(0, 6);
  return alpha + h.toUpperCase();
}

function applyThinBorder(cell: ExcelJS.Cell, color?: string): void {
  const bc = { style: "thin" as const, color: { argb: color || "FFD1D5DB" } };
  cell.border = { top: bc, left: bc, bottom: bc, right: bc };
}

function fillRow(ws: ExcelJS.Worksheet, row: number, startCol: string, endCol: string, argbColor: string): void {
  for (let c = ws.getColumn(startCol).number; c <= ws.getColumn(endCol).number; c++) {
    ws.getCell(row, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: argbColor } };
  }
}

// Suma de anchos (en unidades de caracter de Excel) de las columnas entre dos letras, inclusive.
// Sirve para saber cuantos caracteres caben en una celda combinada y asi calcular su altura.
function mergedWidth(ws: ExcelJS.Worksheet, startCol: string, endCol: string): number {
  let total = 0;
  const start = ws.getColumn(startCol).number;
  const end = ws.getColumn(endCol).number;
  for (let c = start; c <= end; c++) total += Number(ws.getColumn(c).width ?? 8);
  return total;
}

// Estima la altura (pt) que necesita una fila para mostrar `text` envuelto en `widthChars`.
function estimateRowHeight(text: string, widthChars: number, fontSize = 10): number {
  const cpl = Math.max(8, Math.floor(widthChars)); // caracteres por linea (conservador)
  const lineH = fontSize <= 10 ? 14 : fontSize <= 11 ? 15.5 : fontSize <= 12 ? 17 : 20;
  let lines = 0;
  for (const seg of String(text ?? "").split("\n")) {
    lines += Math.max(1, Math.ceil(seg.length / cpl));
  }
  return Math.max(16, Math.round(lines * lineH + 4));
}

// Marca una celda como envolvente (wrapText) y agranda la fila si el texto lo requiere.
// Es la pieza que hace las celdas "dinamicas": el texto deja de salirse y la fila crece.
function setWrapped(
  ws: ExcelJS.Worksheet,
  row: number,
  col: string,
  text: string,
  widthChars: number,
  opts: { vertical?: VAlign; horizontal?: HAlign; fontSize?: number } = {}
): void {
  const cell = ws.getCell(`${col}${row}`);
  cell.alignment = {
    wrapText: true,
    vertical: opts.vertical ?? "top",
    horizontal: opts.horizontal ?? "left",
  };
  const needed = estimateRowHeight(text, widthChars, opts.fontSize ?? 10);
  const r = ws.getRow(row);
  if ((r.height ?? 0) < needed) r.height = needed;
}

export async function buildCotizacionExcel(data: ExcelData): Promise<Buffer> {
  const PRIMARY = argb(data.colorPrimario || "#2563eb");
  const PRIMARY_LIGHT = argb(data.colorPrimario || "#2563eb", "18");
  const SECONDARY = argb(data.colorSecundario || "#1e293b");
  const WHITE = "FFFFFFFF";
  const LIGHT_BG = "FFF8FAFC";
  const MUTED = "FF64748B";
  const BORDER_COLOR = "FFE2E8F0";

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Uriel Jareth Consulting";
  workbook.created = new Date();

  // Logo (cualquier formato subido se normaliza a PNG en logoToPngBuffer).
  const logoBuf = await logoToPngBuffer(data.logoBase64, data.logoMime);
  const logoImageId =
    logoBuf !== undefined
      ? workbook.addImage({ base64: logoBuf.toString("base64"), extension: "png" })
      : null;

  const headerFont = { bold: true, size: 10, name: "Calibri", color: { argb: WHITE } };
  const labelFont = { bold: true, size: 10, name: "Calibri", color: { argb: MUTED } };
  const valueFont = { size: 10, name: "Calibri" };
  const boldFont = { bold: true, size: 10, name: "Calibri" };
  const totalFont = { bold: true, size: 11, name: "Calibri" };
  const smallFont = { italic: true, size: 9, name: "Calibri", color: { argb: MUTED } };
  const faseFont = { bold: true, size: 11, name: "Calibri", color: { argb: PRIMARY } };
  const beneficioFont = { bold: true, size: 10, name: "Calibri", color: { argb: PRIMARY } };

  const fases: Record<number, string> = { 0: "FASE 0", 1: "FASE 1", 2: "FASE 2", 3: "FASE 3" };

  // ═══════════════════════════════════════════════════════════════════════════
  // HOJA RESUMEN
  // ═══════════════════════════════════════════════════════════════════════════
  const ws = workbook.addWorksheet("HOJA RESUMEN");
  ws.columns = [
    { width: 3 },
    { width: 18 },
    { width: 26 },
    { width: 13 },
    { width: 16 },
    { width: 22 },
    { width: 6 },
    { width: 6 },
    { width: 6 },
    { width: 6 },
    { width: 16 },
  ];
  ws.views = [{ showGridLines: false }];

  // ── Logo (fila 1, encima del banner) ──
  if (logoImageId !== null) {
    ws.getRow(1).height = 38;
    ws.addImage(logoImageId, { tl: { col: 1, row: 0 }, ext: { width: 130, height: 44 } });
  }

  // ── Banner ──
  ws.mergeCells("B2:K2");
  ws.getCell("B2").value = data.razonSocial;
  ws.getCell("B2").font = { bold: true, size: 16, name: "Calibri", color: { argb: WHITE } };
  ws.getCell("B2").alignment = { vertical: "middle" };
  fillRow(ws, 2, "A", "K", PRIMARY);
  ws.getRow(2).height = 28;
  ws.mergeCells("B3:K3");
  ws.getCell("B3").value = data.numero;
  ws.getCell("B3").font = { bold: true, size: 11, name: "Calibri", color: { argb: WHITE } };
  ws.getCell("B3").alignment = { vertical: "middle" };
  fillRow(ws, 3, "A", "K", SECONDARY);

  // ── Info cliente / proyecto ──
  // Cada fila: [colLabel1, label1, colVal1, valor1, colLabel2, label2, colVal2, valor2]
  const infoStart = 5;
  const infoRows: [string, string, string, string, string, string, string, string][] = [
    ["B", "En atencion a:", "C", data.clienteNombre, "E", "Empresa:", "F", data.clienteEmpresa || "—"],
    ["B", "Proyecto:", "C", data.proyecto, "E", "Moneda:", "F", data.moneda],
    ["B", "Asesor:", "C", data.asesorNombre, "E", "Tipo de Cambio:", "F", data.tipoCambio],
    ["B", "Fecha:", "C", "", "E", "Esquema de Pago:", "F", data.esquemaPago],
  ];
  const cValW = mergedWidth(ws, "C", "C");
  const fValW = mergedWidth(ws, "F", "F");
  for (let i = 0; i < infoRows.length; i++) {
    const r = infoStart + i;
    const [lc1, lv1, vc1, vv1, lc2, lv2, vc2, vv2] = infoRows[i];
    ws.getCell(`${lc1}${r}`).value = lv1;
    ws.getCell(`${lc1}${r}`).font = labelFont;
    ws.getCell(`${vc1}${r}`).value = vv1;
    ws.getCell(`${vc1}${r}`).font = valueFont;
    if (vv1) setWrapped(ws, r, vc1, vv1, cValW);
    ws.getCell(`${lc2}${r}`).value = lv2;
    ws.getCell(`${lc2}${r}`).font = labelFont;
    ws.getCell(`${vc2}${r}`).value = vv2;
    ws.getCell(`${vc2}${r}`).font = valueFont;
    if (vv2) setWrapped(ws, r, vc2, vv2, fValW);
  }
  const fechaCell = ws.getCell(`C${infoStart + 3}`);
  fechaCell.value = data.fecha;
  fechaCell.numFmt = "DD/MM/YYYY";
  fechaCell.font = valueFont;
  const vigRow = infoStart + 4;
  ws.getCell(`B${vigRow}`).value = "Vigencia:";
  ws.getCell(`B${vigRow}`).font = labelFont;
  const vigenciaCell = ws.getCell(`C${vigRow}`);
  vigenciaCell.value = data.vigencia;
  vigenciaCell.numFmt = "DD/MM/YYYY";
  vigenciaCell.font = valueFont;
  // RFC del cliente: solo se muestra si fue capturado (proyectos con factura).
  if (data.clienteRfc) {
    ws.getCell(`E${vigRow}`).value = "RFC:";
    ws.getCell(`E${vigRow}`).font = labelFont;
    ws.getCell(`F${vigRow}`).value = data.clienteRfc;
    ws.getCell(`F${vigRow}`).font = valueFont;
  }

  // ── Tabla de servicios ──
  const tableStart = infoStart + 6;
  const colB = ws.getColumn("B").number;
  const colK = ws.getColumn("K").number;
  // Estiliza (relleno + borde) todo el ancho de una fila de la tabla, de B a K.
  const styleTableRow = (rowNum: number, fillArgb: string, borderArgb?: string) => {
    for (let c = colB; c <= colK; c++) {
      const cell = ws.getCell(rowNum, c);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillArgb } };
      applyThinBorder(cell, borderArgb);
    }
  };
  ws.mergeCells(`D${tableStart}:J${tableStart}`);
  styleTableRow(tableStart, PRIMARY, PRIMARY);
  const headerCells: [string, string, HAlign][] = [
    ["B", "Fase", "left"],
    ["C", "Tipo de Pago", "left"],
    ["D", "Servicio", "left"],
    ["K", "Precio", "right"],
  ];
  for (const [col, txt, al] of headerCells) {
    const cell = ws.getCell(`${col}${tableStart}`);
    cell.value = txt;
    cell.font = headerFont;
    cell.alignment = { horizontal: al, vertical: "middle" };
  }
  ws.getRow(tableStart).height = 24;

  // IVA: por defecto se aplica (se factura). false = proyecto sin factura, precios finales.
  const iva = data.incluirIva !== false;
  const ivaFactor = iva ? 1.16 : 1;
  const ivaSuf = iva ? " + IVA" : "";
  const ivaTotalLbl = iva ? " (c/IVA)" : "";

  // Las partidas "demanda" salen de la tabla normal y se muestran en su propio modulo.
  const esDemanda = (s: ExcelServicio) => s.modeloCobro === "demanda";
  const demandaServs = data.servicios.filter(esDemanda);
  const comprometidos = data.servicios.filter((s) => !esDemanda(s));
  const serviciosUnicos = comprometidos.filter((s) => s.tipoPago === "unico");
  const serviciosMensuales = comprometidos.filter((s) => s.tipoPago === "mensual");
  const servWidth = mergedWidth(ws, "D", "J");
  let row = tableStart + 1;

  // ── Totales (helpers reutilizados por modo normal y doble propuesta) ──
  const writeTotalRow = (label: string, amount: number, font: Partial<ExcelJS.Font>) => {
    ws.mergeCells(`B${row}:J${row}`);
    ws.getCell(`B${row}`).value = label;
    ws.getCell(`B${row}`).font = font;
    ws.getCell(`B${row}`).alignment = { vertical: "middle" };
    ws.getCell(`K${row}`).value = amount;
    ws.getCell(`K${row}`).numFmt = "$#,##0.00";
    ws.getCell(`K${row}`).font = font;
    ws.getCell(`K${row}`).alignment = { horizontal: "right", vertical: "middle" };
    styleTableRow(row, PRIMARY_LIGHT, PRIMARY);
    row++;
  };
  const writeIvaNote = () => {
    if (!iva) return; // proyecto sin factura: no se anota "+ IVA"
    ws.mergeCells(`B${row}:J${row}`);
    ws.getCell(`B${row}`).value = "(+ IVA)";
    ws.getCell(`B${row}`).font = { ...smallFont, italic: false };
    row++;
  };

  // Dibuja las filas de servicios agrupadas por fase, a partir de la fila actual.
  const drawServiceRows = (servs: ExcelServicio[]) => {
    let currentFase = -1;
    for (const serv of servs) {
      if (serv.fase !== currentFase) {
        currentFase = serv.fase;
        ws.mergeCells(`B${row}:K${row}`);
        ws.getCell(`B${row}`).value = fases[serv.fase] || `FASE ${serv.fase}`;
        ws.getCell(`B${row}`).font = faseFont;
        ws.getCell(`B${row}`).alignment = { vertical: "middle" };
        fillRow(ws, row, "B", "K", PRIMARY_LIGHT);
        ws.getRow(row).height = 20;
        row++;
      }
      const rowBg = row % 2 === 0 ? LIGHT_BG : WHITE;
      ws.mergeCells(`D${row}:J${row}`);
      styleTableRow(row, rowBg, BORDER_COLOR);
      ws.getCell(`C${row}`).value = serv.tipoPago === "unico" ? "Unico" : "Mensual";
      ws.getCell(`C${row}`).font = valueFont;
      ws.getCell(`C${row}`).alignment = { vertical: "top" };
      const detalle = detalleModelo(serv);
      const servText = detalle ? `${serv.nombre}  —  ${detalle}` : serv.nombre;
      ws.getCell(`D${row}`).value = servText;
      ws.getCell(`D${row}`).font = valueFont;
      setWrapped(ws, row, "D", servText, servWidth);
      // "demanda": muestra la tarifa/hr (texto) en vez de $0; nunca suma al total.
      if (serv.modeloCobro === "demanda") {
        ws.getCell(`K${row}`).value = precioDisplay(serv);
        ws.getCell(`K${row}`).font = valueFont;
        ws.getCell(`K${row}`).alignment = { horizontal: "right", vertical: "top" };
      } else {
        ws.getCell(`K${row}`).value = serv.precio;
        ws.getCell(`K${row}`).numFmt = "$#,##0.00";
        ws.getCell(`K${row}`).font = valueFont;
        ws.getCell(`K${row}`).alignment = { horizontal: "right", vertical: "top" };
      }
      row++;

      // Beneficios destacados (denotan valor; util en partidas demanda sin precio).
      for (const b of serv.beneficios ?? []) {
        ws.mergeCells(`D${row}:J${row}`);
        const txt = `» ${b}`;
        ws.getCell(`D${row}`).value = txt;
        ws.getCell(`D${row}`).font = beneficioFont;
        setWrapped(ws, row, "D", txt, servWidth);
        row++;
      }
    }
  };

  // Modulo dedicado del esquema por horas (tarjeta de tarifas + beneficios + nota).
  const bIdxR = ws.getColumn("B").number;
  const kIdxR = ws.getColumn("K").number;
  const drawEsquemaHoras = (servs: ExcelServicio[], tituloOpcion?: string) => {
    if (servs.length === 0) return;
    // Encabezado del modulo
    ws.mergeCells(`B${row}:K${row}`);
    ws.getCell(`B${row}`).value = `ESQUEMA DE TRABAJO POR HORAS${tituloOpcion ? " - " + tituloOpcion : ""}`;
    ws.getCell(`B${row}`).font = { bold: true, size: 12, name: "Calibri", color: { argb: WHITE } };
    ws.getCell(`B${row}`).alignment = { vertical: "middle" };
    fillRow(ws, row, "B", "K", PRIMARY);
    ws.getRow(row).height = 22;
    row++;

    for (const serv of servs) {
      ws.mergeCells(`B${row}:H${row}`);
      ws.getCell(`B${row}`).value = serv.nombre;
      ws.getCell(`B${row}`).font = boldFont;
      ws.getCell(`B${row}`).alignment = { vertical: "middle" };
      ws.mergeCells(`I${row}:K${row}`);
      ws.getCell(`I${row}`).value = `${precioDisplay(serv)}${ivaSuf}`;
      ws.getCell(`I${row}`).font = { bold: true, size: 10, name: "Calibri", color: { argb: PRIMARY } };
      ws.getCell(`I${row}`).alignment = { horizontal: "right", vertical: "middle" };
      for (let c = bIdxR; c <= kIdxR; c++) applyThinBorder(ws.getCell(row, c), BORDER_COLOR);
      row++;

      for (const e of serv.entregables ?? []) {
        ws.mergeCells(`B${row}:K${row}`);
        const txt = `• ${e}`;
        ws.getCell(`B${row}`).value = txt;
        ws.getCell(`B${row}`).font = valueFont;
        setWrapped(ws, row, "B", txt, mergedWidth(ws, "B", "K"));
        row++;
      }
      for (const b of serv.beneficios ?? []) {
        ws.mergeCells(`B${row}:K${row}`);
        const txt = `» ${b}`;
        ws.getCell(`B${row}`).value = txt;
        ws.getCell(`B${row}`).font = beneficioFont;
        setWrapped(ws, row, "B", txt, mergedWidth(ws, "B", "K"));
        row++;
      }
    }

    // Total tipo "Segun consumo"
    ws.mergeCells(`B${row}:J${row}`);
    ws.getCell(`B${row}`).value = "Total mensual";
    ws.getCell(`B${row}`).font = totalFont;
    ws.getCell(`B${row}`).alignment = { vertical: "middle" };
    ws.getCell(`K${row}`).value = "Segun consumo";
    ws.getCell(`K${row}`).font = totalFont;
    ws.getCell(`K${row}`).alignment = { horizontal: "right", vertical: "middle" };
    styleTableRow(row, PRIMARY_LIGHT, PRIMARY);
    row++;

    const nota = `Facturacion a fin de mes segun las horas efectivamente consumidas. No requiere anticipo. Precios en MXN${iva ? ", no incluyen IVA" : ", no se emite factura"}.`;
    ws.mergeCells(`B${row}:K${row}`);
    ws.getCell(`B${row}`).value = nota;
    ws.getCell(`B${row}`).font = { italic: true, size: 9, name: "Calibri", color: { argb: MUTED } };
    setWrapped(ws, row, "B", nota, mergedWidth(ws, "B", "K"), { fontSize: 9 });
    row += 2;
  };

  // Banner de una opcion (titulo + descripcion + exclusiones) en doble propuesta.
  const writeOpcionBanner = (op: "1" | "2") => {
    const meta = data.opcionesMetadata?.[op] || {};
    ws.mergeCells(`B${row}:K${row}`);
    ws.getCell(`B${row}`).value = `OPCION ${op}${meta.titulo ? ": " + meta.titulo : ""}`;
    ws.getCell(`B${row}`).font = { bold: true, size: 12, name: "Calibri", color: { argb: WHITE } };
    ws.getCell(`B${row}`).alignment = { vertical: "middle" };
    fillRow(ws, row, "B", "K", SECONDARY);
    ws.getRow(row).height = 22;
    row++;
    if (meta.descripcion) {
      ws.mergeCells(`B${row}:K${row}`);
      ws.getCell(`B${row}`).value = meta.descripcion;
      ws.getCell(`B${row}`).font = valueFont;
      setWrapped(ws, row, "B", meta.descripcion, mergedWidth(ws, "B", "K"));
      row++;
    }
    if (meta.noIncluye) {
      ws.mergeCells(`B${row}:K${row}`);
      const t = `No incluye: ${meta.noIncluye}`;
      ws.getCell(`B${row}`).value = t;
      ws.getCell(`B${row}`).font = smallFont;
      setWrapped(ws, row, "B", t, mergedWidth(ws, "B", "K"), { fontSize: 9 });
      row++;
    }
  };

  if (data.esDoble) {
    for (const op of ["1", "2"] as const) {
      const inOp = (s: ExcelServicio) => s.opcion === op || s.opcion === "ambas";
      const u = serviciosUnicos.filter(inOp);
      const me = serviciosMensuales.filter(inOp);
      const dem = demandaServs.filter(inOp);
      writeOpcionBanner(op);
      if (u.length > 0 || me.length > 0) {
        drawServiceRows([...u, ...me]);
        row++;
        writeTotalRow(`Total Pago Unico - Opcion ${op}`, u.reduce((s, x) => s + x.precio, 0), totalFont);
        writeIvaNote();
        writeTotalRow(`Total Pago Mensual - Opcion ${op}`, me.reduce((s, x) => s + x.precio, 0), totalFont);
        writeIvaNote();
      }
      drawEsquemaHoras(dem);
      row++;
    }
    // ── Comparativa de opciones (totales con IVA + horas) ──
    const t1 = calcularTotalesOpcion(data.servicios, "1");
    const t2 = calcularTotalesOpcion(data.servicios, "2");
    ws.mergeCells(`B${row}:K${row}`);
    ws.getCell(`B${row}`).value = "COMPARATIVA DE OPCIONES";
    ws.getCell(`B${row}`).font = { bold: true, size: 12, name: "Calibri", color: { argb: WHITE } };
    ws.getCell(`B${row}`).alignment = { vertical: "middle" };
    fillRow(ws, row, "B", "K", PRIMARY);
    ws.getRow(row).height = 22;
    row++;
    const t1Tit = data.opcionesMetadata?.["1"]?.titulo;
    const t2Tit = data.opcionesMetadata?.["2"]?.titulo;
    const compRow = (lab: string, v1: string, v2: string, font: Partial<ExcelJS.Font>) => {
      ws.mergeCells(`B${row}:F${row}`);
      ws.getCell(`B${row}`).value = lab;
      ws.getCell(`B${row}`).font = font;
      ws.mergeCells(`G${row}:H${row}`);
      ws.getCell(`G${row}`).value = v1;
      ws.getCell(`G${row}`).font = font;
      ws.getCell(`G${row}`).alignment = { horizontal: "right" };
      ws.mergeCells(`I${row}:K${row}`);
      ws.getCell(`I${row}`).value = v2;
      ws.getCell(`I${row}`).font = font;
      ws.getCell(`I${row}`).alignment = { horizontal: "right" };
      for (let c = colB; c <= colK; c++) applyThinBorder(ws.getCell(row, c), BORDER_COLOR);
      row++;
    };
    const op1Dem = data.servicios.some((s) => s.modeloCobro === "demanda" && (s.opcion === "1" || s.opcion === "ambas"));
    const op2Dem = data.servicios.some((s) => s.modeloCobro === "demanda" && (s.opcion === "2" || s.opcion === "ambas"));
    const mens1 = t1.totalMensual === 0 && op1Dem ? "Segun consumo" : formatCurrency(t1.totalMensual * ivaFactor);
    const mens2 = t2.totalMensual === 0 && op2Dem ? "Segun consumo" : formatCurrency(t2.totalMensual * ivaFactor);
    compRow("Concepto", `Opcion 1${t1Tit ? " - " + t1Tit : ""}`, `Opcion 2${t2Tit ? " - " + t2Tit : ""}`, boldFont);
    compRow(`Total unico${ivaTotalLbl}`, formatCurrency(t1.totalUnico * ivaFactor), formatCurrency(t2.totalUnico * ivaFactor), valueFont);
    compRow(`Total mensual${ivaTotalLbl}`, mens1, mens2, valueFont);
    compRow("Horas estimadas", `${t1.horas} h`, `${t2.horas} h`, valueFont);
    row++;
  } else {
    if (serviciosUnicos.length > 0 || serviciosMensuales.length > 0) {
      drawServiceRows([...serviciosUnicos, ...serviciosMensuales]);
      row++;
      writeTotalRow("Total Pago Unico", serviciosUnicos.reduce((s, x) => s + x.precio, 0), totalFont);
      writeIvaNote();
      writeTotalRow("Total Pago Mensual", serviciosMensuales.reduce((s, x) => s + x.precio, 0), totalFont);
      writeIvaNote();
    }
    drawEsquemaHoras(demandaServs);
    row++;
  }

  if (data.planBucefaloNivel) {
    const precio = data.planBucefaloPrecio ?? bucefaloPrecio(data.planBucefaloNivel);
    const nivel = data.planBucefaloNivel.charAt(0).toUpperCase() + data.planBucefaloNivel.slice(1);
    writeTotalRow(`CRM Bucefalo - ${nivel}`, precio, boldFont);
    row++;
  }

  ws.mergeCells(`B${row}:K${row}`);
  const notaResumen = iva
    ? "Todos los precios son en Moneda Nacional (MX), los precios no incluyen IVA. Vigencia de 15 dias habiles."
    : "Todos los precios son en Moneda Nacional (MX). Proyecto sin factura (no se aplica IVA). Vigencia de 15 dias habiles.";
  ws.getCell(`B${row}`).value = notaResumen;
  ws.getCell(`B${row}`).font = smallFont;
  setWrapped(ws, row, "B", notaResumen, mergedWidth(ws, "B", "K"), { fontSize: 9 });

  // ═══════════════════════════════════════════════════════════════════════════
  // HOJAS DETALLADAS POR SERVICIO
  // ═══════════════════════════════════════════════════════════════════════════
  const usedNames = new Set<string>();
  for (const serv of data.servicios) {
    // Nombre de hoja unico y valido (Excel: max 31 chars, sin / \ * ? [ ] :).
    const base = serv.nombre.substring(0, 31).replace(/[/\\*?[\]:]/g, "") || "Servicio";
    let safeName = base;
    let n = 2;
    while (usedNames.has(safeName.toLowerCase())) {
      const suffix = ` (${n})`;
      safeName = base.substring(0, 31 - suffix.length) + suffix;
      n++;
    }
    usedNames.add(safeName.toLowerCase());
    const dw = workbook.addWorksheet(safeName);
    dw.columns = [
      { width: 3 },
      { width: 16 },
      { width: 30 },
      { width: 8 },
      { width: 4 },
      { width: 18 },
      { width: 22 },
      { width: 6 },
      { width: 6 },
      { width: 16 },
    ];
    dw.views = [{ showGridLines: false }];
    // Banner
    dw.mergeCells("B1:J1");
    const bannerText = `${fases[serv.fase] || "FASE " + serv.fase} — ${serv.nombre}`;
    dw.getCell("B1").value = bannerText;
    dw.getCell("B1").font = { bold: true, size: 14, name: "Calibri", color: { argb: WHITE } };
    dw.getCell("B1").alignment = { vertical: "middle", wrapText: true };
    fillRow(dw, 1, "A", "J", PRIMARY);
    dw.getRow(1).height = Math.max(30, estimateRowHeight(bannerText, mergedWidth(dw, "B", "J"), 14));
    const cVal = mergedWidth(dw, "C", "D");
    const gVal = mergedWidth(dw, "G", "H");
    let r = 3;
    dw.getCell(`B${r}`).value = "Cliente:";
    dw.getCell(`B${r}`).font = labelFont;
    dw.mergeCells(`C${r}:D${r}`);
    dw.getCell(`C${r}`).value = data.clienteEmpresa || data.clienteNombre;
    dw.getCell(`C${r}`).font = boldFont;
    setWrapped(dw, r, "C", data.clienteEmpresa || data.clienteNombre, cVal);
    dw.getCell(`F${r}`).value = "No. Cotización:";
    dw.getCell(`F${r}`).font = labelFont;
    dw.mergeCells(`G${r}:H${r}`);
    dw.getCell(`G${r}`).value = data.numero;
    dw.getCell(`G${r}`).font = boldFont;
    r += 2;
    dw.getCell(`B${r}`).value = "Servicio:";
    dw.getCell(`B${r}`).font = labelFont;
    dw.mergeCells(`C${r}:D${r}`);
    dw.getCell(`C${r}`).value = serv.nombre;
    dw.getCell(`C${r}`).font = { ...boldFont, size: 12, color: { argb: PRIMARY } };
    setWrapped(dw, r, "C", serv.nombre, cVal, { fontSize: 12 });
    dw.getCell(`F${r}`).value = "Tiempo de Entrega:";
    dw.getCell(`F${r}`).font = labelFont;
    dw.mergeCells(`G${r}:H${r}`);
    dw.getCell(`G${r}`).value = serv.tiempoEntrega;
    dw.getCell(`G${r}`).font = valueFont;
    setWrapped(dw, r, "G", serv.tiempoEntrega, gVal);
    r += 2;
    const detalleServ = detalleModelo(serv);
    if (detalleServ) {
      dw.getCell(`B${r}`).value = "Detalle:";
      dw.getCell(`B${r}`).font = labelFont;
      dw.mergeCells(`C${r}:J${r}`);
      dw.getCell(`C${r}`).value = detalleServ;
      dw.getCell(`C${r}`).font = valueFont;
      setWrapped(dw, r, "C", detalleServ, mergedWidth(dw, "C", "J"));
      r += 2;
    }
    // Encabezado de entregables — barra completa B:J
    dw.mergeCells(`B${r}:J${r}`);
    dw.getCell(`B${r}`).value = "Entregables";
    dw.getCell(`B${r}`).font = headerFont;
    dw.getCell(`B${r}`).alignment = { vertical: "middle" };
    fillRow(dw, r, "B", "J", PRIMARY);
    dw.getRow(r).height = 22;
    r++;
    const entWidth = mergedWidth(dw, "B", "J");
    for (let i = 0; i < serv.entregables.length; i++) {
      const er = r + i;
      dw.mergeCells(`B${er}:J${er}`);
      const txt = `${i + 1}. ${serv.entregables[i]}`;
      dw.getCell(`B${er}`).value = txt;
      dw.getCell(`B${er}`).font = valueFont;
      setWrapped(dw, er, "B", txt, entWidth);
      const bg = i % 2 === 1 ? LIGHT_BG : WHITE;
      for (let c = dw.getColumn("B").number; c <= dw.getColumn("J").number; c++) {
        dw.getCell(er, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        applyThinBorder(dw.getCell(er, c), BORDER_COLOR);
      }
    }
    r += serv.entregables.length + 1;

    // Beneficios (si los hay): seccion destacada en color primario.
    const beneficios = serv.beneficios ?? [];
    if (beneficios.length > 0) {
      dw.mergeCells(`B${r}:J${r}`);
      dw.getCell(`B${r}`).value = "Beneficios";
      dw.getCell(`B${r}`).font = headerFont;
      dw.getCell(`B${r}`).alignment = { vertical: "middle" };
      fillRow(dw, r, "B", "J", PRIMARY);
      dw.getRow(r).height = 22;
      r++;
      for (let i = 0; i < beneficios.length; i++) {
        const er = r + i;
        dw.mergeCells(`B${er}:J${er}`);
        const txt = `» ${beneficios[i]}`;
        dw.getCell(`B${er}`).value = txt;
        dw.getCell(`B${er}`).font = beneficioFont;
        setWrapped(dw, er, "B", txt, entWidth);
        for (let c = dw.getColumn("B").number; c <= dw.getColumn("J").number; c++) {
          applyThinBorder(dw.getCell(er, c), BORDER_COLOR);
        }
      }
      r += beneficios.length + 1;
    }

    // Total: etiqueta B:H + precio I:J
    dw.mergeCells(`B${r}:H${r}`);
    dw.getCell(`B${r}`).value = `Total Pago ${serv.tipoPago === "unico" ? "Unico" : "Mensual"}`;
    dw.getCell(`B${r}`).font = totalFont;
    dw.getCell(`B${r}`).alignment = { vertical: "middle" };
    dw.mergeCells(`I${r}:J${r}`);
    if (serv.modeloCobro === "demanda") {
      dw.getCell(`I${r}`).value = precioDisplay(serv);
    } else {
      dw.getCell(`I${r}`).value = serv.precio;
      dw.getCell(`I${r}`).numFmt = "$#,##0.00";
    }
    dw.getCell(`I${r}`).font = totalFont;
    dw.getCell(`I${r}`).alignment = { horizontal: "right", vertical: "middle" };
    for (let c = dw.getColumn("B").number; c <= dw.getColumn("J").number; c++) {
      dw.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: PRIMARY_LIGHT } };
      applyThinBorder(dw.getCell(r, c), PRIMARY);
    }
    r++;
    dw.getCell(`B${r}`).value =
      serv.modeloCobro === "demanda"
        ? `(Se factura a fin de mes segun consumo${ivaSuf})`
        : iva ? "(+ IVA)" : "(Sin factura)";
    dw.getCell(`B${r}`).font = { ...smallFont, italic: false };
    r += 2;
    dw.mergeCells(`B${r}:J${r}`);
    const notaDetalle = `Esta cotización tiene una vigencia de 15 dias habiles. Todos los precios en MXN${iva ? ", precios + IVA" : ", sin factura"}.`;
    dw.getCell(`B${r}`).value = notaDetalle;
    dw.getCell(`B${r}`).font = smallFont;
    setWrapped(dw, r, "B", notaDetalle, mergedWidth(dw, "B", "J"), { fontSize: 9 });
    r += 2;
    dw.mergeCells(`B${r}:J${r}`);
    dw.getCell(`B${r}`).value = data.razonSocial;
    dw.getCell(`B${r}`).font = { ...boldFont, color: { argb: PRIMARY } };
    if (data.domicilioFiscal) {
      r++;
      dw.mergeCells(`B${r}:J${r}`);
      dw.getCell(`B${r}`).value = data.domicilioFiscal;
      dw.getCell(`B${r}`).font = { ...smallFont, italic: false };
      setWrapped(dw, r, "B", data.domicilioFiscal, mergedWidth(dw, "B", "J"), { fontSize: 9 });
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
