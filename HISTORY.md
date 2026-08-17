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

**Jul 20 — Bulk Editing → Add Ads to Campaigns (Stages 1–3 shipped).** With the probe's verdict in hand, the real feature landed: a new **Bulk Editing** sidebar section under Creatives that copies existing ads into other campaigns in bulk. Since a LinkedIn creative is bound to one campaign, there is no move/share — the feature reads each source creative's `content.reference` (ugcPost/share URN) and creates a new creative in every selected target campaign. New action `bulk_copy_creatives` (platform-only, JWT + can_write gated, mirroring the probe; resolves each source reference once, then creates one creative per source×target as Draft by default, sequential with rate-limit backoff, per-item verdicts), hook [useBulkCreativeCopy.ts](src/hooks/useBulkCreativeCopy.ts), UI [BulkCreativeCopy.tsx](src/components/dashboard/BulkCreativeCopy.tsx). Compatibility rules (skip inline text/spotlight/follower and Message/InMail) enforced server-side and surfaced in the UI.

**Jul 20–21 — hardening the copy flow, then a redesign.** A run of fixes that traced the usual taxes (URN resolution, deploy drift). In order: surface the real edge-function error instead of supabase-js's generic "non-2xx" (read `FunctionsHttpError.context`); show freshly copied drafts by building the source list from the raw `get_creatives` list, not just the analytics report; paginate `get_creatives` (it was returning only LinkedIn's default 10, so recent ads never appeared on large accounts); resolve real ad **names** — REST creative `name` via batch-get, then the post's text via `/v2/ugcPosts`, since the legacy list carries no name for sponsored content; a status filter defaulting to **Active** for speed; and filtering the list to only *duplicable* ad types. Then the view was rebuilt as a cleaner, less-crowded SaaS layout (numbered panels, segmented status control, lighter rows, sticky action bar) — mockup-first, then implemented.

**Jul 21 — lead gen form + CTA on copy.** When duplicating a lead gen ad you can now assign a form + CTA to the copies. LinkedIn's `leadgenCallToAction` (destination = `urn:li:adForm:{id}`, plus a CTA label) is editable **only while a creative is DRAFT**, which fits the copy's default: new action `list_lead_forms` (reuses the `/rest/leadForms?q=owner` finder), and `bulk_copy_creatives` gained `adFormId` + `ctaLabel` — it creates the copy DRAFT, sets the form/CTA via `partial_update`, then activates if Active was chosen. Applies to lead gen ads only; per-item `formApplied` reported.

**Jul 21 — Campaign Editor moved to Bulk Editing.** The targeting editor (`update_campaign_targeting`) was a tab inside Reports but is a bulk operation, so it became a second **Bulk Editing** item, routed from the dashboard.

**Jul 23 — platform-wide visual redesign.** Full design-system pass toward a contemporary SaaS look, done at the token level so all ~70 dashboard components inherit it: new palette (warm paper canvas, deep-ink text, electric indigo primary + violet gradient accent), Fraunces display serif for the landing hero and page titles, layered ink-tinted shadows, 10px radius. The sidebar was rebuilt on the `--sidebar-*` tokens with a purpose-built `NavRow` (indigo tint pill + left accent bar for the active item, avatar footer chip) — first as a dark ink surface, immediately revised to a clean white one on user feedback ("don't use black background"). The landing page was rebuilt (sticky glass nav, display-serif hero, faux product mockup with KPI row + bar chart, indigo gradient CTA band — also lightened from the initial dark version). MetricCard became a proper stat tile. Chart colors were consolidated onto `--chart-1..8` — a CVD-validated categorical palette replacing the ad-hoc Tailwind hex scattered across AnalyticsDashboard, CompanyEngagementTimeline, CompanyDemographicCharts, WeeklyReport sparklines, CreativeAnalyzer, LeadGenAnalyzer, and the social-listener charts.

**Jul 23 — widget-level redesign + functional upgrades.** Second pass, into the panels themselves. New shared widget kit ([widgets.tsx](src/components/dashboard/widgets.tsx): `WidgetCard`, `EmptyState`, `StatusPill`, `SegmentedControl`, `ChartLegend`). CampaignTable rebuilt: name search, sortable columns, status filter as segmented chips with live counts (replacing the dropdown), one-click pause/activate on row hover; the campaigns tab dropped its three redundant count cards. AnalyticsDashboard restructured to eliminate its **dual-axis charts** (a data-viz correctness fix, not just cosmetics): one "Daily performance" panel with a metric picker (Impressions/Clicks/Spend/Leads — area for counts, bars for spend/leads), plus CTR/CPC small multiples, each with a single axis. Overview gained a derived-efficiency strip (CTR/CPC/CPM/cost-per-conversion computed client-side) and a lighter recent-campaigns list with "View all". AccountSelector was compacted to fit the header (empty state is now a small pill, not a block). Dashboard tabs became deep-linkable (`?tab=`). AudienceCard restyled onto the kit.

