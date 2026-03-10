import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface LeadFormResponse {
  leadUrn: string;
  formUrn: string;
  campaignUrn: string;
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  submittedAt: number;
  testLead: boolean;
  customAnswers: Record<string, string>;
}

export function useLeadFormResponses(
  accessToken: string | null,
  dateRange: { start: string; end: string }
) {
  const [leads, setLeads] = useState<LeadFormResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [currentAccountId, setCurrentAccountId] = useState<string | null>(null);
  const [currentFormUrn, setCurrentFormUrn] = useState<string | undefined>(undefined);

  const fetchLeads = useCallback(async (accountId: string, formUrn?: string) => {
    if (!accessToken || !accountId) return;

    setIsLoading(true);
    setError(null);
    setLeads([]);
    setOffset(0);
    setCurrentAccountId(accountId);
    setCurrentFormUrn(formUrn);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('linkedin-api', {
        body: {
          action: 'get_lead_form_responses',
          accessToken,
          params: { accountId, formUrn, dateRange, offset: 0 },
        },
      });

      if (fnError) {
        setError(fnError.message || 'Failed to fetch leads');
        return;
      }
      if (data?.error) {
        setError(data.error + (data.details ? ` — ${data.details}` : ''));
        return;
      }

      setLeads(data?.leads || []);
      setTotal(data?.total ?? 0);
      setHasMore(data?.hasMore ?? false);
      setOffset(100);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch leads');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, dateRange]);

  const loadMore = useCallback(async () => {
    if (!accessToken || !currentAccountId || isLoading || !hasMore) return;

    setIsLoading(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('linkedin-api', {
        body: {
          action: 'get_lead_form_responses',
          accessToken,
          params: { accountId: currentAccountId, formUrn: currentFormUrn, dateRange, offset },
        },
      });

      if (fnError) {
        setError(fnError.message || 'Failed to fetch more leads');
        return;
      }
      if (data?.error) {
        setError(data.error);
        return;
      }

      setLeads(prev => [...prev, ...(data?.leads || [])]);
      setTotal(data?.total ?? total);
      setHasMore(data?.hasMore ?? false);
      setOffset(prev => prev + 100);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch more leads');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, currentAccountId, currentFormUrn, dateRange, offset, isLoading, hasMore, total]);

  const clearLeads = useCallback(() => {
    setLeads([]);
    setTotal(0);
    setHasMore(false);
    setOffset(0);
    setError(null);
    setCurrentAccountId(null);
    setCurrentFormUrn(undefined);
  }, []);

  return {
    leads,
    isLoading,
    error,
    hasMore,
    total,
    fetchLeads,
    loadMore,
    clearLeads,
  };
}
