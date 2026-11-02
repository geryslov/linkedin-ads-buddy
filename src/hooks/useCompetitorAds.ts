import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/** One ad from the LinkedIn Ad Library, as normalized by `get_competitor_ads`. */
export interface CompetitorAd {
  adUrl: string;
  advertiserName: string;
  advertiserUrl: string;
  payer: string;
  format: string;
  firstImpressionAt: string | null;
  lastImpressionAt: string | null;
  daysRunning: number | null;
  /** `to: null` is LinkedIn's open-ended top band (1M+). */
  impressions: { from: number; to: number | null } | null;
  languages: string[];
  locations: string[];
  excludedLocations: string[];
  /** Facets the advertiser used. LinkedIn withholds their values. */
  targetingFacets: { included: string[]; excluded: string[] };
  isRestricted: boolean;
  restrictionDetails: string;
}

export interface CompetitorAdsSummary {
  ads: number;
  activeLast7Days: number;
  impressionsAtLeast: number;
  medianDaysRunning: number | null;
  byFormat: Record<string, number>;
  byAdvertiser: Record<string, number>;
  byLocation: Record<string, number>;
  byLanguage: Record<string, number>;
  targetingFacetsUsed: Record<string, number>;
}

export interface CompetitorAdsResult {
  advertiser: string;
  days: number;
  totalMatching: number | null;
  fetched: number;
  truncated: boolean;
  rateLimited: boolean;
  partialError: string | null;
  cachedAt: string;
  /** Every advertiser the fuzzy search matched, before the exact filter. */
  matchedAdvertisers: Record<string, number>;
  summary: CompetitorAdsSummary;
  ads: CompetitorAd[];
  /** Ads LinkedIn returned without impression stats — can't be placed in the window. */
  undated?: { count: number; byFormat: Record<string, number>; adUrls: string[] };
}

export interface CompetitorAdsQuery {
  advertiser: string;
  days: number;
  exactAdvertiser: boolean;
}

async function readInvokeError(error: unknown): Promise<string> {
  const fallback = error instanceof Error ? error.message : 'The request failed.';
  const ctx = (error as { context?: unknown })?.context;
  if (ctx && typeof (ctx as Response).json === 'function') {
    try {
      const body = await (ctx as Response).clone().json();
      if (body?.error) return body.error;
    } catch {
      /* body was not JSON — fall through */
    }
  }
  return fallback;
}

// Search-on-demand only: the Ad Library throttles at ~10 calls/minute per app,
// so nothing here loads on mount.
export function useCompetitorAds(accessToken: string | null) {
  const [result, setResult] = useState<CompetitorAdsResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (q: CompetitorAdsQuery) => {
    if (!accessToken || !q.advertiser.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke('linkedin-api', {
        body: {
          action: 'get_competitor_ads',
          accessToken,
          params: { advertiser: q.advertiser.trim(), days: q.days, exactAdvertiser: q.exactAdvertiser, maxAds: 100 },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data as CompetitorAdsResult);
    } catch (e) {
      const reason = await readInvokeError(e);
      // A stale deploy answers "Unknown action" — say so rather than implying no ads.
      setError(/unknown action/i.test(reason) ? 'Competitor Ads is not deployed to the edge function yet.' : reason);
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  return { result, isLoading, error, search };
}
