// ─── Segmentation Aggregator ─────────────────────────────────────────────────
// Takes parsed ad set rows + metrics, builds a 5-level hierarchy tree,
// looks up baselines, and computes deltas.

import type { ParsedAdSet } from './adSetParser';
import { getHeadlineMetric } from './adSetParser';
import baselineData from '../data/windward_benchmark_baseline.json';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RawMetrics {
  spend: number;
  impressions: number;
  clicks: number;
  engagements: number;
  leads: number;
  video_views: number;
  follows: number;
  clicks_to_lp: number;
}

export interface DerivedMetrics extends RawMetrics {
  ctr: number | null;
  eng_rate: number | null;
  cpc: number | null;
  cpe: number | null;
  cpv: number | null;
  cpl: number | null;
  cpf: number | null;
}

export interface BaselineEntry {
  spend: number; impressions: number; clicks: number; engagements: number;
  leads: number; video_views: number; follows: number; clicks_to_lp: number;
  ctr: number | null; eng_rate: number | null;
  cpc: number | null; cpe: number | null; cpv: number | null;
  cpl: number | null; cpf: number | null;
  n_adsets: number;
}

export interface Delta {
  absolute: number;
  pct: number | null;
  isBetter: boolean;
}

export interface SegmentNode {
  key: string;
  label: string;
  level: number;
  metrics: DerivedMetrics;
  baseline: BaselineEntry | null;
  headlineDelta: Delta | null;
  ctrDelta: Delta | null;
  benchmarkFlag: 'PASS' | 'MISS' | 'PAUSE' | null;
  headline: { name: string; value: number | null; lowerIsBetter: boolean };
  secondary: { name: string; value: number | null };
  children: SegmentNode[];
  adSetCount: number;
}

export interface ParsedAdSetRow {
  parsed: ParsedAdSet;
  metrics: RawMetrics;
  campaignName: string;
  campaignId: string;
  status: string;
  ads?: Array<{ name: string; headline?: string; metrics: RawMetrics }>;
}

// ─── Derive metrics ──────────────────────────────────────────────────────────

export function deriveMetrics(raw: RawMetrics): DerivedMetrics {
  const totalFollows = raw.follows;
  return {
    ...raw,
    ctr: raw.impressions > 0 ? raw.clicks / raw.impressions : null,
    eng_rate: raw.impressions > 0 ? raw.engagements / raw.impressions : null,
    cpc: raw.clicks > 0 ? raw.spend / raw.clicks : null,
    cpe: raw.engagements > 0 ? raw.spend / raw.engagements : null,
    cpv: raw.video_views > 0 ? raw.spend / raw.video_views : null,
    cpl: raw.leads > 0 ? raw.spend / raw.leads : null,
    cpf: totalFollows > 0 ? raw.spend / totalFollows : null,
  };
}

function sumRaw(rows: RawMetrics[]): RawMetrics {
  return rows.reduce((acc, r) => ({
    spend: acc.spend + r.spend,
    impressions: acc.impressions + r.impressions,
    clicks: acc.clicks + r.clicks,
    engagements: acc.engagements + r.engagements,
    leads: acc.leads + r.leads,
    video_views: acc.video_views + r.video_views,
    follows: acc.follows + r.follows,
    clicks_to_lp: acc.clicks_to_lp + r.clicks_to_lp,
  }), { spend: 0, impressions: 0, clicks: 0, engagements: 0, leads: 0, video_views: 0, follows: 0, clicks_to_lp: 0 });
}

// ─── Baseline lookup ─────────────────────────────────────────────────────────

type LevelKey = 'business_line' | 'bl_objective' | 'bl_objective_activity';
const LEVEL_KEYS: LevelKey[] = ['business_line', 'bl_objective', 'bl_objective_activity'];

