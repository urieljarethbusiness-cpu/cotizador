import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getConfigBranding, getConfigBancaria } from "@/lib/config-helpers";
import { sanitizeFilename } from "@/lib/calculators";
import { buildCotizacionExcel, type ExcelData } from "@/lib/excel-builder";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [cot, branding, bancaria] = await Promise.all([
      prisma.cotizacion.findUnique({
        where: { id },
        include: {
          cliente: true,
          asesor: true,
          servicios: { include: { servicioCatalogo: true } },
          planBucefalo: true,
        },
      }),
      getConfigBranding(),
      getConfigBancaria(),
    ]);

    if (!cot) {
      return NextResponse.json({ error: "Cotizacion no encontrada" }, { status: 404 });
    }

    const empresa = cot.cliente.empresa || cot.cliente.nombre;

    const data: ExcelData = {
      razonSocial: bancaria.razon_social || "Cotizador E3",
      domicilioFiscal: bancaria.domicilio_fiscal || undefined,
      numero: cot.numero,
      clienteNombre: cot.cliente.nombre,
      clienteEmpresa: cot.cliente.empresa || "",
      asesorNombre: cot.asesor.name,
      fecha: cot.fecha,
      vigencia: cot.vigencia,
      moneda: cot.moneda,
      tipoCambio: cot.tipoCambio,
      proyecto: cot.proyecto,
      esquemaPago: cot.esquemaPago,
      servicios: cot.servicios
        .filter((s) => s.seleccionado)
        .map((s) => ({
          nombre: s.servicioCatalogo?.nombre || s.nombre || "Servicio",
          fase: s.fase,
          tipoPago: s.tipoPago,
          precio: s.precio,
          tiempoEntrega: s.tiempoEntrega,
          entregables: Array.isArray(s.entregables) ? (s.entregables as string[]) : [],
          modeloCobro: s.modeloCobro,
          esPersonalizado: s.esPersonalizado,
          horas: s.horas,
          tarifaHora: s.tarifaHora,
          montoMinimo: s.montoMinimo,
          horasIncluidas: s.horasIncluidas,
          opcion: s.opcion,
        })),
      esDoble: cot.esDoble,
      opcionesMetadata: cot.opcionesMetadata as never,
      planBucefaloNivel: cot.planBucefalo?.nivel ?? null,
      planBucefaloPrecio: cot.planBucefalo?.precio ?? null,
      colorPrimario: branding.colorPrimario || "#2563eb",
      colorSecundario: branding.colorSecundario || "#1e293b",
    };

    const buffer = await buildCotizacionExcel(data);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${sanitizeFilename(empresa)} - ${sanitizeFilename(cot.cliente.nombre)} - ${cot.numero}.xlsx"`,
      },
    });
  } catch (error: unknown) {
    console.error("Error exporting Excel:", error);
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
