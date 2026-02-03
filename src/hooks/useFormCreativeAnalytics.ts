import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface FormCreative {
  creativeId: string;
  creativeName: string;
  creativePart: string;
  campaignId: string;
  status: string;
  impressions: number;
  clicks: number;
  spent: number;
  leads: number;
  formOpens: number;
  ctr: number;
  cpc: number;
  cpl: number;
  lgfRate: number;
}

export interface FormAnalytics {
  formName: string;
  impressions: number;
  clicks: number;
  spent: number;
  leads: number;
  formOpens: number;
  videoViews: number;
  videoCompletions: number;
  ctr: number;
  cpc: number;
  cpl: number;
  lgfRate: number;
  creativeCount: number;
  creatives: FormCreative[];
}

export interface FormAnalyticsTotals {
  impressions: number;
  clicks: number;
  spent: number;
  leads: number;
  formOpens: number;
  ctr: number;
  cpc: number;
  cpl: number;
  lgfRate: number;
}

export interface DetectionStats {
  pipe: number;
  dash: number;
  bracket: number;
  colon: number;
  custom: number;
  unknown: number;
}

export interface TimeFrameOption {
  label: string;
  value: string;
  startDate: Date;
  endDate: Date;
}

export function useFormCreativeAnalytics(accessToken: string | null) {
  const [formsData, setFormsData] = useState<FormAnalytics[]>([]);
  const [totals, setTotals] = useState<FormAnalyticsTotals | null>(null);
  const [detectionStats, setDetectionStats] = useState<DetectionStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [separator, setSeparator] = useState<string>('');
  const [expandedForms, setExpandedForms] = useState<Set<string>>(new Set());
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const formatDate = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { start: formatDate(start), end: formatDate(now) };
  });
  const { toast } = useToast();

  const timeFrameOptions: TimeFrameOption[] = useMemo(() => {
    const now = new Date();
    return [
      {
        label: 'Last 7 Days',
        value: 'last_7_days',
        startDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        endDate: now
      },
      {
        label: 'Last 14 Days',
        value: 'last_14_days',
        startDate: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
        endDate: now
      },
      {
        label: 'Last 30 Days',
        value: 'last_30_days',
        startDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        endDate: now
      },
      {
        label: 'Last 60 Days',
        value: 'last_60_days',
        startDate: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
        endDate: now
      },
      {
        label: 'Last 90 Days',
        value: 'last_90_days',
        startDate: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
        endDate: now
      },
      {
        label: 'This Month',
        value: 'this_month',
        startDate: new Date(now.getFullYear(), now.getMonth(), 1),
        endDate: now
      },
      {
        label: 'Last Month',
        value: 'last_month',
        startDate: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        endDate: new Date(now.getFullYear(), now.getMonth(), 0)
      },
      {
        label: 'This Year',
        value: 'this_year',
        startDate: new Date(now.getFullYear(), 0, 1),
        endDate: now
      },
    ];
  }, []);

  const fetchFormAnalytics = useCallback(async (accountId: string) => {
    if (!accessToken || !accountId) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('linkedin-api', {
        body: {
          action: 'get_form_creative_analytics',
          accessToken,
          params: {
            accountId,
            dateRange,
            separator: separator || undefined,
          }
        }
      });

      if (fnError) {
        console.error('Form creative analytics error:', fnError);
        setError(fnError.message || 'Failed to fetch form creative analytics');
        return;
      }

      if (data?.error) {
        console.error('API error:', data.error);
        setError(data.error);
        return;
      }

      setFormsData(data?.forms || []);
      setTotals(data?.totals || null);
      setDetectionStats(data?.metadata?.detectionStats || null);
    } catch (err) {
      console.error('Fetch error:', err);
      setError('Failed to fetch form creative analytics');
      toast({
        title: 'Error',
        description: 'Failed to fetch form creative analytics',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, dateRange, separator, toast]);

  const setTimeFrame = useCallback((option: TimeFrameOption) => {
    const formatDate = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    setDateRange({
      start: formatDate(option.startDate),
      end: formatDate(option.endDate)
    });
  }, []);

  const toggleFormExpanded = useCallback((formName: string) => {
    setExpandedForms(prev => {
      const next = new Set(prev);
      if (next.has(formName)) {
        next.delete(formName);
      } else {
        next.add(formName);
      }
      return next;
    });
  }, []);

  const expandAllForms = useCallback(() => {
    setExpandedForms(new Set(formsData.map(f => f.formName)));
  }, [formsData]);

  const collapseAllForms = useCallback(() => {
    setExpandedForms(new Set());
  }, []);

  return {
    formsData,
    totals,
    detectionStats,
    isLoading,
    error,
    fetchFormAnalytics,
    dateRange,
    setDateRange,
    timeFrameOptions,
    setTimeFrame,
    separator,
    setSeparator,
    expandedForms,
    toggleFormExpanded,
    expandAllForms,
    collapseAllForms,
  };
}
