# Cotizador

Sistema de generación de cotizaciones para Uriel Jareth Consulting (marketing digital, Querétaro MX).
Servicios organizados en 4 fases, dos tipos de pago (único / mensual), planes CRM Bucéfalo
y financiamiento opcional. Exporta a PDF y Excel.

## Stack

- **Frontend / app web:** Next.js 16 (App Router) + React 19 + Tailwind CSS v4 + Zustand
- **ORM:** Prisma 7 (cliente generado en `src/generated/prisma`, driver adapter `PrismaPg`)
- **Base de datos:** PostgreSQL 16 (vía Docker)
- **Auth:** JWT (`jose`) en cookie httpOnly, contraseñas con `bcryptjs`
- **API alterna:** servicio Python FastAPI + servidor MCP en [`api/`](api/) (para n8n / agentes de IA)

## Requisitos

- Node.js 20+
- Docker (para PostgreSQL)
- Un archivo `.env` en la raíz con: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`

## Arranque rápido (Windows)

```bat
start.bat   :: levanta PostgreSQL en Docker, aplica migraciones y arranca Next.js
stop.bat    :: detiene todo
```

## Arranque manual

```bash
docker compose up -d postgres   # base de datos
npx prisma migrate deploy        # aplica migraciones
npx tsx prisma/seed.ts           # carga catálogo (idempotente)
npm run dev                      # http://localhost:3000
```

## Comandos

| Comando | Propósito |
|---------|-----------|
| `npm run dev` | Servidor de desarrollo (puerto 3000) |
| `npm run build` | Build de producción (incluye chequeo de tipos) |
| `npm run lint` | ESLint |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:seed` | Carga de datos semilla |
| `npm run db:studio` | Prisma Studio |
| `npm run db:generate` | Regenera el cliente Prisma |

## API Python (opcional)

```bash
cd api
pip install -r requirements.txt
uvicorn main:app --reload --port 8000   # Swagger en /docs, MCP en /mcp
```

Referencia completa de endpoints en [`api/COTIZADOR_API_SKILL.md`](api/COTIZADOR_API_SKILL.md).

## Documentación para agentes

Las convenciones del proyecto, gotchas de Prisma 7 / PDFKit / Next.js 16 y el modelo de datos
están en [`AGENTS.md`](AGENTS.md) (importado por `CLAUDE.md`).
