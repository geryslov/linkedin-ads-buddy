import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type LookbackWindow = 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'LAST_60_DAYS' | 'LAST_90_DAYS' | 'LAST_180_DAYS' | 'LAST_365_DAYS';

/** One engaged company, as normalized by `get_company_intelligence` (account-intel.ts). */
export interface CompanyIntelligence {
  companyName: string;
  companyPageUrl: string;
  companyWebsite: string;
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
  companySize: string;
  industry: string;
  countryCode: string;
  costPerQualifiedLead: number | null;
  /** Seniority ids that engaged — only on merged decision-maker runs. */
  seniorities?: string[];
}

export interface CompanyIntelligenceMeta {
  version: string;
  accountId: string;
  lookbackWindow: string;
  filterCriteria: string[];
  /** LinkedIn's paging.total; null when it was not reported. */
  total: number | null;
  fetched: number;
  pages: number;
  truncated: boolean;
  bySeniority?: Record<string, number>;
  durationMs: number;
}

/** `all`, `dm` (Director+ merged), `sen:<id>` or `fn:<JOB_FUNCTION>`. */
export type Audience = string;

export interface CompanyIntelligenceQuery {
  lookbackWindow: LookbackWindow;
  campaignId: string | null;
  audience: Audience;
}

export interface IntelError {
  message: string;
  kind: string;
}

export interface ConnectionCheck {
  ok: boolean;
  at: string;
  meta?: CompanyIntelligenceMeta;
  error?: IntelError;
}

export const DECISION_MAKER_SENIORITIES = ['6', '7', '8', '9', '10'];

async function readInvokeError(error: unknown): Promise<IntelError> {
  const fallback = { message: error instanceof Error ? error.message : 'The request failed.', kind: 'error' };
  const ctx = (error as { context?: unknown })?.context;
  if (ctx && typeof (ctx as Response).json === 'function') {
    try {
      const body = await (ctx as Response).clone().json();
      if (body?.error) return { message: body.error, kind: body.kind || 'error' };
    } catch {
      /* body was not JSON — fall through */
    }
  }
  return fallback;
}

function toParams(accountId: string, q: CompanyIntelligenceQuery) {
  const params: Record<string, unknown> = { accountId, lookbackWindow: q.lookbackWindow };
  if (q.audience === 'dm') params.seniorities = DECISION_MAKER_SENIORITIES;
  else if (q.audience.startsWith('sen:')) params.seniority = q.audience.slice(4);
  else if (q.audience.startsWith('fn:')) params.jobFunction = q.audience.slice(3);
  // Audience filters are 90-day only and exclude campaign scoping.
  if (q.audience !== 'all') params.lookbackWindow = 'LAST_90_DAYS';
  else if (q.campaignId) params.campaignId = q.campaignId;
  return params;
}

async function invoke(accessToken: string, params: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('linkedin-api', {
    body: { action: 'get_company_intelligence', accessToken, params },
  });
  if (error) throw error;
  if (data?.error) throw Object.assign(new Error(data.error), { kind: data.kind });
  // The pre-2026-11 handler returned `elements`; a stale deploy still does.
  if (!data?.meta) throw Object.assign(new Error('The edge function is running the old Company Intelligence handler — deploy linkedin-api.'), { kind: 'stale_deploy' });
  return data as { companies: CompanyIntelligence[]; meta: CompanyIntelligenceMeta };
}

const asIntelError = async (e: unknown): Promise<IntelError> =>
  (e as { kind?: string })?.kind ? { message: (e as Error).message, kind: (e as { kind: string }).kind } : readInvokeError(e);

export function useCompanyIntelligence(accessToken: string | null) {
  const [companies, setCompanies] = useState<CompanyIntelligence[]>([]);
  const [meta, setMeta] = useState<CompanyIntelligenceMeta | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<IntelError | null>(null);
  const [check, setCheck] = useState<ConnectionCheck | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  /** One-row request: proves provisioning, account role and scope. */
  const runCheck = useCallback(async (accountId: string) => {
    if (!accessToken || !accountId) return;
    setIsChecking(true);
    try {
      const data = await invoke(accessToken, { accountId, lookbackWindow: 'LAST_90_DAYS', check: true });
      setCheck({ ok: true, at: new Date().toISOString(), meta: data.meta });
    } catch (e) {
      setCheck({ ok: false, at: new Date().toISOString(), error: await asIntelError(e) });
    } finally {
      setIsChecking(false);
    }
  }, [accessToken]);

  const load = useCallback(async (accountId: string, q: CompanyIntelligenceQuery) => {
    if (!accessToken || !accountId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await invoke(accessToken, toParams(accountId, q));
      setCompanies(data.companies);
      setMeta(data.meta);
    } catch (e) {
      setError(await asIntelError(e));
      setCompanies([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  const reset = useCallback(() => {
    setCompanies([]);
    setMeta(null);
    setError(null);
    setCheck(null);
  }, []);

  return { companies, meta, isLoading, error, load, check, isChecking, runCheck, reset };
}
