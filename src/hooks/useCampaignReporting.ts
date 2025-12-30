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
  // Daily spend data for average calculations
  const [dailySpendData, setDailySpendData] = useState<{ date: string; spent: number }[]>([]);

  // Fetch daily spend for last 7 days (for average calculations)
  const fetchDailySpendData = useCallback(async (accountId: string) => {
    if (!accessToken || !accountId) return;
    
    try {
      // Get today's date, then calculate 8 days ago (to get data for 7 full previous days, excluding today)
      const today = new Date();
      const eightDaysAgo = new Date(today);
      eightDaysAgo.setDate(today.getDate() - 8);
      
      // Yesterday (the most recent complete day)
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      
      const dailyDateRange = {
        start: eightDaysAgo.toISOString().split('T')[0],
        end: yesterday.toISOString().split('T')[0],
      };
      
      console.log('Fetching daily spend data with params:', { accountId, dailyDateRange });
      
      const { data, error: apiError } = await supabase.functions.invoke('linkedin-api', {
        body: { 
          action: 'get_campaign_report', 
          accessToken,
          params: { 
            accountId, 
            dateRange: dailyDateRange,
            timeGranularity: 'DAILY',
          }
        }
      });

      if (apiError) {
        console.error('Error fetching daily spend data:', apiError);
        return;
      }
      
      console.log('Daily spend response:', data);
      
      if (data.error) {
        console.error('Daily spend API error:', data.error);
        return;
      }
      
      // Aggregate spend by date across all campaigns
      const spendByDate: Record<string, number> = {};
      (data.elements || []).forEach((el: any) => {
        // Parse date from LinkedIn's dateRange format: { start: { year, month, day }, end: { year, month, day } }
        let date: string | null = null;
        if (el.dateRange?.start) {
          const { year, month, day } = el.dateRange.start;
          if (year && month && day) {
            date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          }
        }
        if (date) {
          const spent = parseFloat(el.costInLocalCurrency || '0');
          spendByDate[date] = (spendByDate[date] || 0) + spent;
        }
      });
      
      console.log('Spend by date:', spendByDate);
      
      const dailyData = Object.entries(spendByDate).map(([date, spent]) => ({ date, spent }));
      dailyData.sort((a, b) => b.date.localeCompare(a.date)); // Sort descending by date
      
      console.log('Processed daily spend data:', dailyData);
      setDailySpendData(dailyData);
    } catch (err: any) {
      console.error('Fetch daily spend error:', err);
    }
  }, [accessToken]);

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

  // Calculate average daily spend for last 2 days and last 7 days
  const dailySpendAverages = useMemo(() => {
    // Today's date
    const today = new Date();
    
    // Calculate dates for "last 2 days" (e.g., if today is Dec 30, last 2 days = Dec 28 & Dec 29)
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(today.getDate() - 2);
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(today.getDate() - 3);
    
    // Calculate date for 7 days ago (for last 7 days average)
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    const eightDaysAgo = new Date(today);
    eightDaysAgo.setDate(today.getDate() - 8);
    
    const formatDate = (d: Date) => d.toISOString().split('T')[0];
    
    // Last 2 days: days at -2 and -3 from today (e.g., Dec 28 and Dec 27 if today is Dec 30)
    // Actually per user: "2 last days will be 28th and 29th" if today is 30th
    // So -2 and -1 days from today (excluding today)
    const day1 = new Date(today);
    day1.setDate(today.getDate() - 2); // 28th
    const day2 = new Date(today);
    day2.setDate(today.getDate() - 1); // 29th
    
    const last2DaysDates = [formatDate(day1), formatDate(day2)];
    
    // Last 7 days: -7 to -1 days from today (excluding today)
    const last7DaysDates: string[] = [];
    for (let i = 7; i >= 1; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      last7DaysDates.push(formatDate(d));
    }
    
    // Calculate averages
    const last2DaysData = dailySpendData.filter(d => last2DaysDates.includes(d.date));
    const last7DaysData = dailySpendData.filter(d => last7DaysDates.includes(d.date));
    
    const avgLast2Days = last2DaysData.length > 0 
      ? last2DaysData.reduce((sum, d) => sum + d.spent, 0) / last2DaysData.length 
      : 0;
    
    const avgLast7Days = last7DaysData.length > 0 
      ? last7DaysData.reduce((sum, d) => sum + d.spent, 0) / last7DaysData.length 
      : 0;
    
    return {
      avgLast2Days,
      avgLast7Days,
      last2DaysCount: last2DaysData.length,
      last7DaysCount: last7DaysData.length,
    };
  }, [dailySpendData]);

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
    dailySpendAverages,
    fetchCampaignReport,
    fetchDailySpendData,
  };
}
