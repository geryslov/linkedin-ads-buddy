// ─── Ad Set Name Parser ──────────────────────────────────────────────────────
// Config-driven parser. Each account can have its own ParserConfig.
// Accounts without a config use the DEFAULT_PARSER_CONFIG which groups
// by LinkedIn objective only (no naming convention parsing).

export interface ParsedAdSet {
  business_line: string;
  funnel: string;
  segment: string;
  activity_type: string;
  ad_type: string;
  objective: string;
  topic: string;
}

// ─── Parser Config Interface ─────────────────────────────────────────────────

export interface SegmentRule {
  keywords: string[];           // all must be present (AND)
  keywordsOr?: string[];        // at least one must be present (OR) — used when keywords has regexes
  regex?: string;               // alternative: regex test on full name
  value: string;
}

export interface ParserConfig {
  separator: string;                          // primary delimiter (e.g., '||')
  secondarySeparator?: string;                // within-token separator (e.g., ' - ')
  businessLineRules: Array<{ keywords: string[]; value: string }>;
  businessLineDefault: string;
  funnelPerformanceKeywords: string[];
  segmentRules: SegmentRule[];
  playWords: Record<string, string>;
  formatWords: Record<string, string>;
  playPrecedence: string[];
  formatPrecedence: string[];
  gatedActivityName?: string;                 // e.g., 'Gated Assets' — triggers gated split
  gatedSuffixMap?: Record<string, string>;
  objectiveOverrides: Record<string, string>;
  topicExclusions: string[];
  defaultActivityType?: string;               // fallback when no play matched (default: 'Other')
  benchmarks?: BenchmarkTarget[];
}

export interface BenchmarkTarget {
  label: string;
  activityFilter?: string;
  objectiveFilter?: string;
  metric: 'ctr' | 'cpl' | 'cpc' | 'cpe' | 'cpv';
  op: '>=' | '<=' | '>';
  value: number;
  failFlag: 'MISS' | 'PAUSE';
}

// ─── Objective normalization (shared across all accounts) ────────────────────

const OBJECTIVE_NORMALIZE: Record<string, string> = {
  'lead generation': 'Lead Generation',
  'website visits': 'Website Visits',
  'engagement': 'Engagement',
  'website conversions': 'Website Conversions',
  'brand awareness': 'Brand Awareness',
  'video views': 'Video Views',
};

// ─── DEFAULT CONFIG (generic, no naming convention) ──────────────────────────
// Works for any account. Groups by objective only; everything else → topic.

export const DEFAULT_PARSER_CONFIG: ParserConfig = {
  separator: '||',
  secondarySeparator: ' - ',
  businessLineRules: [],
  businessLineDefault: '(all)',
  funnelPerformanceKeywords: ['performance', 'leadgen', 'lead gen', 'leads', 'mql'],
  segmentRules: [],
  playWords: {
    'thought leader ads': 'Thought Leader Ads',
    'thought leader': 'Thought Leader Ads',
    'page boosts': 'Page Boosts',
    'newsletter': 'Newsletter',
    'followers': 'Followers',
    'conversational ads': 'Conversational Ads',
  },
  formatWords: {
    'single image': 'Single Image',
    'video': 'Video',
    'conversational ad': 'Conversational Ad',
    'spotlight ad': 'Spotlight Ad',
  },
  playPrecedence: ['Thought Leader Ads', 'Page Boosts', 'Newsletter', 'Followers', 'Conversational Ads'],
  formatPrecedence: ['Conversational Ad', 'Spotlight Ad', 'Video', 'Single Image'],
  objectiveOverrides: {
    'Thought Leader Ads': 'Engagement',
    'Newsletter': 'Engagement',
    'Page Boosts': 'Engagement',
  },
  topicExclusions: ['engagement', 'brand', 'performance'],
  defaultActivityType: 'Other',
  benchmarks: [],
};

// ─── WINDWARD CONFIG ─────────────────────────────────────────────────────────

