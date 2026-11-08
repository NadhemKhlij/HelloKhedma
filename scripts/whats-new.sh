#!/bin/sh
# What's new before a deploy (several Claude sessions and people work on this repo in parallel).
# Run it on your branch before merging into main (every deploy) and at the start of a session:
#   sh scripts/whats-new.sh            report + exit 1 when main has commits your branch does not have
#   sh scripts/whats-new.sh --report   report only (exit 0)
# It fetches GitHub, then shows:
#   1. what was deployed on main since your branch started (commits, authors, files);
#   2. files changed both there and on your branch (conflict risk: rebase now, then check those parts again);
#   3. the other branches still in progress (not merged into main, active in the last 21 days) and the files they
#      share with yours, so two sessions do not rewrite the same thing.
# When main moved: git rebase origin/main, run the checks again (check-content, check-i18n, smoke tests on a branch
# push), then merge. CI prints the same warning on every branch push (deploy.yml, "Up to date with main?").
set -u
REPORT_ONLY=0
[ "${1:-}" = "--report" ] && REPORT_ONLY=1

git fetch origin --prune --quiet || { echo "Could not reach GitHub (git fetch failed)."; exit 2; }
BRANCH=$(git rev-parse --abbrev-ref HEAD)
BASE=$(git merge-base HEAD origin/main)
MINE=$(mktemp); THEIRS=$(mktemp); trap 'rm -f "$MINE" "$THEIRS"' EXIT
{ git diff --name-only "$BASE" HEAD; git diff --name-only HEAD; } | sort -u > "$MINE"

echo "== Branch: $BRANCH"
echo "== Live (origin/main): $(git log -1 --format='%h %ad %an: %s' --date=format:'%Y-%m-%d %H:%M' origin/main)"
echo

BEHIND=$(git rev-list --count HEAD..origin/main)
if [ "$BEHIND" -eq 0 ]; then
  echo "1. Nothing new on main since your branch started."
else
  echo "1. $BEHIND new commit(s) on main since your branch started:"
  git log --format='   %h %ad %an: %s' --date=short HEAD..origin/main
  git diff --name-only "$BASE" origin/main | sort -u > "$THEIRS"
  echo "   Files changed on main: $(wc -l < "$THEIRS" | tr -d ' ')"
  BOTH=$(comm -12 "$MINE" "$THEIRS")
  echo
  if [ -n "$BOTH" ]; then
    echo "2. Changed on main AND on your branch (rebase, then re-check these):"
    echo "$BOTH" | sed 's/^/   /'
  else
    echo "2. No file changed on both sides."
  fi
fi
echo

echo "3. Other branches in progress (not merged into main, active in the last 21 days):"
CUTOFF=$(( $(date +%s) - 21 * 86400 ))
FOUND=0
for ref in $(git for-each-ref --format='%(refname:short)' refs/remotes/origin); do
  name=${ref#origin/}
  [ "$name" = "main" ] || [ "$name" = "HEAD" ] || [ "$name" = "origin" ] || [ "$name" = "$BRANCH" ] && continue
  [ "$(git log -1 --format=%ct "$ref")" -lt "$CUTOFF" ] && continue
  git merge-base --is-ancestor "$ref" origin/main && continue
  FOUND=1
  echo "   $name — $(git log -1 --format='%ad %an: %s' --date=short "$ref")"
  FORK=$(git merge-base "$ref" origin/main 2>/dev/null) || { echo "      (no common history with main)"; continue; }
  SHARED=$(git diff --name-only "$FORK" "$ref" | sort -u | comm -12 "$MINE" -)
  [ -n "$SHARED" ] && echo "$SHARED" | sed 's/^/      also changed by you: /'
done
[ "$FOUND" -eq 0 ] && echo "   none"
echo

if [ "$BEHIND" -gt 0 ]; then
  echo "→ main moved: git rebase origin/main, re-run the checks, then merge. Tell the owner what the others shipped."
  [ "$REPORT_ONLY" -eq 1 ] || exit 1
else
  echo "→ Up to date with main."
fi
