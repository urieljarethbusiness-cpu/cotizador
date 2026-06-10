import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const servicio = await prisma.servicioCatalogo.update({
      where: { id },
      data: {
        nombre: body.nombre,
        descripcion: body.descripcion || null,
        fase: body.fase,
        tipoPago: body.tipoPago,
        precioBase: body.precioBase,
        tiempoEntrega: body.tiempoEntrega,
        entregablesDefault: body.entregablesDefault || [],
        variante: body.variante || null,
        nivel: body.nivel || null,
        activo: body.activo !== false,
        orden: body.orden,
        categoriaId: body.categoriaId || null,
      },
    });
    return NextResponse.json(servicio);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const inUse = await prisma.servicioCotizado.count({
      where: { servicioCatalogoId: id },
    });
    if (inUse > 0) {
      await prisma.servicioCatalogo.update({
        where: { id },
        data: { activo: false },
      });
      return NextResponse.json({ ok: true, archived: true });
    }
    await prisma.servicioCatalogo.delete({ where: { id } });
    return NextResponse.json({ ok: true, archived: false });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
