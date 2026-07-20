import { useEffect, useMemo, useState } from 'react';
import {
  useBulkCreativeCopy,
  isCopyableType,
  SourceCreative,
  TargetCampaign,
} from '@/hooks/useBulkCreativeCopy';
import { CreativeTypeBadge } from './CreativeTypeBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  Search,
  RefreshCw,
  Copy,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface BulkCreativeCopyProps {
  accessToken: string | null;
  selectedAccount: string | null;
}

export function BulkCreativeCopy({ accessToken, selectedAccount }: BulkCreativeCopyProps) {
  const {
    sources,
    campaigns,
    isLoading,
    isRunning,
    results,
    summary,
    loadData,
    runCopy,
  } = useBulkCreativeCopy(accessToken);

  const [creativeSearch, setCreativeSearch] = useState('');
  const [campaignSearch, setCampaignSearch] = useState('');
  const [selectedCreatives, setSelectedCreatives] = useState<Set<string>>(new Set());
  const [selectedCampaigns, setSelectedCampaigns] = useState<Set<string>>(new Set());
  const [intendedStatus, setIntendedStatus] = useState<'DRAFT' | 'ACTIVE'>('DRAFT');

  useEffect(() => {
    if (selectedAccount) {
      setSelectedCreatives(new Set());
      setSelectedCampaigns(new Set());
      loadData(selectedAccount);
    }
  }, [selectedAccount, loadData]);

  const filteredCreatives = useMemo(() => {
    const q = creativeSearch.trim().toLowerCase();
    if (!q) return sources;
    return sources.filter(
      (c) =>
        c.creativeName.toLowerCase().includes(q) ||
        c.campaignName.toLowerCase().includes(q) ||
        c.creativeId.includes(q),
    );
  }, [sources, creativeSearch]);

  const filteredCampaigns = useMemo(() => {
    const q = campaignSearch.trim().toLowerCase();
    if (!q) return campaigns;
    return campaigns.filter(
      (c) => c.name.toLowerCase().includes(q) || c.id.includes(q),
    );
  }, [campaigns, campaignSearch]);

  const toggle = (set: Set<string>, id: string): Set<string> => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  const nonCopyableSelected = useMemo(
    () =>
      Array.from(selectedCreatives).filter((id) => {
        const c = sources.find((s) => s.creativeId === id);
        return c && !isCopyableType(c.type);
      }).length,
    [selectedCreatives, sources],
  );

  const totalCopies = selectedCreatives.size * selectedCampaigns.size;
  const campaignNameById = (id: string) =>
    campaigns.find((c) => c.id === id)?.name || id;

  const handleRun = async () => {
    if (!selectedAccount) return;
    const ok = await runCopy(
      selectedAccount,
      Array.from(selectedCreatives),
      Array.from(selectedCampaigns),
      intendedStatus,
    );
    if (ok) {
      // Reload so the newly created drafts appear in the source list (they have no
      // analytics yet). keepResults preserves the results table the user just got.
      loadData(selectedAccount, { keepResults: true });
    }
  };

  if (!selectedAccount) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Select an ad account to bulk-copy ads into other campaigns.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Intro / how it works */}
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-muted-foreground max-w-3xl">
          Copy existing ads into other campaigns. LinkedIn binds each ad to a single
          campaign, so this creates a <strong>new ad</strong> in every selected target
          campaign that reuses the source ad's content. New ads are created as
          <strong> Draft</strong> by default so nothing spends until you activate them.
          Text, Spotlight, Follower and Message/InMail ads can't be copied this way.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => selectedAccount && loadData(selectedAccount)}
          disabled={isLoading}
          className="shrink-0"
        >
          <RefreshCw className={cn('h-3.5 w-3.5 mr-2', isLoading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Selection grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Source ads */}
        <SelectionPanel
          title="Source ads"
          subtitle="Pick the ads to copy"
          count={selectedCreatives.size}
          search={creativeSearch}
          onSearch={setCreativeSearch}
          onSelectAll={() =>
            setSelectedCreatives(new Set(filteredCreatives.map((c) => c.creativeId)))
          }
          onClear={() => setSelectedCreatives(new Set())}
          isLoading={isLoading}
          isEmpty={filteredCreatives.length === 0}
          emptyLabel="No ads with data in the last 12 months."
        >
          {filteredCreatives.map((c) => (
            <CreativeRow
              key={c.creativeId}
              creative={c}
              checked={selectedCreatives.has(c.creativeId)}
              onToggle={() => setSelectedCreatives((s) => toggle(s, c.creativeId))}
            />
          ))}
        </SelectionPanel>

        {/* Target campaigns */}
        <SelectionPanel
          title="Target campaigns"
          subtitle="Copy the ads into these"
          count={selectedCampaigns.size}
          search={campaignSearch}
          onSearch={setCampaignSearch}
          onSelectAll={() =>
            setSelectedCampaigns(new Set(filteredCampaigns.map((c) => c.id)))
          }
          onClear={() => setSelectedCampaigns(new Set())}
          isLoading={isLoading}
          isEmpty={filteredCampaigns.length === 0}
          emptyLabel="No campaigns found."
        >
          {filteredCampaigns.map((c) => (
            <CampaignRow
              key={c.id}
              campaign={c}
              checked={selectedCampaigns.has(c.id)}
              onToggle={() => setSelectedCampaigns((s) => toggle(s, c.id))}
            />
          ))}
        </SelectionPanel>
      </div>

      {/* Action bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 text-sm">
            <span className="font-medium">{selectedCreatives.size}</span>
            <span className="text-muted-foreground">ads</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{selectedCampaigns.size}</span>
            <span className="text-muted-foreground">campaigns</span>
            <span className="text-muted-foreground">=</span>
            <span className="font-semibold text-primary">{totalCopies}</span>
            <span className="text-muted-foreground">new ad(s)</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Create as</span>
            <RadioGroup
              value={intendedStatus}
              onValueChange={(v) => setIntendedStatus(v as 'DRAFT' | 'ACTIVE')}
              className="flex items-center gap-3"
            >
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="DRAFT" id="status-draft" />
                <Label htmlFor="status-draft" className="text-xs cursor-pointer">Draft</Label>
              </div>
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="ACTIVE" id="status-active" />
                <Label htmlFor="status-active" className="text-xs cursor-pointer">Active</Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button disabled={totalCopies === 0 || isRunning}>
              <Copy className={cn('h-4 w-4 mr-2', isRunning && 'animate-pulse')} />
              {isRunning ? 'Copying…' : `Copy ${totalCopies || ''} ad(s)`}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Copy {totalCopies} ad(s)?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-sm">
                  <p>
                    This creates <strong>{totalCopies}</strong> new ad(s) across{' '}
                    <strong>{selectedCampaigns.size}</strong> campaign(s), set to{' '}
                    <strong>{intendedStatus === 'ACTIVE' ? 'Active' : 'Draft'}</strong>.
                    {intendedStatus === 'ACTIVE' && (
                      <span className="text-amber-600 dark:text-amber-500">
                        {' '}Active ads can begin serving and spending immediately.
                      </span>
                    )}
                  </p>
                  {nonCopyableSelected > 0 && (
                    <p className="flex items-start gap-1.5 text-amber-600 dark:text-amber-500">
                      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                      {nonCopyableSelected} selected ad(s) are a type LinkedIn can't copy
                      (Text/Spotlight/Follower/Message) and will be skipped.
                    </p>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleRun}>Copy ads</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Results */}
      {summary && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-4 px-4 py-3 border-b border-border text-sm">
            <span className="font-semibold">Results</span>
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-500">
              <CheckCircle2 className="h-4 w-4" /> {summary.succeeded} created
            </span>
            {summary.failed > 0 && (
              <span className="flex items-center gap-1.5 text-destructive">
                <XCircle className="h-4 w-4" /> {summary.failed} failed
              </span>
            )}
          </div>
          <ScrollArea className="max-h-80">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-2">Source ad</th>
                  <th className="text-left font-medium px-4 py-2">Target campaign</th>
                  <th className="text-left font-medium px-4 py-2">Result</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} className="border-t border-border/60">
                    <td className="px-4 py-2 truncate max-w-[220px]">
                      {r.sourceCreativeName || r.sourceCreativeId}
                    </td>
                    <td className="px-4 py-2 truncate max-w-[220px]">
                      {campaignNameById(r.targetCampaignId)}
                    </td>
                    <td className="px-4 py-2">
                      {r.ok ? (
                        <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-500">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Created (Draft/Active per choice)
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-destructive">
                          <XCircle className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{r.message || r.verdict}</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

interface SelectionPanelProps {
  title: string;
  subtitle: string;
  count: number;
  search: string;
  onSearch: (v: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  isLoading: boolean;
  isEmpty: boolean;
  emptyLabel: string;
  children: React.ReactNode;
}

function SelectionPanel({
  title,
  subtitle,
  count,
  search,
  onSearch,
  onSelectAll,
  onClear,
  isLoading,
  isEmpty,
  emptyLabel,
  children,
}: SelectionPanelProps) {
  return (
    <div className="rounded-xl border border-border bg-card flex flex-col">
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">{title}</h3>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          {count > 0 && <Badge variant="secondary">{count} selected</Badge>}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search…"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              className="pl-9 h-8 text-sm"
            />
          </div>
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onSelectAll}>
            All
          </Button>
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onClear}>
            None
          </Button>
        </div>
      </div>
      <ScrollArea className="h-80">
        <div className="p-2">
          {isLoading ? (
            <div className="space-y-2 p-2">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-10 rounded-md" />
              ))}
            </div>
          ) : isEmpty ? (
            <div className="text-center py-10 text-sm text-muted-foreground">{emptyLabel}</div>
          ) : (
            children
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function CreativeRow({
  creative,
  checked,
  onToggle,
}: {
  creative: SourceCreative;
  checked: boolean;
  onToggle: () => void;
}) {
  const copyable = isCopyableType(creative.type);
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'w-full flex items-center gap-3 px-2 py-2 rounded-md text-left transition-colors hover:bg-muted/60',
        checked && 'bg-primary/5',
      )}
    >
      <Checkbox checked={checked} className="pointer-events-none" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm truncate">{creative.creativeName}</span>
          {!copyable && (
            <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 shrink-0">
              not copyable
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <CreativeTypeBadge type={creative.type} />
          {creative.status && creative.status !== 'ACTIVE' && (
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] shrink-0',
                creative.status === 'DRAFT' && 'text-blue-600 border-blue-300',
              )}
            >
              {creative.status}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground truncate">{creative.campaignName}</span>
        </div>
      </div>
    </button>
  );
}

function CampaignRow({
  campaign,
  checked,
  onToggle,
}: {
  campaign: TargetCampaign;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'w-full flex items-center gap-3 px-2 py-2 rounded-md text-left transition-colors hover:bg-muted/60',
        checked && 'bg-primary/5',
      )}
    >
      <Checkbox checked={checked} className="pointer-events-none" />
      <div className="min-w-0 flex-1">
        <span className="text-sm truncate block">{campaign.name}</span>
        <span className="text-xs text-muted-foreground">{campaign.status}</span>
      </div>
    </button>
  );
}