export const WINDWARD_PARSER_CONFIG: ParserConfig = {
  separator: '||',
  secondarySeparator: ' - ',
  businessLineRules: [
    { keywords: ['commercial'], value: 'Commercial' },
    { keywords: ['\\bgov\\b'], value: 'GOV' },
  ],
  businessLineDefault: 'Commercial',
  funnelPerformanceKeywords: [
    'performance', 'leadgen', 'lead gen', 'leads', 'classic leads',
    'sql optimization', 'brand to demand', 'mql', 'demo',
  ],
  segmentRules: [
    { keywords: ['enterprise', 'energy'], value: 'Enterprise – Energy/Oil & Gas' },
    { keywords: ['ctv viewer'], value: 'CTV Viewers' },
    { keywords: ['coast guard'], value: 'Coast Guard' },
    { keywords: ['tier 1', 'row'], value: 'ROW Pod – Tier 1' },
    { keywords: ['tier 2', 'row'], value: 'ROW Pod – Tier 2' },
    { keywords: ['current opps'], value: 'Commercial Current Opps' },
    { keywords: ['enterprise'], value: 'Enterprise Pod' },
    { keywords: ['apac'], value: 'APAC Pod' },
    { keywords: ['all pods'], value: 'All Pods' },
    { keywords: ['law firm'], value: 'Law Firms' },
    { keywords: ['insurance'], value: 'Insurance' },
    { keywords: ['underwriting'], value: 'Insurance' },
    { keywords: ['row pod'], value: 'ROW Pod' },
    { keywords: ['\\brow\\b'], value: 'ROW Pod' },
    { keywords: ['gov us'], value: 'GOV US' },
    { keywords: ['gov intl'], value: 'GOV International' },
    { keywords: ['international'], value: 'GOV International' },
    { keywords: ['customs'], value: 'GOV Customs' },
    { keywords: ['gov row'], value: 'GOV Customs' },
  ],
  playWords: {
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
  },
  formatWords: {
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
  },
  playPrecedence: [
    'Gated Assets', 'Non-Gated Report', 'Remarketing', 'CTV',
    'Thought Leader Ads', 'Page Boosts', 'Newsletter', 'Followers', 'Conversational Ads',
  ],
  formatPrecedence: [
    'Conversational Ad', 'Spotlight Ad', 'Video', 'Single Image', 'Demo', 'RAD',
  ],
  gatedActivityName: 'Gated Assets',
  gatedSuffixMap: {
    'Single Image': 'Gated – Single Image',
    'Conversational Ad': 'Gated – Conversational',
    'Video': 'Gated – Video',
    'Gated / Lead Form': 'Gated – Lead Form',
    'RAD': 'Gated – RAD',
  },
  objectiveOverrides: {
    'Thought Leader Ads': 'Engagement',
    'Newsletter': 'Engagement',
    'Page Boosts': 'Engagement',
    'Followers': 'Clicks',
  },
  topicExclusions: [
    'commercial', 'gov', 'performance', 'brand', 'leadgen', 'lead gen', 'leads',
    'classic leads', 'sql optimization', 'brand to demand', 'mql', 'demo',
    'eur', 'eur + row', 'global', 'member skills',
    'marine insurance & underwriting', 'marine insurance', 'underwriting',
    'banking & trade finance', 'banking', 'trade finance',
    'equipment suppliers', 'risk & compliance', 'risk', 'compliance',
    'energy/oil & gas', 'energy', 'oil & gas', 'oil', 'gas',
    'engagement',
  ],
  defaultActivityType: 'Demo Banners',
  benchmarks: [
    { label: 'Thought Leader Ads CTR', activityFilter: 'Thought Leader Ads', metric: 'ctr', op: '>=', value: 0.07, failFlag: 'MISS' },
    { label: 'Page Boosts CTR', activityFilter: 'Page Boosts', metric: 'ctr', op: '>=', value: 0.04, failFlag: 'MISS' },
    { label: 'Lead Gen CPL (Good)', objectiveFilter: 'Lead Generation', metric: 'cpl', op: '<=', value: 50, failFlag: 'MISS' },
    { label: 'Lead Gen CPL (Pause)', objectiveFilter: 'Lead Generation', metric: 'cpl', op: '>', value: 100, failFlag: 'PAUSE' },
  ],
};

// ─── Account Config Registry ─────────────────────────────────────────────────
// Map account IDs to their parser configs. Accounts not listed use DEFAULT.

const ACCOUNT_CONFIGS: Record<string, ParserConfig> = {
  '506396961': WINDWARD_PARSER_CONFIG,
};

export function getParserConfig(accountId: string): ParserConfig {
  return ACCOUNT_CONFIGS[accountId] || DEFAULT_PARSER_CONFIG;
}

export function hasCustomConfig(accountId: string): boolean {
  return accountId in ACCOUNT_CONFIGS;
}

// ─── PARSER ──────────────────────────────────────────────────────────────────

function matchesKeywords(text: string, keywords: string[]): boolean {
  return keywords.every(kw => {
    if (kw.startsWith('\\b') || kw.includes('\\b')) {
      return new RegExp(kw).test(text);
    }
    return text.includes(kw);
  });
}

