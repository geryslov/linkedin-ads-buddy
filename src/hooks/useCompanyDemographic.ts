import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface CampaignBreakdownItem {
  campaignId: string;
  campaignName: string;
  impressions: number;
  clicks: number;
  landingPageClicks: number;
  spent: number;
  leads: number;
  engagements: number;
  likes: number;
  comments: number;
  reactions: number;
  shares: number;
  ctr: number;
  cpc: number;
  cpm: number;
}

export interface ObjectiveBreakdownItem {
  objective: string;
  impressions: number;
  clicks: number;
  landingPageClicks: number;
  spent: number;
  leads: number;
  engagements: number;
  likes: number;
  comments: number;
  reactions: number;
  shares: number;
  ctr: number;
  cpc: number;
  cpm: number;
  campaignIds?: string[];
  campaignNames?: Record<string, string>;
  campaignBreakdown?: CampaignBreakdownItem[];
}

export interface CompanyDemographicItem {
  entityUrn: string;
  entityName: string;
  website: string | null;
  linkedInUrl: string | null;
  enrichmentStatus: 'resolved' | 'fallback' | 'unresolved';
  impressions: number;
  clicks: number;
  landingPageClicks: number;
  spent: number;
  leads: number;
  engagements: number;
  likes: number;
  comments: number;
  reactions: number;
  shares: number;
  ctr: number;
  cpc: number;
  cpm: number;
  objectiveBreakdown?: ObjectiveBreakdownItem[];
}

export type TimeGranularity = 'DAILY' | 'MONTHLY' | 'ALL';

export interface TimeFrameOption {
  label: string;
  value: string;
  startDate: Date;
  endDate: Date;
}

