import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const paquetes = await prisma.paquete.findMany({
      where: { activo: true },
      include: {
        fases: {
          orderBy: { orden: "asc" },
          include: {
            servicios: {
              include: { servicio: { include: { categoriaRel: true } } },
              orderBy: { servicio: { orden: "asc" } },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(paquetes);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const paquete = await prisma.paquete.create({
      data: {
        nombre: body.nombre,
        descripcion: body.descripcion || null,
        fases: {
          create: (body.fases || []).map((f: { nombre: string; orden: number }, i: number) => ({
            nombre: f.nombre,
            orden: f.orden ?? i,
          })),
        },
      },
      include: { fases: true },
    });
    return NextResponse.json(paquete, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
