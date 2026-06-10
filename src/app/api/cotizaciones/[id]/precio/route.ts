import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  servicioId: z.string().min(1),
  precio: z.number().min(0),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }

    const { servicioId, precio } = parsed.data;

    const serv = await prisma.servicioCotizado.findFirst({
      where: { id: servicioId, cotizacionId: id },
    });

    if (!serv) {
      return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 });
    }

    await prisma.servicioCotizado.update({
      where: { id: servicioId },
      data: { precio },
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
