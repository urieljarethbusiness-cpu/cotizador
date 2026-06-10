"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const OPCIONES = [
  { value: "borrador", label: "Borrador" },
  { value: "enviada", label: "Enviada" },
  { value: "aprobada", label: "Aprobada" },
  { value: "rechazada", label: "Rechazada" },
];

export function CambiarEstadoButtons({ cotizacionId, estado }: { cotizacionId: string; estado: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleChange = async (nuevoEstado: string) => {
    if (nuevoEstado === estado) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/cotizaciones/${cotizacionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      if (res.ok) router.refresh();
      else alert("Error al cambiar estado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <select
      value={estado}
      onChange={(e) => handleChange(e.target.value)}
      disabled={loading}
      className="text-xs font-medium px-2 py-1 rounded-full border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
    >
      {OPCIONES.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
