#!/usr/bin/env bash
# Split mode: for renames where the new file's content differs from the old
# file's original content at origin/main, produce TWO commits — first the pure
# rename (old content moved to new path), then the content modification.
#
# Run from a clean state where origin/main equals HEAD's parent and the working
# tree has all desired changes vs origin/main.

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

BASE="origin/main"
BACKUP_TAG="commit-backup"

derive_scope() {
  local p="$1"
  case "$p" in
    supabase/migrations/*) echo "db" ;;
    backend/app/features/*) echo "$p" | awk -F/ '{print $4}' ;;
    backend/app/core/*) echo "core" ;;
    backend/app/main.py) echo "app" ;;
    backend/tests/*) echo "tests" ;;
    frontend/src/features/*) echo "$p" | awk -F/ '{print $4}' ;;
    frontend/src/layouts/*) echo "layout" ;;
    frontend/src/shared/components/install-nudge/*) echo "pwa" ;;
    frontend/src/shared/components/icons/*) echo "icons" ;;
    frontend/src/shared/components/*) echo "shared" ;;
    frontend/src/shared/lib/*) echo "shared" ;;
    frontend/src/shared/hooks/*) echo "shared" ;;
    frontend/src/shared/types/*) echo "shared" ;;
    frontend/src/shared/*) echo "shared" ;;
    frontend/src/core/*) echo "$p" | awk -F/ '{print $4}' ;;
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

# Compute renames vs origin/main. -M50 is generous on similarity.
git diff --name-status -M50 "$BASE" "$BACKUP_TAG" \
  | awk -F'\t' '/^R[0-9]+/ {print $2 "|" $3}' > "$TMP/renames"

# Modified files (not renamed) — direct M lines from same diff.
git diff --name-status -M50 "$BASE" "$BACKUP_TAG" \
  | awk -F'\t' '/^M\t/ {print $2}' > "$TMP/modified"

# Added (untracked) files — A lines.
git diff --name-status -M50 "$BASE" "$BACKUP_TAG" \
  | awk -F'\t' '/^A\t/ {print $2}' > "$TMP/added"

# Reset to origin/main but keep working tree (working tree currently matches
# BACKUP_TAG content). We'll re-stage piece by piece.
git reset --quiet --soft "$BASE"
git reset --quiet HEAD -- .

echo "[counts] renames=$(wc -l < $TMP/renames | tr -d ' ') modified=$(wc -l < $TMP/modified | tr -d ' ') added=$(wc -l < $TMP/added | tr -d ' ')"

# Phase A: for each rename, commit pure rename first, then (if content changed)
# commit the content modification.
while IFS= read -r pair; do
  [ -z "$pair" ] && continue
  old="${pair%|*}"
  new="${pair#*|}"
  scope=$(derive_scope "$new")

  # Capture final content (currently in working tree at $new).
  cp -- "$new" "$TMP/final_blob"
  # Restore old content into new path so the rename has zero content diff.
  git show "$BASE:$old" > "$new"
  git add -- "$old" "$new"
  msg_rename="refactor(${scope}): :recycle: rename $(base_for "$old") to $(base_for "$new")"
  git commit --quiet -m "$msg_rename"
  count=$((count + 1))

  # Restore final content.
  cp -- "$TMP/final_blob" "$new"
  if ! git diff --quiet -- "$new"; then
    git add -- "$new"
    msg_mod="refactor(${scope}): :recycle: update $(base_for "$new") for agent rename"
    git commit --quiet -m "$msg_mod"
    count=$((count + 1))
  fi
done < "$TMP/renames"

echo "[phase A] $count cumulative"

# Phase B: each non-rename modified file = 1 commit.
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

echo "[phase B] $count cumulative"

# Phase C: each new (added) file = 1 commit.
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
done < "$TMP/added"

echo "[phase C] done — $count total commits"
