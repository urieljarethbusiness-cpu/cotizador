import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const configs = await prisma.configuracion.findMany();
    const map: Record<string, string> = {};
    for (const c of configs) {
      map[c.clave] = c.valor;
    }
    return NextResponse.json(map);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, string>;

    const allowedKeys = [
      "color_primario",
      "color_secundario",
      "logo_base64",
      "razon_social",
      "rfc",
      "domicilio_fiscal",
      "cuenta_nacional",
      "clabe_interbancaria",
      "cuenta_internacional",
      "cuenta_internacional_swift",
      "hora_centinela",
      "anualidad_hosting",
      "iva",
      "terminos_condiciones",
      "no_incluye",
      "notas_adicionales",
    ];

    const ops = Object.entries(body)
      .filter(([clave]) => allowedKeys.includes(clave))
      .map(([clave, valor]) =>
        prisma.configuracion.upsert({
          where: { clave },
          update: { valor },
          create: { clave, valor },
        })
      );

    await prisma.$transaction(ops);

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
