import PDFDocument from "pdfkit";
import { FASES_SHORT as FASES, describirRetainer, formatCurrency, calcularTotalesOpcion, type MetaOpcion } from "./calculators";

interface ServicioPDF {
  nombre: string;
  fase: number;
  tipoPago: string;
  precio: number;
  tiempoEntrega: string;
  entregables: string[];
  esPersonalizado?: boolean;
  horas?: number;
  tarifaHora?: number;
  modeloCobro?: string;
  montoMinimo?: number;
  horasIncluidas?: number;
  opcion?: string | null;
}

// Texto de desglose por modelo de cobro (horas / retainer) para la sub-linea del servicio.
function detalleModeloPDF(serv: ServicioPDF): string {
  if (serv.modeloCobro === "retainer") {
    return describirRetainer(serv.montoMinimo ?? 0, serv.horasIncluidas ?? 0, serv.tarifaHora ?? 0);
  }
  if ((serv.modeloCobro === "horas" || serv.esPersonalizado) && serv.horas && serv.tarifaHora) {
    return `${serv.horas} h x ${formatCurrency(serv.tarifaHora)}/hr`;
  }
  return "";
}

interface CotizacionPDFData {
  numero: string;
  clienteNombre: string;
  clienteEmpresa: string;
  asesorNombre: string;
  fecha: Date;
  vigencia: Date;
  moneda: string;
  tipoCambio: string;
  proyecto: string;
  esquemaPago: string;
  servicios: ServicioPDF[];
  esDoble?: boolean;
  opcionesMetadata?: { "1"?: MetaOpcion; "2"?: MetaOpcion } | null;
  planBucefaloNivel: string | null;
  planBucefaloPrecio: number;
  incluirBonos: boolean;
  configBancaria?: Record<string, string>;
  colorPrimario?: string;
  colorSecundario?: string;
  logoBase64?: string;
  logoMime?: string;
}

function fmt(n: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);
}

async function toPngBuffer(base64: string, mime: string): Promise<Buffer> {
  const buf = Buffer.from(base64, "base64");
  if (mime === "image/svg+xml") {
    const sharp = (await import("sharp")).default;
    return sharp(buf).png().toBuffer();
  }
  return buf;
}