**Jul 23 — app-wide "innovative" pass: primitives, command palette, ~25 report screens.** Third redesign pass, aiming to touch every screen/flow/table. Restyled the global shadcn primitives (`Table`, `Tabs`, `Input`) so all tables/tabs/fields upgrade at once. Added a **⌘K command palette** ([CommandPalette.tsx](src/components/dashboard/CommandPalette.tsx)) that jumps to any screen/action, built off the sidebar's now-exported `navGroups`; the AI Advisor drawer moved to ⌘J to free ⌘K. Tab switches now fade in. Redesigned the 404 page. Then a fan-out of four subagents converted ~25 report/analysis components onto the widget kit (reports tables, weekly/health/segmentation, creatives + budget pacing, leads + audience + naming). The agents were interrupted by a monthly spend cap mid-run; integration afterward caught the real breakage that `vite build` had hidden — esbuild strips types without checking them, and the root `tsconfig.json` has no `files`, so `tsc --noEmit` checked nothing. Type-checking via **`tsconfig.app.json`** surfaced 112 errors: ReportingSection had been half-converted (bare `<Card>` with its import removed → runtime "Card is not defined"), and `SegmentedControl`'s generic `onChange` fell back to its `string | number` constraint across 8 callers. Fixed by restoring ReportingSection's Card/Badge/icon imports (+ relaxing over-dense KPI grids from 8–10 cols and dropping a duplicate page title) and typing `SegmentedControl.onChange` as `Dispatch<SetStateAction<T>> | ((v:T)=>void)`. Lesson recorded: **for this repo, `tsc -p tsconfig.app.json --noEmit` is the real type gate — `bun run build` alone is not.** The four files the cap prevented the agents from reaching were then finished by hand: BudgetPacingDashboard was rewritten off its glassmorphism (`bg-card/50 backdrop-blur`) onto WidgetCard + a stat strip + ChartLegend; MegaBudgetPacingDashboard got WidgetCard + StatusPill + tabular numbers; LeadGenAnalyzer and CompanyInfluenceMatcher (678 and 1166 lines) were normalized to semantic status colors (`text-success`/`text-warning`/`text-destructive`) instead of a full structural rebuild — the pragmatic call for large files that can't be visually verified without live data. All screens now type-check via `tsconfig.app.json`.

**Jul 23 — typography swap to a four-family grotesque system.** Replaced the Plus Jakarta Sans + Fraunces pairing with **DM Sans** (body/UI), **Space Grotesk** (headings — `h1`–`h6` and a new `font-heading` token), **Bricolage Grotesque** (display: hero + page titles, where Fraunces was), keeping **JetBrains Mono** for code. One `@import` in [index.css](src/index.css) loads all four; `tailwind.config.ts` maps `font-sans`/`font-heading`/`font-display`/`font-mono`. (A report had flagged the docs as referencing Inter/IBM Plex Mono, but the repo never used those — the actual prior stack was Plus Jakarta/Fraunces; this change is the real switch to the intended grotesque stack.)

**Jul 23 — froze seven unused nav tabs.** Added a `hidden?: boolean` flag to `NavItem`; the sidebar and command palette both filter it out (and skip a group that ends up with no visible items). Froze Campaigns, Creatives, Conv. Breakdown, Activity Report, Account Health, Audiences, and Titles — hidden from navigation but their Dashboard routes/tabs are untouched, so they still render via `?tab=<id>` and re-enable by removing the flag. No deletions.

**Jul 23 — fixed ~10× inflated demographic metrics (pagination double-count).** Company demographics read ~9.6× too high (e.g. Lighthouse showed 94,710 impressions vs LinkedIn's 9,833 for the same company + 365-day range in the Influence Matcher). Root cause: the analytics pagination loops trusted `paging.total`, but LinkedIn's `adAnalyticsV2?q=analytics` finder reports the *underlying record count* (campaign×creative×company) for demographic pivots — not the number of pivot rows — and does not reliably honor `&start=`, so re-requests returned the same rows, which the loops re-summed. Replaced the `paging.total`-based termination with "continue only while the page came back completely full" (plus a duplicate-page guard in `get_company_demographic`) across the four summing/concat loops: `get_company_demographic`, `get_demographic_analytics` (Demographics tab + reports), `get_objective_breakdowns` (per-objective company breakdown, two loops), and `get_company_engagement_report` (Company Timeline). The remaining `paging.total` loops were left as-is because they aggregate into a `Set` (activity/creative probes) or assign idempotently (`get_creative_company_breakdown`), so re-fetches can't inflate them. **Requires a manual edge-function deploy to take effect** — the CI deploy has been failing (see CLAUDE.md), so pushing to `main` does not deploy this.

**Jul 22–23 — Influence Matcher blank-page crash + a global error boundary.** Uploading a CSV blanked the whole page: a render error inside a dashboard tab unmounted the entire React tree to a white screen with no message. Added a reusable [ErrorBoundary](src/components/ErrorBoundary.tsx) around the tab content (resets on tab change) so a crash now shows a recoverable card *with the error text* — which immediately surfaced the real cause: `A <Select.Item /> must have a value prop that is not an empty string`. A CSV with a blank column header produced `<SelectItem value="">` in the column-mapping dropdown, which Radix rejects. Fixed by trimming, dropping empties, and de-duplicating headers before building the items; also hardened `detectColumns` (coerce headers to strings) and made `normalizeName` null-safe against the same class of bad input.

---

## Aug 2026 — Making the MCP a product

**Aug 17 — Audience Template exclusion sync corrected.** Templates with exactly 100 visible titles could still fail because their exclusion call used additive Campaign Editor semantics: a campaign's existing exclusions were merged with the template, producing more than 100. Audience Template exclusions now replace the supplied exclusion facets, preflight the final replacement independently from includes, and save/apply the visible editor draft so removed chips cannot be bypassed by a stale saved template. Campaign Editor exclusion remains additive.

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

The product's setup script exists because of this — it verifies project access *first* and explains
the failure, rather than letting a 403 three steps later be the symptom, then applies both
migrations, deploys the function, and mints the `mcp_server` JWT. (Written here as
`scripts/setup-product.py`; moved to `scripts/setup.py` in `geryslov/ads-manager-hub-2bd81d31` on
2026-08-06 when the product's auth function and schema moved to that repo.)

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
