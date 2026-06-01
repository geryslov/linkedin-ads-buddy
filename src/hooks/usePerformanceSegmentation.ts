import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { parseAdSetName } from '@/lib/adSetParser';
import { buildSegmentationTree, evaluateScorecard, deriveMetrics } from '@/lib/segmentationAggregator';
import type { ParsedAdSetRow, SegmentNode, ScorecardItem, DerivedMetrics } from '@/lib/segmentationAggregator';

export interface FlatRow extends ParsedAdSetRow {
  derived: DerivedMetrics;
}

export function usePerformanceSegmentation(accessToken: string | null) {
  const [tree, setTree] = useState<SegmentNode[]>([]);
  const [flatRows, setFlatRows] = useState<FlatRow[]>([]);
  const [scorecard, setScorecard] = useState<ScorecardItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [compareBaseline, setCompareBaseline] = useState(true);

  const fetchReport = useCallback(async (accountId: string, startDate: string, endDate: string) => {
    if (!accessToken || !accountId) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await supabase.functions.invoke('linkedin-api', {
        body: {
          action: 'get_campaign_performance_report',
          accessToken,
          params: {
            accountId,
            dateRanges: [{ key: 'period', start: startDate, end: endDate }],
          },
        },
      });

      if (res.error) {
        const ctx = (res.error as any).context;
        const msg = ctx?.error || res.error.message || 'Failed to fetch campaign data';
        throw new Error(msg);
      }

      const elements = res.data?.elements || [];

      // Parse each campaign
      const rows: ParsedAdSetRow[] = [];
      for (const el of elements) {
        const name = el.campaignName || '';
        const objective = el.objectiveType || '';
        const parsed = parseAdSetName(name, objective);

        const period = el.periods?.period || {};
        const spend = parseFloat(period.costInLocalCurrency || period.spent || '0');

        rows.push({
          parsed,
          metrics: {
            spend,
            impressions: period.impressions || 0,
            clicks: period.clicks || 0,
            engagements: period.engagements || (period.clicks || 0),
            leads: period.leads || 0,
            video_views: period.videoViews || 0,
            follows: period.follows || 0,
            clicks_to_lp: period.clicksToLandingPage || 0,
          },
          campaignName: name,
          campaignId: el.campaignId || '',
          status: el.campaignStatus || 'UNKNOWN',
          ads: (el.ads || []).map((ad: any) => {
            const ap = ad.periods?.period || {};
            return {
              name: ad.name || `Ad ${ad.creativeId}`,
              headline: ad.headline,
              metrics: {
                spend: parseFloat(ap.costInLocalCurrency || ap.spent || '0'),
                impressions: ap.impressions || 0,
                clicks: ap.clicks || 0,
                engagements: ap.engagements || (ap.clicks || 0),
                leads: ap.leads || 0,
                video_views: ap.videoViews || 0,
                follows: ap.follows || 0,
                clicks_to_lp: ap.clicksToLandingPage || 0,
              },
            };
          }),
        });
      }

      // Build tree
      const segTree = buildSegmentationTree(rows, compareBaseline);
      setTree(segTree);

      // Build flat rows with derived metrics
      const flat: FlatRow[] = rows.map(r => ({ ...r, derived: deriveMetrics(r.metrics) }));
      flat.sort((a, b) => b.metrics.spend - a.metrics.spend);
      setFlatRows(flat);

      // Evaluate scorecard
      setScorecard(evaluateScorecard(rows, compareBaseline));
    } catch (err) {
      console.error('[usePerformanceSegmentation] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load segmentation data');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, compareBaseline]);

  return {
    tree, flatRows, scorecard,
    isLoading, error,
    compareBaseline, setCompareBaseline,
    fetchReport,
  };
}
