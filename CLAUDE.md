# CLAUDE.md

LinkedIn Ads Manager dashboard — React + Vite frontend, Supabase edge function backend, and an MCP server for Claude integration.

Companion docs: [FEATURES.md](FEATURES.md) — what exists and where. [HISTORY.md](HISTORY.md) — how it got built.

Both are kept current by a Stop hook ([.claude/hooks/docs-freshness.sh](.claude/hooks/docs-freshness.sh)): if `src/`, `supabase/`, or `mcp-server/` changed in a session and neither doc was touched, it blocks once and asks for an update. Update them in the same session as the code — don't let them drift.

## Stack

- Frontend: React + Vite + TypeScript + Tailwind + shadcn/ui
- Backend: Supabase (Postgres, Auth, Edge Functions)
- MCP server: Node + Express, hosted on Railway
- Package manager: bun

## Deployment matrix

| Piece | Path | Auto-deploy? |
|---|---|---|
| Frontend | `src/` | Yes — Lovable on push to `main` |
| MCP server | `mcp-server/` | Yes — Railway on push to `main` |
| Edge functions | `supabase/functions/**` | Yes — GitHub Actions on push to `main` ([deploy-functions.yml](.github/workflows/deploy-functions.yml)) |
| DB migrations | `supabase/migrations/` | **No — manual via SQL Editor** |

The workflow deploys both `linkedin-api` and `analyze-data`, triggers on `supabase/functions/**`, and also supports `workflow_dispatch`. It needs the `SUPABASE_ACCESS_TOKEN` repo secret — if a deploy seems to have no effect, check the Actions tab first. To deploy manually:
```bash
SUPABASE_ACCESS_TOKEN=<token> npx supabase functions deploy linkedin-api --project-ref bxoxefmenvlxiubynuay
```
Token from https://supabase.com/dashboard/account/tokens.

## Key directories

```
src/
  hooks/useLinkedInAuth.ts        # LinkedIn OAuth + MCP token sync
  hooks/useCreativeReporting.ts   # Creative Gallery data hook
  components/dashboard/
    ConnectClaude.tsx             # MCP setup modal
    CreativeGallery.tsx           # Creatives tab UI
    CreativeThumbnail.tsx         # Reusable thumbnail
  pages/Dashboard.tsx             # Tab routing

mcp-server/
  src/server.ts                   # Express + OAuth 2.0 + MCP endpoint
  src/tools.ts                    # createLinkedInAdsServer() — tool registry + callEdge()
  railway.toml

supabase/
  functions/linkedin-api/index.ts # All LinkedIn API actions (74+)
  migrations/                     # Schema — includes mcp_api_keys table
```

## MCP server

- Production URL: `https://linkedin-ads-buddy-production.up.railway.app/mcp`
- OAuth Client ID (users type manually in Claude web): `linkedin-ads-buddy`
- Auth model: user pastes their MCP API key UUID on the OAuth page → server resolves UUID → fresh LinkedIn token from `mcp_api_keys` table on every call
- All 74+ edge function actions callable via the `call_linkedin_action` passthrough tool

## Token flow

1. User logs into LinkedIn Ads Buddy → LinkedIn OAuth token stored in `localStorage`
2. `syncMcpToken()` calls edge function action `sync_mcp_token` → upserts `{api_key: UUID, linkedin_token}` into `mcp_api_keys` (service role bypasses RLS)
3. Claude sends MCP request with UUID → server looks up UUID → fetches fresh LinkedIn token → calls edge function → LinkedIn API

Do NOT try direct browser upsert to `mcp_api_keys` — both RLS AND table-level GRANTs block anon writes. Always sync via the edge function.

## LinkedIn OAuth scopes

Currently requested ([supabase/functions/linkedin-api/index.ts:601](supabase/functions/linkedin-api/index.ts#L601)):
```
r_liteprofile r_ads r_ads_reporting rw_ads w_member_social r_marketing_leadgen_automation
```

Bump `REQUIRED_SCOPE_VERSION` in [src/hooks/useLinkedInAuth.ts](src/hooks/useLinkedInAuth.ts) when scopes change — forces existing users to re-auth.

## Client-accessible weekly reports

Agency-facing feature: generate a Claude-written narrative report for a client's week, publish it to a shareable public URL.

- **Table**: `published_reports` — see [migration](supabase/migrations/20260705000000_published_reports.sql). RLS: owners manage own rows via `auth.uid() = user_id`. No `to anon` policy.
- **Public read**: `SECURITY DEFINER` RPC `get_published_report(token)` — returns at most one non-revoked row by exact-token lookup. `grant execute` to `anon` + `authenticated`. Anon cannot query the table directly.
- **Edge function actions** (in `linkedin-api/index.ts`): `publish_weekly_report`, `list_published_reports`, `revoke_published_report`. All three verify the caller's JWT via `supabaseClient.auth.getUser()` before touching the table.
- **Claude prompt**: new `client_weekly_report` reportType in `analyze-data/index.ts` — 400-600 word markdown narrative with fixed section structure (TL;DR, What Happened, What's Working, What's Not, Actions, Looking Ahead). Uses `MODEL_BY_REPORT_TYPE` override for a newer Sonnet than the other digest modes.
- **UI flow**: [WeeklyReport.tsx](src/components/dashboard/WeeklyReport.tsx) has a "Publish for client" button that opens [GenerateClientReportDialog](src/components/dashboard/GenerateClientReportDialog.tsx). Dialog: preview → stream from Claude → edit textarea + live preview → publish. "Past reports" tab lists prior publishes with Copy/Revoke.
- **Public route**: `/report/:token` → [src/pages/PublishedReport.tsx](src/pages/PublishedReport.tsx) → [PublishedReportView](src/components/dashboard/PublishedReportView.tsx). No auth. Renders KPI cards + markdown narrative.
- **Data path**: platform assembles data via [`useWeeklyReport`](src/hooks/useWeeklyReport.ts) hook, then hands compact payload to Claude via [serializeReportForClaude](src/lib/serializeReportForClaude.ts). No agentic tool loop — single Claude API call.

## Known constraints

- **Creative thumbnails are not available for most creatives.** LinkedIn's `/rest/posts/{urn}` returns 403 `partnerApiPostsExternal` — that's a Marketing Developer Platform Partner-gated endpoint, not a scope issue. `/v2/shares` is deprecated. Without Partner status, `imageUrl` will be empty for `SPONSORED_STATUS_UPDATE`, `SPONSORED_UPDATE_NATIVE_DOCUMENT`, and `SPONSORED_INMAILS`. The Creative Gallery UI handles this by splitting into "with images" vs "No Preview Available" sections.
- **`SPONSORED_INMAILS` ads reference `urn:li:adInMailContent:` URNs**, not posts. Filter these out before calling share content APIs — they will never resolve.
- **Demographic analytics returns empty below LinkedIn's 300-impression privacy threshold.** Not a bug.
- **Edge function `linkedin-api` is monolithic** (~13k lines). Search by `case '<action>':` to find handlers.

## Common pitfalls

- Editing edge function without deploying → changes never take effect. Watch for stale behavior.
- `imageUrl: undefined` gets stripped by `JSON.stringify` — so a missing key in the response means the extraction produced empty, not that the field doesn't exist in the code.
- The MCP server hardcodes Supabase URL + anon key (no env vars) — intentional for simplicity, do not add env setup unless there's a reason.

## Preferences

- Concise, direct changes
- No unnecessary abstractions
- Prefer editing existing files
