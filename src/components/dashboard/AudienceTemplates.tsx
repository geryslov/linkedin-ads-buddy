import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CampaignSearchSelect } from './CampaignSearchSelect';
import { useAudienceTemplates, AudienceTemplate, SyncResult } from '@/hooks/useAudienceTemplates';
import type { TargetingEntity } from '@/hooks/useSavedAudiences';
import {
  Layers,
  Plus,
  Search,
  X,
  Trash2,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Users,
  Ban,
  Download,
  ChevronDown,
  ChevronRight,

} from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  status: string;
}

interface Props {
  accessToken: string | null;
  selectedAccount: string | null;
  campaigns: Campaign[];
  canWrite: boolean;
}

type FacetDef = {
  facet: string;
  label: string;
  group: 'Job' | 'Company' | 'Lists & audiences' | 'Education' | 'Interests' | 'Demographics';
  /** Free-text typeahead vs. a fixed value list LinkedIn returns whole. */
  typeahead: boolean;
};

const FACETS: FacetDef[] = [
  // Job
  { facet: 'urn:li:adTargetingFacet:titles', label: 'Job titles (current)', group: 'Job', typeahead: true },
  { facet: 'urn:li:adTargetingFacet:titlesPast', label: 'Job titles (past)', group: 'Job', typeahead: true },
  { facet: 'urn:li:adTargetingFacet:seniorities', label: 'Job seniority', group: 'Job', typeahead: false },
  { facet: 'urn:li:adTargetingFacet:jobFunctions', label: 'Job function', group: 'Job', typeahead: false },
  { facet: 'urn:li:adTargetingFacet:yearsOfExperience', label: 'Years of experience', group: 'Job', typeahead: false },
  { facet: 'urn:li:adTargetingFacet:skills', label: 'Member skills', group: 'Job', typeahead: true },
  // Company
  { facet: 'urn:li:adTargetingFacet:employers', label: 'Company names (current)', group: 'Company', typeahead: true },
  { facet: 'urn:li:adTargetingFacet:employersPast', label: 'Company names (past)', group: 'Company', typeahead: true },
  { facet: 'urn:li:adTargetingFacet:industries', label: 'Company industries', group: 'Company', typeahead: true },
  { facet: 'urn:li:adTargetingFacet:staffCountRanges', label: 'Company size', group: 'Company', typeahead: false },
  { facet: 'urn:li:adTargetingFacet:revenue', label: 'Company revenue', group: 'Company', typeahead: false },
  { facet: 'urn:li:adTargetingFacet:growthRate', label: 'Company growth rate', group: 'Company', typeahead: false },
  { facet: 'urn:li:adTargetingFacet:followedCompanies', label: 'Company followers', group: 'Company', typeahead: true },
  { facet: 'urn:li:adTargetingFacet:companyCategory', label: 'Company category', group: 'Company', typeahead: false },
  // Lists & matched audiences
  { facet: 'urn:li:adTargetingFacet:audienceMatchingSegments', label: 'Matched audiences (company / contact / website lists)', group: 'Lists & audiences', typeahead: false },
  { facet: 'urn:li:adTargetingFacet:dynamicSegments', label: 'Dynamic & lookalike segments', group: 'Lists & audiences', typeahead: false },
  { facet: 'urn:li:adTargetingFacet:firstDegreeConnectionCompanies', label: 'Connections of companies', group: 'Lists & audiences', typeahead: true },
  // Education
  { facet: 'urn:li:adTargetingFacet:degrees', label: 'Degrees', group: 'Education', typeahead: true },
  { facet: 'urn:li:adTargetingFacet:fieldsOfStudy', label: 'Fields of study', group: 'Education', typeahead: true },
  { facet: 'urn:li:adTargetingFacet:schools', label: 'Schools', group: 'Education', typeahead: true },
  // Interests
  { facet: 'urn:li:adTargetingFacet:interests', label: 'Member interests', group: 'Interests', typeahead: true },
  { facet: 'urn:li:adTargetingFacet:memberBehaviors', label: 'Member traits / behaviors', group: 'Interests', typeahead: true },
  { facet: 'urn:li:adTargetingFacet:groups', label: 'Member groups', group: 'Interests', typeahead: true },
  // Demographics
  { facet: 'urn:li:adTargetingFacet:ageRanges', label: 'Age ranges', group: 'Demographics', typeahead: false },
  { facet: 'urn:li:adTargetingFacet:genders', label: 'Gender', group: 'Demographics', typeahead: false },
  { facet: 'urn:li:adTargetingFacet:locations', label: 'Locations', group: 'Demographics', typeahead: true },
  { facet: 'urn:li:adTargetingFacet:profileLocations', label: 'Profile locations', group: 'Demographics', typeahead: true },
  { facet: 'urn:li:adTargetingFacet:interfaceLocales', label: 'Profile language', group: 'Demographics', typeahead: false },
];

