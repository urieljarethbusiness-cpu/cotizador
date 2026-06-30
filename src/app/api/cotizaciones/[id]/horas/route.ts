import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { registroHorasSchema } from "@/lib/schemas";
import {
  calcularHorasRango,
  esCotizacionPorTiempo,
  fechaRegistroDesdeISO,
  tarifaHoraSugerida,
} from "@/lib/calculators";

// GET /api/cotizaciones/:id/horas?from=YYYY-MM-DD&to=YYYY-MM-DD
// Lista los registros de horas de la cotizacion (orden cronologico). Filtros from/to
// opcionales para acotar el periodo de una nota de pago.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sp = request.nextUrl.searchParams;
    const from = sp.get("from");
    const to = sp.get("to");

    const fechaFilter: { gte?: Date; lte?: Date } = {};
    if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) fechaFilter.gte = fechaRegistroDesdeISO(from);
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) fechaFilter.lte = fechaRegistroDesdeISO(to);

    const registros = await prisma.registroHoras.findMany({
      where: {
        cotizacionId: id,
        ...(Object.keys(fechaFilter).length > 0 && { fecha: fechaFilter }),
      },
      orderBy: [{ fecha: "asc" }, { horaInicio: "asc" }],
    });

    return NextResponse.json(registros);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/cotizaciones/:id/horas
// Crea un registro de horas. Solo para cotizaciones con cobro por tiempo. `horas` se
// calcula del rango en el servidor; si la tarifa no viene, se usa la sugerida.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const parsed = registroHorasSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }
    const { fecha, horaInicio, horaFin, descripcion, tarifaHora } = parsed.data;

    const horas = calcularHorasRango(horaInicio, horaFin);
    if (horas <= 0) {
      return NextResponse.json(
        { error: "El rango de horas es invalido (la hora fin debe ser mayor a la de inicio)" },
        { status: 400 }
      );
    }

    const cot = await prisma.cotizacion.findUnique({
      where: { id },
      include: { servicios: true },
    });
    if (!cot) {
      return NextResponse.json({ error: "Cotizacion no encontrada" }, { status: 404 });
    }
    if (!esCotizacionPorTiempo(cot.servicios)) {
      return NextResponse.json(
        { error: "Esta cotizacion no se cobra por tiempo; no admite registro de horas" },
        { status: 400 }
      );
    }

    const tarifa = tarifaHora ?? tarifaHoraSugerida(cot.servicios);

    const registro = await prisma.registroHoras.create({
      data: {
        cotizacionId: id,
        fecha: fechaRegistroDesdeISO(fecha),
        horaInicio,
        horaFin,
        horas,
        tarifaHora: tarifa,
        descripcion: descripcion.trim(),
      },
    });

    return NextResponse.json(registro, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
