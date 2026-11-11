import { expect, test } from 'bun:test';
import { buildFilterCriteria, fetchAccountIntel, fetchAudienceBreakdown, fetchCampaignBreakdown, mergeBySeniority, normalizeCompany, selectBreakdownCampaigns } from './account-intel.ts';

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
