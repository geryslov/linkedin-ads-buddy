import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CampaignBreakdown {
  campaignId: string;
  campaignName: string;
  objective: string;
  impressions: number;
  clicks: number;
  spend: number;
  leads: number;
}

export interface CompanyInfluenceItem {
  companyUrn: string;
  companyName: string;
  engagementScore: number;
  totalImpressions: number;
  totalClicks: number;
  totalSpend: number;
  totalLeads: number;
  totalFormOpens: number;
  ctr: number;
  cpl: number;
  campaignDepth: number;
  objectiveTypes: string[];
  campaignBreakdown: CampaignBreakdown[];
}

export interface CompanyInfluenceSummary {
  totalCompanies: number;
  companiesEngaged: number;
  companiesConverted: number;
  totalImpressions: number;
  totalClicks: number;
  totalSpend: number;
  totalLeads: number;
}

export interface ObjectiveBreakdown {
  objective: string;
  companies: number;
  impressions: number;
  clicks: number;
  leads: number;
}

export interface CompanyInfluenceData {
  period: {
    start: string;
    end: string;
  };
  summary: CompanyInfluenceSummary;
  companies: CompanyInfluenceItem[];
  objectiveBreakdown: ObjectiveBreakdown[];
  metadata: {
    accountId: string;
    impressionThreshold: number;
    totalCampaignsAnalyzed: number;
  };
}

export interface TimeFrameOption {
  label: string;
  value: string;
  startDate: Date;
  endDate: Date;
}

export function useCompanyInfluence(accessToken: string | null) {
  const [data, setData] = useState<CompanyInfluenceData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set());
  const [objectiveFilter, setObjectiveFilter] = useState<string>('all');
  const [minImpressions, setMinImpressions] = useState<number>(100);
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

  const fetchCompanyInfluence = useCallback(async (accountId: string) => {
    if (!accessToken || !accountId) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data: result, error: fnError } = await supabase.functions.invoke('linkedin-api', {
        body: {
          action: 'get_company_influence',
          accessToken,
          params: { accountId, dateRange, minImpressions }
        }
      });

      if (fnError) {
        setError(fnError.message || 'Failed to fetch company influence data');
        return;
      }

      if (result?.error) {
        setError(result.error);
        return;
      }

      setData(result);
    } catch (err) {
      setError('Failed to fetch company influence data');
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

  const toggleCompanyExpanded = useCallback((companyUrn: string) => {
    setExpandedCompanies(prev => {
      const next = new Set(prev);
      if (next.has(companyUrn)) {
        next.delete(companyUrn);
      } else {
        next.add(companyUrn);
      }
      return next;
    });
  }, []);

  const filteredCompanies = useMemo(() => {
    if (!data?.companies) return [];
    if (objectiveFilter === 'all') return data.companies;
    return data.companies.filter(c => c.objectiveTypes.includes(objectiveFilter));
  }, [data?.companies, objectiveFilter]);

  const availableObjectives = useMemo(() => {
    if (!data?.objectiveBreakdown) return [];
    return data.objectiveBreakdown.map(o => o.objective);
  }, [data?.objectiveBreakdown]);

  // Engagement tiers
  const engagementTiers = useMemo(() => {
    if (!data?.companies) return { hot: [], warm: [], cold: [] };

    const sorted = [...data.companies].sort((a, b) => b.engagementScore - a.engagementScore);
    const hotThreshold = sorted[Math.floor(sorted.length * 0.1)]?.engagementScore || Infinity;
    const warmThreshold = sorted[Math.floor(sorted.length * 0.3)]?.engagementScore || 0;

    return {
      hot: sorted.filter(c => c.engagementScore >= hotThreshold && c.totalLeads > 0),
      warm: sorted.filter(c => c.engagementScore >= warmThreshold && c.engagementScore < hotThreshold),
      cold: sorted.filter(c => c.engagementScore < warmThreshold),
    };
  }, [data?.companies]);

  return {
    data,
    isLoading,
    error,
    fetchCompanyInfluence,
    dateRange,
    setDateRange,
    timeFrameOptions,
    setTimeFrame,
    expandedCompanies,
    toggleCompanyExpanded,
    objectiveFilter,
    setObjectiveFilter,
    filteredCompanies,
    availableObjectives,
    minImpressions,
    setMinImpressions,
    engagementTiers,
  };
}
