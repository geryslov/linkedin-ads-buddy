import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

/** One row of LinkedIn demographic data — a company or a job title. */
export interface AudienceRow {
  entityUrn: string;
  entityName: string;
  impressions: number;
  clicks: number;
  ctr: number;
}

/** A person MoltSets found for a company × title pair. */
export interface Prospect {
  fullName: string;
  title: string | null;
  headline: string | null;
  seniority: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  linkedInUrl: string | null;
  companyName: string | null;
  companyDomain: string | null;
  companySize: string | null;
  companyIndustry: string | null;
  companyLinkedInUrl: string | null;
  lastUpdatedAt: string | null;
  score: number | null;
  sourceCompanyUrn: string | null;
  sourceCompanyName: string | null;
  matchedBy: 'domain' | 'name';
}

export interface ProspectCompanyResult {
  urn: string | null;
  name: string | null;
  domain: string | null;
  matchedBy: 'domain' | 'name';
  status: 'ok' | 'not_found' | 'error';
  total: number;
  returned: number;
  error: string | null;
  retryAfter: number | null;
}

export interface ProspectRunMeta {
  titles: string[];
  perCompanyLimit: number;
  companiesRequested: number;
  companiesSearched: number;
  companiesTruncated: number;
  companiesErrored: number;
  duplicatesSkipped: number;
  domainsResolved: number;
  peopleReturned: number;
  budget: MoltSetsBudget | null;
}

/** Normalized spend headroom. Which fields are populated depends on the plan —
 *  a trial key reports searchResults*, a paid key reports records/requests. */
export interface MoltSetsBudget {
  plan: string | null;
  tokensRemaining: number | null;
  searchResultsRemaining: number | null;
  searchResultsTotal: number | null;
  /** A trial plan silently clamps `limit` to this rather than erroring. */
  maxPerCall: number | null;
  searchRequestsRemaining: number | null;
  recordsRemaining5h: number | null;
}

export interface MoltSetsStatus {
  connected: boolean;
  reason?: string;
  /** The deployed function has no `moltsets_status` case at all — a stale deploy,
   *  not a missing key. Different fix, so the UI must not conflate the two. */
  notDeployed?: boolean;
  budget?: MoltSetsBudget | null;
}

/** supabase-js hides the response body behind a generic "non-2xx status code".
 *  FunctionsHttpError carries the Response on `.context` — read the real reason. */
async function readInvokeError(error: unknown): Promise<string> {
  const fallback = error instanceof Error ? error.message : 'The request failed.';
  const ctx = (error as { context?: unknown })?.context;
  if (ctx && typeof (ctx as Response).json === 'function') {
    try {
      const body = await (ctx as Response).clone().json();
      if (body?.error) return body.errorCode ? `${body.error} (${body.errorCode})` : body.error;
      if (body?.message) return body.message;
    } catch {
      /* body was not JSON — fall through */
    }
  }
  return fallback;
}

