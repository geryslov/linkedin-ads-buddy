import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://bxoxefmenvlxiubynuay.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4b3hlZm1lbnZseGl1YnludWF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0NTUzMzQsImV4cCI6MjA4MTAzMTMzNH0.ox7oP80ZqfgC5wuEJbtiMTiB-XxmCzrN2ZlZ9tpo8QI";
const LINKEDIN_API = "https://api.linkedin.com";

// ── Passthrough allowlist ────────────────────────────────────────────────────
// An allowlist, not a blocklist: a blocklist silently reopens every time someone
// adds a `case` to the edge function's switch.
//
// Deliberately excluded, and why:
//   sync_mcp_token        — service role, no caller auth. Any MCP user could
//                           overwrite ANY key's linkedin_token, silently
//                           repointing another user's Claude at their accounts.
//   override_title_mapping} service role writes to title_function_map /
//   update_company_name   } linkedin_company_cache — global tables with no
//                           user_id. Shared-cache poisoning across all tenants.
//   probe_creative_create — creates a real LinkedIn creative. Diagnostic only.
//   get_auth_url          } OAuth plumbing; does not belong on the MCP surface.
//   exchange_token        }
//   *_published_report    — JWT-scoped platform actions; 401 from here anyway.
const PASSTHROUGH_READ = new Set([
  "bulk_search_skills", "bulk_search_titles", "get_account_structure", "get_ad_accounts",
  "get_ad_analytics", "get_analytics", "get_audience_count", "get_audience_expansion",
  "get_audiences", "get_budget_pacing", "get_budget_pacing_summary",
  "get_campaign_group_performance", "get_campaign_performance_report", "get_campaign_report",
  "get_campaigns", "get_company_campaign_breakdown", "get_company_conversion_breakdown",
  "get_company_demographic", "get_company_engagement_report", "get_company_engagement_timeline",
  "get_company_influence", "get_company_intelligence", "get_creative_analytics",
  "get_creative_company_breakdown", "get_creative_fatigue", "get_creative_names_report",
  "get_creative_performance_report", "get_creative_report", "get_creatives",
  "get_custom_fields", "get_demographic_analytics", "get_form_creative_analytics",
  "get_job_seniority_matrix", "get_job_titles_index", "get_lead_company_journey",
  "get_lead_form_responses", "get_lead_gen_forms", "get_lead_gen_overview",
  "get_objective_breakdowns", "get_profile", "get_skill_suggestions", "get_skills_for_titles",
  "get_title_details", "get_title_suggestions", "get_weekly_report",
  "resolve_titles_to_functions", "search_job_titles", "search_skills", "test_titles_api",
]);

// Scoped by the caller's own LinkedIn token — no cross-tenant risk, but these
// move real money or mutate real campaigns. Gated on the key's allow_writes flag.
const PASSTHROUGH_WRITE = new Set([
  "update_campaign_status", "update_campaign_targeting", "exclude_companies_from_campaigns",
  "set_custom_field", "bulk_set_custom_fields", "delete_custom_field", "sync_ad_accounts",
]);

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function dates(startDate?: string, endDate?: string) {
  const end = endDate || new Date().toISOString().split("T")[0];
  const start = startDate || new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  return { start, end };
}

export type ServerOptions = {
  /**
   * 'legacy'  — the single-tenant server (src/server.ts, src/index.ts). Every
   *             behaviour below is off, so this is identical to the original.
   * 'product' — the multi-tenant server (src/server-product.ts): passthrough
   *             allowlist, write gating, and reconnect-friendly auth errors.
   *
   * Defaults to 'legacy'. Do not change that default — the existing Railway
   * deployment must keep behaving exactly as it does today.
   */
  mode?: "legacy" | "product";
  /** Product mode only: whether this key may perform write actions. */
  allowWrites?: () => boolean;
  /** Product mode only: where to send a user whose connection has expired. */
  setupUrl?: string;
};