export function parseAdSetName(name: string, linkedinObjective: string, config: ParserConfig = DEFAULT_PARSER_CONFIG): ParsedAdSet {
  const sep = config.separator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const normalized = name.replace(/[║‖]/g, config.separator);
  const tokens = normalized.split(new RegExp(sep)).map(t => t.trim()).filter(Boolean);

  const fragments: string[] = [];
  for (const token of tokens) {
    if (config.secondarySeparator) {
      const parts = token.split(config.secondarySeparator).map(p => p.trim()).filter(Boolean);
      fragments.push(...parts);
    } else {
      fragments.push(token);
    }
  }

  const fullLower = fragments.map(f => f.toLowerCase()).join(' ');
  const fragmentsLower = fragments.map(f => f.toLowerCase().replace(/\s+/g, ' ').trim());

  // Business Line
  let business_line = config.businessLineDefault;
  for (const rule of config.businessLineRules) {
    if (matchesKeywords(fullLower, rule.keywords.map(k => k.toLowerCase()))) {
      business_line = rule.value; break;
    }
  }

  // Funnel
  let funnel = 'Brand';
  for (const kw of config.funnelPerformanceKeywords) {
    if (fullLower.includes(kw.toLowerCase())) { funnel = 'Performance'; break; }
  }

  // Segment
  let segment = '(unspecified)';
  for (const rule of config.segmentRules) {
    if (matchesKeywords(fullLower, rule.keywords.map(k => k.toLowerCase()))) {
      segment = rule.value; break;
    }
  }

  // Collect plays and formats
  const matchedPlays = new Set<string>();
  const matchedFormats = new Set<string>();
  const matchedIdx = new Set<number>();
  const topicExclSet = new Set(config.topicExclusions.map(s => s.toLowerCase()));

  for (let i = 0; i < fragmentsLower.length; i++) {
    const fl = fragmentsLower[i];
    for (const [kw, play] of Object.entries(config.playWords)) {
      if (fl === kw || fl.includes(kw)) { matchedPlays.add(play); matchedIdx.add(i); }
    }
    for (const [kw, fmt] of Object.entries(config.formatWords)) {
      if (fl === kw || fl.includes(kw)) { matchedFormats.add(fmt); matchedIdx.add(i); }
    }
  }

  // Resolve activity_type
  let activity_type = '';
  for (const play of config.playPrecedence) {
    if (matchedPlays.has(play)) { activity_type = play; break; }
  }
  if (!activity_type) {
    activity_type = matchedFormats.has('Video') ? 'Video' : (config.defaultActivityType || 'Other');
  }

  // Resolve ad_type
  let ad_type = '';
  for (const fmt of config.formatPrecedence) {
    if (matchedFormats.has(fmt)) { ad_type = fmt; break; }
  }
  if (!ad_type) {
    if (activity_type === 'Followers') ad_type = 'Spotlight Ad';
    else if (activity_type === 'CTV') ad_type = 'Video';
    else if (activity_type === config.gatedActivityName) ad_type = 'Gated / Lead Form';
    else ad_type = 'Single Image';
  }

  // Gated split
  if (config.gatedActivityName && activity_type === config.gatedActivityName && config.gatedSuffixMap) {
    activity_type = config.gatedSuffixMap[ad_type] || `${config.gatedActivityName} – ${ad_type}`;
  }

  // Objective
  const normalizedObj = OBJECTIVE_NORMALIZE[linkedinObjective.toLowerCase()] || linkedinObjective;
  const objective = config.objectiveOverrides[activity_type] || normalizedObj;

  // Topic
  const topicParts: string[] = [];
  for (let i = 0; i < fragments.length; i++) {
    if (matchedIdx.has(i)) continue;
    const fl = fragmentsLower[i];
    if (topicExclSet.has(fl)) continue;
    let isKnown = false;
    for (const rule of config.businessLineRules) {
      if (matchesKeywords(fl, rule.keywords.map(k => k.toLowerCase()))) { isKnown = true; break; }
    }
    if (isKnown) continue;
    if (config.funnelPerformanceKeywords.some(kw => fl === kw.toLowerCase())) continue;
    for (const rule of config.segmentRules) {
      if (matchesKeywords(fl, rule.keywords.map(k => k.toLowerCase()))) { isKnown = true; break; }
    }
    if (isKnown) continue;
    if (OBJECTIVE_NORMALIZE[fl]) continue;
    if (fragments[i].trim()) topicParts.push(fragments[i].trim());
  }

  return { business_line, funnel, segment, activity_type, ad_type, objective, topic: [...new Set(topicParts)].join(' · ') };
}

// ─── HEADLINE METRIC PER OBJECTIVE ──────────────────────────────────────────

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
