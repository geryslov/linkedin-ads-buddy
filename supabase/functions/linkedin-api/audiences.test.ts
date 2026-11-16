import { test, expect } from 'bun:test';
import { companyListCsv, createCompanyAudience, getCompanyAudience } from './audiences.ts';

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(body === null ? null : JSON.stringify(body), { status, headers });

test('company list CSV uses LinkedIn template headers, quotes commas, drops empty rows', () => {
  const { csv, rows } = companyListCsv([
    { name: 'Acme, Inc.', website: 'https://www.acme.com/about', pageUrl: 'https://www.linkedin.com/company/acme' },
    { name: '', website: '', pageUrl: '' },
    { name: 'Beta "B"', pageUrl: 'https://www.linkedin.com/company/' + 'x'.repeat(120) },
  ]);
  expect(rows).toBe(2);
  expect(csv.split('\n')).toEqual([
    'companyname,companywebsite,linkedincompanypageurl',
    '"Acme, Inc.",acme.com,https://www.linkedin.com/company/acme',
    '"Beta ""B""",,',
  ]);
});

test('create runs upload URL → CSV → segment → attach, with the media URN', async () => {
  const calls: { url: string; method: string; body: string }[] = [];
  const sleeps: number[] = [];
  const fake = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url, method: String(init.method || 'GET'), body: String(init.body ?? '') });
    if (url.includes('action=generateUploadUrl')) return json({ value: 'https://upload.example/abc' });
    if (url === 'https://upload.example/abc') return json(null, 201, { location: '/AAYA123.csv' });
    if (url.endsWith('/rest/dmpSegments')) return json(null, 201, { 'x-restli-id': '777' });
    if (url.endsWith('/777/listUploads')) return json(null, 201);
    return json({}, 404);
  }) as unknown as typeof fetch;
  const r = await createCompanyAudience('t', { accountId: '9', name: 'Warming', companies: [{ name: 'Acme', website: 'acme.com' }, {}] }, fake, async (ms) => { sleeps.push(ms); });
  expect(r).toEqual({ segmentId: '777', name: 'Warming', companies: 1, skipped: 1 });
  expect(calls.map((c) => c.method)).toEqual(['POST', 'POST', 'POST', 'POST']);
  expect(JSON.parse(calls[0].body)).toEqual({ owner: 'urn:li:sponsoredAccount:9' });
  expect(calls[1].body).toContain('Acme,acme.com,');
  expect(JSON.parse(calls[2].body)).toEqual({ name: 'Warming', sourcePlatform: 'LIST_UPLOAD', account: 'urn:li:sponsoredAccount:9', type: 'COMPANY_LIST_UPLOAD', destinations: [{ destination: 'LINKEDIN' }] });
  expect(JSON.parse(calls[3].body)).toEqual({ inputFile: 'urn:li:media:/AAYA123.csv' });
  expect(sleeps).toEqual([5000]);
});

test('a failed attach retries once, then deletes the empty segment and reports LinkedIn\'s message', async () => {
  const methods: string[] = [];
  const fake = (async (url: string, init: RequestInit = {}) => {
    methods.push(`${init.method || 'GET'} ${url.replace('https://api.linkedin.com/rest/', '')}`);
    if (url.includes('action=generateUploadUrl')) return json({ value: 'https://upload.example/abc' });
    if (url === 'https://upload.example/abc') return json(null, 201, { location: '/m.csv' });
    if (url.endsWith('/rest/dmpSegments')) return json(null, 201, { 'x-restli-id': 'urn:li:dmpSegment:5' });
    if (url.endsWith('/5/listUploads')) return json({ message: 'Segment not ready' }, 400);
    if (init.method === 'DELETE') return json(null, 204);
    return json({}, 404);
  }) as unknown as typeof fetch;
  await expect(createCompanyAudience('t', { accountId: '9', name: 'x', companies: [{ name: 'Acme' }] }, fake, async () => {}))
    .rejects.toMatchObject({ kind: 'api_error', message: expect.stringContaining('Segment not ready') });
  expect(methods.slice(-3)).toEqual(['POST dmpSegments/5/listUploads', 'POST dmpSegments/5/listUploads', 'DELETE dmpSegments/5']);
});

test('a 403 on the upload URL is classified, nothing else is called', async () => {
  let calls = 0;
  const fake = (async () => { calls++; return json({ message: 'Not enough permissions' }, 403); }) as unknown as typeof fetch;
  await expect(createCompanyAudience('t', { accountId: '9', name: 'x', companies: [{ name: 'Acme' }] }, fake, async () => {}))
    .rejects.toMatchObject({ kind: 'no_permission', status: 403 });
  expect(calls).toBe(1);
});

test('status reads the LinkedIn destination', async () => {
  const fake = (async () => json({
    name: 'Warming', inputCount: 120,
    destinations: [{ destination: 'LINKEDIN', status: 'READY', matchedCount: 98, audienceSize: 4100, destinationSegmentId: 'urn:li:adSegment:42' }],
  })) as unknown as typeof fetch;
  expect(await getCompanyAudience('t', { segmentId: '5' }, fake)).toEqual({
    segmentId: '5', name: 'Warming', status: 'READY', inputCount: 120, matchedCount: 98, audienceSize: 4100, adSegment: 'urn:li:adSegment:42',
  });
});
