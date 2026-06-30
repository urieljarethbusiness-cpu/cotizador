import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { registroHorasSchema } from "@/lib/schemas";
import { calcularHorasRango, fechaRegistroDesdeISO } from "@/lib/calculators";

// PUT /api/cotizaciones/:id/horas/:registroId
// Edita un registro de horas. Recalcula `horas` del rango.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; registroId: string }> }
) {
  try {
    const { id, registroId } = await params;
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

    const existing = await prisma.registroHoras.findUnique({ where: { id: registroId } });
    if (!existing || existing.cotizacionId !== id) {
      return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });
    }

    const registro = await prisma.registroHoras.update({
      where: { id: registroId },
      data: {
        fecha: fechaRegistroDesdeISO(fecha),
        horaInicio,
        horaFin,
        horas,
        descripcion: descripcion.trim(),
        ...(tarifaHora !== undefined && { tarifaHora }),
      },
    });

    return NextResponse.json(registro);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/cotizaciones/:id/horas/:registroId
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; registroId: string }> }
) {
  try {
    const { id, registroId } = await params;

    const existing = await prisma.registroHoras.findUnique({ where: { id: registroId } });
    if (!existing || existing.cotizacionId !== id) {
      return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });
    }

    await prisma.registroHoras.delete({ where: { id: registroId } });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
