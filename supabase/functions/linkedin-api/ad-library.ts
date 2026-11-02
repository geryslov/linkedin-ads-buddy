// Read-only competitor ads from the LinkedIn Ad Library API (/rest/adLibrary).
// Shape decisions come from probe_ad_library live runs (Nov 2, 2026):
// - Never send dateRange: every query carrying it returns total 0 on all
//   versions, though jobLibrary accepts the same string. Filter by the
//   ad's own impression timestamps instead.
// - ~10 FINDER calls/minute per app, then 429. Page sparingly, cache, and
//   return partial results rather than failing.
// - Company/Job/Audience facets come back without segment values; only
//   Language and Location carry them. No ad text or image is returned.

export const AD_LIBRARY_VERSION = '202511';
const PAGE_SIZE = 25; // API maximum
const MAX_PAGES = 8; // stays under the per-minute throttle
const CACHE_TTL_MS = 10 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type CompetitorAd = {
  adUrl: string;
  advertiserName: string;
  advertiserUrl: string;
  payer: string;
  format: string;
  firstImpressionAt: string | null;
  lastImpressionAt: string | null;
  daysRunning: number | null;
  impressions: { from: number; to: number | null } | null;
  languages: string[];
  locations: string[];
  excludedLocations: string[];
  // Facets the advertiser used whose values LinkedIn does not disclose.
  targetingFacets: { included: string[]; excluded: string[] };
  isRestricted: boolean;
  restrictionDetails: string;
};

const iso = (ms: unknown) => (typeof ms === 'number' && ms > 0 ? new Date(ms).toISOString() : null);
const strings = (v: unknown) => (Array.isArray(v) ? v.filter((s) => typeof s === 'string' && s) : []);

export function normalizeAd(el: any): CompetitorAd {
  const d = el?.details || {};
  const adv = d.advertiser || {};
  const stats = d.adStatistics || {};
  const first = typeof stats.firstImpressionAt === 'number' ? stats.firstImpressionAt : null;
  const last = typeof stats.latestImpressionAt === 'number' ? stats.latestImpressionAt : null;
  const imp = stats.totalImpressions;

  const facets: any[] = Array.isArray(d.adTargeting) ? d.adTargeting : [];
  const facet = (name: string) => facets.find((f) => String(f?.facetName || '').toLowerCase() === name);
  const included: string[] = [];
  const excluded: string[] = [];
  for (const f of facets) {
    const name = String(f?.facetName || '');
    if (!name || ['language', 'location'].includes(name.toLowerCase())) continue;
    // Docs name these isInclusive/isExclusive; live responses use isIncluded/isExcluded.
    if (f?.isIncluded ?? f?.isInclusive) included.push(name);
    if (f?.isExcluded ?? f?.isExclusive) excluded.push(name);
  }

  return {
    adUrl: String(el?.adUrl || ''),
    advertiserName: String(adv.advertiserName || ''),
    advertiserUrl: String(adv.advertiserUrl || ''),
    payer: String(adv.adPayer || ''),
    format: String(d.type || 'UNKNOWN'),
    firstImpressionAt: iso(first),
    lastImpressionAt: iso(last),
    daysRunning: first && last ? Math.max(1, Math.round((last - first) / DAY_MS)) : null,
    // The top band is reported with to: 0, meaning "and above".
    impressions: imp && typeof imp.from === 'number' ? { from: imp.from, to: imp.to ? imp.to : null } : null,
    languages: strings(facet('language')?.includedSegments),
    locations: strings(facet('location')?.includedSegments),
    excludedLocations: strings(facet('location')?.excludedSegments),
    targetingFacets: { included, excluded },
    isRestricted: el?.isRestricted === true,
    restrictionDetails: el?.isRestricted === true ? String(el?.restrictionDetails || '') : '',
  };
}

export function summarizeAds(ads: CompetitorAd[], now = Date.now()) {
  const count = (key: (a: CompetitorAd) => string[]) => {
    const m: Record<string, number> = {};
    for (const a of ads) for (const k of key(a)) if (k) m[k] = (m[k] || 0) + 1;
    return Object.fromEntries(Object.entries(m).sort((x, y) => y[1] - x[1]));
  };
  const running = ads.map((a) => a.daysRunning).filter((n): n is number => n !== null).sort((x, y) => x - y);
  return {
    ads: ads.length,
    activeLast7Days: ads.filter((a) => a.lastImpressionAt && now - Date.parse(a.lastImpressionAt) <= 7 * DAY_MS).length,
    // Sum of band lower bounds: a floor, not an estimate.
    impressionsAtLeast: ads.reduce((s, a) => s + (a.impressions?.from || 0), 0),
    medianDaysRunning: running.length ? running[Math.floor(running.length / 2)] : null,
    byFormat: count((a) => [a.format]),
    byAdvertiser: count((a) => [a.advertiserName]),
    byLocation: count((a) => a.locations),
    byLanguage: count((a) => a.languages),
    targetingFacetsUsed: count((a) => a.targetingFacets.included),
  };
}

export type CompetitorAdsQuery = {
  advertiser: string;
  keyword?: string;
  days?: number;
  maxAds?: number;
  // Fuzzy matching returns e.g. "HubSpot For Startups" for "HubSpot".
  exactAdvertiser?: boolean;
};

