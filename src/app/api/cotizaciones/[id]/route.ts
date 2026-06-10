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

    if (cliente) {
      const existingCliente = await prisma.cliente.findFirst({
        where: { nombre: cliente.nombre, empresa: cliente.empresa || null },
      });
      let clienteId = existing.clienteId;
      if (existingCliente) {
        clienteId = existingCliente.id;
        await prisma.cliente.update({
          where: { id: clienteId },
          data: {
            email: cliente.email || existingCliente.email,
            telefono: cliente.telefono || existingCliente.telefono,
          },
        });
      } else {
        const newCliente = await prisma.cliente.create({
          data: {
            nombre: cliente.nombre,
            empresa: cliente.empresa || null,
            email: cliente.email || null,
            telefono: cliente.telefono || null,
          },
        });
        clienteId = newCliente.id;
      }

      await prisma.cotizacion.update({
        where: { id },
        data: { clienteId },
      });
    }

    await prisma.cotizacion.update({
      where: { id },
      data: {
        ...(fecha && { fecha: new Date(fecha) }),
        ...(vigencia && { vigencia: new Date(vigencia) }),
        ...(moneda && { moneda }),
        ...(tipoCambio !== undefined && { tipoCambio }),
        ...(proyecto && { proyecto }),
        ...(esquemaPago && { esquemaPago }),
        ...(incluirBonos !== undefined && { incluirBonos }),
        ...(incluirFinanciamiento !== undefined && { incluirFinanciamiento }),
        ...(observaciones !== undefined && { observaciones }),
        ...(estado && ESTADOS_COTIZACION.includes(estado as typeof ESTADOS_COTIZACION[number]) && { estado }),
      },
    });

    if (servicios && Array.isArray(servicios)) {
      await prisma.$transaction(async (tx) => {
        await tx.servicioCotizado.deleteMany({ where: { cotizacionId: id } });

        for (const serv of servicios) {
          const catalogoId = serv.catalogoId?.startsWith("bucefalo-")
            ? (await tx.servicioCatalogo.findFirst({
                where: { categoriaRel: { nombre: "CRM" }, tipoPago: "mensual" },
              }))?.id || serv.catalogoId
            : serv.catalogoId;

          await tx.servicioCotizado.create({
            data: {
              cotizacionId: id,
              servicioCatalogoId: catalogoId,
              fase: serv.fase,
              tipoPago: serv.tipoPago,
              precio: serv.precio,
              tiempoEntrega: serv.tiempoEntrega,
              entregables: serv.entregables,
              seleccionado: true,
            },
          });
        }
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
