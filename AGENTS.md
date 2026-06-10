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
  app/           # Next.js App Router pages + API routes
    api/         # Route handlers (REST endpoints)
    cotizaciones/[id]/editar/  # Edit mode (reuses CotizacionEditor via EditorLoader)
  components/    # Shared client components (ExportButtons, Sidebar)
  lib/           # Utilities: db.ts, store.ts, calculators.ts, pdf-generator.ts
  generated/prisma/  # Prisma client output (gitignored)
prisma/
  schema.prisma  # 8 models
  seed.ts        # All catalog data (23 services, bonos, planes, config)
  migrations/    # Prisma migration files
```

- **Zustand store** (`src/lib/store.ts`) manages cotización editor state (draft form). Used by both new and edit pages.
- **ExportButtons.tsx** has 4 variants: `ExportExcelButtonSaved` / `ExportPDFButtonSaved` (GET by ID) and `ExportExcelButtonDraft` / `ExportPDFButtonDraft` (POST with body).
- The old standalone `ExportExcelButton.tsx` was deleted — all exports now go through `ExportButtons.tsx`.

## Domain

Quotation system for Consultoría E3 (digital marketing agency in Querétaro, MX). Services organized in 4 phases: Fase 0 (Auditorías), Fase 1 (Setup/Infra), Fase 2 (Publicidad/Manejo), Fase 3 (Contenido/SEO). Two payment types: `unico` (one-time) and `mensual` (recurring). Optional Bucéfalo CRM plans and Openpay financing.
