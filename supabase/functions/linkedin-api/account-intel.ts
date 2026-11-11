// Company Intelligence API (/rest/accountIntelligence): which companies engaged
// with an ad account, paid and organic. Docs: learn.microsoft.com →
// linkedin/marketing/account-intel/account-intel-api (li-lms-2026-10).
// - Keyed on the ad account; every row is a target company, identified only by
//   companyPageUrl/companyWebsite (no company URN is returned).
// - Organic metrics are 0 whenever campaign, campaignGroup or objectiveType is set.
// - seniority/jobFunction: one value each, LAST_90_DAYS only, never with each
//   other or with campaign/campaignGroup/objectiveType; paidQualifiedLeads is
//   0 when either is set.
// - Values under an undisclosed privacy threshold come back as 0.
// - No published rate limit; count max 1000, docs recommend <= 500.

export const ACCOUNT_INTEL_VERSION = '202610';
const PAGE_SIZE = 500;
const MAX_PAGES = 20;

export const LOOKBACKS = ['LAST_7_DAYS', 'LAST_30_DAYS', 'LAST_60_DAYS', 'LAST_90_DAYS', 'LAST_180_DAYS', 'LAST_365_DAYS'] as const;
export const JOB_FUNCTIONS = ['INFORMATION_TECHNOLOGY', 'PRODUCT', 'SALES', 'MARKETING', 'OPERATIONS', 'FINANCE', 'HUMAN_RESOURCES', 'OTHER'] as const;
// Standardized seniority ids: 6 Director, 7 VP, 8 CXO, 9 Partner, 10 Owner.
export const DECISION_MAKER_SENIORITIES = ['6', '7', '8', '9', '10'];
const LEVELS = ['VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'];

export type AccountIntelQuery = {
  accountId: string;
  lookbackWindow?: string;
  campaignId?: string;
  campaignGroupId?: string;
  objectiveType?: string;
  seniority?: string;
  // Several seniorities = one request each, merged per company.
  seniorities?: string[];
  jobFunction?: string;
  adSegmentIds?: string[];
  // Connection check: one row, one page.
  check?: boolean;
};

export type AccountIntelCompany = {
  companyName: string;
  companyPageUrl: string;
  companyWebsite: string;
  engagementLevel: string;
  paidImpressions: number;
  paidClicks: number;
  paidEngagements: number;
  paidLeads: number;
  paidQualifiedLeads: number;
  conversions: number;
  paidVideoViews: number;
  organicImpressions: number;
  organicEngagements: number;
  companySize: string;
  industry: string;
  countryCode: string;
  costPerQualifiedLead: number | null;
  // Set only on merged multi-seniority runs.
  seniorities?: string[];
};

