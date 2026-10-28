// Creative reads only; campaign writes and other endpoints keep their versions.
export const CREATIVE_READ_VERSION = '202610';
export const CREATIVE_FIELDS = 'id,name,campaign,content,intendedStatus,leadgenCallToAction,metadata';

export function metadataCopy(creative: any) {
  const m = creative?.metadata || {};
  const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
  const asset = text(m.assetURL);
  const assetUrl = /^https:\/\//i.test(asset) ? asset : '';
  const adFormat = text(m.adFormat);
  // assetURL can be a video or document. Never feed those into an image tag.
  const imageFormat = /^(TEXT_AD|SPOTLIGHT_V2|FOLLOWER_V2|JOBS_V2|SINGLE_IMAGE|SPONSORED_IMAGE|SPONSORED_STATUS_UPDATE|SPONSORED_UPDATE)$/i.test(adFormat);
  const imageExtension = /\.(png|jpe?g|webp|gif)(?:[?#]|$)/i.test(assetUrl);
  const nonImageFormat = /VIDEO|DOCUMENT|CAROUSEL|MESSAGE|INMAIL|CONVERSATION/i.test(adFormat);
  return {
    adFormat,
    introText: text(m.adIntroductionText),
    headline: text(m.adHeadline),
    description: text(m.adLine),
    destinationUrl: text(m.landingPage),
    assetUrl,
    imageUrl: !nonImageFormat && (imageFormat || imageExtension) ? assetUrl : '',
  };
}

// A new reader per request: never share signed asset URLs or responses across users.
export function createCreativeReader(token: string, fetcher: typeof fetch = fetch) {
  const cache = new Map<string, Promise<Response>>();
  let metadataUnavailable = false;
  return async (accountId: string, creativeId: string): Promise<Response> => {
    if (!/^\d+$/.test(String(accountId)) || !/^\d+$/.test(String(creativeId))) {
      return new Response('{}', { status: 400 });
    }
    const key = `${accountId}:${creativeId}`;
    let pending = cache.get(key);
    if (!pending) {
      pending = (async () => {
        const url = `https://api.linkedin.com/rest/adAccounts/${accountId}/creatives/${encodeURIComponent(`urn:li:sponsoredCreative:${creativeId}`)}`;
        const headers = { Authorization: `Bearer ${token}`, 'LinkedIn-Version': CREATIVE_READ_VERSION, 'X-Restli-Protocol-Version': '2.0.0' };
        const response = await fetcher(metadataUnavailable ? url : `${url}?fields=${CREATIVE_FIELDS}`, { headers, signal: AbortSignal.timeout(10000) });
        if (!metadataUnavailable && [400, 403, 422].includes(response.status)) {
          metadataUnavailable = true;
          await response.body?.cancel();
          return fetcher(url, { headers, signal: AbortSignal.timeout(10000) });
        }
        return response;
      })();
      cache.set(key, pending);
    }
    return (await pending).clone();
  };
}