# HISTORY.md

Chronological record of how LinkedIn Ads Buddy got built. Reconstructed from git history (~1,054 commits, Dec 2025 → Jul 2026).

Most commits are Lovable auto-commits titled `Changes`; the dated entries below are the meaningful ones. Timeline is grouped by the theme that dominated each period.

---

## Dec 2025 — Bootstrap and the creative-naming grind

Started from the Lovable `vite_react_shadcn_ts` template (`bebc3a2`), connected to Lovable Cloud (`c0ac2ea`), then scaffolded the LinkedIn API edge function (`cf03f6b`, 2025-12-11).

The bulk of the month was a long fight to resolve **creative names**. LinkedIn's analytics endpoints return creative URNs, not names, and the versioned REST API kept moving. Roughly 30 commits over Dec 14–16 iterating on this: batch name fetchers, `creativeDscName`, legacy fallbacks, API version bumps, a reference cache (`d65e125`), grouped drill-down. This is why creative reporting has as many code paths as it does.

Also landed:
- Demographic analytics + pivot selector (`86754e6`), job title URN → name resolution (`9d33d55`)
- Company Intelligence tab (`fdd84e2`), Account Structure tab (`c327f97`)
- Admin auth backend (`0792e06`), CSV export across reports (`4dc1c7f`)
- Job–seniority matrix (`3f1cdd5`) and job title drill-down — another multi-commit URN-encoding grind (Dec 30)
- Lead Gen Forms tab (`e95c957`), CPL + daily spend metrics (`3d32344`)

Two `Reverted to commit` entries this month — the creative work broke things more than once.

## Jan 2026 — Auth, accounts, targeting tools

- LinkedIn login button + email login + test-user login flow
- Ad account cache and Business Manager account discovery
- Job title search and skills search (`Add job title search feature`, `Add skills search support`)
- Bulk title import
- Targeting Tools tab created

## Feb 2026 — The heaviest feature month

Roughly 40 feature commits. Three clusters:

**Optimization suite** (`Add optimization features: Budget Pacing, Creative Fatigue, Audience Expander`) — three tools shipped together, plus budget pacing summary and 3-day pacing metrics.

**Company analysis** — Company Influence Report (multi-campaign company analysis), Company Engagement Report (demographic + influence combined), Company Timeline tab. Company logos and engagement metrics added to the Demographic table.

**Creatives** — Creative Gallery tab, Creative Reports UI, creative thumbnails in the Names table, ad-type filters.

Also: custom fields for campaigns/campaign groups, campaign trend report, Super Title Checker, objective breakdowns and filters. The "detailed logging for super title resolution debugging" commits mark another URN-resolution debugging session.

## Mar 2026 — Attribution, leads, and naming conventions

- **Company Influence Matcher** — CRM-CSV-to-LinkedIn attribution. Later redesigned twice (dedup, drill-down, lazy objective breakdowns, 4-level drill-down).
- **Forms & Leads** tab with Lead Sync API, Lead Records viewer, and "Lead from Funnel" (per-lead company ad journey)
- **Campaign naming convention parser** + report, backed by a `naming_conventions` table
- Campaign Targeting Editor redesigned twice (3-zone layout, dark tech aesthetic); gained job title suggestions, bulk skills import, skill suggestions derived from titles, and live audience size estimates via the LinkedIn Audience Counts API
- Standardized Titles page with function + super-title resolution
- Activity Report
- Apify proxy edge function + reactor profiles on posts (social listening groundwork)
- GitHub Actions auto-deploy for edge functions

## Apr 2026 — Weekly reports

A single concentrated push (Apr 12) building the weekly report suite: Sun–Sat week boundaries, last-full-week comparison, creative type labels, data layers, crash and type fixes. ~20 commits in one day.

## May 2026 — Analytics tab, AI analyzers, agency features

- Migration integrity fix + analytics tab build + Company Intelligence API upgrade, and removal of fake/placeholder metrics (`9674c97`)
- Per-creative analytics, engagement breakdown, pro-rated creative-level data, parallelized LinkedIn queries
- **AI Creative Analyzer** (`5889627`) — later given agentic tool-calling (`f0d6da5`) and a data-dense redesign
- **Lead Gen Analyzer** (`ba7808d`) — AI-powered CPL, form quality, audience analysis
- Phase 1 agency features: AI Digest, Global Chat, Account Health (`cd72806`)
- POST query tunneling to work around LinkedIn URL length limits

## Jun 2026 — Segmentation, then the MCP server

**Performance Segmentation** (Jun 1–2): naming-convention parser + benchmark comparison, made per-account configurable, then redesigned three times into the "dark maritime Performance Funnel" and finally matched to the platform design system.

