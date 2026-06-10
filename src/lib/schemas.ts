import { z } from "zod";

const servicioSchema = z.object({
  catalogoId: z.string().min(1),
  nombre: z.string().min(1),
  fase: z.number().int().min(0).max(3),
  tipoPago: z.enum(["unico", "mensual"]),
  precio: z.number().min(0),
  tiempoEntrega: z.string().min(1),
  entregables: z.array(z.string()),
  esPersonalizado: z.boolean().optional(),
  horas: z.number().min(0).optional(),
  tarifaHora: z.number().min(0).optional(),
  modeloCobro: z.enum(["fijo", "horas", "retainer"]).optional(),
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
  esquemaPago: z.enum(["Pago Unico", "Mensual", "Pago Unico/Mensual"]),
  incluirBonos: z.boolean(),
  incluirFinanciamiento: z.boolean(),
  esDoble: z.boolean().optional(),
  opciones: opcionesSchema,
  observaciones: z.string(),
  asesorId: z.string().min(1),
  cliente: z.object({
    nombre: z.string().min(1, "Cliente nombre es requerido"),
    empresa: z.string(),
    email: z.string().email().or(z.literal("")),
    telefono: z.string(),
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
  esquemaPago: z.enum(["Pago Unico", "Mensual", "Pago Unico/Mensual"]),
  incluirBonos: z.boolean(),
  incluirFinanciamiento: z.boolean(),
  esDoble: z.boolean().optional(),
  opciones: opcionesSchema,
  observaciones: z.string(),
  cliente: z.object({
    nombre: z.string().min(1, "Cliente nombre es requerido"),
    empresa: z.string(),
    email: z.string().email().or(z.literal("")),
    telefono: z.string(),
  }),
  servicios: z.array(servicioSchema),
  planBucefalo: z
    .object({
      nivel: z.string(),
      precio: z.number().min(0),
    })
    .nullable(),
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
