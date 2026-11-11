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

async function fetchPages(accessToken: string, accountId: string, filterCriteria: string, check: boolean, fetchImpl: typeof fetch) {
  const companies: AccountIntelCompany[] = [];
  let total: number | null = null;
  let pages = 0;
  const count = check ? 1 : PAGE_SIZE;
  const account = urn('sponsoredAccount', accountId);
  for (let start = 0; pages < (check ? 1 : MAX_PAGES); start += count) {
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
