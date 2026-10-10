#!/bin/sh
# Formats the staged files with Prettier (inside Docker) and re-stages them.
# Files that also have unstaged changes are skipped so that partial commits
# never pick up hunks the developer left out of the index.
set -eu

STAGED=$(git diff --cached --name-only --diff-filter=ACMR | grep -E '\.(ts|tsx|js|jsx|mjs|css|json|md)$' || true)
[ -z "$STAGED" ] && exit 0

UNSTAGED=$(git diff --name-only)
FORMAT=""
SKIPPED=""
for file in $STAGED; do
  if printf '%s\n' "$UNSTAGED" | grep -qx "$file"; then
    SKIPPED="$SKIPPED $file"
  else
    FORMAT="$FORMAT $file"
  fi
done

if [ -n "$SKIPPED" ]; then
  echo "pre-commit: skipping partially staged files (stage them fully to auto-format):$SKIPPED" >&2
fi
[ -z "$FORMAT" ] && exit 0

if ! docker compose run --rm --no-deps -T app yarn prettier --write $FORMAT; then
  echo "pre-commit: Prettier failed (is Docker running?). Fix the problem or commit with --no-verify." >&2
  exit 1
fi
git add $FORMAT
