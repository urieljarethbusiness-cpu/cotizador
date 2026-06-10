import { prisma } from "@/lib/db";
import { CatalogoClient } from "./CatalogoClient";

export const dynamic = "force-dynamic";

export default async function CatalogoPage() {
  const [servicios, categorias, paquetes] = await Promise.all([
    prisma.servicioCatalogo.findMany({
      orderBy: [{ fase: "asc" }, { orden: "asc" }],
      include: { categoriaRel: true, paquetes: { include: { fasePaquete: true } } },
    }),
    prisma.categoria.findMany({ orderBy: { orden: "asc" } }),
    prisma.paquete.findMany({
      where: { activo: true },
      include: {
        fases: {
          orderBy: { orden: "asc" },
          include: {
            servicios: { include: { servicio: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <CatalogoClient
      initialServicios={servicios.map((s) => ({
        id: s.id,
        nombre: s.nombre,
        descripcion: s.descripcion,
        fase: s.fase,
        tipoPago: s.tipoPago,
        precioBase: s.precioBase,
        tiempoEntrega: s.tiempoEntrega,
        entregablesDefault: Array.isArray(s.entregablesDefault) ? (s.entregablesDefault as string[]) : [],
        categoriaId: s.categoriaId,
        categoriaNombre: s.categoriaRel?.nombre || "Sin categoria",
        categoriaColor: s.categoriaRel?.color || "#6b7280",
        variante: s.variante,
        activo: s.activo,
        orden: s.orden,
      }))}
      initialCategorias={categorias}
      initialPaquetes={paquetes.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        descripcion: p.descripcion,
        fases: p.fases.map((f) => ({
          id: f.id,
          nombre: f.nombre,
          orden: f.orden,
          servicios: f.servicios.map((sp) => sp.servicio),
        })),
      }))}
    />
  );
}