export function createLinkedInAdsServer(
  getToken: () => string,
  opts: ServerOptions = {}
): McpServer {
  const server = new McpServer({ name: "linkedin-ads", version: "2.0.0" });
  const productMode = opts.mode === "product";
  const allowWrites = productMode ? (opts.allowWrites ?? (() => true)) : (() => true);
  const setupUrl = opts.setupUrl ?? "https://linkedin-ads-buddy.lovable.app/setup";

  const readOnlyMessage = (action: string) =>
    `'${action}' changes live campaign settings and this MCP key is read-only. ` +
    `Ask the workspace owner to enable writes at ${setupUrl}.`;

  async function callEdge(action: string, params: Record<string, unknown> = {}): Promise<unknown> {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/linkedin-api`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ action, accessToken: getToken(), params }),
    });
    const text = await res.text();
    if (!res.ok) {
      // A dead LinkedIn token must not surface as a raw 401 — the model reads
      // that as "the tool is broken" rather than "the user must reconnect".
      // Product mode only: the legacy server keeps its original error text.
      if (productMode && (res.status === 401 || res.status === 403)) {
        throw new Error(
          `Your LinkedIn connection is no longer valid (${res.status}). ` +
          `LinkedIn access tokens expire after about 60 days. ` +
          `Reconnect at ${setupUrl}, then retry this request.`
        );
      }
      let msg = text.slice(0, 500);
      try { msg = (JSON.parse(text) as any).error || msg; } catch { /* noop */ }
      throw new Error(`LinkedIn API error (${action}) ${res.status}: ${msg}`);
    }
    try { return JSON.parse(text); } catch { return { raw: text }; }
  }

  server.tool(
    "get_ad_accounts",
    "List all LinkedIn Ad accounts the authenticated user has access to.",
    {},
    async () => ok(await callEdge("get_ad_accounts"))
  );

  server.tool(
    "get_campaigns",
    "List campaigns for a LinkedIn Ad account. Optionally filter by status (ACTIVE, PAUSED, ARCHIVED, DRAFT, CANCELED).",
    {
      accountId: z.string().describe("LinkedIn Ad Account ID (numeric)"),
      status: z.string().optional().describe("Filter by status: ACTIVE, PAUSED, ARCHIVED, DRAFT, CANCELED"),
    },
    async ({ accountId, status }) => ok(await callEdge("get_campaigns", { accountId, status }))
  );

  server.tool(
    "get_analytics",
    "Get account-level analytics (impressions, clicks, spend, leads, CTR) for a LinkedIn Ad account.",
    {
      accountId: z.string().describe("LinkedIn Ad Account ID"),
      startDate: z.string().optional().describe("Start date YYYY-MM-DD (default: 30 days ago)"),
      endDate: z.string().optional().describe("End date YYYY-MM-DD (default: today)"),
    },
    async ({ accountId, startDate, endDate }) =>
      ok(await callEdge("get_analytics", { accountId, dateRange: dates(startDate, endDate) }))
  );

  server.tool(
    "get_campaign_analytics",
    "Get per-campaign performance report with spend, impressions, clicks, leads, CTR, CPL.",
    {
      accountId: z.string().describe("LinkedIn Ad Account ID"),
      startDate: z.string().optional().describe("Start date YYYY-MM-DD (default: 30 days ago)"),
      endDate: z.string().optional().describe("End date YYYY-MM-DD (default: today)"),
    },
    async ({ accountId, startDate, endDate }) => {
      const { start, end } = dates(startDate, endDate);
      return ok(await callEdge("get_campaign_report", { accountId, startDate: start, endDate: end }));
    }
  );

  server.tool(
    "get_creative_analytics",
    "Get per-creative performance metrics for a LinkedIn Ad account.",
    {
      accountId: z.string().describe("LinkedIn Ad Account ID"),
      startDate: z.string().optional().describe("Start date YYYY-MM-DD (default: 30 days ago)"),
      endDate: z.string().optional().describe("End date YYYY-MM-DD (default: today)"),
    },
    async ({ accountId, startDate, endDate }) =>
      ok(await callEdge("get_creative_analytics", { accountId, dateRange: dates(startDate, endDate) }))
  );

  server.tool(
    "get_demographic_analytics",
    "Get demographic breakdown (job function, seniority, industry, country, job title) for a LinkedIn Ad account.",
    {
      accountId: z.string().describe("LinkedIn Ad Account ID"),
      pivot: z.string().optional().describe("Dimension: MEMBER_JOB_FUNCTION, MEMBER_SENIORITY, MEMBER_INDUSTRY, MEMBER_COUNTRY, MEMBER_JOB_TITLE (default: MEMBER_JOB_FUNCTION)"),
      startDate: z.string().optional().describe("Start date YYYY-MM-DD (default: 30 days ago)"),
      endDate: z.string().optional().describe("End date YYYY-MM-DD (default: today)"),
    },
    async ({ accountId, pivot, startDate, endDate }) =>
      ok(await callEdge("get_demographic_analytics", {
        accountId,
        pivot: pivot || "MEMBER_JOB_FUNCTION",
        dateRange: dates(startDate, endDate),
      }))
  );

  server.tool(
    "get_creatives",
    "List ad creatives for a LinkedIn Ad account with their status and campaign references.",
    { accountId: z.string().describe("LinkedIn Ad Account ID") },
    async ({ accountId }) => ok(await callEdge("get_creatives", { accountId }))
  );

  server.tool(
    "get_audiences",
    "List matched audiences (DMP segments) for a LinkedIn Ad account.",
    { accountId: z.string().describe("LinkedIn Ad Account ID") },
    async ({ accountId }) => ok(await callEdge("get_audiences", { accountId }))
  );

  server.tool(
    "update_campaign_status",
    "Change the status of a LinkedIn campaign.",
    {
      campaignId: z.string().describe("LinkedIn Campaign ID"),
      status: z.string().describe("New status: ACTIVE, PAUSED, ARCHIVED, CANCELED"),
    },
    async ({ campaignId, status }) => {
      if (!allowWrites()) return ok({ error: readOnlyMessage("update_campaign_status") });
      return ok(await callEdge("update_campaign_status", { campaignId, status }));
    }
  );

  server.tool(
    "get_lead_gen_forms",
    "List lead generation forms for a LinkedIn Ad account with response counts.",
    { accountId: z.string().describe("LinkedIn Ad Account ID") },
    async ({ accountId }) => ok(await callEdge("get_lead_gen_forms", { accountId }))
  );

  server.tool(
    "search_job_titles",
    "Search LinkedIn job titles for audience targeting.",
    { query: z.string().describe("Job title search query (e.g. 'Software Engineer', 'VP Marketing')") },
    async ({ query }) => ok(await callEdge("search_job_titles", { query }))
  );

  server.tool(
    "get_budget_pacing",
    "Get current month spend, budget pacing status (on_track / underspend / overspend), and recommendations.",
    { accountId: z.string().describe("LinkedIn Ad Account ID") },
    async ({ accountId }) => ok(await callEdge("get_budget_pacing", { accountId }))
  );

  server.tool(
    "get_creative_performance_report",
    "Get a multi-period creative performance report comparing 7d, 14d, and 30d metrics.",
    { accountId: z.string().describe("LinkedIn Ad Account ID") },
    async ({ accountId }) => ok(await callEdge("get_creative_performance_report", { accountId }))
  );

  server.tool(
    "get_creative_fatigue",
    "Detect creative fatigue by analyzing CTR and delivery trends. Flags creatives with declining performance.",
    {
      accountId: z.string().describe("LinkedIn Ad Account ID"),
      startDate: z.string().optional().describe("Start date YYYY-MM-DD (default: 30 days ago)"),
      endDate: z.string().optional().describe("End date YYYY-MM-DD (default: today)"),
    },
    async ({ accountId, startDate, endDate }) =>
      ok(await callEdge("get_creative_fatigue", { accountId, dateRange: dates(startDate, endDate) }))
  );

  // Budget update calls LinkedIn directly — no matching edge function action
  server.tool(
    "update_campaign_budget",
    "Update the daily or total budget for a LinkedIn campaign.",
    {
      campaignId:   z.string().describe("Campaign ID to update"),
      budgetType:   z.enum(["daily", "total"]).describe("Whether to update the daily or total budget"),
      amount:       z.number().positive().describe("Budget amount in account currency"),
      currencyCode: z.string().optional().describe("ISO currency code (default: USD)"),
    },
    async ({ campaignId, budgetType, amount, currencyCode = "USD" }) => {
      if (!allowWrites()) return ok({ error: readOnlyMessage("update_campaign_budget") });
      const field = budgetType === "daily" ? "dailyBudget" : "totalBudget";
      const res = await fetch(`${LINKEDIN_API}/v2/adCampaignsV2/${campaignId}`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${getToken()}`,
          "X-Restli-Protocol-Version": "2.0.0",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ patch: { $set: { [field]: { amount: String(amount), currencyCode } } } }),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Failed to update budget: ${res.status} — ${err.slice(0, 300)}`);
      }
      return ok({ success: true, campaignId, budgetType, amount, currencyCode });
    }
  );

  // Generic passthrough — full access to all 74+ edge function actions
  server.tool(
    "call_linkedin_action",
    `Call any LinkedIn Ads action directly. Use this for anything not covered by the other tools.

