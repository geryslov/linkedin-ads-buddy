import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface DemographicItem {
  entityUrn: string;
  entityName: string;
  impressions: number;
  clicks: number;
  spent: number;
  leads: number;
  ctr: number;
  cpc: number;
  cpm: number;
}

export type TimeGranularity = 'DAILY' | 'MONTHLY' | 'ALL';

export type DemographicPivot = 
  | 'MEMBER_COMPANY' 
  | 'MEMBER_JOB_TITLE' 
  | 'MEMBER_JOB_FUNCTION' 
  | 'MEMBER_INDUSTRY' 
  | 'MEMBER_SENIORITY' 
  | 'MEMBER_COUNTRY';

export const DEMOGRAPHIC_PIVOT_OPTIONS: { value: DemographicPivot; label: string }[] = [
  { value: 'MEMBER_COMPANY', label: 'Company' },
  { value: 'MEMBER_JOB_TITLE', label: 'Job Title' },
  { value: 'MEMBER_JOB_FUNCTION', label: 'Job Function' },
  { value: 'MEMBER_INDUSTRY', label: 'Industry' },
  { value: 'MEMBER_SENIORITY', label: 'Seniority' },
  { value: 'MEMBER_COUNTRY', label: 'Country' },
];

export interface TimeFrameOption {
  label: string;
  value: string;
  startDate: Date;
  endDate: Date;
}

export function useDemographicReporting(accessToken: string | null) {
  const [demographicData, setDemographicData] = useState<DemographicItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeGranularity, setTimeGranularity] = useState<TimeGranularity>('ALL');
  const [pivot, setPivot] = useState<DemographicPivot>('MEMBER_COMPANY');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const { toast } = useToast();

  const timeFrameOptions: TimeFrameOption[] = useMemo(() => {
    const today = new Date();
    return [
      {
        label: 'Last 7 days',
        value: '7d',
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: today,
      },
      {
        label: 'Last 14 days',
        value: '14d',
        startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        endDate: today,
      },
      {
        label: 'Last 30 days',
        value: '30d',
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: today,
      },
      {
        label: 'Last 90 days',
        value: '90d',
        startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        endDate: today,
      },
      {
        label: 'This month',
        value: 'this_month',
        startDate: new Date(today.getFullYear(), today.getMonth(), 1),
        endDate: today,
      },
      {
        label: 'Last month',
        value: 'last_month',
        startDate: new Date(today.getFullYear(), today.getMonth() - 1, 1),
        endDate: new Date(today.getFullYear(), today.getMonth(), 0),
      },
    ];
  }, []);

  const fetchDemographicAnalytics = useCallback(async (accountId: string) => {
    if (!accessToken || !accountId) return;
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('Fetching demographic analytics with params:', { accountId, dateRange, timeGranularity, pivot });
      
      const { data, error: fetchError } = await supabase.functions.invoke('linkedin-api', {
        body: { 
          action: 'get_demographic_analytics', 
          accessToken,
          params: { 
            accountId, 
            dateRange,
            timeGranularity,
            pivot,
          }
        }
      });

      if (fetchError) throw fetchError;
      
      // Check for API-level errors
      if (data.error) {
        setError(data.error);
        setDemographicData([]);
        return;
      }
      
      console.log('Demographic analytics response:', data);
      
      // Map API response to DemographicItem interface
      const demographicsData: DemographicItem[] = (data.elements || []).map((el: any) => ({
        entityUrn: el.entityUrn || '',
        entityName: el.entityName || 'Unknown',
        impressions: el.impressions || 0,
        clicks: el.clicks || 0,
        spent: parseFloat(el.costInLocalCurrency || '0'),
        leads: el.leads || 0,
        ctr: parseFloat(el.ctr || '0'),
        cpc: parseFloat(el.cpc || '0'),
        cpm: parseFloat(el.cpm || '0'),
      }));
      
      setDemographicData(demographicsData);
    } catch (err: any) {
      console.error('Fetch demographic analytics error:', err);
      setError(err.message || 'Failed to fetch demographic analytics');
      toast({
        title: 'Error',
        description: err.message || 'Failed to fetch demographic analytics',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, dateRange, timeGranularity, pivot, toast]);

  // Calculate totals
  const totals = useMemo(() => {
    return demographicData.reduce(
      (acc, item) => ({
        impressions: acc.impressions + item.impressions,
        clicks: acc.clicks + item.clicks,
        spent: acc.spent + item.spent,
        leads: acc.leads + item.leads,
      }),
      { impressions: 0, clicks: 0, spent: 0, leads: 0 }
    );
  }, [demographicData]);

  const setTimeFrame = useCallback((option: TimeFrameOption) => {
    setDateRange({
      start: option.startDate.toISOString().split('T')[0],
      end: option.endDate.toISOString().split('T')[0],
    });
  }, []);

  return {
    demographicData,
    isLoading,
    error,
    totals,
    timeGranularity,
    setTimeGranularity,
    pivot,
    setPivot,
    dateRange,
    setDateRange,
    timeFrameOptions,
    setTimeFrame,
    fetchDemographicAnalytics,
  };
}
