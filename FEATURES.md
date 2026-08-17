# FEATURES.md

What exists in LinkedIn Ads Buddy today. See [CLAUDE.md](CLAUDE.md) for architecture and [HISTORY.md](HISTORY.md) for how it got here.

## Routes

| Route | Page | Auth |
|---|---|---|
| `/` | [Index.tsx](src/pages/Index.tsx) — landing | No |
| `/auth` | [Auth.tsx](src/pages/Auth.tsx) — Supabase login | No |
| `/callback` | [Callback.tsx](src/pages/Callback.tsx) — LinkedIn OAuth return | No |
| `/dashboard` | [Dashboard.tsx](src/pages/Dashboard.tsx) — everything below | Yes |
| `/admin` | [Admin.tsx](src/pages/Admin.tsx) — user + account admin | Yes (admin) |
| `/social-listener` | [SocialListener.tsx](src/pages/SocialListener.tsx) — Apify-backed post/reactor listening | Yes |
| `/edge-status` | [EdgeFunctionStatus.tsx](src/pages/EdgeFunctionStatus.tsx) — edge function health | Yes |
| `/report/:token` | [PublishedReport.tsx](src/pages/PublishedReport.tsx) — public client report | **No** |

## Dashboard navigation

Defined in [Sidebar.tsx](src/components/dashboard/Sidebar.tsx). Seven groups.

**Frozen items** — nav items marked `hidden: true` on their `NavItem` are filtered out of both the sidebar and the ⌘K command palette, but their routes/tabs still exist and render if reached by direct URL (`?tab=<id>`). Currently frozen: Campaigns (`campaigns`), Creatives (`creatives`), Conv. Breakdown (`conv_breakdown`), Activity Report (`activity_report`), Account Health (`account_health`), Audiences (`audiences`), Titles (`standardized_titles`). Remove the flag to bring one back. A group whose visible items all become hidden renders nothing (no orphan header).

Groups and items:

### Main
| Item | Component |
|---|---|
| Overview | KPI cards + account selector |

### Campaigns
| Item | Component | Hook |
|---|---|---|
| Campaigns | [CampaignTable](src/components/dashboard/CampaignTable.tsx) | [useLinkedInAds](src/hooks/useLinkedInAds.ts) |
| Budget Pacing | [BudgetPacingDashboard](src/components/dashboard/BudgetPacingDashboard.tsx), [MegaBudgetPacingDashboard](src/components/dashboard/MegaBudgetPacingDashboard.tsx) | [useBudgetPacing](src/hooks/useBudgetPacing.ts), [useMegaBudgetPacing](src/hooks/useMegaBudgetPacing.ts) |
| Creatives | [CreativeGallery](src/components/dashboard/CreativeGallery.tsx) | [useCreativeReporting](src/hooks/useCreativeReporting.ts) |

### Bulk Editing
| Item | Component | Hook |
|---|---|---|
| Add Ads to Campaigns | [BulkCreativeCopy](src/components/dashboard/BulkCreativeCopy.tsx) | [useBulkCreativeCopy](src/hooks/useBulkCreativeCopy.ts) |
| Campaign Editor | [CampaignTargetingEditor](src/components/dashboard/CampaignTargetingEditor.tsx) | — |
| Audience Templates | [AudienceTemplates](src/components/dashboard/AudienceTemplates.tsx) | [useAudienceTemplates](src/hooks/useAudienceTemplates.ts) |

**Add Ads to Campaigns** — copies existing ads into other campaigns in bulk (N sources × M campaigns → N×M new creatives). Backend `bulk_copy_creatives`; platform-only (JWT + can_write gated), creates as Draft by default. Only *duplicable* ad types are listed (skips inline text/spotlight/follower, Message/InMail and dynamic ads — no shareable content reference). Source list defaults to **Active** ads (server-side status filter) for speed, with a status selector (Active/Paused/Draft/All). Names come from the REST creative `name`, then the post's text, then the analytics report. When copying a **lead gen** ad, an optional picker assigns a form (`list_lead_forms`) + CTA to the copies — `leadgenCallToAction` is DRAFT-only, so those copies are made Draft, the form/CTA is set via `partial_update`, then activated if Active was chosen. UI is a two-panel, numbered picker with a sticky action bar.

