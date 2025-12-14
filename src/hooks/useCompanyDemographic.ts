import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface CompanyDemographicItem {
  entityUrn: string;
  entityName: string;
  website: string | null;
  linkedInUrl: string | null;
  enrichmentStatus: 'resolved' | 'fallback' | 'unresolved';
  impressions: number;
  clicks: number;
  spent: number;
  leads: number;
  ctr: number;
  cpc: number;
  cpm: number;
}

export type TimeGranularity = 'DAILY' | 'MONTHLY' | 'ALL';

export interface TimeFrameOption {
  label: string;
  value: string;
  startDate: Date;
  endDate: Date;
}

export function useCompanyDemographic(accessToken: string | null) {
  const [companyData, setCompanyData] = useState<CompanyDemographicItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeGranularity, setTimeGranularity] = useState<TimeGranularity>('ALL');
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

  const fetchCompanyDemographic = useCallback(async (accountId: string) => {
    if (!accessToken || !accountId) return;
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('Fetching company demographic with params:', { accountId, dateRange, timeGranularity });
      
      const { data, error: fetchError } = await supabase.functions.invoke('linkedin-api', {
        body: { 
          action: 'get_company_demographic', 
          accessToken,
          params: { 
            accountId, 
            dateRange,
            timeGranularity,
          }
        }
      });

      if (fetchError) throw fetchError;
      
      if (data.error) {
        setError(data.error);
        setCompanyData([]);
        return;
      }
      
      console.log('Company demographic response:', data);
      
      const companies: CompanyDemographicItem[] = (data.elements || []).map((el: any) => ({
        entityUrn: el.entityUrn || '',
        entityName: el.entityName || 'Unknown',
        website: el.website || null,
        linkedInUrl: el.linkedInUrl || null,
        enrichmentStatus: el.enrichmentStatus || 'unresolved',
        impressions: el.impressions || 0,
        clicks: el.clicks || 0,
        spent: parseFloat(el.costInLocalCurrency || '0'),
        leads: el.leads || 0,
        ctr: parseFloat(el.ctr || '0'),
        cpc: parseFloat(el.cpc || '0'),
        cpm: parseFloat(el.cpm || '0'),
      }));
      
      setCompanyData(companies);
    } catch (err: any) {
      console.error('Fetch company demographic error:', err);
      setError(err.message || 'Failed to fetch company demographic');
      toast({
        title: 'Error',
        description: err.message || 'Failed to fetch company demographic',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, dateRange, timeGranularity, toast]);

  const totals = useMemo(() => {
    return companyData.reduce(
      (acc, item) => ({
        impressions: acc.impressions + item.impressions,
        clicks: acc.clicks + item.clicks,
        spent: acc.spent + item.spent,
        leads: acc.leads + item.leads,
        resolved: acc.resolved + (item.enrichmentStatus === 'resolved' ? 1 : 0),
        unresolved: acc.unresolved + (item.enrichmentStatus === 'unresolved' ? 1 : 0),
      }),
      { impressions: 0, clicks: 0, spent: 0, leads: 0, resolved: 0, unresolved: 0 }
    );
  }, [companyData]);

  const setTimeFrame = useCallback((option: TimeFrameOption) => {
    setDateRange({
      start: option.startDate.toISOString().split('T')[0],
      end: option.endDate.toISOString().split('T')[0],
    });
  }, []);

  return {
    companyData,
    isLoading,
    error,
    totals,
    timeGranularity,
    setTimeGranularity,
    dateRange,
    setDateRange,
    timeFrameOptions,
    setTimeFrame,
    fetchCompanyDemographic,
  };
}
