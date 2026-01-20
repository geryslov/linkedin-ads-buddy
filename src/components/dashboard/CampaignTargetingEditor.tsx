import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
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
  PlusCircle
} from 'lucide-react';

interface TargetingEntity {
  id: string;
  urn: string;
  name: string;
  type: 'title' | 'skill';
  targetable: boolean;
  isSuperTitle?: boolean;
  parentSuperTitle?: { urn: string; name: string } | null;
}

interface Campaign {
  id: string;
  name: string;
  status: string;
}

interface CampaignTargetingEditorProps {
  accessToken: string | null;
  selectedAccount: string | null;
  campaigns: Campaign[];
  onRefreshCampaigns: () => void;
}

export function CampaignTargetingEditor({ 
  accessToken, 
  selectedAccount, 
  campaigns,
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
  
  // Campaign targeting state
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [updateMode, setUpdateMode] = useState<'append' | 'replace'>('append');
  const [isUpdating, setIsUpdating] = useState(false);
  
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
        isSuperTitle: item.isSuperTitle,
        parentSuperTitle: item.parentSuperTitle,
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
  
  const removeFromSelection = (urn: string) => {
    setSelectedEntities(prev => prev.filter(e => e.urn !== urn));
  };
  
  const clearSelection = () => {
    setSelectedEntities([]);
  };
  
  const handleApplyTargeting = async () => {
    if (!accessToken || !selectedAccount || !selectedCampaignId) {
      toast({ 
        title: 'Missing selection', 
        description: 'Select a campaign to apply targeting.', 
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
      // Prepare targeting URNs by type
      const titleUrns = selectedEntities
        .filter(e => e.type === 'title')
        .map(e => e.urn);
      const skillUrns = selectedEntities
        .filter(e => e.type === 'skill')
        .map(e => e.urn);
      
      const { data, error } = await supabase.functions.invoke('linkedin-api', {
        body: {
          action: 'update_campaign_targeting',
          accessToken,
          params: {
            campaignId: selectedCampaignId,
            accountId: selectedAccount,
            titleUrns,
            skillUrns,
            mode: updateMode,
          }
        }
      });
      
      if (error) throw error;
      
      if (data.success) {
        toast({ 
          title: 'Targeting Updated', 
          description: `Successfully ${updateMode === 'append' ? 'added' : 'replaced'} targeting on campaign.`,
        });
        clearSelection();
        onRefreshCampaigns();
      } else {
        throw new Error(data.message || 'Failed to update targeting');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Update failed';
      toast({ title: 'Update Error', description: message, variant: 'destructive' });
    } finally {
      setIsUpdating(false);
    }
  };
  
  const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId);
  const titleCount = selectedEntities.filter(e => e.type === 'title').length;
  const skillCount = selectedEntities.filter(e => e.type === 'skill').length;
  
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Campaign Targeting Editor</h3>
        <p className="text-sm text-muted-foreground">
          Search for targeting entities, add them to your selection, then apply to a campaign.
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
                            {entity.type === 'title' && entity.isSuperTitle && (
                              <Badge variant="secondary" className="text-xs">Super Title</Badge>
                            )}
                            {entity.type === 'title' && entity.parentSuperTitle?.name && (
                              <Badge variant="outline" className="text-xs">{entity.parentSuperTitle.name}</Badge>
                            )}
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
                {selectedEntities.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearSelection}>
                    Clear All
                  </Button>
                )}
              </div>
              <CardDescription>
                {titleCount > 0 && `${titleCount} title${titleCount > 1 ? 's' : ''}`}
                {titleCount > 0 && skillCount > 0 && ', '}
                {skillCount > 0 && `${skillCount} skill${skillCount > 1 ? 's' : ''}`}
                {selectedEntities.length === 0 && 'Add targeting entities from search results'}
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
              <CardTitle className="text-base">Apply to Campaign</CardTitle>
              <CardDescription>Select a campaign and update mode</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Campaign Selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Target Campaign</label>
                <Select value={selectedCampaignId || ''} onValueChange={setSelectedCampaignId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a campaign..." />
                  </SelectTrigger>
                  <SelectContent>
                    {campaigns.map((campaign) => (
                      <SelectItem key={campaign.id} value={campaign.id}>
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${
                            campaign.status === 'ACTIVE' ? 'bg-green-500' : 
                            campaign.status === 'PAUSED' ? 'bg-yellow-500' : 'bg-gray-500'
                          }`} />
                          {campaign.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                    ? 'Add to existing targeting criteria' 
                    : 'Replace all existing targeting criteria'}
                </p>
              </div>
              
              {/* Apply Button */}
              <Button
                className="w-full"
                size="lg"
                onClick={handleApplyTargeting}
                disabled={isUpdating || selectedEntities.length === 0 || !selectedCampaignId}
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Apply Targeting ({selectedEntities.length} {selectedEntities.length === 1 ? 'entity' : 'entities'})
                  </>
                )}
              </Button>
              
              {selectedCampaign && (
                <p className="text-xs text-center text-muted-foreground">
                  Targeting will be applied to: <strong>{selectedCampaign.name}</strong>
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
