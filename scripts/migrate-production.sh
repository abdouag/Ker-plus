#!/usr/bin/env sh
# =============================================================================
# Migration de production — Estimateur Kerplus
#
# Usage :
#   DATABASE_URL="postgresql://…" ./scripts/migrate-production.sh
#
# Le script refuse de s'exécuter sans DATABASE_URL et rappelle la nécessité
# d'une sauvegarde préalable.
# =============================================================================
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Erreur : DATABASE_URL n'est pas défini." >&2
  exit 1
fi

echo "Base cible : $(echo "$DATABASE_URL" | sed -E 's#://[^@]*@#://***@#')"
echo ""
echo "Avez-vous réalisé une sauvegarde ? (pg_dump)"
echo "  pg_dump \"\$DATABASE_URL\" -Fc -f sauvegarde-\$(date +%Y%m%d-%H%M).dump"
echo ""

if [ "${SKIP_CONFIRM:-}" != "1" ]; then
  printf "Poursuivre la migration ? [oui/non] "
  read -r answer
  case "$answer" in
    oui | OUI | o | O | y | Y | yes) ;;
    *)
      echo "Migration annulée."
      exit 0
      ;;
  esac
fi

echo "→ Application des migrations…"
npx prisma migrate deploy

echo "→ Vérification des données de référence (seed idempotent)…"
npx prisma db seed

echo "Migration terminée."