**Campaign Editor** — bulk targeting edits across multiple campaigns. Job titles, skills, companies, and industries can be added, replaced, or excluded. Add mode merges companies/industries into the campaign's existing organization OR clause, including uploaded company-list audience facets, so one-off additions widen that organization targeting instead of creating a new AND constraint. Backend `update_campaign_targeting`. Moved here from Reports (it is a bulk operation).

**Audience Templates** — reusable named audiences (include + exclude lists) stored in `saved_targeting_audiences` (new `exclude_entities` column). Assign an audience to any set of campaigns; assignments persist in `audience_campaign_assignments` (audience_id × campaign_id, last sync time/status) so an edited audience can be re-synced to all its campaigns. Applying treats the template as authoritative for its supplied include and exclude facets: exclusions replace the campaign's old values for that facet rather than accumulating them. The visible draft is saved before sync, and both layers are preflighted independently against LinkedIn's 100-value-per-facet limit. Platform-only write (canWrite gated).

**Any targeting facet, not just four** — the editor exposes ~28 facets grouped as Job / Company / Lists & audiences / Education / Interests / Demographics (titles current+past, seniority, function, years of experience, skills, employers current+past, industries, company size, revenue, growth rate, followers, matched audiences and dynamic/lookalike segments, degrees, fields of study, schools, interests, member traits, groups, age, gender, locations, language). Backend `search_targeting_entities` runs typeahead for searchable facets and full value-list retrieval (`q=adTargetingFacet`) for enumerable ones; entities carry their full `facet` URN. `update_campaign_targeting` accepts a generic `params.facets` map (`{ facetUrn: [urn…] }`), merged with the four legacy shortcut params, so any facet can be replaced/added/excluded. **Import from an existing campaign** (`get_campaign_targeting_entities`) pulls every facet on a chosen campaign — includes and excludes — resolved to readable names, to seed a template. Buckets in the UI are grouped by facet with counts.


**Facet capacity (100-value limit)** — LinkedIn caps each targeting facet at 100 values per campaign, so a bulk exclusion can fail per campaign with `titles length 117 cannot exceeded maximum 100`. The backend now computes the merged facet size before the PATCH and, when it would exceed 100, skips that campaign with a `FACET_LIMIT_EXCEEDED` result carrying existing/adding/total/room counts (no LinkedIn call). A read-only companion action `preflight_campaign_targeting` runs the same merge math and powers the inline "N of M campaigns will exceed the 100-value limit" warning above Apply. An optional `fillToLimit` flag adds only as many values as fit (selection order) instead of skipping. The editor shows a per-campaign result report (updated / skipped / failed) with Copy report, replacing the wall-of-text toast.

### Analytics
| Item | Component | Notes |
|---|---|---|
| Analytics | [AnalyticsDashboard](src/components/dashboard/AnalyticsDashboard.tsx) | Core metrics + charts |
| Campaign Reports | [CampaignReportingTable](src/components/dashboard/CampaignReportingTable.tsx), [CampaignGroupPerformanceTable](src/components/dashboard/CampaignGroupPerformanceTable.tsx) | |
| Creative Reports | [CreativeReportingTable](src/components/dashboard/CreativeReportingTable.tsx), [CreativeNamesReportTable](src/components/dashboard/CreativeNamesReportTable.tsx) | |
| Reports | [ReportingSection](src/components/dashboard/ReportingSection.tsx) | Demographic + company reports |
| Weekly Report | [WeeklyReport](src/components/dashboard/WeeklyReport.tsx) | Sun–Sat weeks, last-full-week comparison. Entry point for client publishing |
| Conv. Breakdown | [CompanyConversionBreakdown](src/components/dashboard/CompanyConversionBreakdown.tsx) | Company × conversion cross-tab |
| Activity Report | [ActivityReport](src/components/dashboard/ActivityReport.tsx) | |
| Creative Analyzer | [CreativeAnalyzer](src/components/dashboard/CreativeAnalyzer.tsx) | **AI** — agentic tool-calling |
| Lead Gen Analyzer | [LeadGenAnalyzer](src/components/dashboard/LeadGenAnalyzer.tsx) | **AI** — CPL, form quality, audience |
| Account Health | [AccountHealthCheck](src/components/dashboard/AccountHealthCheck.tsx) | |
| Segmentation | [PerformanceSegmentation](src/components/dashboard/PerformanceSegmentation.tsx) | Naming-convention parser + benchmarks, per-account configs |

