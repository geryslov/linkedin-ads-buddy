import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface GoogleAdsAccount {
  id: string;
  name: string;
  currency: string;
  loginCustomerId: string;
}

export interface GoogleAdsLink {
  accountId: string;
  googleCustomerId: string;
  googleCustomerName: string | null;
  loginCustomerId: string | null;
  currencyCode: string | null;
}

/**
 * Google Ads accounts reachable from the connected Google account, and the
 * mapping between each LinkedIn ad account and its Google Ads account.
 */
export function useGoogleAdsLinks(accessToken: string | null, accountIds?: string[]) {
  const [accounts, setAccounts] = useState<GoogleAdsAccount[]>([]);
  const [links, setLinks] = useState<Record<string, GoogleAdsLink>>({});
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const accountsLoaded = useRef(false);

  const loadAccounts = useCallback(async (force = false) => {
    if (accountsLoaded.current && !force) return;
    accountsLoaded.current = true;
    setIsLoadingAccounts(true);
    setAccountsError(null);
    try {
      const { data, error } = await supabase.functions.invoke('linkedin-api', {
        body: { action: 'list_google_ads_accounts', accessToken, params: {} },
      });
      if (error || data?.error) {
        setAccountsError(data?.error || error?.message || 'Could not load Google Ads accounts');
        accountsLoaded.current = false;
        return;
      }
      setAccounts(Array.isArray(data?.accounts) ? data.accounts : []);
    } catch (_e) {
      setAccountsError('Could not load Google Ads accounts');
      accountsLoaded.current = false;
    } finally {
      setIsLoadingAccounts(false);
    }
  }, [accessToken]);

  const loadLinks = useCallback(async (ids?: string[]) => {
    try {
      const { data, error } = await supabase.functions.invoke('linkedin-api', {
        body: { action: 'get_google_ads_links', accessToken, params: { accountIds: ids } },
      });
      if (error || data?.error) return;
      const map: Record<string, GoogleAdsLink> = {};
      for (const l of (data?.links || [])) map[l.accountId] = l;
      setLinks(map);
    } catch (_e) { /* ignore */ }
  }, [accessToken]);

  const idsKey = (accountIds || []).join(',');
  useEffect(() => {
    if (!accessToken) return;
    loadLinks(accountIds && accountIds.length ? accountIds : undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, idsKey]);

  const saveLink = useCallback(async (accountId: string, account: GoogleAdsAccount | null) => {
    const { data, error } = await supabase.functions.invoke('linkedin-api', {
      body: {
        action: 'save_google_ads_link',
        accessToken,
        params: {
          accountId,
          googleCustomerId: account?.id || null,
          googleCustomerName: account?.name || null,
          loginCustomerId: account?.loginCustomerId || null,
          currencyCode: account?.currency || null,
        },
      },
    });
    if (error || data?.error) {
      return { ok: false, message: data?.error || error?.message || 'Could not save the link' };
    }
    setLinks(prev => {
      const next = { ...prev };
      if (account) {
        next[accountId] = {
          accountId,
          googleCustomerId: account.id,
          googleCustomerName: account.name,
          loginCustomerId: account.loginCustomerId,
          currencyCode: account.currency,
        };
      } else {
        delete next[accountId];
      }
      return next;
    });
    return { ok: true, message: '' };
  }, [accessToken]);

  return { accounts, links, isLoadingAccounts, accountsError, loadAccounts, loadLinks, saveLink };
}
