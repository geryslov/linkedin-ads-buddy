import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AdAccount {
  id: string;
  name: string;
  currency: string;
  status: string;
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
  const { toast } = useToast();

  const fetchAdAccounts = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('linkedin-api', {
        body: { action: 'get_ad_accounts', accessToken }
      });

      if (error) throw error;
      
      const accounts = (data.elements || []).map((el: any) => ({
        id: el.id.toString(),
        name: el.name,
        currency: el.currency,
        status: el.status,
      }));
      
      setAdAccounts(accounts);
      if (accounts.length > 0 && !selectedAccount) {
        setSelectedAccount(accounts[0].id);
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
  }, [accessToken, selectedAccount, toast]);

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

  return {
    adAccounts,
    selectedAccount,
    setSelectedAccount,
    campaigns,
    analytics,
    audiences,
    isLoading,
    fetchAdAccounts,
    fetchCampaigns,
    fetchAnalytics,
    fetchAudiences,
    updateCampaignStatus,
  };
}
