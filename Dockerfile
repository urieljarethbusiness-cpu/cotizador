# Cotizador E3 — Next.js (web)
# Multi-stage build. El runner conserva node_modules completo para que
# `prisma migrate deploy` y el seed (tsx) funcionen dentro del contenedor.

FROM node:22-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ── Dependencias ──
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ── Build ──
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Placeholder solo para el build: src/lib/auth.ts lanza error al importarse
# sin JWT_SECRET. Todas las páginas son force-dynamic, nada queda horneado.
ENV JWT_SECRET=placeholder-build-only
RUN npx prisma generate && npm run build

# ── Runtime ──
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000

# openssl: el CLI de Prisma lo necesita para detectar la versión de libssl
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Migraciones primero, seed opcional (RUN_SEED=true), luego el servidor.
CMD ["sh", "-c", "npx prisma migrate deploy && if [ \"$RUN_SEED\" = \"true\" ]; then npx tsx prisma/seed.ts; fi && exec node_modules/.bin/next start -p ${PORT:-3000}"]
