import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { asIntelError, IntelError } from '@/hooks/useCompanyIntelligence';

export interface AudienceStatus {
  status: string;
  inputCount: number | null;
  matchedCount: number | null;
  audienceSize: number | null;
  adSegment: string;
}

export interface CreatedAudience {
  accountId: string;
  segmentId: string;
  name: string;
  companies: number;
  skipped: number;
  at: string;
  status?: AudienceStatus | IntelError | 'loading';
}

async function call<T>(accessToken: string, action: string, params: Record<string, unknown>, isValid: (d: Record<string, unknown> | null) => boolean): Promise<T> {
  const { data, error } = await supabase.functions.invoke('linkedin-api', { body: { action, accessToken, params } });
  if (error) throw error;
  if (data?.error) throw Object.assign(new Error(data.error), { kind: data.kind });
  if (!isValid(data)) throw Object.assign(new Error('The deployed edge function can\'t create audiences yet — deploy linkedin-api.'), { kind: 'stale_deploy' });
  return data as T;
}

// An edge deploy without these actions answers 400 "Unknown action".
const staleIfUnknown = (e: IntelError): IntelError => (/unknown action/i.test(e.message)
  ? { message: 'The deployed edge function can\'t create audiences yet — deploy linkedin-api.', kind: 'stale_deploy' }
  : e);

/** Company matched audiences created from momentum lists (LinkedIn CSV list upload). */
export function useCompanyAudience(accessToken: string | null) {
  const [created, setCreated] = useState<CreatedAudience[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<IntelError | null>(null);

  const create = useCallback(async (accountId: string, name: string, companies: { name: string; website: string; pageUrl: string }[]) => {
    if (!accessToken || !accountId) return null;
    setCreating(true);
    setError(null);
    try {
      const r = await call<Omit<CreatedAudience, 'accountId' | 'at'>>(accessToken, 'create_company_audience', { accountId, name, companies }, (d) => typeof d?.segmentId === 'string');
      const a: CreatedAudience = { ...r, accountId, at: new Date().toISOString() };
      setCreated((l) => [a, ...l]);
      return a;
    } catch (e) {
      setError(staleIfUnknown(await asIntelError(e)));
      return null;
    } finally {
      setCreating(false);
    }
  }, [accessToken]);

  const refresh = useCallback(async (segmentId: string) => {
    if (!accessToken) return;
    const set = (status: CreatedAudience['status']) => setCreated((l) => l.map((a) => (a.segmentId === segmentId ? { ...a, status } : a)));
    set('loading');
    try {
      set(await call<AudienceStatus>(accessToken, 'get_company_audience', { segmentId }, (d) => typeof d?.status === 'string'));
    } catch (e) {
      set(staleIfUnknown(await asIntelError(e)));
    }
  }, [accessToken]);

  const clearError = useCallback(() => setError(null), []);

  return { created, creating, error, create, refresh, clearError };
}
