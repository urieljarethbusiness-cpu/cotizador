# Cotizador E3

Sistema de cotizaciones de Consultoría E3. Dos backends sobre la misma base de datos PostgreSQL:

- **Web (Next.js 16)** — `src/`, puerto 3000. UI completa: cotizaciones, clientes, catálogo, configuración, export PDF/Excel. Prisma es dueño del esquema y las migraciones.
- **API (FastAPI + MCP)** — `api/`, puerto 8000. REST para integraciones (n8n, agentes de IA) con servidor MCP en `/mcp`. Referencia completa en `api/COTIZADOR_API_SKILL.md`.

## Desarrollo local (Windows)

Requisitos: Node 20+, Docker Desktop.

```bash
# 1. Copia las variables de entorno
copy .env.example .env   # y define JWT_SECRET

# 2. Levanta PostgreSQL + API Python y el dev server de Next.js
start.bat
```

`start.bat` levanta el compose local (`docker-compose.yml`), aplica migraciones y arranca `npm run dev`. Para detener todo: `stop.bat`.

Comandos útiles:

| Comando | Propósito |
|---------|-----------|
| `npm run dev` | Dev server Next.js (puerto 3000) |
| `npm run build` | Build de producción |
| `npx prisma migrate dev` | Crear/aplicar migración |
| `npx tsx prisma/seed.ts` | Seed (idempotente; usuarios vía `SEED_*`) |
| `npx prisma studio` | GUI de la base de datos |

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

## Arquitectura

Ver [AGENTS.md](AGENTS.md) para convenciones, gotchas de Prisma 7 / PDFKit / Next 16 y el modelo de datos.
