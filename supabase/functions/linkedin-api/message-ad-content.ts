// Read-only Message Ad (Sponsored InMail) content: /rest/inMailContents.
import { CREATIVE_READ_VERSION } from './creative-metadata.ts';

const text = (v: unknown) => (typeof v === 'string' ? v.replace(/\r/g, '').trim() : '');

export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n')
    .trim();
}

export type MessageAdContent = {
  messageType: 'REGULAR' | 'CONVERSATION' | 'LEAD_FORM' | 'UNKNOWN';
  subject: string;
  bodyHtml: string;
  bodyText: string;
  sender: string;
  footer: string;
  ctaLabel: string;
  destinationUrl: string;
  conversationUrn: string;
};

export function parseInMailContent(d: any): MessageAdContent {
  const sub = d?.subContent || {};
  const regular = sub.regular;
  const guided = sub.guidedReplies;
  const form = sub.form;
  const html = text(d?.htmlBody);
  return {
    messageType: regular ? 'REGULAR' : guided ? 'CONVERSATION' : form ? 'LEAD_FORM' : 'UNKNOWN',
    subject: text(d?.subject),
    bodyHtml: html,
    bodyText: htmlToText(html),
    sender: text(d?.sender),
    footer: text(d?.customFooter),
    ctaLabel: text(regular?.callToActionText || form?.callToActionText),
    destinationUrl: text(regular?.callToActionLandingPageUrl || regular?.callToActionLandingPage),
    conversationUrn: text(guided?.sponsoredConversation),
  };
}

export function isInMailRef(ref: string): boolean {
  return /^urn:li:adInMailContent:\d+$/.test(ref);
}

export async function readInMailContent(token: string, ref: string, fetcher: typeof fetch = fetch) {
  if (!isInMailRef(ref)) return { status: 400, content: undefined };
  const r = await fetcher(`https://api.linkedin.com/rest/inMailContents/${encodeURIComponent(ref)}`, {
    headers: { Authorization: `Bearer ${token}`, 'LinkedIn-Version': CREATIVE_READ_VERSION, 'X-Restli-Protocol-Version': '2.0.0' },
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) { await r.body?.cancel(); return { status: r.status, content: undefined }; }
  return { status: 200, content: parseInMailContent(await r.json()) };
}
