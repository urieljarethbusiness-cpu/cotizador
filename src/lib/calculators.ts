export const IVA_RATE = 0.16;

// Tarifa por hora sugerida para partidas personalizadas (Hora Centinela). El asesor puede ajustarla por partida.
export const TARIFA_HORA_DEFAULT = 700;

export function calcularPrecioHoras(horas: number, tarifaHora: number): number {
  return Math.round((horas || 0) * (tarifaHora || 0) * 100) / 100;
}

// Modelos de cobro de una partida. "retainer" = importe minimo mensual fijo +
// tarifa de horas adicionales (las horas extra se facturan aparte, no suman al total).
// "demanda" = tarifa por hora sin horas comprometidas; precio=0, no suma al total
// (se factura a fin de mes segun consumo). Solo muestra la tarifa y sus beneficios.
export const MODELOS_COBRO: Record<string, string> = {
  fijo: "Precio fijo",
  horas: "Por horas",
  retainer: "Retainer (minimo + adicionales)",
  demanda: "Bajo demanda / por hora",
};

// Sub-linea de desglose por modelo de cobro (horas / retainer / demanda) para PDF/Excel.
// Reutilizado por ambos backends para mantener paridad.
export function detalleModelo(serv: {
  modeloCobro?: string | null;
  esPersonalizado?: boolean | null;
  horas?: number | null;
  tarifaHora?: number | null;
  montoMinimo?: number | null;
  horasIncluidas?: number | null;
}): string {
  if (serv.modeloCobro === "retainer") {
    return describirRetainer(serv.montoMinimo ?? 0, serv.horasIncluidas ?? 0, serv.tarifaHora ?? 0);
  }
  if (serv.modeloCobro === "demanda") {
    return `${formatCurrency(serv.tarifaHora ?? 0)}/hr · segun consumo`;
  }
  if ((serv.modeloCobro === "horas" || serv.esPersonalizado) && serv.horas && serv.tarifaHora) {
    return `${serv.horas} h x ${formatCurrency(serv.tarifaHora)}/hr`;
  }
  return "";
}

// Texto a mostrar en la columna "Precio" de una partida. Para "demanda" muestra la
// tarifa por hora en vez de $0 (el precio real depende del consumo). Reutilizado por
// UI, PDF y Excel para mantener consistencia.
export function precioDisplay(serv: {
  modeloCobro?: string | null;
  tarifaHora?: number | null;
  precio: number;
}): string {
  if (serv.modeloCobro === "demanda") {
    return `${formatCurrency(serv.tarifaHora || 0)}/hr`;
  }
  return formatCurrency(serv.precio);
}

// Nota al pie para las partidas "bajo demanda": no suman al total comprometido y se
// facturan segun consumo. Devuelve "" si no hay partidas demanda. Reutilizado por PDF y Excel.
export function notaDemanda(
  servicios: Array<{ modeloCobro?: string | null; nombre?: string | null; tarifaHora?: number | null }>
): string {
  const dem = servicios.filter((s) => s.modeloCobro === "demanda");
  if (dem.length === 0) return "";
  const detalle = dem
    .map((s) => `${s.nombre || "Servicio"} a ${formatCurrency(s.tarifaHora || 0)}/hr`)
    .join(", ");
  return `+ Horas facturadas a fin de mes segun consumo (no incluidas en el total): ${detalle}.`;
}

// Texto descriptivo de un retainer, reutilizado por UI, PDF y Excel.
export function describirRetainer(
  montoMinimo: number,
  horasIncluidas: number,
  tarifaHora: number
): string {
  const partes = [`${formatCurrency(montoMinimo || 0)}/mes`];
  if (horasIncluidas) partes.push(`incluye ${horasIncluidas} hr`);
  if (tarifaHora) partes.push(`adicional ${formatCurrency(tarifaHora)}/hr (se factura aparte)`);
  return partes.join(" · ");
}

// Doble propuesta: cada partida puede ir en la Opcion 1, la Opcion 2 o en ambas.
// "ambas" aparece (y suma) en las dos opciones. null = cotizacion normal (sin doble propuesta).
export const OPCIONES = ["1", "2", "ambas"] as const;
export type OpcionPropuesta = (typeof OPCIONES)[number];

export interface MetaOpcion {
  titulo?: string;
  descripcion?: string;
  noIncluye?: string;
}

