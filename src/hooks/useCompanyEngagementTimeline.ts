import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DailyAggregate {
  date: string;
  impressions: number;
  clicks: number;
  spend: number;
  leads: number;
  companyCount: number;
  ctr: number;
}

export interface CompanyDayData {
  date: string;
  impressions: number;
  clicks: number;
  spend: number;
  leads: number;
}

export interface CompanyTimeline {
  companyUrn: string;
  companyName: string;
  totals: {
    impressions: number;
    clicks: number;
    spend: number;
    leads: number;
    ctr: number;
  };
  timeline: CompanyDayData[];
}

export interface CompanyEngagementTimelineData {
  summary: {
    totalCompanies: number;
    totalImpressions: number;
    totalClicks: number;
    totalSpend: number;
    totalLeads: number;
    dateRange: {
      start: string;
      end: string;
    };
    daysInRange: number;
  };
  dailyAggregates: DailyAggregate[];
  topCompanies: CompanyTimeline[];
  metadata: {
    accountId: string;
    companiesResolved: number;
    namesResolutionFailed?: boolean;
    namesResolutionError?: string;
  };
}

export interface TimeFrameOption {
  label: string;
  value: string;
  startDate: Date;
  endDate: Date;
}

export function useCompanyEngagementTimeline(accessToken: string | null) {
  const [data, setData] = useState<CompanyEngagementTimelineData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const formatDate = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { start: formatDate(start), end: formatDate(now) };
  });

  const timeFrameOptions: TimeFrameOption[] = useMemo(() => {
    const now = new Date();
    return [
      { label: 'Last 7 Days', value: 'last_7_days', startDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), endDate: now },
      { label: 'Last 14 Days', value: 'last_14_days', startDate: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000), endDate: now },
      { label: 'Last 30 Days', value: 'last_30_days', startDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), endDate: now },
      { label: 'Last 60 Days', value: 'last_60_days', startDate: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000), endDate: now },
      { label: 'Last 90 Days', value: 'last_90_days', startDate: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), endDate: now },
      { label: 'This Month', value: 'this_month', startDate: new Date(now.getFullYear(), now.getMonth(), 1), endDate: now },
      { label: 'Last Month', value: 'last_month', startDate: new Date(now.getFullYear(), now.getMonth() - 1, 1), endDate: new Date(now.getFullYear(), now.getMonth(), 0) },
    ];
  }, []);

  const fetchTimeline = useCallback(async (accountId: string) => {
    if (!accessToken || !accountId) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data: result, error: fnError } = await supabase.functions.invoke('linkedin-api', {
        body: {
          action: 'get_company_engagement_timeline',
          accessToken,
          params: { accountId, dateRange }
        }
      });

      if (fnError) {
        setError(fnError.message || 'Failed to fetch timeline data');
        return;
      }

      if (result?.error) {
        setError(result.error);
        return;
      }

      setData(result);

      // Auto-select top 5 companies for chart display
      if (result?.topCompanies?.length > 0) {
        setSelectedCompanies(new Set(result.topCompanies.slice(0, 5).map((c: CompanyTimeline) => c.companyUrn)));
      }
    } catch (err) {
      setError('Failed to fetch timeline data');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, dateRange]);

  const setTimeFrame = useCallback((option: TimeFrameOption) => {
    const formatDate = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    setDateRange({
      start: formatDate(option.startDate),
      end: formatDate(option.endDate)
    });
  }, []);

  const toggleCompanySelection = useCallback((companyUrn: string) => {
    setSelectedCompanies(prev => {
      const next = new Set(prev);
      if (next.has(companyUrn)) {
        next.delete(companyUrn);
      } else {
        next.add(companyUrn);
      }
      return next;
    });
  }, []);

  const selectAllCompanies = useCallback(() => {
    if (data?.topCompanies) {
      setSelectedCompanies(new Set(data.topCompanies.map(c => c.companyUrn)));
    }
  }, [data?.topCompanies]);

  const clearSelection = useCallback(() => {
    setSelectedCompanies(new Set());
  }, []);

  // Filter selected companies for chart
  const chartCompanies = useMemo(() => {
    if (!data?.topCompanies) return [];
    return data.topCompanies.filter(c => selectedCompanies.has(c.companyUrn));
  }, [data?.topCompanies, selectedCompanies]);

  // Chart data formatted for Recharts
  const chartData = useMemo(() => {
    if (!data?.dailyAggregates) return [];

    return data.dailyAggregates.map(day => {
      const row: any = {
        date: day.date,
        totalImpressions: day.impressions,
        totalClicks: day.clicks,
        totalLeads: day.leads,
        totalSpend: day.spend,
        companyCount: day.companyCount,
      };

      // Add each selected company's data
      chartCompanies.forEach(company => {
        const dayData = company.timeline.find(t => t.date === day.date);
        row[`${company.companyName}_impressions`] = dayData?.impressions || 0;
        row[`${company.companyName}_clicks`] = dayData?.clicks || 0;
        row[`${company.companyName}_leads`] = dayData?.leads || 0;
      });

      return row;
    });
  }, [data?.dailyAggregates, chartCompanies]);

  return {
    data,
    isLoading,
    error,
    fetchTimeline,
    dateRange,
    setDateRange,
    timeFrameOptions,
    setTimeFrame,
    selectedCompanies,
    toggleCompanySelection,
    selectAllCompanies,
    clearSelection,
    chartCompanies,
    chartData,
  };
}