export class AccountIntelError extends Error {
  constructor(message: string, public status: number, public kind: string, public details = '') {
    super(message);
  }
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const urn = (type: string, id: string) => encodeURIComponent(`urn:li:${type}:${String(id).replace(/\D/g, '')}`);

export function buildFilterCriteria(q: AccountIntelQuery, seniority = q.seniority): string {
  const lookback = q.lookbackWindow || 'LAST_90_DAYS';
  if (!(LOOKBACKS as readonly string[]).includes(lookback)) throw new AccountIntelError(`Unsupported lookbackWindow ${lookback}`, 400, 'bad_request');
  const scopes = [q.campaignId, q.campaignGroupId, q.objectiveType].filter(Boolean);
  if (scopes.length > 1) throw new AccountIntelError('Use only one of campaign, campaign group or objective type.', 400, 'bad_request');
  if (seniority && q.jobFunction) throw new AccountIntelError('Seniority and job function cannot be combined.', 400, 'bad_request');
  if ((seniority || q.jobFunction) && (scopes.length || lookback !== 'LAST_90_DAYS')) {
    throw new AccountIntelError('Seniority and job function work only on the last 90 days, without a campaign, group or objective filter.', 400, 'bad_request');
  }
  if (q.jobFunction && !(JOB_FUNCTIONS as readonly string[]).includes(q.jobFunction)) throw new AccountIntelError(`Unsupported jobFunction ${q.jobFunction}`, 400, 'bad_request');

  const parts = [`lookbackWindow:${lookback}`];
  if (q.campaignId) parts.push(`campaign:${urn('sponsoredCampaign', q.campaignId)}`);
  if (q.campaignGroupId) parts.push(`campaignGroup:${urn('sponsoredCampaignGroup', q.campaignGroupId)}`);
  if (q.objectiveType) parts.push(`objectiveType:${q.objectiveType}`);
  if (seniority) parts.push(`seniority:${String(seniority).replace(/\D/g, '')}`);
  if (q.jobFunction) parts.push(`jobFunction:${q.jobFunction}`);
  if (q.adSegmentIds?.length) parts.push(`adSegments:List(${q.adSegmentIds.map((id) => urn('adSegment', id)).join(',')})`);
  return `(${parts.join(',')})`;
}

export function normalizeCompany(el: any): AccountIntelCompany {
  const cpql = el?.costInLocalCurrencyPerPaidQualifiedLead;
  return {
    companyName: str(el?.companyName) || 'Unknown company',
    companyPageUrl: str(el?.companyPageUrl),
    companyWebsite: str(el?.companyWebsite),
    engagementLevel: str(el?.engagementLevel) || 'UNKNOWN',
    paidImpressions: num(el?.paidImpressions),
    paidClicks: num(el?.paidClicks),
    paidEngagements: num(el?.paidEngagements),
    paidLeads: num(el?.paidLeads),
    paidQualifiedLeads: num(el?.paidQualifiedLeads),
    conversions: num(el?.conversions),
    paidVideoViews: num(el?.paidVideoViews),
    organicImpressions: num(el?.organicImpressions),
    organicEngagements: num(el?.organicEngagements),
    companySize: str(el?.companySize),
    industry: str(el?.industry),
    countryCode: str(el?.countryCode),
    costPerQualifiedLead: typeof cpql === 'number' && cpql > 0 ? cpql : null,
  };
}

const companyKey = (c: AccountIntelCompany) => c.companyPageUrl || c.companyWebsite || c.companyName;

// Per-seniority runs → one row per company: metrics summed, level = highest seen.
export function mergeBySeniority(runs: { seniority: string; companies: AccountIntelCompany[] }[]): AccountIntelCompany[] {
  const merged = new Map<string, AccountIntelCompany>();
  const sums: (keyof AccountIntelCompany)[] = ['paidImpressions', 'paidClicks', 'paidEngagements', 'paidLeads', 'paidQualifiedLeads', 'conversions', 'paidVideoViews', 'organicImpressions', 'organicEngagements'];
  for (const { seniority, companies } of runs) {
    for (const c of companies) {
      const key = companyKey(c);
      const prev = merged.get(key);
      if (!prev) {
        merged.set(key, { ...c, costPerQualifiedLead: null, seniorities: [seniority] });
        continue;
      }
      for (const k of sums) (prev as any)[k] += c[k] as number;
      if (LEVELS.indexOf(c.engagementLevel) > LEVELS.indexOf(prev.engagementLevel)) prev.engagementLevel = c.engagementLevel;
      prev.seniorities!.push(seniority);
    }
  }
  return [...merged.values()].sort((a, b) => b.paidImpressions - a.paidImpressions);
}

function classify403(text: string): AccountIntelError {
  if (/ACCESS_DENIED|accountIntelligence/i.test(text) && !/sponsored account/i.test(text)) {
    return new AccountIntelError('This LinkedIn app is not provisioned for the Company Intelligence API.', 403, 'not_provisioned', text);
  }
  if (/READ_SPONSORED_ACCOUNT|sponsored account/i.test(text)) {
    return new AccountIntelError('Your LinkedIn user has no role on this ad account.', 403, 'no_account_role', text);
  }
  if (/reporting permission/i.test(text)) {
    return new AccountIntelError('Reconnect LinkedIn and grant ads reporting (r_ads_reporting).', 403, 'no_reporting_scope', text);
  }
  return new AccountIntelError('LinkedIn refused the Company Intelligence request.', 403, 'forbidden', text);
}

async function fetchPages(accessToken: string, accountId: string, filterCriteria: string, check: boolean, fetchImpl: typeof fetch, maxPages = MAX_PAGES) {
  const companies: AccountIntelCompany[] = [];
  let total: number | null = null;
  let pages = 0;
  const count = check ? 1 : PAGE_SIZE;
  const account = urn('sponsoredAccount', accountId);
  for (let start = 0; pages < (check ? 1 : maxPages); start += count) {
    const url = `https://api.linkedin.com/rest/accountIntelligence?q=account&account=${account}&filterCriteria=${filterCriteria}&start=${start}&count=${count}`;
    const res = await fetchImpl(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'LinkedIn-Version': ACCOUNT_INTEL_VERSION,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    });
    pages++;
    if (!res.ok) {
      const text = await res.text();
      if (res.status === 403) throw classify403(text);
      if (res.status === 401) throw new AccountIntelError('LinkedIn token is invalid or expired — reconnect LinkedIn.', 401, 'token_invalid', text);
      throw new AccountIntelError(`Company Intelligence API error ${res.status}`, res.status, res.status === 429 ? 'rate_limited' : 'api_error', text);
    }
    const data = await res.json();
    const els: any[] = Array.isArray(data?.elements) ? data.elements : [];
    if (typeof data?.paging?.total === 'number') total = data.paging.total;
    companies.push(...els.map(normalizeCompany));
    const hasNext = Array.isArray(data?.paging?.links) && data.paging.links.some((l: any) => l?.rel === 'next');
    if (!els.length || els.length < count || (total !== null && companies.length >= total) || (!hasNext && total === null)) break;
  }
  return { companies, total, pages, truncated: total !== null && companies.length < total };
}

