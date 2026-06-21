import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const SUPABASE_URL = "https://bxoxefmenvlxiubynuay.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4b3hlZm1lbnZseGl1YnludWF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0NTUzMzQsImV4cCI6MjA4MTAzMTMzNH0.ox7oP80ZqfgC5wuEJbtiMTiB-XxmCzrN2ZlZ9tpo8QI";
const LINKEDIN_API = "https://api.linkedin.com";

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function dates(startDate?: string, endDate?: string) {
  const end = endDate || new Date().toISOString().split("T")[0];
  const start = startDate || new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  return { start, end };
}

export function createLinkedInAdsServer(getToken: () => string): McpServer {
  const server = new McpServer({ name: "linkedin-ads", version: "2.0.0" });

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
    async ({ campaignId, status }) => ok(await callEdge("update_campaign_status", { campaignId, status }))
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

  return server;
}
