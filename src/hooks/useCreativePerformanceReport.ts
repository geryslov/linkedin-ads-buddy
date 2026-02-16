import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PeriodMetrics {
  impressions: number;
  clicks: number;
  spent: number;
  leads: number;
  ctr: number;
  cpl: number;
}

export interface CreativePerformanceRow {
  creativeName: string;
  imageUrl?: string;
  type: string;
  campaignCount: number;
  last7d: PeriodMetrics;
  last14d: PeriodMetrics;
  last30d: PeriodMetrics;
  lastMonth: PeriodMetrics;
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDateRanges() {
  const now = new Date();
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  return {
    last7d: { start: formatDate(new Date(now.getTime() - 7 * 86400000)), end: formatDate(now) },
    last14d: { start: formatDate(new Date(now.getTime() - 14 * 86400000)), end: formatDate(now) },
    last30d: { start: formatDate(new Date(now.getTime() - 30 * 86400000)), end: formatDate(now) },
    lastMonth: { start: formatDate(lastMonthStart), end: formatDate(lastMonthEnd) },
  };
}

function aggregateByName(elements: any[]): Map<string, { impressions: number; clicks: number; spent: number; leads: number; imageUrl?: string; type: string; campaignNames: Set<string> }> {
  const map = new Map<string, any>();
  for (const item of elements) {
    const name = item.creativeName || `Creative ${item.creativeId}`;
    const impressions = item.impressions || 0;
    const spent = parseFloat(item.costInLocalCurrency || item.spent || '0');
    if (impressions === 0 && spent === 0) continue;

    const existing = map.get(name);
    if (existing) {
      existing.impressions += impressions;
      existing.clicks += (item.clicks || 0);
      existing.spent += spent;
      existing.leads += (item.leads || 0);
      existing.campaignNames.add(item.campaignName || '');
    } else {
      map.set(name, {
        impressions,
        clicks: item.clicks || 0,
        spent,
        leads: item.leads || 0,
        imageUrl: item.imageUrl || undefined,
        type: item.type || 'UNKNOWN',
        campaignNames: new Set([item.campaignName || '']),
      });
    }
  }
  return map;
}

function toMetrics(agg: { impressions: number; clicks: number; spent: number; leads: number } | undefined): PeriodMetrics {
  if (!agg) return { impressions: 0, clicks: 0, spent: 0, leads: 0, ctr: 0, cpl: 0 };
  return {
    impressions: agg.impressions,
    clicks: agg.clicks,
    spent: agg.spent,
    leads: agg.leads,
    ctr: agg.impressions > 0 ? (agg.clicks / agg.impressions) * 100 : 0,
    cpl: agg.leads > 0 ? agg.spent / agg.leads : 0,
  };
}

export function useCreativePerformanceReport(accessToken: string | null) {
  const [data, setData] = useState<CreativePerformanceRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async (accountId: string) => {
    if (!accessToken || !accountId) return;
    setIsLoading(true);
    setError(null);

    try {
      const ranges = getDateRanges();
      const keys = ['last7d', 'last14d', 'last30d', 'lastMonth'] as const;

      const results = await Promise.all(
        keys.map(key =>
          supabase.functions.invoke('linkedin-api', {
            body: {
              action: 'get_creative_names_report',
              accessToken,
              params: {
                accountId,
                dateRange: ranges[key],
                timeGranularity: 'ALL',
              },
            },
          })
        )
      );

      // Aggregate each period
      const aggregated = keys.map((_, i) => {
        const res = results[i];
        if (res.error || res.data?.error) return new Map();
        return aggregateByName(res.data?.elements || []);
      });

      // Merge into unified rows
      const allNames = new Set<string>();
      aggregated.forEach(m => m.forEach((_, k) => allNames.add(k)));

      const rows: CreativePerformanceRow[] = [];
      allNames.forEach(name => {
        const d7 = aggregated[0].get(name);
        const d14 = aggregated[1].get(name);
        const d30 = aggregated[2].get(name);
        const lm = aggregated[3].get(name);

        // Find best image/type from any period
        const ref = d30 || d14 || d7 || lm;
        const allCampaigns = new Set<string>();
        [d7, d14, d30, lm].forEach(a => a?.campaignNames?.forEach((c: string) => allCampaigns.add(c)));

        rows.push({
          creativeName: name,
          imageUrl: ref?.imageUrl,
          type: ref?.type || 'UNKNOWN',
          campaignCount: allCampaigns.size,
          last7d: toMetrics(d7),
          last14d: toMetrics(d14),
          last30d: toMetrics(d30),
          lastMonth: toMetrics(lm),
        });
      });

      setData(rows);
    } catch (err) {
      console.error('Creative performance report error:', err);
      setError('Failed to fetch creative performance report');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  return { data, isLoading, error, fetchReport };
}
