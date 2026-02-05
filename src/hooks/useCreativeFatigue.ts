import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CreativeDailyData {
  date: string;
  ctr: number;
  cpl: number;
  impressions: number;
}

export interface CreativeFatigueItem {
  creativeId: string;
  creativeName: string;
  campaignId?: string;
  campaignName?: string;
  objectiveType?: string;
  status: 'healthy' | 'warning' | 'fatigued';
  signals: string[];
  metrics: {
    totalImpressions: number;
    totalSpend: number;
    totalLeads: number;
    avgCtr: number;
    avgCpl: number;
    ctrTrend: number;
    cplTrend: number;
    impressionTrend: number;
  };
  recommendation: string;
  dailyData: CreativeDailyData[];
}

export interface CreativeFatigueData {
  period: {
    start: string;
    end: string;
  };
  thresholds: {
    ctrDeclineThreshold: number;
    cplIncreaseThreshold: number;
    minImpressions: number;
  };
  summary: {
    total: number;
    fatigued: number;
    warning: number;
    healthy: number;
  };
  creatives: CreativeFatigueItem[];
}

export interface FatigueThresholds {
  ctrDecline?: number;
  cplIncrease?: number;
  minImpressions?: number;
}

export function useCreativeFatigue(accessToken: string | null) {
  const [data, setData] = useState<CreativeFatigueData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const formatDate = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { start: formatDate(start), end: formatDate(now) };
  });

  const [thresholds, setThresholds] = useState<FatigueThresholds>({
    ctrDecline: 20,
    cplIncrease: 30,
    minImpressions: 1000,
  });

  const fetchCreativeFatigue = useCallback(async (accountId: string) => {
    if (!accessToken || !accountId) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data: result, error: fnError } = await supabase.functions.invoke('linkedin-api', {
        body: {
          action: 'get_creative_fatigue',
          accessToken,
          params: { accountId, dateRange, thresholds }
        }
      });

      if (fnError) {
        setError(fnError.message || 'Failed to fetch creative fatigue data');
        return;
      }

      if (result?.error) {
        setError(result.error);
        return;
      }

      setData(result);
    } catch (err) {
      setError('Failed to fetch creative fatigue data');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, dateRange, thresholds]);

  const fatiguedCreatives = useMemo(() => {
    return data?.creatives.filter(c => c.status === 'fatigued') || [];
  }, [data]);

  const warningCreatives = useMemo(() => {
    return data?.creatives.filter(c => c.status === 'warning') || [];
  }, [data]);

  const healthyCreatives = useMemo(() => {
    return data?.creatives.filter(c => c.status === 'healthy') || [];
  }, [data]);

  return {
    data,
    isLoading,
    error,
    fetchCreativeFatigue,
    dateRange,
    setDateRange,
    thresholds,
    setThresholds,
    fatiguedCreatives,
    warningCreatives,
    healthyCreatives,
  };
}
