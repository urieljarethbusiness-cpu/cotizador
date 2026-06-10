import { NextRequest, NextResponse } from "next/server";
import { generateCotizacionPDF } from "@/lib/pdf-generator";
import { calcularVigencia, bucefaloPrecio, sanitizeFilename } from "@/lib/calculators";
import { getConfigBranding } from "@/lib/config-helpers";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { draft } = body as {
      draft: {
        clienteNombre: string;
        clienteEmpresa: string;
        asesorNombre: string;
        fecha: string;
        moneda: string;
        tipoCambio: string;
        proyecto: string;
        esquemaPago: string;
        incluirBonos: boolean;
        servicios: {
          nombre: string;
          fase: number;
          tipoPago: string;
          precio: number;
          tiempoEntrega: string;
          entregables: string[];
        }[];
        planBucefaloNivel: string | null;
        observaciones: string;
      };
    };

    const fechaCot = new Date(draft.fecha);
    const vigencia = calcularVigencia(fechaCot);

    const branding = await getConfigBranding();
    const empresa = draft.clienteEmpresa || draft.clienteNombre;
    const nombre = `${sanitizeFilename(empresa)} - ${sanitizeFilename(draft.clienteNombre)} - BORRADOR`;

    const buffer = await generateCotizacionPDF({
      numero: "BORRADOR",
      clienteNombre: draft.clienteNombre,
      clienteEmpresa: draft.clienteEmpresa,
      asesorNombre: draft.asesorNombre,
      fecha: fechaCot,
      vigencia,
      moneda: draft.moneda,
      tipoCambio: draft.tipoCambio,
      proyecto: draft.proyecto,
      esquemaPago: draft.esquemaPago,
      servicios: draft.servicios,
      planBucefaloNivel: draft.planBucefaloNivel,
      planBucefaloPrecio: draft.planBucefaloNivel ? bucefaloPrecio(draft.planBucefaloNivel) : 0,
      incluirBonos: draft.incluirBonos,
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
