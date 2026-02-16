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

  return [
    { key: 'last7d', start: formatDate(new Date(now.getTime() - 7 * 86400000)), end: formatDate(now) },
    { key: 'last14d', start: formatDate(new Date(now.getTime() - 14 * 86400000)), end: formatDate(now) },
    { key: 'last30d', start: formatDate(new Date(now.getTime() - 30 * 86400000)), end: formatDate(now) },
    { key: 'lastMonth', start: formatDate(lastMonthStart), end: formatDate(lastMonthEnd) },
  ];
}

function toMetrics(p: { impressions: number; clicks: number; spent: number; leads: number } | undefined): PeriodMetrics {
  if (!p) return { impressions: 0, clicks: 0, spent: 0, leads: 0, ctr: 0, cpl: 0 };
  return {
    impressions: p.impressions,
    clicks: p.clicks,
    spent: p.spent,
    leads: p.leads,
    ctr: p.impressions > 0 ? (p.clicks / p.impressions) * 100 : 0,
    cpl: p.leads > 0 ? p.spent / p.leads : 0,
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
      const res = await supabase.functions.invoke('linkedin-api', {
        body: {
          action: 'get_creative_performance_report',
          accessToken,
          params: { accountId, dateRanges: getDateRanges() },
        },
      });

      if (res.error || res.data?.error) {
        setError(res.data?.error || 'Failed to fetch report');
        return;
      }

      const elements = res.data?.elements || [];

      // Aggregate by creativeName across campaigns
      const byName = new Map<string, { imageUrl?: string; type: string; campaignNames: Set<string>; periods: Record<string, { impressions: number; clicks: number; spent: number; leads: number }> }>();

      for (const el of elements) {
        const name = el.creativeName || `Creative ${el.creativeId}`;
        const existing = byName.get(name);
        if (existing) {
          existing.campaignNames.add(el.campaignName || '');
          for (const [key, pd] of Object.entries(el.periods || {})) {
            const p = pd as any;
            const ex = existing.periods[key] || { impressions: 0, clicks: 0, spent: 0, leads: 0 };
            ex.impressions += p.impressions || 0;
            ex.clicks += p.clicks || 0;
            ex.spent += parseFloat(p.costInLocalCurrency || p.spent || '0');
            ex.leads += p.leads || 0;
            existing.periods[key] = ex;
          }
        } else {
          const periods: Record<string, any> = {};
          for (const [key, pd] of Object.entries(el.periods || {})) {
            const p = pd as any;
            periods[key] = { impressions: p.impressions || 0, clicks: p.clicks || 0, spent: parseFloat(p.costInLocalCurrency || p.spent || '0'), leads: p.leads || 0 };
          }
          byName.set(name, { imageUrl: el.imageUrl, type: el.type || 'UNKNOWN', campaignNames: new Set([el.campaignName || '']), periods });
        }
      }

      const rows: CreativePerformanceRow[] = [];
      byName.forEach((v, name) => {
        rows.push({
          creativeName: name,
          imageUrl: v.imageUrl,
          type: v.type,
          campaignCount: v.campaignNames.size,
          last7d: toMetrics(v.periods['last7d']),
          last14d: toMetrics(v.periods['last14d']),
          last30d: toMetrics(v.periods['last30d']),
          lastMonth: toMetrics(v.periods['lastMonth']),
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