export async function fetchAccountIntel(accessToken: string, q: AccountIntelQuery, fetchImpl: typeof fetch = fetch) {
  const accountId = String(q.accountId || '').replace(/\D/g, '');
  if (!accountId) throw new AccountIntelError('accountId is required', 400, 'bad_request');
  const started = Date.now();
  const seniorities = (q.seniorities || []).filter(Boolean);

  if (seniorities.length > 1 && !q.check) {
    const runs = [];
    let pages = 0;
    let truncated = false;
    for (const s of seniorities) {
      const r = await fetchPages(accessToken, accountId, buildFilterCriteria(q, s), false, fetchImpl);
      runs.push({ seniority: s, companies: r.companies });
      pages += r.pages;
      truncated ||= r.truncated;
    }
    const companies = mergeBySeniority(runs);
    return {
      companies,
      meta: {
        version: ACCOUNT_INTEL_VERSION, accountId, lookbackWindow: 'LAST_90_DAYS',
        filterCriteria: seniorities.map((s) => buildFilterCriteria(q, s)),
        total: companies.length, fetched: companies.length, pages, truncated,
        bySeniority: Object.fromEntries(runs.map((r) => [r.seniority, r.companies.length])),
        durationMs: Date.now() - started,
      },
    };
  }

  const filterCriteria = buildFilterCriteria(q, seniorities[0] || q.seniority);
  const r = await fetchPages(accessToken, accountId, filterCriteria, q.check === true, fetchImpl);
  return {
    companies: r.companies,
    meta: {
      version: ACCOUNT_INTEL_VERSION, accountId, lookbackWindow: q.lookbackWindow || 'LAST_90_DAYS',
      filterCriteria: [filterCriteria],
      total: r.total, fetched: r.companies.length, pages: r.pages, truncated: r.truncated,
      durationMs: Date.now() - started,
    },
  };
}

// ── Per-company breakdowns ───────────────────────────────────────────────
// The API has no company × campaign pivot, but every campaign-filtered call
// returns all companies at once, so one call per campaign (or per seniority /
// job function) pivots into a breakdown for every company in a single batch.

