import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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

type EntityKind = 'title' | 'skill' | 'company' | 'industry';

const KINDS: { key: EntityKind; label: string; action: string; field: string }[] = [
  { key: 'title', label: 'Titles', action: 'search_job_titles', field: 'titles' },
  { key: 'skill', label: 'Skills', action: 'search_skills', field: 'skills' },
  { key: 'company', label: 'Companies', action: 'search_companies', field: 'companies' },
  { key: 'industry', label: 'Industries', action: 'search_industries', field: 'industries' },
];

const kindColor: Record<EntityKind, string> = {
  title: 'bg-primary/15 text-primary border-primary/30',
  skill: 'bg-accent/15 text-accent-foreground border-accent/30',
  company: 'bg-secondary text-secondary-foreground border-border',
  industry: 'bg-muted text-muted-foreground border-border',
};

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
  const [kind, setKind] = useState<EntityKind>('title');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TargetingEntity[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
  const [syncResults, setSyncResults] = useState<SyncResult[] | null>(null);

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

  const runSearch = async () => {
    if (!accessToken || query.trim().length < 2) {
      toast({ title: 'Enter at least 2 characters', variant: 'destructive' });
      return;
    }
    const cfg = KINDS.find((k) => k.key === kind)!;
    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('linkedin-api', {
        body: { action: cfg.action, accessToken, params: { query: query.trim() } },
      });
      if (error) throw error;
      const items = (data?.[cfg.field] || []) as any[];
      setResults(
        items.map((i) => ({
          id: i.id,
          urn: i.urn,
          name: i.name,
          type: kind,
          targetable: i.targetable,
        })),
      );
      if (!items.length) toast({ title: 'No results', description: `Nothing found for "${query}".` });
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

            {/* Search */}
            <div className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                {KINDS.map((k) => (
                  <Button
                    key={k.key}
                    size="sm"
                    variant={kind === k.key ? 'default' : 'outline'}
                    onClick={() => setKind(k.key)}
                  >
                    {k.label}
                  </Button>
                ))}
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
                  placeholder={`Search ${kind}s…`}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                />
                <Button onClick={runSearch} disabled={isSearching}>
                  {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>

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

            {/* Buckets */}
            <div className="grid gap-3 md:grid-cols-2">
              {(['include', 'exclude'] as const).map((b) => {
                const list = b === 'include' ? include : exclude;
                return (
                  <div key={b} className="rounded-lg border border-border p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium capitalize">{b} ({list.length})</span>
                      {list.length > 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => (b === 'include' ? setInclude([]) : setExclude([]))}
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                    <ScrollArea className="max-h-40">
                      <div className="flex flex-wrap gap-1.5 pr-2">
                        {list.map((e) => (
                          <Badge
                            key={e.urn}
                            variant="outline"
                            className={`gap-1 ${kindColor[e.type as EntityKind]}`}
                          >
                            {e.name}
                            <X
                              className="h-3 w-3 cursor-pointer"
                              onClick={() => removeEntity(e.urn, b)}
                            />
                          </Badge>
                        ))}
                        {!list.length && (
                          <span className="text-xs text-muted-foreground">Nothing yet.</span>
                        )}
                      </div>
                    </ScrollArea>
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