export function getBaseline(level: number, key: string): BaselineEntry | null {
  const levels = (baselineData as any).levels;
  const levelNames = ['business_line', 'bl_objective', 'bl_objective_activity', 'bl_objective_activity_adtype', 'bl_objective_activity_adtype_segment'];
  const levelData = levels[levelNames[level]];
  if (!levelData) return null;
  return levelData[key] || null;
}

// ─── Delta calculation ───────────────────────────────────────────────────────

function computeDelta(current: number | null, baseline: number | null, lowerIsBetter: boolean): Delta | null {
  if (current == null || baseline == null || baseline === 0) return null;
  const diff = lowerIsBetter ? baseline - current : current - baseline;
  const pct = (diff / Math.abs(baseline)) * 100;
  return { absolute: diff, pct, isBetter: diff > 0 };
}

// ─── Benchmark flag ──────────────────────────────────────────────────────────

function evaluateBenchmark(activityType: string, objective: string, metrics: DerivedMetrics): 'PASS' | 'MISS' | 'PAUSE' | null {
  // TLA CTR >= 7%
  if (activityType === 'Thought Leader Ads' && metrics.ctr != null) {
    return metrics.ctr >= 0.07 ? 'PASS' : 'MISS';
  }
  // Page Boosts CTR >= 4%
  if (activityType === 'Page Boosts' && metrics.ctr != null) {
    return metrics.ctr >= 0.04 ? 'PASS' : 'MISS';
  }
  // Lead Gen CPL
  if (objective === 'Lead Generation' && metrics.cpl != null) {
    if (metrics.cpl > 100) return 'PAUSE';
    if (metrics.cpl <= 50) return 'PASS';
    return 'MISS';
  }
  return null;
}

// ─── Build tree ──────────────────────────────────────────────────────────────

export function buildSegmentationTree(rows: ParsedAdSetRow[], compareBaseline: boolean): SegmentNode[] {
  // Level definitions: dimension extractors for the hierarchy
  const levelDefs: Array<{ extract: (p: ParsedAdSet) => string }> = [
    { extract: p => p.business_line },
    { extract: p => p.objective },
    { extract: p => p.activity_type },
    { extract: p => p.ad_type },
    { extract: p => p.segment },
  ];

  function buildLevel(filtered: ParsedAdSetRow[], level: number, parentKey: string): SegmentNode[] {
    if (level >= levelDefs.length) return [];

    const groups = new Map<string, ParsedAdSetRow[]>();
    for (const row of filtered) {
      const val = levelDefs[level].extract(row.parsed);
      if (!groups.has(val)) groups.set(val, []);
      groups.get(val)!.push(row);
    }

    const nodes: SegmentNode[] = [];
    for (const [label, groupRows] of groups) {
      const key = parentKey ? `${parentKey}||${label}` : label;
      const raw = sumRaw(groupRows.map(r => r.metrics));
      const metrics = deriveMetrics(raw);

      // Determine headline metric from the dominant objective in this group
      const objCounts = new Map<string, number>();
      for (const r of groupRows) {
        objCounts.set(r.parsed.objective, (objCounts.get(r.parsed.objective) || 0) + 1);
      }
      let dominantObj = '';
      let maxCount = 0;
      for (const [obj, count] of objCounts) {
        if (count > maxCount) { dominantObj = obj; maxCount = count; }
      }
      // At level 1 (objective), use the label directly
      if (level === 1) dominantObj = label;

      const hm = getHeadlineMetric(dominantObj);
      const headlineValue = (metrics as any)[hm.key] as number | null;
      const secondaryValue = (metrics as any)[hm.secondaryKey] as number | null;

      // Baseline lookup
      const baseline = compareBaseline ? getBaseline(level, key) : null;
      const headlineDelta = baseline && headlineValue != null
        ? computeDelta(headlineValue, (baseline as any)[hm.key], hm.lowerIsBetter)
        : null;
      const ctrDelta = baseline && metrics.ctr != null
        ? computeDelta(metrics.ctr, baseline.ctr, false)
        : null;

      // Benchmark flag (only applies at activity_type level = 2)
      const dominantActivity = level >= 2 ? key.split('||')[2] || '' : '';
      const benchmarkFlag = level >= 2
        ? evaluateBenchmark(dominantActivity, dominantObj, metrics)
        : null;

      const children = buildLevel(groupRows, level + 1, key);

      // Sort children: best-first by headline metric
      children.sort((a, b) => {
        const av = a.headline.value;
        const bv = b.headline.value;
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        return hm.lowerIsBetter ? av - bv : bv - av;
      });

      nodes.push({
        key,
        label,
        level,
        metrics,
        baseline,
        headlineDelta,
        ctrDelta,
        benchmarkFlag,
        headline: { name: hm.name, value: headlineValue, lowerIsBetter: hm.lowerIsBetter },
        secondary: { name: hm.secondaryKey === 'ctr' ? 'CTR' : hm.secondaryKey === 'cpe' ? 'CPE' : hm.secondaryKey === 'cpc' ? 'CPC' : hm.secondaryKey.toUpperCase(), value: secondaryValue },
        children,
        adSetCount: groupRows.length,
      });
    }

    // Sort nodes: best-first by headline metric
    nodes.sort((a, b) => {
      const av = a.headline.value;
      const bv = b.headline.value;
      if (av == null && bv == null) return b.metrics.spend - a.metrics.spend;
      if (av == null) return 1;
      if (bv == null) return -1;
      const lowerIsBetter = a.headline.lowerIsBetter;
      return lowerIsBetter ? av - bv : bv - av;
    });

    return nodes;
  }

  return buildLevel(rows, 0, '');
}

