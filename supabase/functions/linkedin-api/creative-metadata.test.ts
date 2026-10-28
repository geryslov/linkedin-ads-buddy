import { expect, test } from 'bun:test';
import { createCreativeReader, metadataCopy } from './creative-metadata';

test('October creative metadata maps ad copy and single image assets', () => {
  expect(metadataCopy({ metadata: { adFormat: 'SINGLE_IMAGE', adHeadline: 'Headline', adIntroductionText: 'Intro', adLine: 'Body', landingPage: 'https://example.com', assetURL: 'https://example.com/asset' } })).toEqual({ adFormat: 'SINGLE_IMAGE', headline: 'Headline', introText: 'Intro', description: 'Body', destinationUrl: 'https://example.com', assetUrl: 'https://example.com/asset', imageUrl: 'https://example.com/asset' });
});
test('video assets are not image previews', () => {
  expect(metadataCopy({ metadata: { adFormat: 'SPONSORED_VIDEO', assetURL: 'https://example.com/video.mp4' } }).imageUrl).toBe('');
});
test('missing metadata leaves fallback fields empty', () => {
  expect(metadataCopy({}).headline).toBe('');
  expect(metadataCopy({}).imageUrl).toBe('');
});
test('single creative explicitly requests metadata with October version and deduplicates', async () => {
  const requests: Array<{ url: string; version: string | null }> = [];
  const reader = createCreativeReader('test', (async (url, options) => {
    requests.push({ url: String(url), version: new Headers(options?.headers).get('LinkedIn-Version') });
    return Response.json({ metadata: { adHeadline: 'Actual' } });
  }) as typeof fetch);
  const [a, b] = await Promise.all([reader('123', '456'), reader('123', '456')]);
  expect(requests.length).toBe(1);
  expect(requests[0].version).toBe('202610');
  expect(requests[0].url).toBe('https://api.linkedin.com/rest/adAccounts/123/creatives/urn%3Ali%3AsponsoredCreative%3A456?fields=id,name,campaign,content,intendedStatus,leadgenCallToAction,metadata');
  expect((await a.json()).metadata.adHeadline).toBe('Actual');
  expect((await b.json()).metadata.adHeadline).toBe('Actual');
});
test('rejected metadata projection retries a plain creative read', async () => {
  const urls: string[] = [];
  const reader = createCreativeReader('test', (async url => {
    urls.push(String(url));
    return urls.length === 1 ? new Response('{}', { status: 403 }) : Response.json({ name: 'Existing name' });
  }) as typeof fetch);
  expect((await (await reader('123', '456')).json()).name).toBe('Existing name');
  expect(urls.length).toBe(2);
  expect(urls[1].includes('?')).toBe(false);
});