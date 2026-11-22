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
const NAME_PAGE = 2500;

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
  }, [key]);

  const loadNames = useCallback(async (k: string) => {
    if (!accessToken || !accountId) return;
    setNamesLoading(true);
    setNamesError(null);
    const out: Record<string, CompanyName> = {};
    try {
      for (let offset = 0; offset < 100000; offset += NAME_PAGE) {
        const res = await call<{ elements?: { entityUrn: string; entityName?: string; website?: string }[]; metadata?: { hasMore?: boolean } }>(
          'get_company_demographic', accessToken, { accountId, dateRange: range, offset, limit: NAME_PAGE },
        );
        for (const e of res.elements || []) if (e.entityUrn && e.entityName) out[e.entityUrn] = { name: e.entityName, website: e.website || undefined };
        if (live.current === k) setNames({ ...out });
        if (!res.metadata?.hasMore) break;
      }
      nameCache.set(k, out);
    } catch (e) {
      if (live.current === k) setNamesError(e instanceof Error ? e.message : String(e));
    } finally {
      if (live.current === k) setNamesLoading(false);
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
      const res = await call<{ elements?: Record<string, unknown>[]; message?: string }>('get_campaigns', accessToken, { accountId });
      // The action passes LinkedIn's payload through, so a 401/403 arrives as a body without elements.
      if (!Array.isArray(res.elements)) throw new Error(res.message || 'LinkedIn returned no campaign list');
      // Strip to what the report needs: the raw list carries targeting criteria (700KB+).
      const campaigns: OverlapCampaign[] = (res.elements || [])
        .map((c) => ({
          id: String(c.id), name: String(c.name ?? `Campaign ${c.id}`), status: String(c.status ?? ''),
          format: c.format as string | undefined, type: c.type as string | undefined, objectiveType: c.objectiveType as string | undefined,
        }))
        .filter((c) => c.status !== 'DRAFT');
      // Campaigns scheduled entirely outside the window can't have rows; skip the calls.
      const from = Date.parse(range.start), to = Date.parse(range.end) + 86400000;
      const sched = new Map((res.elements || []).map((c) => [String(c.id), (c.runSchedule || {}) as { start?: number; end?: number }]));
      const inWindow = campaigns.filter((c) => {
        const r = sched.get(c.id) || {};
        return !(r.end && r.end < from) && !(r.start && r.start > to);
      });

      const breakdowns: Breakdowns = {};
      let failedBatches = 0;
      const batches: OverlapCampaign[][] = [];
      for (let i = 0; i < inWindow.length; i += BATCH) batches.push(inWindow.slice(i, i + BATCH));
      setProgress({ done: 0, total: batches.length });
      // Sequential: the edge already queries 5 campaigns at a time inside each call.
      for (const [i, batch] of batches.entries()) {
        try {
          const r = await call<{ breakdowns?: Record<string, { campaignId: string; impressions?: number; clicks?: number }[]> }>(
            'get_company_campaign_breakdown', accessToken, {
              accountId,
              campaignIds: batch.map((c) => c.id),
              campaignNames: Object.fromEntries(batch.map((c) => [c.id, c.name])),
              dateRange: range, // {start, end} strings; top-level startDate/endDate would be ignored
            },
          );
          for (const [urn, rows] of Object.entries(r.breakdowns || {})) {
            const kept = rows
              .map((x) => ({ campaignId: String(x.campaignId), impressions: x.impressions || 0, clicks: x.clicks || 0 }))
              .filter((x) => x.impressions || x.clicks);
            if (kept.length) (breakdowns[urn] ||= []).push(...kept);
          }
        } catch {
          failedBatches++;
        }
        if (live.current === k) setProgress({ done: i + 1, total: batches.length });
      }

      let accountImpressions: number | null = null;
      try {
        const a = await call<{ elements?: { impressions?: number }[] }>('get_analytics', accessToken, { accountId, dateRange: range });
        accountImpressions = (a.elements || []).reduce((s, e) => s + (e.impressions || 0), 0);
      } catch { /* the coverage check is skipped */ }

      const result = { campaigns, breakdowns, accountImpressions, failedBatches };
      dataCache.set(k, result);
      if (live.current === k) setData(result);
      if (force || !nameCache.has(k)) loadNames(k);
      else if (live.current === k) setNames(nameCache.get(k)!);
    } catch (e) {
      if (live.current === k) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (live.current === k) { setLoading(false); setProgress(null); }
    }
  }, [accessToken, accountId, key, range, loadNames]);

  return { data, names, loading, progress, namesLoading, namesError, error, load };
}
