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
      incluirIva,
      esDoble,
      opciones,
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
          rfc: cliente.rfc || null,
        },
      });
    }

    const clienteIdFinal = clienteRecord.id;

    // El servicio Bucéfalo del catálogo es el mismo para todas las partidas:
    // se resuelve una sola vez fuera del loop de inserción.
    const necesitaBucefalo = servicios.some(
      (s) => !s.esPersonalizado && s.catalogoId.startsWith("bucefalo-")
    );
    const bucefaloCatalogoId = necesitaBucefalo
      ? (await prisma.servicioCatalogo.findFirst({
          where: { categoriaRel: { nombre: "CRM" }, tipoPago: "mensual" },
          select: { id: true },
        }))?.id ?? null
      : null;

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
          incluirIva: incluirIva ?? true,
          esDoble: esDoble ?? false,
          opcionesMetadata: esDoble ? opciones ?? {} : undefined,
          observaciones: observaciones || null,
          clienteId: clienteIdFinal,
          asesorId,
          estado: "borrador",
        },
      });

      await tx.servicioCotizado.createMany({
        data: servicios.map((servicio) => {
          let catalogoId: string | null;
          if (servicio.esPersonalizado) {
            catalogoId = null;
          } else if (servicio.catalogoId.startsWith("bucefalo-")) {
            catalogoId = bucefaloCatalogoId;
          } else {
            catalogoId = servicio.catalogoId;
          }
          return {
            cotizacionId: cot.id,
            servicioCatalogoId: catalogoId,
            nombre: servicio.esPersonalizado ? servicio.nombre : null,
            esPersonalizado: servicio.esPersonalizado ?? false,
            horas: servicio.esPersonalizado ? servicio.horas ?? null : null,
            tarifaHora: servicio.esPersonalizado ? servicio.tarifaHora ?? null : null,
            modeloCobro: servicio.modeloCobro ?? (servicio.esPersonalizado ? "horas" : "fijo"),
            montoMinimo: servicio.esPersonalizado ? servicio.montoMinimo ?? null : null,
            horasIncluidas: servicio.esPersonalizado ? servicio.horasIncluidas ?? null : null,
            opcion: esDoble ? servicio.opcion ?? "ambas" : null,
            fase: servicio.fase,
            tipoPago: servicio.tipoPago,
            // "demanda": tarifa por hora sin compromiso; nunca suma al total.
            precio: servicio.modeloCobro === "demanda" ? 0 : servicio.precio,
            tiempoEntrega: servicio.tiempoEntrega,
            entregables: servicio.entregables,
            beneficios: servicio.beneficios ?? [],
            seleccionado: true,
          };
        }),
      });

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
