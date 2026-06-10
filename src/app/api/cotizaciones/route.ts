import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cotizacionPostSchema } from "@/lib/schemas";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = cotizacionPostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }
    const {
      numero,
      fecha,
      vigencia,
      moneda,
      tipoCambio,
      proyecto,
      esquemaPago,
      incluirBonos,
      incluirFinanciamiento,
      observaciones,
      cliente,
      asesorId,
      servicios,
      planBucefalo,
    } = parsed.data;

    let clienteRecord = await prisma.cliente.findFirst({
      where: {
        nombre: cliente.nombre,
        empresa: cliente.empresa || null,
      },
    });

    if (!clienteRecord) {
      clienteRecord = await prisma.cliente.create({
        data: {
          nombre: cliente.nombre,
          empresa: cliente.empresa || null,
          email: cliente.email || null,
          telefono: cliente.telefono || null,
        },
      });
    }

    const clienteIdFinal = clienteRecord.id;

    const cotizacion = await prisma.$transaction(async (tx) => {
      const cot = await tx.cotizacion.create({
        data: {
          numero,
          fecha: new Date(fecha),
          vigencia: new Date(vigencia),
          moneda,
          tipoCambio,
          proyecto,
          esquemaPago,
          incluirBonos,
          incluirFinanciamiento,
          observaciones: observaciones || null,
          clienteId: clienteIdFinal,
          asesorId,
          estado: "borrador",
        },
      });

      for (const servicio of servicios) {
        const catalogoId = servicio.catalogoId.startsWith("bucefalo-")
          ? (await tx.servicioCatalogo.findFirst({
              where: { categoriaRel: { nombre: "CRM" }, tipoPago: "mensual" },
            }))?.id || servicio.catalogoId
          : servicio.catalogoId;
        await tx.servicioCotizado.create({
          data: {
            cotizacionId: cot.id,
            servicioCatalogoId: catalogoId,
            fase: servicio.fase,
            tipoPago: servicio.tipoPago,
            precio: servicio.precio,
            tiempoEntrega: servicio.tiempoEntrega,
            entregables: servicio.entregables,
            seleccionado: true,
          },
        });
      }

      if (planBucefalo) {
        await tx.planBucefaloCotizacion.create({
          data: {
            cotizacionId: cot.id,
            nivel: planBucefalo.nivel,
            precio: planBucefalo.precio,
            seleccionado: true,
          },
        });
      }

      return cot;
    });

    return NextResponse.json(cotizacion, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating cotizacion:", error);
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const cotizaciones = await prisma.cotizacion.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        cliente: true,
        asesor: true,
        servicios: { include: { servicioCatalogo: true } },
        planBucefalo: true,
      },
    });
    return NextResponse.json(cotizaciones);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