const MAX_BREAKDOWN_CAMPAIGNS = 60;
const BREAKDOWN_PAGES = 4; // 2,000 companies per slice
const CONCURRENCY = 4;
const LOOKBACK_DAYS: Record<string, number> = {
  LAST_7_DAYS: 7, LAST_30_DAYS: 30, LAST_60_DAYS: 60, LAST_90_DAYS: 90, LAST_180_DAYS: 180, LAST_365_DAYS: 365,
};
export const BREAKDOWN_SENIORITIES = ['3', '4', '5', '6', '7', '8', '9', '10'];

export { companyKey };

export type BreakdownCampaign = { id: string; name: string; status: string; objectiveType: string };

export type BreakdownRow = {
  // campaign id, seniority id or job function
  slice: string;
  engagementLevel: string;
  paidImpressions: number;
  paidClicks: number;
  paidEngagements: number;
  paidLeads: number;
  paidQualifiedLeads: number;
  conversions: number;
  organicImpressions: number;
  organicEngagements: number;
};

const toRow = (slice: string, c: AccountIntelCompany): BreakdownRow => ({
  slice,
  engagementLevel: c.engagementLevel,
  paidImpressions: c.paidImpressions,
  paidClicks: c.paidClicks,
  paidEngagements: c.paidEngagements,
  paidLeads: c.paidLeads,
  paidQualifiedLeads: c.paidQualifiedLeads,
  conversions: c.conversions,
  organicImpressions: c.organicImpressions,
  organicEngagements: c.organicEngagements,
});

async function pool<T, R>(items: T[], n: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }));
  return out;
}

// Runs one Account Intel query per slice and pivots to company → rows.
// A provisioning/role/scope 403 aborts (every slice would fail the same way);
// other per-slice failures are counted and the rest still returns.
async function pivotSlices(
  accessToken: string, accountId: string,
  slices: { slice: string; filterCriteria: string }[],
  fetchImpl: typeof fetch,
) {
  const byCompany: Record<string, BreakdownRow[]> = {};
  const sliceCompanies: Record<string, number> = {};
  const failed: { slice: string; error: string }[] = [];
  let truncated = false;
  await pool(slices, CONCURRENCY, async ({ slice, filterCriteria }) => {
    try {
      const r = await fetchPages(accessToken, accountId, filterCriteria, false, fetchImpl, BREAKDOWN_PAGES);
      truncated ||= r.truncated;
      sliceCompanies[slice] = r.companies.length;
      for (const c of r.companies) (byCompany[companyKey(c)] ||= []).push(toRow(slice, c));
    } catch (e) {
      const err = e as AccountIntelError;
      if (['not_provisioned', 'no_account_role', 'no_reporting_scope', 'token_invalid'].includes(err?.kind)) throw e;
      failed.push({ slice, error: String(err?.message || e) });
    }
  });
  return { byCompany, sliceCompanies, failed, truncated };
}

export function selectBreakdownCampaigns(elements: any[], lookbackWindow: string, now = Date.now()): { campaigns: BreakdownCampaign[]; skipped: number } {
  const windowStart = now - (LOOKBACK_DAYS[lookbackWindow] ?? 90) * 24 * 60 * 60 * 1000;
  const eligible = elements.filter((c) => {
    const status = String(c?.status || '').toUpperCase();
    if (status === 'DRAFT' || status === 'PENDING_DELETION' || status === 'REMOVED') return false;
    const start = c?.runSchedule?.start;
    const end = c?.runSchedule?.end;
    if (typeof start === 'number' && start > now) return false;
    if (typeof end === 'number' && end < windowStart) return false;
    return true;
  });
  // Active first, then the most recently started.
  const rank = (s: string) => (s === 'ACTIVE' ? 0 : s === 'PAUSED' ? 1 : 2);
  eligible.sort((a, b) => rank(String(a.status).toUpperCase()) - rank(String(b.status).toUpperCase())
    || (b?.runSchedule?.start || 0) - (a?.runSchedule?.start || 0));
  const campaigns = eligible.slice(0, MAX_BREAKDOWN_CAMPAIGNS).map((c) => ({
    id: String(c.id ?? String(c.$URN || '').split(':').pop()),
    name: String(c.name || `Campaign ${c.id}`),
    status: String(c.status || 'UNKNOWN').toUpperCase(),
    objectiveType: String(c.objectiveType || 'UNCLASSIFIED').toUpperCase(),
  }));
  return { campaigns, skipped: elements.length - campaigns.length };
}

