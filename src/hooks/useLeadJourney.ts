import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface JourneyCampaign {
  id: string;
  name: string;
  objectiveType: string;
  impressions: number;
  clicks: number;
  spend: number;
}

export interface JourneyData {
  orgResolved: boolean;
  orgUrn?: string;
  orgName: string;
  window?: { start: string; end: string; days: number };
  total: { impressions: number; clicks: number; spend: number };
  campaigns: JourneyCampaign[];
  /** false when LinkedIn only gave company totals, without the per-campaign split */
  campaignSplit?: boolean;
  /** Partial or failed load; totals may be incomplete */
  error?: string;
}

// The window ends at the submission, so one company's journey differs per submission day.
const journeyKey = (accountId: string, orgName: string, submittedAtMs: number) =>
  `${accountId}::${orgName.toLowerCase()}::${new Date(submittedAtMs || 0).toISOString().slice(0, 10)}`;

export function useLeadJourney(accessToken: string | null) {
  const [journeyCache, setJourneyCache] = useState<Map<string, JourneyData>>(new Map());
  const [loadingKeys, setLoadingKeys] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  // Track in-flight requests to avoid duplicate calls
  const inFlight = useRef<Set<string>>(new Set());

  const fetchJourney = useCallback(async (
    accountId: string,
    orgName: string,
    submittedAtMs: number,
    lookbackDays = 90,
  ) => {
    if (!accessToken || !accountId || !orgName) return;

    const cacheKey = journeyKey(accountId, orgName, submittedAtMs);

    // Already cached or in flight
    if (journeyCache.has(cacheKey) || inFlight.current.has(cacheKey)) return;

    inFlight.current.add(cacheKey);
    setLoadingKeys(prev => new Set(prev).add(cacheKey));

    try {
      const { data, error: fnError } = await supabase.functions.invoke('linkedin-api', {
        body: {
          action: 'get_lead_company_journey',
          accessToken,
          params: { accountId, orgName, submittedAtMs, lookbackDays },
        },
      });

      if (fnError) {
        setError(fnError.message || 'Failed to fetch journey');
        return;
      }
      if (data?.error) {
        setError(data.error);
        return;
      }

      setJourneyCache(prev => {
        const next = new Map(prev);
        next.set(cacheKey, data as JourneyData);
        return next;
      });
    } catch (err: any) {
      setError(err.message || 'Failed to fetch journey');
    } finally {
      inFlight.current.delete(cacheKey);
      setLoadingKeys(prev => {
        const next = new Set(prev);
        next.delete(cacheKey);
        return next;
      });
    }
  }, [accessToken, journeyCache]);

  const getJourney = useCallback((accountId: string, orgName: string, submittedAtMs: number): JourneyData | undefined => {
    return journeyCache.get(journeyKey(accountId, orgName, submittedAtMs));
  }, [journeyCache]);

  const isLoadingJourney = useCallback((accountId: string, orgName: string, submittedAtMs: number): boolean => {
    return loadingKeys.has(journeyKey(accountId, orgName, submittedAtMs));
  }, [loadingKeys]);

  const clearCache = useCallback(() => {
    setJourneyCache(new Map());
    setLoadingKeys(new Set());
    inFlight.current.clear();
  }, []);

  return {
    fetchJourney,
    getJourney,
    isLoadingJourney,
    clearCache,
    error,
  };
}
