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

## Jul 2026 — Client-facing reports

`ab22e39` (Jul 5) — client-accessible weekly reports. Claude-generated narrative published to a shareable public URL via the `published_reports` table and a `SECURITY DEFINER` RPC. Current HEAD.

---

## Recurring themes

- **URN resolution is the project's tax.** Creative names, job titles, super titles, company names — each needed multiple rounds of encoding fixes, batch fetchers, and caches.
- **LinkedIn API versioning churn** forced repeated endpoint and version-header rewrites, especially Dec 2025.
- **Deploy drift.** The edge function deploys manually; several bugs traced back to code that was committed but never deployed.
- **Redesign cycles.** Targeting Editor, Influence Matcher, Lead Records, and Segmentation were each visually reworked 2–3 times toward a data-dense dashboard style.
