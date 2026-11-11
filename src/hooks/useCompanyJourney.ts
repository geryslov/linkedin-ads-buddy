import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CompanyIntelligence, IntelError, LookbackWindow } from '@/hooks/useCompanyIntelligence';

/** One Account Intel lookback window for one company (cumulative, not a bucket). */
export interface WindowRow {
  window: LookbackWindow;
  engagementLevel: string;
  paidImpressions: number;
  paidClicks: number;
  paidEngagements: number;
  paidLeads: number;
  paidQualifiedLeads: number;
  conversions: number;
  paidVideoViews: number;
  organicImpressions: number;
  organicEngagements: number;
}

export interface WindowSeries {
  accountId: string;
  companies: CompanyIntelligence[];
  byCompany: Record<string, WindowRow[]>;
  meta: { truncated: boolean; durationMs: number };
}

/** One company × day (× campaign when the split is available) from Ad Analytics. */
export interface DailyRow {
  date: string;
  campaignId: string | null;
  impressions: number;
  clicks: number;
  engagements: number;
  leads: number;
  conversions: number;
  videoViews: number;
  spend: number;
}

export interface CompanyDaily {
  rows: DailyRow[];
  campaigns: Record<string, { name: string; objectiveType: string; status: string }>;
  meta: { orgUrn: string; resolvedVia: string; campaignSplit: boolean; calls: number; truncated: boolean; durationMs: number };
}

async function call<T>(accessToken: string, params: Record<string, unknown>, isValid: (d: any) => boolean): Promise<T> {
  const { data, error } = await supabase.functions.invoke('linkedin-api', {
    body: { action: 'get_company_intelligence', accessToken, params },
  });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const body = ctx && typeof ctx.json === 'function' ? await ctx.clone().json().catch(() => null) : null;
    throw Object.assign(new Error(body?.error || error.message), { kind: body?.kind || 'error' });
  }
  if (data?.error) throw Object.assign(new Error(data.error), { kind: data.kind });
  if (!isValid(data)) throw Object.assign(new Error('The deployed edge function has no Company Journey support yet — deploy linkedin-api.'), { kind: 'stale_deploy' });
  return data as T;
}

const toIntelError = (e: unknown): IntelError => ({ message: (e as Error)?.message || 'The request failed.', kind: (e as { kind?: string })?.kind || 'error' });

export function useCompanyJourney(accessToken: string | null) {
  const [series, setSeries] = useState<WindowSeries | null>(null);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [seriesError, setSeriesError] = useState<IntelError | null>(null);
  // Keyed `${accountId}:${lookback}:${companyPageUrl}`.
  const [daily, setDaily] = useState<Record<string, CompanyDaily | IntelError | 'loading'>>({});

  /** Six Account Intel calls (one per window), every company at once. */
  const loadSeries = useCallback(async (accountId: string) => {
    if (!accessToken || !accountId) return;
    setSeriesLoading(true);
    setSeriesError(null);
    try {
      const data = await call<Omit<WindowSeries, 'accountId'>>(accessToken, { accountId, breakdown: 'windows' }, (d) => Array.isArray(d?.companies) && !!d?.byCompany);
      setSeries({ ...data, accountId });
    } catch (e) {
      setSeries(null);
      setSeriesError(toIntelError(e));
    } finally {
      setSeriesLoading(false);
    }
  }, [accessToken]);

  const loadDaily = useCallback(async (accountId: string, lookbackWindow: LookbackWindow, company: Pick<CompanyIntelligence, 'companyPageUrl' | 'companyWebsite' | 'companyName'>) => {
    const { companyPageUrl, companyWebsite, companyName } = company;
    if (!accessToken || !accountId || !companyPageUrl) return;
    const key = `${accountId}:${lookbackWindow}:${companyPageUrl}`;
    setDaily((m) => ({ ...m, [key]: 'loading' }));
    try {
      const data = await call<CompanyDaily>(accessToken, { accountId, lookbackWindow, companyPageUrl, companyWebsite, companyName, breakdown: 'daily' }, (d) => Array.isArray(d?.rows));
      setDaily((m) => ({ ...m, [key]: data }));
    } catch (e) {
      setDaily((m) => ({ ...m, [key]: toIntelError(e) }));
    }
  }, [accessToken]);

  return { series, seriesLoading, seriesError, loadSeries, daily, loadDaily };
}
