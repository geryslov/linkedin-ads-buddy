import { expect, test } from 'bun:test';
import { exactMatches, fetchCompetitorAds, normalizeAd, normalizeCompanyName, summarizeAds } from './ad-library.ts';

const NOW = Date.UTC(2026, 10, 2);
const DAY = 24 * 60 * 60 * 1000;

// Shape copied from the live HubSpot response (Nov 2, 2026).
const liveAd = (id: number, o: { name?: string; first?: number; last?: number; type?: string; from?: number; to?: number } = {}) => ({
  isRestricted: false,
  adUrl: `https://www.linkedin.com/ad-library/detail/${id}`,
  details: {
    advertiser: { adPayer: 'HubSpot, Inc.', advertiserName: o.name ?? 'HubSpot', advertiserUrl: 'https://www.linkedin.com/company/68529' },
    adStatistics: {
      latestImpressionAt: o.last ?? NOW - DAY,
      impressionsDistributionByCountry: [],
      totalImpressions: { from: o.from ?? 100000, to: o.to ?? 150000 },
      firstImpressionAt: o.first ?? NOW - 3 * DAY,
    },
    adTargeting: [
      { includedSegments: ['English'], facetName: 'Language', excludedSegments: [], isExcluded: false, isIncluded: true },
      { includedSegments: ['France'], facetName: 'Location', excludedSegments: [], isExcluded: false, isIncluded: true },
      { includedSegments: [], facetName: 'Audience', excludedSegments: [], isExcluded: false, isIncluded: true },
      { includedSegments: [], facetName: 'Company', excludedSegments: [], isExcluded: true, isIncluded: true },
    ],
    type: o.type ?? 'SPONSORED_VIDEO',
  },
});

const pageFetch = (pages: any[][], calls: string[] = [], status = 200) => (async (url: string) => {
  calls.push(String(url));
  if (status !== 200) return new Response('{"status":429}', { status });
  const start = Number(new URL(String(url)).searchParams.get('start'));
  return Response.json({ paging: { total: pages.flat().length }, elements: pages[start / 25] || [] });
}) as unknown as typeof fetch;

test('normalizes a live ad: geo/language values, valueless facets, impression band', () => {
  const a = normalizeAd(liveAd(1));
  expect(a.format).toBe('SPONSORED_VIDEO');
  expect(a.languages).toEqual(['English']);
  expect(a.locations).toEqual(['France']);
  expect(a.targetingFacets).toEqual({ included: ['Audience', 'Company'], excluded: ['Company'] });
  expect(a.impressions).toEqual({ from: 100000, to: 150000 });
  expect(a.daysRunning).toBe(2);
});

test('top impression band (to: 0) means open-ended', () => {
  expect(normalizeAd(liveAd(1, { from: 1000000, to: 0 })).impressions).toEqual({ from: 1000000, to: null });
});

test('restriction details only surface for restricted ads', () => {
  expect(normalizeAd({ ...liveAd(1), restrictionDetails: 'placeholder' }).restrictionDetails).toBe('');
  expect(normalizeAd({ ...liveAd(1), isRestricted: true, restrictionDetails: 'removed' }).restrictionDetails).toBe('removed');
});

test('summary counts formats and floors impressions', () => {
  const s = summarizeAds([normalizeAd(liveAd(1)), normalizeAd(liveAd(2, { type: 'SPONSORED_STATUS_UPDATE', from: 5000 }))], NOW);
  expect(s.byFormat).toEqual({ SPONSORED_VIDEO: 1, SPONSORED_STATUS_UPDATE: 1 });
  expect(s.impressionsAtLeast).toBe(105000);
  expect(s.activeLast7Days).toBe(2);
});

test('never sends dateRange and filters the window client-side', async () => {
  const calls: string[] = [];
  const r = await fetchCompetitorAds('t', { advertiser: 'DateTest', days: 30 }, pageFetch([[liveAd(1), liveAd(2, { last: NOW - 60 * DAY })]], calls), NOW);
  expect(calls[0]).not.toContain('dateRange');
  expect(calls[0]).toContain('advertiser=DateTest');
  expect(r.ads.map((a) => a.adUrl.split('/').pop())).toEqual(['1']);
});

