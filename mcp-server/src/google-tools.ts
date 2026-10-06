/**
 * Google Ads tools for the MCP surface.
 *
 * Registered by createLinkedInAdsServer() only when `enableGoogleAds` is set
 * (see ServerOptions in tools.ts). Off by default, so a server that does not
 * opt in advertises exactly the tool list it always has.
 *
 * These are thin wrappers over read actions on the `linkedin-api` edge
 * function, which reaches Google through the Lovable connector gateway. There
 * is no second credential path and no per-user Google connection here — and
 * that is precisely why these must stay off in `mode: "product"`: the gateway
 * connection is account-wide, so in a multi-tenant server every tenant would be
 * reading one shared Google account.
 *
 * Read-only throughout, so none of this touches the allow_writes gate.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export type GoogleAdsDeps = {
  /** tools.ts's edge caller — reused so there is one transport path, not two. */
  callEdge: (action: string, params?: Record<string, unknown>) => Promise<unknown>;
};

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function dates(startDate?: string, endDate?: string) {
  const end = endDate || new Date().toISOString().split("T")[0];
  const start = startDate || new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  return { start, end };
}

const CUSTOMER_ID = z
  .string()
  .describe("Google Ads customer ID (10 digits, dashes optional — e.g. '123-456-7890')");

const LOGIN_CUSTOMER_ID = z
  .string()
  .optional()
  .describe(
    "Manager (MCC) customer ID that mediates access, if the account sits under one. " +
    "list_google_ad_accounts returns it per account as loginCustomerId."
  );

