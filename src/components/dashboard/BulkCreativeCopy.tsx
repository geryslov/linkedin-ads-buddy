import { useEffect, useMemo, useState } from 'react';
import {
  useBulkCreativeCopy,
  SourceCreative,
  TargetCampaign,
} from '@/hooks/useBulkCreativeCopy';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  Search,
  RefreshCw,
  Copy,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Video,
  Image as ImageIcon,
  FileText,
  GalleryHorizontalEnd,
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

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ALL', label: 'All' },
];

// Common LinkedIn lead gen CTA labels. LinkedIn validates on save; an unsupported
// combo surfaces as a per-ad error, so the copy itself still succeeds.
const CTA_OPTIONS = [
  { value: 'DOWNLOAD', label: 'Download' },
  { value: 'LEARN_MORE', label: 'Learn more' },
  { value: 'SIGN_UP', label: 'Sign up' },
  { value: 'SUBSCRIBE', label: 'Subscribe' },
  { value: 'REGISTER', label: 'Register' },
  { value: 'REQUEST_DEMO', label: 'Request demo' },
  { value: 'GET_QUOTE', label: 'Get quote' },
  { value: 'APPLY', label: 'Apply' },
  { value: 'JOIN', label: 'Join' },
  { value: 'ATTEND', label: 'Attend' },
  { value: 'CONTACT_US', label: 'Contact us' },
];

// Radix Select can't use an empty-string value, so use a sentinel for "keep original".
const KEEP = '__KEEP__';

