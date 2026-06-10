import { prisma } from "@/lib/db";
import { formatDate, formatCurrency, IVA_RATE } from "@/lib/calculators";
import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import { notFound } from "next/navigation";
import { ExportExcelButtonSaved, ExportPDFButtonSaved } from "@/components/ExportButtons";
import { DeleteCotizacionButton } from "./DeleteButton";
import { CambiarEstadoButtons } from "./CambiarEstadoButtons";
import { PreciosEditables } from "./PreciosEditables";

export const dynamic = "force-dynamic";

export default async function CotizacionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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

  if (!cot) notFound();

  const serviciosUnicos = cot.servicios
    .filter((s) => s.tipoPago === "unico" && s.seleccionado)
    .map((s) => ({
      id: s.id,
      nombre: s.servicioCatalogo?.nombre || "Servicio",
      precio: s.precio,
    }));

  const serviciosMensuales = cot.servicios
    .filter((s) => s.tipoPago === "mensual" && s.seleccionado)
    .map((s) => ({
      id: s.id,
      nombre: s.servicioCatalogo?.nombre || "Servicio",
      precio: s.precio,
    }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            href="/cotizaciones"
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{cot.numero}</h1>
            <p className="text-muted text-sm">
              {cot.cliente.empresa || cot.cliente.nombre} | {cot.proyecto}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ExportPDFButtonSaved cotizacionId={cot.id} />
          <ExportExcelButtonSaved cotizacionId={cot.id} />
          <Link
            href={`/cotizaciones/${cot.id}/editar`}
            className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-gray-50"
          >
            <Pencil className="w-4 h-4" />
            Editar
          </Link>
          <DeleteCotizacionButton cotizacionId={cot.id} cotizacionNumero={cot.numero} />
        </div>
      </div>

      <div className="bg-card-bg rounded-xl border border-border p-5 mb-6">
        <h2 className="font-semibold text-lg mb-4">Informacion de la Cotizacion</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-muted">Cliente</span>
            <p className="font-medium">{cot.cliente.nombre}</p>
          </div>
          <div>
            <span className="text-muted">Empresa</span>
            <p className="font-medium">{cot.cliente.empresa || "-"}</p>
          </div>
          <div>
            <span className="text-muted">Asesor</span>
            <p className="font-medium">{cot.asesor.name}</p>
          </div>
          <div>
            <span className="text-muted">Fecha</span>
            <p className="font-medium">{formatDate(cot.fecha)}</p>
          </div>
          <div>
            <span className="text-muted">Vigencia</span>
            <p className="font-medium">{formatDate(cot.vigencia)}</p>
          </div>
          <div>
            <span className="text-muted">Moneda</span>
            <p className="font-medium">{cot.moneda}</p>
          </div>
          <div>
            <span className="text-muted">Esquema</span>
            <p className="font-medium">{cot.esquemaPago}</p>
          </div>
          <div>
            <span className="text-muted">Estado</span>
            <div className="mt-0.5">
              <CambiarEstadoButtons cotizacionId={cot.id} estado={cot.estado} />
            </div>
          </div>
        </div>
      </div>

      <PreciosEditables
        cotizacionId={cot.id}
        serviciosUnicos={serviciosUnicos}
        serviciosMensuales={serviciosMensuales}
      />

      {cot.observaciones && (
        <div className="bg-card-bg rounded-xl border border-border p-5">
          <h3 className="font-semibold mb-2">Observaciones</h3>
          <p className="text-sm text-muted whitespace-pre-wrap">{cot.observaciones}</p>
        </div>
      )}
    </div>
  );
}
