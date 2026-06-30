import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateCotizacionPDF } from "@/lib/pdf-generator";
import { getConfigBranding, getConfigBancaria } from "@/lib/config-helpers";
import { sanitizeFilename } from "@/lib/calculators";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [cot, config, branding] = await Promise.all([
      prisma.cotizacion.findUnique({
        where: { id },
        include: {
          cliente: true,
          asesor: true,
          servicios: { include: { servicioCatalogo: true } },
          planBucefalo: true,
        },
      }),
      getConfigBancaria(),
      getConfigBranding(),
    ]);

    if (!cot) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    }
    const empresa = cot.cliente.empresa || cot.cliente.nombre;
    const nombre = `${sanitizeFilename(empresa)} - ${sanitizeFilename(cot.cliente.nombre)} - ${cot.numero}`;

    const buffer = await generateCotizacionPDF({
      numero: cot.numero,
      clienteNombre: cot.cliente.nombre,
      clienteEmpresa: cot.cliente.empresa || "",
      clienteRfc: cot.cliente.rfc || "",
      asesorNombre: cot.asesor.name,
      fecha: cot.fecha,
      vigencia: cot.vigencia,
      moneda: cot.moneda,
      tipoCambio: cot.tipoCambio,
      proyecto: cot.proyecto,
      esquemaPago: cot.esquemaPago,
      servicios: cot.servicios.filter((s) => s.seleccionado).map((s) => ({
        nombre: s.servicioCatalogo?.nombre || s.nombre || "Servicio",
        fase: s.fase,
        tipoPago: s.tipoPago,
        precio: s.precio,
        tiempoEntrega: s.tiempoEntrega,
        entregables: Array.isArray(s.entregables) ? (s.entregables as string[]) : [],
        beneficios: Array.isArray(s.beneficios) ? (s.beneficios as string[]) : [],
        esPersonalizado: s.esPersonalizado,
        horas: s.horas ?? undefined,
        tarifaHora: s.tarifaHora ?? undefined,
        modeloCobro: s.modeloCobro ?? undefined,
        montoMinimo: s.montoMinimo ?? undefined,
        horasIncluidas: s.horasIncluidas ?? undefined,
        opcion: s.opcion ?? undefined,
      })),
      esDoble: cot.esDoble,
      opcionesMetadata: cot.opcionesMetadata as never,
      planBucefaloNivel: cot.planBucefalo?.nivel || null,
      planBucefaloPrecio: cot.planBucefalo?.precio || 0,
      incluirBonos: cot.incluirBonos,
      incluirIva: cot.incluirIva,
      configBancaria: config,
      ...branding,
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${nombre}.pdf"`,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
