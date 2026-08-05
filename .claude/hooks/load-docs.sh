#!/usr/bin/env bash
# SessionStart hook: inject the companion docs into context so every session
# starts oriented and current — without the user having to ask.
#
# CLAUDE.md is auto-loaded by Claude Code already; this adds FEATURES.md (the
# "what exists and where" map) inline, and points at HISTORY.md for build
# context. Registered in .claude/settings.json under SessionStart.
#
# Emits a SessionStart `additionalContext` payload. Always prints valid JSON,
# even if a doc is missing, so it can never break session startup.

set -uo pipefail

REPO="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$REPO" 2>/dev/null || { printf '{}\n'; exit 0; }

features="$(cat FEATURES.md 2>/dev/null || echo '(FEATURES.md not found)')"

context="$(cat <<EOF
## Project docs (loaded at session start)

This repo keeps three companion docs current — treat them as the source of truth:
- **CLAUDE.md** (auto-loaded) — architecture, deployment matrix, constraints, pitfalls.
- **FEATURES.md** — what exists and where (inlined below).
- **HISTORY.md** — how it got built. Read it when you need background on a feature or a past decision.

Before changing code, rely on these rather than re-deriving. When you change \`src/\`,
\`supabase/\`, or \`mcp-server/\`, update FEATURES.md / HISTORY.md in the same session
(a Stop hook enforces this).

---

$features
EOF
)"

if command -v jq >/dev/null 2>&1; then
  jq -n --arg ctx "$context" \
    '{hookSpecificOutput: {hookEventName: "SessionStart", additionalContext: $ctx}}'
else
  # Fallback: plain stdout is still added to SessionStart context.
  printf '%s\n' "$context"
fi
