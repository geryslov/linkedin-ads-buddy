import { expect, test } from 'bun:test';
import { buildFilterCriteria, fetchAccountIntel, mergeBySeniority, normalizeCompany } from './account-intel.ts';

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
