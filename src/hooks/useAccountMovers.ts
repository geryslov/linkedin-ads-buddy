import { useCallback, useState } from 'react';
import { invoke, asIntelError, DECISION_MAKER_SENIORITIES, IntelError } from '@/hooks/useCompanyIntelligence';
import { buildMovers, MoversResult } from '@/lib/accountMovers';
import type { CompanyIntelligence } from '@/hooks/useCompanyIntelligence';

export interface AccountMovers extends MoversResult {
  accountId: string;
  at: string;
  truncated: boolean;
  /** Raw runs, so the card can re-classify by paid / organic without refetching. */
  raw: { c30: CompanyIntelligence[]; c90: CompanyIntelligence[]; dm: CompanyIntelligence[] | null };
  /** The decision-maker run failed — the DM flag is missing, the lists are not. */
  dmError: IntelError | null;
}

/** Three Account Intel calls: all companies at 30d and 90d, plus the Director+ run (90d). */
export function useAccountMovers(accessToken: string | null) {
  const [movers, setMovers] = useState<AccountMovers | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<IntelError | null>(null);

  const load = useCallback(async (accountId: string) => {
    if (!accessToken || !accountId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [r30, r90, rdm] = await Promise.allSettled([
        invoke(accessToken, { accountId, lookbackWindow: 'LAST_30_DAYS' }),
        invoke(accessToken, { accountId, lookbackWindow: 'LAST_90_DAYS' }),
        invoke(accessToken, { accountId, lookbackWindow: 'LAST_90_DAYS', seniorities: DECISION_MAKER_SENIORITIES }),
      ]);
      if (r30.status === 'rejected') throw r30.reason;
      if (r90.status === 'rejected') throw r90.reason;
      const dm = rdm.status === 'fulfilled' ? rdm.value : null;
      setMovers({
        ...buildMovers(r30.value.companies, r90.value.companies, dm?.companies ?? null),
        raw: { c30: r30.value.companies, c90: r90.value.companies, dm: dm?.companies ?? null },
        accountId,
        at: new Date().toISOString(),
        truncated: r30.value.meta.truncated || r90.value.meta.truncated || !!dm?.meta.truncated,
        dmError: rdm.status === 'rejected' ? await asIntelError(rdm.reason) : null,
      });
    } catch (e) {
      setMovers(null);
      setError(await asIntelError(e));
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  const reset = useCallback(() => { setMovers(null); setError(null); }, []);

  return { movers, isLoading, error, load, reset };
}
