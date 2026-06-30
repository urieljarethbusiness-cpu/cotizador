import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ESTADOS_COTIZACION } from "@/lib/calculators";
import { cotizacionPutSchema } from "@/lib/schemas";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const cot = await prisma.cotizacion.findUnique({ where: { id } });
    if (!cot) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.cotizacion.delete({ where: { id } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cot = await prisma.cotizacion.findUnique({
      where: { id },
      include: {
        cliente: true,
        asesor: true,
        servicios: { include: { servicioCatalogo: true } },
        planBucefalo: true,
      },
    });
    if (!cot) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    }
    return NextResponse.json(cot);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Camino rápido: cambio de estado puntual (CambiarEstadoButtons envía solo
    // { estado }). El schema completo exige todos los campos de la cotización,
    // así que un PUT con solo el estado fallaría la validación; lo tratamos
    // como un patch parcial.
    const bodyKeys = Object.keys(body);
    if (bodyKeys.length === 1 && bodyKeys[0] === "estado") {
      const nuevoEstado = body.estado;
      if (!ESTADOS_COTIZACION.includes(nuevoEstado as typeof ESTADOS_COTIZACION[number])) {
        return NextResponse.json({ error: "Estado invalido" }, { status: 400 });
      }
      const existing = await prisma.cotizacion.findUnique({ where: { id } });
      if (!existing) {
        return NextResponse.json({ error: "No encontrada" }, { status: 404 });
      }
      const updated = await prisma.cotizacion.update({
        where: { id },
        data: { estado: nuevoEstado },
      });
      return NextResponse.json(updated);
    }

    const parsed = cotizacionPutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }
    const {
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
      servicios,
      planBucefalo,
    } = parsed.data;
    const estado = body.estado;

    const existing = await prisma.cotizacion.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    }

    let clienteIdFinal: string | undefined;
    if (cliente) {
      const existingCliente = await prisma.cliente.findFirst({
        where: { nombre: cliente.nombre, empresa: cliente.empresa || null },
      });
      if (existingCliente) {
        clienteIdFinal = existingCliente.id;
        await prisma.cliente.update({
          where: { id: clienteIdFinal },
          data: {
            email: cliente.email || existingCliente.email,
            telefono: cliente.telefono || existingCliente.telefono,
            rfc: cliente.rfc || existingCliente.rfc,
          },
        });
      } else {
        const newCliente = await prisma.cliente.create({
          data: {
            nombre: cliente.nombre,
            empresa: cliente.empresa || null,
            email: cliente.email || null,
            telefono: cliente.telefono || null,
            rfc: cliente.rfc || null,
          },
        });
        clienteIdFinal = newCliente.id;
      }
    }

    const esDobleFinal = esDoble ?? existing.esDoble;

    await prisma.cotizacion.update({
      where: { id },
      data: {
        ...(clienteIdFinal && { clienteId: clienteIdFinal }),
        ...(fecha && { fecha: new Date(fecha) }),
        ...(vigencia && { vigencia: new Date(vigencia) }),
        ...(moneda && { moneda }),
        ...(tipoCambio !== undefined && { tipoCambio }),
        ...(proyecto && { proyecto }),
        ...(esquemaPago && { esquemaPago }),
        ...(incluirBonos !== undefined && { incluirBonos }),
        ...(incluirFinanciamiento !== undefined && { incluirFinanciamiento }),
        ...(incluirIva !== undefined && { incluirIva }),
        ...(esDoble !== undefined && { esDoble }),
        ...(esDoble !== undefined && { opcionesMetadata: esDoble ? opciones ?? {} : undefined }),
        ...(observaciones !== undefined && { observaciones }),
        ...(estado && ESTADOS_COTIZACION.includes(estado as typeof ESTADOS_COTIZACION[number]) && { estado }),
      },
    });

    if (servicios && Array.isArray(servicios)) {
      // El servicio Bucéfalo del catálogo se resuelve una sola vez, no por partida.
      const necesitaBucefalo = servicios.some(
        (s) => !s.esPersonalizado && s.catalogoId?.startsWith("bucefalo-")
      );
      const bucefaloCatalogoId = necesitaBucefalo
        ? (await prisma.servicioCatalogo.findFirst({
            where: { categoriaRel: { nombre: "CRM" }, tipoPago: "mensual" },
            select: { id: true },
          }))?.id ?? null
        : null;

      await prisma.$transaction(async (tx) => {
        await tx.servicioCotizado.deleteMany({ where: { cotizacionId: id } });

        await tx.servicioCotizado.createMany({
          data: servicios.map((serv) => {
            let catalogoId: string | null;
            if (serv.esPersonalizado) {
              catalogoId = null;
            } else if (serv.catalogoId?.startsWith("bucefalo-")) {
              catalogoId = bucefaloCatalogoId;
            } else {
              catalogoId = serv.catalogoId;
            }
            return {
              cotizacionId: id,
              servicioCatalogoId: catalogoId,
              nombre: serv.esPersonalizado ? serv.nombre : null,
              esPersonalizado: serv.esPersonalizado ?? false,
              horas: serv.esPersonalizado ? serv.horas ?? null : null,
              tarifaHora: serv.esPersonalizado ? serv.tarifaHora ?? null : null,
              modeloCobro: serv.modeloCobro ?? (serv.esPersonalizado ? "horas" : "fijo"),
              montoMinimo: serv.esPersonalizado ? serv.montoMinimo ?? null : null,
              horasIncluidas: serv.esPersonalizado ? serv.horasIncluidas ?? null : null,
              opcion: esDobleFinal ? serv.opcion ?? "ambas" : null,
              fase: serv.fase,
              tipoPago: serv.tipoPago,
              // "demanda": tarifa por hora sin compromiso; nunca suma al total.
              precio: serv.modeloCobro === "demanda" ? 0 : serv.precio,
              tiempoEntrega: serv.tiempoEntrega,
              entregables: serv.entregables,
              beneficios: serv.beneficios ?? [],
              seleccionado: true,
            };
          }),
        });
      });
    }

    if (planBucefalo) {
      await prisma.planBucefaloCotizacion.upsert({
        where: { cotizacionId: id },
        update: { nivel: planBucefalo.nivel, precio: planBucefalo.precio },
        create: {
          cotizacionId: id,
          nivel: planBucefalo.nivel,
          precio: planBucefalo.precio,
        },
      });
    } else {
      await prisma.planBucefaloCotizacion.deleteMany({ where: { cotizacionId: id } });
    }

    const updated = await prisma.cotizacion.findUnique({
      where: { id },
      include: { cliente: true, asesor: true, servicios: true },
    });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    console.error("Error updating cotizacion:", error);
    const msg = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
