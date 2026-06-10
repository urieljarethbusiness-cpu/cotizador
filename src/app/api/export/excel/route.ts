import { NextRequest, NextResponse } from "next/server";
import { calcularVigencia, sanitizeFilename } from "@/lib/calculators";
import { getConfigBranding, getConfigBancaria } from "@/lib/config-helpers";
import { buildCotizacionExcel, type ExcelData } from "@/lib/excel-builder";

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
          esPersonalizado?: boolean;
          horas?: number;
          tarifaHora?: number;
          modeloCobro?: string;
          montoMinimo?: number;
          horasIncluidas?: number;
          opcion?: string;
        }[];
        planBucefaloNivel: string | null;
        observaciones: string;
        esDoble?: boolean;
        opciones?: { "1"?: { titulo?: string; descripcion?: string; noIncluye?: string }; "2"?: { titulo?: string; descripcion?: string; noIncluye?: string } };
      };
    };

    const fechaCot = new Date(draft.fecha);
    const empresa = draft.clienteEmpresa || draft.clienteNombre;

    const [branding, bancaria] = await Promise.all([
      getConfigBranding(),
      getConfigBancaria(),
    ]);

    const data: ExcelData = {
      razonSocial: bancaria.razon_social || "Cotizador E3",
      domicilioFiscal: bancaria.domicilio_fiscal || undefined,
      numero: "BORRADOR",
      clienteNombre: draft.clienteNombre,
      clienteEmpresa: draft.clienteEmpresa,
      asesorNombre: draft.asesorNombre,
      fecha: fechaCot,
      vigencia: calcularVigencia(fechaCot),
      moneda: draft.moneda,
      tipoCambio: draft.tipoCambio,
      proyecto: draft.proyecto,
      esquemaPago: draft.esquemaPago,
      servicios: draft.servicios.map((s) => ({
        nombre: s.nombre,
        fase: s.fase,
        tipoPago: s.tipoPago,
        precio: s.precio,
        tiempoEntrega: s.tiempoEntrega,
        entregables: s.entregables ?? [],
        modeloCobro: s.modeloCobro,
        esPersonalizado: s.esPersonalizado,
        horas: s.horas,
        tarifaHora: s.tarifaHora,
        montoMinimo: s.montoMinimo,
        horasIncluidas: s.horasIncluidas,
        opcion: s.opcion,
      })),
      esDoble: draft.esDoble,
      opcionesMetadata: draft.esDoble ? draft.opciones ?? null : null,
      planBucefaloNivel: draft.planBucefaloNivel,
      colorPrimario: branding.colorPrimario || "#2563eb",
      colorSecundario: branding.colorSecundario || "#1e293b",
    };

    const buffer = await buildCotizacionExcel(data);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${sanitizeFilename(empresa)} - ${sanitizeFilename(draft.clienteNombre)} - BORRADOR.xlsx"`,
      },
    });
  } catch (error: unknown) {
    console.error("Error exporting Excel:", error);
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
