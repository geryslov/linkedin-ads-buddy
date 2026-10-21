import { useCallback, useEffect, useState } from 'react';
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
  /** The probe never reached the action's own logic — stale deploy, no session,
   *  transport error. The key is not implicated, so do not advise changing it.
   *  Only a 200 that says `connected: false` is evidence about the key. */
  callFailed?: boolean;
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
  /** null = not determined yet. `/dashboard` has NO route guard (see App.tsx) and
   *  the rest of the dashboard runs on the LinkedIn token in localStorage, so a
   *  Supabase session is genuinely optional here — but both Prospect Finder
   *  actions require one. Without this the UI cannot tell "not signed in" from
   *  "MoltSets is broken", and it reported the second for the first. */
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const { toast } = useToast();

  /** Is the MOLTSETS_API_KEY secret present and working? */
  const checkStatus = useCallback(async () => {
    // `moltsets_status` is platform-only: with no session, supabase-js sends the
    // anon key and the JWT gate 401s. That is the gate working, not a verdict on
    // MoltSets — so stay silent rather than reporting a failure the user cannot act
    // on. The effect below re-probes once the session lands.
    const { data: { session } } = await supabase.auth.getSession();
    setHasSession(!!session);
    if (!session) {
      setStatus(null);
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke('linkedin-api', {
        body: { action: 'moltsets_status' },
      });
      if (error) throw error;
      setStatus({ connected: !!data?.connected, reason: data?.reason, budget: data?.budget ?? null });
    } catch (e) {
      const reason = await readInvokeError(e);
      // Nothing thrown here says anything about the key: a function without the
      // action answers 400 "Unknown action" (stale deploy), an unauthenticated call
      // answers 401 AUTH_REQUIRED. Only a 200 carrying `connected: false` is the
      // action's own report, so flag these as callFailed and let the UI say so.
      setStatus({
        connected: false,
        reason,
        callFailed: true,
        notDeployed: /unknown action/i.test(reason),
      });
    }
  }, []);

  /** Probe on mount, and again when a session arrives. On first paint the session
   *  may still be hydrating from storage, and a status set from that miss would
   *  never correct itself — the old mount-only effect left the banner permanently
   *  wrong for anyone who loaded the tab directly. */
  useEffect(() => {
    checkStatus();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) checkStatus();
    });
    return () => sub.subscription.unsubscribe();
  }, [checkStatus]);

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
      // Both actions are JWT-gated, and this dashboard does not require a sign-in,
      // so answer the real question here instead of letting the edge function
      // return AUTH_REQUIRED — which reads as "the tool is broken" when it means
      // "you are not signed in".
      const { data: { session: findSession } } = await supabase.auth.getSession();
      setHasSession(!!findSession);
      if (!findSession) {
        setFindError(
          'Prospect Finder needs a signed-in Ads Buddy account — the rest of the dashboard runs on '
          + 'your LinkedIn connection alone, but this tool spends MoltSets credits, so it is tied to '
          + 'a user. Sign in and try again.',
        );
        return;
      }

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
    hasSession,
  };
}