**MCP server** (Jun 21, one intense day): Connect-to-Claude modal → MCP server for Claude Desktop → OAuth flow for Claude web → dynamic client registration → pre-registered fixed client ID → logo/favicon → token persistence across restarts → persistent MCP API keys → `call_linkedin_action` passthrough tool. The `mcp_api_keys` table came the same day.

**Jun 22** was spent on the fallout: RLS and table-level GRANT problems on `mcp_api_keys` (four separate "Granted access" commits), LinkedIn rate-limit loops, retry logic, and token sync on access change. One revert (`4e3e0ac`) because the edge function hadn't been deployed — the recurring pitfall documented in CLAUDE.md.

**Jun 23–29**: safe LinkedIn retry, deduped title URNs, batch job-titles fix, and a metrics correctness fix — `leads` now means `oneClickLeads` only, with conversions and formOpens exposed separately (`0f82140`).

## Jul 2026 — Client-facing reports, then docs and a deploy discovery

`ab22e39` (Jul 5) — client-accessible weekly reports. Claude-generated narrative published to a shareable public URL via the `published_reports` table and a `SECURITY DEFINER` RPC.

**Jul 19–20** — documentation and groundwork for bulk ad copying:

- `5ccf3ef` — added FEATURES.md and HISTORY.md, plus a Stop hook (`.claude/hooks/docs-freshness.sh`) that blocks once per session if `src/`, `supabase/`, or `mcp-server/` changed without either doc being updated.
- `655d9c9` — `probe_creative_create`, Stage 0 of bulk ad copying. Before building anything, this answers whether the app can create a LinkedIn creative at all or is blocked by Marketing Developer Platform Partner status — the same wall that already breaks creative thumbnails. It's the first code here to POST to a LinkedIn create endpoint, the first to read a response header, and the first to touch `intendedStatus`.
- `9e74e87` — **discovered the edge function CI deploy has been failing since at least Jun 24.** The workflow exists and triggers correctly, so CLAUDE.md was briefly "corrected" to claim auto-deploy works; checking actual run history showed four consecutive failures at the deploy step, most likely a stale `SUPABASE_ACCESS_TOKEN` secret. The doc now says the opposite. Worth remembering: a workflow file existing is not evidence it runs.

The probe was deployed out-of-band (via Lovable, not CI) and verified live — `probe_creative_create` returns its validation error while an unknown action returns `Unknown action`. Its MCP exclusion was also confirmed empirically: calling with the anon key returns `401 AUTH_REQUIRED`, because `mcp-server` never sends a user JWT and `mcp_api_keys` has no `user_id` to resolve one from.

Stages 1–3 of the feature (compatibility rules, `copy_creatives_to_campaigns`, and a "Bulk Editing" section under Creatives) are deliberately blocked on the probe's verdict. Full plan: `~/.claude/plans/analyze-the-api-and-twinkly-papert.md`.

---

## Aug 2026 — Making the MCP a product

The MCP was built as a single-tenant convenience and the auth model said so out loud. The
`mcp_api_keys` migration comment read *"the api_key (UUID) is the secret — possessing it is the
auth."* The table had no `user_id`, no expiry, no revoked flag; RLS was `using(true)` and four
separate migrations had granted `anon` SELECT/INSERT/UPDATE. Net effect: the published anon key —
hardcoded in `mcp-server/src/server.ts` — could dump every user's LinkedIn access token.

Deciding to split rather than gate. The alternative was opening the existing dashboard to users and
hiding everything but the MCP. Rejected because the expensive work (owner-scoped keys, a locked-down
resolver, SSO, revocation, expiry) is identical either way, while gating meant retrofitting access
control onto an app that has **none** — all 8 routes in `App.tsx` are public — across ~25 dashboard
tabs, in the daily driver, where one miss leaks internal tooling.

**The first attempt was wrong, and the correction is the lesson.** It hardened the *existing* server
in place, with the new resolver behind an `MCP_RESOLVER` env flag so behaviour only changed when the
flag flipped. That felt safe. It wasn't: the passthrough allowlist, the session-key binding, the
`DELETE`/`GET` auth checks, and the 401 body shape all applied unconditionally, and the planned
lockdown migration would have revoked the very anon grants the running resolver reads through. "Safe
behind a flag" was true of one change and false of five. A feature flag protects a behaviour; it does
not protect an architecture.

Rebuilt as genuine separation instead:

| | Legacy | Product |
|---|---|---|
| Entrypoint | `src/server.ts` (reverted, byte-identical) | `src/server-product.ts` |
| Table | `mcp_api_keys` (untouched) | `mcp_keys` (new) |
| Resolution | anon PostgREST select | `resolve_mcp_key()` RPC |