export function useProspectFinder(accessToken: string | null) {
  const [companies, setCompanies] = useState<AudienceRow[]>([]);
  const [titles, setTitles] = useState<AudienceRow[]>([]);
  const [isLoadingAudience, setIsLoadingAudience] = useState(false);
  const [audienceError, setAudienceError] = useState<string | null>(null);

  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [companyResults, setCompanyResults] = useState<ProspectCompanyResult[]>([]);
  const [runMeta, setRunMeta] = useState<ProspectRunMeta | null>(null);
  const [isFinding, setIsFinding] = useState(false);
  const [findError, setFindError] = useState<string | null>(null);

  const [status, setStatus] = useState<MoltSetsStatus | null>(null);
  const { toast } = useToast();

  /** Is the MOLTSETS_API_KEY secret present and working? */
  const checkStatus = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('linkedin-api', {
        body: { action: 'moltsets_status' },
      });
      if (error) throw error;
      setStatus({ connected: !!data?.connected, reason: data?.reason, budget: data?.budget ?? null });
    } catch (e) {
      const reason = await readInvokeError(e);
      // A function without the action answers 400 "Unknown action". That is a stale
      // deploy, not a missing secret — reporting it as a credential problem sends
      // the user to fix something that is already correct.
      setStatus({ connected: false, reason, notDeployed: /unknown action/i.test(reason) });
    }
  }, []);

  /** Load both demographic pivots for the chosen campaigns in one pass.
   *  LinkedIn aggregates each pivot independently — there is no company × title
   *  cross-tab to ask for, which is why these come back as two separate lists. */
  const loadAudience = useCallback(
    async (accountId: string, dateRange: { start: string; end: string }, campaignIds: string[]) => {
      if (!accessToken || !accountId) return;
      setIsLoadingAudience(true);
      setAudienceError(null);
      setCompanies([]);
      setTitles([]);

      const fetchPivot = async (pivot: 'MEMBER_COMPANY' | 'MEMBER_JOB_TITLE'): Promise<AudienceRow[]> => {
        const { data, error } = await supabase.functions.invoke('linkedin-api', {
          body: {
            action: 'get_demographic_analytics',
            accessToken,
            params: {
              accountId,
              dateRange,
              timeGranularity: 'ALL',
              pivot,
              campaignIds: campaignIds.length > 0 ? campaignIds : undefined,
            },
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        return (data?.elements || []).map((el: Record<string, unknown>) => ({
          entityUrn: String(el.entityUrn ?? ''),
          entityName: String(el.entityName ?? 'Unknown'),
          impressions: Number(el.impressions ?? 0),
          clicks: Number(el.clicks ?? 0),
          ctr: Number(el.ctr ?? 0),
        }));
      };

      try {
        const [companyRows, titleRows] = await Promise.all([
          fetchPivot('MEMBER_COMPANY'),
          fetchPivot('MEMBER_JOB_TITLE'),
        ]);
        setCompanies(companyRows);
        setTitles(titleRows);
        if (companyRows.length === 0 && titleRows.length === 0) {
          // Below 300 impressions LinkedIn withholds demographics entirely.
          setAudienceError(
            'No demographic rows came back. LinkedIn returns nothing below its 300-impression privacy threshold — try a wider date range or more campaigns.',
          );
        }
      } catch (e) {
        const message = await readInvokeError(e);
        setAudienceError(message);
        toast({ title: 'Could not load the audience', description: message, variant: 'destructive' });
      } finally {
        setIsLoadingAudience(false);
      }
    },
    [accessToken, toast],
  );

  /** Turn the selected company × title pairs into named people. One MoltSets
   *  search per company, throttled server-side. */
  const findProspects = useCallback(
    async (args: {
      companies: Array<{ urn: string | null; name: string | null; domain?: string | null }>;
      titles: string[];
      seniority?: string[];
      country?: string;
      perCompanyLimit?: number;
    }) => {
      setIsFinding(true);
      setFindError(null);
      setProspects([]);
      setCompanyResults([]);
      setRunMeta(null);

      try {
        const { data, error } = await supabase.functions.invoke('linkedin-api', {
          body: {
            action: 'find_prospects',
            accessToken,
            params: {
              companies: args.companies,
              titles: args.titles,
              seniority: args.seniority?.length ? args.seniority : undefined,
              country: args.country || undefined,
              perCompanyLimit: args.perCompanyLimit ?? 10,
            },
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.errorCode ? `${data.error} (${data.errorCode})` : data.error);

        setProspects(data?.prospects || []);
        setCompanyResults(data?.companies || []);
        setRunMeta(data?.metadata || null);

        const found = (data?.prospects || []).length;
        toast({
          title: found > 0 ? `Found ${found} ${found === 1 ? 'person' : 'people'}` : 'No people matched',
          description:
            found > 0
              ? `Across ${data?.metadata?.companiesSearched ?? 0} companies.`
              : 'Try fewer job titles, or search the companies without a title filter.',
        });
      } catch (e) {
        const message = await readInvokeError(e);
        setFindError(message);
        toast({ title: 'Prospect search failed', description: message, variant: 'destructive' });
      } finally {
        setIsFinding(false);
      }
    },
    [accessToken, toast],
  );

  return {
    companies,
    titles,
    isLoadingAudience,
    audienceError,
    loadAudience,
    prospects,
    companyResults,
    runMeta,
    isFinding,
    findError,
    findProspects,
    status,
    checkStatus,
  };
}
