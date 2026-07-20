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

  // Wide default window so the source list is as complete as possible. Creatives
  // with zero data in this window won't appear (get_creative_report is analytics
  // based) — acceptable for a "copy a proven ad" workflow.
  const loadData = useCallback(async (accountId: string) => {
    if (!accessToken || !accountId) return;
    setIsLoading(true);
    setResults([]);
    setSummary(null);
    try {
      const end = new Date();
      const start = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      const dateRange = {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      };

      const [creativesRes, campaignsRes] = await Promise.all([
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

      if (creativesRes.error) throw new Error(await extractInvokeError(creativesRes.error));
      if (campaignsRes.error) throw new Error(await extractInvokeError(campaignsRes.error));

      const creativeList: SourceCreative[] = (creativesRes.data?.elements || [])
        .map((el: Record<string, unknown>) => ({
          creativeId: (el.creativeId ?? '').toString(),
          creativeName: (el.creativeName as string) || `Creative ${el.creativeId ?? 'Unknown'}`,
          campaignName: (el.campaignName as string) || 'Unknown Campaign',
          type: (el.type as string) || 'UNKNOWN',
          status: (el.status as string) || 'UNKNOWN',
        }))
        .filter((c: SourceCreative) => c.creativeId)
        // de-dupe: get_creative_report can list a creative once per time bucket
        .filter((c: SourceCreative, i: number, arr: SourceCreative[]) =>
          arr.findIndex((x) => x.creativeId === c.creativeId) === i);

      const campaignList: TargetCampaign[] = (campaignsRes.data?.elements || [])
        .map((el: Record<string, unknown>) => ({
          id: String(el.id),
          name: (el.name as string) || `Campaign ${el.id}`,
          status: (el.status as string) || 'UNKNOWN',
          type: (el.type as string) || 'UNKNOWN',
        }));

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
