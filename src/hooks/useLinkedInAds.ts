import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AdAccount {
  id: string;
  accountUrn: string;
  name: string;
  currency: string;
  status: string;
  type: string; // BUSINESS, ENTERPRISE, etc.
  userRole: string;
  accessSource: string;
  canWrite: boolean;
  isDefault?: boolean;
}

export interface Campaign {
  id: string;
  name: string;
  status: string;
  type: string;
  dailyBudget?: { amount: string; currencyCode: string };
  totalBudget?: { amount: string; currencyCode: string };
  costType: string;
}

export interface Analytics {
  impressions: number;
  clicks: number;
  costInLocalCurrency: string;
  conversions: number;
  ctr: number;
  cpc: number;
}

export interface Audience {
  id: string;
  name: string;
  matchedCount: number;
  status: string;
}

export function useLinkedInAds(accessToken: string | null) {
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDefault, setIsLoadingDefault] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const { toast } = useToast();

  // Load default account from database on mount
  const loadDefaultAccount = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setIsLoadingDefault(false);
        return null;
      }

      const { data, error } = await supabase
        .from('user_linked_accounts')
        .select('account_id, account_name, user_role, can_write')
        .eq('user_id', session.user.id)
        .eq('is_default', true)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
        console.error('Error loading default account:', error);
      }

      // Also load last synced time from linkedin_ad_accounts
      const { data: syncData } = await supabase
        .from('linkedin_ad_accounts')
        .select('last_synced_at')
        .eq('user_id', session.user.id)
        .order('last_synced_at', { ascending: false })
        .limit(1)
        .single();

      if (syncData?.last_synced_at) {
        setLastSyncedAt(syncData.last_synced_at);
      }

      setIsLoadingDefault(false);
      return data?.account_id || null;
    } catch (err) {
      console.error('Error loading default account:', err);
      setIsLoadingDefault(false);
      return null;
    }
  }, []);

  // Save account as default to database
  const setDefaultAccount = useCallback(async (accountId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return false;

      const account = adAccounts.find(a => a.id === accountId);
      if (!account) return false;

      // First, clear any existing default
      await supabase
        .from('user_linked_accounts')
        .update({ is_default: false })
        .eq('user_id', session.user.id)
        .eq('is_default', true);

      // Upsert the new default
      const { error } = await supabase
        .from('user_linked_accounts')
        .upsert({
          user_id: session.user.id,
          account_id: accountId,
          account_name: account.name,
          user_role: account.userRole,
          can_write: account.canWrite,
          is_default: true,
          last_accessed_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,account_id',
        });

      if (error) {
        console.error('Error setting default account:', error);
        return false;
      }

      // Update local state to reflect the default
      setAdAccounts(prev => prev.map(a => ({
        ...a,
        isDefault: a.id === accountId,
      })));

      toast({
        title: 'Default Account Set',
        description: `${account.name} is now your default account.`,
      });

      return true;
    } catch (err) {
      console.error('Error setting default account:', err);
      return false;
    }
  }, [adAccounts, toast]);

  const fetchAdAccounts = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    
    try {
      // Load saved default account ID first
      const defaultAccountId = await loadDefaultAccount();

      const { data, error } = await supabase.functions.invoke('linkedin-api', {
        body: { action: 'get_ad_accounts', accessToken }
      });

      if (error) throw error;
      
      const accounts: AdAccount[] = (data.elements || []).map((el: any) => ({
        id: el.id.toString(),
        accountUrn: el.accountUrn || `urn:li:sponsoredAccount:${el.id}`,
        name: el.name,
        currency: el.currency,
        status: el.status,
        type: el.type || 'UNKNOWN',
        userRole: el.userRole || 'UNKNOWN',
        accessSource: el.accessSource || 'unknown',
        canWrite: el.canWrite ?? false,
        isDefault: el.id.toString() === defaultAccountId,
      }));
      
      setAdAccounts(accounts);

      // Auto-select logic:
      // 1. If saved default exists and is in the list, select it
      // 2. If only one account, auto-select and save as default
      // 3. Otherwise, wait for user selection
      if (accounts.length > 0) {
        if (defaultAccountId && accounts.some(a => a.id === defaultAccountId)) {
          setSelectedAccount(defaultAccountId);
        } else if (accounts.length === 1) {
          setSelectedAccount(accounts[0].id);
          // Auto-save single account as default
          await setDefaultAccount(accounts[0].id);
        }
      }
    } catch (error: any) {
      console.error('Fetch ad accounts error:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch ad accounts',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, loadDefaultAccount, setDefaultAccount, toast]);

  // Sync ad accounts - fetches from LinkedIn and caches to database
  const syncAdAccounts = useCallback(async () => {
    if (!accessToken) return { success: false };
    setIsSyncing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('linkedin-api', {
        body: { action: 'sync_ad_accounts', accessToken }
      });

      if (error) throw error;
      
      if (!data.success && data.error) {
        throw new Error(data.error);
      }

      const accounts: AdAccount[] = (data.accounts || []).map((el: any) => ({
        id: el.id.toString(),
        accountUrn: el.accountUrn || `urn:li:sponsoredAccount:${el.id}`,
        name: el.name,
        currency: el.currency,
        status: el.status,
        type: el.type || 'UNKNOWN',
        userRole: el.userRole || 'UNKNOWN',
        accessSource: el.accessSource || 'unknown',
        canWrite: el.canWrite ?? false,
        isDefault: el.id.toString() === selectedAccount,
      }));
      
      setAdAccounts(accounts);
      setLastSyncedAt(data.syncedAt);

      // If default was invalidated, clear selection and show warning
      if (data.defaultInvalidated) {
        setSelectedAccount(null);
        toast({
          title: 'Account Access Changed',
          description: 'Your default account is no longer accessible. Please select another.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Accounts Synced',
          description: `Found ${accounts.length} ad account${accounts.length !== 1 ? 's' : ''}`,
        });
      }

      // Auto-select if only one account
      if (accounts.length === 1 && !selectedAccount) {
        setSelectedAccount(accounts[0].id);
        await setDefaultAccount(accounts[0].id);
      }

      return { success: true, accounts };
    } catch (error: any) {
      console.error('Sync ad accounts error:', error);
      toast({
        title: 'Sync Failed',
        description: error.message || 'Could not refresh ad accounts from LinkedIn',
        variant: 'destructive',
      });
      return { success: false };
    } finally {
      setIsSyncing(false);
    }
  }, [accessToken, selectedAccount, setDefaultAccount, toast]);

  const fetchCampaigns = useCallback(async (accountId?: string) => {
    if (!accessToken) return;
    const account = accountId || selectedAccount;
    if (!account) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('linkedin-api', {
        body: { 
          action: 'get_campaigns', 
          accessToken,
          params: { accountId: account }
        }
      });

      if (error) throw error;
      
      const campaignList = (data.elements || []).map((el: any) => ({
        id: el.id.toString(),
        name: el.name,
        status: el.status,
        type: el.type,
        dailyBudget: el.dailyBudget,
        totalBudget: el.totalBudget,
        costType: el.costType,
      }));
      
      setCampaigns(campaignList);
    } catch (error: any) {
      console.error('Fetch campaigns error:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch campaigns',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, selectedAccount, toast]);

  const fetchAnalytics = useCallback(async (accountId?: string, dateRange?: { start: string; end: string }) => {
    if (!accessToken) return;
    const account = accountId || selectedAccount;
    if (!account) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('linkedin-api', {
        body: { 
          action: 'get_analytics', 
          accessToken,
          params: { accountId: account, dateRange }
        }
      });

      if (error) throw error;
      
      const elements = data.elements || [];
      const totals = elements.reduce((acc: any, el: any) => ({
        impressions: acc.impressions + (el.impressions || 0),
        clicks: acc.clicks + (el.clicks || 0),
        costInLocalCurrency: parseFloat(acc.costInLocalCurrency) + parseFloat(el.costInLocalCurrency || '0'),
        conversions: acc.conversions + (el.conversions || 0),
      }), { impressions: 0, clicks: 0, costInLocalCurrency: 0, conversions: 0 });

      setAnalytics({
        ...totals,
        costInLocalCurrency: totals.costInLocalCurrency.toFixed(2),
        ctr: totals.impressions > 0 ? ((totals.clicks / totals.impressions) * 100).toFixed(2) : 0,
        cpc: totals.clicks > 0 ? (totals.costInLocalCurrency / totals.clicks).toFixed(2) : 0,
      });
    } catch (error: any) {
      console.error('Fetch analytics error:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch analytics',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, selectedAccount, toast]);

  const fetchAudiences = useCallback(async (accountId?: string) => {
    if (!accessToken) return;
    const account = accountId || selectedAccount;
    if (!account) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('linkedin-api', {
        body: { 
          action: 'get_audiences', 
          accessToken,
          params: { accountId: account }
        }
      });

      if (error) throw error;
      
      const audienceList = (data.elements || []).map((el: any) => ({
        id: el.id.toString(),
        name: el.name,
        matchedCount: el.matchedCount || 0,
        status: el.status,
      }));
      
      setAudiences(audienceList);
    } catch (error: any) {
      console.error('Fetch audiences error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, selectedAccount, toast]);

  const updateCampaignStatus = useCallback(async (campaignId: string, status: string) => {
    if (!accessToken) return false;
    
    try {
      const { data, error } = await supabase.functions.invoke('linkedin-api', {
        body: { 
          action: 'update_campaign_status', 
          accessToken,
          params: { campaignId, status }
        }
      });

      if (error) throw error;
      
      // Handle specific error codes from the response
      if (data.errorCode) {
        if (data.errorCode === 'TOKEN_EXPIRED') {
          toast({
            title: 'Session Expired',
            description: data.message || 'Please re-authenticate with LinkedIn.',
            variant: 'destructive',
          });
        } else if (data.errorCode === 'PERMISSION_DENIED' || data.errorCode === 'ROLE_INSUFFICIENT') {
          toast({
            title: 'Access Denied',
            description: data.message || 'You don\'t have permission for this action.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Error',
            description: data.message || 'Failed to update campaign status',
            variant: 'destructive',
          });
        }
        return false;
      }
      
      if (data.success) {
        toast({
          title: 'Success',
          description: `Campaign status updated to ${status}`,
        });
        await fetchCampaigns();
        return true;
      }
      return false;
    } catch (error: any) {
      console.error('Update campaign status error:', error);
      toast({
        title: 'Error',
        description: 'Failed to update campaign status',
        variant: 'destructive',
      });
      return false;
    }
  }, [accessToken, fetchCampaigns, toast]);

  // Get current account's canWrite status
  const currentAccountCanWrite = adAccounts.find(a => a.id === selectedAccount)?.canWrite ?? false;

  return {
    adAccounts,
    selectedAccount,
    setSelectedAccount,
    campaigns,
    analytics,
    audiences,
    isLoading,
    isLoadingDefault,
    isSyncing,
    lastSyncedAt,
    currentAccountCanWrite,
    fetchAdAccounts,
    fetchCampaigns,
    fetchAnalytics,
    fetchAudiences,
    updateCampaignStatus,
    setDefaultAccount,
    syncAdAccounts,
  };
}
