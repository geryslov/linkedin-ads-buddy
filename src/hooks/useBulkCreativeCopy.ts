import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// A selectable source ad. Sourced from get_creative_report so names/campaigns are
// resolved consistently with the Creatives gallery and Creative Reports.
export interface SourceCreative {
  creativeId: string;
  creativeName: string;
  campaignName: string;
  type: string;
  status: string;
}

export interface TargetCampaign {
  id: string;
  name: string;
  status: string;
  type: string;
}

export interface CopyResult {
  sourceCreativeId: string;
  sourceCreativeName: string | null;
  targetCampaignId: string;
  ok: boolean;
  verdict: string;
  createdUrn: string | null;
  message: string | null;
}

export interface CopySummary {
  attempted: number;
  succeeded: number;
  failed: number;
}

// Ad types LinkedIn cannot copy by reference (no shareable content URN). Used only
// to warn in the UI up front — the edge function remains the source of truth.
const NON_COPYABLE_TYPES = new Set([
  'TEXT_AD',
  'SPOTLIGHT_V2',
  'FOLLOWER_V2',
  'SPONSORED_INMAILS',
  'SPONSORED_MESSAGE',
]);

export function isCopyableType(type: string): boolean {
  return !NON_COPYABLE_TYPES.has((type || '').toUpperCase());
}

// supabase-js reports a failed edge function as a generic "Edge Function returned
// a non-2xx status code" and hides the body. FunctionsHttpError exposes the raw
// Response on `.context`; pull the real { error, errorCode } out of it.
async function extractInvokeError(error: unknown): Promise<string> {
  const fallback = error instanceof Error ? error.message : 'The request failed.';
  const ctx = (error as { context?: unknown })?.context;
  if (ctx && typeof (ctx as Response).json === 'function') {
    try {
      const body = await (ctx as Response).clone().json();
      if (body?.error) return body.errorCode ? `${body.error} (${body.errorCode})` : body.error;
      if (body?.message) return body.message;
    } catch {
      try {
        const text = await (ctx as Response).clone().text();
        if (text) return text.slice(0, 300);
      } catch { /* ignore */ }
    }
  }
  return fallback;
}

