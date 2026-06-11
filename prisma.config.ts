import "dotenv/config";
import { defineConfig } from "prisma/config";

// El CLI de Prisma (migrate deploy) necesita una URL. Si DATABASE_URL no está
// definida (p. ej. despliegue Dockerfile en Coolify), se arma desde las DB_*
// que ya usan la app y el seed — así ambas vías apuntan a la misma BD.
function databaseUrl(): string {
  if (process.env["DATABASE_URL"]) return process.env["DATABASE_URL"];
  const host = process.env["DB_HOST"] || "localhost";
  const port = process.env["DB_PORT"] || "5432";
  const user = encodeURIComponent(process.env["DB_USER"] || "postgres");
  const password = encodeURIComponent(process.env["DB_PASSWORD"] || "postgres");
  const name = process.env["DB_NAME"] || "cotizador_e3";
  return `postgresql://${user}:${password}@${host}:${port}/${name}`;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    url: databaseUrl(),
  },
});
