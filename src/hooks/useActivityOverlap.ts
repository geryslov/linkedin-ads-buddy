import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Breakdowns, OverlapCampaign } from '@/lib/activityOverlap';

export interface CompanyName { name: string; website?: string }

export interface OverlapData {
  campaigns: OverlapCampaign[];          // every campaign except DRAFT
  breakdowns: Breakdowns;
  accountImpressions: number | null;     // account-level, same dates; null if the query failed
  failedBatches: number;
}

export interface OverlapRange { start: string; end: string }

// Raw responses per account + dates: these calls are slow and heavy.
const dataCache = new Map<string, OverlapData>();
const nameCache = new Map<string, Record<string, CompanyName>>();
const BATCH = 25;
const PARALLEL = 2;
const NAME_PAGE = 500;
const NAME_PARALLEL = 3;

async function call<T>(action: string, accessToken: string, params: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('linkedin-api', { body: { action, accessToken, params } });
  if (error) throw new Error(error.message || `${action} failed`);
  if (data?.error) throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
  return data as T;
}

export function useActivityOverlap(accessToken: string | null, accountId: string | null, range: OverlapRange) {
  const key = `${accountId}|${range.start}|${range.end}`;
  const [data, setData] = useState<OverlapData | null>(() => dataCache.get(key) ?? null);
  const [names, setNames] = useState<Record<string, CompanyName>>(() => nameCache.get(key) ?? {});
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [namesLoading, setNamesLoading] = useState(false);
  const [namesProgress, setNamesProgress] = useState<{ done: number; total: number } | null>(null);
  const [namesError, setNamesError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const live = useRef(key);

  useEffect(() => {
    live.current = key;
    setData(dataCache.get(key) ?? null);
    setNames(nameCache.get(key) ?? {});
    setError(null);
    setNamesError(null);
    setProgress(null);
    setNamesProgress(null);
  }, [key]);

  const loadNames = useCallback(async (k: string) => {
    if (!accessToken || !accountId) return;
    setNamesLoading(true);
    setNamesError(null);
    const out: Record<string, CompanyName> = {};
    // Each call resolves its slice through LinkedIn's org lookup 50 at a time, so big slices run for minutes.
    // Small slices, a few in flight; the first one reports how many companies there are.
    const page = async (offset: number) => {
      const res = await call<{ elements?: { entityUrn: string; entityName?: string; website?: string }[]; metadata?: { totalCompanies?: number } }>(
        'get_company_demographic', accessToken, { accountId, dateRange: range, offset, limit: NAME_PAGE },
      );
      for (const e of res.elements || []) if (e.entityUrn && e.entityName) out[e.entityUrn] = { name: e.entityName, website: e.website || undefined };
      if (live.current === k) setNames({ ...out });
      return res.metadata?.totalCompanies ?? 0;
    };
    try {
      const total = Math.min(await page(0), 100000);
      const offsets: number[] = [];
      for (let o = NAME_PAGE; o < total; o += NAME_PAGE) offsets.push(o);
      let next = 0, done = 1, failed = 0;
      if (live.current === k) setNamesProgress({ done, total: offsets.length + 1 });
      const worker = async () => {
        while (next < offsets.length) {
          const o = offsets[next++];
          try { await page(o).catch(() => page(o)); } catch { failed++; }
          done++;
          if (live.current === k) setNamesProgress({ done, total: offsets.length + 1 });
        }
      };
      await Promise.all(Array.from({ length: NAME_PARALLEL }, worker));
      if (failed) throw new Error(`${failed} of ${offsets.length + 1} name batches failed`);
      nameCache.set(k, out);
    } catch (e) {
      if (live.current === k) setNamesError(e instanceof Error ? e.message : String(e));
    } finally {
      if (live.current === k) { setNamesLoading(false); setNamesProgress(null); }
    }
  }, [accessToken, accountId, range]);

  const load = useCallback(async (force = false) => {
    if (!accessToken || !accountId) return;
    const k = key;
    if (!force && dataCache.has(k)) {
      setData(dataCache.get(k)!);
      if (!nameCache.has(k)) loadNames(k);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Names don't depend on the breakdowns, so they load alongside the scan.
      if (force || !nameCache.has(k)) loadNames(k);
      else if (live.current === k) setNames(nameCache.get(k)!);
      // One campaign-pivot call says which campaigns delivered, so only those get a per-company query.
      const [res, delivery] = await Promise.all([
        call<{ elements?: Record<string, unknown>[]; message?: string }>('get_campaigns', accessToken, { accountId }),
        call<{ elements?: { campaignId: string; impressions?: number; clicks?: number }[] }>('get_campaign_report', accessToken, { accountId, dateRange: range })
          .catch(() => null),
      ]);
      // The action passes LinkedIn's payload through, so a 401/403 arrives as a body without elements.
      if (!Array.isArray(res.elements)) throw new Error(res.message || 'LinkedIn returned no campaign list');
      // Strip to what the report needs: the raw list carries targeting criteria (700KB+).
      const campaigns: OverlapCampaign[] = (res.elements || [])
        .map((c) => ({
          id: String(c.id), name: String(c.name ?? `Campaign ${c.id}`), status: String(c.status ?? ''),
          format: c.format as string | undefined, type: c.type as string | undefined, objectiveType: c.objectiveType as string | undefined,
        }))
        .filter((c) => c.status !== 'DRAFT');
      const delivered = new Set((delivery?.elements || []).filter((r) => r.impressions || r.clicks).map((r) => String(r.campaignId)));
      const accountImpressions = delivered.size ? (delivery!.elements || []).reduce((s, r) => s + (r.impressions || 0), 0) : null;
      // The report swallows LinkedIn analytics errors as zeros, so an empty set falls back to the schedule filter:
      // campaigns scheduled entirely outside the window can't have rows.
      const from = Date.parse(range.start), to = Date.parse(range.end) + 86400000;
      const sched = new Map((res.elements || []).map((c) => [String(c.id), (c.runSchedule || {}) as { start?: number; end?: number }]));
      const inWindow = campaigns.filter((c) => {
        if (delivered.size) return delivered.has(c.id);
        const r = sched.get(c.id) || {};
        return !(r.end && r.end < from) && !(r.start && r.start > to);
      });

      const breakdowns: Breakdowns = {};
      let failedBatches = 0;
      const batches: OverlapCampaign[][] = [];
      for (let i = 0; i < inWindow.length; i += BATCH) batches.push(inWindow.slice(i, i + BATCH));
      setProgress({ done: 0, total: batches.length });
      const runBatch = (batch: OverlapCampaign[]) =>
        call<{ breakdowns?: Record<string, { campaignId: string; impressions?: number; clicks?: number }[]> }>(
          'get_company_campaign_breakdown', accessToken, {
            accountId,
            campaignIds: batch.map((c) => c.id),
            campaignNames: Object.fromEntries(batch.map((c) => [c.id, c.name])),
            dateRange: range, // {start, end} strings; top-level startDate/endDate would be ignored
          },
        );
      // Two calls in flight (the edge runs 5 campaigns at a time inside each); a failed batch gets one retry.
      let next = 0, done = 0;
      const worker = async () => {
        while (next < batches.length) {
          const batch = batches[next++];
          try {
            const r = await runBatch(batch).catch(() => runBatch(batch));
            for (const [urn, rows] of Object.entries(r.breakdowns || {})) {
              const kept = rows
                .map((x) => ({ campaignId: String(x.campaignId), impressions: x.impressions || 0, clicks: x.clicks || 0 }))
                .filter((x) => x.impressions || x.clicks);
              if (kept.length) (breakdowns[urn] ||= []).push(...kept);
            }
          } catch {
            failedBatches++;
          }
          done++;
          if (live.current === k) setProgress({ done, total: batches.length });
        }
      };
      await Promise.all(Array.from({ length: PARALLEL }, worker));

      const result = { campaigns, breakdowns, accountImpressions, failedBatches };
      dataCache.set(k, result);
      if (live.current === k) setData(result);
    } catch (e) {
      if (live.current === k) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (live.current === k) { setLoading(false); setProgress(null); }
    }
  }, [accessToken, accountId, key, range, loadNames]);

  return { data, names, loading, progress, namesLoading, namesProgress, namesError, error, load };
}