### Audience
| Item | Component | Notes |
|---|---|---|
| Audiences | [AudienceInsightsHub](src/components/dashboard/AudienceInsightsHub.tsx), [AudienceExpansionSuggester](src/components/dashboard/AudienceExpansionSuggester.tsx) | Live size estimates via Audience Counts API |
| Company Timeline | [CompanyEngagementTimeline](src/components/dashboard/CompanyEngagementTimeline.tsx) | |
| Influence Matcher | [CompanyInfluenceMatcher](src/components/dashboard/CompanyInfluenceMatcher.tsx) | CRM CSV → LinkedIn attribution, 4-level drill-down |

### Tools
| Item | Component |
|---|---|
| Title Checker | [TitleCheckerPage](src/components/dashboard/TitleCheckerPage.tsx) |
| Titles | [StandardizedTitlesPage](src/components/dashboard/StandardizedTitlesPage.tsx) |
| Name Report | [NamingConventionReport](src/components/dashboard/NamingConventionReport.tsx) |

### Leads
| Item | Component |
|---|---|
| Forms & Leads | [LeadGenFormsTable](src/components/dashboard/LeadGenFormsTable.tsx), [LeadSyncReport](src/components/dashboard/LeadSyncReport.tsx) |
| Lead Records | [LeadRecordsViewer](src/components/dashboard/LeadRecordsViewer.tsx) |

## Cross-cutting features

