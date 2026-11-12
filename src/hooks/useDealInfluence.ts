import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CompanyIntelligence, DECISION_MAKER_SENIORITIES, IntelError } from '@/hooks/useCompanyIntelligence';
import { MatchedCompany } from '@/hooks/useCompanyInfluenceMatcher';

/** One org × day (× campaign when the split is available) from Ad Analytics. */
export interface TouchRow {
  orgId: string;
  date: string;
  campaignId: string | null;
  impressions: number;
  clicks: number;
  engagements: number;
  leads: number;
  spend: number;
}

export interface CompanyTouches {
  rows: TouchRow[];
  campaigns: Record<string, { name: string; objectiveType: string; status: string }>;
  meta: { from: string; to: string; clampedFrom: boolean; orgsRequested: number; orgsTouched: number; campaignSplit: boolean; calls: number; truncated: boolean; failedRanges?: { from: string; to: string; error: string }[]; durationMs: number };
}

/** Account Intel context — not aligned to deal dates (windows end today). */
interface IntelContext {
  organic365: CompanyIntelligence[] | null;
  dm90: CompanyIntelligence[] | null;
}

export type DealVerdict = 'influenced' | 'post_only' | 'not_reached' | 'out_of_range' | 'no_date';

export interface DealCompany {
  key: string;
  name: string;
  website: string;
  dealDate: string | null;
  verdict: DealVerdict;
  /** Days before the deal (positive). */
  firstTouch: number | null;
  lastTouch: number | null;
  pre: { impressions: number; clicks: number; engagements: number; leads: number; spend: number; activeWeeks: number };
  postImpressions: number;
  /** Week bucket (-26…3, see `bucketOf`) → paid totals. */
  weeks: Record<number, { impressions: number; engagements: number }>;
  preCampaigns: { id: string; name: string; impressions: number; engagements: number }[];
  /** null = Account Intel not loaded / not matched. */
  decisionMakers: boolean | null;
  organicEngagements: number | null;
  engagementLevel: string | null;
  score: number;
  /** The deal's window starts before the oldest day LinkedIn returned. */
  partial: boolean;
}

export const WEEKS_BEFORE = 26;
export const WEEKS_AFTER = 4;
export const BUCKETS = Array.from({ length: WEEKS_BEFORE + WEEKS_AFTER }, (_, i) => i - WEEKS_BEFORE);
const DAY = 86400000;

/**
 * Days relative to the deal → week bucket. -1 is the 7 days ending on the deal
 * date (touches on the deal day count as before), 0 is the 7 days after it.
 */
export const bucketOf = (r: number) => (r <= 0 ? -Math.floor(-r / 7) - 1 : Math.floor((r - 1) / 7));
export const bucketLabel = (b: number) => (b < 0 ? `${b}w` : `+${b + 1}w`);

const iso = (y: number, m: number, d: number) => {
  const t = Date.UTC(y, m - 1, d);
  const dt = new Date(t);
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? dt.toISOString().slice(0, 10) : null;
};