async function listCampaigns(accessToken: string, accountId: string, fetchImpl: typeof fetch) {
  const all: any[] = [];
  for (let start = 0, i = 0; i < 20; i++) {
    const res = await fetchImpl(`https://api.linkedin.com/rest/adAccounts/${accountId}/adCampaigns?q=search&sortOrder=DESCENDING&count=100&start=${start}`, {
      headers: { 'Authorization': `Bearer ${accessToken}`, 'LinkedIn-Version': ACCOUNT_INTEL_VERSION, 'X-Restli-Protocol-Version': '2.0.0' },
    });
    if (!res.ok) throw new AccountIntelError(`Could not list campaigns (${res.status})`, res.status, 'api_error', await res.text());
    const data = await res.json();
    const els: any[] = Array.isArray(data?.elements) ? data.elements : [];
    all.push(...els);
    if (els.length < 100) break;
    start += els.length;
  }
  return all;
}

export async function fetchCampaignBreakdown(accessToken: string, q: { accountId: string; lookbackWindow?: string }, fetchImpl: typeof fetch = fetch) {
  const accountId = String(q.accountId || '').replace(/\D/g, '');
  if (!accountId) throw new AccountIntelError('accountId is required', 400, 'bad_request');
  const lookbackWindow = q.lookbackWindow || 'LAST_90_DAYS';
  const started = Date.now();
  const { campaigns, skipped } = selectBreakdownCampaigns(await listCampaigns(accessToken, accountId, fetchImpl), lookbackWindow);
  const slices = campaigns.map((c) => ({ slice: c.id, filterCriteria: buildFilterCriteria({ accountId, lookbackWindow, campaignId: c.id }) }));
  const r = await pivotSlices(accessToken, accountId, slices, fetchImpl);
  return {
    byCompany: r.byCompany,
    campaigns: campaigns.map((c) => ({ ...c, companies: r.sliceCompanies[c.id] ?? 0 })),
    meta: {
      version: ACCOUNT_INTEL_VERSION, accountId, lookbackWindow,
      campaignsQueried: campaigns.length, campaignsSkipped: skipped,
      failed: r.failed, truncated: r.truncated, durationMs: Date.now() - started,
    },
  };
}

export async function fetchAudienceBreakdown(accessToken: string, q: { accountId: string }, fetchImpl: typeof fetch = fetch) {
  const accountId = String(q.accountId || '').replace(/\D/g, '');
  if (!accountId) throw new AccountIntelError('accountId is required', 400, 'bad_request');
  const started = Date.now();
  const slices = [
    ...BREAKDOWN_SENIORITIES.map((s) => ({ slice: `sen:${s}`, filterCriteria: buildFilterCriteria({ accountId, seniority: s }) })),
    ...JOB_FUNCTIONS.map((f) => ({ slice: `fn:${f}`, filterCriteria: buildFilterCriteria({ accountId, jobFunction: f }) })),
  ];
  const r = await pivotSlices(accessToken, accountId, slices, fetchImpl);
  return {
    byCompany: r.byCompany,
    meta: {
      version: ACCOUNT_INTEL_VERSION, accountId, lookbackWindow: 'LAST_90_DAYS',
      slices: slices.length, sliceCompanies: r.sliceCompanies,
      failed: r.failed, truncated: r.truncated, durationMs: Date.now() - started,
    },
  };
}

// ---- Creative drill-down (Ad Analytics, not Account Intel) -------------------
// Account Intel has no creative filter, so the campaign → creative level comes
// from adAnalyticsV2: a CREATIVE pivot finds the campaign's creatives that served
// in the window, then one MEMBER_COMPANY query per creative. Companies come back
// as organization URNs, resolved to vanity name / website / name so the client
// can match them to Account Intel rows (which carry no URN).

