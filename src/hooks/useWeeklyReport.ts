import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface WeekMetrics {
  impressions: number;
  clicks: number;
  spent: number;
  leads: number;
  ctr: number;
  cpl: number;
}

export interface TrendPoint {
  date: string;
  spent: number;
  clicks: number;
  leads: number;
  impressions: number;
}

export interface WeeklyCreativeRow {
  creativeId: string;
  creativeName: string;
  imageUrl: string;
  type: string;
  status: string;
  formUrn: string;
  campaignId: string;
  thisWeek: WeekMetrics;
  lastWeek: WeekMetrics;
  pctSpentChange: number | null;
  pctCplChange: number | null;
  trend: TrendPoint[];
}

export interface WeeklyCampaignRow {
  campaignId: string;
  campaignName: string;
  status: string;
  thisWeek: WeekMetrics;
  lastWeek: WeekMetrics;
  pctSpentChange: number | null;
  pctCplChange: number | null;
}

export interface WeeklyFormRow {
  formId: string;
  formName: string;
  thisWeek: WeekMetrics;
  lastWeek: WeekMetrics;
  pctSpentChange: number | null;
  pctCplChange: number | null;
}

export interface DemoEntry {
  name: string;
  impressions: number;
  clicks: number;
  spent: number;
  leads: number;
}

export interface WeeklyReportData {
  weekRange: {
    thisWeek: { start: string; end: string };
    lastWeek: { start: string; end: string };
  };
  summary: {
    thisWeek: WeekMetrics;
    lastWeek: WeekMetrics;
    pctSpentChange: number | null;
    pctImpressionsChange: number | null;
    pctClicksChange: number | null;
    pctLeadsChange: number | null;
    pctCtrChange: number | null;
    pctCplChange: number | null;
  };
  byCreative: WeeklyCreativeRow[];
  byCampaign: WeeklyCampaignRow[];
  byLeadForm: WeeklyFormRow[];
  demographics: {
    jobTitle: DemoEntry[];
    seniority: DemoEntry[];
    industry: DemoEntry[];
    companySize: DemoEntry[];
  };
}

export function useWeeklyReport(accessToken: string | null) {
  const [data, setData] = useState<WeeklyReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async (accountId: string) => {
    if (!accessToken || !accountId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await supabase.functions.invoke('linkedin-api', {
        body: { action: 'get_weekly_report', accessToken, params: { accountId } },
      });
      if (res.error || res.data?.error) {
        setError(res.data?.error || 'Failed to fetch weekly report');
        return;
      }
      setData(res.data as WeeklyReportData);
    } catch (err) {
      console.error('Weekly report error:', err);
      setError('Failed to fetch weekly report');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  return { data, isLoading, error, fetchReport };
}
