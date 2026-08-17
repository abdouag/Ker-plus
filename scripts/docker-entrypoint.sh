#!/usr/bin/env sh
# =============================================================================
# Démarrage du conteneur Estimateur Kerplus
#   1. applique les migrations Prisma ;
#   2. exécute le seed si SEED_ON_START=true (idempotent) ;
#   3. lance le serveur Next.js.
#
# Le CLI Prisma est appelé directement : l'image de production ne contient pas
# les liens de node_modules/.bin et ne doit jamais dépendre du réseau npm.
# =============================================================================
set -e

echo "→ Application des migrations…"
node node_modules/prisma/build/index.js migrate deploy

if [ "${SEED_ON_START:-false}" = "true" ]; then
  echo "→ Seed des référentiels et paramètres…"
  node dist-scripts/seed.cjs
fi

echo "→ Démarrage du serveur…"
exec node server.js