// "HubSpot, Inc." / "HubSpot Inc" / "Acme LLC" → "hubspot" / "acme".
export function normalizeCompanyName(name: string): string {
  let n = String(name || '').toLowerCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
  const suffix = /\s(inc|incorporated|llc|ltd|limited|corp|corporation|co|gmbh|plc|sa|ag|bv)$/;
  while (suffix.test(n)) n = n.replace(suffix, '').trim();
  return n;
}

// Exact mode: the advertiser name matches, or the payer matches (thought-leader
// ads carry a person's name with the company as payer), or the ad shares a
// company URL with an exact-name match.
export function exactMatches(ads: CompetitorAd[], query: string): boolean[] {
  const q = query.toLowerCase();
  const nq = normalizeCompanyName(query);
  const named = ads.map((a) => a.advertiserName.toLowerCase() === q);
  const urls = new Set(ads.filter((_, i) => named[i]).map((a) => a.advertiserUrl).filter(Boolean));
  return ads.map((a, i) => named[i]
    || (!!nq && normalizeCompanyName(a.payer) === nq)
    || (!!a.advertiserUrl && urls.has(a.advertiserUrl)));
}

const cache = new Map<string, { at: number; value: any }>();

export async function fetchCompetitorAds(accessToken: string, q: CompetitorAdsQuery, fetchImpl: typeof fetch = fetch, now = Date.now()) {
  const advertiser = String(q.advertiser || '').trim();
  if (!advertiser) throw new Error('advertiser is required');
  const days = Math.min(Math.max(Number(q.days) || 30, 1), 365);
  const maxAds = Math.min(Math.max(Number(q.maxAds) || 100, 1), PAGE_SIZE * MAX_PAGES);
  const keyword = String(q.keyword || '').trim();
  const key = JSON.stringify([advertiser.toLowerCase(), keyword.toLowerCase(), maxAds]);

  // Cache raw pages (not the filtered view) so different days/exact settings
  // reuse the same throttled calls. Ad Library data is public, so the cache
  // is not per-user.
  let raw = cache.get(key);
  if (!raw || now - raw.at > CACHE_TTL_MS) {
    const elements: any[] = [];
    let total: number | null = null;
    let rateLimited = false;
    let error = '';
    for (let page = 0; elements.length < maxAds && page < MAX_PAGES; page++) {
      const count = Math.min(PAGE_SIZE, maxAds - elements.length);
      const url = `https://api.linkedin.com/rest/adLibrary?q=criteria&advertiser=${encodeURIComponent(advertiser)}`
        + (keyword ? `&keyword=${encodeURIComponent(keyword)}` : '')
        + `&start=${page * PAGE_SIZE}&count=${count}`;
      const r = await fetchImpl(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'LinkedIn-Version': AD_LIBRARY_VERSION,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      });
      if (r.status === 429) { rateLimited = true; break; }
      if (!r.ok) {
        error = `adLibrary ${r.status}: ${(await r.text()).slice(0, 300)}`;
        break;
      }
      const body = await r.json();
      const els = Array.isArray(body?.elements) ? body.elements : [];
      if (typeof body?.paging?.total === 'number') total = body.paging.total;
      elements.push(...els);
      if (els.length < count) break; // last page
    }
    if (error && !elements.length) throw new Error(error);
    raw = { at: now, value: { elements, total, rateLimited, error } };
    // Don't pin a throttled or failed partial for the full TTL.
    if (!rateLimited && !error) cache.set(key, raw);
  }

  const { elements, total, rateLimited, error } = raw.value as { elements: any[]; total: number | null; rateLimited: boolean; error: string };
  const since = now - days * DAY_MS;
  let pairs = elements.map((el) => ({ el, ad: normalizeAd(el) as CompetitorAd }));
  const matchedAdvertisers = summarizeAds(pairs.map((p) => p.ad), now).byAdvertiser;
  if (q.exactAdvertiser) {
    const keep = exactMatches(pairs.map((p) => p.ad), advertiser);
    pairs = pairs.filter((_, i) => keep[i]);
  }
  // Live run (Nov 2): 54 of 100 HubSpot ads came back with no impression
  // timestamps, band or targeting. They can't be placed in the window, so
  // they are reported apart (and listed) instead of being counted as "in window".
  const undated = pairs.filter((p) => !p.ad.lastImpressionAt);
  // Served in the window = last impression on or after its start.
  const ads = pairs.filter((p) => p.ad.lastImpressionAt && Date.parse(p.ad.lastImpressionAt) >= since).map((p) => p.ad);

  return {
    advertiser,
    keyword: keyword || null,
    days,
    totalMatching: total,
    fetched: elements.length,
    // Results are newest-created first; older ads still running can sit past the cap.
    truncated: total !== null && elements.length < total,
    rateLimited,
    partialError: error || null,
    cachedAt: new Date(raw.at).toISOString(),
    matchedAdvertisers,
    summary: summarizeAds(ads, now),
    ads,
    undated: {
      count: undated.length,
      byFormat: summarizeAds(undated.map((p) => p.ad), now).byFormat,
      adUrls: undated.map((p) => p.ad.adUrl),
      ads: undated.map((p) => p.ad),
      // One raw element, to see what LinkedIn actually sends for these.
      rawSample: undated[0]?.el ?? null,
    },
  };
}
