export const IVA_RATE = 0.16;

// Tarifa por hora sugerida para partidas personalizadas (Hora Centinela). El asesor puede ajustarla por partida.
export const TARIFA_HORA_DEFAULT = 700;

export function calcularPrecioHoras(horas: number, tarifaHora: number): number {
  return Math.round((horas || 0) * (tarifaHora || 0) * 100) / 100;
}

// Modelos de cobro de una partida. "retainer" = importe minimo mensual fijo +
// tarifa de horas adicionales (las horas extra se facturan aparte, no suman al total).
export const MODELOS_COBRO: Record<string, string> = {
  fijo: "Precio fijo",
  horas: "Por horas",
  retainer: "Retainer (minimo + adicionales)",
};

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