const MAX_BREAKDOWN_CREATIVES = 25;
const ANALYTICS_PAGE = 10000;

export type CreativeMetrics = {
  creativeId: string;
  impressions: number;
  clicks: number;
  engagements: number;
  leads: number;
  conversions: number;
  spend: number;
};

export type CreativeCompany = { orgUrn: string; name: string; vanityName: string; website: string; creatives: CreativeMetrics[] };

const ymd = (d: Date) => ({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() });

function analyticsUrl(dateRange: { start: ReturnType<typeof ymd>; end: ReturnType<typeof ymd> }, pivot: string, filter: string, fields: string, start = 0) {
  const qp = new URLSearchParams({
    q: 'analytics', timeGranularity: 'ALL', pivot,
    'dateRange.start.day': String(dateRange.start.day), 'dateRange.start.month': String(dateRange.start.month), 'dateRange.start.year': String(dateRange.start.year),
    'dateRange.end.day': String(dateRange.end.day), 'dateRange.end.month': String(dateRange.end.month), 'dateRange.end.year': String(dateRange.end.year),
    fields, count: String(ANALYTICS_PAGE), start: String(start),
  });
  return `https://api.linkedin.com/v2/adAnalyticsV2?${qp.toString()}&${filter}`;
}

// Continues only on a completely full page — paging.total lies for pivots (CLAUDE.md).
async function analyticsRows(accessToken: string, url: (start: number) => string, fetchImpl: typeof fetch) {
  const rows: any[] = [];
  for (let start = 0, i = 0; i < 5; i++) {
    const res = await fetchImpl(url(start), { headers: { 'Authorization': `Bearer ${accessToken}` } });
    if (res.status === 401) throw new AccountIntelError('LinkedIn token is invalid or expired — reconnect LinkedIn.', 401, 'token_invalid');
    if (!res.ok) throw new AccountIntelError(`Ad Analytics request failed (${res.status})`, res.status, res.status === 429 ? 'rate_limited' : 'api_error', await res.text());
    const els: any[] = (await res.json())?.elements || [];
    rows.push(...els);
    if (els.length < ANALYTICS_PAGE) break;
    start += els.length;
  }
  return rows;
}

async function creativeNames(accessToken: string, accountId: string, campaignId: string, fetchImpl: typeof fetch) {
  const names: Record<string, { name: string; status: string }> = {};
  try {
    const campaigns = `List(${encodeURIComponent(`urn:li:sponsoredCampaign:${campaignId}`)})`;
    const res = await fetchImpl(`https://api.linkedin.com/rest/adAccounts/${accountId}/creatives?q=criteria&campaigns=${campaigns}&count=100`, {
      headers: { 'Authorization': `Bearer ${accessToken}`, 'LinkedIn-Version': ACCOUNT_INTEL_VERSION, 'X-Restli-Protocol-Version': '2.0.0' },
    });
    if (!res.ok) return names;
    for (const el of (await res.json())?.elements || []) {
      const id = String(el?.id || '').split(':').pop();
      if (id) names[id] = { name: String(el?.name || ''), status: String(el?.intendedStatus || '').toUpperCase() };
    }
  } catch {
    // Names are cosmetic; rows fall back to "Creative <id>".
  }
  return names;
}

