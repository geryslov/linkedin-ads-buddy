// Activity Overlap: which companies each activity type reached, and how much
// those audiences overlap. Pure functions only (relative imports) so the
// metrics are testable with `bun test`.
import { activityOf } from './campaignActivity';

export interface OverlapCampaign {
  id: string;
  name: string;
  status: string;
  format?: string;
  type?: string;
  objectiveType?: string;
}

/** One company × campaign row from get_company_campaign_breakdown, stripped. */
export interface TouchRow { campaignId: string; impressions: number; clicks: number }
export type Breakdowns = Record<string, TouchRow[]>;

// ── Classification ───────────────────────────────────────────────────────────

/**
 * Evaluated in order on the lowercased campaign name plus LinkedIn's format/type.
 * A rule matches when every `requireName` substring is present AND (if it has
 * any of formats / types / names / startsWith) at least one of those matches.
 */
export interface ActivityRule {
  type: string;
  short: string;
  requireName?: string[];
  formats?: string[];
  types?: string[];
  names?: string[];
  startsWith?: string;
}

export const DEFAULT_RULES: ActivityRule[] = [
  { type: 'Conversation Ads (InMail)', short: 'InMail', formats: ['SPONSORED_INMAIL'], types: ['SPONSORED_INMAILS'] },
  { type: 'Newsletter', short: 'Newsletter', names: ['newsletter'] },
  { type: 'Website Retargeting', short: 'Retarget', names: ['rtg_', 'retarget', 'anon'] },
  { type: 'ROI Calculator', short: 'Calculator', names: ['calculator'] },
  { type: 'Gartner Report (Conversion)', short: 'Gartner', names: ['gartner_conv'] },
  { type: 'Event', short: 'Event', formats: ['SPONSORED_UPDATE_EVENT'], names: ['money2020'] },
  { type: 'Thought Leadership – Video', short: 'TL video', requireName: ['tl&boosts'], formats: ['SINGLE_VIDEO'], names: ['vid'] },
  { type: 'Thought Leadership', short: 'TL', requireName: ['tl&boosts'] },
  { type: 'Brand', short: 'Brand', names: ['_brand_'] },
  { type: 'Industry Ads (LI_ series)', short: 'LI_ industry', startsWith: 'li_' },
];

/** Per-account rule sets, for clients whose naming differs. Falls back to DEFAULT_RULES. */
export const ACCOUNT_RULES: Record<string, ActivityRule[]> = {};

export const rulesFor = (accountId: string) => ACCOUNT_RULES[accountId] ?? DEFAULT_RULES;

export type ClassSource = 'override' | 'rule' | 'fallback';
export interface Classification { type: string; short: string; source: ClassSource }

function ruleMatches(r: ActivityRule, lname: string, format: string, type: string): boolean {
  if (r.requireName && !r.requireName.every((s) => lname.includes(s))) return false;
  const alts = [
    r.formats?.includes(format),
    r.types?.includes(type),
    r.names?.some((s) => lname.includes(s)),
    r.startsWith !== undefined ? lname.startsWith(r.startsWith) : undefined,
  ].filter((v) => v !== undefined);
  return alts.length === 0 ? true : alts.some(Boolean);
}

