import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface CampaignData {
  campaignId: string;
  campaignName: string;
  status: string;
  objectiveType: string;
  costType: string;
  dailyBudget?: { amount: string; currencyCode: string };
  totalBudget?: { amount: string; currencyCode: string };
  impressions: number;
  clicks: number;
  spent: number;
  leads: number;
  ctr: number;
  cpc: number;
  cpm: number;
  costPerLead: number;
}

export type TimeGranularity = 'DAILY' | 'MONTHLY' | 'YEARLY' | 'ALL';

export interface TimeFrameOption {
  label: string;
  value: string;
  startDate: Date;
  endDate: Date;
}

export function useCampaignReporting(accessToken: string | null) {
  const [campaignData, setCampaignData] = useState<CampaignData[]>([]);
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
      {
        label: 'This quarter',
        value: 'this_quarter',
        startDate: new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1),
        endDate: today,
      },
      {
        label: 'This year',
        value: 'this_year',
        startDate: new Date(today.getFullYear(), 0, 1),
        endDate: today,
      },
    ];
  }, []);

  const fetchCampaignReport = useCallback(async (accountId: string) => {
    if (!accessToken || !accountId) return;
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('Fetching campaign report with params:', { accountId, dateRange, timeGranularity });
      
      const { data, error: apiError } = await supabase.functions.invoke('linkedin-api', {
        body: { 
          action: 'get_campaign_report', 
          accessToken,
          params: { 
            accountId, 
            dateRange,
            timeGranularity,
          }
        }
      });

      if (apiError) throw apiError;
      
      console.log('Campaign report response:', data);
      
      if (data.error) {
        setError(data.error);
        setCampaignData([]);
        return;
      }
      
      // Map API response to CampaignData interface
      const reportData: CampaignData[] = (data.elements || []).map((el: any) => ({
        campaignId: el.campaignId || '',
        campaignName: el.campaignName || `Campaign ${el.campaignId || 'Unknown'}`,
        status: el.status || 'UNKNOWN',
        objectiveType: el.objectiveType || 'UNKNOWN',
        costType: el.costType || 'UNKNOWN',
        dailyBudget: el.dailyBudget,
        totalBudget: el.totalBudget,
        impressions: el.impressions || 0,
        clicks: el.clicks || 0,
        spent: parseFloat(el.costInLocalCurrency || '0'),
        leads: el.leads || 0,
        ctr: parseFloat(el.ctr || '0'),
        cpc: parseFloat(el.cpc || '0'),
        cpm: parseFloat(el.cpm || '0'),
        costPerLead: parseFloat(el.costPerLead || '0'),
      }));
      
      setCampaignData(reportData);
    } catch (err: any) {
      console.error('Fetch campaign report error:', err);
      setError(err.message || 'Failed to fetch campaign report');
      toast({
        title: 'Error',
        description: err.message || 'Failed to fetch campaign report',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, dateRange, timeGranularity, toast]);

  // Calculate totals
  const totals = useMemo(() => {
    return campaignData.reduce(
      (acc, item) => ({
        impressions: acc.impressions + item.impressions,
        clicks: acc.clicks + item.clicks,
        spent: acc.spent + item.spent,
        leads: acc.leads + item.leads,
      }),
      { impressions: 0, clicks: 0, spent: 0, leads: 0 }
    );
  }, [campaignData]);

  const setTimeFrame = useCallback((option: TimeFrameOption) => {
    setDateRange({
      start: option.startDate.toISOString().split('T')[0],
      end: option.endDate.toISOString().split('T')[0],
    });
  }, []);

  return {
    campaignData,
    isLoading,
    error,
    timeGranularity,
    setTimeGranularity,
    dateRange,
    setDateRange,
    timeFrameOptions,
    setTimeFrame,
    totals,
    fetchCampaignReport,
  };
}
