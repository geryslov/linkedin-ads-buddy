import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
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
  Trash2,
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
    if (!accessToken || !selectedAccount || selectedCampaignIds.length === 0) {
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
      
      const { data, error } = await supabase.functions.invoke('linkedin-api', {
        body: {
          action: 'update_campaign_targeting',
          accessToken,
          params: {
            campaignIds: selectedCampaignIds,
            accountId: selectedAccount,
            titleUrns,
            skillUrns,
            mode: updateMode,
          }
        }
      });
      
      if (error) throw error;
      
      const successCount = data.results?.filter((r: any) => r.success).length || 0;
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
        toast({ 
          title: 'Partial Success', 
          description: `${successCount}/${totalCount} campaigns updated. Check logs for details.`,
          variant: 'destructive'
        });
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
  
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Campaign Targeting Editor</h3>
        <p className="text-sm text-muted-foreground">
          Search for targeting entities, add them to your selection, then apply to campaigns.
        </p>
      </div>
      
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Search Panel */}
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Search className="h-4 w-4 text-primary" />
              Search Targeting Entities
            </CardTitle>
            <CardDescription>Find job titles and skills to target</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search Type Tabs */}
            <Tabs value={searchType} onValueChange={(v) => setSearchType(v as 'titles' | 'skills')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="titles" className="gap-2">
                  <Briefcase className="h-4 w-4" />
                  Job Titles
                </TabsTrigger>
                <TabsTrigger value="skills" className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  Skills
                </TabsTrigger>
              </TabsList>
            </Tabs>
            
            {/* Search Input */}
            <div className="flex gap-2">
              <Input
                placeholder={`Search ${searchType}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isSearching}
              />
              <Button onClick={handleSearch} disabled={isSearching || !searchQuery.trim()}>
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            
            {/* Search Error */}
            {searchError && (
              <div className="flex items-center gap-2 text-destructive text-sm p-2 bg-destructive/10 rounded-md">
                <AlertCircle className="h-4 w-4" />
                {searchError}
              </div>
            )}
            
            {/* Search Results */}
            <ScrollArea className="h-[300px] pr-4">
              {searchResults.length > 0 ? (
                <div className="space-y-2">
                  {searchResults.map((entity) => {
                    const isSelected = selectedEntities.some(e => e.urn === entity.urn);
                    return (
                      <div 
                        key={entity.urn}
                        className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                          isSelected 
                            ? 'bg-primary/10 border-primary/30' 
                            : 'bg-muted/30 border-border/50 hover:bg-muted/50'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{entity.name}</div>
                          <div className="flex items-center gap-2 mt-1">
                            {entity.targetable && (
                              <Badge variant="default" className="text-xs bg-green-600">Targetable</Badge>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={isSelected ? 'secondary' : 'default'}
                          onClick={() => addToSelection(entity)}
                          disabled={isSelected}
                          className="ml-2"
                        >
                          {isSelected ? <CheckCircle2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Search className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">Search for {searchType} to add to your selection</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
        
        {/* Right: Selection Cart + Campaign Selector */}
        <div className="space-y-4">
          {/* Selection Cart */}
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShoppingCart className="h-4 w-4 text-primary" />
                  Selection Cart
                  {selectedEntities.length > 0 && (
                    <Badge variant="secondary">{selectedEntities.length}</Badge>
                  )}
                </CardTitle>
                <div className="flex items-center gap-1">
                  {/* Bulk Import Button */}
                  <Button variant="ghost" size="sm" onClick={() => setShowBulkImport(true)}>
                    <Upload className="h-4 w-4 mr-1" />
                    Import
                  </Button>
                  
                  {/* Save Audience Dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <FolderOpen className="h-4 w-4 mr-1" />
                        Audiences
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem 
                        onClick={() => setShowSaveDialog(true)}
                        disabled={selectedEntities.length === 0}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Save Current Selection
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {isLoadingAudiences ? (
                        <DropdownMenuItem disabled>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Loading...
                        </DropdownMenuItem>
                      ) : audiences.length === 0 ? (
                        <DropdownMenuItem disabled>
                          <span className="text-muted-foreground">No saved audiences</span>
                        </DropdownMenuItem>
                      ) : (
                        audiences.map((audience) => (
                          <DropdownMenuItem 
                            key={audience.id}
                            className="flex items-center justify-between"
                          >
                            <span 
                              className="flex-1 truncate cursor-pointer"
                              onClick={() => handleLoadAudience(audience.entities)}
                            >
                              {audience.name}
                              <Badge variant="outline" className="ml-2 text-xs">
                                {audience.entities.length}
                              </Badge>
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteAudience(audience.id);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </DropdownMenuItem>
                        ))
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  
                  {selectedEntities.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearSelection}>
                      Clear
                    </Button>
                  )}
                </div>
              </div>
              <CardDescription>
                {titleCount > 0 && `${titleCount} title${titleCount > 1 ? 's' : ''}`}
                {titleCount > 0 && skillCount > 0 && ', '}
                {skillCount > 0 && `${skillCount} skill${skillCount > 1 ? 's' : ''}`}
                {selectedEntities.length === 0 && 'Add targeting entities from search or import'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px] pr-4">
                {selectedEntities.length > 0 ? (
                  <div className="space-y-2">
                    {selectedEntities.map((entity) => (
                      <div 
                        key={entity.urn}
                        className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/50"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {entity.type === 'title' ? (
                            <Briefcase className="h-4 w-4 text-blue-500 shrink-0" />
                          ) : (
                            <Sparkles className="h-4 w-4 text-purple-500 shrink-0" />
                          )}
                          <span className="truncate font-medium">{entity.name}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeFromSelection(entity.urn)}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <ShoppingCart className="h-8 w-8 mb-2 opacity-50" />
                    <p className="text-sm">Your selection is empty</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
          
          {/* Campaign Selector + Apply */}
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Apply to Campaigns</CardTitle>
              <CardDescription>Select campaigns and update mode</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Campaign Multi-Select with Search */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Target Campaigns</label>
                <CampaignSearchSelect
                  campaigns={campaigns}
                  selectedCampaignIds={selectedCampaignIds}
                  onChange={setSelectedCampaignIds}
                  disabled={!canWrite}
                />
              </div>
              
              {/* Update Mode */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Update Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={updateMode === 'append' ? 'default' : 'outline'}
                    onClick={() => setUpdateMode('append')}
                    className="w-full gap-2"
                  >
                    <PlusCircle className="h-4 w-4" />
                    Append
                  </Button>
                  <Button
                    variant={updateMode === 'replace' ? 'default' : 'outline'}
                    onClick={() => setUpdateMode('replace')}
                    className="w-full gap-2"
                  >
                    <Replace className="h-4 w-4" />
                    Replace
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {updateMode === 'append' 
                    ? 'Add as AND condition to narrow existing audience' 
                    : 'Remove all existing targeting and use only selected'}
                </p>
              </div>
              
              {/* Permission Warning for Viewers */}
              {!canWrite && (
                <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium">Viewer Access Only</p>
                    <p className="text-amber-400/80">
                      You have read-only access to this account. Contact your Campaign Manager for write permissions.
                    </p>
                  </div>
                </div>
              )}
              
              {/* Apply Button */}
              <Button
                className="w-full"
                size="lg"
                onClick={handleApplyTargeting}
                disabled={isUpdating || selectedEntities.length === 0 || selectedCampaignIds.length === 0 || !canWrite}
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : !canWrite ? (
                  <>
                    <AlertCircle className="mr-2 h-4 w-4" />
                    Viewer Access - Cannot Apply
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Apply to {selectedCampaignIds.length} Campaign{selectedCampaignIds.length !== 1 ? 's' : ''} ({selectedEntities.length} entities)
                  </>
                )}
              </Button>
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
      />
    </div>
  );
}
