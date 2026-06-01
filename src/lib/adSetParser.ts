// ─── Windward Ad Set Name Parser ──────────────────────────────────────────────
// Pure, config-driven function. Parses `||`-delimited LinkedIn campaign names
// into 7 structured dimensions. Order-independent matching.

export interface ParsedAdSet {
  business_line: string;
  funnel: string;
  segment: string;
  activity_type: string;
  ad_type: string;
  objective: string;
  topic: string;
}

// ─── CONFIG: Business Line ───────────────────────────────────────────────────
const BUSINESS_LINE_KEYWORDS: Array<{ test: (s: string) => boolean; value: string }> = [
  { test: s => s.includes('commercial'), value: 'Commercial' },
  { test: s => /\bgov\b/.test(s), value: 'GOV' },
];
const BUSINESS_LINE_DEFAULT = 'Commercial';

// ─── CONFIG: Funnel ──────────────────────────────────────────────────────────
const FUNNEL_PERFORMANCE_KEYWORDS = [
  'performance', 'leadgen', 'lead gen', 'leads', 'classic leads',
  'sql optimization', 'brand to demand', 'mql', 'demo',
];

// ─── CONFIG: Segment / Pod (priority-ordered, first match wins) ──────────────
const SEGMENT_RULES: Array<{ test: (s: string) => boolean; value: string }> = [
  { test: s => s.includes('enterprise') && (s.includes('energy') || s.includes('oil')) && (s.includes('gas') || s.includes('energy')), value: 'Enterprise – Energy/Oil & Gas' },
  { test: s => s.includes('ctv viewer') || s.includes('ctv viewere'), value: 'CTV Viewers' },
  { test: s => s.includes('coast guard'), value: 'Coast Guard' },
  { test: s => s.includes('tier 1') && s.includes('row'), value: 'ROW Pod – Tier 1' },
  { test: s => s.includes('tier 2') && s.includes('row'), value: 'ROW Pod – Tier 2' },
  { test: s => s.includes('commercial opps') || s.includes('current opps'), value: 'Commercial Current Opps' },
  { test: s => s.includes('enterprise'), value: 'Enterprise Pod' },
  { test: s => s.includes('apac pod') || s.includes('apac'), value: 'APAC Pod' },
  { test: s => s.includes('all pods'), value: 'All Pods' },
  { test: s => s.includes('law firm'), value: 'Law Firms' },
  { test: s => s.includes('insurance') || s.includes('underwriting'), value: 'Insurance' },
  { test: s => s.includes('row pod') || /\brow\b/.test(s), value: 'ROW Pod' },
  { test: s => s.includes('gov us'), value: 'GOV US' },
  { test: s => s.includes('gov intl') || s.includes('international'), value: 'GOV International' },
  { test: s => s.includes('customs') || s.includes('gov row'), value: 'GOV Customs' },
];

// ─── CONFIG: Play Words (activity_type candidates) ───────────────────────────
const PLAY_WORDS: Record<string, string> = {
  'thought leader ads': 'Thought Leader Ads',
  'thought leader': 'Thought Leader Ads',
  'page boosts': 'Page Boosts',
  "windward's page boosts": 'Page Boosts',
  'newsletter': 'Newsletter',
  'gated assets': 'Gated Assets',
  'gated': 'Gated Assets',
  'non-gated report': 'Non-Gated Report',
  'non gated report': 'Non-Gated Report',
  'followers': 'Followers',
  'ctv 2026': 'CTV',
  '#2 ctv 2026': 'CTV',
  'rmkt': 'Remarketing',
  'rmkt + mqls + engagers': 'Remarketing',
  'mql + rmkt': 'Remarketing',
  'conversational ads': 'Conversational Ads',
};

// ─── CONFIG: Format Words (ad_type candidates) ──────────────────────────────
const FORMAT_WORDS: Record<string, string> = {
  'single image': 'Single Image',
  'video': 'Video',
  'videos': 'Video',
  'videos campaign': 'Video',
  'brand videos': 'Video',
  'conversational ads': 'Conversational Ad',
  'conversational ad': 'Conversational Ad',
  'spotlight ad': 'Spotlight Ad',
  'spotlight ads': 'Spotlight Ad',
  'demo': 'Demo',
  'rad': 'RAD',
};

