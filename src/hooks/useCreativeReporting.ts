import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface CreativeData {
  creativeId: string;
  creativeName: string;
  campaignName: string;
  campaignType: string;
  status: string;
  type: string;
  impressions: number;
  clicks: number;
  spent: number;
  leads: number;
  lgfFormOpens: number;
  lgfCompletionRate: number;
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

export function useCreativeReporting(accessToken: string | null) {
  const [creativeData, setCreativeData] = useState<CreativeData[]>([]);
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

  const fetchCreativeAnalytics = useCallback(async (accountId: string) => {
    if (!accessToken || !accountId) return;
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('Fetching creative analytics with params:', { accountId, dateRange, timeGranularity });
      
      const { data, error: apiError } = await supabase.functions.invoke('linkedin-api', {
        body: { 
          action: 'get_creative_report', 
          accessToken,
          params: { 
            accountId, 
            dateRange,
            timeGranularity,
          }
        }
      });

      if (apiError) throw apiError;
      
      console.log('Creative analytics response:', data);
      
      if (data.error) {
        setError(data.error);
        setCreativeData([]);
        return;
      }
      
      // Map API response to CreativeData interface
      // Filter out creatives with no performance data (0 impressions AND 0 spend)
      const analyticsData: CreativeData[] = (data.elements || [])
        .filter((el: any) => {
          const impressions = el.impressions || 0;
          const spent = parseFloat(el.costInLocalCurrency || el.spent || '0');
          return impressions > 0 || spent > 0;
        })
        .map((el: any) => {
          const impressions = el.impressions || 0;
          const clicks = el.clicks || 0;
          const spent = parseFloat(el.costInLocalCurrency || el.spent || '0');
          const leads = el.leads || 0;
          
          return {
            creativeId: el.creativeId || '',
            creativeName: el.creativeName || `Creative ${el.creativeId || 'Unknown'}`,
            campaignName: el.campaignName || 'Unknown Campaign',
            campaignType: el.campaignType || el.objectiveType || 'UNKNOWN',
            status: el.status || 'UNKNOWN',
            type: el.type || 'UNKNOWN',
            impressions,
            clicks,
            spent,
            leads,
            lgfFormOpens: el.lgfFormOpens || 0,
            lgfCompletionRate: parseFloat(el.lgfCompletionRate || '0'),
            ctr: parseFloat(el.ctr || '0'),
            cpc: parseFloat(el.cpc || '0'),
            cpm: parseFloat(el.cpm || '0'),
            costPerLead: leads > 0 ? spent / leads : 0,
          };
        });
      
      setCreativeData(analyticsData);
    } catch (err: any) {
      console.error('Fetch creative analytics error:', err);
      setError(err.message || 'Failed to fetch creative analytics');
      toast({
        title: 'Error',
        description: err.message || 'Failed to fetch creative analytics',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, dateRange, timeGranularity, toast]);

  // Calculate totals
  const totals = useMemo(() => {
    return creativeData.reduce(
      (acc, item) => ({
        impressions: acc.impressions + item.impressions,
        clicks: acc.clicks + item.clicks,
        spent: acc.spent + item.spent,
        leads: acc.leads + item.leads,
      }),
      { impressions: 0, clicks: 0, spent: 0, leads: 0 }
    );
  }, [creativeData]);

  const setTimeFrame = useCallback((option: TimeFrameOption) => {
    setDateRange({
      start: option.startDate.toISOString().split('T')[0],
      end: option.endDate.toISOString().split('T')[0],
    });
  }, []);

  return {
    creativeData,
    isLoading,
    error,
    timeGranularity,
    setTimeGranularity,
    dateRange,
    setDateRange,
    timeFrameOptions,
    setTimeFrame,
    totals,
    fetchCreativeAnalytics,
  };
}