export const shortFor = (type: string, rules: ActivityRule[]) =>
  rules.find((r) => r.type === type)?.short ?? (type.length <= 12 ? type : type.split(/[\s(/–-]+/)[0]);

/** Rules first, then the scorecard's generic classifier (format, then name tokens). */
export function classifyCampaign(c: OverlapCampaign, rules: ActivityRule[], override?: string): Classification {
  if (override) return { type: override, short: shortFor(override, rules), source: 'override' };
  const lname = c.name.toLowerCase();
  const format = (c.format || '').toUpperCase();
  const type = (c.type || '').toUpperCase();
  const hit = rules.find((r) => ruleMatches(r, lname, format, type));
  if (hit) return { type: hit.type, short: hit.short, source: 'rule' };
  const { activity } = activityOf({ name: c.name, format: c.format, type: c.type });
  return { type: activity, short: shortFor(activity, rules), source: 'fallback' };
}

// ── Report ───────────────────────────────────────────────────────────────────

export interface TypeStats {
  type: string;
  short: string;
  colorIndex: number;
  campaigns: number;
  reach: number;
  touches: number;
  avgTouches: number;
  heavy: number;           // companies with 10+ touches in this type
  clicks: number;
  only: number;            // companies whose only type is this one
  onlyPct: number;
  top: { urn: string; touches: number; otherTypes: number }[];
  campaignRows: { id: string; name: string; reach: number; touches: number }[];
}

export interface CompanyStats {
  urn: string;
  touches: number;
  clicks: number;
  types: number;
  campaigns: number;
  byType: Record<string, number>;   // type → touches (member types only)
}

export interface Headline { text: string; parts: { kind: 'single' | 'only' | 'pair'; value: number; text: string }[] }

export interface OverlapReport {
  types: TypeStats[];                       // ordered by reach, descending
  matrix: number[][];                       // matrix[a][b] = |A∩B| / |A|, same order as types; NaN on the diagonal
  companies: CompanyStats[];                // companies in at least one type, by touches
  depth: number[];                          // depth[k-1] = companies that saw exactly k types
  totals: { companies: number; touches: number; clicks: number; campaignsDelivering: number; singlePct: number; threePlusPct: number };
  headline: Headline;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

/**
 * `minTouches` decides membership: a company counts in a type once it has at
 * least that many touches there (at 1, any surviving row counts, clicks-only
 * included). Touch totals per type are summed over member companies. LinkedIn
 * reports no company × campaign row under 3 impressions, so 2 or 3 equals 1.
 */
export function buildReport(
  campaigns: OverlapCampaign[],
  breakdowns: Breakdowns,
  classOf: (c: OverlapCampaign) => Classification,
  minTouches = 1,
): OverlapReport {
  const byId = new Map(campaigns.map((c) => [c.id, c]));
  const cls = new Map(campaigns.map((c) => [c.id, classOf(c)]));
  const shortOf = new Map<string, string>();
  cls.forEach((k) => shortOf.set(k.type, k.short));

  // Raw per company: type → {touches, clicks, campaigns}; per campaign: companies, touches.
  type Acc = { touches: number; clicks: number; campaigns: Set<string> };
  const raw = new Map<string, Map<string, Acc>>();
  const perCampaign = new Map<string, Map<string, number>>(); // campaignId → urn → touches
  const rawTypeTouches = new Map<string, number>();
  let allClicks = 0;

  for (const [urn, rows] of Object.entries(breakdowns)) {
    for (const r of rows) {
      if (!r.impressions && !r.clicks) continue;
      const k = cls.get(r.campaignId);
      if (!k) continue;
      let m = raw.get(urn);
      if (!m) raw.set(urn, (m = new Map()));
      let a = m.get(k.type);
      if (!a) m.set(k.type, (a = { touches: 0, clicks: 0, campaigns: new Set() }));
      a.touches += r.impressions || 0;
      a.clicks += r.clicks || 0;
      a.campaigns.add(r.campaignId);
      allClicks += r.clicks || 0;
      rawTypeTouches.set(k.type, (rawTypeTouches.get(k.type) || 0) + (r.impressions || 0));
      let pc = perCampaign.get(r.campaignId);
      if (!pc) perCampaign.set(r.campaignId, (pc = new Map()));
      pc.set(urn, (pc.get(urn) || 0) + (r.impressions || 0));
    }
  }

  // Colours follow raw touches, so a type keeps its colour when the threshold changes.
  const colorOrder = [...rawTypeTouches.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);

  const isMember = (a: Acc) => (minTouches <= 1 ? a.touches > 0 || a.clicks > 0 : a.touches >= minTouches);
  const members = new Map<string, Set<string>>(); // type → urns
  const companies: CompanyStats[] = [];
  for (const [urn, m] of raw) {
    const byType: Record<string, number> = {};
    let touches = 0, clicks = 0;
    const camps = new Set<string>();
    for (const [t, a] of m) {
      if (!isMember(a)) continue;
      byType[t] = a.touches;
      touches += a.touches;
      clicks += a.clicks;
      a.campaigns.forEach((id) => camps.add(id));
      let s = members.get(t);
      if (!s) members.set(t, (s = new Set()));
      s.add(urn);
    }
    const types = Object.keys(byType).length;
    if (types) companies.push({ urn, touches, clicks, types, campaigns: camps.size, byType });
  }
  companies.sort((a, b) => b.touches - a.touches);
  const typeCount = new Map(companies.map((c) => [c.urn, c.types]));

  const types: TypeStats[] = [...members.entries()].map(([type, urns]) => {
    let touches = 0, clicks = 0, heavy = 0, only = 0;
    const top: TypeStats['top'] = [];
    for (const urn of urns) {
      const a = raw.get(urn)!.get(type)!;
      touches += a.touches;
      clicks += a.clicks;
      if (a.touches >= 10) heavy++;
      const n = typeCount.get(urn) || 0;
      if (n === 1) only++;
      top.push({ urn, touches: a.touches, otherTypes: n - 1 });
    }
    top.sort((a, b) => b.touches - a.touches);
    const campaignRows = campaigns
      .filter((c) => cls.get(c.id)!.type === type && perCampaign.has(c.id))
      .map((c) => {
        const pc = perCampaign.get(c.id)!;
        let reach = 0, t = 0;
        pc.forEach((v, urn) => { if (urns.has(urn)) { reach++; t += v; } });
        return { id: c.id, name: byId.get(c.id)!.name, reach, touches: t };
      })
      .filter((r) => r.reach > 0)
      .sort((a, b) => b.touches - a.touches);
    const reach = urns.size;
    return {
      type, short: shortOf.get(type) || type, colorIndex: colorOrder.indexOf(type),
      campaigns: campaignRows.length, reach, touches, avgTouches: reach ? touches / reach : 0, heavy, clicks,
      only, onlyPct: reach ? only / reach : 0, top: top.slice(0, 15), campaignRows,
    };
  }).sort((a, b) => b.reach - a.reach || a.type.localeCompare(b.type));

  const sets = types.map((t) => members.get(t.type)!);
  const matrix = sets.map((A, i) => sets.map((B, j) => {
    if (i === j) return NaN;
    let n = 0;
    A.forEach((u) => { if (B.has(u)) n++; });
    return A.size ? n / A.size : 0;
  }));

  const depth = Array.from({ length: types.length }, () => 0);
  companies.forEach((c) => depth[c.types - 1]++);
  const total = companies.length;
  const totals = {
    companies: total,
    touches: companies.reduce((s, c) => s + c.touches, 0),
    clicks: minTouches <= 1 ? allClicks : companies.reduce((s, c) => s + c.clicks, 0),
    campaignsDelivering: perCampaign.size,
    singlePct: total ? (depth[0] || 0) / total : 0,
    threePlusPct: total ? depth.slice(2).reduce((s, v) => s + v, 0) / total : 0,
  };

  return { types, matrix, companies, depth, totals, headline: headlineFor(types, matrix, totals) };
}

/**
 * Strongest of: share that saw a single activity, the type (other than the
 * largest) with the highest "only this" share, the pair with the highest overlap. Types under 5% of all
 * companies are ignored for the last two, so a tiny type can't win on noise.
 */
export function headlineFor(types: TypeStats[], matrix: number[][], totals: OverlapReport['totals']): Headline {
  if (!totals.companies) return { text: 'No identifiable companies were reached in this period', parts: [] };
  const parts: Headline['parts'] = [{ kind: 'single', value: totals.singlePct, text: `${pct(totals.singlePct)} of companies saw a single activity` }];
  const big = (i: number) => types[i].reach >= totals.companies * 0.05;
  if (types.length > 1) {
    // Skip the largest type: its "only this" share mostly restates the single-activity share.
    let bestOnly = -1;
    types.forEach((t, i) => { if (i > 0 && big(i) && (bestOnly < 0 || t.onlyPct > types[bestOnly].onlyPct)) bestOnly = i; });
    if (bestOnly >= 0) {
      const t = types[bestOnly];
      parts.push({ kind: 'only', value: t.onlyPct, text: `${pct(t.onlyPct)} of companies reached by ${t.type} saw nothing else` });
    }
    let best: [number, number] | null = null;
    matrix.forEach((row, i) => row.forEach((v, j) => {
      if (i !== j && big(i) && big(j) && (!best || v > matrix[best[0]][best[1]])) best = [i, j];
    }));
    if (best) {
      const [i, j] = best as [number, number];
      parts.push({ kind: 'pair', value: matrix[i][j], text: `${pct(matrix[i][j])} of ${types[i].type} companies also saw ${types[j].type}` });
    }
  }
  const ranked = [...parts].sort((a, b) => b.value - a.value).slice(0, 2);
  return { text: ranked.map((p) => p.text).join(', and '), parts: ranked };
}
