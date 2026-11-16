import { companyKey, type CompanyIntelligence } from '@/hooks/useCompanyIntelligence';

/**
 * Account momentum from two cumulative Account Intel windows: the last 30 days
 * vs the 60 days before them (90d − 30d). Sums subtract cleanly; engagement
 * levels don't, so the rule uses engagements and shows levels as context.
 * Also drives Company Journey's momentum badge, so the two tabs agree.
 */
export type Momentum = 'new' | 'warming' | 'cooling' | 'steady';

export const MOMENTUM_RATIO = 1.5;
export const MIN_ENGAGEMENTS = 3;
export const MOMENTUM_RULE =
  `New = engaged in the last 30 days with no impressions or engagements in the 60 days before. ` +
  `Warming = at least ${MIN_ENGAGEMENTS} engagements in the last 30 days and a daily engagement rate ${MOMENTUM_RATIO}× or more the prior 60 days'. ` +
  `Cooling = at least ${MIN_ENGAGEMENTS} engagements in the prior 60 days and a daily rate there ${MOMENTUM_RATIO}× or more the last 30 days'. ` +
  `Engagements and impressions count paid, organic or both, per the filter.`;

/** Which engagements drive the classification. */
export type EngagementSource = 'both' | 'paid' | 'organic';

export interface Activity {
  paidImpressions: number;
  organicImpressions: number;
  paidEngagements: number;
  organicEngagements: number;
}

const eng = (a: Activity, s: EngagementSource = 'both') =>
  (s !== 'organic' ? a.paidEngagements : 0) + (s !== 'paid' ? a.organicEngagements : 0);
const imp = (a: Activity, s: EngagementSource = 'both') =>
  (s !== 'organic' ? a.paidImpressions : 0) + (s !== 'paid' ? a.organicImpressions : 0);

export function momentumOf(m30: Activity | null, m90: Activity, source: EngagementSource = 'both') {
  const recent = m30 ? eng(m30, source) : 0;
  // The two calls aren't atomic — a 30d figure can exceed the 90d one.
  const prior = Math.max(0, eng(m90, source) - recent);
  const priorImpressions = Math.max(0, imp(m90, source) - (m30 ? imp(m30, source) : 0));
  const recentRate = recent / 30;
  const priorRate = prior / 60;
  let momentum: Momentum | null = null;
  if (recent > 0 && prior === 0 && priorImpressions === 0) momentum = 'new';
  else if (recent >= MIN_ENGAGEMENTS && recentRate >= MOMENTUM_RATIO * priorRate) momentum = 'warming';
  else if (prior >= MIN_ENGAGEMENTS && priorRate >= MOMENTUM_RATIO * recentRate) momentum = 'cooling';
  else if (recent > 0 || prior > 0) momentum = 'steady';
  return { momentum, recent, prior };
}

export interface Mover {
  company: CompanyIntelligence;
  momentum: Momentum;
  level30: string;
  level90: string;
  recent: number;
  prior: number;
  /** Director+ engaged in the last 90 days (LinkedIn's audience filters are 90d only). */
  dm: boolean;
  dmSeniorities: string[];
}

export interface MoversResult {
  movers: Mover[];
  counts: Record<Momentum, number>;
  engaged30: number;
  engaged90: number;
  dmCompanies: number;
  /** In 30d but missing from 90d (a truncated 90d run) — prior unknown, left out. */
  unknownPrior: number;
}

export function buildMovers(c30: CompanyIntelligence[], c90: CompanyIntelligence[], dm: CompanyIntelligence[] | null, source: EngagementSource = 'both'): MoversResult {
  const recent = new Map(c30.map((c) => [companyKey(c), c]));
  const dmBy = new Map((dm ?? []).map((c) => [companyKey(c), c]));
  const keys90 = new Set<string>();
  const movers: Mover[] = [];
  const counts: Record<Momentum, number> = { new: 0, warming: 0, cooling: 0, steady: 0 };
  for (const c of c90) {
    const key = companyKey(c);
    keys90.add(key);
    const r = recent.get(key) ?? null;
    const m = momentumOf(r, c, source);
    if (!m.momentum) continue;
    counts[m.momentum]++;
    const d = dmBy.get(key);
    movers.push({
      company: r ?? c, momentum: m.momentum, level30: r?.engagementLevel ?? 'UNKNOWN', level90: c.engagementLevel,
      recent: m.recent, prior: m.prior, dm: !!d, dmSeniorities: d?.seniorities ?? [],
    });
  }
  const unknownPrior = c30.filter((c) => !keys90.has(companyKey(c))).length;
  return {
    movers, counts,
    engaged30: c30.filter((c) => eng(c, source) > 0).length,
    engaged90: c90.filter((c) => eng(c, source) > 0).length,
    dmCompanies: dmBy.size,
    unknownPrior,
  };
}

/** Warming/new rank by recent engagement, cooling by what was lost; decision makers first. */
export function rankMovers(r: MoversResult, momentum: Momentum) {
  return r.movers
    .filter((m) => m.momentum === momentum)
    .sort((a, b) => Number(b.dm) - Number(a.dm) || (momentum === 'cooling' ? b.prior - a.prior : b.recent - a.recent));
}

/** Compact block for the client weekly report. Names only when the agency opts in — published raw data is public by link. */
export function summarizeMovers(r: MoversResult, includeNames: boolean) {
  const top = (m: Momentum) => rankMovers(r, m).slice(0, 5).map((x) => ({
    name: x.company.companyName, engagementLevel30d: x.level30 === 'UNKNOWN' ? 'none' : x.level30, decisionMakersEngaged90d: x.dm,
  }));
  return {
    window: 'last 30 days compared with the 60 days before (not this week)',
    engagedCompanies30d: r.engaged30,
    engagedCompanies90d: r.engaged90,
    warming: r.counts.warming,
    newlyEngaged: r.counts.new,
    cooling: r.counts.cooling,
    companiesWithDecisionMakersEngaged90d: r.dmCompanies,
    ...(includeNames ? { topWarming: top('warming'), topNew: top('new'), topCooling: top('cooling') } : {}),
  };
}