Shared: only the 16 tool definitions, with every new behaviour behind `mode: "product"` defaulting to
`"legacy"`. Two Railway services, one source folder. The sibling `linkedin-ads-mcp` repo — stale, no
remote, predating OAuth — is the argument against forking the code instead.

What that bought: the pre-existing holes on the legacy side (`mcp_api_keys` anon-readable,
`sync_mcp_token` unauthenticated) stay open rather than being "fixed" in a way that breaks a working
integration. They're now documented as scoped to the legacy system, to be closed when nothing depends
on it. A new table meant no lockdown migration, no legacy-key sunset date, and no backfill problem —
three pieces of the original plan that simply evaporated once the tables were separate.

Kept from the first pass: `resolve_mcp_key` returning a *status* rather than just a token, so
"expired, go reconnect" and "no such key" are distinguishable; the `mcp_server` role instead of
granting the RPC to `anon`, which would have swapped a readable table for a public token-exchange
oracle; and `SessionAuth` re-resolving on a 60s TTL instead of freezing the token in a closure, which
is what makes revocation actually revoke. Also deleted `create-test-user`, a public
`verify_jwt = false` endpoint that minted email-confirmed accounts with the service role — unrelated
to the MCP split, so it carried over untouched.

Two things learned rather than assumed. `linkedin_oidc` **is** in supabase-js's `Provider` union, so
real LinkedIn SSO is available — but `signInWithIdToken` supports only google/apple/azure/facebook/
kakao, so the one-consent-screen ID-token shortcut is not on the table. And single-consent via
`provider_token` was demoted from foundation to optimization: it exists for one instant, lands in the
browser, and buys one click once — while the server-side exchange path it would replace is needed
anyway as the day-60 reconnect.

Verified by running both servers side by side before any migration exists: legacy still falls through
on an unknown key and still accepts an unauthenticated `DELETE` (its original behaviour, preserved);
product fails closed with a reconnect URL and refuses the same `DELETE`.

### The SSO detour

The plan assumed Supabase's `linkedin_oidc` provider. Enabling it produced
`Unsupported provider: provider is not enabled`, repeatedly. Rather than guess, reading
`/auth/v1/settings` settled it — `email` was the only enabled provider, and stayed that way across
several attempts.

So sign-in was rebuilt to not need it. `linkedin_signin` does the exchange server-side, reads
`/v2/userinfo`, finds-or-creates the user, stores the ads token, and returns a `generateLink`
`hashed_token` the browser redeems with `verifyOtp`. It is unauthenticated by necessity — the caller
is signing in — with the LinkedIn authorization code as the credential. The result is strictly better
than the original plan: one consent screen, the access token never touches the browser, and a
dashboard toggle stops being a dependency. Worth remembering that a failing config step is sometimes
a hint the dependency was optional.

### Two credential dead ends, one of them informative

Deploying and migrating both stalled on Supabase access tokens that authenticate but see nothing —
`[]` from `/v1/projects`, 403 on the project. That is the signature of a *restricted* token, and it
almost certainly explains the edge-function CI failure that has been blamed on an expired secret
since June. Same symptom, same fix: an unrestricted token.

`scripts/setup-product.py` exists because of this — it verifies project access *first* and explains
the failure, rather than letting a 403 three steps later be the symptom, then applies both
migrations, deploys the function, and mints the `mcp_server` JWT.

### The hole that turned out to be public

`mcp_api_keys` being anon-readable was logged as a known-and-accepted legacy issue. Checking the repo
visibility changed that: `linkedin-ads-buddy` is **public**, and the anon key is committed in `.env`
and hardcoded in `tools.ts`. Verified live — 2 rows, `linkedin_token` readable, 350-char values, each
valid for `rw_ads`. Accepted-risk reasoning depends on assumptions that decay; this one had already
decayed and nobody had re-checked.

The fix is written and unapplied, because closing it breaks the legacy resolver by design. That is a
sequencing decision, not a defect — but it is now recorded as urgent rather than as background.

---

## Recurring themes

- **URN resolution is the project's tax.** Creative names, job titles, super titles, company names — each needed multiple rounds of encoding fixes, batch fetchers, and caches.
- **LinkedIn API versioning churn** forced repeated endpoint and version-header rewrites, especially Dec 2025.
- **Deploy drift.** The edge function deploys manually; several bugs traced back to code that was committed but never deployed.
- **Redesign cycles.** Targeting Editor, Influence Matcher, Lead Records, and Segmentation were each visually reworked 2–3 times toward a data-dense dashboard style.
