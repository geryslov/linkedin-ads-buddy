#!/usr/bin/env bash
# Keeps HISTORY.md and FEATURES.md in sync with the code.
#
# Two modes, wired to two hook events in .claude/settings.json:
#   start  (SessionStart) — record the HEAD sha the session began at
#   check  (Stop)         — if code changed since then but the docs didn't,
#                           block once and ask Claude to update them
#
# Fires at most once per session. State lives in TMPDIR, so it evaporates
# on reboot and never lands in the repo.

set -uo pipefail

MODE="${1:-check}"
STATE_DIR="${TMPDIR:-/tmp}/labuddy-docs-hook"
mkdir -p "$STATE_DIR"

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO" || exit 0

input="$(cat)"
sid="$(printf '%s' "$input" | jq -r '.session_id // "nosession"' 2>/dev/null)"
[ -z "$sid" ] && sid="nosession"

sha_file="$STATE_DIR/$sid.sha"
fired_file="$STATE_DIR/$sid.fired"

# Paths that mean "the product changed" vs "the docs changed"
CODE_RE='^(src|supabase|mcp-server)/'
DOCS_RE='^(HISTORY|FEATURES)\.md$'

if [ "$MODE" = "start" ]; then
  git rev-parse HEAD >"$sha_file" 2>/dev/null || true
  exit 0
fi

# --- check mode ---

# Already nudged this session; stay quiet.
[ -f "$fired_file" ] && exit 0

base="$(cat "$sha_file" 2>/dev/null)"
[ -z "$base" ] && base="HEAD"

changed="$(
  {
    git diff --name-only "$base" HEAD 2>/dev/null
    git status --porcelain 2>/dev/null | awk '{print $NF}'
  } | sort -u
)"

[ -z "$changed" ] && exit 0

printf '%s\n' "$changed" | grep -qE "$CODE_RE" || exit 0
printf '%s\n' "$changed" | grep -qE "$DOCS_RE" && exit 0

touch "$fired_file"

touched="$(printf '%s\n' "$changed" | grep -E "$CODE_RE" | head -20 | sed 's/^/  - /')"

reason="Code changed this session but HISTORY.md and FEATURES.md were not updated.

Changed:
$touched

Update both before finishing:
  - FEATURES.md — only if this added, removed, or renamed a feature, route, hook, edge action, or MCP tool. Skip it for pure bugfixes.
  - HISTORY.md — add or extend the entry for the current month describing what changed and why.

Verify claims against the code rather than assuming; if nothing is worth recording, say so and stop."

jq -nc --arg r "$reason" '{decision: "block", reason: $r}'
