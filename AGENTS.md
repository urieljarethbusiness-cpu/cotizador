# AGENTS.md — Cotizador E3

## Quick Reference

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Next.js dev server on port 3000 |
| `npm run build` | Production build (runs TypeScript check) |
| `npm run lint` | ESLint (flat config, eslint-config-next) |
| `npx tsx prisma/seed.ts` | Run seed (upserts all data, idempotent) |
| `npx prisma migrate dev` | Create/apply migration |
| `npx prisma generate` | Regenerate Prisma client |
| `npx prisma studio` | Prisma Studio GUI |

**Windows environment.** Use `start.bat` / `stop.bat` to manage Docker PostgreSQL + Next.js together. PowerShell is the shell. Paths with brackets (e.g. `[id]`) require `-LiteralPath` in PowerShell, not `-Path`.

**Two backends, one database.** The Next.js app (`src/`, port 3000) and a standalone Python FastAPI service (`api/`, port 8000) both talk to the same PostgreSQL DB. Prisma owns the schema/migrations; the Python API reads/writes the same tables independently. `docker-compose.yml` runs `postgres` + the `api` service; Next.js is run separately via `npm run dev` / `start.bat`.

## Prisma 7 — Critical Gotchas

- **Prisma client is NOT at `@prisma/client`.** It's generated to `src/generated/prisma/` and imported as `@/generated/prisma/client`.
- **Uses `PrismaPg` driver adapter** (from `@prisma/adapter-pg`) with individual connection params (host/port/user/password/database), NOT a connection string. The `connectionString` approach causes SCRAM auth errors with postgres:postgres.
- **`prisma.config.ts`** has no `seed` property (unsupported by PrismaConfig type). Run seed manually with `npx tsx prisma/seed.ts`.
- After changing `schema.prisma`: run `npx prisma migrate dev`, then `npx prisma generate`.
- The `globalForPrisma` singleton pattern in `src/lib/db.ts` prevents hot-reload connection leaks in dev.

## PDFKit — Server-Side PDF

- `pdfkit` is excluded from Next.js bundling via `serverExternalPackages` in `next.config.ts`. Without this, font metric files (`.afm`) can't be resolved at runtime.
- **Footer auto-page-break bug:** `doc.text()` at `y > page.height - margins.bottom` triggers pdfkit's automatic page addition. To write footers in the bottom margin, temporarily set `doc.page.margins.bottom = 0`, write, then restore. Use `bufferPages: true` + `switchToPage()` to add footers after all content.
- Returns `Promise<Buffer>` — convert to `Uint8Array` for `NextResponse` body.

## Next.js 16 Conventions

- **Async params:** Dynamic route params are `Promise<{ id: string }>` — must `await params` before use.
- **All pages are `force-dynamic`** — no static generation or ISR.
- **Tailwind CSS v4** — no `tailwind.config.*` file. Config is in `postcss.config.mjs` (using `@tailwindcss/postcss`) and CSS custom properties via `@theme inline` in `src/app/globals.css`.

## Data Model Notes

- **Configuracion** is a key-value store (`clave`/`valor`), not a traditional settings model. New config keys: `color_primario`, `color_secundario`, `logo_base64` (branding for PDF export).
- **Cascading deletes:** Cotizacion → ServicioCotizado, PlanBucefaloCotizacion use `onDelete: Cascade`.
- Cotización number format: `UJ{YY}{MM}{AsesorInitials}{seq}` (e.g. `UJ2605AG001`) — see `generarNumeroCotizacion` in `src/lib/calculators.ts`. Sequence is 3 digits, zero-padded.
- Vigencia = 15 business days from fecha (excludes Sat/Sun) — `calcularVigencia`.
- IVA_RATE = 0.16 (16%).
- **Bucéfalo CRM plan prices** (in `calculators.ts`, NOT the DB): basico=$1,000, estandar=$3,500, premium=$4,500, empresarial=$7,500 (monthly).
- **Financing** lives in the `FinanciamientoPlan` table (3/6/9/12 months). Formula: `comisionTotal = monto × comision%`, `pagoMensual = (monto + comisionTotal) × (1 + tasa) / meses`, then add 16% IVA. Both backends must keep this formula identical.

## Auth