async function resolveOrgs(accessToken: string, orgIds: string[], fetchImpl: typeof fetch) {
  const out: Record<string, { name: string; vanityName: string; website: string }> = {};
  for (let i = 0; i < orgIds.length; i += 50) {
    const ids = orgIds.slice(i, i + 50).map((id, n) => `ids[${n}]=${id}`).join('&');
    try {
      const res = await fetchImpl(`https://api.linkedin.com/v2/organizationsLookup?${ids}&projection=(results*(id,localizedName,localizedWebsite,vanityName))`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (!res.ok) continue;
      for (const [id, org] of Object.entries<any>((await res.json())?.results || {})) {
        out[id] = { name: String(org?.localizedName || ''), vanityName: String(org?.vanityName || ''), website: String(org?.localizedWebsite || '') };
      }
    } catch {
      // Unresolved orgs simply can't be matched.
    }
  }
  return out;
}

export async function fetchCreativeBreakdown(
  accessToken: string, q: { accountId: string; campaignId: string; lookbackWindow?: string },
  fetchImpl: typeof fetch = fetch, now = Date.now(),
) {
  const accountId = String(q.accountId || '').replace(/\D/g, '');
  const campaignId = String(q.campaignId || '').replace(/\D/g, '');
  if (!accountId || !campaignId) throw new AccountIntelError('accountId and campaignId are required', 400, 'bad_request');
  const lookbackWindow = q.lookbackWindow || 'LAST_90_DAYS';
  const started = Date.now();
  const dateRange = { start: ymd(new Date(now - (LOOKBACK_DAYS[lookbackWindow] ?? 90) * 86400000)), end: ymd(new Date(now)) };

  const [served, names] = await Promise.all([
    analyticsRows(accessToken, (s) => analyticsUrl(dateRange, 'CREATIVE', `campaigns[0]=urn:li:sponsoredCampaign:${campaignId}`, 'pivotValue,impressions', s), fetchImpl),
    creativeNames(accessToken, accountId, campaignId, fetchImpl),
  ]);
  const ranked = served
    .map((r) => ({ id: String(r?.pivotValue || '').split(':').pop() || '', impressions: Number(r?.impressions) || 0 }))
    .filter((r) => r.id && r.impressions > 0)
    .sort((a, b) => b.impressions - a.impressions);
  const queried = ranked.slice(0, MAX_BREAKDOWN_CREATIVES);

  const byOrg: Record<string, CreativeMetrics[]> = {};
  const failed: { slice: string; error: string }[] = [];
  await pool(queried, CONCURRENCY, async ({ id }) => {
    try {
      const rows = await analyticsRows(accessToken, (s) => analyticsUrl(dateRange, 'MEMBER_COMPANY', `creatives[0]=urn:li:sponsoredCreative:${id}`,
        'pivotValue,impressions,clicks,totalEngagements,oneClickLeads,externalWebsiteConversions,costInLocalCurrency', s), fetchImpl);
      for (const r of rows) {
        const org = String(r?.pivotValue || '');
        if (!org.startsWith('urn:li:organization:')) continue;
        const m: CreativeMetrics = {
          creativeId: id,
          impressions: Number(r.impressions) || 0, clicks: Number(r.clicks) || 0, engagements: Number(r.totalEngagements) || 0,
          leads: Number(r.oneClickLeads) || 0, conversions: Number(r.externalWebsiteConversions) || 0,
          spend: Math.round((parseFloat(r.costInLocalCurrency) || 0) * 100) / 100,
        };
        if (m.impressions || m.clicks || m.leads || m.conversions) (byOrg[org] ||= []).push(m);
      }
    } catch (e) {
      const err = e as AccountIntelError;
      if (err?.kind === 'token_invalid') throw e;
      failed.push({ slice: id, error: String(err?.message || e) });
    }
  });

  const orgs = await resolveOrgs(accessToken, Object.keys(byOrg).map((u) => u.split(':').pop()!), fetchImpl);
  const companies: CreativeCompany[] = Object.entries(byOrg).map(([orgUrn, creatives]) => {
    const o = orgs[orgUrn.split(':').pop()!] ?? { name: '', vanityName: '', website: '' };
    return { orgUrn, ...o, creatives };
  });

  return {
    companies,
    creatives: queried.map((c) => ({
      id: c.id, impressions: c.impressions,
      name: names[c.id]?.name || `Creative ${c.id}`, status: names[c.id]?.status || '',
    })),
    meta: {
      accountId, campaignId, lookbackWindow, source: 'adAnalytics',
      creativesQueried: queried.length, creativesSkipped: ranked.length - queried.length,
      failed, durationMs: Date.now() - started,
    },
  };
}