export function useCompanyDemographic(accessToken: string | null) {
  const [companyData, setCompanyData] = useState<CompanyDemographicItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeGranularity, setTimeGranularity] = useState<TimeGranularity>('ALL');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
  const [loadingObjectives, setLoadingObjectives] = useState<Set<string>>(new Set());
  const [campaignBreakdownCache, setCampaignBreakdownCache] = useState<Map<string, CampaignBreakdownItem[]>>(new Map());
  const [objectiveBreakdownCache, setObjectiveBreakdownCache] = useState<Map<string, ObjectiveBreakdownItem[]>>(new Map());
  const [isLoadingObjectiveBreakdowns, setIsLoadingObjectiveBreakdowns] = useState(false);
  const [objectiveBreakdownsFetched, setObjectiveBreakdownsFetched] = useState(false);
  // Pagination progress state
  const [loadingProgress, setLoadingProgress] = useState<{ loaded: number; total: number } | null>(null);
  const { toast } = useToast();

  const timeFrameOptions: TimeFrameOption[] = useMemo(() => {
    const today = new Date();
    return [
      { label: 'Last 7 days', value: '7d', startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), endDate: today },
      { label: 'Last 14 days', value: '14d', startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), endDate: today },
      { label: 'Last 30 days', value: '30d', startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), endDate: today },
      { label: 'Last 90 days', value: '90d', startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), endDate: today },
      { label: 'This month', value: 'this_month', startDate: new Date(today.getFullYear(), today.getMonth(), 1), endDate: today },
      { label: 'Last month', value: 'last_month', startDate: new Date(today.getFullYear(), today.getMonth() - 1, 1), endDate: new Date(today.getFullYear(), today.getMonth(), 0) },
    ];
  }, []);

  const fetchCompanyDemographic = useCallback(async (accountId: string, campaignIds?: string[]) => {
    if (!accessToken || !accountId) return;
    setIsLoading(true);
    setError(null);
    setCampaignBreakdownCache(new Map());
    setLoadingObjectives(new Set());
    setObjectiveBreakdownCache(new Map());
    setObjectiveBreakdownsFetched(false);
    setIsLoadingObjectiveBreakdowns(false);
    setCompanyData([]);
    setLoadingProgress(null);
    
    const campaignsToFilter = campaignIds || selectedCampaignIds;
    
    try {
      let page = 0;
      let hasMore = true;
      let allCompanies: CompanyDemographicItem[] = [];
      
      while (hasMore) {
        console.log(`Fetching company demographic page ${page}...`);
        
        const { data, error: fetchError } = await supabase.functions.invoke('linkedin-api', {
          body: { 
            action: 'get_company_demographic', 
            accessToken,
            params: { 
              accountId, 
              dateRange,
              timeGranularity,
              campaignIds: campaignsToFilter.length > 0 ? campaignsToFilter : undefined,
              page,
            }
          }
        });

        if (fetchError) throw fetchError;
        if (data.error) {
          setError(data.error);
          setCompanyData([]);
          return;
        }
        
        const companies: CompanyDemographicItem[] = (data.elements || []).map((el: any) => ({
          entityUrn: el.entityUrn || '',
          entityName: el.entityName || 'Unknown',
          website: el.website || null,
          linkedInUrl: el.linkedInUrl || null,
          enrichmentStatus: el.enrichmentStatus || 'unresolved',
          impressions: el.impressions || 0,
          clicks: el.clicks || 0,
          landingPageClicks: el.landingPageClicks || 0,
          spent: parseFloat(el.costInLocalCurrency || '0'),
          leads: el.leads || 0,
          engagements: el.engagements || 0,
          likes: el.likes || 0,
          comments: el.comments || 0,
          reactions: el.reactions || 0,
          shares: el.shares || 0,
          ctr: parseFloat(el.ctr || '0'),
          cpc: parseFloat(el.cpc || '0'),
          cpm: parseFloat(el.cpm || '0'),
          objectiveBreakdown: el.objectiveBreakdown?.map((b: any) => ({
            objective: b.objective || 'UNKNOWN',
            impressions: b.impressions || 0,
            clicks: b.clicks || 0,
            landingPageClicks: b.landingPageClicks || 0,
            spent: b.spent || 0,
            leads: b.leads || 0,
            engagements: b.engagements || 0,
            likes: b.likes || 0,
            comments: b.comments || 0,
            reactions: b.reactions || 0,
            shares: b.shares || 0,
            ctr: b.ctr || 0,
            cpc: b.cpc || 0,
            cpm: b.cpm || 0,
            campaignIds: b.campaignIds || [],
            campaignNames: b.campaignNames || {},
          })) || undefined,
        }));
        
        allCompanies = [...allCompanies, ...companies];
        
        // Update state progressively so the user sees data arriving
        setCompanyData([...allCompanies]);
        
        const totalCompanies = data.metadata?.totalCompanies || allCompanies.length;
        hasMore = data.metadata?.hasMore === true;
        setLoadingProgress({ loaded: allCompanies.length, total: totalCompanies });
        
        console.log(`Page ${page}: got ${companies.length} companies, total so far: ${allCompanies.length}/${totalCompanies}, hasMore: ${hasMore}`);
        page++;
      }
      
      setLoadingProgress(null);
    } catch (err: any) {
      console.error('Fetch company demographic error:', err);
      setError(err.message || 'Failed to fetch company demographic');
      toast({
        title: 'Error',
        description: err.message || 'Failed to fetch company demographic',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setLoadingProgress(null);
    }
  }, [accessToken, dateRange, timeGranularity, selectedCampaignIds, toast]);

  // Lazy load campaign breakdown for a specific company + objective
  const fetchCampaignBreakdown = useCallback(async (
    accountId: string,
    entityUrn: string,
    objective: string,
    campaignIds: string[],
    campaignNames: Record<string, string>,
  ) => {
    if (!accessToken || !accountId || campaignIds.length === 0) return;
    
    const cacheKey = `${entityUrn}::${objective}`;
    
    // Already cached
    if (campaignBreakdownCache.has(cacheKey)) return;
    
    // Already loading
    if (loadingObjectives.has(cacheKey)) return;
    
    setLoadingObjectives(prev => new Set(prev).add(cacheKey));
    
    try {
      console.log(`Fetching campaign breakdown for ${entityUrn} / ${objective} (${campaignIds.length} campaigns)`);
      
      const { data, error: fetchError } = await supabase.functions.invoke('linkedin-api', {
        body: {
          action: 'get_company_campaign_breakdown',
          accessToken,
          params: {
            accountId,
            dateRange,
            campaignIds,
            campaignNames,
          }
        }
      });
      
      if (fetchError) throw fetchError;
      
      const breakdowns = data?.breakdowns || {};
      
      // Update cache for ALL companies returned (not just the one that triggered it)
      setCampaignBreakdownCache(prev => {
        const next = new Map(prev);
        for (const [companyUrn, campaigns] of Object.entries(breakdowns)) {
          const key = `${companyUrn}::${objective}`;
          next.set(key, campaigns as CampaignBreakdownItem[]);
        }
        // Also set empty array for the requesting company if no data returned
        if (!breakdowns[entityUrn]) {
          next.set(cacheKey, []);
        }
        return next;
      });
    } catch (err: any) {
      console.error('Fetch campaign breakdown error:', err);
      // Set empty to prevent re-fetching
      setCampaignBreakdownCache(prev => new Map(prev).set(cacheKey, []));
    } finally {
      setLoadingObjectives(prev => {
        const next = new Set(prev);
        next.delete(cacheKey);
        return next;
      });
    }
  }, [accessToken, dateRange, campaignBreakdownCache, loadingObjectives]);

  // Lazy-load objective breakdowns for all companies (called on first company expand)
  const fetchObjectiveBreakdowns = useCallback(async (accountId: string) => {
    if (!accessToken || !accountId || objectiveBreakdownsFetched || isLoadingObjectiveBreakdowns) return;
    
    setIsLoadingObjectiveBreakdowns(true);
    
    try {
      console.log('Fetching objective breakdowns lazily...');
      const campaignsToFilter = selectedCampaignIds;
      
      const { data, error: fetchError } = await supabase.functions.invoke('linkedin-api', {
        body: {
          action: 'get_objective_breakdowns',
          accessToken,
          params: {
            accountId,
            dateRange,
            campaignIds: campaignsToFilter.length > 0 ? campaignsToFilter : undefined,
          }
        }
      });
      
      if (fetchError) throw fetchError;
      
      const breakdowns = data?.breakdowns || {};
      const cache = new Map<string, ObjectiveBreakdownItem[]>();
      
      for (const [entityUrn, items] of Object.entries(breakdowns)) {
        cache.set(entityUrn, (items as any[]).map(b => ({
          objective: b.objective,
          impressions: b.impressions || 0,
          clicks: b.clicks || 0,
          landingPageClicks: b.landingPageClicks || 0,
          spent: b.spent || 0,
          leads: b.leads || 0,
          engagements: b.engagements || 0,
          likes: b.likes || 0,
          comments: b.comments || 0,
          reactions: b.reactions || 0,
          shares: b.shares || 0,
          ctr: b.ctr || 0,
          cpc: b.cpc || 0,
          cpm: b.cpm || 0,
          campaignIds: b.campaignIds || [],
          campaignNames: b.campaignNames || {},
        })));
      }
      
      setObjectiveBreakdownCache(cache);
      setObjectiveBreakdownsFetched(true);
      console.log(`Objective breakdowns loaded for ${cache.size} companies`);
    } catch (err: any) {
      console.error('Fetch objective breakdowns error:', err);
      setObjectiveBreakdownsFetched(true); // prevent re-fetch
    } finally {
      setIsLoadingObjectiveBreakdowns(false);
    }
  }, [accessToken, dateRange, selectedCampaignIds, objectiveBreakdownsFetched, isLoadingObjectiveBreakdowns]);

  const totals = useMemo(() => {
    return companyData.reduce(
      (acc, item) => ({
        impressions: acc.impressions + item.impressions,
        clicks: acc.clicks + item.clicks,
        landingPageClicks: acc.landingPageClicks + item.landingPageClicks,
        spent: acc.spent + item.spent,
        leads: acc.leads + item.leads,
        resolved: acc.resolved + (item.enrichmentStatus === 'resolved' ? 1 : 0),
        unresolved: acc.unresolved + (item.enrichmentStatus === 'unresolved' ? 1 : 0),
      }),
      { impressions: 0, clicks: 0, landingPageClicks: 0, spent: 0, leads: 0, resolved: 0, unresolved: 0 }
    );
  }, [companyData]);

  const setTimeFrame = useCallback((option: TimeFrameOption) => {
    setDateRange({
      start: option.startDate.toISOString().split('T')[0],
      end: option.endDate.toISOString().split('T')[0],
    });
  }, []);

  return {
    companyData,
    isLoading,
    error,
    totals,
    timeGranularity,
    setTimeGranularity,
    dateRange,
    setDateRange,
    timeFrameOptions,
    setTimeFrame,
    selectedCampaignIds,
    setSelectedCampaignIds,
    fetchCompanyDemographic,
    fetchCampaignBreakdown,
    campaignBreakdownCache,
    loadingObjectives,
    fetchObjectiveBreakdowns,
    objectiveBreakdownCache,
    isLoadingObjectiveBreakdowns,
    loadingProgress,
  };
}
