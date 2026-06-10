# Cotizador E3

Sistema de generación de cotizaciones para Consultoría E3 (marketing digital, Querétaro MX).
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
- Un archivo `.env` en la raíz — copia [.env.example](.env.example) y define al menos `JWT_SECRET`

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

## Despliegue en Coolify

El stack de producción está en [docker-compose.coolify.yml](docker-compose.coolify.yml): `postgres` + `web` (Next.js) + `api` (FastAPI). El contenedor `web` aplica las migraciones de Prisma automáticamente en cada arranque.

### Pasos

1. **Sube el repo a GitHub** (privado recomendado).
2. En Coolify: **+ New Resource → Docker Compose**, conecta el repo y la rama.
3. En la configuración del recurso, define **Docker Compose Location** = `/docker-compose.coolify.yml`.
4. Coolify detecta los servicios y asigna dominio a `web` (puerto 3000) y `api` (puerto 8000) vía las variables `SERVICE_FQDN_*` — configura los dominios deseados en la UI.
5. Define las variables de entorno en Coolify:

| Variable | Obligatoria | Notas |
|----------|-------------|-------|
| `JWT_SECRET` | Sí | `openssl rand -base64 32` |
| `API_KEY` | Sí (para el API) | Clave para agentes/n8n |
| `DB_PASSWORD` | Recomendada | Password de PostgreSQL (default `postgres`) |
| `RUN_SEED` | Primer deploy | `true` solo la primera vez; luego `false` |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` / `SEED_ADMIN_NAME` | Primer deploy | Usuario admin inicial |
| `SEED_ASESOR_EMAIL` / `SEED_ASESOR_PASSWORD` / `SEED_ASESOR_NAME` | No | Asesor opcional |

6. **Deploy.** Orden de arranque: `postgres` (healthy) → `web` (migra + seed + sirve) → `api`.
7. Después del primer despliegue exitoso, cambia `RUN_SEED` a `false` y redeploya (el seed es idempotente, pero no hace falta correrlo cada vez).

### Healthchecks

- Web: `GET /api/health` (verifica también la conexión a la BD)
- API: `GET /health`

### Notas

- No expongas el puerto 5432: los servicios se comunican por la red interna del compose.
- El volumen `postgres_data` persiste la base de datos entre deploys. No lo borres.
- El servidor MCP queda en `https://<dominio-api>/mcp` (auth por `X-API-Key`).
- La fórmula de financiamiento y los cálculos viven duplicados en `src/lib/calculators.ts` y `api/app/services/calculators.py` — mantenlos en paridad.

## Documentación para agentes

Las convenciones del proyecto, gotchas de Prisma 7 / PDFKit / Next.js 16 y el modelo de datos
están en [`AGENTS.md`](AGENTS.md) (importado por `CLAUDE.md`).
