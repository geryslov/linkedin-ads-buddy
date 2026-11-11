import { expect, test } from 'bun:test';
import { buildFilterCriteria, fetchAccountIntel, fetchAudienceBreakdown, fetchCampaignBreakdown, fetchCompanyDaily, fetchCreativeBreakdown, fetchWindowSeries, mergeBySeniority, normalizeCompany, selectBreakdownCampaigns } from './account-intel.ts';

// Element shape from the docs' 202606+ sample response.
const el = (name: string, o: Record<string, unknown> = {}) => ({
  companyPageUrl: `https://www.linkedin.com/company/${name.toLowerCase()}`,
  companyWebsite: `http://www.${name.toLowerCase()}.com`,
  companyName: name,
  paidClicks: 40, organicEngagements: 100, paidLeads: 80, paidEngagements: 600,
  paidImpressions: 266, organicImpressions: 100, engagementLevel: 'VERY_LOW',
  paidQualifiedLeads: 8, conversions: 18, paidVideoViews: 160,
  companySize: 'SIZE_10001_OR_MORE', industry: 'urn:li:industry:4', countryCode: 'US',
  costInLocalCurrencyPerPaidQualifiedLead: 145.5,
  ...o,
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

test('filterCriteria encodes URNs but not Rest.li structure', () => {
  expect(buildFilterCriteria({ accountId: '1', lookbackWindow: 'LAST_30_DAYS', campaignId: '12345678' }))
    .toBe('(lookbackWindow:LAST_30_DAYS,campaign:urn%3Ali%3AsponsoredCampaign%3A12345678)');
  expect(buildFilterCriteria({ accountId: '1', seniority: '4' })).toBe('(lookbackWindow:LAST_90_DAYS,seniority:4)');
  expect(buildFilterCriteria({ accountId: '1', jobFunction: 'SALES' })).toBe('(lookbackWindow:LAST_90_DAYS,jobFunction:SALES)');
  expect(buildFilterCriteria({ accountId: '1', lookbackWindow: 'LAST_7_DAYS', adSegmentIds: ['1234', '5678'] }))
    .toBe('(lookbackWindow:LAST_7_DAYS,adSegments:List(urn%3Ali%3AadSegment%3A1234,urn%3Ali%3AadSegment%3A5678))');
});

test('filterCriteria rejects combinations LinkedIn rejects', () => {
  expect(() => buildFilterCriteria({ accountId: '1', seniority: '6', lookbackWindow: 'LAST_30_DAYS' })).toThrow();
  expect(() => buildFilterCriteria({ accountId: '1', seniority: '6', campaignId: '1' })).toThrow();
  expect(() => buildFilterCriteria({ accountId: '1', seniority: '6', jobFunction: 'SALES' })).toThrow();
  expect(() => buildFilterCriteria({ accountId: '1', campaignId: '1', objectiveType: 'BRAND_AWARENESS' })).toThrow();
  expect(() => buildFilterCriteria({ accountId: '1', jobFunction: 'ENGINEERING' })).toThrow();
});

test('normalizeCompany keeps every documented field', () => {
  const c = normalizeCompany(el('Microsoft'));
  expect(c.paidQualifiedLeads).toBe(8);
  expect(c.costPerQualifiedLead).toBe(145.5);
  expect(c.countryCode).toBe('US');
  expect(normalizeCompany({}).costPerQualifiedLead).toBeNull();
});

test('pages until a short page and sends version 202610', async () => {
  const calls: string[] = [];
  const fake = (async (url: string, init: RequestInit) => {
    calls.push(url);
    expect((init.headers as Record<string, string>)['LinkedIn-Version']).toBe('202610');
    const start = Number(new URL(url).searchParams.get('start'));
    const n = start === 0 ? 500 : 3;
    return json({ elements: Array.from({ length: n }, (_, i) => el(`C${start + i}`)), paging: { start, count: 500, total: 503, links: [] } });
  }) as unknown as typeof fetch;
  const r = await fetchAccountIntel('t', { accountId: '123' }, fake);
  expect(calls.length).toBe(2);
  expect(calls[0]).toContain('account=urn%3Ali%3AsponsoredAccount%3A123');
  expect(r.companies.length).toBe(503);
  expect(r.meta.truncated).toBe(false);
});

test('403s are classified by cause', async () => {
  const deny = (msg: string) => (async () => json({ message: msg }, 403)) as unknown as typeof fetch;
  await expect(fetchAccountIntel('t', { accountId: '1' }, deny('ACCESS_DENIED: Not enough permissions to access /accountIntelligence API')))
    .rejects.toMatchObject({ kind: 'not_provisioned' });
  await expect(fetchAccountIntel('t', { accountId: '1' }, deny('PERMISSION_DENIED: Access request for sponsored account denied for READ_SPONSORED_ACCOUNT permissions.')))
    .rejects.toMatchObject({ kind: 'no_account_role' });
  await expect(fetchAccountIntel('t', { accountId: '1' }, deny('Ads reporting permission is required to fetch Company Intelligence data.')))
    .rejects.toMatchObject({ kind: 'no_reporting_scope' });
});

test('multi-seniority runs merge per company with the highest level', () => {
  const a = normalizeCompany(el('Acme', { engagementLevel: 'LOW', paidImpressions: 10 }));
  const a2 = normalizeCompany(el('Acme', { engagementLevel: 'HIGH', paidImpressions: 5 }));
  const b = normalizeCompany(el('Beta', { paidImpressions: 1 }));
  const m = mergeBySeniority([{ seniority: '6', companies: [a, b] }, { seniority: '8', companies: [a2] }]);
  expect(m[0].companyName).toBe('Acme');
  expect(m[0].paidImpressions).toBe(15);
  expect(m[0].engagementLevel).toBe('HIGH');
  expect(m[0].seniorities).toEqual(['6', '8']);
  expect(m[1].seniorities).toEqual(['6']);
});

const DAY = 24 * 60 * 60 * 1000;

test('breakdown campaigns skip drafts, future and long-ended campaigns, active first', () => {
  const now = Date.UTC(2026, 10, 11);
  const { campaigns, skipped } = selectBreakdownCampaigns([
    { id: 1, name: 'Old', status: 'COMPLETED', runSchedule: { start: now - 200 * DAY, end: now - 120 * DAY } },
    { id: 2, name: 'Draft', status: 'DRAFT', runSchedule: { start: now - DAY } },
    { id: 3, name: 'Paused', status: 'PAUSED', objectiveType: 'LEAD_GENERATION', runSchedule: { start: now - 10 * DAY } },
    { id: 4, name: 'Live', status: 'ACTIVE', objectiveType: 'BRAND_AWARENESS', runSchedule: { start: now - 5 * DAY } },
    { id: 5, name: 'Future', status: 'ACTIVE', runSchedule: { start: now + DAY } },
  ], 'LAST_90_DAYS', now);
  expect(campaigns.map((c) => c.id)).toEqual(['4', '3']);
  expect(campaigns[0].objectiveType).toBe('BRAND_AWARENESS');
  expect(skipped).toBe(3);
});

test('campaign breakdown pivots one call per campaign into rows per company', async () => {
  const urls: string[] = [];
  const fake = (async (url: string) => {
    urls.push(url);
    if (url.includes('/adCampaigns')) {
      return json({ elements: [
        { id: 11, name: 'A', status: 'ACTIVE', objectiveType: 'LEAD_GENERATION', runSchedule: { start: Date.now() - DAY } },
        { id: 22, name: 'B', status: 'ACTIVE', objectiveType: 'WEBSITE_VISIT', runSchedule: { start: Date.now() - DAY } },
      ] });
    }
    const camp = decodeURIComponent(url).match(/sponsoredCampaign:(\d+)/)?.[1];
    const els = camp === '11' ? [el('Acme', { paidImpressions: 50 }), el('Beta')] : [el('Acme', { paidImpressions: 7, engagementLevel: 'HIGH' })];
    return json({ elements: els, paging: { total: els.length, links: [] } });
  }) as unknown as typeof fetch;
  const r = await fetchCampaignBreakdown('t', { accountId: '9', lookbackWindow: 'LAST_30_DAYS' }, fake);
  const acme = r.byCompany['https://www.linkedin.com/company/acme'];
  expect(acme.map((x) => x.slice).sort()).toEqual(['11', '22']);
  expect(acme.find((x) => x.slice === '22')!.engagementLevel).toBe('HIGH');
  expect(r.byCompany['https://www.linkedin.com/company/beta'].length).toBe(1);
  expect(r.campaigns.find((c) => c.id === '11')!.companies).toBe(2);
  expect(urls.filter((u) => u.includes('accountIntelligence')).every((u) => u.includes('LAST_30_DAYS'))).toBe(true);
});

test('audience breakdown runs 16 slices and keeps failures partial', async () => {
  let calls = 0;
  const fake = (async (url: string) => {
    calls++;
    if (url.includes('jobFunction:FINANCE')) return json({ message: 'boom' }, 500);
    return json({ elements: [el('Acme')], paging: { total: 1, links: [] } });
  }) as unknown as typeof fetch;
  const r = await fetchAudienceBreakdown('t', { accountId: '9' }, fake);
  expect(calls).toBe(16);
  expect(r.byCompany['https://www.linkedin.com/company/acme'].length).toBe(15);
  expect(r.meta.failed.map((f) => f.slice)).toEqual(['fn:FINANCE']);
});

test('a provisioning 403 aborts the whole breakdown', async () => {
  const fake = (async () => json({ message: 'ACCESS_DENIED: Not enough permissions to access /accountIntelligence API' }, 403)) as unknown as typeof fetch;
  await expect(fetchAudienceBreakdown('t', { accountId: '9' }, fake)).rejects.toMatchObject({ kind: 'not_provisioned' });
});

test('creative breakdown queries served creatives per company and resolves orgs', async () => {
  const urls: string[] = [];
  const fake = (async (url: string) => {
    urls.push(url);
    if (url.includes('/creatives?q=criteria')) return json({ elements: [{ id: 'urn:li:sponsoredCreative:7', name: 'Hero video', intendedStatus: 'ACTIVE' }] });
    if (url.includes('pivot=CREATIVE')) return json({ elements: [
      { pivotValue: 'urn:li:sponsoredCreative:7', impressions: 900 },
      { pivotValue: 'urn:li:sponsoredCreative:8', impressions: 50 },
      { pivotValue: 'urn:li:sponsoredCreative:9', impressions: 0 },
    ] });
    if (url.includes('organizationsLookup')) return json({ results: { '1035': { localizedName: 'Microsoft', vanityName: 'microsoft', localizedWebsite: 'https://microsoft.com' } } });
    const creative = decodeURIComponent(url).match(/sponsoredCreative:(\d+)/)?.[1];
    return json({ elements: [{ pivotValue: 'urn:li:organization:1035', impressions: creative === '7' ? 300 : 20, clicks: 4, costInLocalCurrency: '12.345' }] });
  }) as unknown as typeof fetch;
  const r = await fetchCreativeBreakdown('t', { accountId: '9', campaignId: '11', lookbackWindow: 'LAST_30_DAYS' }, fake, Date.UTC(2026, 10, 11));
  expect(urls.filter((u) => u.includes('pivot=MEMBER_COMPANY')).length).toBe(2);
  expect(urls.find((u) => u.includes('pivot=CREATIVE'))).toContain('dateRange.start.month=10');
  expect(r.creatives.map((c) => c.name)).toEqual(['Hero video', 'Creative 8']);
  expect(r.companies[0].vanityName).toBe('microsoft');
  expect(r.companies[0].creatives.find((c) => c.creativeId === '7')!.spend).toBe(12.35);
});

test('window series queries all six lookbacks and keys rows per company', async () => {
  const seen: string[] = [];
  const fake = (async (url: string) => {
    const w = url.match(/lookbackWindow:(\w+)/)![1];
    seen.push(w);
    return json({ elements: [el('Acme', { paidImpressions: w === 'LAST_7_DAYS' ? 10 : 100 })], paging: { total: 1, links: [] } });
  }) as unknown as typeof fetch;
  const r = await fetchWindowSeries('t', { accountId: '9' }, fake);
  expect(seen.sort()).toEqual(['LAST_180_DAYS', 'LAST_30_DAYS', 'LAST_365_DAYS', 'LAST_60_DAYS', 'LAST_7_DAYS', 'LAST_90_DAYS']);
  expect(r.byCompany['https://www.linkedin.com/company/acme'].length).toBe(6);
  expect(r.companies[0].companyName).toBe('Acme');
});

test('company daily resolves the org, keeps only its rows, and splits full responses', async () => {
  const stats: string[] = [];
  const fake = (async (url: string) => {
    if (url.includes('/organizations?q=vanityName')) return json({ elements: [{ id: 1035 }] });
    if (url.includes('/adCampaigns')) return json({ elements: [{ id: 11, name: 'Q4 ABM', objectiveType: 'WEBSITE_VISIT', status: 'ACTIVE' }] });
    stats.push(url);
    const full = stats.length === 1; // first (whole-range) call hits the element cap
    const els = full
      ? Array.from({ length: 15000 }, () => ({ pivotValues: ['urn:li:sponsoredCampaign:11', 'urn:li:organization:1'] }))
      : [
        { pivotValues: ['urn:li:sponsoredCampaign:11', 'urn:li:organization:1035'], dateRange: { start: { year: 2026, month: 11, day: 3 } }, impressions: 40, clicks: 2, videoViews: 5, costInLocalCurrency: '3.2' },
        { pivotValues: ['urn:li:sponsoredCampaign:11', 'urn:li:organization:7'], dateRange: { start: { year: 2026, month: 11, day: 3 } }, impressions: 999 },
      ];
    return json({ elements: els });
  }) as unknown as typeof fetch;
  const r = await fetchCompanyDaily('t', { accountId: '9', lookbackWindow: 'LAST_30_DAYS', companyPageUrl: 'https://www.linkedin.com/company/microsoft' }, fake, Date.UTC(2026, 10, 11));
  expect(stats[0]).toContain('pivots=List(CAMPAIGN,MEMBER_COMPANY)');
  expect(stats[0]).toContain('dateRange=(start:(year:2026,month:10,day:13),end:(year:2026,month:11,day:11))');
  expect(stats.length).toBe(3);
  expect(r.rows.length).toBe(2);
  expect(r.rows[0]).toMatchObject({ date: '2026-11-03', campaignId: '11', impressions: 40, videoViews: 5, spend: 3.2 });
  expect(r.campaigns['11'].name).toBe('Q4 ABM');
  expect(r.meta.campaignSplit).toBe(true);
});

test('company daily falls back to a single MEMBER_COMPANY pivot when LinkedIn rejects the split', async () => {
  const stats: string[] = [];
  const fake = (async (url: string) => {
    if (url.includes('/adCampaigns')) return json({ elements: [] });
    stats.push(url);
    if (url.includes('q=statistics')) return json({ message: 'bad pivots' }, 400);
    return json({ elements: [{ pivotValues: ['urn:li:organization:42'], dateRange: { start: { year: 2026, month: 11, day: 1 } }, impressions: 7 }] });
  }) as unknown as typeof fetch;
  const r = await fetchCompanyDaily('t', { accountId: '9', companyPageUrl: 'https://www.linkedin.com/company/42/' }, fake);
  expect(stats.map((u) => u.includes('videoViews'))).toEqual([true, false, false]);
  expect(r.meta.campaignSplit).toBe(false);
  expect(r.rows[0]).toMatchObject({ campaignId: null, impressions: 7 });
});
