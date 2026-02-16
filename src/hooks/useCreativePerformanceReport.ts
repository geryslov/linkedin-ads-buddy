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

export interface CampaignBreakdown {
  campaignName: string;
  campaignStatus: string;
  last7d: PeriodMetrics;
  last14d: PeriodMetrics;
  last30d: PeriodMetrics;
  lastMonth: PeriodMetrics;
}

export interface CreativePerformanceRow {
  creativeName: string;
  imageUrl?: string;
  type: string;
  campaignCount: number;
  campaigns: CampaignBreakdown[];
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

const PERIOD_KEYS = ['last7d', 'last14d', 'last30d', 'lastMonth'] as const;

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

      // Aggregate by creativeName, preserving per-campaign breakdown
      const byName = new Map<string, {
        imageUrl?: string;
        type: string;
        campaigns: Map<string, { campaignName: string; campaignStatus: string; periods: Record<string, { impressions: number; clicks: number; spent: number; leads: number }> }>;
        totals: Record<string, { impressions: number; clicks: number; spent: number; leads: number }>;
      }>();

      for (const el of elements) {
        const name = el.creativeName || `Creative ${el.creativeId}`;
        const campKey = el.campaignName || 'Unknown';

        if (!byName.has(name)) {
          byName.set(name, { imageUrl: el.imageUrl, type: el.type || 'UNKNOWN', campaigns: new Map(), totals: {} });
        }
        const entry = byName.get(name)!;

        // Ensure campaign entry
        if (!entry.campaigns.has(campKey)) {
          entry.campaigns.set(campKey, { campaignName: campKey, campaignStatus: el.campaignStatus || 'UNKNOWN', periods: {} });
        }
        const camp = entry.campaigns.get(campKey)!;

        // Add metrics per period
        for (const [key, pd] of Object.entries(el.periods || {})) {
          const p = pd as any;
          const spent = parseFloat(p.costInLocalCurrency || p.spent || '0');
          // Campaign level
          const ce = camp.periods[key] || { impressions: 0, clicks: 0, spent: 0, leads: 0 };
          ce.impressions += p.impressions || 0;
          ce.clicks += p.clicks || 0;
          ce.spent += spent;
          ce.leads += p.leads || 0;
          camp.periods[key] = ce;
          // Total level
          const te = entry.totals[key] || { impressions: 0, clicks: 0, spent: 0, leads: 0 };
          te.impressions += p.impressions || 0;
          te.clicks += p.clicks || 0;
          te.spent += spent;
          te.leads += p.leads || 0;
          entry.totals[key] = te;
        }
      }

      const rows: CreativePerformanceRow[] = [];
      byName.forEach((v, name) => {
        const campaigns: CampaignBreakdown[] = [];
        v.campaigns.forEach(c => {
          campaigns.push({
            campaignName: c.campaignName,
            campaignStatus: c.campaignStatus,
            last7d: toMetrics(c.periods['last7d']),
            last14d: toMetrics(c.periods['last14d']),
            last30d: toMetrics(c.periods['last30d']),
            lastMonth: toMetrics(c.periods['lastMonth']),
          });
        });
        rows.push({
          creativeName: name,
          imageUrl: v.imageUrl,
          type: v.type,
          campaignCount: campaigns.length,
          campaigns,
          last7d: toMetrics(v.totals['last7d']),
          last14d: toMetrics(v.totals['last14d']),
          last30d: toMetrics(v.totals['last30d']),
          lastMonth: toMetrics(v.totals['lastMonth']),
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