// ─── CONFIG: Precedence ──────────────────────────────────────────────────────
const PLAY_PRECEDENCE = [
  'Gated Assets', 'Non-Gated Report', 'Remarketing', 'CTV',
  'Thought Leader Ads', 'Page Boosts', 'Newsletter', 'Followers', 'Conversational Ads',
];
const FORMAT_PRECEDENCE = [
  'Conversational Ad', 'Spotlight Ad', 'Video', 'Single Image', 'Demo', 'RAD',
];

// ─── CONFIG: House objective overrides ───────────────────────────────────────
const OBJECTIVE_OVERRIDES: Record<string, string> = {
  'Thought Leader Ads': 'Engagement',
  'Newsletter': 'Engagement',
  'Page Boosts': 'Engagement',
  'Followers': 'Clicks',
};

const OBJECTIVE_NORMALIZE: Record<string, string> = {
  'lead generation': 'Lead Generation',
  'website visits': 'Website Visits',
  'engagement': 'Engagement',
  'website conversions': 'Website Conversions',
  'brand awareness': 'Brand Awareness',
  'video views': 'Video Views',
};

// ─── CONFIG: Topic exclusions ────────────────────────────────────────────────
const TOPIC_EXCLUSIONS = new Set([
  'commercial', 'gov', 'performance', 'brand', 'leadgen', 'lead gen', 'leads',
  'classic leads', 'sql optimization', 'brand to demand', 'mql', 'demo',
  'eur', 'eur + row', 'global', 'member skills',
  'marine insurance & underwriting', 'marine insurance', 'underwriting',
  'banking & trade finance', 'banking', 'trade finance',
  'equipment suppliers', 'risk & compliance', 'risk', 'compliance',
  'energy/oil & gas', 'energy', 'oil & gas', 'oil', 'gas',
  'engagement',
]);

// ─── PARSER ──────────────────────────────────────────────────────────────────

export function parseAdSetName(name: string, linkedinObjective: string): ParsedAdSet {
  const normalized = name.replace(/[║‖]/g, '||');
  const tokens = normalized.split('||').map(t => t.trim()).filter(Boolean);

  const fragments: string[] = [];
  for (const token of tokens) {
    const parts = token.split(' - ').map(p => p.trim()).filter(Boolean);
    fragments.push(...parts);
  }

  const fullLower = fragments.map(f => f.toLowerCase()).join(' ');
  const fragmentsLower = fragments.map(f => f.toLowerCase().replace(/\s+/g, ' ').trim());

  // Business Line
  let business_line = BUSINESS_LINE_DEFAULT;
  for (const rule of BUSINESS_LINE_KEYWORDS) {
    if (rule.test(fullLower)) { business_line = rule.value; break; }
  }

  // Funnel
  let funnel = 'Brand';
  for (const kw of FUNNEL_PERFORMANCE_KEYWORDS) {
    if (fullLower.includes(kw)) { funnel = 'Performance'; break; }
  }

  // Segment
  let segment = '(unspecified)';
  for (const rule of SEGMENT_RULES) {
    if (rule.test(fullLower)) { segment = rule.value; break; }
  }

  // Collect plays and formats from fragments
  const matchedPlays = new Set<string>();
  const matchedFormats = new Set<string>();
  const matchedIdx = new Set<number>();

  for (let i = 0; i < fragmentsLower.length; i++) {
    const fl = fragmentsLower[i];
    for (const [kw, play] of Object.entries(PLAY_WORDS)) {
      if (fl === kw || fl.includes(kw)) { matchedPlays.add(play); matchedIdx.add(i); }
    }
    for (const [kw, fmt] of Object.entries(FORMAT_WORDS)) {
      if (fl === kw || fl.includes(kw)) { matchedFormats.add(fmt); matchedIdx.add(i); }
    }
  }

  // Resolve activity_type by precedence
  let activity_type = '';
  for (const play of PLAY_PRECEDENCE) {
    if (matchedPlays.has(play)) { activity_type = play; break; }
  }
  if (!activity_type) {
    activity_type = matchedFormats.has('Video') ? 'Video' : 'Demo Banners';
  }

  // Resolve ad_type by precedence
  let ad_type = '';
  for (const fmt of FORMAT_PRECEDENCE) {
    if (matchedFormats.has(fmt)) { ad_type = fmt; break; }
  }
  if (!ad_type) {
    if (activity_type === 'Followers') ad_type = 'Spotlight Ad';
    else if (activity_type === 'CTV') ad_type = 'Video';
    else if (activity_type === 'Gated Assets') ad_type = 'Gated / Lead Form';
    else ad_type = 'Single Image';
  }

  // Gated split
  if (activity_type === 'Gated Assets') {
    const suffix: Record<string, string> = {
      'Single Image': 'Gated – Single Image',
      'Conversational Ad': 'Gated – Conversational',
      'Video': 'Gated – Video',
      'Gated / Lead Form': 'Gated – Lead Form',
      'RAD': 'Gated – RAD',
    };
    activity_type = suffix[ad_type] || `Gated – ${ad_type}`;
  }

  // Objective
  const normalizedObj = OBJECTIVE_NORMALIZE[linkedinObjective.toLowerCase()] || linkedinObjective;
  const objective = OBJECTIVE_OVERRIDES[activity_type] || normalizedObj;

  // Topic: collect unmatched fragments
  const topicParts: string[] = [];
  for (let i = 0; i < fragments.length; i++) {
    if (matchedIdx.has(i)) continue;
    const fl = fragmentsLower[i];
    if (TOPIC_EXCLUSIONS.has(fl)) continue;
    let isKnown = false;
    for (const rule of BUSINESS_LINE_KEYWORDS) { if (rule.test(fl)) { isKnown = true; break; } }
    if (isKnown) continue;
    if (FUNNEL_PERFORMANCE_KEYWORDS.includes(fl)) continue;
    for (const rule of SEGMENT_RULES) { if (rule.test(fl)) { isKnown = true; break; } }
    if (isKnown) continue;
    if (OBJECTIVE_NORMALIZE[fl]) continue;
    if (fragments[i].trim()) topicParts.push(fragments[i].trim());
  }

  return { business_line, funnel, segment, activity_type, ad_type, objective, topic: [...new Set(topicParts)].join(' · ') };
}

