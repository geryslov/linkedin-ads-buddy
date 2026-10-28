import { assertEquals } from 'jsr:@std/assert@1';
import { parseInMailContent, readInMailContent, isInMailRef } from './message-ad-content.ts';

Deno.test('regular message ad returns subject, body text, CTA and link', () => {
  const c = parseInMailContent({
    subject: 'Hi there', sender: 'urn:li:person:1', htmlBody: '<p>Hello&nbsp;<b>Bob</b></p><p>Line 2</p>',
    subContent: { regular: { callToActionText: 'Book demo', callToActionLandingPageUrl: 'https://x.com' } },
  });
  assertEquals(c.messageType, 'REGULAR');
  assertEquals(c.subject, 'Hi there');
  assertEquals(c.bodyText, 'Hello Bob\nLine 2');
  assertEquals(c.ctaLabel, 'Book demo');
  assertEquals(c.destinationUrl, 'https://x.com');
});

Deno.test('conversation ad exposes its conversation id', () => {
  const c = parseInMailContent({ subject: 's', subContent: { guidedReplies: { sponsoredConversation: 'urn:li:sponsoredConversation:9' } } });
  assertEquals(c.messageType, 'CONVERSATION');
  assertEquals(c.conversationUrn, 'urn:li:sponsoredConversation:9');
});

Deno.test('only adInMailContent references are fetched', async () => {
  assertEquals(isInMailRef('urn:li:ugcPost:1'), false);
  let called = false;
  const r = await readInMailContent('t', 'urn:li:ugcPost:1', (() => { called = true; return Promise.resolve(new Response('{}')); }) as any);
  assertEquals(r.status, 400);
  assertEquals(called, false);
});

Deno.test('refused read reports the status, not empty content', async () => {
  const r = await readInMailContent('t', 'urn:li:adInMailContent:5', (() => Promise.resolve(new Response('no', { status: 403 }))) as any);
  assertEquals(r.status, 403);
  assertEquals(r.content, undefined);
});
