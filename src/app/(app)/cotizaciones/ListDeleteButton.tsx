"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ListDeleteButton({ id }: { id: string }) {
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    if (!confirm("Eliminar esta cotizacion?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/cotizaciones/${id}`, { method: "DELETE" });
      if (res.ok) router.refresh();
      else alert("Error al eliminar");
    } catch {
      alert("Error al eliminar");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
    >
      {deleting ? "..." : "Eliminar"}
    </button>
  );
}
