# syntax=docker/dockerfile:1

# =============================================================================
# Estimateur Kerplus — image de production (Next.js standalone)
# =============================================================================

FROM node:22-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# --- Dépendances -------------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# --- Build -------------------------------------------------------------------
FROM base AS builder
ENV NEXT_OUTPUT_STANDALONE=true
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build
# Le seed est compilé en CommonJS autonome : l'image de production peut ainsi
# initialiser les référentiels sans TypeScript ni dépendances de développement.
RUN npx esbuild prisma/seed.ts \
  --bundle --platform=node --target=node22 --format=cjs \
  --external:@prisma/client --external:bcryptjs \
  --outfile=/app/dist-scripts/seed.cjs

# --- Exécution ---------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV TZ=Africa/Dakar

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs kerplus

# Sortie standalone : serveur + dépendances strictement nécessaires.
COPY --from=builder --chown=kerplus:nodejs /app/.next/standalone ./
COPY --from=builder --chown=kerplus:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=kerplus:nodejs /app/public ./public

# Migrations, seed et client Prisma pour `prisma migrate deploy` au démarrage.
COPY --from=builder --chown=kerplus:nodejs /app/prisma ./prisma
COPY --from=builder --chown=kerplus:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=kerplus:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=kerplus:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=kerplus:nodejs /app/dist-scripts ./dist-scripts
COPY --from=builder --chown=kerplus:nodejs /app/scripts/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Stockage des rapports PDF (à monter sur un volume persistant).
RUN mkdir -p /app/storage/reports /app/storage/emails \
  && chown -R kerplus:nodejs /app/storage

USER kerplus
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

CMD ["./docker-entrypoint.sh"]