export async function generateCotizacionPDF(data: CotizacionPDFData): Promise<Buffer> {
  const logoBuffer = data.logoBase64 && data.logoMime
    ? await toPngBuffer(data.logoBase64, data.logoMime).catch(() => undefined)
    : data.logoBase64
      ? Buffer.from(data.logoBase64, "base64")
      : undefined;

  return new Promise((resolve, reject) => {
    const PRIMARY = data.colorPrimario || "#2563eb";
    const DARK = data.colorSecundario || "#1e293b";
    const MUTED = "#64748b";
    const BORDER = "#cbd5e1";
    const LIGHT_BG = "#f1f5f9";
    const WHITE = "#ffffff";

    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: 45, bottom: 55, left: 50, right: 50 },
      bufferPages: true,
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pw = doc.page.width;
    const ph = doc.page.height;
    const m = doc.page.margins;
    const W = pw - m.left - m.right;
    const L = m.left;
    const maxY = ph - m.bottom - 5;

    function need(h: number, y: number): number {
      if (y + h > maxY) {
        doc.addPage();
        return m.top;
      }
      return y;
    }

    function rowBg(y: number, h: number, bg: string) {
      doc.save();
      doc.rect(L, y, W, h).fill(bg);
      doc.moveTo(L, y + h).lineTo(L + W, y + h).strokeColor(BORDER).lineWidth(0.3).stroke();
      doc.restore();
    }

    function txtHeight(str: string, width: number, size: number): number {
      return doc.font("Helvetica").fontSize(size).heightOfString(str, { width });
    }

    // ── PAGE 1: COVER ──────────────────────────────
    doc.rect(0, 0, pw, ph).fill(WHITE);

    if (logoBuffer) {
      try { doc.image(logoBuffer, L, 55, { height: 65 }); } catch {}
    } else {
      doc.font("Helvetica-Bold").fontSize(28).fillColor(PRIMARY).text("UJ", L, 55);
      doc.font("Helvetica").fontSize(9).fillColor(MUTED).text("Uriel Jareth Consulting", L + 48, 70);
    }

    const barY = logoBuffer ? 145 : 130;
    doc.rect(L, barY, W, 4).fill(PRIMARY);

    doc.font("Helvetica-Bold").fontSize(36).fillColor(DARK).text("Cotizacion", L, barY + 24);
    doc.font("Helvetica").fontSize(18).fillColor(PRIMARY).text(data.numero, L, barY + 68);

    let iy = barY + 110;
    const cL = L;
    const cR = L + W * 0.52;

    const infoL: [string, string][] = [
      ["Cliente", data.clienteNombre],
      ...(data.clienteEmpresa ? [["Empresa", data.clienteEmpresa]] as [string, string][] : []),
      ["Proyecto", data.proyecto],
      ["Asesor", data.asesorNombre],
    ];
    const infoR: [string, string][] = [
      ["Fecha", fmtDate(data.fecha)],
      ["Vigencia", fmtDate(data.vigencia)],
      ["Moneda", data.moneda],
      ["Esquema", data.esquemaPago],
    ];

    for (let i = 0; i < Math.max(infoL.length, infoR.length); i++) {
      if (i < infoL.length) {
        doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(infoL[i][0], cL, iy);
        doc.font("Helvetica").fontSize(11).fillColor(DARK).text(infoL[i][1], cL, iy + 12);
      }
      if (i < infoR.length) {
        doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(infoR[i][0], cR, iy);
        doc.font("Helvetica").fontSize(11).fillColor(DARK).text(infoR[i][1], cR, iy + 12);
      }
      iy += 32;
    }

    // ── PAGE 2+: RESUMEN ──────────────────────────
    doc.addPage();
    let y = m.top;

    if (logoBuffer) {
      try { doc.image(logoBuffer, L + W - 70, m.top - 5, { height: 22 }); } catch {}
    }

    doc.rect(L, y, 4, 16).fill(PRIMARY);
    doc.font("Helvetica-Bold").fontSize(15).fillColor(DARK).text("Hoja Resumen", L + 12, y + 1);
    y += 26;

    doc.font("Helvetica").fontSize(8).fillColor(MUTED);
    doc.text(`En atencion a: ${data.clienteEmpresa || data.clienteNombre}`, L, y);
    doc.text(`No. Cotizacion: ${data.numero}`, L + W * 0.45, y);
    y += 11;
    doc.text(`Asesor: ${data.asesorNombre}`, L, y);
    doc.text(`Fecha: ${fmtDate(data.fecha)}  |  Moneda: ${data.moneda}`, L + W * 0.45, y);
    y += 16;

    const colNombre = L;
    const colTipo = L + W - 200;
    const colTiempo = L + W - 120;
    const colPrecio = L + W - 60;

    function drawTableHeader() {
      rowBg(y, 16, LIGHT_BG);
      doc.font("Helvetica-Bold").fontSize(7).fillColor(DARK);
      doc.text("Servicio", colNombre + 6, y + 4);
      doc.text("Tipo", colTipo + 4, y + 4);
      doc.text("Entrega", colTiempo + 4, y + 4);
      doc.text("Precio", colPrecio, y + 4, { width: 60, align: "right" });
      y += 18;
    }

    const unicos = data.servicios.filter((s) => s.tipoPago === "unico");
    const mensuales = data.servicios.filter((s) => s.tipoPago === "mensual");

    function drawSection(servicios: ServicioPDF[], tipoLabel: string, tituloTotal: string) {
      if (servicios.length === 0) return y;
      let currentFase = -1;

      for (const serv of servicios) {
        if (serv.fase !== currentFase) {
          currentFase = serv.fase;
          y = need(20, y);
          doc.rect(L, y, W, 14).fill(LIGHT_BG);
          doc.font("Helvetica-Bold").fontSize(7).fillColor(PRIMARY);
          doc.text(FASES[serv.fase] || `FASE ${serv.fase}`, L + 6, y + 3);
          y += 16;
        }

        const detalleModelo = detalleModeloPDF(serv);
        const servH = 13 + (detalleModelo ? 9 : 0) + (serv.entregables ? Math.ceil(serv.entregables.length / 2) * 8 : 0) + 5;
        y = need(servH, y);

        doc.font("Helvetica").fontSize(8).fillColor(DARK);
        doc.text(serv.nombre, colNombre + 6, y, { width: colTipo - colNombre - 16 });
        doc.font("Helvetica").fontSize(7).fillColor(MUTED);
        doc.text(tipoLabel, colTipo + 4, y);
        doc.text(serv.tiempoEntrega, colTiempo + 4, y, { width: 56 });
        doc.font("Helvetica-Bold").fontSize(8).fillColor(DARK);
        doc.text(fmt(serv.precio), colPrecio, y, { width: 60, align: "right" });
        y += 13;

        if (detalleModelo) {
          doc.font("Helvetica-Oblique").fontSize(6.5).fillColor(MUTED);
          doc.text(detalleModelo, colNombre + 10, y, { width: colTipo - colNombre - 20 });
          y += 9;
        }

        if (serv.entregables && serv.entregables.length > 0) {
          const col1X = colNombre + 10;
          const col2X = colNombre + W * 0.48;
          const colW = W * 0.44;
          const half = Math.ceil(serv.entregables.length / 2);
          for (let i = 0; i < half; i++) {
            const e1 = serv.entregables[i];
            const e2 = i + half < serv.entregables.length ? serv.entregables[i + half] : null;
            doc.font("Helvetica").fontSize(6).fillColor(MUTED);
            doc.text(`\u2022 ${e1}`, col1X, y, { width: colW });
            if (e2) doc.text(`\u2022 ${e2}`, col2X, y, { width: colW });
            y += 8;
          }
        }

        doc.save();
        doc.moveTo(colNombre + 6, y).lineTo(L + W, y).strokeColor("#e5e7eb").lineWidth(0.2).stroke();
        doc.restore();
        y += 4;
      }

      y += 3;
      const total = servicios.reduce((s, x) => s + x.precio, 0);
      rowBg(y, 18, "#f8fafc");
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor(PRIMARY);
      doc.text(tituloTotal, colNombre + 6, y + 4);
      doc.text(fmt(total), colPrecio, y + 4, { width: 60, align: "right" });
      y += 22;
      doc.font("Helvetica").fontSize(6).fillColor(MUTED);
      doc.text("(Precios en Moneda Nacional, no incluyen IVA)", colNombre + 6, y);
      y += 12;
      return y;
    }

    // Encabezado de una opcion (titulo, descripcion, exclusiones) en doble propuesta.
    function drawOpcionHeader(op: "1" | "2") {
      const meta = data.opcionesMetadata?.[op] || {};
      y = need(30, y);
      y += 4;
      doc.rect(L, y, W, 18).fill(PRIMARY);
      doc.font("Helvetica-Bold").fontSize(10).fillColor(WHITE)
        .text(`OPCION ${op}${meta.titulo ? ": " + meta.titulo : ""}`, L + 8, y + 4, { width: W - 16 });
      y += 22;
      if (meta.descripcion) {
        const h = txtHeight(meta.descripcion, W - 12, 7.5);
        y = need(h + 4, y);
        doc.font("Helvetica").fontSize(7.5).fillColor(DARK).text(meta.descripcion, L + 6, y, { width: W - 12 });
        y += h + 4;
      }
      if (meta.noIncluye) {
        const label = `No incluye: ${meta.noIncluye}`;
        const h = txtHeight(label, W - 12, 7);
        y = need(h + 4, y);
        doc.font("Helvetica-Oblique").fontSize(7).fillColor(MUTED).text(label, L + 6, y, { width: W - 12 });
        y += h + 6;
      }
    }

    // Tabla comparativa final: totales (con IVA) y horas por opcion.
    function drawComparativa() {
      const t1 = calcularTotalesOpcion(data.servicios, "1");
      const t2 = calcularTotalesOpcion(data.servicios, "2");
      y = need(90, y);
      y += 6;
      doc.rect(L, y, 3, 10).fill(PRIMARY);
      doc.font("Helvetica-Bold").fontSize(10).fillColor(DARK).text("Comparativa de opciones", L + 10, y);
      y += 18;
      const cLabel = L;
      const cOp1 = L + W * 0.45;
      const cOp2 = L + W * 0.72;
      const t1Tit = data.opcionesMetadata?.["1"]?.titulo;
      const t2Tit = data.opcionesMetadata?.["2"]?.titulo;
      rowBg(y, 16, LIGHT_BG);
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor(DARK);
      doc.text("Concepto", cLabel + 6, y + 4);
      doc.text(`Opcion 1${t1Tit ? " - " + t1Tit : ""}`, cOp1, y + 4, { width: W * 0.27 - 4 });
      doc.text(`Opcion 2${t2Tit ? " - " + t2Tit : ""}`, cOp2, y + 4, { width: W * 0.28 - 4 });
      y += 18;
      const filas: [string, string, string][] = [
        ["Total unico (c/IVA)", fmt(t1.totalUnico * 1.16), fmt(t2.totalUnico * 1.16)],
        ["Total mensual (c/IVA)", fmt(t1.totalMensual * 1.16), fmt(t2.totalMensual * 1.16)],
        ["Horas estimadas", `${t1.horas} h`, `${t2.horas} h`],
      ];
      for (const [lab, v1, v2] of filas) {
        y = need(14, y);
        doc.font("Helvetica").fontSize(8).fillColor(DARK).text(lab, cLabel + 6, y);
        doc.font("Helvetica-Bold").fontSize(8).fillColor(DARK).text(v1, cOp1, y, { width: W * 0.27 - 4 });
        doc.text(v2, cOp2, y, { width: W * 0.28 - 4 });
        doc.save();
        doc.moveTo(cLabel + 6, y + 12).lineTo(L + W, y + 12).strokeColor("#e5e7eb").lineWidth(0.2).stroke();
        doc.restore();
        y += 14;
      }
      y += 8;
    }

    if (data.esDoble) {
      for (const op of ["1", "2"] as const) {
        const inOp = (s: ServicioPDF) => s.opcion === op || s.opcion === "ambas";
        drawOpcionHeader(op);
        drawTableHeader();
        const u = unicos.filter(inOp);
        const me = mensuales.filter(inOp);
        if (u.length > 0) y = drawSection(u, "Unico", `Total Pago Unico - Opcion ${op}`);
        if (me.length > 0) y = drawSection(me, "Mensual", `Total Pago Mensual - Opcion ${op}`);
      }
      drawComparativa();
    } else {
      drawTableHeader();
      if (unicos.length > 0) y = drawSection(unicos, "Unico", "Total Pago Unico");
      if (mensuales.length > 0) y = drawSection(mensuales, "Mensual", "Total Pago Mensual");
    }

    if (data.planBucefaloNivel) {
      y = need(20, y);
      const label = data.planBucefaloNivel.charAt(0).toUpperCase() + data.planBucefaloNivel.slice(1);
      rowBg(y, 14, LIGHT_BG);
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor(DARK).text(`Plan Bucefalo CRM - ${label}`, colNombre + 6, y + 3);
      doc.font("Helvetica-Bold").text(fmt(data.planBucefaloPrecio), colPrecio, y + 3, { width: 60, align: "right" });
      y += 18;
    }

    if (data.incluirBonos) {
      y = need(90, y);
      y += 4;
      doc.rect(L, y, 3, 10).fill(PRIMARY);
      doc.font("Helvetica-Bold").fontSize(9).fillColor(DARK).text("Bonos (Pago en una exhibicion)", L + 10, y);
      y += 16;
      const bonos = [
        "Bono 1: 30 min mensuales en servicios Centinela (Sitio Web)",
        "Bono 2: Workshop Estrategico de Buyer Persona",
        "Bono 3: Workshop de Propuestas de Valor y Oferta Irresistible",
        "Bono 4: 1 ano de Membresia Premium",
        "Bono 5: Un mes gratis de Bucefalo CRM",
        "Bono 6: Script de Ventas con mas de 100 complementos",
      ];
      for (const b of bonos) {
        y = need(11, y);
        doc.font("Helvetica").fontSize(7).fillColor(DARK).text(`\u2713  ${b}`, L + 8, y, { width: W - 16 });
        y += 11;
      }
    }

    // ── T&C PAGE ──────────────────────────────────
    doc.addPage();
    y = m.top;

    if (logoBuffer) {
      try { doc.image(logoBuffer, L + W - 70, m.top - 5, { height: 22 }); } catch {}
    }

    doc.rect(L, y, 4, 16).fill(PRIMARY);
    doc.font("Helvetica-Bold").fontSize(15).fillColor(DARK).text("Terminos y Condiciones", L + 12, y + 1);
    y += 28;

    function sectionTitle(title: string, yy: number): number {
      yy = need(20, yy);
      doc.rect(L, yy, 3, 9).fill(PRIMARY);
      doc.font("Helvetica-Bold").fontSize(9).fillColor(DARK).text(title, L + 10, yy);
      return yy + 15;
    }

    function drawBullets(title: string, items: string[], yStart: number): number {
      let yy = sectionTitle(title, yStart);
      for (const t of items) {
        const h = txtHeight(`\u2022  ${t}`, W - 4, 7.5);
        yy = need(h + 4, yy);
        doc.font("Helvetica").fontSize(7.5).fillColor(DARK).text(`\u2022  ${t}`, L + 2, yy, { width: W - 4 });
        yy += h + 4;
      }
      return yy + 6;
    }

    y = drawBullets("Condiciones", [
      "Esta cotizacion tiene una vigencia de 15 dias habiles.",
      "Cualquier ajuste al proyecto despues de la aprobacion del contenido afectara la fecha de entrega y por consiguiente el costo.",
      "El cliente debera proporcionar la informacion solicitada por Uriel Jareth Consulting en tiempo y forma.",
      "Si la falta de informacion provoca un excedente en los plazos de entrega del proyecto, las horas adicionales de servicio se cotizaran por separado.",
      "Los pagos correspondientes a los servicios mensuales deberan realizarse en los primeros 5 dias del mes.",
      "Todo el material e informacion necesarios para la realizacion del sitio web deberan ser entregados en un plazo maximo de 40 dias naturales a partir del arranque del proyecto.",
    ], y);

    y = drawBullets("Que no incluye el proyecto?", [
      "Generacion de disenos, videos, traducciones, cambios de divisas y unidades, o cualquier servicio externo a lo cotizado.",
      "Redaccion de entradas de Blog.",
      "Integracion de Servicios de terceros ajenos a los cotizados.",
      "Servicio de Recuperacion de Accesos de: Google Analytics, Google Tag Manager, Google Search Console, Google Ads, y Meta Ads.",
      "Creacion de Redes Sociales (En caso de requerir el servicio incluira un costo adicional).",
    ], y);

    y = drawBullets("Notas", [
      "El presente proyecto debera tener un responsable oficial.",
      "La Hora Centinela tiene un precio de $700.00 MXN.",
      "Los archivos editables/fuente (AI, PSD) son propiedad intelectual de la agencia. Si requiere los archivos editables, estos pueden ser adquiridos abonando una tarifa de liberacion (buy-out fee).",
      "Si el proyecto se pausa por razones ajenas a Uriel Jareth Consulting, esto generara costo extra del 15% al 30% para retomar el proyecto.",
    ], y);

    y += 6;
    y = need(110, y);
    doc.rect(L, y, 3, 9).fill(PRIMARY);
    doc.font("Helvetica-Bold").fontSize(9).fillColor(DARK).text("Datos Bancarios", L + 10, y);
    y += 16;

    const cfg = data.configBancaria || {};
    const razonSocial = cfg.razon_social || "URIEL JARETH ALVARADO ORTIZ";
    const rfc = cfg.rfc || "AAOU970201SU7";
    const clabeNac = cfg.clabe_interbancaria || cfg.cuenta_nacional || "";
    const cuentaNac = cfg.cuenta_nacional || "";
    const bancoNac = cfg.cuenta_nacional ? "BBVA" : "";
    const swiftMatch = cfg.cuenta_internacional_swift?.match(/SWIFT[^:]*:\s*(\S+)/i);
    const clabeIntMatch = cfg.cuenta_internacional_swift?.match(/CLABE[^:]*:\s*(\S+)/i);
    const swift = swiftMatch?.[1] || "BCMRMXMMPYM";
    const clabeInt = clabeIntMatch?.[1] || "";

    const boxH = 48;
    doc.save();
    doc.rect(L, y, W, boxH).fill(LIGHT_BG).stroke(BORDER);
    doc.font("Helvetica-Bold").fontSize(7).fillColor(DARK).text("Transferencia Nacional", L + 8, y + 4);
    doc.font("Helvetica").fontSize(6.5).fillColor(DARK);
    if (cuentaNac) doc.text(`Cuenta: ${cuentaNac}`, L + 8, y + 15);
    if (clabeNac) doc.text(`CLABE: ${clabeNac}`, L + W * 0.45, y + 15);
    doc.text(`Razon Social: ${razonSocial}`, L + 8, y + 26);
    doc.text(`RFC: ${rfc}`, L + W * 0.45, y + 26);
    if (bancoNac) doc.text(`Banco: ${bancoNac}`, L + 8, y + 37);
    doc.restore();
    y += boxH + 6;

    y = need(boxH + 6, y);
    doc.save();
    doc.rect(L, y, W, boxH).fill(LIGHT_BG).stroke(BORDER);
    doc.font("Helvetica-Bold").fontSize(7).fillColor(DARK).text("Transferencia Internacional", L + 8, y + 4);
    doc.font("Helvetica").fontSize(6.5).fillColor(DARK);
    doc.text(`Beneficiario: ${razonSocial}`, L + 8, y + 15);
    if (clabeInt) doc.text(`CLABE: ${clabeInt}`, L + W * 0.45, y + 15);
    doc.text(`Banco: BBVA Mexico`, L + 8, y + 26);
    doc.text(`SWIFT: ${swift}`, L + W * 0.45, y + 26);
    doc.restore();

    // ── ADD FOOTERS TO ALL PAGES ──────────────────
    const savedBottom = doc.page.margins.bottom;
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.page.margins.bottom = 0;
      doc.save();
      doc.moveTo(L, ph - 42).lineTo(L + W, ph - 42).strokeColor(BORDER).lineWidth(0.5).stroke();
      doc.font("Helvetica").fontSize(6).fillColor(MUTED);
      doc.text(
        "Uriel Jareth Consulting",
        L, ph - 35, { width: W, align: "center", lineBreak: false }
      );
      doc.text(
        "urieljareth.com  |  contacto@urieljareth.com  |  (445) 182 9943",
        L, ph - 26, { width: W, align: "center", lineBreak: false }
      );
      doc.restore();
      doc.page.margins.bottom = savedBottom;
    }

    doc.end();
  });
}
