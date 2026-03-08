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

  // Label for skill suggestions — tells user whether they come from skills or titles
  const skillSuggestionLabel = (() => {
    if (isFetchingSuggestions) return 'Fetching skill suggestions…';
    const hasSkills = selectedEntities.some(e => e.type === 'skill');
    const hasTitles = selectedEntities.some(e => e.type === 'title');
    if (hasSkills) return 'Skills related to your selection';
    if (hasTitles) return 'Skills related to your job titles';
    return 'Suggested Skills';
  })();

  // shared style tokens
  const panel = "bg-slate-950 border border-slate-800 rounded-xl";
  const panelHeader = "px-4 pt-3 pb-2 border-b border-slate-800/60";
  const label = "font-mono text-[10px] tracking-widest uppercase text-slate-500";
  const titleChip = "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-sky-950 border border-sky-700/50 text-sky-300 hover:border-sky-500 hover:text-sky-200 hover:bg-sky-900/60 transition-all cursor-pointer";
  const skillChip = "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-violet-950 border border-violet-700/50 text-violet-300 hover:border-violet-500 hover:text-violet-200 hover:bg-violet-900/60 transition-all cursor-pointer";

  return (
    <TooltipProvider>
      <div className="space-y-3 font-sans">

        {/* ── DEPLOY RAIL ── */}
        <div className={`${panel} p-3`}>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">

            {/* Campaign selector */}
            <div className="flex-1 min-w-0">
              <p className={`${label} mb-1.5 flex items-center gap-1`}>
                <Megaphone className="h-3 w-3" /> target campaigns
              </p>
              <CampaignSearchSelect
                campaigns={campaigns}
                selectedCampaignIds={selectedCampaignIds}
                onChange={setSelectedCampaignIds}
                disabled={!canWrite}
              />
            </div>

            {/* Mode buttons */}
            <div className="flex items-center gap-1 shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-slate-600 cursor-help mr-0.5" />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[200px] text-xs bg-slate-900 border-slate-700 text-slate-200">
                  <p><strong className="text-cyan-400">Append</strong> — AND with existing targeting (narrower).</p>
                  <p className="mt-1"><strong className="text-amber-400">Replace</strong> — wipe existing, use only your selection.</p>
                </TooltipContent>
              </Tooltip>
              {(['append', 'replace'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setUpdateMode(mode)}
                  className={`px-3 py-1.5 rounded text-xs font-mono tracking-wide border transition-all ${
                    updateMode === mode
                      ? mode === 'append'
                        ? 'bg-cyan-500/15 border-cyan-500/60 text-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.15)]'
                        : 'bg-amber-500/15 border-amber-500/60 text-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.15)]'
                      : 'bg-transparent border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300'
                  }`}
                >
                  {mode === 'append' ? '+ append' : '↺ replace'}
                </button>
              ))}
            </div>

            {/* Audience readout */}
            <div className="flex flex-col items-center shrink-0 px-4 py-1.5 rounded-lg bg-slate-900 border border-slate-700/60 min-w-[88px]">
              <span className={`${label}`}>reach</span>
              {isFetchingAudienceCount ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500 mt-0.5" />
              ) : audienceCount && audienceCount.total > 0 ? (
                <span className="text-lg font-mono font-bold text-cyan-400 leading-tight tracking-tight">
                  {formatAudienceSize(audienceCount.total)}
                </span>
              ) : (
                <span className="text-sm font-mono text-slate-600">—</span>
              )}
            </div>

            {/* Apply */}
            <button
              onClick={handleApplyTargeting}
              disabled={isUpdating || selectedEntities.length === 0 || selectedCampaignIds.length === 0 || !canWrite}
              className={`shrink-0 px-5 py-2 rounded-lg text-sm font-mono font-semibold tracking-wide transition-all border ${
                isUpdating || selectedEntities.length === 0 || selectedCampaignIds.length === 0 || !canWrite
                  ? 'bg-slate-900 border-slate-700 text-slate-600 cursor-not-allowed'
                  : 'bg-cyan-500 border-cyan-400 text-slate-950 hover:bg-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:shadow-[0_0_28px_rgba(34,211,238,0.45)]'
              }`}
            >
              {isUpdating ? (
                <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />deploying…</span>
              ) : !canWrite ? (
                <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4" />read-only</span>
              ) : (
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  deploy{selectedCampaignIds.length > 0 ? ` → ${selectedCampaignIds.length}` : ''}
                </span>
              )}
            </button>
          </div>

          {!canWrite && (
            <div className="mt-2.5 flex items-center gap-2 text-xs font-mono text-amber-400/80 bg-amber-500/5 border border-amber-500/20 rounded px-3 py-1.5">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              viewer access — no write permissions
            </div>
          )}
        </div>

        {/* ── MAIN GRID ── */}
        <div className="grid lg:grid-cols-[1fr_320px] gap-3">

          {/* ── SEARCH & DISCOVER ── */}
          <div className={panel}>
            <div className={panelHeader}>
              <p className={label}>search &amp; discover</p>
            </div>
            <div className="p-3 space-y-3">

              {/* Search row */}
              <div className="flex gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm font-mono text-slate-300 hover:border-slate-500 transition-colors shrink-0 w-28">
                      {searchType === 'titles'
                        ? <><Briefcase className="h-3.5 w-3.5 text-sky-400" />titles</>
                        : <><Sparkles className="h-3.5 w-3.5 text-violet-400" />skills</>
                      }
                      <ChevronDown className="h-3 w-3 text-slate-500 ml-auto" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="bg-slate-900 border-slate-700 text-slate-200">
                    <DropdownMenuItem onClick={() => { setSearchType('titles'); setSearchResults([]); }} className="font-mono text-sm gap-2 focus:bg-slate-800">
                      <Briefcase className="h-4 w-4 text-sky-400" /> job titles
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setSearchType('skills'); setSearchResults([]); }} className="font-mono text-sm gap-2 focus:bg-slate-800">
                      <Sparkles className="h-4 w-4 text-violet-400" /> skills
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Input
                  placeholder={`/ search ${searchType === 'titles' ? 'job titles' : 'skills'}…`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={isSearching}
                  className="flex-1 bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-600 font-mono text-sm focus-visible:border-cyan-600 focus-visible:ring-0 focus-visible:ring-offset-0"
                />

                <button
                  onClick={handleSearch}
                  disabled={isSearching || !searchQuery.trim()}
                  className="px-3 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 hover:border-cyan-600 hover:text-cyan-400 transition-all disabled:opacity-40"
                >
                  {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </button>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => searchType === 'titles' ? setShowBulkImport(true) : setShowBulkSkillsImport(true)}
                      className="px-3 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200 transition-all"
                    >
                      <Upload className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 border-slate-700 text-slate-200 font-mono text-xs">
                    bulk import {searchType === 'titles' ? 'titles' : 'skills'}
                  </TooltipContent>
                </Tooltip>
              </div>

              {searchError && (
                <div className="flex items-center gap-2 text-red-400 text-xs font-mono p-2 bg-red-500/5 border border-red-500/20 rounded-lg">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />{searchError}
                </div>
              )}

              {/* Results */}
              <ScrollArea className="h-[240px] pr-1">
                {searchResults.length > 0 ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-[10px] text-slate-600">{searchResults.length} results</span>
                      <button
                        onClick={() => addMultipleToSelection(searchResults)}
                        className="font-mono text-[10px] text-cyan-500 hover:text-cyan-300 transition-colors flex items-center gap-1"
                      >
                        <Plus className="h-3 w-3" />add all
                      </button>
                    </div>
                    {searchResults.map((entity) => {
                      const isSelected = selectedEntities.some(e => e.urn === entity.urn);
                      return (
                        <div
                          key={entity.urn}
                          onClick={() => !isSelected && addToSelection(entity)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border font-mono text-xs transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-slate-900 border-slate-700 text-slate-500 cursor-default'
                              : entity.type === 'title'
                                ? 'bg-slate-900/60 border-slate-800 hover:border-sky-700/60 hover:bg-sky-950/40 text-slate-300'
                                : 'bg-slate-900/60 border-slate-800 hover:border-violet-700/60 hover:bg-violet-950/40 text-slate-300'
                          }`}
                        >
                          {entity.type === 'title'
                            ? <Briefcase className="h-3 w-3 text-sky-500 shrink-0" />
                            : <Sparkles className="h-3 w-3 text-violet-500 shrink-0" />
                          }
                          <span className="flex-1 truncate">{entity.name}</span>
                          {isSelected
                            ? <CheckCircle2 className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                            : <Plus className="h-3.5 w-3.5 text-slate-600 group-hover:text-cyan-400 shrink-0" />
                          }
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-700 py-8">
                    <Search className="h-8 w-8 mb-2 opacity-30" />
                    <p className="font-mono text-xs">type to search {searchType}</p>
                  </div>
                )}
              </ScrollArea>

              {/* Suggestions — both types always visible */}
              <div className="border-t border-slate-800/70 pt-3 space-y-3">

                {/* Skill suggestions */}
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Sparkles className="h-3 w-3 text-violet-500" />
                    <span className={label}>{skillSuggestionLabel}</span>
                    {isFetchingSuggestions && <Loader2 className="h-3 w-3 animate-spin text-slate-600" />}
                  </div>
                  <div className="flex flex-wrap gap-1.5 min-h-[22px]">
                    {!isFetchingSuggestions && skillSuggestions.filter(s => !selectedEntities.some(e => e.urn === s.urn)).length > 0
                      ? skillSuggestions.filter(s => !selectedEntities.some(e => e.urn === s.urn)).map(entity => (
                          <button key={entity.urn} onClick={() => addToSelection(entity)} className={skillChip}>
                            <Plus className="h-2.5 w-2.5" />{entity.name}
                          </button>
                        ))
                      : !isFetchingSuggestions && (
                          <span className="font-mono text-[10px] text-slate-700 italic">
                            {selectedEntities.length === 0 ? 'add titles or skills to see suggestions' : 'no suggestions'}
                          </span>
                        )
                    }
                  </div>
                </div>

                {/* Title suggestions */}
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Briefcase className="h-3 w-3 text-sky-500" />
                    <span className={label}>{isFetchingTitleSuggestions ? 'fetching title suggestions…' : 'suggested titles'}</span>
                    {isFetchingTitleSuggestions && <Loader2 className="h-3 w-3 animate-spin text-slate-600" />}
                  </div>
                  <div className="flex flex-wrap gap-1.5 min-h-[22px]">
                    {!isFetchingTitleSuggestions && titleSuggestions.filter(t => !selectedEntities.some(e => e.urn === t.urn)).length > 0
                      ? titleSuggestions.filter(t => !selectedEntities.some(e => e.urn === t.urn)).map(entity => (
                          <button key={entity.urn} onClick={() => addToSelection(entity)} className={titleChip}>
                            <Plus className="h-2.5 w-2.5" />{entity.name}
                          </button>
                        ))
                      : !isFetchingTitleSuggestions && (
                          <span className="font-mono text-[10px] text-slate-700 italic">
                            {selectedEntities.filter(e => e.type === 'title').length === 0 ? 'add titles to see suggestions' : 'no suggestions'}
                          </span>
                        )
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div className="space-y-3">

            {/* Selection */}
            <div className={panel}>
              <div className={`${panelHeader} flex items-center justify-between`}>
                <div className="flex items-center gap-2">
                  <p className={label}>targeting set</p>
                  {selectedEntities.length > 0 && (
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                      {selectedEntities.length}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setShowSaveDialog(true)}
                        disabled={selectedEntities.length === 0}
                        className="p-1.5 rounded text-slate-600 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all disabled:opacity-30"
                      >
                        <Save className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="bg-slate-900 border-slate-700 text-slate-200 font-mono text-xs">save audience</TooltipContent>
                  </Tooltip>
                  {selectedEntities.length > 0 && (
                    <button
                      onClick={clearSelection}
                      className="px-2 py-1 rounded font-mono text-[10px] text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    >
                      clear
                    </button>
                  )}
                </div>
              </div>
              <div className="p-3">
                <ScrollArea className="h-[210px] pr-1">
                  {selectedEntities.length > 0 ? (
                    <div className="space-y-2">
                      {titleCount > 0 && (
                        <div>
                          <p className="font-mono text-[10px] text-sky-600 uppercase tracking-widest mb-1 flex items-center gap-1">
                            <Briefcase className="h-2.5 w-2.5" /> titles / {titleCount}
                          </p>
                          <div className="space-y-1">
                            {selectedEntities.filter(e => e.type === 'title').map(entity => (
                              <div key={entity.urn} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-sky-950/50 border border-sky-900/70 group hover:border-sky-700/60 transition-colors">
                                <span className="flex-1 font-mono text-xs text-sky-200 truncate">{entity.name}</span>
                                <button onClick={() => removeFromSelection(entity.urn)} className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all shrink-0">
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {skillCount > 0 && (
                        <div>
                          <p className="font-mono text-[10px] text-violet-600 uppercase tracking-widest mb-1 flex items-center gap-1">
                            <Sparkles className="h-2.5 w-2.5" /> skills / {skillCount}
                          </p>
                          <div className="space-y-1">
                            {selectedEntities.filter(e => e.type === 'skill').map(entity => (
                              <div key={entity.urn} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-violet-950/50 border border-violet-900/70 group hover:border-violet-700/60 transition-colors">
                                <span className="flex-1 font-mono text-xs text-violet-200 truncate">{entity.name}</span>
                                <button onClick={() => removeFromSelection(entity.urn)} className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all shrink-0">
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-700 py-4">
                      <ShoppingCart className="h-8 w-8 mb-2 opacity-20" />
                      <p className="font-mono text-xs">no entities selected</p>
                      <p className="font-mono text-[10px] opacity-60 mt-0.5 text-center">search or import to add</p>
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>

            {/* Saved Audiences */}
            <div className={panel}>
              <div className={panelHeader}>
                <p className={label}><FolderOpen className="inline h-3 w-3 mr-1" />saved audiences</p>
              </div>
              <div className="p-3">
                {isLoadingAudiences ? (
                  <div className="flex items-center gap-2 font-mono text-xs text-slate-600 py-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />loading…
                  </div>
                ) : audiences.length === 0 ? (
                  <p className="font-mono text-[10px] text-slate-700 italic py-1">
                    no saved audiences — save your selection to reuse it
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {audiences.map(audience => (
                      <div
                        key={audience.id}
                        className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-600 transition-colors group cursor-pointer"
                      >
                        <button className="flex-1 text-left min-w-0" onClick={() => handleLoadAudience(audience.entities)}>
                          <span className="font-mono text-xs text-slate-200 truncate block">{audience.name}</span>
                          <span className="font-mono text-[10px] text-slate-600">
                            {audience.entities.filter((e: TargetingEntity) => e.type === 'title').length}t · {audience.entities.filter((e: TargetingEntity) => e.type === 'skill').length}s
                          </span>
                        </button>
                        <button onClick={() => deleteAudience(audience.id)} className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all shrink-0">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
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
