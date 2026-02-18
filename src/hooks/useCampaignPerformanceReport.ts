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

export interface AdBreakdown {
  creativeId: string;
  adName: string;
  adStatus: string;
  last7d: PeriodMetrics;
  last14d: PeriodMetrics;
  last30d: PeriodMetrics;
  lastMonth: PeriodMetrics;
}

export interface CampaignPerformanceRow {
  campaignId: string;
  campaignName: string;
  campaignStatus: string;
  objectiveType: string;
  adCount: number;
  ads: AdBreakdown[];
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

export function useCampaignPerformanceReport(accessToken: string | null) {
  const [data, setData] = useState<CampaignPerformanceRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async (accountId: string) => {
    if (!accessToken || !accountId) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await supabase.functions.invoke('linkedin-api', {
        body: {
          action: 'get_campaign_performance_report',
          accessToken,
          params: { accountId, dateRanges: getDateRanges() },
        },
      });

      if (res.error || res.data?.error) {
        setError(res.data?.error || 'Failed to fetch campaign performance report');
        return;
      }

      const elements = res.data?.elements || [];

      const rows: CampaignPerformanceRow[] = elements.map((el: any) => {
        const ads: AdBreakdown[] = (el.ads || []).map((ad: any) => ({
          creativeId: ad.creativeId,
          adName: ad.name || `Ad ${ad.creativeId}`,
          adStatus: ad.status || 'UNKNOWN',
          last7d: toMetrics(ad.periods?.['last7d']),
          last14d: toMetrics(ad.periods?.['last14d']),
          last30d: toMetrics(ad.periods?.['last30d']),
          lastMonth: toMetrics(ad.periods?.['lastMonth']),
        }));

        return {
          campaignId: el.campaignId,
          campaignName: el.campaignName || `Campaign ${el.campaignId}`,
          campaignStatus: el.campaignStatus || 'UNKNOWN',
          objectiveType: el.objectiveType || 'UNKNOWN',
          adCount: ads.length,
          ads,
          last7d: toMetrics(el.periods?.['last7d']),
          last14d: toMetrics(el.periods?.['last14d']),
          last30d: toMetrics(el.periods?.['last30d']),
          lastMonth: toMetrics(el.periods?.['lastMonth']),
        };
      });

      setData(rows);
    } catch (err) {
      console.error('Campaign performance report error:', err);
      setError('Failed to fetch campaign performance report');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  return { data, isLoading, error, fetchReport };
}
