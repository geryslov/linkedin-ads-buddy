import { useState, useCallback, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useSavedAudiences, TargetingEntity } from '@/hooks/useSavedAudiences';
import { SaveAudienceDialog } from './SaveAudienceDialog';
import { BulkImportDialog } from './BulkImportDialog';
import { CampaignSearchSelect } from './CampaignSearchSelect';
import {
  Search,
  Plus,
  X,
  Briefcase,
  Building2,
  Sparkles,
  ShoppingCart,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Replace,
  PlusCircle,
  MinusCircle,
  Save,
  FolderOpen,
  Upload,
  ChevronDown,
  Info,
  Megaphone,
} from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  status: string;
}

interface CampaignTargetingEditorProps {
  accessToken: string | null;
  selectedAccount: string | null;
  campaigns: Campaign[];
  canWrite: boolean;
  onRefreshCampaigns: () => void;
}

export function CampaignTargetingEditor({ 
  accessToken, 
  selectedAccount, 
  campaigns,
  canWrite,
  onRefreshCampaigns 
}: CampaignTargetingEditorProps) {
  const { toast } = useToast();
  
  // Search state
  const [searchType, setSearchType] = useState<'titles' | 'skills' | 'companies'>('titles');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TargetingEntity[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  
  // Selection cart
  const [selectedEntities, setSelectedEntities] = useState<TargetingEntity[]>([]);
  
  // Campaign targeting state - now supports multiple campaigns
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
  const [updateMode, setUpdateMode] = useState<'append' | 'replace' | 'exclude'>('append');
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Saved audiences
  const { audiences, isLoading: isLoadingAudiences, fetchAudiences, saveAudience, deleteAudience } = useSavedAudiences(selectedAccount);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Bulk import
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showBulkSkillsImport, setShowBulkSkillsImport] = useState(false);

  // Skill suggestions
  const [skillSuggestions, setSkillSuggestions] = useState<TargetingEntity[]>([]);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const suggestionsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Title suggestions
  const [titleSuggestions, setTitleSuggestions] = useState<TargetingEntity[]>([]);
  const [isFetchingTitleSuggestions, setIsFetchingTitleSuggestions] = useState(false);
  const titleSuggestionsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Audience size estimate
  const [audienceCount, setAudienceCount] = useState<{ total: number; active: number } | null>(null);
  const [isFetchingAudienceCount, setIsFetchingAudienceCount] = useState(false);
  const audienceCountDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Fetch saved audiences when account changes
  useEffect(() => {
    if (selectedAccount) {
      fetchAudiences();
    }
  }, [selectedAccount, fetchAudiences]);
  
  const handleSearch = useCallback(async () => {
    if (!accessToken || !searchQuery.trim()) {
      toast({ 
        title: 'Enter a search query', 
        description: 'Type at least 2 characters to search.', 
        variant: 'destructive' 
      });
      return;
    }
    
    if (searchQuery.trim().length < 2) {
      toast({ 
        title: 'Query too short', 
        description: 'Enter at least 2 characters.', 
        variant: 'destructive' 
      });
      return;
    }
    
    setIsSearching(true);
    setSearchError(null);
    
    try {
      const action = searchType === 'titles' ? 'search_job_titles' : searchType === 'skills' ? 'search_skills' : 'search_companies';
      const { data, error } = await supabase.functions.invoke('linkedin-api', {
        body: { 
          action, 
          accessToken,
          params: { query: searchQuery.trim() }
        }
      });
      
      if (error) throw error;
      
      const items = searchType === 'titles' ? data.titles : searchType === 'skills' ? data.skills : data.companies;
      const entities: TargetingEntity[] = (items || []).map((item: any) => ({
        id: item.id,
        urn: item.urn,
        name: item.name,
        type: searchType === 'titles' ? 'title' : searchType === 'skills' ? 'skill' : 'company',
        targetable: item.targetable,
      }));
      
      setSearchResults(entities);
      
      if (entities.length === 0) {
        toast({ title: 'No results', description: `No ${searchType} found for "${searchQuery}".` });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Search failed';
      setSearchError(message);
      toast({ title: 'Search Error', description: message, variant: 'destructive' });
    } finally {
      setIsSearching(false);
    }
  }, [accessToken, searchQuery, searchType, toast]);
  
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };
  
  const addToSelection = (entity: TargetingEntity) => {
    if (selectedEntities.some(e => e.urn === entity.urn)) {
      toast({ title: 'Already selected', description: `${entity.name} is already in your selection.` });
      return;
    }
    setSelectedEntities(prev => [...prev, entity]);
    toast({ title: 'Added', description: `${entity.name} added to selection.` });
  };
  
  const addMultipleToSelection = (entities: TargetingEntity[]) => {
    const newEntities = entities.filter(e => !selectedEntities.some(s => s.urn === e.urn));
    if (newEntities.length === 0) {
      toast({ title: 'All already selected' });
      return;
    }
    setSelectedEntities(prev => [...prev, ...newEntities]);
    toast({ title: 'Added', description: `${newEntities.length} entities added to selection.` });
  };
  
  const removeFromSelection = (urn: string) => {
    setSelectedEntities(prev => prev.filter(e => e.urn !== urn));
  };
  
  const clearSelection = () => {
    setSelectedEntities([]);
  };
  
  // Bulk import handler
  const handleBulkResolve = async (titles: string[]): Promise<{ results: TargetingEntity[]; notFound: string[] }> => {
    if (!accessToken) {
      return { results: [], notFound: titles };
    }
    
    try {
      const { data, error } = await supabase.functions.invoke('linkedin-api', {
        body: { 
          action: 'bulk_search_titles', 
          accessToken,
          params: { titles }
        }
      });
      
      if (error) throw error;
      
      return {
        results: data.results || [],
        notFound: data.notFound || [],
      };
    } catch (err) {
      toast({ title: 'Bulk resolve failed', variant: 'destructive' });
      return { results: [], notFound: titles };
    }
  };
  
  // Bulk skills resolve handler
  const handleBulkSkillsResolve = async (skills: string[]): Promise<{ results: TargetingEntity[]; notFound: string[] }> => {
    if (!accessToken) return { results: [], notFound: skills };
    try {
      const { data, error } = await supabase.functions.invoke('linkedin-api', {
        body: {
          action: 'bulk_search_skills',
          accessToken,
          params: { skills }
        }
      });
      if (error) throw error;
      return { results: data.results || [], notFound: data.notFound || [] };
    } catch (err) {
      toast({ title: 'Bulk resolve failed', variant: 'destructive' });
      return { results: [], notFound: skills };
    }
  };

  // Fetch skill suggestions: uses selected skills if any, otherwise derives from selected titles
  const fetchSkillSuggestions = useCallback(async (selectedSkills: TargetingEntity[], selectedTitles: TargetingEntity[]) => {
    if (!accessToken || (selectedSkills.length === 0 && selectedTitles.length === 0)) {
      setSkillSuggestions([]);
      return;
    }
    setIsFetchingSuggestions(true);
    try {
      const excludeUrns = selectedSkills.map(s => s.urn);
      let data: any, error: any;

      if (selectedSkills.length > 0) {
        // Suggest more skills based on existing selected skills
        const skillNames = selectedSkills.map(s => s.name);
        ({ data, error } = await supabase.functions.invoke('linkedin-api', {
          body: { action: 'get_skill_suggestions', accessToken, params: { skillNames, excludeUrns } }
        }));
      } else {
        // Derive skill suggestions from the job titles in the selection
        const titleNames = selectedTitles.map(t => t.name);
        ({ data, error } = await supabase.functions.invoke('linkedin-api', {
          body: { action: 'get_skills_for_titles', accessToken, params: { titleNames, excludeUrns } }
        }));
      }

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSkillSuggestions((data.suggestions || []).map((s: any) => ({
        id: s.id, urn: s.urn, name: s.name, type: 'skill' as const, targetable: s.targetable,
      })));
    } catch (err) {
      console.error('[fetchSkillSuggestions] error:', err);
      setSkillSuggestions([]);
    } finally {
      setIsFetchingSuggestions(false);
    }
  }, [accessToken]);

  // Auto-refresh skill suggestions when selection changes (debounced)
  useEffect(() => {
    const selectedSkills = selectedEntities.filter(e => e.type === 'skill');
    const selectedTitles = selectedEntities.filter(e => e.type === 'title');
    if (suggestionsDebounceRef.current) clearTimeout(suggestionsDebounceRef.current);
    suggestionsDebounceRef.current = setTimeout(() => {
      fetchSkillSuggestions(selectedSkills, selectedTitles);
    }, 600);
    return () => {
      if (suggestionsDebounceRef.current) clearTimeout(suggestionsDebounceRef.current);
    };
  }, [selectedEntities, fetchSkillSuggestions]);

  const fetchTitleSuggestions = useCallback(async (selectedTitles: TargetingEntity[]) => {
    if (!accessToken || selectedTitles.length === 0) {
      setTitleSuggestions([]);
      return;
    }
    setIsFetchingTitleSuggestions(true);
    try {
      const titleNames = selectedTitles.map(t => t.name);
      const excludeUrns = selectedTitles.map(t => t.urn);
      const { data, error } = await supabase.functions.invoke('linkedin-api', {
        body: {
          action: 'get_title_suggestions',
          accessToken,
          params: { titleNames, excludeUrns }
        }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const suggestions: TargetingEntity[] = (data.suggestions || []).map((s: any) => ({
        id: s.id,
        urn: s.urn,
        name: s.name,
        type: 'title' as const,
        targetable: s.targetable,
      }));
      setTitleSuggestions(suggestions);
    } catch (err) {
      console.error('[fetchTitleSuggestions] error:', err);
      setTitleSuggestions([]);
    } finally {
      setIsFetchingTitleSuggestions(false);
    }
  }, [accessToken]);

  // Auto-refresh title suggestions when selected titles change (debounced)
  useEffect(() => {
    const selectedTitles = selectedEntities.filter(e => e.type === 'title');
    if (titleSuggestionsDebounceRef.current) clearTimeout(titleSuggestionsDebounceRef.current);
    titleSuggestionsDebounceRef.current = setTimeout(() => {
      fetchTitleSuggestions(selectedTitles);
    }, 600);
    return () => {
      if (titleSuggestionsDebounceRef.current) clearTimeout(titleSuggestionsDebounceRef.current);
    };
  }, [selectedEntities, fetchTitleSuggestions]);

  // Audience size estimate
  const fetchAudienceCount = useCallback(async (entities: TargetingEntity[]) => {
    if (!accessToken || entities.length === 0) {
      setAudienceCount(null);
      return;
    }
    setIsFetchingAudienceCount(true);
    try {
      const titleUrns = entities.filter(e => e.type === 'title').map(e => e.urn);
      const skillUrns = entities.filter(e => e.type === 'skill').map(e => e.urn);
      const { data, error } = await supabase.functions.invoke('linkedin-api', {
        body: { action: 'get_audience_count', accessToken, params: { titleUrns, skillUrns } }
      });
      if (error) throw error;
      setAudienceCount({ total: data.total ?? 0, active: data.active ?? 0 });
    } catch (err) {
      console.error('[fetchAudienceCount] error:', err);
      setAudienceCount(null);
    } finally {
      setIsFetchingAudienceCount(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (audienceCountDebounceRef.current) clearTimeout(audienceCountDebounceRef.current);
    if (selectedEntities.length === 0) {
      setAudienceCount(null);
      return;
    }
    audienceCountDebounceRef.current = setTimeout(() => {
      fetchAudienceCount(selectedEntities);
    }, 800);
    return () => {
      if (audienceCountDebounceRef.current) clearTimeout(audienceCountDebounceRef.current);
    };
  }, [selectedEntities, fetchAudienceCount]);

  // Save audience handler
  const handleSaveAudience = async (name: string, description: string) => {
    setIsSaving(true);
    try {
      const success = await saveAudience(name, description, selectedEntities);
      if (success) {
        setShowSaveDialog(false);
      }
    } finally {
      setIsSaving(false);
    }
  };
  
  // Load saved audience
  const handleLoadAudience = (entities: TargetingEntity[]) => {
    setSelectedEntities(entities);
    toast({ title: 'Audience loaded', description: `${entities.length} entities loaded into selection.` });
  };
  
  const handleApplyTargeting = async () => {
    // NOTE: selectedAccount no longer required for API call - account is derived from campaign
    if (!accessToken || selectedCampaignIds.length === 0) {
      toast({ 
        title: 'Missing selection', 
        description: 'Select at least one campaign to apply targeting.', 
        variant: 'destructive' 
      });
      return;
    }
    
    if (selectedEntities.length === 0) {
      toast({ 
        title: 'No targeting selected', 
        description: 'Add at least one targeting entity to your selection.', 
        variant: 'destructive' 
      });
      return;
    }
    
    setIsUpdating(true);
    
    try {
      const titleUrns = selectedEntities.filter(e => e.type === 'title').map(e => e.urn);
      const skillUrns = selectedEntities.filter(e => e.type === 'skill').map(e => e.urn);
      const companyUrns = selectedEntities.filter(e => e.type === 'company').map(e => e.urn);
      
      // NOTE: accountId is no longer sent - backend derives it from campaign
      const { data, error } = await supabase.functions.invoke('linkedin-api', {
        body: {
          action: 'update_campaign_targeting',
          accessToken,
          params: {
            campaignIds: selectedCampaignIds,
            titleUrns,
            skillUrns,
            companyUrns,
            mode: updateMode,
          }
        }
      });
      
      if (error) throw error;
      
      const results = data.results || [];
      const successCount = results.filter((r: any) => r.success).length;
      const totalCount = selectedCampaignIds.length;
      
      if (successCount === totalCount) {
        toast({ 
          title: 'Targeting Updated', 
          description: `Successfully ${updateMode === 'append' ? 'added' : updateMode === 'exclude' ? 'excluded' : 'replaced'} targeting on ${successCount} campaign(s).`,
        });
        clearSelection();
        setSelectedCampaignIds([]);
        onRefreshCampaigns();
      } else {
        // Extract actual error messages and codes from failed results
        const failedResults = results.filter((r: any) => !r.success);
        const errorCodes = failedResults.map((r: any) => r.errorCode).filter(Boolean);
        const errorMessages = failedResults
          .map((r: any) => r.message || 'Unknown error')
          .filter((msg: string, idx: number, arr: string[]) => arr.indexOf(msg) === idx);
        
        // Check for specific error codes and provide actionable CTAs
        const hasAllowlistError = errorCodes.includes('APP_NOT_AUTHORIZED_FOR_ACCOUNT');
        const hasTokenError = errorCodes.includes('TOKEN_EXPIRED');
        const hasRoleError = errorCodes.includes('ROLE_INSUFFICIENT');
        
        let toastTitle = 'Update Failed';
        let toastDescription = '';
        
        if (hasAllowlistError) {
          toastTitle = 'App Not Authorized';
          toastDescription = 'This app isn\'t authorized for this account. Try another account or ask your admin to approve the LinkedIn app access (Developer Portal → Account Management).';
        } else if (hasTokenError) {
          toastTitle = 'Session Expired';
          toastDescription = 'Your LinkedIn session has expired. Please log out and reconnect.';
        } else if (hasRoleError) {
          toastTitle = 'Insufficient Permissions';
          toastDescription = 'You need Account Manager or Campaign Manager role on this ad account to make changes.';
        } else {
          toastDescription = `${successCount}/${totalCount} campaigns updated. ${errorMessages.join('; ') || 'Check console for details'}`;
        }
        
        toast({ 
          title: toastTitle, 
          description: toastDescription,
          variant: 'destructive'
        });
        
        // Log detailed results for debugging
        console.error('[CampaignTargetingEditor] Update results:', results);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Update failed';
      toast({ title: 'Update Error', description: message, variant: 'destructive' });
    } finally {
      setIsUpdating(false);
    }
  };
  
  const titleCount = selectedEntities.filter(e => e.type === 'title').length;
  const skillCount = selectedEntities.filter(e => e.type === 'skill').length;
  const companyCount = selectedEntities.filter(e => e.type === 'company').length;

  const formatAudienceSize = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
    return n.toString();
  };

  // Label for skill suggestions — tells user whether they come from skills or titles
  const skillSuggestionLabel = (() => {
    if (isFetchingSuggestions) return 'Fetching skill suggestions…';
    const hasSkills = selectedEntities.some(e => e.type === 'skill');
    const hasTitles = selectedEntities.some(e => e.type === 'title');
    if (hasSkills) return 'Skills related to your selection';
    if (hasTitles) return 'Skills related to your job titles';
    return 'Suggested Skills';
  })();

  // shared tokens using platform design system
  const sectionLabel = "text-xs font-semibold text-muted-foreground uppercase tracking-wider";
  const titleChip = "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 hover:border-blue-300 transition-colors cursor-pointer";
  const skillChip = "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 border border-purple-200 text-purple-700 hover:bg-purple-100 hover:border-purple-300 transition-colors cursor-pointer";

  return (
    <TooltipProvider>
      <div className="space-y-4">

        {/* ── DEPLOY RAIL ── */}
        <Card className="border-border shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">

              {/* Campaign selector */}
              <div className="flex-1 min-w-0">
                <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <Megaphone className="h-3.5 w-3.5 text-primary" /> Target Campaigns
                </label>
                <CampaignSearchSelect
                  campaigns={campaigns}
                  selectedCampaignIds={selectedCampaignIds}
                  onChange={setSelectedCampaignIds}
                  disabled={!canWrite}
                />
              </div>

              {/* Mode toggle */}
              <div className="flex flex-col gap-1 shrink-0">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  Mode
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[200px] text-xs">
                      <p><strong>Append</strong> — AND with existing targeting (narrows audience).</p>
                      <p className="mt-1"><strong>Replace</strong> — overwrites the titles/skills facets.</p>
                      <p className="mt-1"><strong>Exclude</strong> — adds titles / skills / companies to the campaign's exclusions.</p>
                    </TooltipContent>
                  </Tooltip>
                </label>
                <div className="flex rounded-lg border border-border overflow-hidden">
                  {(['append', 'replace', 'exclude'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setUpdateMode(mode)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                        updateMode === mode
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      {mode === 'append' ? <PlusCircle className="h-3.5 w-3.5" /> : mode === 'replace' ? <Replace className="h-3.5 w-3.5" /> : <MinusCircle className="h-3.5 w-3.5" />}
                      {mode === 'append' ? 'Append' : mode === 'replace' ? 'Replace' : 'Exclude'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Audience reach */}
              <div className="flex flex-col items-center shrink-0 px-4 py-2 rounded-lg bg-muted/60 border border-border min-w-[90px]">
                <span className="text-xs text-muted-foreground font-medium">Reach</span>
                {isFetchingAudienceCount ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mt-0.5" />
                ) : audienceCount && audienceCount.total > 0 ? (
                  <span className="text-xl font-bold text-primary leading-tight">
                    {formatAudienceSize(audienceCount.total)}
                  </span>
                ) : (
                  <span className="text-lg font-semibold text-muted-foreground/40">—</span>
                )}
              </div>

              {/* Apply */}
              <Button
                size="default"
                onClick={handleApplyTargeting}
                disabled={isUpdating || selectedEntities.length === 0 || selectedCampaignIds.length === 0 || !canWrite}
                className="shrink-0 min-w-[160px] shadow-sm"
              >
                {isUpdating ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating…</>
                ) : !canWrite ? (
                  <><AlertCircle className="mr-2 h-4 w-4" />Read Only</>
                ) : (
                  <><CheckCircle2 className="mr-2 h-4 w-4" />
                    Apply{selectedCampaignIds.length > 0 ? ` to ${selectedCampaignIds.length} Campaign${selectedCampaignIds.length !== 1 ? 's' : ''}` : ''}
                  </>
                )}
              </Button>
            </div>

            {!canWrite && (
              <div className="mt-3 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                Viewer access only — contact your Campaign Manager for write permissions.
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── MAIN GRID ── */}
        <div className="grid lg:grid-cols-[1fr_320px] gap-4">

          {/* ── SEARCH & DISCOVER ── */}
          <Card className="border-border shadow-sm">
            <CardHeader className="px-4 pt-4 pb-3 border-b border-border/60">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Search className="h-4 w-4 text-primary" /> Search &amp; Discover
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">

              {/* Search row */}
              <div className="flex gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-32 justify-between shrink-0">
                      {searchType === 'titles'
                        ? <><Briefcase className="h-3.5 w-3.5 text-blue-500" /><span>Titles</span></>
                        : searchType === 'skills'
                          ? <><Sparkles className="h-3.5 w-3.5 text-purple-500" /><span>Skills</span></>
                          : <><Building2 className="h-3.5 w-3.5 text-emerald-600" /><span>Companies</span></>
                      }
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => { setSearchType('titles'); setSearchResults([]); }} className="gap-2">
                      <Briefcase className="h-4 w-4 text-blue-500" /> Job Titles
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setSearchType('skills'); setSearchResults([]); }} className="gap-2">
                      <Sparkles className="h-4 w-4 text-purple-500" /> Skills
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setSearchType('companies'); setSearchResults([]); }} className="gap-2">
                      <Building2 className="h-4 w-4 text-emerald-600" /> Companies
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Input
                  placeholder={`Search ${searchType === 'titles' ? 'job titles' : searchType === 'skills' ? 'skills' : 'company names'}…`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={isSearching}
                  className="flex-1"
                />

                <Button onClick={handleSearch} disabled={isSearching || !searchQuery.trim()} size="icon" variant="default">
                  {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={searchType === 'companies'}
                      onClick={() => searchType === 'titles' ? setShowBulkImport(true) : setShowBulkSkillsImport(true)}
                    >
                      <Upload className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {searchType === 'companies' ? 'Bulk import not available for companies' : `Bulk import ${searchType === 'titles' ? 'job titles' : 'skills'}`}
                  </TooltipContent>
                </Tooltip>
              </div>

              {searchError && (
                <div className="flex items-center gap-2 text-destructive text-xs p-2.5 bg-destructive/5 border border-destructive/20 rounded-lg">
                  <AlertCircle className="h-4 w-4 shrink-0" />{searchError}
                </div>
              )}

              {/* Results */}
              <ScrollArea className="h-[240px] pr-2">
                {searchResults.length > 0 ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground">{searchResults.length} result{searchResults.length !== 1 ? 's' : ''}</span>
                      <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 px-2 text-primary" onClick={() => addMultipleToSelection(searchResults)}>
                        <Plus className="h-3 w-3" /> Add all
                      </Button>
                    </div>
                    {searchResults.map((entity) => {
                      const isSelected = selectedEntities.some(e => e.urn === entity.urn);
                      return (
                        <div
                          key={entity.urn}
                          onClick={() => !isSelected && addToSelection(entity)}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-sm transition-colors ${
                            isSelected
                              ? 'bg-primary/5 border-primary/20 text-muted-foreground cursor-default'
                              : 'bg-background border-border hover:bg-muted/50 hover:border-border cursor-pointer'
                          }`}
                        >
                          {entity.type === 'title'
                            ? <Briefcase className={`h-3.5 w-3.5 shrink-0 ${isSelected ? 'text-muted-foreground/50' : 'text-blue-500'}`} />
                            : entity.type === 'skill'
                              ? <Sparkles className={`h-3.5 w-3.5 shrink-0 ${isSelected ? 'text-muted-foreground/50' : 'text-purple-500'}`} />
                              : <Building2 className={`h-3.5 w-3.5 shrink-0 ${isSelected ? 'text-muted-foreground/50' : 'text-emerald-600'}`} />
                          }
                          <span className="flex-1 truncate">{entity.name}</span>
                          {isSelected
                            ? <CheckCircle2 className="h-4 w-4 text-primary/50 shrink-0" />
                            : <Plus className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                          }
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
                    <Search className="h-8 w-8 mb-2 opacity-20" />
                    <p className="text-sm">Search {searchType === 'titles' ? 'job titles' : searchType === 'skills' ? 'skills' : 'companies'} above</p>
                  </div>
                )}
              </ScrollArea>

              {/* Suggestions — both always visible */}
              <div className="border-t border-border/60 pt-4 space-y-3">

                {/* Skill suggestions */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                    <span className={sectionLabel}>{skillSuggestionLabel}</span>
                    {isFetchingSuggestions && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-1" />}
                  </div>
                  <div className="flex flex-wrap gap-1.5 min-h-[26px]">
                    {!isFetchingSuggestions && skillSuggestions.filter(s => !selectedEntities.some(e => e.urn === s.urn)).length > 0
                      ? skillSuggestions.filter(s => !selectedEntities.some(e => e.urn === s.urn)).map(entity => (
                          <button key={entity.urn} onClick={() => addToSelection(entity)} className={skillChip}>
                            <Plus className="h-3 w-3" />{entity.name}
                          </button>
                        ))
                      : !isFetchingSuggestions && (
                          <span className="text-xs text-muted-foreground italic">
                            {selectedEntities.length === 0 ? 'Add titles or skills to see suggestions' : 'No suggestions available'}
                          </span>
                        )
                    }
                  </div>
                </div>

                {/* Title suggestions */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Briefcase className="h-3.5 w-3.5 text-blue-500" />
                    <span className={sectionLabel}>{isFetchingTitleSuggestions ? 'Fetching suggestions…' : 'Suggested Titles'}</span>
                    {isFetchingTitleSuggestions && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-1" />}
                  </div>
                  <div className="flex flex-wrap gap-1.5 min-h-[26px]">
                    {!isFetchingTitleSuggestions && titleSuggestions.filter(t => !selectedEntities.some(e => e.urn === t.urn)).length > 0
                      ? titleSuggestions.filter(t => !selectedEntities.some(e => e.urn === t.urn)).map(entity => (
                          <button key={entity.urn} onClick={() => addToSelection(entity)} className={titleChip}>
                            <Plus className="h-3 w-3" />{entity.name}
                          </button>
                        ))
                      : !isFetchingTitleSuggestions && (
                          <span className="text-xs text-muted-foreground italic">
                            {selectedEntities.filter(e => e.type === 'title').length === 0 ? 'Add titles to see suggestions' : 'No suggestions available'}
                          </span>
                        )
                    }
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── RIGHT COLUMN ── */}
          <div className="space-y-4">

            {/* Targeting Set */}
            <Card className="border-border shadow-sm">
              <CardHeader className="px-4 pt-4 pb-3 border-b border-border/60">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <ShoppingCart className="h-4 w-4 text-primary" />
                    Targeting Set
                    {selectedEntities.length > 0 && (
                      <Badge variant="secondary" className="text-xs font-medium">{selectedEntities.length}</Badge>
                    )}
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowSaveDialog(true)} disabled={selectedEntities.length === 0}>
                          <Save className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Save as audience</TooltipContent>
                    </Tooltip>
                    {selectedEntities.length > 0 && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-destructive px-2" onClick={clearSelection}>
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <ScrollArea className="h-[210px] pr-2">
                  {selectedEntities.length > 0 ? (
                    <div className="space-y-3">
                      {titleCount > 0 && (
                        <div>
                          <p className={`${sectionLabel} flex items-center gap-1.5 mb-1.5`}>
                            <Briefcase className="h-3 w-3 text-blue-500" /> Titles ({titleCount})
                          </p>
                          <div className="space-y-1">
                            {selectedEntities.filter(e => e.type === 'title').map(entity => (
                              <div key={entity.urn} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-blue-50 border border-blue-100 group hover:border-blue-200 transition-colors">
                                <span className="flex-1 text-xs text-blue-800 truncate font-medium">{entity.name}</span>
                                <button onClick={() => removeFromSelection(entity.urn)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0">
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {companyCount > 0 && (
                        <div>
                          <p className={`${sectionLabel} flex items-center gap-1.5 mb-1.5`}>
                            <Building2 className="h-3 w-3 text-emerald-600" /> Companies ({companyCount})
                          </p>
                          <div className="space-y-1">
                            {selectedEntities.filter(e => e.type === 'company').map(entity => (
                              <div key={entity.urn} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100 group hover:border-emerald-200 transition-colors">
                                <span className="flex-1 text-xs text-emerald-800 truncate font-medium">{entity.name}</span>
                                <button onClick={() => removeFromSelection(entity.urn)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0">
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {skillCount > 0 && (
                        <div>
                          <p className={`${sectionLabel} flex items-center gap-1.5 mb-1.5`}>
                            <Sparkles className="h-3 w-3 text-purple-500" /> Skills ({skillCount})
                          </p>
                          <div className="space-y-1">
                            {selectedEntities.filter(e => e.type === 'skill').map(entity => (
                              <div key={entity.urn} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-purple-50 border border-purple-100 group hover:border-purple-200 transition-colors">
                                <span className="flex-1 text-xs text-purple-800 truncate font-medium">{entity.name}</span>
                                <button onClick={() => removeFromSelection(entity.urn)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0">
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-6">
                      <ShoppingCart className="h-8 w-8 mb-2 opacity-20" />
                      <p className="text-sm font-medium">Empty selection</p>
                      <p className="text-xs mt-0.5 text-center opacity-70">Search or import to add targeting</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Saved Audiences */}
            <Card className="border-border shadow-sm">
              <CardHeader className="px-4 pt-4 pb-3 border-b border-border/60">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <FolderOpen className="h-4 w-4 text-primary" /> Saved Audiences
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {isLoadingAudiences ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-xs py-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
                  </div>
                ) : audiences.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-1">
                    No saved audiences yet. Save your selection to reuse it later.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {audiences.map(audience => (
                      <div
                        key={audience.id}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background border border-border hover:bg-muted/50 hover:border-border transition-colors group cursor-pointer"
                      >
                        <button className="flex-1 text-left min-w-0" onClick={() => handleLoadAudience(audience.entities)}>
                          <span className="text-sm font-medium text-foreground truncate block">{audience.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {audience.entities.filter((e: TargetingEntity) => e.type === 'title').length} titles · {audience.entities.filter((e: TargetingEntity) => e.type === 'skill').length} skills
                          </span>
                        </button>
                        <button onClick={() => deleteAudience(audience.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Dialogs */}
        <SaveAudienceDialog open={showSaveDialog} onOpenChange={setShowSaveDialog} onSave={handleSaveAudience} isLoading={isSaving} />
        <BulkImportDialog open={showBulkImport} onOpenChange={setShowBulkImport} onResolve={handleBulkResolve} onAddToSelection={addMultipleToSelection} type="titles" />
        <BulkImportDialog open={showBulkSkillsImport} onOpenChange={setShowBulkSkillsImport} onResolve={handleBulkSkillsResolve} onAddToSelection={addMultipleToSelection} type="skills" />
      </div>
    </TooltipProvider>
  );
}
