import { z } from "zod";

const servicioSchema = z.object({
  catalogoId: z.string().min(1),
  nombre: z.string().min(1),
  fase: z.number().int().min(0).max(3),
  tipoPago: z.enum(["unico", "mensual"]),
  precio: z.number().min(0),
  tiempoEntrega: z.string().min(1),
  entregables: z.array(z.string()),
  beneficios: z.array(z.string()).optional(),
  esPersonalizado: z.boolean().optional(),
  horas: z.number().min(0).optional(),
  tarifaHora: z.number().min(0).optional(),
  modeloCobro: z.enum(["fijo", "horas", "retainer", "demanda"]).optional(),
  montoMinimo: z.number().min(0).optional(),
  horasIncluidas: z.number().min(0).optional(),
  opcion: z.enum(["1", "2", "ambas"]).optional(),
});

const metaOpcionSchema = z.object({
  titulo: z.string().optional(),
  descripcion: z.string().optional(),
  noIncluye: z.string().optional(),
});

// { "1": { titulo, descripcion, noIncluye }, "2": {...} }
const opcionesSchema = z
  .object({ "1": metaOpcionSchema.optional(), "2": metaOpcionSchema.optional() })
  .optional();

export const cotizacionPostSchema = z.object({
  numero: z.string().min(1),
  fecha: z.coerce.date(),
  vigencia: z.coerce.date(),
  moneda: z.enum(["MXN", "USD"]),
  tipoCambio: z.string(),
  proyecto: z.string(),
  esquemaPago: z.enum(["Pago Unico", "Mensual", "Pago Unico/Mensual", "Por hora (postpago)"]),
  incluirBonos: z.boolean(),
  incluirFinanciamiento: z.boolean(),
  incluirIva: z.boolean().optional(),
  esDoble: z.boolean().optional(),
  opciones: opcionesSchema,
  observaciones: z.string(),
  asesorId: z.string().min(1),
  cliente: z.object({
    nombre: z.string().min(1, "Cliente nombre es requerido"),
    empresa: z.string(),
    email: z.string().email().or(z.literal("")),
    telefono: z.string(),
    rfc: z.string().optional(),
  }),
  servicios: z.array(servicioSchema),
  planBucefalo: z
    .object({
      nivel: z.string(),
      precio: z.number().min(0),
    })
    .nullable(),
});

export const cotizacionPutSchema = z.object({
  fecha: z.coerce.date(),
  vigencia: z.coerce.date(),
  moneda: z.enum(["MXN", "USD"]),
  tipoCambio: z.string(),
  proyecto: z.string(),
  esquemaPago: z.enum(["Pago Unico", "Mensual", "Pago Unico/Mensual", "Por hora (postpago)"]),
  incluirBonos: z.boolean(),
  incluirFinanciamiento: z.boolean(),
  incluirIva: z.boolean().optional(),
  esDoble: z.boolean().optional(),
  opciones: opcionesSchema,
  observaciones: z.string(),
  cliente: z.object({
    nombre: z.string().min(1, "Cliente nombre es requerido"),
    empresa: z.string(),
    email: z.string().email().or(z.literal("")),
    telefono: z.string(),
    rfc: z.string().optional(),
  }),
  servicios: z.array(servicioSchema),
  planBucefalo: z
    .object({
      nivel: z.string(),
      precio: z.number().min(0),
    })
    .nullable(),
});

const HORA_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

// Registro de horas trabajadas para una nota de pago. `fecha` es una fecha-calendario
// (YYYY-MM-DD); el servidor la materializa a las 12:00 UTC. `horas` no se acepta del
// cliente: se calcula del rango en el servidor (fuente de verdad).
export const registroHorasSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha invalida (YYYY-MM-DD)"),
  horaInicio: z.string().regex(HORA_RE, "Hora inicio invalida (HH:MM)"),
  horaFin: z.string().regex(HORA_RE, "Hora fin invalida (HH:MM)"),
  descripcion: z.string().trim().min(1, "La descripcion es requerida").max(500),
  tarifaHora: z.number().min(0).optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Email invalido"),
  password: z.string().min(1, "Password es requerido"),
});

export const servicioCatalogoSchema = z.object({
  nombre: z.string().min(1, "Nombre es requerido"),
  descripcion: z.string().nullable(),
  fase: z.number().int().min(0).max(3),
  tipoPago: z.enum(["unico", "mensual"]),
  precioBase: z.number().min(0, "Precio debe ser positivo"),
  tiempoEntrega: z.string().min(1),
  entregablesDefault: z.array(z.string()),
  categoriaId: z.string().min(1, "Categoria es requerida"),
  variante: z.string().nullable(),
  nivel: z.string().nullable().optional(),
  orden: z.number().int().min(0),
});

export function validateOrError<T>(
  schema: z.ZodType<T>,
  data: unknown
): T | { error: string } {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  return { error: result.error.issues.map((i) => i.message).join(", ") };
}