// Totales de una opcion: suma las partidas de esa opcion + las marcadas "ambas".
// Respeta la regla de retainer: el total usa `precio`, no `horas x tarifa`. Las horas
// son informativas para la tabla comparativa.
export function calcularTotalesOpcion(
  servicios: Array<{ opcion?: string | null; tipoPago: string; precio: number; horas?: number | null }>,
  opcion: "1" | "2"
): { totalUnico: number; totalMensual: number; horas: number } {
  const rel = servicios.filter((s) => s.opcion === "ambas" || s.opcion === opcion);
  const totalUnico = rel
    .filter((s) => s.tipoPago === "unico")
    .reduce((a, s) => a + (s.precio || 0), 0);
  const totalMensual = rel
    .filter((s) => s.tipoPago === "mensual")
    .reduce((a, s) => a + (s.precio || 0), 0);
  const horas = rel.reduce((a, s) => a + (s.horas || 0), 0);
  return {
    totalUnico: Math.round(totalUnico * 100) / 100,
    totalMensual: Math.round(totalMensual * 100) / 100,
    horas: Math.round(horas * 100) / 100,
  };
}

export const FASES: Record<number, string> = {
  0: "FASE 0 - Auditoria / Acompanamiento",
  1: "FASE 1 - Setup e Infraestructura",
  2: "FASE 2 - Publicidad y Manejo",
  3: "FASE 3 - Contenido y SEO",
};

export const FASES_SHORT: Record<number, string> = {
  0: "FASE 0 - Auditoria",
  1: "FASE 1 - Setup e Infraestructura",
  2: "FASE 2 - Publicidad y Manejo",
  3: "FASE 3 - Contenido y SEO",
};

export const PLANES_BUCEFALO = [
  { nivel: "basico", label: "Basico", precio: 1000 },
  { nivel: "estandar", label: "Estandar", precio: 3500 },
  { nivel: "premium", label: "Premium", precio: 4500 },
  { nivel: "empresarial", label: "Empresarial", precio: 7500 },
] as const;

export const ESTADOS_COTIZACION = ["borrador", "enviada", "aprobada", "rechazada"] as const;
export type EstadoCotizacion = (typeof ESTADOS_COTIZACION)[number];

// ----- Registro de horas (notas de pago) -----
// Modelos de cobro que implican trabajo por tiempo: para estas cotizaciones se
// habilita el registro de horas trabajadas y la emision de notas de pago.
export const MODELOS_COBRO_TIEMPO = ["horas", "retainer", "demanda"] as const;

// Una cotizacion es "por tiempo" si al menos una de sus partidas se cobra por horas,
// retainer o demanda. Solo en ese caso tiene sentido registrar horas trabajadas.
export function esCotizacionPorTiempo(
  servicios: Array<{ modeloCobro?: string | null }>
): boolean {
  return servicios.some((s) =>
    (MODELOS_COBRO_TIEMPO as readonly string[]).includes(s.modeloCobro ?? "")
  );
}

// Tarifa por hora a sugerir al registrar horas: la de la primera partida por tiempo
// con tarifa > 0; si no hay, TARIFA_HORA_DEFAULT.
export function tarifaHoraSugerida(
  servicios: Array<{ modeloCobro?: string | null; tarifaHora?: number | null }>
): number {
  const serv = servicios.find(
    (s) =>
      (MODELOS_COBRO_TIEMPO as readonly string[]).includes(s.modeloCobro ?? "") &&
      (s.tarifaHora ?? 0) > 0
  );
  return serv?.tarifaHora ?? TARIFA_HORA_DEFAULT;
}

// "09:00" + "13:30" => 4.5. Devuelve 0 si el formato es invalido o fin <= inicio.
// No cruza medianoche (un registro = un tramo dentro de un dia).
export function calcularHorasRango(horaInicio: string, horaFin: string): number {
  const re = /^(\d{1,2}):(\d{2})$/;
  const a = re.exec(horaInicio ?? "");
  const b = re.exec(horaFin ?? "");
  if (!a || !b) return 0;
  const ini = parseInt(a[1], 10) * 60 + parseInt(a[2], 10);
  const fin = parseInt(b[1], 10) * 60 + parseInt(b[2], 10);
  if (fin <= ini) return 0;
  return Math.round(((fin - ini) / 60) * 100) / 100;
}

export type ModoAgrupacion = "detalle" | "dia" | "semana" | "mes";

