import { describe, expect, test } from 'bun:test';
import { DEFAULT_RULES, buildReport, classifyCampaign, type Breakdowns, type OverlapCampaign } from './activityOverlap';

const camp = (id: string, name: string, format = 'STANDARD_UPDATE', type = 'SPONSORED_UPDATES'): OverlapCampaign =>
  ({ id, name, status: 'ACTIVE', format, type });
const classify = (c: OverlapCampaign) => classifyCampaign(c, DEFAULT_RULES);

describe('classifyCampaign', () => {
  test('rules apply in order', () => {
    expect(classify(camp('1', 'Q3_InMail', 'SPONSORED_INMAIL', 'SPONSORED_INMAILS')).short).toBe('InMail');
    expect(classify(camp('2', 'TL&Boosts_CEO_vid')).short).toBe('TL video');
    expect(classify(camp('3', 'TL&Boosts_CEO', 'SINGLE_VIDEO')).short).toBe('TL video');
    expect(classify(camp('4', 'TL&Boosts_CEO')).short).toBe('TL');
    expect(classify(camp('5', 'RTG_newsletter')).short).toBe('Newsletter');
    expect(classify(camp('6', 'rtg_site_visitors')).short).toBe('Retarget');
    expect(classify(camp('7', 'EU_brand_awareness')).short).toBe('Brand');
    expect(classify(camp('8', 'LI_Banking')).short).toBe('LI_ industry');
    expect(classify(camp('9', 'Money2020 booth')).type).toBe('Event');
    expect(classify(camp('10', 'Booth', 'SPONSORED_UPDATE_EVENT')).type).toBe('Event');
  });

  test('falls back to the generic classifier, and overrides win', () => {
    const fb = classify(camp('1', 'spring promo', 'CAROUSEL'));
    expect(fb).toEqual({ type: 'Carousel ads', short: 'Carousel ads', source: 'fallback' });
    expect(classifyCampaign(camp('2', 'EU_brand_awareness'), DEFAULT_RULES, 'Newsletter')).toEqual({ type: 'Newsletter', short: 'Newsletter', source: 'override' });
  });
});

describe('buildReport', () => {
  // TL: a, b, c, d · Brand: a, b · Retarget: e (only), plus c with 2 touches
  const campaigns = [camp('tl', 'tl&boosts_x'), camp('br', 'x_brand_y'), camp('rt', 'rtg_x')];
  const bd: Breakdowns = {
    a: [{ campaignId: 'tl', impressions: 12, clicks: 1 }, { campaignId: 'br', impressions: 3, clicks: 0 }],
    b: [{ campaignId: 'tl', impressions: 4, clicks: 0 }, { campaignId: 'br', impressions: 5, clicks: 0 }],
    c: [{ campaignId: 'tl', impressions: 6, clicks: 0 }, { campaignId: 'rt', impressions: 2, clicks: 0 }],
    d: [{ campaignId: 'tl', impressions: 1, clicks: 0 }, { campaignId: 'br', impressions: 0, clicks: 0 }],
    e: [{ campaignId: 'rt', impressions: 9, clicks: 0 }],
    z: [{ campaignId: 'unknown', impressions: 50, clicks: 0 }],
  };

  test('asymmetric overlap, only-this, depth', () => {
    const r = buildReport(campaigns, bd, classify);
    expect(r.types.map((t) => t.short)).toEqual(['TL', 'Brand', 'Retarget']);
    const [tl, brand, rt] = [0, 1, 2];
    expect(r.matrix[tl][brand]).toBe(0.5);   // 2 of 4 TL companies saw Brand
    expect(r.matrix[brand][tl]).toBe(1);     // both Brand companies saw TL
    expect(r.matrix[rt][tl]).toBe(0.5);
    expect(Number.isNaN(r.matrix[tl][tl])).toBe(true);
    expect(r.types[rt].only).toBe(1);        // e
    expect(r.types[tl].only).toBe(1);        // d (its brand row was all zeros)
    expect(r.depth).toEqual([2, 3, 0]);
    expect(r.totals.companies).toBe(5);
    expect(r.totals.touches).toBe(42);       // unknown campaign excluded
    expect(r.types[tl].heavy).toBe(1);
    expect(r.types[tl].top[0]).toEqual({ urn: 'a', touches: 12, otherTypes: 1 });
    for (const row of r.matrix) for (const v of row) if (!Number.isNaN(v)) expect(v >= 0 && v <= 1).toBe(true);
    for (const t of r.types) expect(t.only).toBeLessThanOrEqual(t.reach);
  });

  test('min touches changes membership but keeps colours', () => {
    const r1 = buildReport(campaigns, bd, classify);
    const r3 = buildReport(campaigns, bd, classify, 3);
    expect(r3.types.find((t) => t.short === 'TL')!.reach).toBe(3);      // d drops out
    expect(r3.types.find((t) => t.short === 'Retarget')!.reach).toBe(1); // c's 2 touches drop out
    for (const t of r3.types) expect(t.colorIndex).toBe(r1.types.find((x) => x.type === t.type)!.colorIndex);
  });

  test('headline picks the strongest findings', () => {
    const r = buildReport(campaigns, bd, classify);
    expect(r.headline.parts.length).toBe(2);
    expect(r.headline.parts[0].value).toBeGreaterThanOrEqual(r.headline.parts[1].value);
    expect(r.headline.text).toContain('100% of Brand companies also saw Thought Leadership');
  });

  test('the largest type never supplies the only-this clause', () => {
    // One dominant type: TL alone everywhere except one company that also saw Brand.
    const solo: Breakdowns = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`c${i}`, [{ campaignId: 'tl', impressions: 5, clicks: 0 }]]));
    solo.c0.push({ campaignId: 'br', impressions: 5, clicks: 0 });
    solo.x = [{ campaignId: 'br', impressions: 5, clicks: 0 }];
    const r = buildReport(campaigns, solo, classify);
    expect(r.headline.parts.find((p) => p.kind === 'only')?.text).toContain('Brand');
  });
});
