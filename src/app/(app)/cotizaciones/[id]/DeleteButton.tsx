"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteCotizacionButton({
  cotizacionId,
  cotizacionNumero,
}: {
  cotizacionId: string;
  cotizacionNumero: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/cotizaciones/${cotizacionId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.push("/cotizaciones");
      } else {
        alert("Error al eliminar");
        setConfirming(false);
      }
    } catch {
      alert("Error al eliminar");
      setConfirming(false);
    } finally {
      setDeleting(false);
    }
  };

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-red-600 font-medium">
          Eliminar {cotizacionNumero}?
        </span>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
        >
          {deleting ? "Eliminando..." : "Si, eliminar"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="px-3 py-2 border border-border rounded-lg text-sm hover:bg-gray-50"
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="flex items-center gap-2 px-3 py-2 border border-red-200 rounded-lg text-sm text-red-600 hover:bg-red-50"
    >
      <Trash2 className="w-4 h-4" />
      Eliminar
    </button>
  );
}
