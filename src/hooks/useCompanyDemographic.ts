import { useState, useCallback, useMemo, useRef } from 'react';
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

const BATCH_SIZE = 2000;

function parseCompany(el: any): CompanyDemographicItem {
  return {
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
  };
}

export function useCompanyDemographic(accessToken: string | null) {
  const [companyData, setCompanyData] = useState<CompanyDemographicItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
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
  // Progressive loading state
  const [totalCompanies, setTotalCompanies] = useState<number | null>(null);
  const [loadedCount, setLoadedCount] = useState(0);
  const abortRef = useRef(false);
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
    
    // Abort any in-progress progressive loading
    abortRef.current = true;
    // Small delay to let any in-flight request check abort flag
    await new Promise(r => setTimeout(r, 50));
    abortRef.current = false;
    
    setIsLoading(true);
    setIsLoadingMore(false);
    setError(null);
    setCampaignBreakdownCache(new Map());
    setLoadingObjectives(new Set());
    setObjectiveBreakdownCache(new Map());
    setObjectiveBreakdownsFetched(false);
    setIsLoadingObjectiveBreakdowns(false);
    setTotalCompanies(null);
    setLoadedCount(0);
    setCompanyData([]);
    
    const campaignsToFilter = campaignIds || selectedCampaignIds;
    
    try {
      console.log('Fetching company demographic (batch 1):', { accountId, dateRange, timeGranularity });
      
      const { data, error: fetchError } = await supabase.functions.invoke('linkedin-api', {
        body: { 
          action: 'get_company_demographic', 
          accessToken,
          params: { 
            accountId, 
            dateRange,
            timeGranularity,
            campaignIds: campaignsToFilter.length > 0 ? campaignsToFilter : undefined,
            offset: 0,
            limit: BATCH_SIZE,
          }
        }
      });

      if (fetchError) throw fetchError;
      if (data.error) {
        setError(data.error);
        setCompanyData([]);
        return;
      }
      
      const companies = (data.elements || []).map(parseCompany);
      const meta = data.metadata || {};
      const total = meta.totalCompanies || companies.length;
      const hasMore = meta.hasMore || false;
      
      setCompanyData(companies);
      setTotalCompanies(total);
      setLoadedCount(companies.length);
      setIsLoading(false);
      
      // If there are more companies, continue loading in background
      if (hasMore) {
        setIsLoadingMore(true);
        let currentOffset = BATCH_SIZE;
        
        while (!abortRef.current) {
          console.log(`Fetching company demographic batch at offset ${currentOffset}...`);
          
          const { data: batchData, error: batchError } = await supabase.functions.invoke('linkedin-api', {
            body: {
              action: 'get_company_demographic',
              accessToken,
              params: {
                accountId,
                dateRange,
                timeGranularity,
                campaignIds: campaignsToFilter.length > 0 ? campaignsToFilter : undefined,
                offset: currentOffset,
                limit: BATCH_SIZE,
              }
            }
          });
          
          if (abortRef.current) break;
          
          if (batchError) {
            console.error('Batch fetch error:', batchError);
            break;
          }
          
          if (batchData.error) {
            console.error('Batch data error:', batchData.error);
            break;
          }
          
          const batchCompanies = (batchData.elements || []).map(parseCompany);
          if (batchCompanies.length === 0) break;
          
          setCompanyData(prev => [...prev, ...batchCompanies]);
          currentOffset += BATCH_SIZE;
          setLoadedCount(prev => prev + batchCompanies.length);
          
          const batchMeta = batchData.metadata || {};
          if (!batchMeta.hasMore) break;
        }
        
        setIsLoadingMore(false);
      }
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
      setIsLoadingMore(false);
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
    if (campaignBreakdownCache.has(cacheKey)) return;
    if (loadingObjectives.has(cacheKey)) return;
    
    setLoadingObjectives(prev => new Set(prev).add(cacheKey));
    
    try {
      const { data, error: fetchError } = await supabase.functions.invoke('linkedin-api', {
        body: {
          action: 'get_company_campaign_breakdown',
          accessToken,
          params: { accountId, dateRange, campaignIds, campaignNames }
        }
      });
      
      if (fetchError) throw fetchError;
      
      const breakdowns = data?.breakdowns || {};
      setCampaignBreakdownCache(prev => {
        const next = new Map(prev);
        for (const [companyUrn, campaigns] of Object.entries(breakdowns)) {
          const key = `${companyUrn}::${objective}`;
          next.set(key, campaigns as CampaignBreakdownItem[]);
        }
        if (!breakdowns[entityUrn]) {
          next.set(cacheKey, []);
        }
        return next;
      });
    } catch (err: any) {
      console.error('Fetch campaign breakdown error:', err);
      setCampaignBreakdownCache(prev => new Map(prev).set(cacheKey, []));
    } finally {
      setLoadingObjectives(prev => {
        const next = new Set(prev);
        next.delete(cacheKey);
        return next;
      });
    }
  }, [accessToken, dateRange, campaignBreakdownCache, loadingObjectives]);

  // Lazy-load objective breakdowns for all companies
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
      setObjectiveBreakdownsFetched(true);
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
    isLoadingMore,
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
    totalCompanies,
    loadedCount,
  };
}