export const MODOS_AGRUPACION: { value: ModoAgrupacion; label: string }[] = [
  { value: "detalle", label: "Detalle" },
  { value: "dia", label: "Por dia" },
  { value: "semana", label: "Por semana" },
  { value: "mes", label: "Por mes" },
];

const MESES_LARGO = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

// La fecha de un registro es una fecha-calendario sin huso horario. Para que el dia
// no se corra entre servidor (UTC) y cliente (MX), se persiste a las 12:00 UTC y se
// lee SIEMPRE con getters UTC. Helper para construir esa fecha desde "YYYY-MM-DD".
export function fechaRegistroDesdeISO(fechaISO: string): Date {
  return new Date(`${fechaISO}T12:00:00.000Z`);
}

// Formato corto de fecha de registro (DD/MM/YYYY) leyendo en UTC.
export function formatFechaRegistro(date: Date): string {
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function lunesDeSemanaUTC(d: Date): Date {
  const r = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dia = r.getUTCDay(); // 0 = domingo
  const offset = dia === 0 ? -6 : 1 - dia;
  r.setUTCDate(r.getUTCDate() + offset);
  return r;
}

// Clave + etiqueta del periodo al que pertenece una fecha, segun el modo de agrupacion.
// La clave agrupa; la etiqueta se muestra. Todo en UTC para coherencia de calendario.
export function periodoAgrupacion(
  fecha: Date,
  modo: ModoAgrupacion
): { clave: string; etiqueta: string } {
  const y = fecha.getUTCFullYear();
  const m = fecha.getUTCMonth();
  const d = fecha.getUTCDate();
  const p2 = (n: number) => String(n).padStart(2, "0");

  if (modo === "mes") {
    return { clave: `${y}-${p2(m + 1)}`, etiqueta: `${MESES_LARGO[m]} ${y}` };
  }
  if (modo === "semana") {
    const lunes = lunesDeSemanaUTC(fecha);
    const domingo = new Date(lunes);
    domingo.setUTCDate(lunes.getUTCDate() + 6);
    const fmt = (x: Date) => `${p2(x.getUTCDate())}/${p2(x.getUTCMonth() + 1)}`;
    const clave = `${lunes.getUTCFullYear()}-${p2(lunes.getUTCMonth() + 1)}-${p2(lunes.getUTCDate())}`;
    return { clave, etiqueta: `Semana ${fmt(lunes)} - ${fmt(domingo)}` };
  }
  // "dia" / "detalle"
  return { clave: `${y}-${p2(m + 1)}-${p2(d)}`, etiqueta: formatFechaRegistro(fecha) };
}

export function bucefaloPrecio(nivel: string): number {
  return PLANES_BUCEFALO.find((p) => p.nivel === nivel)?.precio ?? 0;
}

export function calcularVigencia(fecha: Date): Date {
  const vigencia = new Date(fecha);
  let diasHabiles = 0;
  while (diasHabiles < 15) {
    vigencia.setDate(vigencia.getDate() + 1);
    const dia = vigencia.getDay();
    if (dia !== 0 && dia !== 6) diasHabiles++;
  }
  return vigencia;
}

export function calcularFinanciamiento(input: { monto: number; meses: number; tasa: number; comision: number; iva: number }) {
  const { monto, meses, tasa, comision, iva } = input;
  const comisionTotal = (monto * comision) / 100;
  const montoConComision = monto + comisionTotal;
  const pagoMensual = montoConComision * (1 + tasa) / meses;
  const ivaMensual = pagoMensual * iva;
  const totalMensual = pagoMensual + ivaMensual;
  return {
    pagoMensual: Math.round(pagoMensual * 100) / 100,
    ivaMensual: Math.round(ivaMensual * 100) / 100,
    totalMensual: Math.round(totalMensual * 100) / 100,
    comisionTotal: Math.round(comisionTotal * 100) / 100,
    granTotal: Math.round(totalMensual * meses * 100) / 100,
  };
}

export function generarNumeroCotizacion(asesorIniciales: string, secuencia: number): string {
  const now = new Date();
  const yy = now.getFullYear().toString().slice(-2);
  const mm = (now.getMonth() + 1).toString().padStart(2, "0");
  const seq = secuencia.toString().padStart(3, "0");
  return `UJ${yy}${mm}${asesorIniciales}${seq}`;
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[^\w\s.\-]/g, "").replace(/\s+/g, " ").trim();
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