export function BulkCreativeCopy({ accessToken, selectedAccount }: BulkCreativeCopyProps) {
  const {
    sources,
    campaigns,
    forms,
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
  // Which source ads to load. ACTIVE by default so the list loads fast; switch to
  // ALL/DRAFT to see copies and paused/draft ads (slower on large accounts).
  const [creativeStatus, setCreativeStatus] = useState('ACTIVE');
  // Optional lead gen form + CTA to assign to lead-gen copies (KEEP = leave as-is).
  const [formId, setFormId] = useState<string>(KEEP);
  const [ctaLabel, setCtaLabel] = useState<string>(KEEP);
  const leadgenAssigned = formId !== KEEP || ctaLabel !== KEEP;

  useEffect(() => {
    if (selectedAccount) {
      setSelectedCreatives(new Set());
      setSelectedCampaigns(new Set());
      loadData(selectedAccount, { status: creativeStatus });
    }
  }, [selectedAccount, creativeStatus, loadData]);

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
      {
        adFormId: formId !== KEEP ? formId : undefined,
        ctaLabel: ctaLabel !== KEEP ? ctaLabel : undefined,
      },
    );
    if (ok) {
      // Reload so the newly created drafts appear in the source list (they have no
      // analytics yet). keepResults preserves the results table the user just got.
      loadData(selectedAccount, { keepResults: true, status: creativeStatus });
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
    <div className="space-y-4 pb-24">
      {/* Toolbar: helper + status segmented control + refresh */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Copy proven ads into other campaigns. New ads land as drafts — nothing spends
          until you activate them.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <ToggleGroup
            type="single"
            value={creativeStatus}
            onValueChange={(v) => v && setCreativeStatus(v)}
            className="rounded-lg border border-border bg-muted/50 p-0.5"
          >
            {STATUS_OPTIONS.map((o) => (
              <ToggleGroupItem
                key={o.value}
                value={o.value}
                className="h-7 px-3 text-xs data-[state=on]:bg-background data-[state=on]:shadow-sm"
              >
                {o.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => selectedAccount && loadData(selectedAccount, { status: creativeStatus })}
            disabled={isLoading}
            title="Refresh"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Selection grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SelectionPanel
          step={1}
          title="Choose ads"
          count={selectedCreatives.size}
          searchPlaceholder="Search ads…"
          search={creativeSearch}
          onSearch={setCreativeSearch}
          onSelectAll={() =>
            setSelectedCreatives(new Set(filteredCreatives.map((c) => c.creativeId)))
          }
          onClear={() => setSelectedCreatives(new Set())}
          isLoading={isLoading}
          isEmpty={filteredCreatives.length === 0}
          emptyLabel="No duplicable ads for this status."
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

        <SelectionPanel
          step={2}
          title="Choose campaigns"
          count={selectedCampaigns.size}
          searchPlaceholder="Search campaigns…"
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

      {/* Hint */}
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
        Only ad types that can be duplicated are shown. Copies reuse the original post and
        never edit the source ad.
      </p>

      {/* Lead gen form + CTA (optional; only applies to lead gen ads) */}
      {forms.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-card px-4 py-3">
          <span className="text-xs font-medium text-muted-foreground">
            Lead gen form <span className="font-normal">(optional)</span>
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Form</span>
            <Select value={formId} onValueChange={setFormId}>
              <SelectTrigger className="h-8 w-[220px] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={KEEP}>Keep original form</SelectItem>
                {forms.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">CTA</span>
            <Select value={ctaLabel} onValueChange={setCtaLabel}>
              <SelectTrigger className="h-8 w-[160px] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={KEEP}>Keep original CTA</SelectItem>
                {CTA_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <span className="text-[11px] text-muted-foreground/80">
            Applies to lead gen ads only. These copies are created as Draft so the form can be set.
          </span>
        </div>
      )}

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
                          <CheckCircle2 className="h-3.5 w-3.5" /> Created
                          {r.formApplied && <span className="text-muted-foreground">· form set</span>}
                          {r.isLeadGen && !r.formApplied && r.message && (
                            <span className="text-amber-600 dark:text-amber-500" title={r.message}>· form not set</span>
                          )}
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

      {/* Sticky action bar */}
      <div className="sticky bottom-4 z-10">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-border bg-card/95 backdrop-blur-sm px-4 py-3 shadow-lg">
          <div className="flex items-center gap-2.5 text-sm tabular-nums">
            <span className="font-semibold">{selectedCreatives.size}</span>
            <span className="text-muted-foreground">ads</span>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/60" />
            <span className="font-semibold">{selectedCampaigns.size}</span>
            <span className="text-muted-foreground">campaigns</span>
            <span className="ml-2 flex items-baseline gap-1.5 border-l border-border pl-3">
              <span className="text-base font-bold text-primary">{totalCopies}</span>
              <span className="text-muted-foreground">new drafts</span>
            </span>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Create as</span>
            <ToggleGroup
              type="single"
              value={intendedStatus}
              onValueChange={(v) => v && setIntendedStatus(v as 'DRAFT' | 'ACTIVE')}
              className="rounded-lg border border-border bg-muted/50 p-0.5"
            >
              <ToggleGroupItem value="DRAFT" className="h-7 px-3 text-xs data-[state=on]:bg-background data-[state=on]:shadow-sm">
                Draft
              </ToggleGroupItem>
              <ToggleGroupItem value="ACTIVE" className="h-7 px-3 text-xs data-[state=on]:bg-background data-[state=on]:shadow-sm">
                Active
              </ToggleGroupItem>
            </ToggleGroup>

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
                      {intendedStatus === 'ACTIVE' && (
                        <p className="flex items-start gap-1.5 text-amber-600 dark:text-amber-500">
                          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                          Prefer Draft if you want to review before they go live.
                        </p>
                      )}
                      {leadgenAssigned && (
                        <p className="text-muted-foreground">
                          Lead gen ads will get the selected
                          {formId !== KEEP ? ' form' : ''}
                          {formId !== KEEP && ctaLabel !== KEEP ? ' and' : ''}
                          {ctaLabel !== KEEP ? ' CTA' : ''}. Non–lead-gen ads are unaffected.
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
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

interface SelectionPanelProps {
  step: number;
  title: string;
  count: number;
  search: string;
  searchPlaceholder: string;
  onSearch: (v: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  isLoading: boolean;
  isEmpty: boolean;
  emptyLabel: string;
  children: React.ReactNode;
}

function SelectionPanel({
  step,
  title,
  count,
  search,
  searchPlaceholder,
  onSearch,
  onSelectAll,
  onClear,
  isLoading,
  isEmpty,
  emptyLabel,
  children,
}: SelectionPanelProps) {
  return (
    <div className="rounded-xl border border-border bg-card flex flex-col overflow-hidden">
      <div className="px-4 pt-3.5 pb-3 border-b border-border">
        <div className="flex items-center gap-2.5">
          <span className="grid h-5 w-5 place-items-center rounded-md bg-primary/10 text-[11px] font-bold text-primary">
            {step}
          </span>
          <h3 className="text-sm font-semibold">{title}</h3>
          <span
            className={cn(
              'ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-semibold tabular-nums',
              count > 0 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
            )}
          >
            {count} selected
          </span>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              className="pl-9 h-8 text-sm bg-muted/40"
            />
          </div>
          <Button variant="ghost" size="sm" className="h-8 px-2.5 text-xs" onClick={onSelectAll}>
            All
          </Button>
          <Button variant="ghost" size="sm" className="h-8 px-2.5 text-xs" onClick={onClear}>
            None
          </Button>
        </div>
      </div>
      <ScrollArea className="h-[340px]">
        <div className="p-1.5">
          {isLoading ? (
            <div className="space-y-1.5 p-1.5">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : isEmpty ? (
            <div className="text-center py-12 text-sm text-muted-foreground">{emptyLabel}</div>
          ) : (
            children
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function typeIcon(type: string) {
  const t = (type || '').toUpperCase();
  if (t.includes('VIDEO')) return Video;
  if (t.includes('CAROUSEL')) return GalleryHorizontalEnd;
  if (t.includes('DOCUMENT')) return FileText;
  return ImageIcon;
}

function shortType(type: string): string {
  const t = (type || '').toUpperCase();
  if (t.includes('VIDEO')) return 'VIDEO';
  if (t.includes('CAROUSEL')) return 'CAROUSEL';
  if (t.includes('DOCUMENT')) return 'DOCUMENT';
  if (t.includes('STATUS_UPDATE') || t.includes('IMAGE')) return 'IMAGE';
  if (t === 'UNKNOWN' || !t) return 'AD';
  return t.replace(/^SPONSORED_/, '').slice(0, 12);
}

function StatusDot({ status }: { status: string }) {
  const s = (status || '').toUpperCase();
  const color =
    s === 'ACTIVE'
      ? 'bg-emerald-500'
      : s === 'DRAFT'
        ? 'bg-amber-500'
        : s === 'PAUSED'
          ? 'bg-muted-foreground/50'
          : 'bg-muted-foreground/40';
  return <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', color)} title={s} />;
}

function Row({
  checked,
  onToggle,
  children,
}: {
  checked: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'relative w-full flex items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors',
        checked ? 'bg-primary/[0.06]' : 'hover:bg-muted/60',
      )}
    >
      {checked && (
        <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-primary" />
      )}
      <Checkbox checked={checked} className="pointer-events-none shrink-0" />
      {children}
    </button>
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
  const Icon = typeIcon(creative.type);
  return (
    <Row checked={checked} onToggle={onToggle}>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium">{creative.creativeName}</div>
        <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-muted-foreground">
          <span className="rounded border border-border bg-muted/50 px-1.5 py-px text-[10px] font-semibold tracking-wide shrink-0">
            {shortType(creative.type)}
          </span>
          <StatusDot status={creative.status} />
          <span className="truncate">{creative.campaignName}</span>
        </div>
      </div>
    </Row>
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
    <Row checked={checked} onToggle={onToggle}>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium">{campaign.name}</div>
        <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-muted-foreground">
          <StatusDot status={campaign.status} />
          <span className="capitalize">{(campaign.status || '').toLowerCase() || 'unknown'}</span>
        </div>
      </div>
    </Row>
  );
}
