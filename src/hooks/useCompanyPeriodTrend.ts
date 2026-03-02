import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CompanyPeriodMetrics {
  impressions: number;
  clicks: number;
  spent: number;
  leads: number;
  engagements: number;
}

export interface PeriodAggregate {
  key: string;
  totals: CompanyPeriodMetrics & { companyCount: number };
}

export interface CompanyPeriodTrendData {
  /** Per-company metrics keyed by entityUrn, for each period */
  periods: Map<string, Map<string, CompanyPeriodMetrics>>;
  /** Aggregate totals per period */
  aggregates: PeriodAggregate[];
}

const TREND_PERIODS = [
  { key: '7d', label: 'Last 7 Days', days: 7 },
  { key: '30d', label: 'Last 30 Days', days: 30 },
  { key: '90d', label: 'Last 90 Days', days: 90 },
];

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function useCompanyPeriodTrend(accessToken: string | null) {
  const [data, setData] = useState<CompanyPeriodTrendData>({ periods: new Map(), aggregates: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTrend = useCallback(async (accountId: string) => {
    if (!accessToken || !accountId) return;
    setIsLoading(true);
    setError(null);

    const now = new Date();
    const dateRanges = TREND_PERIODS.map(p => ({
      key: p.key,
      start: formatDate(new Date(now.getTime() - p.days * 86400000)),
      end: formatDate(now),
    }));

    try {
      const res = await supabase.functions.invoke('linkedin-api', {
        body: {
          action: 'get_company_multi_period_analytics',
          accessToken,
          params: { accountId, dateRanges },
        },
      });

      if (res.error) {
        // Non-fatal: trend data is supplementary, don't block the main report
        console.warn('Multi-period analytics fetch error (non-fatal):', res.error);
        setError(null);
        return;
      }

      if (res.data?.error) {
        console.warn('Multi-period analytics data error (non-fatal):', res.data.error);
        setError(null);
        return;
      }

      const periodsMap = new Map<string, Map<string, CompanyPeriodMetrics>>();
      for (const period of (res.data?.periods || [])) {
        const companyMap = new Map<string, CompanyPeriodMetrics>();
        for (const [urn, metrics] of Object.entries(period.companies || {})) {
          const m = metrics as CompanyPeriodMetrics;
          companyMap.set(urn, {
            impressions: m.impressions || 0,
            clicks: m.clicks || 0,
            spent: m.spent || 0,
            leads: m.leads || 0,
            engagements: m.engagements || 0,
          });
        }
        periodsMap.set(period.key, companyMap);
      }

      const aggregates: PeriodAggregate[] = (res.data?.aggregates || []).map((a: any) => ({
        key: a.key,
        totals: {
          impressions: a.totals?.impressions || 0,
          clicks: a.totals?.clicks || 0,
          spent: a.totals?.spent || 0,
          leads: a.totals?.leads || 0,
          engagements: a.totals?.engagements || 0,
          companyCount: a.totals?.companyCount || 0,
        },
      }));

      setData({ periods: periodsMap, aggregates });
    } catch (err: any) {
      // Non-fatal: trend data is supplementary
      console.warn('Multi-period analytics error (non-fatal):', err);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  /** Get metrics for a specific company across all periods */
  const getCompanyTrend = useCallback((entityUrn: string) => {
    return TREND_PERIODS.map(p => ({
      period: p.key,
      label: p.label,
      metrics: data.periods.get(p.key)?.get(entityUrn) || null,
    }));
  }, [data.periods]);

  /** Get matched-only aggregate totals: for each period, sum metrics of only the matched entityUrns */
  const getMatchedAggregateTrend = useCallback((matchedUrns: string[]) => {
    const urnSet = new Set(matchedUrns);
    return TREND_PERIODS.map(p => {
      const periodMap = data.periods.get(p.key);
      const totals: CompanyPeriodMetrics & { companyCount: number } = {
        impressions: 0, clicks: 0, spent: 0, leads: 0, engagements: 0, companyCount: 0,
      };
      if (periodMap) {
        for (const urn of urnSet) {
          const m = periodMap.get(urn);
          if (m) {
            totals.impressions += m.impressions;
            totals.clicks += m.clicks;
            totals.spent += m.spent;
            totals.leads += m.leads;
            totals.engagements += m.engagements;
            totals.companyCount++;
          }
        }
      }
      return { period: p.key, label: p.label, totals };
    });
  }, [data.periods]);

  return { data, isLoading, error, fetchTrend, getCompanyTrend, getMatchedAggregateTrend, TREND_PERIODS };
}