- **JWT sessions** (`src/lib/auth.ts`) signed with `jose` (HS256, 7-day expiry), stored in the `cotizador-session` httpOnly cookie. `JWT_SECRET` env var is **required** (throws at startup if missing).
- **`src/middleware.ts`** gates everything except `PUBLIC_PATHS` (`/login`, `/api/auth/login`, `/api/auth/logout`, `/api/health`). Unauthenticated API calls → 401 JSON; pages → redirect to `/login`. On success it injects `x-user-id` / `x-user-role` request headers for downstream handlers.
- Passwords hashed with `bcryptjs`. Roles: `asesor` (default), and others stored as free-form strings.

## Deployment (Coolify)

- Production stack: `docker-compose.coolify.yml` (postgres + web + api). In Coolify set **Docker Compose Location** to `/docker-compose.coolify.yml`. Local dev keeps using `docker-compose.yml` + `start.bat`.
- The `web` container runs `prisma migrate deploy` on every start, and the seed only when `RUN_SEED=true`. Seed users/passwords come from `SEED_*` env vars (see `.env.example`) — `prisma/seed.ts` never overwrites an existing password unless the env var is set.
- `DATABASE_URL` is only used by the Prisma CLI (migrations); the apps use individual `DB_*` vars. Both must point to the same DB.
- Healthchecks: web `GET /api/health` (public in middleware, pings DB), api `GET /health`.
- Root `Dockerfile` builds Next.js with `JWT_SECRET=placeholder-build-only` (auth.ts throws at import without it; all pages are force-dynamic so nothing gets baked).
- `*.xlsx` is gitignored (business files must never be committed).

## Architecture

```
src/
  app/
    (app)/         # Authed route group: dashboard, cotizaciones, clientes, catalogo, configuracion (has its own layout.tsx + Sidebar)
    api/           # Next.js route handlers (REST): auth, catalogo, categorias, cotizaciones, configuracion, paquetes, export, import
    login/         # Public login page
  components/      # CotizacionForm, ExportButtons, EstadoBadge, layout/Sidebar
  lib/             # auth, db, store, calculators, pdf-generator, schemas, config-helpers
  generated/prisma/  # Prisma client output (gitignored)
prisma/
  schema.prisma  # 13 models (User, Cliente, Cotizacion, Categoria, Paquete, FasePaquete,
                 #   ServicioCatalogo, ServicioPaquete, ServicioCotizado, PlanBucefaloCotizacion,
                 #   Configuracion, Bono, FinanciamientoPlan)
  seed.ts        # All catalog data (services, categorias, bonos, planes, config) — idempotent upserts
  migrations/    # 3 migrations
api/             # Standalone Python FastAPI + MCP server (see below)
```

- **Zustand store** (`src/lib/store.ts`) holds the cotización draft. Used by both the new (`cotizaciones/nueva`) and edit (`cotizaciones/[id]/editar`) pages, both of which render `CotizacionForm.tsx`.
- **ExportButtons.tsx** has 4 variants: `ExportExcelButtonSaved` / `ExportPDFButtonSaved` (GET by ID) and `ExportExcelButtonDraft` / `ExportPDFButtonDraft` (POST with body).

## Python API (`api/`) — Optional Second Backend

- **FastAPI app** (`api/main.py`) exposing the same domain as REST, **plus an MCP server at `/mcp`** for AI agents (n8n, Claude, ChatGPT). Tools/resources defined in `api/app/mcp/`.
- Auth: **API key** (`X-API-Key` or `Authorization: Bearer`) for agents; JWT for human login. Routers in `api/app/routers/`, business logic in `api/app/services/` (its own `calculators.py`, `pdf_generator.py`, `excel_generator.py` — mirror the TS versions).
- Run: `cd api && pip install -r requirements.txt && uvicorn main:app --reload --port 8000`. Swagger at `/docs`. Full endpoint reference in `api/COTIZADOR_API_SKILL.md`.
- It reads `DB_*`, `API_KEY`, `JWT_SECRET` env vars (same DB as Prisma).

## Domain

Quotation system for Consultoría E3 (digital marketing agency in Querétaro, MX). Services organized in 4 phases: Fase 0 (Auditorías), Fase 1 (Setup/Infra), Fase 2 (Publicidad/Manejo), Fase 3 (Contenido/SEO). Two payment types: `unico` (one-time) and `mensual` (recurring). Optional Bucéfalo CRM plans and Openpay financing.
