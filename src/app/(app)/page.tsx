import Link from "next/link";
import { FileText, Plus, Users, Database } from "lucide-react";
import { prisma } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/calculators";
import { EstadoBadge } from "@/components/EstadoBadge";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [
    totalCotizaciones,
    cotizacionesRecientes,
    totalClientes,
    totalServicios,
  ] = await Promise.all([
    prisma.cotizacion.count(),
    prisma.cotizacion.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        numero: true,
        fecha: true,
        estado: true,
        cliente: { select: { nombre: true, empresa: true } },
        servicios: {
          select: { tipoPago: true, seleccionado: true, precio: true },
        },
      },
    }),
    prisma.cliente.count(),
    prisma.servicioCatalogo.count({ where: { activo: true } }),
  ]);

  const stats = [
    {
      label: "Cotizaciones",
      value: totalCotizaciones,
      icon: FileText,
      color: "text-primary",
      bg: "bg-primary-light",
    },
    {
      label: "Clientes",
      value: totalClientes,
      icon: Users,
      color: "text-secondary",
      bg: "bg-purple-100",
    },
    {
      label: "Servicios Activos",
      value: totalServicios,
      icon: Database,
      color: "text-accent",
      bg: "bg-cyan-100",
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted text-sm mt-1">
            Bienvenido al Cotizador E3
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-card-bg rounded-xl border border-border p-5"
          >
            <div className="flex items-center gap-3">
              <div className={`${stat.bg} p-2.5 rounded-lg`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-muted text-sm">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-card-bg rounded-xl border border-border">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-lg">Cotizaciones Recientes</h2>
        </div>
        {cotizacionesRecientes.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="w-12 h-12 text-muted mx-auto mb-3" />
            <p className="text-muted">
              No hay cotizaciones. Crea la primera.
            </p>
            <Link
              href="/cotizaciones/nueva"
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark"
            >
              <Plus className="w-4 h-4" />
              Nueva Cotizacion
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-5 py-3 font-medium text-muted">
                    No.
                  </th>
                  <th className="text-left px-5 py-3 font-medium text-muted">
                    Cliente
                  </th>
                  <th className="text-left px-5 py-3 font-medium text-muted">
                    Fecha
                  </th>
                  <th className="text-left px-5 py-3 font-medium text-muted">
                    Estado
                  </th>
                  <th className="text-right px-5 py-3 font-medium text-muted">
                    Servicios
                  </th>
                </tr>
              </thead>
              <tbody>
                {cotizacionesRecientes.map((cot) => {
                  const totalUnico = cot.servicios
                    .filter((s) => s.tipoPago === "unico" && s.seleccionado)
                    .reduce((sum, s) => sum + s.precio, 0);
                  const totalMensual = cot.servicios
                    .filter(
                      (s) => s.tipoPago === "mensual" && s.seleccionado
                    )
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
                        {cot.cliente.empresa || cot.cliente.nombre}
                      </td>
                      <td className="px-5 py-3 text-muted">
                        {formatDate(cot.fecha)}
                      </td>
                      <td className="px-5 py-3">
                        <EstadoBadge estado={cot.estado} />
                      </td>
                      <td className="px-5 py-3 text-right font-medium">
                        {totalUnico > 0 && (
                          <span className="block text-xs text-muted">
                            Unico: {formatCurrency(totalUnico)}
                          </span>
                        )}
                        {totalMensual > 0 && (
                          <span className="block text-xs text-muted">
                            Mensual: {formatCurrency(totalMensual)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
