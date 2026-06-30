"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useCotizacionStore } from "@/lib/store";

export function NuevaCotizacionClienteButton({
  clienteNombre,
  clienteEmpresa,
  clienteEmail,
  clienteTelefono,
  clienteRfc,
}: {
  clienteNombre: string;
  clienteEmpresa: string;
  clienteEmail: string;
  clienteTelefono: string;
  clienteRfc: string;
}) {
  const router = useRouter();
  const store = useCotizacionStore();

  const handleClick = () => {
    store.resetDraft();
    store.setField("clienteNombre", clienteNombre);
    store.setField("clienteEmpresa", clienteEmpresa);
    store.setField("clienteEmail", clienteEmail);
    store.setField("clienteTelefono", clienteTelefono);
    store.setField("clienteRfc", clienteRfc);
    router.push("/cotizaciones/nueva");
  };

  return (
    <button
      onClick={handleClick}
      className="p-1.5 text-muted hover:text-primary hover:bg-primary/5 rounded transition-colors"
      title="Nueva cotización"
    >
      <Plus className="w-4 h-4" />
    </button>
  );
}
