import { CotizacionForm } from "@/components/CotizacionForm";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EditarCotizacionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [cot, servicios, asesores] = await Promise.all([
    prisma.cotizacion.findUnique({
      where: { id },
      include: {
        cliente: true,
        asesor: true,
        servicios: { include: { servicioCatalogo: true } },
        planBucefalo: true,
      },
    }),
    prisma.servicioCatalogo.findMany({ where: { activo: true }, orderBy: { orden: "asc" }, include: { categoriaRel: true } }),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!cot) notFound();

  const existingData = {
    id: cot.id,
    numero: cot.numero,
    clienteNombre: cot.cliente.nombre,
    clienteEmpresa: cot.cliente.empresa || "",
    clienteEmail: cot.cliente.email || "",
    clienteTelefono: cot.cliente.telefono || "",
    asesorId: cot.asesorId,
    asesorNombre: cot.asesor.name,
    fecha: cot.fecha,
    vigencia: cot.vigencia,
    moneda: cot.moneda,
    tipoCambio: cot.tipoCambio,
    proyecto: cot.proyecto,
    esquemaPago: cot.esquemaPago,
    incluirBonos: cot.incluirBonos,
    incluirFinanciamiento: cot.incluirFinanciamiento,
    observaciones: cot.observaciones || "",
    planBucefaloNivel: cot.planBucefalo?.nivel || null,
    servicios: cot.servicios.map((s) => ({
      catalogoId: s.servicioCatalogoId,
      nombre: s.servicioCatalogo?.nombre || "Servicio",
      fase: s.fase,
      tipoPago: s.tipoPago,
      precio: s.precio,
      tiempoEntrega: s.tiempoEntrega,
      entregables: Array.isArray(s.entregables) ? (s.entregables as string[]) : [],
    })),
    estado: cot.estado,
  };

  return (
    <CotizacionForm
      mode="edit"
      existingData={existingData}
      servicios={servicios.map((s) => ({
        ...s,
        entregablesDefault: s.entregablesDefault as string[],
        categoriaNombre: s.categoriaRel?.nombre || "Sin categoria",
      }))}
      asesores={asesores}
    />
  );
}