export function registerGoogleAdsTools(server: McpServer, deps: GoogleAdsDeps): void {
  const { callEdge } = deps;

  server.tool(
    "list_google_ad_accounts",
    "List the Google Ads accounts reachable from the connected Google account, including every client under any manager account it manages. Returns customer ID, name, currency and the loginCustomerId to pass back. Call this first — every other Google Ads tool needs a customerId.",
    {},
    async () => ok(await callEdge("list_google_ads_accounts"))
  );

  server.tool(
    "get_google_campaigns",
    "List Google Ads campaigns with status, channel type, bidding strategy, dates and daily budget. Settings only — use get_google_campaign_report for performance.",
    {
      customerId: CUSTOMER_ID,
      loginCustomerId: LOGIN_CUSTOMER_ID,
      status: z.string().optional().describe("Filter by status: ENABLED, PAUSED, REMOVED"),
    },
    async ({ customerId, loginCustomerId, status }) =>
      ok(await callEdge("get_google_campaigns", { customerId, loginCustomerId, status }))
  );

  server.tool(
    "get_google_campaign_report",
    "Get per-campaign Google Ads performance: impressions, clicks, spend, conversions, conversion value, CTR, CPC, CPM and cost per conversion. Sorted by spend.",
    {
      customerId: CUSTOMER_ID,
      loginCustomerId: LOGIN_CUSTOMER_ID,
      startDate: z.string().optional().describe("Start date YYYY-MM-DD (default: 30 days ago)"),
      endDate: z.string().optional().describe("End date YYYY-MM-DD (default: today)"),
    },
    async ({ customerId, loginCustomerId, startDate, endDate }) =>
      ok(await callEdge("get_google_campaign_report", {
        customerId, loginCustomerId, dateRange: dates(startDate, endDate),
      }))
  );

  server.tool(
    "get_google_ad_group_report",
    "Get per-ad-group Google Ads performance metrics, optionally limited to specific campaigns.",
    {
      customerId: CUSTOMER_ID,
      loginCustomerId: LOGIN_CUSTOMER_ID,
      campaignIds: z.array(z.string()).optional().describe("Only these campaigns (numeric IDs)"),
      startDate: z.string().optional().describe("Start date YYYY-MM-DD (default: 30 days ago)"),
      endDate: z.string().optional().describe("End date YYYY-MM-DD (default: today)"),
    },
    async ({ customerId, loginCustomerId, campaignIds, startDate, endDate }) =>
      ok(await callEdge("get_google_ad_group_report", {
        customerId, loginCustomerId, campaignIds, dateRange: dates(startDate, endDate),
      }))
  );

  server.tool(
    "get_google_ad_report",
    "Get per-ad Google Ads performance metrics with ad group and campaign context. For the ad's text, use get_google_ad_copy.",
    {
      customerId: CUSTOMER_ID,
      loginCustomerId: LOGIN_CUSTOMER_ID,
      startDate: z.string().optional().describe("Start date YYYY-MM-DD (default: 30 days ago)"),
      endDate: z.string().optional().describe("End date YYYY-MM-DD (default: today)"),
    },
    async ({ customerId, loginCustomerId, startDate, endDate }) =>
      ok(await callEdge("get_google_ad_report", {
        customerId, loginCustomerId, dateRange: dates(startDate, endDate),
      }))
  );

  server.tool(
    "get_google_ad_copy",
    "Get the actual ad text for Google Ads: every headline and description asset, long headline, display-URL paths, final URLs and ad strength. Use this to read, review or rewrite ad copy. Returns copy only — pair with get_google_ad_report for performance.",
    {
      customerId: CUSTOMER_ID,
      loginCustomerId: LOGIN_CUSTOMER_ID,
      status: z.string().optional().describe("Only ads with this status: ENABLED, PAUSED"),
      campaignIds: z.array(z.string()).optional().describe("Only ads in these campaigns (numeric IDs)"),
      adGroupIds: z.array(z.string()).optional().describe("Only ads in these ad groups (numeric IDs)"),
      limit: z.number().optional().describe("Max ads to return, 1-2000 (default 200)"),
    },
    async ({ customerId, loginCustomerId, status, campaignIds, adGroupIds, limit }) =>
      ok(await callEdge("get_google_ad_copy", {
        customerId, loginCustomerId, status, campaignIds, adGroupIds, limit,
      }))
  );

  server.tool(
    "get_google_keywords",
    "Get Google Ads keyword performance: keyword text, match type, status, spend, clicks, conversions and search impression share.",
    {
      customerId: CUSTOMER_ID,
      loginCustomerId: LOGIN_CUSTOMER_ID,
      startDate: z.string().optional().describe("Start date YYYY-MM-DD (default: 30 days ago)"),
      endDate: z.string().optional().describe("End date YYYY-MM-DD (default: today)"),
    },
    async ({ customerId, loginCustomerId, startDate, endDate }) =>
      ok(await callEdge("get_google_keywords", {
        customerId, loginCustomerId, dateRange: dates(startDate, endDate),
      }))
  );

  server.tool(
    "get_google_search_terms",
    "Get the actual search queries that triggered Google Ads, with spend and conversions per term. Use this to find negative keyword candidates and wasted spend.",
    {
      customerId: CUSTOMER_ID,
      loginCustomerId: LOGIN_CUSTOMER_ID,
      startDate: z.string().optional().describe("Start date YYYY-MM-DD (default: 30 days ago)"),
      endDate: z.string().optional().describe("End date YYYY-MM-DD (default: today)"),
      limit: z.number().optional().describe("Max terms to return, 1-5000 (default 500)"),
    },
    async ({ customerId, loginCustomerId, startDate, endDate, limit }) =>
      ok(await callEdge("get_google_search_terms", {
        customerId, loginCustomerId, dateRange: dates(startDate, endDate), limit,
      }))
  );

  server.tool(
    "google_ads_query",
    `Run a raw GAQL (Google Ads Query Language) SELECT query. Use this for anything the named tools do not cover — any resource, any field, any segment.

SELECT only; anything else is rejected before it leaves the server. Example:
  SELECT campaign.name, segments.device, metrics.cost_micros
  FROM campaign
  WHERE segments.date DURING LAST_30_DAYS

Rows come back as Google returns them: camelCase fields, int64 as strings, money in micros (divide by 1,000,000). The named tools normalize all of that; this one does not.`,
    {
      customerId: CUSTOMER_ID,
      loginCustomerId: LOGIN_CUSTOMER_ID,
      query: z.string().describe("A GAQL SELECT query"),
      limit: z.number().optional().describe("Max rows to return (default 2000, max 10000)"),
    },
    async ({ customerId, loginCustomerId, query, limit }) =>
      ok(await callEdge("google_ads_search", { customerId, loginCustomerId, query, limit }))
  );
}
