import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { servicioCatalogoSchema } from "@/lib/schemas";

export async function GET() {
  try {
    const servicios = await prisma.servicioCatalogo.findMany({
      orderBy: [{ fase: "asc" }, { orden: "asc" }],
    });
    return NextResponse.json(servicios);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = servicioCatalogoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }
    const servicio = await prisma.servicioCatalogo.create({
      data: {
        nombre: parsed.data.nombre,
        descripcion: parsed.data.descripcion,
        fase: parsed.data.fase,
        tipoPago: parsed.data.tipoPago,
        precioBase: parsed.data.precioBase,
        tiempoEntrega: parsed.data.tiempoEntrega,
        entregablesDefault: parsed.data.entregablesDefault,
        categoriaId: parsed.data.categoriaId,
        variante: parsed.data.variante,
        nivel: parsed.data.nivel ?? null,
        activo: true,
        orden: parsed.data.orden,
      },
    });
    return NextResponse.json(servicio, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