const FACET_GROUPS = ['Job', 'Company', 'Lists & audiences', 'Education', 'Interests', 'Demographics'] as const;

const shortOf = (facetUrn: string) => facetUrn.split(':').pop() || facetUrn;

const LEGACY_KIND_FACET: Record<string, string> = {
  title: 'urn:li:adTargetingFacet:titles',
  skill: 'urn:li:adTargetingFacet:skills',
  company: 'urn:li:adTargetingFacet:employers',
  industry: 'urn:li:adTargetingFacet:industries',
};

const entityFacet = (e: TargetingEntity) =>
  e.facet || LEGACY_KIND_FACET[e.type] || `urn:li:adTargetingFacet:${e.type}`;

const facetLabel = (facetUrn: string) =>
  FACETS.find((f) => f.facet === facetUrn)?.label ||
  shortOf(facetUrn).replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());

const groupColor: Record<string, string> = {
  Job: 'bg-primary/15 text-primary border-primary/30',
  Company: 'bg-accent/15 text-accent-foreground border-accent/30',
  'Lists & audiences': 'bg-secondary text-secondary-foreground border-border',
  Education: 'bg-muted text-muted-foreground border-border',
  Interests: 'bg-muted text-muted-foreground border-border',
  Demographics: 'bg-muted text-muted-foreground border-border',
};

const colorForFacet = (facetUrn: string) =>
  groupColor[FACETS.find((f) => f.facet === facetUrn)?.group || ''] ||
  'bg-muted text-muted-foreground border-border';


