import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const servicios = await prisma.servicioCatalogo.findMany({
      where: { activo: true },
      orderBy: [{ fase: "asc" }, { orden: "asc" }],
      include: { categoriaRel: true },
    });

    const FASES: Record<number, string> = {
      0: "Auditoria",
      1: "Setup e Infraestructura",
      2: "Publicidad y Manejo",
      3: "Contenido y SEO",
    };

    const header = "Nombre,Categoria,Fase,Tipo de Pago,Precio Base,Tiempo de Entrega,Entregables,Variante\n";
    const rows = servicios.map((s) =>
      [
        csvEscape(s.nombre),
        csvEscape(s.categoriaRel?.nombre || ""),
        csvEscape(FASES[s.fase] || `Fase ${s.fase}`),
        csvEscape(s.tipoPago === "unico" ? "Pago Unico" : "Mensual"),
        s.precioBase.toString(),
        csvEscape(s.tiempoEntrega),
        csvEscape((s.entregablesDefault as string[]).join(" | ")),
        csvEscape(s.variante || ""),
      ].join(",")
    ).join("\n");

    return new NextResponse(header + rows, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=catalogo-servicios.csv",
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function csvEscape(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}