Available actions include: get_account_structure, get_objective_breakdowns, get_creative_report,
get_campaign_report, get_weekly_report, get_company_intelligence, get_company_demographic,
get_creative_company_breakdown, get_company_campaign_breakdown, get_creative_names_report,
get_campaign_performance_report, get_job_seniority_matrix, get_job_titles_index,
get_form_creative_analytics, update_campaign_targeting, exclude_companies_from_campaigns,
get_lead_gen_forms, get_ad_analytics, sync_ad_accounts, and more.`,
    {
      action: z.string().describe("Edge function action name (e.g. 'get_account_structure')"),
      params: z.record(z.unknown()).optional().describe("Parameters for the action (accountId, dateRange, etc.)"),
    },
    async ({ action, params }) => {
      // Legacy mode is unrestricted, exactly as before. The allowlist is a
      // multi-tenant concern: it exists because in a shared server one user
      // could otherwise reach service-role actions that clobber another's data.
      if (productMode) {
        if (PASSTHROUGH_WRITE.has(action) && !allowWrites()) {
          return ok({
            error: `'${action}' is a write action and this MCP key is read-only. ` +
              `Ask the workspace owner to enable writes at ${setupUrl}.`,
          });
        }
        if (!PASSTHROUGH_READ.has(action) && !PASSTHROUGH_WRITE.has(action)) {
          return ok({
            error: `Action '${action}' is not available through this tool.`,
            hint: "Use one of the dedicated tools, or an action from the list in this tool's description.",
          });
        }
      }
      return ok(await callEdge(action, (params as Record<string, unknown>) || {}));
    }
  );

  return server;
}
