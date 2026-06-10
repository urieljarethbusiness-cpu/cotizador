import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const cat = await prisma.categoria.update({
      where: { id },
      data: {
        nombre: body.nombre,
        descripcion: body.descripcion || null,
        color: body.color,
        orden: body.orden,
        activo: body.activo !== false,
      },
    });
    return NextResponse.json(cat);
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
    const inUse = await prisma.servicioCatalogo.count({ where: { categoriaId: id } });
    if (inUse > 0) {
      return NextResponse.json(
        { error: `Tiene ${inUse} servicios asociados. Desactiva la categoria en su lugar.` },
        { status: 409 }
      );
    }
    await prisma.categoria.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
