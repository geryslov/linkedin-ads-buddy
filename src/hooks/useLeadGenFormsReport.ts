import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface LeadGenFormCreative {
  creativeId: string;
  creativeName: string;
  campaignId: string;
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

export interface LeadGenFormData {
  formUrn: string;
  formName: string;
  impressions: number;
  clicks: number;
  spent: number;
  leads: number;
  formOpens: number;
  ctr: number;
  cpc: number;
  cpl: number;
  lgfRate: number;
  creatives: LeadGenFormCreative[];
}

export interface TimeFrameOption {
  label: string;
  value: string;
  startDate: Date;
  endDate: Date;
}

export function useLeadGenFormsReport(accessToken: string | null) {
  const [formsData, setFormsData] = useState<LeadGenFormData[]>([]);
  const [creativesWithoutForm, setCreativesWithoutForm] = useState<LeadGenFormCreative[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
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

  const fetchLeadGenForms = useCallback(async (accountId: string) => {
    if (!accessToken || !accountId) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('linkedin-api', {
        body: {
          action: 'get_lead_gen_forms',
          accessToken,
          params: {
            accountId,
            dateRange,
            campaignIds: selectedCampaignIds.length > 0 ? selectedCampaignIds : undefined,
          }
        }
      });

      if (fnError) {
        console.error('Lead gen forms report error:', fnError);
        setError(fnError.message || 'Failed to fetch lead gen forms report');
        return;
      }

      if (data?.error) {
        console.error('API error:', data.error);
        setError(data.error);
        return;
      }

      setFormsData(data?.forms || []);
      setCreativesWithoutForm(data?.creativesWithoutForm || []);
    } catch (err) {
      console.error('Fetch error:', err);
      setError('Failed to fetch lead gen forms report');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, dateRange, selectedCampaignIds]);

  const totals = useMemo(() => {
    const base = formsData.reduce((acc, form) => ({
      impressions: acc.impressions + form.impressions,
      clicks: acc.clicks + form.clicks,
      spent: acc.spent + form.spent,
      leads: acc.leads + form.leads,
      formOpens: acc.formOpens + form.formOpens,
    }), { impressions: 0, clicks: 0, spent: 0, leads: 0, formOpens: 0 });

    return {
      ...base,
      ctr: base.impressions > 0 ? (base.clicks / base.impressions) * 100 : 0,
      cpc: base.clicks > 0 ? base.spent / base.clicks : 0,
      cpl: base.leads > 0 ? base.spent / base.leads : 0,
      lgfRate: base.formOpens > 0 ? (base.leads / base.formOpens) * 100 : 0,
    };
  }, [formsData]);

  const setTimeFrame = useCallback((option: TimeFrameOption) => {
    const formatDate = (d: Date) => 
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    setDateRange({
      start: formatDate(option.startDate),
      end: formatDate(option.endDate)
    });
  }, []);

  return {
    formsData,
    creativesWithoutForm,
    isLoading,
    error,
    fetchLeadGenForms,
    totals,
    dateRange,
    setDateRange,
    timeFrameOptions,
    setTimeFrame,
    selectedCampaignIds,
    setSelectedCampaignIds,
  };
}
