import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const cats = await prisma.categoria.findMany({ orderBy: { orden: "asc" } });
    return NextResponse.json(cats);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const cat = await prisma.categoria.create({
      data: {
        nombre: body.nombre,
        descripcion: body.descripcion || null,
        color: body.color || "#6b7280",
        orden: body.orden ?? 0,
      },
    });
    return NextResponse.json(cat, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
