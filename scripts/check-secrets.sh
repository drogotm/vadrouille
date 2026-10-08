#!/usr/bin/env bash
# Vérifie qu'aucun secret n'est versionné ou indexé (lancé avant chaque push).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

files=$( { git ls-files; git diff --cached --name-only --diff-filter=ACM; } | sort -u \
  | grep -vE '^(scripts/check-secrets\.sh|package-lock\.json)$' || true)

status=0

# Fichiers d'environnement réels interdits
if echo "$files" | grep -E '(^|/)\.env($|\.)' | grep -vE '\.env\.example$' ; then
  echo "❌ Un fichier .env est suivi par git." ; status=1
fi

patterns=(
  'sk-ant-[A-Za-z0-9_-]{16,}'                                   # clé API Anthropic
  'sb_secret_[A-Za-z0-9_-]{16,}'                                # clé secrète Supabase
  'eyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}' # JWT (service_role, anon…)
  'SERVICE_ROLE_KEY[[:space:]]*[=:][[:space:]]*["'"'"']?[A-Za-z0-9_.-]{20,}'
  '-----BEGIN ([A-Z]+ )?PRIVATE KEY-----'
)

for f in $files; do
  [ -f "$f" ] || continue
  for p in "${patterns[@]}"; do
    if grep -nIE -e "$p" "$f" >/dev/null 2>&1; then
      echo "❌ Secret potentiel dans $f (motif: $p)"
      status=1
    fi
  done
done

if [ $status -eq 0 ]; then echo "✅ Aucun secret détecté."; fi
exit $status
