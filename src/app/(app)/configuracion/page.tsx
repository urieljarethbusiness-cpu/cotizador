import { prisma } from "@/lib/db";
import { ConfiguracionClient } from "./ConfiguracionClient";

export const dynamic = "force-dynamic";

export default async function ConfiguracionPage() {
  const configs = await prisma.configuracion.findMany();
  const map: Record<string, string> = {};
  for (const c of configs) map[c.clave] = c.valor;

  return <ConfiguracionClient initial={map} />;
}
