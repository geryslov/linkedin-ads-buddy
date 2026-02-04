import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CompanyEngagementItem {
  companyUrn: string;
  companyName: string;
  engagementScore: number;
  impressions: number;
  clicks: number;
  spend: number;
  leads: number;
  formOpens: number;
  ctr: number;
  cpc: number;
  cpm: number;
  cpl: number;
}

export interface CompanyEngagementSummary {
  totalCompanies: number;
  companiesEngaged: number;
  companiesConverted: number;
  totalImpressions: number;
  totalClicks: number;
  totalSpend: number;
  totalLeads: number;
  avgCtr: number;
  avgCpc: number;
}

export interface EngagementTiers {
  hot: number;
  warm: number;
  cold: number;
}

export interface CompanyEngagementReportData {
  period: {
    start: string;
    end: string;
  };
  summary: CompanyEngagementSummary;
  engagementTiers: EngagementTiers;
  companies: CompanyEngagementItem[];
  metadata: {
    accountId: string;
    impressionThreshold: number;
    totalCampaignsAnalyzed: number;
    namesResolved: number;
    namesUnresolved: number;
  };
}

export interface TimeFrameOption {
  label: string;
  value: string;
  startDate: Date;
  endDate: Date;
}

export function useCompanyEngagementReport(accessToken: string | null) {
  const [data, setData] = useState<CompanyEngagementReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [minImpressions, setMinImpressions] = useState<number>(100);
  const [sortField, setSortField] = useState<keyof CompanyEngagementItem>('engagementScore');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
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

  const fetchReport = useCallback(async (accountId: string, customMinImpressions?: number) => {
    if (!accessToken || !accountId) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data: result, error: fnError } = await supabase.functions.invoke('linkedin-api', {
        body: {
          action: 'get_company_engagement_report',
          accessToken,
          params: { accountId, dateRange, minImpressions: customMinImpressions ?? minImpressions }
        }
      });

      if (fnError) {
        setError(fnError.message || 'Failed to fetch report');
        return;
      }

      if (result?.error) {
        setError(result.error);
        return;
      }

      setData(result);
    } catch (err) {
      setError('Failed to fetch report');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, dateRange, minImpressions]);

  const setTimeFrame = useCallback((option: TimeFrameOption) => {
    const formatDate = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    setDateRange({
      start: formatDate(option.startDate),
      end: formatDate(option.endDate)
    });
  }, []);

  const handleSort = useCallback((field: keyof CompanyEngagementItem) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  }, [sortField]);

  // Filter and sort companies
  const filteredCompanies = useMemo(() => {
    if (!data?.companies) return [];

    let filtered = data.companies;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.companyName.toLowerCase().includes(query) ||
        c.companyUrn.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    return [...filtered].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      const aNum = aVal as number;
      const bNum = bVal as number;
      return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
    });
  }, [data?.companies, searchQuery, sortField, sortDirection]);

  // Engagement tier companies
  const tierCompanies = useMemo(() => {
    if (!data?.companies) return { hot: [], warm: [], cold: [] };

    const sortedByScore = [...data.companies].sort((a, b) => b.engagementScore - a.engagementScore);
    const hotThreshold = sortedByScore[Math.floor(sortedByScore.length * 0.1)]?.engagementScore || Infinity;
    const warmThreshold = sortedByScore[Math.floor(sortedByScore.length * 0.3)]?.engagementScore || 0;

    return {
      hot: data.companies.filter(c => c.engagementScore >= hotThreshold && c.leads > 0),
      warm: data.companies.filter(c => c.engagementScore >= warmThreshold && c.engagementScore < hotThreshold),
      cold: data.companies.filter(c => c.engagementScore < warmThreshold),
    };
  }, [data?.companies]);

  return {
    data,
    isLoading,
    error,
    fetchReport,
    dateRange,
    setDateRange,
    timeFrameOptions,
    setTimeFrame,
    searchQuery,
    setSearchQuery,
    minImpressions,
    setMinImpressions,
    sortField,
    sortDirection,
    handleSort,
    filteredCompanies,
    tierCompanies,
  };
}
