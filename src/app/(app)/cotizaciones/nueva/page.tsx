import { CotizacionForm } from "@/components/CotizacionForm";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function NuevaCotizacionPage() {
  const [servicios, asesores, paquetes] = await Promise.all([
    prisma.servicioCatalogo.findMany({
      where: { activo: true },
      orderBy: { orden: "asc" },
      include: { categoriaRel: true },
    }),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
    prisma.paquete.findMany({
      where: { activo: true },
      include: {
        fases: {
          orderBy: { orden: "asc" },
          include: { servicios: { include: { servicio: true } } },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const lastCot = await prisma.cotizacion.findFirst({
    orderBy: { createdAt: "desc" },
    select: { numero: true },
  });

  let nextSeq = 1;
  if (lastCot) {
    const match = lastCot.numero.match(/(\d+)$/);
    if (match) nextSeq = parseInt(match[1]) + 1;
  }

  return (
    <CotizacionForm
      mode="new"
      servicios={servicios.map((s) => ({
        ...s,
        entregablesDefault: s.entregablesDefault as string[],
        categoriaNombre: s.categoriaRel?.nombre || "Sin categoria",
      }))}
      asesores={asesores}
      paquetes={paquetes.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        fases: p.fases.map((f) => ({
          nombre: f.nombre,
          orden: f.orden,
          servicios: f.servicios.map((sp) => ({
            id: sp.servicio.id,
            nombre: sp.servicio.nombre,
            fase: sp.servicio.fase,
            tipoPago: sp.servicio.tipoPago,
            precioBase: sp.servicio.precioBase,
            tiempoEntrega: sp.servicio.tiempoEntrega,
            entregablesDefault: Array.isArray(sp.servicio.entregablesDefault) ? sp.servicio.entregablesDefault as string[] : [],
          })),
        })),
      }))}
      nextSeq={nextSeq}
    />
  );
}
