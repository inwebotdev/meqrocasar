#!/usr/bin/env bash
# Formats the staged files with Prettier (inside Docker) and re-stages them.
# Files that also have unstaged changes are skipped so that partial commits
# never pick up hunks the developer left out of the index.
# Paths are read NUL-separated and passed as quoted arguments, so names with
# spaces or shell metacharacters are handled safely.
set -eo pipefail

pattern='\.(ts|tsx|js|jsx|mjs|css|json|md)$'

staged=()
while IFS= read -r -d '' file; do
  [[ $file =~ $pattern ]] && staged+=("$file")
done < <(git diff --cached --name-only -z --diff-filter=ACMR)
((${#staged[@]})) || exit 0

unstaged=()
while IFS= read -r -d '' file; do
  unstaged+=("$file")
done < <(git diff --name-only -z)

is_unstaged() {
  local candidate
  for candidate in "${unstaged[@]+"${unstaged[@]}"}"; do
    [[ $candidate == "$1" ]] && return 0
  done
  return 1
}

format=()
skipped=()
for file in "${staged[@]}"; do
  if is_unstaged "$file"; then skipped+=("$file"); else format+=("$file"); fi
done

if ((${#skipped[@]})); then
  printf 'pre-commit: skipping partially staged files (stage them fully to auto-format):\n' >&2
  printf '  %s\n' "${skipped[@]}" >&2
fi
((${#format[@]})) || exit 0

if ! docker compose run --rm --no-deps -T app yarn prettier --write -- "${format[@]}"; then
  echo "pre-commit: Prettier failed (is Docker running?). Fix the problem or commit with --no-verify." >&2
  exit 1
fi
git add -- "${format[@]}"