// ─── Scorecard evaluation ────────────────────────────────────────────────────

export interface ScorecardItem {
  label: string;
  target: string;
  currentValue: number | null;
  flag: 'PASS' | 'MISS' | 'PAUSE' | 'N/A';
  baselineValue?: number | null;
}

export function evaluateScorecard(rows: ParsedAdSetRow[], compareBaseline: boolean): ScorecardItem[] {
  const items: ScorecardItem[] = [];

  // TLA CTR >= 7%
  const tlaRows = rows.filter(r => r.parsed.activity_type === 'Thought Leader Ads');
  if (tlaRows.length > 0) {
    const raw = sumRaw(tlaRows.map(r => r.metrics));
    const m = deriveMetrics(raw);
    const bl = compareBaseline ? getBaseline(2, `${tlaRows[0].parsed.business_line}||Engagement||Thought Leader Ads`) : null;
    items.push({
      label: 'TLA CTR ≥ 7%',
      target: '≥ 7%',
      currentValue: m.ctr,
      flag: m.ctr != null ? (m.ctr >= 0.07 ? 'PASS' : 'MISS') : 'N/A',
      baselineValue: bl?.ctr,
    });
  }

  // Page Boosts CTR >= 4%
  const pbRows = rows.filter(r => r.parsed.activity_type === 'Page Boosts');
  if (pbRows.length > 0) {
    const raw = sumRaw(pbRows.map(r => r.metrics));
    const m = deriveMetrics(raw);
    items.push({
      label: 'Page Boosts CTR ≥ 4%',
      target: '≥ 4%',
      currentValue: m.ctr,
      flag: m.ctr != null ? (m.ctr >= 0.04 ? 'PASS' : 'MISS') : 'N/A',
    });
  }

  // Lead Gen CPL <= $50
  const lgRows = rows.filter(r => r.parsed.objective === 'Lead Generation');
  if (lgRows.length > 0) {
    const raw = sumRaw(lgRows.map(r => r.metrics));
    const m = deriveMetrics(raw);
    items.push({
      label: 'Lead Gen CPL ≤ $50',
      target: '≤ $50',
      currentValue: m.cpl,
      flag: m.cpl != null ? (m.cpl <= 50 ? 'PASS' : m.cpl > 100 ? 'PAUSE' : 'MISS') : 'N/A',
    });
  }

  return items;
}
