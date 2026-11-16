// Company matched audiences from a list of companies, via LinkedIn's CSV list
// upload (learn.microsoft.com → linkedin/marketing/matched-audiences/
// create-and-manage-list-uploads, li-lms-2026-10). List upload needs rw_ads
// only; company *streaming* (dmpSegments/{id}/companies) needs the separate
// Audiences program (rw_dmp_segments), which this app doesn't request.
// Flow: generateUploadUrl → POST the CSV → create a COMPANY_LIST_UPLOAD
// segment → wait 5 s → attach the upload. LinkedIn matches for up to 48 h.
// Creating a list attaches it to nothing; targeting stays a manual step.

import { ACCOUNT_INTEL_VERSION, AccountIntelError, linkedInError } from './account-intel.ts';

export const MAX_AUDIENCE_COMPANIES = 300000;

export type AudienceCompany = { name?: string; website?: string; pageUrl?: string };

const csvCell = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const domain = (url: string) => url.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0];

/** LinkedIn's company list template headers; at least one identifier per row. */
export function companyListCsv(companies: AudienceCompany[]) {
  const rows = companies
    .map((c) => {
      const name = String(c.name || '').trim().slice(0, 200);
      const site = domain(String(c.website || '')).slice(0, 100);
      const page = String(c.pageUrl || '').trim();
      return [name, site, page.length <= 100 ? page : ''];
    })
    .filter((r) => r.some(Boolean));
  return { csv: ['companyname,companywebsite,linkedincompanypageurl', ...rows.map((r) => r.map(csvCell).join(','))].join('\n'), rows: rows.length };
}

const restHeaders = (accessToken: string) => ({
  'Authorization': `Bearer ${accessToken}`,
  'LinkedIn-Version': ACCOUNT_INTEL_VERSION,
  'X-Restli-Protocol-Version': '2.0.0',
  'Content-Type': 'application/json',
});

async function fail(step: string, res: Response): Promise<never> {
  const text = await res.text();
  const kind = res.status === 401 ? 'token_invalid' : res.status === 403 ? 'no_permission' : res.status === 429 ? 'rate_limited' : 'api_error';
  throw new AccountIntelError(`${step} failed (${res.status})${linkedInError(text)}`, res.status, kind, text);
}

export async function createCompanyAudience(
  accessToken: string,
  q: { accountId: string; name: string; companies: AudienceCompany[] },
  fetchImpl: typeof fetch = fetch,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
) {
  const accountId = String(q.accountId || '').replace(/\D/g, '');
  const name = String(q.name || '').trim().slice(0, 200);
  if (!accountId || !name) throw new AccountIntelError('accountId and name are required', 400, 'bad_request');
  if (!Array.isArray(q.companies) || !q.companies.length) throw new AccountIntelError('companies must be a non-empty array', 400, 'bad_request');
  if (q.companies.length > MAX_AUDIENCE_COMPANIES) throw new AccountIntelError(`At most ${MAX_AUDIENCE_COMPANIES} companies per list`, 400, 'bad_request');
  const { csv, rows } = companyListCsv(q.companies);
  if (!rows) throw new AccountIntelError('No company has a name, website or LinkedIn page', 400, 'bad_request');
  const account = `urn:li:sponsoredAccount:${accountId}`;

  // 1. Upload URL
  const up = await fetchImpl('https://api.linkedin.com/rest/dmpSegments?action=generateUploadUrl', {
    method: 'POST', headers: restHeaders(accessToken), body: JSON.stringify({ owner: account }),
  });
  if (!up.ok) await fail('Getting an upload URL', up);
  const uploadUrl = (await up.json())?.value;
  if (typeof uploadUrl !== 'string' || !uploadUrl) throw new AccountIntelError('LinkedIn returned no upload URL', 502, 'api_error');

  // 2. The CSV; the media id comes back in `location`
  const put = await fetchImpl(uploadUrl, { method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'text/csv' }, body: csv });
  if (!put.ok) await fail('Uploading the company list', put);
  const location = put.headers.get('location') || '';
  if (!location) throw new AccountIntelError('LinkedIn accepted the file but returned no media id', 502, 'api_error');
  const inputFile = location.startsWith('urn:li:media:') ? location : `urn:li:media:${location}`;

  // 3. The segment
  const seg = await fetchImpl('https://api.linkedin.com/rest/dmpSegments', {
    method: 'POST', headers: restHeaders(accessToken),
    body: JSON.stringify({ name, sourcePlatform: 'LIST_UPLOAD', account, type: 'COMPANY_LIST_UPLOAD', destinations: [{ destination: 'LINKEDIN' }] }),
  });
  if (!seg.ok) await fail('Creating the audience', seg);
  const segmentId = (seg.headers.get('x-restli-id') || '').split(':').pop() || '';
  if (!segmentId) throw new AccountIntelError('LinkedIn created the audience but returned no id', 502, 'api_error');

  // 4. Attach (docs: wait 5 s after creating). One retry, then remove the empty segment.
  const attach = () => fetchImpl(`https://api.linkedin.com/rest/dmpSegments/${segmentId}/listUploads`, {
    method: 'POST', headers: restHeaders(accessToken), body: JSON.stringify({ inputFile }),
  });
  await sleep(5000);
  let att = await attach();
  if (!att.ok && att.status !== 401 && att.status !== 403) {
    await sleep(5000);
    att = await attach();
  }
  if (!att.ok) {
    await fetchImpl(`https://api.linkedin.com/rest/dmpSegments/${segmentId}`, { method: 'DELETE', headers: restHeaders(accessToken) }).catch(() => null);
    await fail('Attaching the list to the audience', att);
  }
  return { segmentId, name, companies: rows, skipped: q.companies.length - rows };
}

/** Status of one DMP segment: LinkedIn matches list uploads for up to 48 h. */
export async function getCompanyAudience(accessToken: string, q: { segmentId: string }, fetchImpl: typeof fetch = fetch) {
  const segmentId = String(q.segmentId || '').replace(/\D/g, '');
  if (!segmentId) throw new AccountIntelError('segmentId is required', 400, 'bad_request');
  const res = await fetchImpl(`https://api.linkedin.com/rest/dmpSegments/${segmentId}`, { headers: restHeaders(accessToken) });
  if (!res.ok) await fail('Reading the audience', res);
  const s = await res.json();
  const d = (Array.isArray(s?.destinations) ? s.destinations : []).find((x: any) => x?.destination === 'LINKEDIN') || s?.destinations?.[0] || {};
  return {
    segmentId, name: String(s?.name || ''),
    status: String(d?.status || 'UNKNOWN'),
    inputCount: typeof s?.inputCount === 'number' ? s.inputCount : null,
    matchedCount: typeof d?.matchedCount === 'number' ? d.matchedCount : null,
    audienceSize: typeof d?.audienceSize === 'number' ? d.audienceSize : null,
    adSegment: String(d?.destinationSegmentId || ''),
  };
}