export function useBulkCreativeCopy(accessToken: string | null) {
  const [sources, setSources] = useState<SourceCreative[]>([]);
  const [campaigns, setCampaigns] = useState<TargetCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<CopyResult[]>([]);
  const [summary, setSummary] = useState<CopySummary | null>(null);
  const { toast } = useToast();

  const loadData = useCallback(async (
    accountId: string,
    opts?: { keepResults?: boolean; status?: string },
  ) => {
    if (!accessToken || !accountId) return;
    // 'ALL' (or empty) loads every status; a specific status (default ACTIVE) makes
    // the raw fetch far smaller and the list load much faster on big accounts.
    const status = opts?.status && opts.status !== 'ALL' ? opts.status : '';
    setIsLoading(true);
    if (!opts?.keepResults) {
      setResults([]);
      setSummary(null);
    }
    try {
      const end = new Date();
      const start = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      const dateRange = {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      };

      // Three sources:
      //  - get_creatives (raw adCreativesV2): the authoritative full list. Includes
      //    brand-new DRAFT creatives, which have no analytics and are therefore
      //    invisible to get_creative_report — this is what makes freshly copied ads
      //    show up here.
      //  - get_creative_report (analytics): nicer resolved names + campaign names.
      //  - get_campaigns: campaign id -> name, and the target list.
      const [rawRes, reportRes, campaignsRes] = await Promise.all([
        supabase.functions.invoke('linkedin-api', {
          body: { action: 'get_creatives', accessToken, params: { accountId, status } },
        }),
        supabase.functions.invoke('linkedin-api', {
          body: {
            action: 'get_creative_report',
            accessToken,
            params: { accountId, dateRange, timeGranularity: 'ALL' },
          },
        }),
        supabase.functions.invoke('linkedin-api', {
          body: { action: 'get_campaigns', accessToken, params: { accountId } },
        }),
      ]);

      if (campaignsRes.error) throw new Error(await extractInvokeError(campaignsRes.error));

      const campaignList: TargetCampaign[] = (campaignsRes.data?.elements || [])
        .map((el: Record<string, unknown>) => ({
          id: String(el.id),
          name: (el.name as string) || `Campaign ${el.id}`,
          status: (el.status as string) || 'UNKNOWN',
          type: (el.type as string) || 'UNKNOWN',
        }));
      const campaignNameById = new Map(campaignList.map((c) => [c.id, c.name]));

      // Analytics report → enrichment map keyed by creativeId.
      const reportById = new Map<string, { name?: string; campaignName?: string; type?: string; status?: string }>();
      for (const el of (reportRes.data?.elements || []) as Record<string, unknown>[]) {
        const id = (el.creativeId ?? '').toString();
        if (id) reportById.set(id, {
          name: el.creativeName as string,
          campaignName: el.campaignName as string,
          type: el.type as string,
          status: el.status as string,
        });
      }

      const rawElements = (rawRes.data?.elements || []) as Record<string, unknown>[];

      // Names: analytics report gives real names but only for creatives with data.
      // Creatives sharing the same content reference share a name (a copy and its
      // source point at the same post), so map reference -> name using the report's
      // resolved names, then let unnamed creatives (e.g. fresh drafts) inherit it.
      const nameByReference = new Map<string, string>();
      for (const el of rawElements) {
        const id = (el.id ?? '').toString();
        const ref = (el.reference as string) || '';
        // Prefer the REST-resolved creative name (el.name), then the analytics name.
        const resolved = (el.name as string) || reportById.get(id)?.name || '';
        if (ref && resolved && !nameByReference.has(ref)) nameByReference.set(ref, resolved);
      }

      // Build the source list from raw creatives (full list incl. drafts), overlaying
      // resolved names/campaigns from the report. Fall back to the report list alone
      // if the raw endpoint failed for some reason.
      const seen = new Set<string>();
      const creativeList: SourceCreative[] = [];

      for (const el of rawElements) {
        const creativeId = (el.id ?? '').toString();
        if (!creativeId || seen.has(creativeId)) continue;
        const rep = reportById.get(creativeId);
        const campaignId = String(el.campaign ?? '').split(':').pop() || '';
        const reference = (el.reference as string) || '';
        const variables = (el.variables ?? {}) as Record<string, unknown>;
        const type = (el.type as string) || (variables.type as string) || rep?.type || 'UNKNOWN';
        // Only load ads that can actually be duplicated: they must reuse a shareable
        // content post (a ugcPost/share reference). A reference is the true signal;
        // a known copyable type is a backstop when the raw element hid the reference.
        // This drops Text/Spotlight/Follower/Message/InMail and dynamic ads.
        if (!reference && !(isCopyableType(type) && type.toUpperCase() !== 'UNKNOWN')) continue;
        seen.add(creativeId);
        creativeList.push({
          creativeId,
          creativeName:
            (el.name as string) ||
            (el.creativeDscName as string) ||
            rep?.name ||
            (reference ? nameByReference.get(reference) : undefined) ||
            `Creative ${creativeId}`,
          campaignName: rep?.campaignName || campaignNameById.get(campaignId) || 'Unknown Campaign',
          type,
          status: (el.status as string) || (el.intendedStatus as string) || rep?.status || 'UNKNOWN',
        });
      }

      // Safety net: if the raw list omitted a creative the report knows about, fold it
      // in so nothing that used to show disappears. Respect the status filter so we
      // don't re-add creatives the user filtered out (e.g. non-active ads).
      for (const [id, rep] of reportById) {
        if (seen.has(id)) continue;
        if (status && rep.status && rep.status !== status) continue;
        if (!isCopyableType(rep.type || 'UNKNOWN')) continue; // duplicable types only
        seen.add(id);
        creativeList.push({
          creativeId: id,
          creativeName: rep.name || `Creative ${id}`,
          campaignName: rep.campaignName || 'Unknown Campaign',
          type: rep.type || 'UNKNOWN',
          status: rep.status || 'UNKNOWN',
        });
      }

      // Newest LinkedIn creative IDs sort highest — surface just-created ads at the top.
      creativeList.sort((a, b) => Number(b.creativeId) - Number(a.creativeId));

      setSources(creativeList);
      setCampaigns(campaignList);
    } catch (err: unknown) {
      console.error('Bulk copy load error:', err);
      toast({
        title: 'Failed to load',
        description: err instanceof Error ? err.message : 'Could not load creatives and campaigns.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, toast]);

  const runCopy = useCallback(async (
    accountId: string,
    sourceCreativeIds: string[],
    targetCampaignIds: string[],
    intendedStatus: 'DRAFT' | 'ACTIVE',
  ): Promise<boolean> => {
    if (!accessToken || !accountId) return false;
    setIsRunning(true);
    setResults([]);
    setSummary(null);
    try {
      const { data, error } = await supabase.functions.invoke('linkedin-api', {
        body: {
          action: 'bulk_copy_creatives',
          accessToken,
          params: { accountId, sourceCreativeIds, targetCampaignIds, intendedStatus },
        },
      });

      if (error) {
        // supabase-js hides the real body behind a generic "non-2xx status code".
        // FunctionsHttpError carries the Response on .context — read it so the user
        // sees the actual reason (Unknown action / AUTH_REQUIRED / ROLE_INSUFFICIENT).
        const detail = await extractInvokeError(error);
        toast({ title: 'Bulk copy failed', description: detail, variant: 'destructive' });
        return false;
      }
      if (data?.error) {
        toast({
          title: 'Bulk copy failed',
          description: data.errorCode ? `${data.error} (${data.errorCode})` : data.error,
          variant: 'destructive',
        });
        return false;
      }

      const res: CopyResult[] = data?.results || [];
      const sum: CopySummary = data?.summary || {
        attempted: res.length,
        succeeded: res.filter((r) => r.ok).length,
        failed: res.filter((r) => !r.ok).length,
      };
      setResults(res);
      setSummary(sum);

      if (sum.succeeded === sum.attempted) {
        toast({
          title: 'Ads copied',
          description: `Created ${sum.succeeded} ad(s) as ${intendedStatus}.`,
        });
      } else if (sum.succeeded > 0) {
        toast({
          title: 'Partially completed',
          description: `${sum.succeeded}/${sum.attempted} copies created. See the results table.`,
        });
      } else {
        toast({
          title: 'No ads copied',
          description: 'Every copy failed. See the results table for reasons.',
          variant: 'destructive',
        });
      }
      return sum.succeeded > 0;
    } catch (err: unknown) {
      console.error('Bulk copy run error:', err);
      toast({
        title: 'Bulk copy failed',
        description: err instanceof Error ? err.message : 'The request failed.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsRunning(false);
    }
  }, [accessToken, toast]);

  return {
    sources,
    campaigns,
    isLoading,
    isRunning,
    results,
    summary,
    loadData,
    runCopy,
  };
}