/** CRM dates: ISO, M/D/Y (D/M/Y when the first part is over 12), or whatever Date.parse accepts. */
export function parseDealDate(s: string): string | null {
  const v = (s || '').trim();
  if (!v) return null;
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    const [a, b, y] = [+m[1], +m[2], +m[3] < 100 ? 2000 + +m[3] : +m[3]];
    return a > 12 ? iso(y, b, a) : iso(y, a, b);
  }
  const t = Date.parse(v);
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  return iso(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/** Earliest parseable date among the company's CSV rows. */
export const dealDateOf = (m: MatchedCompany) =>
  m.uploadedEntries.map((e) => parseDealDate(e.date)).filter((d): d is string => !!d).sort()[0] || null;

export const orgIdOf = (m: MatchedCompany) => (m.linkedin.entityUrn.match(/(\d+)$/)?.[1]) || '';

const days = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);
const host = (url: string) => url.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0];
const normName = (n: string) => n.toLowerCase().replace(/[^a-z0-9]/g, '');
const slugOf = (url: string) => url.match(/\/company\/([^/?#]+)/)?.[1]?.toLowerCase() || '';

/** Account Intel rows carry no URN — match by LinkedIn slug, website host, then name. */
function intelIndex(list: CompanyIntelligence[] | null) {
  if (!list) return null;
  const bySlug = new Map<string, CompanyIntelligence>();
  const byHost = new Map<string, CompanyIntelligence>();
  const byName = new Map<string, CompanyIntelligence>();
  for (const c of list) {
    const s = slugOf(c.companyPageUrl);
    if (s && !bySlug.has(s)) bySlug.set(s, c);
    const h = c.companyWebsite && host(c.companyWebsite);
    if (h && !byHost.has(h)) byHost.set(h, c);
    const n = normName(c.companyName);
    if (n && !byName.has(n)) byName.set(n, c);
  }
  return (m: MatchedCompany) => {
    const s = slugOf(m.linkedin.linkedInUrl || '');
    const h = m.linkedin.website ? host(m.linkedin.website) : '';
    return (s && bySlug.get(s)) || (h && byHost.get(h)) || byName.get(normName(m.linkedin.entityName)) || null;
  };
}

/**
 * Influence score, 0–100, only for companies touched before the deal:
 * reach 25 + engagement 25 + recency 15 + persistence 10 + decision makers 15 + organic 10.
 */
function scoreOf(c: Omit<DealCompany, 'score'>) {
  if (c.verdict !== 'influenced') return 0;
  const log = (v: number, cap: number) => Math.min(1, Math.log10(1 + v) / Math.log10(1 + cap));
  const recency = c.lastTouch === null ? 0 : c.lastTouch <= 30 ? 15 : c.lastTouch <= 90 ? 8 : 3;
  return Math.round(
    25 * log(c.pre.impressions, 5000)
    + 25 * log(c.pre.engagements + c.pre.clicks, 50)
    + recency
    + Math.min(10, c.pre.activeWeeks * 2.5)
    + (c.decisionMakers ? 15 : 0)
    + ((c.organicEngagements || 0) > 0 ? 10 : 0),
  );
}

export function analyzeDeals(matched: MatchedCompany[], touches: CompanyTouches, intel: IntelContext): DealCompany[] {
  const byOrg = new Map<string, TouchRow[]>();
  for (const r of touches.rows) {
    const list = byOrg.get(r.orgId);
    if (list) list.push(r); else byOrg.set(r.orgId, [r]);
  }
  const organicOf = intelIndex(intel.organic365);
  const dmOf = intelIndex(intel.dm90);

  return matched.map((m) => {
    const dealDate = dealDateOf(m);
    const o = organicOf?.(m) ?? null;
    const base = {
      key: m.linkedin.entityUrn,
      name: m.linkedin.entityName || m.uploaded.name,
      website: m.linkedin.website || m.uploaded.url || '',
      dealDate,
      firstTouch: null as number | null,
      lastTouch: null as number | null,
      pre: { impressions: 0, clicks: 0, engagements: 0, leads: 0, spend: 0, activeWeeks: 0 },
      postImpressions: 0,
      weeks: {} as DealCompany['weeks'],
      preCampaigns: [] as DealCompany['preCampaigns'],
      decisionMakers: dmOf ? !!dmOf(m) : null,
      organicEngagements: organicOf ? (o?.organicEngagements ?? 0) : null,
      engagementLevel: o?.engagementLevel || null,
      partial: false,
    };
    let verdict: DealVerdict = 'not_reached';
    if (!dealDate) verdict = 'no_date';
    else if (dealDate < touches.meta.from) verdict = 'out_of_range';
    else {
      base.partial = days(touches.meta.from, dealDate) < WEEKS_BEFORE * 7 - 1;
      const camps = new Map<string, { impressions: number; engagements: number }>();
      const activeWeeks = new Set<number>();
      for (const r of byOrg.get(orgIdOf(m)) || []) {
        const rel = days(dealDate, r.date);
        const b = bucketOf(rel);
        if (b < -WEEKS_BEFORE || b >= WEEKS_AFTER || r.impressions <= 0) continue;
        const w = (base.weeks[b] ||= { impressions: 0, engagements: 0 });
        w.impressions += r.impressions;
        w.engagements += r.engagements;
        if (rel > 0) { base.postImpressions += r.impressions; continue; }
        const before = -rel;
        base.firstTouch = Math.max(base.firstTouch ?? 0, before);
        base.lastTouch = Math.min(base.lastTouch ?? Infinity, before);
        activeWeeks.add(b);
        base.pre.impressions += r.impressions;
        base.pre.clicks += r.clicks;
        base.pre.engagements += r.engagements;
        base.pre.leads += r.leads;
        base.pre.spend += r.spend;
        if (r.campaignId) {
          const c = camps.get(r.campaignId) || { impressions: 0, engagements: 0 };
          c.impressions += r.impressions;
          c.engagements += r.engagements;
          camps.set(r.campaignId, c);
        }
      }
      base.pre.activeWeeks = activeWeeks.size;
      base.preCampaigns = [...camps.entries()]
        .map(([id, c]) => ({ id, name: touches.campaigns[id]?.name || `Campaign ${id}`, ...c }))
        .sort((a, b) => b.impressions - a.impressions);
      verdict = base.pre.impressions > 0 ? 'influenced' : base.postImpressions > 0 ? 'post_only' : 'not_reached';
    }
    const c = { ...base, verdict };
    return { ...c, score: scoreOf(c) };
  }).sort((a, b) => b.score - a.score || b.pre.impressions - a.pre.impressions || b.postImpressions - a.postImpressions);
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
};

export function summarizeDeals(deals: DealCompany[], meta: CompanyTouches['meta']) {
  const count = (v: DealVerdict) => deals.filter((d) => d.verdict === v).length;
  const influenced = deals.filter((d) => d.verdict === 'influenced');
  const dated = deals.filter((d) => d.verdict !== 'no_date' && d.verdict !== 'out_of_range');
  const share = (xs: DealCompany[], f: (d: DealCompany) => boolean | null) => {
    const known = xs.filter((d) => f(d) !== null);
    return known.length ? Math.round((known.filter((d) => f(d)).length / known.length) * 100) : null;
  };
  // Per bucket: companies whose deal-relative week falls inside the data range are eligible.
  const curve = BUCKETS.map((b) => {
    let eligible = 0, touched = 0, impressions = 0, engagements = 0;
    for (const d of dated) {
      const start = new Date(Date.parse(`${d.dealDate}T00:00:00Z`) + (b * 7 + 1) * DAY).toISOString().slice(0, 10);
      if (start < meta.from || start > meta.to) continue;
      eligible++;
      const w = d.weeks[b];
      if (w) { touched++; impressions += w.impressions; engagements += w.engagements; }
    }
    return { bucket: b, label: bucketLabel(b), eligible, touched, impressions, engagements, pct: eligible ? Math.round((touched / eligible) * 100) : null };
  });
  return {
    total: deals.length,
    dated: dated.length,
    influenced: influenced.length,
    postOnly: count('post_only'),
    notReached: count('not_reached'),
    outOfRange: count('out_of_range'),
    noDate: count('no_date'),
    medianFirstTouch: median(influenced.map((d) => d.firstTouch!).filter((v) => v !== null)),
    medianLastTouch: median(influenced.map((d) => d.lastTouch!).filter((v) => v !== null)),
    dmShare: share(influenced, (d) => d.decisionMakers),
    organicShare: share(influenced, (d) => (d.organicEngagements === null ? null : d.organicEngagements > 0)),
    curve,
  };
}

async function invoke<T>(accessToken: string, params: Record<string, unknown>, isValid: (d: any) => boolean, stale: string): Promise<T> {
  const { data, error } = await supabase.functions.invoke('linkedin-api', {
    body: { action: 'get_company_intelligence', accessToken, params },
  });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const body = ctx && typeof ctx.json === 'function' ? await ctx.clone().json().catch(() => null) : null;
    throw Object.assign(new Error(body?.error || error.message), { kind: body?.kind || 'error' });
  }
  if (data?.error) throw Object.assign(new Error(data.error), { kind: data.kind });
  if (!isValid(data)) throw Object.assign(new Error(stale), { kind: 'stale_deploy' });
  return data as T;
}

const toIntelError = (e: unknown): IntelError => ({ message: (e as Error)?.message || 'The request failed.', kind: (e as { kind?: string })?.kind || 'error' });

export function useDealInfluence(accessToken: string | null) {
  const [touches, setTouches] = useState<CompanyTouches | null>(null);
  const [intel, setIntel] = useState<IntelContext>({ organic365: null, dm90: null });
  const [intelErrors, setIntelErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<IntelError | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  /** Paid touches for every matched org, plus Account Intel organic (365d) and decision makers (90d). */
  const load = useCallback(async (accountId: string, orgIds: string[], from: string, to: string, key: string) => {
    if (!accessToken || !accountId || !orgIds.length) return;
    setIsLoading(true);
    setError(null);
    setIntelErrors([]);
    const intelCall = (params: Record<string, unknown>) =>
      invoke<{ companies: CompanyIntelligence[] }>(accessToken, { accountId, ...params }, (d) => Array.isArray(d?.companies), 'stale').then((d) => d.companies);
    const [t, organic, dm] = await Promise.allSettled([
      invoke<CompanyTouches>(accessToken, { accountId, orgIds, from, to, breakdown: 'touches' }, (d) => Array.isArray(d?.rows) && !!d?.meta?.from,
        'The deployed edge function has no deal touches yet — deploy linkedin-api.'),
      intelCall({ lookbackWindow: 'LAST_365_DAYS' }),
      intelCall({ lookbackWindow: 'LAST_90_DAYS', seniorities: DECISION_MAKER_SENIORITIES }),
    ]);
    if (t.status === 'fulfilled') {
      setTouches(t.value);
      setLoadedKey(key);
    } else {
      setTouches(null);
      setLoadedKey(null);
      setError(toIntelError(t.reason));
    }
    setIntel({ organic365: organic.status === 'fulfilled' ? organic.value : null, dm90: dm.status === 'fulfilled' ? dm.value : null });
    setIntelErrors([
      organic.status === 'rejected' ? `Organic (Account Intel): ${toIntelError(organic.reason).message}` : '',
      dm.status === 'rejected' ? `Decision makers (Account Intel): ${toIntelError(dm.reason).message}` : '',
    ].filter(Boolean));
    setIsLoading(false);
  }, [accessToken]);

  const reset = useCallback(() => {
    setTouches(null);
    setLoadedKey(null);
    setError(null);
    setIntelErrors([]);
    setIntel({ organic365: null, dm90: null });
  }, []);

  return { touches, intel, intelErrors, isLoading, error, loadedKey, load, reset };
}