test('pages until a short page, and exactAdvertiser drops fuzzy matches', async () => {
  const calls: string[] = [];
  const full = Array.from({ length: 25 }, (_, i) => liveAd(i));
  const r = await fetchCompetitorAds('t', { advertiser: 'PageTest', exactAdvertiser: true, maxAds: 200 },
    pageFetch([full, [liveAd(99, { name: 'HubSpot For Startups' })]], calls), NOW);
  expect(calls.length).toBe(2);
  expect(r.fetched).toBe(26);
  expect(r.matchedAdvertisers).toEqual({ HubSpot: 25, 'HubSpot For Startups': 1 });
  expect(r.ads.length).toBe(0); // advertiser name is "PageTest", none match exactly
});

test('429 on the first page returns an empty, flagged result instead of throwing', async () => {
  const r = await fetchCompetitorAds('t', { advertiser: 'ThrottleTest' }, pageFetch([], [], 429), NOW);
  expect(r.rateLimited).toBe(true);
  expect(r.ads).toEqual([]);
});

test('repeat queries are served from cache', async () => {
  const calls: string[] = [];
  const f = pageFetch([[liveAd(1)]], calls);
  await fetchCompetitorAds('t', { advertiser: 'CacheTest', days: 30 }, f, NOW);
  await fetchCompetitorAds('t', { advertiser: 'cachetest', days: 7 }, f, NOW + 1000);
  expect(calls.length).toBe(1);
});

test('ads without impression stats are reported apart, not counted in the window', async () => {
  const bare = { isRestricted: false, adUrl: 'https://www.linkedin.com/ad-library/detail/7', details: { advertiser: { advertiserName: 'HubSpot' }, type: 'SPONSORED_VIDEO' } };
  const r = await fetchCompetitorAds('t', { advertiser: 'UndatedTest', days: 30 }, pageFetch([[liveAd(1), bare]]), NOW);
  expect(r.ads.length).toBe(1);
  expect(r.summary.ads).toBe(1);
  expect(r.summary.byFormat).toEqual({ SPONSORED_VIDEO: 1 });
  expect(r.undated.count).toBe(1);
  expect(r.undated.adUrls).toEqual(['https://www.linkedin.com/ad-library/detail/7']);
  expect(r.undated.rawSample).toEqual(bare);
});

test('missing advertiser is rejected', async () => {
  await expect(fetchCompetitorAds('t', { advertiser: ' ' }, pageFetch([]), NOW)).rejects.toThrow('advertiser is required');
});

test('company name normalization strips legal suffixes', () => {
  expect(normalizeCompanyName('HubSpot, Inc.')).toBe('hubspot');
  expect(normalizeCompanyName('Acme LLC')).toBe('acme');
  expect(normalizeCompanyName('Foo Ltd')).toBe('foo');
  expect(normalizeCompanyName('Gong')).toBe('gong');
});

test('exact mode keeps payer matches and same-company-URL ads, drops other fuzzy matches', async () => {
  const person = liveAd(2, { name: 'Jane Doe' }); // thought-leader ad, payer HubSpot, Inc.
  const sameUrl = liveAd(3, { name: 'HubSpot Academy' });
  sameUrl.details.advertiser.adPayer = 'Someone Else';
  const other = liveAd(4, { name: 'HubSpot For Startups' });
  other.details.advertiser.adPayer = 'Startups Co';
  other.details.advertiser.advertiserUrl = 'https://www.linkedin.com/company/999';
  const r = await fetchCompetitorAds('t', { advertiser: 'HubSpot', exactAdvertiser: true }, pageFetch([[liveAd(1), person, sameUrl, other]]), NOW);
  expect(r.ads.map((a) => a.adUrl.split('/').pop()).sort()).toEqual(['1', '2', '3']);
});

test('exactMatches: payer match alone counts when no exact-name ad exists', () => {
  const a = normalizeAd(liveAd(1, { name: 'Jane Doe' }));
  expect(exactMatches([a], 'hubspot inc')).toEqual([true]);
  expect(exactMatches([a], 'Gong')).toEqual([false]);
});

test('undated ads are returned for listing but stay out of window stats', async () => {
  const bare = { isRestricted: false, adUrl: 'https://www.linkedin.com/ad-library/detail/8', details: { advertiser: { advertiserName: 'UndatedList' }, type: 'SPONSORED_VIDEO' } };
  const r = await fetchCompetitorAds('t', { advertiser: 'UndatedList', exactAdvertiser: true }, pageFetch([[bare]]), NOW);
  expect(r.ads.length).toBe(0);
  expect(r.summary.ads).toBe(0);
  expect(r.undated.ads.map((a) => a.adUrl)).toEqual(['https://www.linkedin.com/ad-library/detail/8']);
});
