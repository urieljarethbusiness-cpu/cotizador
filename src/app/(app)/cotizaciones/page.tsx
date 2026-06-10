import Link from "next/link";
import { Plus, FileText } from "lucide-react";
import { prisma } from "@/lib/db";
import { CotizacionesList } from "./CotizacionesList";

export const dynamic = "force-dynamic";

export default async function CotizacionesPage() {
  const cotizaciones = await prisma.cotizacion.findMany({
    orderBy: { createdAt: "desc" },
    include: { cliente: true, asesor: true, servicios: true },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Cotizaciones</h1>
          <p className="text-muted text-sm mt-1">
            {cotizaciones.length} cotizaciones registradas
          </p>
        </div>
        <Link
          href="/cotizaciones/nueva"
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors font-medium text-sm"
        >
          <Plus className="w-4 h-4" />
          Nueva Cotizacion
        </Link>
      </div>

      {cotizaciones.length === 0 ? (
        <div className="bg-card-bg rounded-xl border border-border p-12 text-center">
          <FileText className="w-16 h-16 text-muted mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">
            No hay cotizaciones
          </h2>
          <p className="text-muted mb-4">
            Comienza creando tu primera cotizacion
          </p>
          <Link
            href="/cotizaciones/nueva"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark"
          >
            <Plus className="w-4 h-4" />
            Crear Cotizacion
          </Link>
        </div>
      ) : (
        <CotizacionesList cotizaciones={cotizaciones} />
      )}
    </div>
  );
}
