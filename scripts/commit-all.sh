#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

derive_scope() {
  local p="$1"
  case "$p" in
    supabase/migrations/*) echo "db" ;;
    backend/app/features/*)
      echo "$p" | awk -F/ '{print $4}' ;;
    backend/app/core/*) echo "core" ;;
    backend/app/main.py) echo "app" ;;
    backend/tests/*) echo "tests" ;;
    frontend/src/features/*)
      echo "$p" | awk -F/ '{print $4}' ;;
    frontend/src/layouts/*) echo "layout" ;;
    frontend/src/shared/components/install-nudge/*) echo "pwa" ;;
    frontend/src/shared/components/icons/*) echo "icons" ;;
    frontend/src/shared/components/*) echo "shared" ;;
    frontend/src/shared/lib/*) echo "shared" ;;
    frontend/src/shared/hooks/*) echo "shared" ;;
    frontend/src/shared/types/*) echo "shared" ;;
    frontend/src/shared/*) echo "shared" ;;
    frontend/src/core/*)
      echo "$p" | awk -F/ '{print $4}' ;;
    frontend/src/app/router.tsx) echo "router" ;;
    frontend/src/app/providers.tsx) echo "app" ;;
    frontend/src/index.css) echo "theme" ;;
    frontend/src/content/*) echo "novedades" ;;
    frontend/vite.config.ts) echo "build" ;;
    frontend/package*.json) echo "deps" ;;
    docs/research/*) echo "research" ;;
    docs/*) echo "docs" ;;
    scripts/*) echo "scripts" ;;
    *) echo "misc" ;;
  esac
}

base_for() { basename "$1"; }

count=0

TMP=$(mktemp -d)
trap "rm -rf $TMP" EXIT

# Phase 1: pure rename commits
git diff --cached --name-status -M | awk -F'\t' '/^R[0-9]+/ {print $2 "|" $3}' > "$TMP/renames"
total_renames=$(wc -l < "$TMP/renames" | tr -d ' ')
echo "[phase 1] $total_renames renames"

git reset --quiet HEAD -- . || true

while IFS= read -r pair; do
  [ -z "$pair" ] && continue
  old="${pair%|*}"
  new="${pair#*|}"
  scope=$(derive_scope "$new")
  msg="refactor(${scope}): :recycle: rename $(base_for "$old") to $(base_for "$new")"
  git add -- "$old" "$new"
  git commit --quiet -m "$msg"
  count=$((count + 1))
done < "$TMP/renames"

echo "[phase 1] done — $count commits"

# Phase 2: modifications
git diff --name-only > "$TMP/modified"
total_mod=$(wc -l < "$TMP/modified" | tr -d ' ')
echo "[phase 2] $total_mod modifications"

while IFS= read -r p; do
  [ -z "$p" ] && continue
  scope=$(derive_scope "$p")
  case "$p" in
    *.md) type="docs"; emoji=":memo:" ;;
    *) type="refactor"; emoji=":recycle:" ;;
  esac
  msg="${type}(${scope}): ${emoji} update $(base_for "$p")"
  git add -- "$p"
  git commit --quiet -m "$msg"
  count=$((count + 1))
done < "$TMP/modified"

echo "[phase 2] done — $count commits cumulative"

# Phase 3: untracked
git ls-files --others --exclude-standard > "$TMP/untracked"
total_unt=$(wc -l < "$TMP/untracked" | tr -d ' ')
echo "[phase 3] $total_unt untracked"

while IFS= read -r p; do
  [ -z "$p" ] && continue
  scope=$(derive_scope "$p")
  case "$p" in
    *.md) type="docs"; emoji=":memo:" ;;
    supabase/migrations/*.sql) type="feat"; emoji=":sparkles:" ;;
    *.sh) type="chore"; emoji=":hammer:" ;;
    *) type="feat"; emoji=":sparkles:" ;;
  esac
  msg="${type}(${scope}): ${emoji} add $(base_for "$p")"
  git add -- "$p"
  git commit --quiet -m "$msg"
  count=$((count + 1))
done < "$TMP/untracked"

echo "[phase 3] done — $count commits cumulative"
echo "made $count commits"
