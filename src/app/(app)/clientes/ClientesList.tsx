"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { NuevaCotizacionClienteButton } from "./NuevaCotizacionClienteButton";

interface Cliente {
  id: string;
  nombre: string;
  empresa: string | null;
  email: string | null;
  telefono: string | null;
  _count: { cotizaciones: number };
}

export function ClientesList({ clientes }: { clientes: Cliente[] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return clientes;
    const q = search.toLowerCase();
    return clientes.filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) ||
        (c.empresa || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q)
    );
  }, [clientes, search]);

  return (
    <>
      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, empresa, email..."
            className="w-full pl-10 pr-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-muted py-8">
          {search ? "Sin resultados para esa busqueda" : "No hay clientes"}
        </p>
      ) : (
        <div className="bg-card-bg rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-gray-50">
                <th className="text-left px-5 py-3 font-medium text-muted">
                  Nombre
                </th>
                <th className="text-left px-5 py-3 font-medium text-muted">
                  Empresa
                </th>
                <th className="text-left px-5 py-3 font-medium text-muted">
                  Email
                </th>
                <th className="text-left px-5 py-3 font-medium text-muted">
                  Telefono
                </th>
                <th className="text-center px-5 py-3 font-medium text-muted">
                  Cotizaciones
                </th>
                <th className="text-center px-5 py-3 font-medium text-muted w-16" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-border hover:bg-gray-50"
                >
                  <td className="px-5 py-3 font-medium">{c.nombre}</td>
                  <td className="px-5 py-3">{c.empresa || "-"}</td>
                  <td className="px-5 py-3 text-muted">{c.email || "-"}</td>
                  <td className="px-5 py-3 text-muted">{c.telefono || "-"}</td>
                  <td className="px-5 py-3 text-center">
                    <span className="inline-block px-2 py-0.5 bg-primary-light text-primary rounded text-xs font-medium">
                      {c._count.cotizaciones}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <NuevaCotizacionClienteButton
                      clienteNombre={c.nombre}
                      clienteEmpresa={c.empresa || ""}
                      clienteEmail={c.email || ""}
                      clienteTelefono={c.telefono || ""}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
