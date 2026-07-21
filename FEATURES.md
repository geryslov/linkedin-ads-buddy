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

Defined in [Sidebar.tsx](src/components/dashboard/Sidebar.tsx). Seven groups:

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

**Add Ads to Campaigns** — copies existing ads into other campaigns in bulk (N sources × M campaigns → N×M new creatives). Backend `bulk_copy_creatives`; platform-only (JWT + can_write gated), creates as Draft by default. Only *duplicable* ad types are listed (skips inline text/spotlight/follower, Message/InMail and dynamic ads — no shareable content reference). Source list defaults to **Active** ads (server-side status filter) for speed, with a status selector (Active/Paused/Draft/All). Names come from the REST creative `name`, then the post's text, then the analytics report. When copying a **lead gen** ad, an optional picker assigns a form (`list_lead_forms`) + CTA to the copies — `leadgenCallToAction` is DRAFT-only, so those copies are made Draft, the form/CTA is set via `partial_update`, then activated if Active was chosen. UI is a two-panel, numbered picker with a sticky action bar.

**Campaign Editor** — bulk targeting edits across multiple campaigns (append/replace job titles + skills). Backend `update_campaign_targeting`. Moved here from Reports (it is a bulk operation).

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

## Client-facing weekly reports

Agency → client publishing flow.

| Piece | Location |
|---|---|
| Publish dialog | [GenerateClientReportDialog](src/components/dashboard/GenerateClientReportDialog.tsx) |
| Public view | [PublishedReportView](src/components/dashboard/PublishedReportView.tsx) |
| Data assembly | [useWeeklyReport](src/hooks/useWeeklyReport.ts) → [serializeReportForClaude](src/lib/serializeReportForClaude.ts) |
| Table + RPC | [migration](supabase/migrations/20260705000000_published_reports.sql) — `published_reports`, `get_published_report(token)` |
| Edge actions | `publish_weekly_report`, `list_published_reports`, `revoke_published_report` |
| Claude prompt | `client_weekly_report` reportType in [analyze-data](supabase/functions/analyze-data/index.ts) |

## Edge functions

| Function | Purpose |
|---|---|
| `linkedin-api` | Monolith (~13.6k lines), **67 actions**. All LinkedIn API access |
| `analyze-data` | Claude calls. `DEFAULT_MODEL` = `claude-sonnet-4-20250514`, overridden per report type via `MODEL_BY_REPORT_TYPE` |
| `apify-proxy` | Apify passthrough for Social Listener. Needs `APIFY_TOKEN` |
| `create-test-user` | Test login flow |

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

16 tools exposed: `get_ad_accounts`, `get_campaigns`, `get_analytics`, `get_campaign_analytics`, `get_creative_analytics`, `get_demographic_analytics`, `get_creatives`, `get_audiences`, `update_campaign_status`, `get_lead_gen_forms`, `search_job_titles`, `get_budget_pacing`, `get_creative_performance_report`, `get_creative_fatigue`, `update_campaign_budget`, and `call_linkedin_action` — the passthrough that reaches every edge action *except* those behind the JWT gate (`update_campaign_targeting`, `probe_creative_create`).

## Known gaps

- **Edge function CI deploy is broken.** [deploy-functions.yml](.github/workflows/deploy-functions.yml) has failed on every run since at least 2026-06-24, dying at the "Deploy linkedin-api function" step — most likely a stale `SUPABASE_ACCESS_TOKEN` repo secret. Pushing to `main` does not deploy. Verify in the Actions tab after any push, or deploy manually.
- **Creative thumbnails** are unavailable for most creatives (LinkedIn Partner-gated `/rest/posts/`). Gallery splits into "with images" / "No Preview Available". See CLAUDE.md.
- **Demographic analytics** returns empty below LinkedIn's 300-impression privacy threshold.
- **Influence Matcher CSV export** has no creative-level toggle. The plan in [.lovable/plan.md](.lovable/plan.md) specified an "Include creative breakdown" export option; the fetch, cache, and UI shipped but `getExportData` ([useCompanyInfluenceMatcher.ts:459](src/hooks/useCompanyInfluenceMatcher.ts#L459)) still exports at campaign level.
- **`bulk_set_custom_fields` is dead code** — no frontend caller; `useCustomFields.ts` only exposes the singular `setCustomField`.
- **README.md** is unmodified Lovable boilerplate.