export function AudienceTemplates({ accessToken, selectedAccount, campaigns, canWrite }: Props) {
  const { toast } = useToast();
  const {
    templates,
    assignments,
    isLoading,
    isSyncing,
    fetchAll,
    saveTemplate,
    deleteTemplate,
    setAssignedCampaigns,
    syncAudience,
  } = useAudienceTemplates(selectedAccount);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [include, setInclude] = useState<TargetingEntity[]>([]);
  const [exclude, setExclude] = useState<TargetingEntity[]>([]);
  const [bucket, setBucket] = useState<'include' | 'exclude'>('include');
  const [activeFacet, setActiveFacet] = useState<string>(FACETS[0].facet);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TargetingEntity[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
  const [syncResults, setSyncResults] = useState<SyncResult[] | null>(null);
  const [importCampaignId, setImportCampaignId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [facetFilter, setFacetFilter] = useState('');
  const [collapsedFacets, setCollapsedFacets] = useState<string[]>([]);
  const [showBulk, setShowBulk] = useState(false);


  const usedFacets = useMemo(() => {
    const order = FACETS.map((f) => f.facet);
    const set = new Set<string>([...include, ...exclude].map((e) => entityFacet(e)));
    return Array.from(set).sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
    });
  }, [include, exclude]);


  const importFromCampaign = async () => {
    if (!accessToken || !importCampaignId) return;
    setIsImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('linkedin-api', {
        body: {
          action: 'get_campaign_targeting_entities',
          accessToken,
          params: { campaignId: importCampaignId },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const inc = (data?.include || []) as TargetingEntity[];
      const exc = (data?.exclude || []) as TargetingEntity[];

      setInclude(inc);
      setExclude(exc);
      if (!draftName.trim()) {
        const src = campaigns.find((c) => c.id === importCampaignId)?.name || data?.campaignName;
        if (src) setDraftName(`${src} – audience`);
      }

      if (!inc.length && !exc.length) {
        toast({
          title: 'Nothing to import',
          description: 'That campaign has no title, skill, company or industry targeting.',
        });
      } else {
        toast({
          title: 'Targeting imported',
          description: `${inc.length} included, ${exc.length} excluded${
            data?.unresolved ? ` · ${data.unresolved} shown by ID` : ''
          }.`,
        });
      }
    } catch (err) {
      toast({
        title: 'Import failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };


  useEffect(() => {
    if (selectedAccount) fetchAll();
  }, [selectedAccount, fetchAll]);

  const activeTemplate = useMemo(
    () => templates.find((t) => t.id === activeId) || null,
    [templates, activeId],
  );

  const assignmentsFor = useCallback(
    (audienceId: string) => assignments.filter((a) => a.audience_id === audienceId),
    [assignments],
  );

  const loadTemplate = (t: AudienceTemplate) => {
    setActiveId(t.id);
    setDraftName(t.name);
    setDraftDescription(t.description || '');
    setInclude(t.entities || []);
    setExclude(t.exclude_entities || []);
    setSelectedCampaignIds(assignmentsFor(t.id).map((a) => a.campaign_id));
    setSyncResults(null);
  };

  const newTemplate = () => {
    setActiveId(null);
    setDraftName('');
    setDraftDescription('');
    setInclude([]);
    setExclude([]);
    setSelectedCampaignIds([]);
    setSyncResults(null);
  };

  const activeFacetDef = FACETS.find((f) => f.facet === activeFacet);

  const runSearch = async () => {
    if (!accessToken) return;
    if (activeFacetDef?.typeahead && query.trim().length < 2) {
      toast({ title: 'Enter at least 2 characters', variant: 'destructive' });
      return;
    }
    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('linkedin-api', {
        body: {
          action: 'search_targeting_entities',
          accessToken,
          params: { facet: activeFacet, query: query.trim() },
        },
      });
      if (error) throw error;
      if (data?.error && !(data?.entities || []).length) throw new Error(data.error);
      const items = (data?.entities || []) as any[];
      setResults(
        items.map((i) => ({
          id: i.id,
          urn: i.urn,
          name: i.name,
          facet: activeFacet,
          type: shortOf(activeFacet),
          targetable: i.targetable !== false,
        })),
      );
      if (!items.length) {
        toast({
          title: 'No results',
          description: query.trim()
            ? `Nothing found for "${query}" in ${facetLabel(activeFacet)}.`
            : `${facetLabel(activeFacet)} returned no values for this account.`,
        });
      }
    } catch (err) {
      toast({
        title: 'Search failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsSearching(false);
    }
  };


  const addEntity = (e: TargetingEntity) => {
    const setter = bucket === 'include' ? setInclude : setExclude;
    const list = bucket === 'include' ? include : exclude;
    if (list.some((x) => x.urn === e.urn)) return;
    setter([...list, e]);
  };

  const addEntities = (items: TargetingEntity[], to: 'include' | 'exclude') => {
    const list = to === 'include' ? include : exclude;
    const existing = new Set(list.map((x) => x.urn));
    const fresh = items.filter((e) => !existing.has(e.urn));
    if (!fresh.length) {
      toast({ title: 'Already added', description: 'All of those values are in the list.' });
      return;
    }
    (to === 'include' ? setInclude : setExclude)([...list, ...fresh]);
    toast({ title: `Added ${fresh.length} to ${to}` });
  };


  const removeEntity = (urn: string, from: 'include' | 'exclude') => {
    if (from === 'include') setInclude(include.filter((e) => e.urn !== urn));
    else setExclude(exclude.filter((e) => e.urn !== urn));
  };

  const handleSave = async () => {
    if (!draftName.trim()) {
      toast({ title: 'Name required', variant: 'destructive' });
      return;
    }
    const ok = await saveTemplate({
      id: activeId || undefined,
      name: draftName.trim(),
      description: draftDescription,
      entities: include,
      exclude_entities: exclude,
    });
    if (ok && selectedCampaignIds.length && activeId) {
      await setAssignedCampaigns(
        activeId,
        selectedCampaignIds.map((id) => ({
          id,
          name: campaigns.find((c) => c.id === id)?.name || id,
        })),
      );
    }
  };

  const handleApply = async () => {
    if (!accessToken || !activeTemplate) return;
    const targets = selectedCampaignIds.map((id) => ({
      id,
      name: campaigns.find((c) => c.id === id)?.name || id,
    }));
    if (!targets.length) {
      toast({ title: 'Pick at least one campaign', variant: 'destructive' });
      return;
    }
    const res = await syncAudience(accessToken, activeTemplate, targets);
    setSyncResults(res);
    const okCount = res.filter((r) => r.success).length;
    toast({
      title: `Applied "${activeTemplate.name}"`,
      description: `${okCount} of ${res.length} campaigns updated.`,
      variant: okCount === res.length ? 'default' : 'destructive',
    });
  };

  const currentList = bucket === 'include' ? include : exclude;

  if (!selectedAccount) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Select an ad account to manage audience templates.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      {/* Library */}
      <Card className="h-fit">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="h-4 w-4 text-primary" />
            Audiences
          </CardTitle>
          <Button size="sm" variant="outline" onClick={newTemplate}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            New
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
          {!isLoading && !templates.length && (
            <div className="text-sm text-muted-foreground">
              No audiences yet. Create one and assign it to campaigns.
            </div>
          )}
          <ScrollArea className="max-h-[460px]">
            <div className="space-y-2 pr-2">
              {templates.map((t) => {
                const asg = assignmentsFor(t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => loadTemplate(t)}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      activeId === t.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{t.name}</span>
                      <Badge variant="secondary" className="shrink-0 text-[10px]">
                        {asg.length} campaigns
                      </Badge>
                    </div>
                    <div className="mt-1 flex gap-3 text-[11px] text-muted-foreground">
                      <span>{t.entities.length} included</span>
                      <span>{t.exclude_entities.length} excluded</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Editor */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {activeId ? 'Edit audience' : 'New audience'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                placeholder="Audience name (e.g. ICP – Healthcare Directors)"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
              />
              <Input
                placeholder="Description (optional)"
                value={draftDescription}
                onChange={(e) => setDraftDescription(e.target.value)}
              />
            </div>

            {/* Import from an existing campaign */}
            <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Download className="h-4 w-4 text-primary" />
                Start from an existing campaign
              </div>
              <p className="text-xs text-muted-foreground">
                Pulls that campaign's current titles, skills, companies and industries — including its
                exclusions — into the editor below so you can tweak instead of rebuild.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="flex-1">
                  <CampaignSearchSelect
                    campaigns={campaigns}
                    selectedCampaignIds={importCampaignId ? [importCampaignId] : []}
                    onChange={(ids) => setImportCampaignId(ids.length ? ids[ids.length - 1] : null)}
                    disabled={isImporting}
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={importFromCampaign}
                  disabled={!importCampaignId || isImporting}
                >
                  {isImporting ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="mr-1 h-3.5 w-3.5" />
                  )}
                  Import targeting
                </Button>
              </div>
            </div>



            {/* Search */}
            <div className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={activeFacet}
                  onValueChange={(v) => {
                    setActiveFacet(v);
                    setResults([]);
                    setQuery('');
                  }}
                >
                  <SelectTrigger className="w-[280px]">
                    <SelectValue placeholder="Targeting field" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {FACET_GROUPS.map((g) => (
                      <SelectGroup key={g}>
                        <SelectLabel>{g}</SelectLabel>
                        {FACETS.filter((f) => f.group === g).map((f) => (
                          <SelectItem key={f.facet} value={f.facet}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
                <Separator orientation="vertical" className="mx-1 h-6" />
                <Button
                  size="sm"
                  variant={bucket === 'include' ? 'default' : 'outline'}
                  onClick={() => setBucket('include')}
                >
                  <Users className="mr-1 h-3.5 w-3.5" />
                  Include
                </Button>
                <Button
                  size="sm"
                  variant={bucket === 'exclude' ? 'destructive' : 'outline'}
                  onClick={() => setBucket('exclude')}
                >
                  <Ban className="mr-1 h-3.5 w-3.5" />
                  Exclude
                </Button>
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder={
                    activeFacetDef?.typeahead
                      ? `Search ${facetLabel(activeFacet).toLowerCase()}…`
                      : `Browse all ${facetLabel(activeFacet).toLowerCase()} values — optional filter`
                  }
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                />
                <Button onClick={runSearch} disabled={isSearching}>
                  {isSearching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : activeFacetDef?.typeahead ? (
                    <Search className="h-4 w-4" />
                  ) : (
                    <>
                      <Layers className="mr-1 h-4 w-4" />
                      Load values
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={() => setShowBulk(true)} disabled={!accessToken}>
                  <Upload className="mr-1 h-4 w-4" />
                  Bulk add
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Bulk add pastes a whole list of {facetLabel(activeFacet).toLowerCase()} at once into the{' '}
                <span className={bucket === 'exclude' ? 'text-destructive' : 'text-primary'}>{bucket}</span> layer.
              </p>


              {results.length > 0 && (
                <ScrollArea className="max-h-40">
                  <div className="flex flex-wrap gap-1.5 pr-2">
                    {results.map((r) => (
                      <button
                        key={r.urn}
                        onClick={() => addEntity(r)}
                        className="rounded-full border border-border px-2.5 py-1 text-xs hover:bg-muted"
                      >
                        + {r.name}
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>

            {/* Audience breakdown — one row per targeting field, include vs exclude */}
            <div className="rounded-lg border border-border">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Layers className="h-4 w-4 text-primary" />
                  Audience breakdown
                  <Badge variant="secondary" className="text-[10px]">
                    {include.length} included
                  </Badge>
                  <Badge variant="secondary" className="text-[10px]">
                    {exclude.length} excluded
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    className="h-8 w-56"
                    placeholder="Filter values…"
                    value={facetFilter}
                    onChange={(e) => setFacetFilter(e.target.value)}
                  />
                  {(include.length > 0 || exclude.length > 0) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setInclude([]);
                        setExclude([]);
                      }}
                    >
                      Clear all
                    </Button>
                  )}
                </div>
              </div>

              {!usedFacets.length && (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                  Nothing yet — import from a campaign or search a field above.
                </div>
              )}

              {usedFacets.map((f) => {
                const inc = include.filter((e) => entityFacet(e) === f);
                const exc = exclude.filter((e) => entityFacet(e) === f);
                const isOpen = !collapsedFacets.includes(f);
                const q = facetFilter.trim().toLowerCase();
                const match = (e: TargetingEntity) => !q || e.name?.toLowerCase().includes(q);
                const incF = inc.filter(match);
                const excF = exc.filter(match);
                if (q && !incF.length && !excF.length) return null;

                const chips = (items: TargetingEntity[], from: 'include' | 'exclude') => (
                  <div className="flex flex-wrap gap-1.5">
                    {items.length === 0 && (
                      <span className="text-[11px] text-muted-foreground">—</span>
                    )}
                    {items.map((e) => (
                      <Badge
                        key={`${from}-${f}-${e.urn}`}
                        variant="outline"
                        className={`max-w-full gap-1 ${
                          from === 'exclude'
                            ? 'border-destructive/30 bg-destructive/10 text-destructive'
                            : colorForFacet(f)
                        }`}
                        title={e.name || e.urn}
                      >
                        <span className="truncate">{e.name || e.urn}</span>
                        <X
                          className="h-3 w-3 shrink-0 cursor-pointer"
                          onClick={() => removeEntity(e.urn, from)}
                        />
                      </Badge>
                    ))}
                  </div>
                );

                return (
                  <div key={f} className="border-b border-border last:border-0">
                    <button
                      onClick={() =>
                        setCollapsedFacets((prev) =>
                          prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f],
                        )
                      }
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted/40"
                    >
                      <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                        {isOpen ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                        {facetLabel(f)}
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="text-primary">{inc.length} incl.</span>
                        <span className="text-destructive">{exc.length} excl.</span>
                      </span>
                    </button>

                    {isOpen && (
                      <div className="grid gap-3 px-3 pb-3 md:grid-cols-2">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" /> Include ({incF.length})
                            </span>
                            {inc.length > 0 && (
                              <button
                                className="hover:text-foreground"
                                onClick={() =>
                                  setInclude(include.filter((e) => entityFacet(e) !== f))
                                }
                              >
                                Clear
                              </button>
                            )}
                          </div>
                          {chips(incF, 'include')}
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Ban className="h-3 w-3" /> Exclude ({excF.length})
                            </span>
                            {exc.length > 0 && (
                              <button
                                className="hover:text-foreground"
                                onClick={() =>
                                  setExclude(exclude.filter((e) => entityFacet(e) !== f))
                                }
                              >
                                Clear
                              </button>
                            )}
                          </div>
                          {chips(excF, 'exclude')}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>



            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSave} disabled={!draftName.trim()}>
                {activeId ? 'Save changes' : 'Create audience'}
              </Button>
              {activeId && (
                <Button
                  variant="ghost"
                  className="text-destructive"
                  onClick={async () => {
                    await deleteTemplate(activeId);
                    newTemplate();
                  }}
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  Delete
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Assignment + sync */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Run this audience on campaigns</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <CampaignSearchSelect
              campaigns={campaigns}
              selectedCampaignIds={selectedCampaignIds}
              onChange={setSelectedCampaignIds}
              disabled={!activeId}
            />
            <p className="text-xs text-muted-foreground">
              Applying <strong>replaces</strong> each campaign's include targeting with this audience, then
              adds its exclusions. Assignments are saved so you can re-sync after editing the audience.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleApply}
                disabled={!canWrite || !activeId || isSyncing || !selectedCampaignIds.length}
              >
                {isSyncing ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1 h-4 w-4" />
                )}
                Apply to {selectedCampaignIds.length} campaign{selectedCampaignIds.length === 1 ? '' : 's'}
              </Button>
              {activeId && (
                <Button
                  variant="outline"
                  onClick={() =>
                    setAssignedCampaigns(
                      activeId,
                      selectedCampaignIds.map((id) => ({
                        id,
                        name: campaigns.find((c) => c.id === id)?.name || id,
                      })),
                    )
                  }
                >
                  Save assignment only
                </Button>
              )}
            </div>
            {!canWrite && (
              <p className="text-xs text-destructive">
                Viewer access only — write permissions are required to apply targeting.
              </p>
            )}

            {activeId && assignmentsFor(activeId).length > 0 && (
              <div className="rounded-lg border border-border">
                {assignmentsFor(activeId).map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 text-xs last:border-0"
                  >
                    <span className="truncate">{a.campaign_name || a.campaign_id}</span>
                    <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
                      {a.last_sync_status === 'success' && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                      )}
                      {a.last_sync_status === 'failed' && (
                        <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                      )}
                      {a.last_synced_at
                        ? new Date(a.last_synced_at).toLocaleString()
                        : 'never synced'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {syncResults && syncResults.length > 0 && (
              <div className="rounded-lg border border-border p-3 text-xs">
                {syncResults.map((r) => (
                  <div key={r.campaignId} className="flex gap-2 py-0.5">
                    {r.success ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                    ) : (
                      <AlertCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
                    )}
                    <span className="font-medium">
                      {campaigns.find((c) => c.id === r.campaignId)?.name || r.campaignId}
                    </span>
                    <span className="text-muted-foreground">{r.message}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
