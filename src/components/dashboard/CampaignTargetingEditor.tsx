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
  Sparkles,
  ShoppingCart,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Replace,
  PlusCircle,
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
  const [searchType, setSearchType] = useState<'titles' | 'skills'>('titles');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TargetingEntity[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  
  // Selection cart
  const [selectedEntities, setSelectedEntities] = useState<TargetingEntity[]>([]);
  
  // Campaign targeting state - now supports multiple campaigns
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
  const [updateMode, setUpdateMode] = useState<'append' | 'replace'>('append');
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
      const action = searchType === 'titles' ? 'search_job_titles' : 'search_skills';
      const { data, error } = await supabase.functions.invoke('linkedin-api', {
        body: { 
          action, 
          accessToken,
          params: { query: searchQuery.trim() }
        }
      });
      
      if (error) throw error;
      
      const items = searchType === 'titles' ? data.titles : data.skills;
      const entities: TargetingEntity[] = (items || []).map((item: any) => ({
        id: item.id,
        urn: item.urn,
        name: item.name,
        type: searchType === 'titles' ? 'title' : 'skill',
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

  // Fetch skill suggestions based on currently selected skills
  const fetchSkillSuggestions = useCallback(async (selectedSkills: TargetingEntity[]) => {
    console.log('[fetchSkillSuggestions] called, skills:', selectedSkills.length, 'hasToken:', !!accessToken);
    if (!accessToken || selectedSkills.length === 0) {
      setSkillSuggestions([]);
      return;
    }
    setIsFetchingSuggestions(true);
    try {
      const skillNames = selectedSkills.map(s => s.name);
      const excludeUrns = selectedSkills.map(s => s.urn);
      console.log('[fetchSkillSuggestions] querying with skillNames:', skillNames);
      const { data, error } = await supabase.functions.invoke('linkedin-api', {
        body: {
          action: 'get_skill_suggestions',
          accessToken,
          params: { skillNames, excludeUrns }
        }
      });
      console.log('[fetchSkillSuggestions] response data:', JSON.stringify(data));
      console.log('[fetchSkillSuggestions] response error:', error);
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const suggestions: TargetingEntity[] = (data.suggestions || []).map((s: any) => ({
        id: s.id,
        urn: s.urn,
        name: s.name,
        type: 'skill' as const,
        targetable: s.targetable,
      }));
      console.log('[fetchSkillSuggestions] parsed suggestions:', suggestions.length);
      setSkillSuggestions(suggestions);
    } catch (err) {
      console.error('[fetchSkillSuggestions] error:', err);
      setSkillSuggestions([]);
    } finally {
      setIsFetchingSuggestions(false);
    }
  }, [accessToken]);

  // Auto-refresh suggestions when selected skills change (debounced)
  useEffect(() => {
    const selectedSkills = selectedEntities.filter(e => e.type === 'skill');
    if (suggestionsDebounceRef.current) clearTimeout(suggestionsDebounceRef.current);
    suggestionsDebounceRef.current = setTimeout(() => {
      fetchSkillSuggestions(selectedSkills);
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
      
      // NOTE: accountId is no longer sent - backend derives it from campaign
      const { data, error } = await supabase.functions.invoke('linkedin-api', {
        body: {
          action: 'update_campaign_targeting',
          accessToken,
          params: {
            campaignIds: selectedCampaignIds,
            titleUrns,
            skillUrns,
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
          description: `Successfully ${updateMode === 'append' ? 'added' : 'replaced'} targeting on ${successCount} campaign(s).`,
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

  const formatAudienceSize = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
    return n.toString();
  };

  const currentSuggestions = searchType === 'titles' ? titleSuggestions : skillSuggestions;
  const isFetchingCurrentSuggestions = searchType === 'titles' ? isFetchingTitleSuggestions : isFetchingSuggestions;
  const visibleSuggestions = currentSuggestions.filter(s => !selectedEntities.some(e => e.urn === s.urn));

  return (
    <TooltipProvider>
      <div className="space-y-4">

        {/* ── Zone 1: Deploy Bar ── */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Campaign selector */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Megaphone className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Target Campaigns</span>
                </div>
                <CampaignSearchSelect
                  campaigns={campaigns}
                  selectedCampaignIds={selectedCampaignIds}
                  onChange={setSelectedCampaignIds}
                  disabled={!canWrite}
                />
              </div>

              {/* Mode toggle */}
              <div className="flex items-center gap-1.5 shrink-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[220px] text-xs">
                    <p><strong>Append</strong> — adds targeting as an AND condition, narrowing existing audience.</p>
                    <p className="mt-1"><strong>Replace</strong> — removes all existing targeting, uses only your selection.</p>
                  </TooltipContent>
                </Tooltip>
                <Button
                  size="sm"
                  variant={updateMode === 'append' ? 'default' : 'outline'}
                  onClick={() => setUpdateMode('append')}
                  className="gap-1.5"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  Append
                </Button>
                <Button
                  size="sm"
                  variant={updateMode === 'replace' ? 'default' : 'outline'}
                  onClick={() => setUpdateMode('replace')}
                  className="gap-1.5"
                >
                  <Replace className="h-3.5 w-3.5" />
                  Replace
                </Button>
              </div>

              {/* Audience size estimate */}
              {selectedEntities.length > 0 && (
                <div className="flex flex-col items-center shrink-0 px-3 py-1 rounded-lg bg-muted/30 border border-border/50 min-w-[90px]">
                  <span className="text-xs text-muted-foreground">Audience</span>
                  {isFetchingAudienceCount ? (
                    <Loader2 className="h-4 w-4 animate-spin mt-0.5 text-muted-foreground" />
                  ) : audienceCount ? (
                    <span className="text-base font-semibold leading-tight">
                      {formatAudienceSize(audienceCount.total)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">—</span>
                  )}
                </div>
              )}

              {/* Apply button */}
              <Button
                size="default"
                onClick={handleApplyTargeting}
                disabled={isUpdating || selectedEntities.length === 0 || selectedCampaignIds.length === 0 || !canWrite}
                className="shrink-0 min-w-[140px]"
              >
                {isUpdating ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating…</>
                ) : !canWrite ? (
                  <><AlertCircle className="mr-2 h-4 w-4" />No Write Access</>
                ) : (
                  <><CheckCircle2 className="mr-2 h-4 w-4" />
                    Apply
                    {selectedCampaignIds.length > 0 && ` (${selectedCampaignIds.length})`}
                  </>
                )}
              </Button>
            </div>

            {!canWrite && (
              <div className="mt-3 flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                Viewer access only — contact your Campaign Manager for write permissions.
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Zones 2 + 3: Two-column layout ── */}
        <div className="grid lg:grid-cols-[1fr_340px] gap-4">

          {/* ── Zone 2: Search & Discover ── */}
          <Card>
            <CardContent className="p-4 space-y-3">

              {/* Search row: type dropdown + input + search btn + bulk import */}
              <div className="flex gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-32 justify-between shrink-0 gap-1">
                      {searchType === 'titles' ? (
                        <><Briefcase className="h-3.5 w-3.5 text-blue-400" /><span>Titles</span></>
                      ) : (
                        <><Sparkles className="h-3.5 w-3.5 text-purple-400" /><span>Skills</span></>
                      )}
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => { setSearchType('titles'); setSearchResults([]); }}>
                      <Briefcase className="h-4 w-4 mr-2 text-blue-400" />
                      Job Titles
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setSearchType('skills'); setSearchResults([]); }}>
                      <Sparkles className="h-4 w-4 mr-2 text-purple-400" />
                      Skills
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Input
                  placeholder={`Search ${searchType === 'titles' ? 'job titles' : 'skills'}…`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={isSearching}
                  className="flex-1"
                />

                <Button onClick={handleSearch} disabled={isSearching || !searchQuery.trim()} size="icon">
                  {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => searchType === 'titles' ? setShowBulkImport(true) : setShowBulkSkillsImport(true)}
                    >
                      <Upload className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Bulk import {searchType === 'titles' ? 'job titles' : 'skills'}</TooltipContent>
                </Tooltip>
              </div>

              {/* Search error */}
              {searchError && (
                <div className="flex items-center gap-2 text-destructive text-xs p-2 bg-destructive/10 rounded-md">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {searchError}
                </div>
              )}

              {/* Results */}
              <ScrollArea className="h-[260px] pr-2">
                {searchResults.length > 0 ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground">{searchResults.length} result{searchResults.length !== 1 ? 's' : ''}</span>
                      <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 px-2" onClick={() => addMultipleToSelection(searchResults)}>
                        <Plus className="h-3 w-3" /> Add all
                      </Button>
                    </div>
                    {searchResults.map((entity) => {
                      const isSelected = selectedEntities.some(e => e.urn === entity.urn);
                      return (
                        <div
                          key={entity.urn}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                            isSelected
                              ? 'bg-primary/10 border-primary/30'
                              : 'bg-muted/20 border-border/40 hover:bg-muted/40'
                          }`}
                        >
                          {entity.type === 'title'
                            ? <Briefcase className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                            : <Sparkles className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                          }
                          <span className="flex-1 text-sm truncate">{entity.name}</span>
                          {entity.targetable && (
                            <Badge variant="secondary" className="text-xs shrink-0">✓</Badge>
                          )}
                          <Button
                            size="icon"
                            variant={isSelected ? 'secondary' : 'ghost'}
                            className="h-6 w-6 shrink-0"
                            onClick={() => addToSelection(entity)}
                            disabled={isSelected}
                          >
                            {isSelected ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
                    <Search className="h-7 w-7 mb-2 opacity-30" />
                    <p className="text-sm">Search {searchType === 'titles' ? 'job titles' : 'skills'} above</p>
                  </div>
                )}
              </ScrollArea>

              {/* Suggestions strip */}
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  {searchType === 'titles'
                    ? <Briefcase className="h-3 w-3 text-blue-400" />
                    : <Sparkles className="h-3 w-3 text-purple-400" />
                  }
                  <span className="text-xs font-medium text-muted-foreground">
                    {isFetchingCurrentSuggestions ? 'Fetching suggestions…' : `Suggested ${searchType === 'titles' ? 'Titles' : 'Skills'}`}
                  </span>
                  {isFetchingCurrentSuggestions && <Loader2 className="h-3 w-3 animate-spin ml-1" />}
                </div>
                <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                  {!isFetchingCurrentSuggestions && visibleSuggestions.length > 0 ? (
                    visibleSuggestions.map((entity) => (
                      <button
                        key={entity.urn}
                        onClick={() => addToSelection(entity)}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border transition-colors ${
                          searchType === 'titles'
                            ? 'bg-blue-500/10 border-blue-500/30 text-blue-300 hover:bg-blue-500/20'
                            : 'bg-purple-500/10 border-purple-500/30 text-purple-300 hover:bg-purple-500/20'
                        }`}
                      >
                        <Plus className="h-3 w-3" />
                        {entity.name}
                      </button>
                    ))
                  ) : !isFetchingCurrentSuggestions ? (
                    <span className="text-xs text-muted-foreground italic">
                      {selectedEntities.filter(e => e.type === (searchType === 'titles' ? 'title' : 'skill')).length === 0
                        ? `Add ${searchType === 'titles' ? 'titles' : 'skills'} to your selection to see suggestions`
                        : 'No suggestions available'}
                    </span>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Zone 3: Selection + Saved Audiences ── */}
          <div className="space-y-4">

            {/* Selection panel */}
            <Card>
              <CardHeader className="px-4 pt-4 pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">Selection</span>
                    {selectedEntities.length > 0 && (
                      <Badge variant="secondary" className="text-xs">{selectedEntities.length}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setShowSaveDialog(true)}
                          disabled={selectedEntities.length === 0}
                        >
                          <Save className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Save as audience</TooltipContent>
                    </Tooltip>
                    {selectedEntities.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-muted-foreground hover:text-destructive px-2"
                        onClick={clearSelection}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <ScrollArea className="h-[220px] pr-2">
                  {selectedEntities.length > 0 ? (
                    <div className="space-y-1">
                      {/* Titles group */}
                      {titleCount > 0 && (
                        <>
                          <p className="text-xs font-semibold text-blue-400 flex items-center gap-1 mb-1 mt-1">
                            <Briefcase className="h-3 w-3" /> Titles ({titleCount})
                          </p>
                          {selectedEntities.filter(e => e.type === 'title').map((entity) => (
                            <div key={entity.urn} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-blue-500/10 border border-blue-500/20 group">
                              <span className="flex-1 text-xs truncate">{entity.name}</span>
                              <button
                                onClick={() => removeFromSelection(entity.urn)}
                                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </>
                      )}

                      {/* Skills group */}
                      {skillCount > 0 && (
                        <>
                          <p className="text-xs font-semibold text-purple-400 flex items-center gap-1 mb-1 mt-3">
                            <Sparkles className="h-3 w-3" /> Skills ({skillCount})
                          </p>
                          {selectedEntities.filter(e => e.type === 'skill').map((entity) => (
                            <div key={entity.urn} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-purple-500/10 border border-purple-500/20 group">
                              <span className="flex-1 text-xs truncate">{entity.name}</span>
                              <button
                                onClick={() => removeFromSelection(entity.urn)}
                                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-6">
                      <ShoppingCart className="h-7 w-7 mb-2 opacity-25" />
                      <p className="text-sm">Empty</p>
                      <p className="text-xs opacity-50 mt-0.5 text-center">Search or import entities to add them</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Saved audiences panel */}
            <Card>
              <CardHeader className="px-4 pt-4 pb-2">
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">Saved Audiences</span>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {isLoadingAudiences ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-xs py-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
                  </div>
                ) : audiences.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-1">
                    No saved audiences yet. Build a selection and save it for reuse.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {audiences.map((audience) => (
                      <div
                        key={audience.id}
                        className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-muted/20 border border-border/40 hover:bg-muted/40 transition-colors group"
                      >
                        <button
                          className="flex-1 text-left min-w-0"
                          onClick={() => handleLoadAudience(audience.entities)}
                        >
                          <span className="text-sm font-medium truncate block">{audience.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {audience.entities.filter((e: TargetingEntity) => e.type === 'title').length} titles · {audience.entities.filter((e: TargetingEntity) => e.type === 'skill').length} skills
                          </span>
                        </button>
                        <button
                          onClick={() => deleteAudience(audience.id)}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0"
                        >
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
        <SaveAudienceDialog
          open={showSaveDialog}
          onOpenChange={setShowSaveDialog}
          onSave={handleSaveAudience}
          isLoading={isSaving}
        />

        <BulkImportDialog
          open={showBulkImport}
          onOpenChange={setShowBulkImport}
          onResolve={handleBulkResolve}
          onAddToSelection={addMultipleToSelection}
          type="titles"
        />

        <BulkImportDialog
          open={showBulkSkillsImport}
          onOpenChange={setShowBulkSkillsImport}
          onResolve={handleBulkSkillsResolve}
          onAddToSelection={addMultipleToSelection}
          type="skills"
        />
      </div>
    </TooltipProvider>
  );
}
