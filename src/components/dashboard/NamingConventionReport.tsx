import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNamingConvention, parseName } from '@/hooks/useNamingConvention';
import { useCampaignReporting, CampaignData } from '@/hooks/useCampaignReporting';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { WidgetCard, EmptyState, StatusPill, SegmentedControl } from './widgets';
import { Pencil, Trash2, RefreshCw, Tags, Inbox, X } from 'lucide-react';

interface NamingConventionReportProps {
  accessToken: string | null;
  selectedAccount: string | null;
}

// ─── Setup Wizard ────────────────────────────────────────────────────────────

function SetupWizard({
  accountId,
  onSaved,
}: {
  accountId: string;
  onSaved: () => void;
}) {
  const { saveConvention } = useNamingConvention();
  const [separator, setSeparator] = useState('_');
  const [exampleName, setExampleName] = useState('');
  const [labels, setLabels] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const parts = useMemo(() => {
    if (!exampleName || !separator) return [];
    return exampleName.split(separator);
  }, [exampleName, separator]);

  // Sync labels array length to parts length
  useEffect(() => {
    setLabels(prev => {
      const next = [...prev];
      while (next.length < parts.length) next.push('');
      return next.slice(0, parts.length);
    });
  }, [parts.length]);

  const handleLabelChange = (i: number, value: string) => {
    setLabels(prev => {
      const next = [...prev];
      next[i] = value;
      return next;
    });
  };

  const canSave = labels.length > 0 && labels.every(l => l.trim() !== '');

  const handleSave = async () => {
    setIsSaving(true);
    const ok = await saveConvention(accountId, separator, labels.map(l => l.trim()));
    setIsSaving(false);
    if (ok) onSaved();
  };

  return (
    <WidgetCard
      title="Set Up Naming Convention"
      subtitle="Define how your campaign names are structured so we can parse them into labeled segments"
      className="max-w-xl"
    >
      <div className="space-y-5">
        {/* Step 1: Separator */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Separator character
          </Label>
          <Input
            value={separator}
            onChange={e => setSeparator(e.target.value)}
            className="w-24 h-9"
            maxLength={5}
            placeholder="_"
          />
        </div>

        {/* Step 2: Example name */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Example campaign name
          </Label>
          <Input
            value={exampleName}
            onChange={e => setExampleName(e.target.value)}
            placeholder={`e.g. lg${separator}titles${separator}us`}
            className="font-mono h-9"
          />
          {parts.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {parts.map((part, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 rounded-md border border-border/70 bg-secondary/60 text-xs font-mono"
                >
                  {part}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Step 3: Label each segment */}
        {parts.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Label each segment
            </Label>
            <div className="space-y-2">
              {parts.map((part, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="font-mono text-xs w-32 truncate text-muted-foreground bg-secondary/60 border border-border/60 px-2 py-1.5 rounded-md">
                    {part}
                  </span>
                  <span className="text-muted-foreground/60">→</span>
                  <Input
                    value={labels[i] ?? ''}
                    onChange={e => handleLabelChange(i, e.target.value)}
                    placeholder={`segment ${i + 1} name`}
                    className="w-40 h-8 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <Button onClick={handleSave} disabled={!canSave || isSaving}>
          {isSaving ? 'Saving…' : 'Save Convention'}
        </Button>
      </div>
    </WidgetCard>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 0) {
  return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtCurrency(n: number) {
  return `$${n.toFixed(2)}`;
}

function safeAvg(total: number, count: number) {
  return count === 0 ? 0 : total / count;
}

// ─── Flat View ────────────────────────────────────────────────────────────────

interface FlatRow extends CampaignData {
  parsedSegments: Record<string, string>;
  isFullMatch: boolean;
}

function FlatView({
  rows,
  segments,
}: {
  rows: FlatRow[];
  segments: string[];
}) {
  const [segmentFilters, setSegmentFilters] = useState<Record<string, string>>({});

  // Distinct values per segment for filter dropdowns
  const distinctValues = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    segments.forEach(seg => {
      map[seg] = new Set();
      rows.forEach(r => {
        const v = r.parsedSegments[seg];
        if (v) map[seg].add(v);
      });
    });
    return map;
  }, [rows, segments]);

  const filtered = useMemo(() => {
    return rows.filter(row => {
      return segments.every(seg => {
        const filterVal = segmentFilters[seg];
        if (!filterVal || filterVal === '__all__') return true;
        return row.parsedSegments[seg] === filterVal;
      });
    });
  }, [rows, segments, segmentFilters]);

  const hasActiveFilters = Object.values(segmentFilters).some(v => v && v !== '__all__');

  return (
    <WidgetCard
      noPadding
      title="Campaigns"
      subtitle={`${filtered.length} of ${rows.length} shown`}
      toolbar={
        <>
          {segments.map(seg => {
            const values = Array.from(distinctValues[seg] ?? []).sort();
            return (
              <Select
                key={seg}
                value={segmentFilters[seg] ?? '__all__'}
                onValueChange={v => setSegmentFilters(prev => ({ ...prev, [seg]: v }))}
              >
                <SelectTrigger className="h-8 w-[140px] text-sm bg-card border-border capitalize">
                  <SelectValue placeholder={seg} />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="__all__">All {seg}</SelectItem>
                  {values.map(v => (
                    <SelectItem key={v} value={v}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            );
          })}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSegmentFilters({})}
              className="gap-1 h-8 text-xs"
            >
              <X className="h-3 w-3" />
              Clear
            </Button>
          )}
        </>
      }
    >
      <Table className="min-w-[900px]">
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent bg-secondary/40">
            <TableHead className="min-w-[200px]">Campaign Name</TableHead>
            <TableHead>Compliance</TableHead>
            {segments.map(seg => (
              <TableHead key={seg} className="capitalize">{seg}</TableHead>
            ))}
            <TableHead className="text-right">Impressions</TableHead>
            <TableHead className="text-right">Clicks</TableHead>
            <TableHead className="text-right">Spend</TableHead>
            <TableHead className="text-right">Leads</TableHead>
            <TableHead className="text-right">CTR</TableHead>
            <TableHead className="text-right">CPC</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7 + segments.length} className="text-center py-10 text-muted-foreground">
                No campaigns match the selected filters
              </TableCell>
            </TableRow>
          ) : (
            filtered.map(row => (
              <TableRow key={row.campaignId} className="hover:bg-secondary/30 [&>td]:py-2.5">
                <TableCell className="font-medium">
                  <div className="break-words">{row.campaignName}</div>
                  <div className="text-[11px] text-muted-foreground font-mono">ID: {row.campaignId}</div>
                </TableCell>
                <TableCell>
                  {row.isFullMatch
                    ? <StatusPill tone="success" label="Compliant" />
                    : <StatusPill tone="warning" label="Partial" />}
                </TableCell>
                {segments.map(seg => (
                  <TableCell key={seg} className="text-sm">
                    {row.parsedSegments[seg] || <span className="text-muted-foreground/50">—</span>}
                  </TableCell>
                ))}
                <TableCell className="text-right tabular-nums">{fmt(row.impressions)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(row.clicks)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtCurrency(row.spent)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(row.leads)}</TableCell>
                <TableCell className="text-right tabular-nums">{row.ctr.toFixed(2)}%</TableCell>
                <TableCell className="text-right tabular-nums">{fmtCurrency(row.cpc)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </WidgetCard>
  );
}

// ─── Grouped View ─────────────────────────────────────────────────────────────

function GroupedView({
  rows,
  segments,
}: {
  rows: FlatRow[];
  segments: string[];
}) {
  const [groupBy, setGroupBy] = useState(segments[0] ?? '');

  const grouped = useMemo(() => {
    const map: Record<string, FlatRow[]> = {};
    rows.forEach(row => {
      const key = row.parsedSegments[groupBy] || '(unmatched)';
      if (!map[key]) map[key] = [];
      map[key].push(row);
    });

    return Object.entries(map)
      .map(([value, campaigns]) => {
        const impressions = campaigns.reduce((s, c) => s + c.impressions, 0);
        const clicks = campaigns.reduce((s, c) => s + c.clicks, 0);
        const spent = campaigns.reduce((s, c) => s + c.spent, 0);
        const leads = campaigns.reduce((s, c) => s + c.leads, 0);
        const ctr = safeAvg(campaigns.reduce((s, c) => s + c.ctr, 0), campaigns.length);
        const cpc = safeAvg(campaigns.reduce((s, c) => s + c.cpc, 0), campaigns.length);
        return { value, count: campaigns.length, impressions, clicks, spent, leads, ctr, cpc };
      })
      .sort((a, b) => b.spent - a.spent);
  }, [rows, groupBy]);

  return (
    <WidgetCard
      noPadding
      title="Grouped Performance"
      subtitle={`Aggregated by ${groupBy}`}
      toolbar={
        <Select value={groupBy} onValueChange={setGroupBy}>
          <SelectTrigger className="h-8 w-[150px] text-sm bg-card border-border capitalize">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            {segments.map(seg => (
              <SelectItem key={seg} value={seg}>{seg}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      <Table className="min-w-[700px]">
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent bg-secondary/40">
            <TableHead className="capitalize">{groupBy} value</TableHead>
            <TableHead className="text-right"># Campaigns</TableHead>
            <TableHead className="text-right">Impressions</TableHead>
            <TableHead className="text-right">Clicks</TableHead>
            <TableHead className="text-right">Spend</TableHead>
            <TableHead className="text-right">Leads</TableHead>
            <TableHead className="text-right">Avg CTR</TableHead>
            <TableHead className="text-right">Avg CPC</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {grouped.map(row => (
            <TableRow key={row.value} className="hover:bg-secondary/30 [&>td]:py-2.5">
              <TableCell className="font-medium">{row.value}</TableCell>
              <TableCell className="text-right tabular-nums">{row.count}</TableCell>
              <TableCell className="text-right tabular-nums">{fmt(row.impressions)}</TableCell>
              <TableCell className="text-right tabular-nums">{fmt(row.clicks)}</TableCell>
              <TableCell className="text-right tabular-nums">{fmtCurrency(row.spent)}</TableCell>
              <TableCell className="text-right tabular-nums">{fmt(row.leads)}</TableCell>
              <TableCell className="text-right tabular-nums">{row.ctr.toFixed(2)}%</TableCell>
              <TableCell className="text-right tabular-nums">{fmtCurrency(row.cpc)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </WidgetCard>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function NamingConventionReport({
  accessToken,
  selectedAccount,
}: NamingConventionReportProps) {
  const {
    convention,
    isLoading: isLoadingConvention,
    fetchConvention,
    deleteConvention,
  } = useNamingConvention();

  const {
    campaignData,
    isLoading: isLoadingCampaigns,
    dateRange,
    setDateRange,
    timeFrameOptions,
    fetchCampaignReport,
  } = useCampaignReporting(accessToken);

  const [isEditing, setIsEditing] = useState(false);
  const [viewMode, setViewMode] = useState<'flat' | 'grouped'>('flat');
  const [selectedTimeFrame, setSelectedTimeFrame] = useState('30d');

  // Load convention whenever account changes
  useEffect(() => {
    if (selectedAccount) {
      fetchConvention(selectedAccount);
    }
  }, [selectedAccount, fetchConvention]);

  // Fetch campaign data whenever account or date range changes (and convention exists)
  useEffect(() => {
    if (selectedAccount && convention) {
      fetchCampaignReport(selectedAccount);
    }
  }, [selectedAccount, convention, dateRange, fetchCampaignReport]);

  const handleTimeFrameChange = useCallback((value: string) => {
    setSelectedTimeFrame(value);
    const option = timeFrameOptions.find(o => o.value === value);
    if (option) {
      setDateRange({
        start: option.startDate.toISOString().split('T')[0],
        end: option.endDate.toISOString().split('T')[0],
      });
    }
  }, [timeFrameOptions, setDateRange]);

  const handleConventionSaved = useCallback(() => {
    setIsEditing(false);
    if (selectedAccount) {
      fetchConvention(selectedAccount);
    }
  }, [selectedAccount, fetchConvention]);

  const handleDelete = useCallback(async () => {
    if (!selectedAccount) return;
    if (!confirm('Delete naming convention for this account?')) return;
    await deleteConvention(selectedAccount);
  }, [selectedAccount, deleteConvention]);

  // Parse all campaign names using current convention
  const flatRows: FlatRow[] = useMemo(() => {
    if (!convention) return [];
    return campaignData.map(c => {
      const parsed = parseName(c.campaignName, convention.separator, convention.segments);
      return { ...c, parsedSegments: parsed.segments, isFullMatch: parsed.isFullMatch };
    });
  }, [campaignData, convention]);

  if (!selectedAccount) {
    return (
      <WidgetCard noPadding>
        <EmptyState
          icon={Tags}
          title="No account selected"
          description="Select an account to use naming convention reports."
        />
      </WidgetCard>
    );
  }

  if (isLoadingConvention) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  // Setup wizard (no convention yet, or editing)
  if (!convention || isEditing) {
    return (
      <div>
        {isEditing && convention && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(false)}
            className="mb-4 gap-1"
          >
            <X className="h-3 w-3" />
            Cancel
          </Button>
        )}
        <SetupWizard
          accountId={selectedAccount}
          onSaved={handleConventionSaved}
        />
      </div>
    );
  }

  // Report view (convention defined)
  return (
    <div className="space-y-4">
      {/* Header: pattern + controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 text-sm font-medium">
            {convention.segments.map((seg, i) => (
              <span key={seg} className="flex items-center gap-1">
                {i > 0 && (
                  <span className="text-muted-foreground font-mono px-0.5">
                    {convention.separator}
                  </span>
                )}
                <Badge variant="secondary" className="capitalize">{seg}</Badge>
              </span>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="gap-1 h-8 text-xs">
            <Pencil className="h-3 w-3" />
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDelete} className="gap-1 h-8 text-xs text-destructive hover:text-destructive">
            <Trash2 className="h-3 w-3" />
            Delete
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {/* Time frame picker */}
          <Select value={selectedTimeFrame} onValueChange={handleTimeFrameChange}>
            <SelectTrigger className="h-8 w-[140px] text-sm bg-card border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              {timeFrameOptions.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Refresh */}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => fetchCampaignReport(selectedAccount)}
            disabled={isLoadingCampaigns}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoadingCampaigns ? 'animate-spin' : ''}`} />
          </Button>

          {/* View toggle */}
          <SegmentedControl
            size="sm"
            value={viewMode}
            onChange={setViewMode}
            options={[
              { value: 'flat', label: 'Flat' },
              { value: 'grouped', label: 'Grouped' },
            ]}
          />
        </div>
      </div>

      {/* Data */}
      {isLoadingCampaigns ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      ) : campaignData.length === 0 ? (
        <WidgetCard noPadding>
          <EmptyState
            icon={Inbox}
            title="No campaign data"
            description="No campaign data available for the selected time period."
          />
        </WidgetCard>
      ) : viewMode === 'flat' ? (
        <FlatView rows={flatRows} segments={convention.segments} />
      ) : (
        <GroupedView rows={flatRows} segments={convention.segments} />
      )}
    </div>
  );
}
