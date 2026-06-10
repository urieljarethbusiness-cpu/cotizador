import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const clientes = await prisma.cliente.findMany({
    orderBy: { createdAt: "desc" },
    include: { cotizaciones: { select: { id: true } } },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-muted text-sm mt-1">
            {clientes.length} clientes registrados
          </p>
        </div>
      </div>

      {clientes.length === 0 ? (
        <div className="bg-card-bg rounded-xl border border-border p-12 text-center">
          <h2 className="text-lg font-semibold mb-2">No hay clientes</h2>
          <p className="text-muted mb-4">
            Los clientes se crean automaticamente al generar cotizaciones
          </p>
        </div>
      ) : (
        <ClientesListWrapper clientes={clientes} />
      )}
    </div>
  );
}

import { ClientesList } from "./ClientesList";

function ClientesListWrapper({
  clientes,
}: {
  clientes: {
    id: string;
    nombre: string;
    empresa: string | null;
    email: string | null;
    telefono: string | null;
    cotizaciones: { id: string }[];
  }[];
}) {
  return <ClientesList clientes={clientes} />;
}
