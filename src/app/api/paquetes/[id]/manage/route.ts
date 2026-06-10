import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paqueteId } = await params;
    const body = await request.json();

    if (body.action === "addFase") {
      const fase = await prisma.fasePaquete.create({
        data: {
          paqueteId,
          nombre: body.nombre,
          orden: body.orden ?? 0,
        },
      });
      return NextResponse.json(fase, { status: 201 });
    }

    if (body.action === "updateFase") {
      const fase = await prisma.fasePaquete.update({
        where: { id: body.faseId },
        data: { nombre: body.nombre, orden: body.orden },
      });
      return NextResponse.json(fase);
    }

    if (body.action === "deleteFase") {
      await prisma.fasePaquete.delete({ where: { id: body.faseId } });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "addServicio") {
      const link = await prisma.servicioPaquete.create({
        data: {
          servicioCatalogoId: body.servicioCatalogoId,
          fasePaqueteId: body.fasePaqueteId,
        },
      });
      return NextResponse.json(link, { status: 201 });
    }

    if (body.action === "removeServicio") {
      await prisma.servicioPaquete.deleteMany({
        where: {
          servicioCatalogoId: body.servicioCatalogoId,
          fasePaqueteId: body.fasePaqueteId,
        },
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Accion desconocida" }, { status: 400 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