- **AI chat** — [AgenticChatDrawer](src/components/dashboard/AgenticChatDrawer.tsx), global drawer with tool-calling
- **AI analysis panel** — [AIAnalysisPanel](src/components/dashboard/AIAnalysisPanel.tsx) + [useAIAnalysis](src/hooks/useAIAnalysis.ts)
- **Custom fields** — [CustomFieldEditor](src/components/dashboard/CustomFieldEditor.tsx), per campaign / campaign group
- **Campaign targeting editing** — [CampaignTargetingEditor](src/components/dashboard/CampaignTargetingEditor.tsx), writes targeting back to LinkedIn (surfaced under **Bulk Editing → Campaign Editor**)
- **CSV export** — most report tables, via [exportUtils](src/lib/exportUtils.ts)
- **MCP setup** — [ConnectClaude](src/components/dashboard/ConnectClaude.tsx)
- **Error boundary** — [ErrorBoundary](src/components/ErrorBoundary.tsx) wraps the dashboard tab content (in [Dashboard.tsx](src/pages/Dashboard.tsx)); a render crash shows a recoverable card with the error message instead of a blank page, and resets on tab change
- **Command palette** — [CommandPalette](src/components/dashboard/CommandPalette.tsx), ⌘K to jump to any screen/action (built off the sidebar's exported `navGroups`; AI Advisor moved to ⌘J)

## Design system

Tokens live in [src/index.css](src/index.css) (CSS variables) + [tailwind.config.ts](tailwind.config.ts); all shadcn components inherit them.

- **Palette** — warm paper canvas, deep-ink text, electric indigo primary (`--primary: 231 70% 51%`) with a violet companion (`--violet`) used only in gradients. LinkedIn brand blue stays separate (`--linkedin`).
- **Typography** — four-family system, all loaded via the `@import` in [src/index.css](src/index.css): **DM Sans** for body/UI (`font-sans`), **Space Grotesk** for headings (`h1`–`h6` base, `font-heading`), **Bricolage Grotesque** for the landing hero and dashboard page titles (`.font-display` / `font-display`), **JetBrains Mono** for code (`font-mono`).
- **Sidebar** — clean white surface via the `--sidebar-*` token set; active item = indigo tint pill + left accent bar. [Sidebar.tsx](src/components/dashboard/Sidebar.tsx) renders its own `NavRow` rather than the shadcn Button.
- **Chart colors** — `--chart-1..8`, a CVD-validated categorical palette (dataviz reference set). Fixed slot order, never cycled; components reference `hsl(var(--chart-N))` or the matching hex, not ad-hoc Tailwind colors.
- **Shadows/radius** — layered ink-tinted shadows (`--shadow-xs..lg`, `--shadow-primary` glow), 10px base radius. Utility classes: `.glass`, `.card-hover`, `.gradient-primary`, `.gradient-mesh`, `.text-gradient`.
- **Widget kit** — [widgets.tsx](src/components/dashboard/widgets.tsx): `WidgetCard` (card shell with title/subtitle/toolbar header), `EmptyState`, `StatusPill` (semantic tones: success/warning/danger/info/neutral), `SegmentedControl`, `ChartLegend`. All dashboard panels build from these; the budget-pacing dashboards were also moved onto the kit and LeadGenAnalyzer / CompanyInfluenceMatcher normalized to semantic status colors (`text-success`/`text-warning`/`text-destructive`) rather than ad-hoc Tailwind green/red/yellow.
- **Global primitives restyled** — the shadcn `Table` (uppercase tracked headers, secondary header band, softer row hover), `Tabs` (pill segmented look), and `Input` (card surface, focus ring) carry the new style, so every table/tab/field inherits it without per-file work.
- **Command palette (⌘K)** — [CommandPalette.tsx](src/components/dashboard/CommandPalette.tsx): fuzzy "jump to any screen or action" launcher, opened by the header "Jump to…" chip or ⌘/Ctrl-K. Navigation items are generated from the sidebar's exported `navGroups`.
- **AI Advisor shortcut** — moved from ⌘K to **⌘/Ctrl-J** (the palette now owns ⌘K).
- **Deep-linkable tabs** — dashboard tab state lives in the URL (`/dashboard?tab=campaigns`); `overview` is the bare URL. Switching tabs runs a fade-in transition.

## Client-facing weekly reports

Agency → client publishing flow.

| Piece | Location |
|---|---|
| Publish dialog | [GenerateClientReportDialog](src/components/dashboard/GenerateClientReportDialog.tsx) |
| Public view | [PublishedReportView](src/components/dashboard/PublishedReportView.tsx) |
| Data assembly | [useWeeklyReport](src/hooks/useWeeklyReport.ts) → [serializeReportForClaude](src/lib/serializeReportForClaude.ts) |
| Table + RPC | [migration](supabase/migrations/20260705130557_34183441-072a-4dde-b818-8b93628e8cb2.sql) — `published_reports`, `get_published_report(token)` |
| Edge actions | `publish_weekly_report`, `list_published_reports`, `revoke_published_report` |
| Claude prompt | `client_weekly_report` reportType in [analyze-data](supabase/functions/analyze-data/index.ts) |

## Edge functions

| Function | Purpose |
|---|---|
| `linkedin-api` | Monolith (~14k lines), **67 actions**. LinkedIn reporting + writes. Product auth is NOT here — see `mcp-auth` in the product repo |
| `analyze-data` | Claude calls. `DEFAULT_MODEL` = `claude-sonnet-4-20250514`, overridden per report type via `MODEL_BY_REPORT_TYPE` |
| `apify-proxy` | Apify passthrough for Social Listener. Needs `APIFY_TOKEN` |

`create-test-user` was **deleted 2026-08-05** — a public `verify_jwt = false` endpoint that minted email-confirmed accounts with the service role for anyone who knew the URL. ⚠️ Deleting the folder does not undeploy it; remove it in the Supabase dashboard (or `npx supabase functions delete create-test-user`) or it stays live.

### `linkedin-api` actions (67)

**Auth & accounts** — `get_auth_url`, `exchange_token`, `get_profile`, `get_ad_accounts`, `sync_ad_accounts`, `sync_mcp_token`

**Campaigns & creatives** — `get_campaigns`, `get_campaign_report`, `get_campaign_group_performance`, `get_campaign_performance_report`, `get_creatives`, `get_creative_report`, `get_creative_names_report`, `get_creative_performance_report`, `get_creative_analytics`, `get_creative_fatigue`, `get_account_structure`, `update_campaign_status`, `update_campaign_targeting`, `bulk_copy_creatives`, `list_lead_forms`

**Analytics** — `get_analytics`, `get_ad_analytics`, `get_demographic_analytics`, `get_objective_breakdowns`, `get_form_creative_analytics`

**Company analysis** — `get_company_demographic`, `get_company_intelligence`, `get_company_influence`, `get_company_campaign_breakdown`, `get_company_conversion_breakdown`, `get_company_engagement_report`, `get_company_engagement_timeline`, `get_creative_company_breakdown`, `exclude_companies_from_campaigns`, `update_company_name`

**Leads** — `get_lead_gen_forms`, `get_lead_gen_overview`, `get_lead_form_responses`, `get_lead_company_journey`

**Titles & skills** — `search_job_titles`, `bulk_search_titles`, `get_title_suggestions`, `get_title_details`, `get_job_titles_index`, `get_job_seniority_matrix`, `resolve_titles_to_functions`, `override_title_mapping`, `test_titles_api`, `search_skills`, `bulk_search_skills`, `get_skill_suggestions`, `get_skills_for_titles`

**Audiences & budget** — `get_audiences`, `get_audience_count`, `get_audience_expansion`, `get_budget_pacing`, `get_budget_pacing_summary`

**Custom fields** — `get_custom_fields`, `set_custom_field`, `bulk_set_custom_fields`, `delete_custom_field`

**Reports** — `get_weekly_report`, `publish_weekly_report`, `list_published_reports`, `revoke_published_report`

**Diagnostic (temporary)** — `probe_creative_create`

### `probe_creative_create` — delete once its verdict is known

Not a product surface. Answers one question before any bulk ad-copy feature gets built: **can this app create a LinkedIn creative at all, or is it blocked by Marketing Developer Platform Partner status?**

Creates one creative as `DRAFT` (never serves, never spends) referencing an existing ad's content URN, reports verbose diagnostics, then tries to archive it. Returns a `verdict`: `GO`, `PARTNER_GATED`, `INCOMPATIBLE_CONTENT`, `PAYLOAD_SHAPE`, `ROLE_INSUFFICIENT`, `TOKEN_EXPIRED`, or `NO_REFERENCE`/`UNSUPPORTED_REFERENCE`.

Three things it does that nothing else in the codebase does — all needed by the eventual feature:
- **POSTs to a LinkedIn create endpoint.** Every other write is a `partial_update` PATCH.
- **Reads a response header.** The new creative's URN comes back in `x-restli-id`, with `x-linkedin-id` / `location` / body as fallbacks.
- **Writes `intendedStatus`.** Read and written nowhere else; existing code reads `status`/`servingStatus`, a different field.

**Platform-only by design, verified empirically.** It gates on `supabaseClient.auth.getUser()`, and [mcp-server/src/tools.ts:26](mcp-server/src/tools.ts#L26) sends the Supabase *anon key* rather than a user JWT. Calling it through MCP returns `401 AUTH_REQUIRED`. Since `mcp_api_keys` has no `user_id` column, an MCP caller cannot be resolved to a Supabase user at all — so the exclusion is structural, not a check that could be routed around via `call_linkedin_action`.

## MCP server

Production: `https://linkedin-ads-buddy-production.up.railway.app/mcp`. Registry in [mcp-server/src/tools.ts](mcp-server/src/tools.ts).

16 tools exposed: `get_ad_accounts`, `get_campaigns`, `get_analytics`, `get_campaign_analytics`, `get_creative_analytics`, `get_demographic_analytics`, `get_creatives`, `get_audiences`, `update_campaign_status`, `get_lead_gen_forms`, `search_job_titles`, `get_budget_pacing`, `get_creative_performance_report`, `get_creative_fatigue`, `update_campaign_budget`, and `call_linkedin_action`.

In the legacy server `call_linkedin_action` is unrestricted, as it has always been. In the product server it is **allowlist-gated** (`PASSTHROUGH_READ` / `PASSTHROUGH_WRITE` in [mcp-server/src/tools.ts](mcp-server/src/tools.ts)) — an allowlist rather than a blocklist, so adding a `case` to the edge function's switch does not silently widen the MCP surface. Blocked: `sync_mcp_token`, `override_title_mapping`, `update_company_name` (service-role writes to tables with no `user_id` — cross-tenant in a shared server), `probe_creative_create`, `get_auth_url`, `exchange_token`.

## Standalone MCP product (separate service)

A second Railway service, [src/server-product.ts](mcp-server/src/server-product.ts), sharing only the tool definitions. The legacy server, its URL, and `mcp_api_keys` are untouched — that separation is structural, not a flag.

| | Legacy | Product |
|---|---|---|
| Entrypoint | `src/server.ts` | `src/server-product.ts` |
| Table | `mcp_api_keys` | `mcp_keys` |
| Resolution | anon PostgREST select, falls through to raw token | `resolve_mcp_key()` RPC, fail-closed |
| Keys | UUID in browser localStorage, no owner | owner-scoped, revocable, expiry-aware |

Everything new in `tools.ts` sits behind `mode: "product"` and defaults to `"legacy"`, so the single-arg call used by `src/server.ts` and `src/index.ts` behaves exactly as before.

**`mcp_keys`** — `user_id` (FK to `auth.users`), `status`, `allow_writes`, `last_used_at`, `linkedin_token_expires_at`, refresh-token columns. RLS-locked from creation: no anon grants, owner-scoped SELECT with column-level grants that keep `linkedin_token` unreadable from the browser, admin SELECT via `has_role`, one active key per user via a partial unique index.

**`resolve_mcp_key(text)`** — SECURITY DEFINER, returns a *status* alongside the token so "expired, go reconnect" is distinguishable from "no such key". Checks key lifecycle, the owner's `profiles.access_status`, and token expiry. Executable only by the dedicated `mcp_server` role — **not** `anon`, which would make it a public token-exchange oracle.

**Revocation is live.** `SessionAuth` re-resolves on a 60s TTL rather than freezing the token in a closure, sessions are bound to the key that opened them, and `GET`/`DELETE /mcp` verify that key.

**Signup is approval-gated.** `profiles.access_status` defaults to `'pending'`, so a LinkedIn signup on the product site gets a profile and a key but `resolve_mcp_key` returns `access_denied` until an admin approves — the key is inert in the meantime. The migration adds the column with `default 'active'` and *then* flips the default, so pre-existing dashboard users are backfilled as active and only new signups are gated. Approve from `/admin` on the product site.

⚠️ **Nothing seeds the first admin.** No migration inserts a `user_roles` row with `role = 'admin'`, so `/admin` is unreachable until you add one by hand after your first sign-in — `scripts/setup.py` in the product repo prints the SQL. Without it, pending users cannot be approved by anyone.

Key lifecycle actions are JWT-scoped: `link_mcp_key` (mint/rotate, derives `user_id` from the JWT), `connect_linkedin` (server-side code exchange; the token is stored, never returned to the browser — also the day-60 reconnect path), `revoke_mcp_key`.

### Sign-in — `linkedin_signin`

Does **not** use `signInWithOAuth({provider: "linkedin_oidc"})`. That needs the LinkedIn provider enabled in the Supabase dashboard, and enabling it repeatedly failed with `Unsupported provider: provider is not enabled` — confirmed against `/auth/v1/settings`, which showed `email` as the only enabled provider. Since the credentials it wants already exist as edge secrets, the flow runs through our own function instead:

```
mcp-auth get_auth_url (OIDC scopes) → LinkedIn consent → /auth/callback?code=…
  → linkedin_signin  (unauthenticated by necessity — the caller is signing in;
                      the LinkedIn authorization code is the credential)
       exchange code → /v2/userinfo → find-or-create user → store token in mcp_keys
       → generateLink → one-time hashed_token
  → supabase.auth.verifyOtp({token_hash}) → session
```

One consent screen covers identity and ads scopes, the access token never reaches the browser, and `linkedin_oidc` can stay disabled forever.

### Product site

Lives in a **separate repo**: `geryslov/ads-manager-hub-2bd81d31` (Lovable — TanStack Router, shadcn/ui, Nitro SSR). Routes: `/`, `/auth/callback`, `/linkedin/callback`, `/setup`, `/admin`, `/privacy`, `/terms`. Reads `mcp_keys`; expects `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_MCP_SERVER_URL` (the **product** Railway service), `VITE_MCP_CLIENT_ID` (`linkedin-ads-mcp`).

### Rollout status — nothing below is live yet

| Piece | Where | State |
|---|---|---|
| Migrations `20260805120000` / `120100` | product repo | written, **not applied** — `mcp_keys` returns 404 |
| `mcp-auth` function (sign-in + key lifecycle) | product repo | written, **not deployed** |
| `src/server-product.ts` | **here** | written, **no Railway service exists** |
| Product site | product repo | built and pushed; blocked on the three above |

All four are blocked on one thing: a Supabase access token with project access. Run
`python3 scripts/setup.py` **from `geryslov/ads-manager-hub-2bd81d31`** — it applies the product
migrations and deploys `mcp-auth`. Nothing in this repo needs to be deployed for the product.

## Known gaps

- **Edge function CI deploy is broken.** [deploy-functions.yml](.github/workflows/deploy-functions.yml) has failed on every run since at least 2026-06-24, dying at the "Deploy linkedin-api function" step. Pushing to `main` does not deploy. **Revised diagnosis (2026-08-05):** not an expired token, as previously assumed — an *under-privileged* one. A restricted Supabase access token authenticates fine but returns `[]` from `/v1/projects` and 403s on deploy, which is exactly this failure. Reproduced by hand with a fresh token. Fix the repo secret with an **unrestricted** personal access token and CI should recover.
- **Creative thumbnails** are unavailable for most creatives (LinkedIn Partner-gated `/rest/posts/`). Gallery splits into "with images" / "No Preview Available". See CLAUDE.md.
- **Demographic analytics** returns empty below LinkedIn's 300-impression privacy threshold.
- **Influence Matcher CSV export** has no creative-level toggle. The plan in [.lovable/plan.md](.lovable/plan.md) specified an "Include creative breakdown" export option; the fetch, cache, and UI shipped but `getExportData` ([useCompanyInfluenceMatcher.ts:459](src/hooks/useCompanyInfluenceMatcher.ts#L459)) still exports at campaign level.
- **`bulk_set_custom_fields` is dead code** — no frontend caller; `useCustomFields.ts` only exposes the singular `setCustomField`.
- **README.md** is unmodified Lovable boilerplate.
- 🔴 **`mcp_api_keys` leaks live LinkedIn tokens to anyone. VERIFIED 2026-08-05, not theoretical.** Four migrations granted `anon` SELECT/INSERT/UPDATE and both RLS policies are `using(true)`. This repo is **public** and the anon key is committed in `.env` *and* hardcoded in [mcp-server/src/tools.ts:5](mcp-server/src/tools.ts#L5), so the credential needed is already published. Confirmed live: 2 rows returned, `linkedin_token` readable, 350-char values — each valid for reading **and writing** real campaigns (`rw_ads`).
  ```bash
  curl "$SUPABASE_URL/rest/v1/mcp_api_keys?select=*" -H "apikey: $ANON_KEY"
  ```
  Fix is written and **deliberately unapplied**: [20260805130000_close_mcp_api_keys_anon_read.sql](supabase/migrations/20260805130000_close_mcp_api_keys_anon_read.sql). It breaks the legacy resolver — an anon-readable table *is* that resolver's mechanism, so there is no version that closes the hole and keeps that path. Run it once your own Claude integration is on the product MCP service. The new `mcp_keys` table was locked down from creation and is unaffected.
- **`sync_mcp_token` has no caller auth.** Service-role upsert, `verify_jwt = false`, so anyone can overwrite any key's LinkedIn token. Same reasoning: the old dashboard depends on it. Blocked from the product passthrough.
- **No LinkedIn token refresh.** Access tokens die at ~60 days; refresh tokens are Marketing Developer Platform partner-gated. `connect_linkedin` reports `hasRefreshToken` so the answer is observable on the next real connect.
- **`get_profile` still calls `/v2/me`**, which requires the deprecated `r_liteprofile`. That is why `get_auth_url` keeps two mutually-exclusive scope sets (`legacy` and `oidc`) instead of one — OIDC callers should read identity from `/v2/userinfo`.