// ─── DOCUMENTED BENCHMARKS ──────────────────────────────────────────────────

export interface DocumentedBenchmark {
  label: string;
  activityFilter?: string;
  objectiveFilter?: string;
  metric: 'ctr' | 'cpl';
  op: '>=' | '<=' | '>';
  value: number;
  failFlag: 'MISS' | 'PAUSE';
}

export const DOCUMENTED_BENCHMARKS: DocumentedBenchmark[] = [
  { label: 'Thought Leader Ads CTR', activityFilter: 'Thought Leader Ads', metric: 'ctr', op: '>=', value: 0.07, failFlag: 'MISS' },
  { label: 'Page Boosts CTR', activityFilter: 'Page Boosts', metric: 'ctr', op: '>=', value: 0.04, failFlag: 'MISS' },
  { label: 'Lead Gen CPL (Good)', objectiveFilter: 'Lead Generation', metric: 'cpl', op: '<=', value: 50, failFlag: 'MISS' },
  { label: 'Lead Gen CPL (Pause)', objectiveFilter: 'Lead Generation', metric: 'cpl', op: '>', value: 100, failFlag: 'PAUSE' },
];

export function getHeadlineMetric(objective: string): { name: string; key: string; lowerIsBetter: boolean; secondaryKey: string } {
  switch (objective) {
    case 'Lead Generation': return { name: 'CPL', key: 'cpl', lowerIsBetter: true, secondaryKey: 'ctr' };
    case 'Engagement': return { name: 'CTR', key: 'ctr', lowerIsBetter: false, secondaryKey: 'cpe' };
    case 'Website Visits':
    case 'Website Conversions':
    case 'Clicks': return { name: 'CPC', key: 'cpc', lowerIsBetter: true, secondaryKey: 'ctr' };
    case 'Video Views':
    case 'Brand Awareness': return { name: 'CPV', key: 'cpv', lowerIsBetter: true, secondaryKey: 'ctr' };
    default: return { name: 'CTR', key: 'ctr', lowerIsBetter: false, secondaryKey: 'cpc' };
  }
}
