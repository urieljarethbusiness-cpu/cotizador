"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Search } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/calculators";
import { EstadoBadge } from "@/components/EstadoBadge";
import { ListDeleteButton } from "./ListDeleteButton";

interface Cotizacion {
  id: string;
  numero: string;
  estado: string;
  fecha: Date;
  cliente: { nombre: string; empresa: string | null };
  asesor: { name: string };
  servicios: { tipoPago: string; seleccionado: boolean; precio: number }[];
}

export function CotizacionesList({
  cotizaciones,
}: {
  cotizaciones: Cotizacion[];
}) {
  const [search, setSearch] = useState("");

  const filtered = cotizaciones.filter((cot) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      cot.numero.toLowerCase().includes(q) ||
      cot.cliente.nombre.toLowerCase().includes(q) ||
      (cot.cliente.empresa || "").toLowerCase().includes(q) ||
      cot.asesor.name.toLowerCase().includes(q) ||
      cot.estado.toLowerCase().includes(q)
    );
  });

  return (
    <>
      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por numero, cliente, asesor..."
            className="w-full pl-10 pr-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-muted py-8">
          {search ? "Sin resultados para esa busqueda" : "No hay cotizaciones"}
        </p>
      ) : (
        <div className="bg-card-bg rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-gray-50">
                <th className="text-left px-5 py-3 font-medium text-muted">
                  No. Cotizacion
                </th>
                <th className="text-left px-5 py-3 font-medium text-muted">
                  Cliente
                </th>
                <th className="text-left px-5 py-3 font-medium text-muted">
                  Asesor
                </th>
                <th className="text-left px-5 py-3 font-medium text-muted">
                  Fecha
                </th>
                <th className="text-left px-5 py-3 font-medium text-muted">
                  Estado
                </th>
                <th className="text-right px-5 py-3 font-medium text-muted">
                  Total Unico
                </th>
                <th className="text-right px-5 py-3 font-medium text-muted">
                  Total Mensual
                </th>
                <th className="text-center px-5 py-3 font-medium text-muted">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((cot) => {
                const totalUnico = cot.servicios
                  .filter((s) => s.tipoPago === "unico" && s.seleccionado)
                  .reduce((sum, s) => sum + s.precio, 0);
                const totalMensual = cot.servicios
                  .filter((s) => s.tipoPago === "mensual" && s.seleccionado)
                  .reduce((sum, s) => sum + s.precio, 0);
                return (
                  <tr
                    key={cot.id}
                    className="border-b border-border hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/cotizaciones/${cot.id}`}
                        className="text-primary font-medium hover:underline"
                      >
                        {cot.numero}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <div>
                        {cot.cliente.empresa || cot.cliente.nombre}
                      </div>
                      <div className="text-xs text-muted">
                        {cot.cliente.nombre}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-muted">
                      {cot.asesor.name}
                    </td>
                    <td className="px-5 py-3 text-muted">
                      {formatDate(cot.fecha)}
                    </td>
                    <td className="px-5 py-3">
                      <EstadoBadge estado={cot.estado} />
                    </td>
                    <td className="px-5 py-3 text-right font-medium">
                      {totalUnico > 0 ? formatCurrency(totalUnico) : "-"}
                    </td>
                    <td className="px-5 py-3 text-right font-medium">
                      {totalMensual > 0
                        ? formatCurrency(totalMensual)
                        : "-"}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-center gap-3">
                        <Link
                          href={`/cotizaciones/${cot.id}/editar`}
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          <Pencil className="w-3 h-3" />
                          Editar
                        </Link>
                        <ListDeleteButton id={cot.id} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
