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
import { Pencil, Trash2, RefreshCw, LayoutList, BarChart3, Plus, X } from 'lucide-react';

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
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Set Up Naming Convention</h2>
        <p className="text-sm text-muted-foreground">
          Define how your campaign names are structured so we can parse them into labeled segments.
        </p>
      </div>

      {/* Step 1: Separator */}
      <div className="space-y-2">
        <Label>Separator character</Label>
        <Input
          value={separator}
          onChange={e => setSeparator(e.target.value)}
          className="w-24"
          maxLength={5}
          placeholder="_"
        />
      </div>

      {/* Step 2: Example name */}
      <div className="space-y-2">
        <Label>Example campaign name</Label>
        <Input
          value={exampleName}
          onChange={e => setExampleName(e.target.value)}
          placeholder={`e.g. lg${separator}titles${separator}us`}
          className="font-mono"
        />
        {parts.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {parts.map((part, i) => (
              <div
                key={i}
                className="px-3 py-1 rounded border border-border bg-muted text-sm font-mono"
              >
                {part}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Step 3: Label each segment */}
      {parts.length > 0 && (
        <div className="space-y-2">
          <Label>Label each segment</Label>
          <div className="space-y-2">
            {parts.map((part, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="font-mono text-sm w-32 truncate text-muted-foreground bg-muted px-2 py-1 rounded">
                  {part}
                </span>
                <span className="text-muted-foreground">→</span>
                <Input
                  value={labels[i] ?? ''}
                  onChange={e => handleLabelChange(i, e.target.value)}
                  placeholder={`segment ${i + 1} name`}
                  className="w-40"
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
    <div className="space-y-4">
      {/* Segment filter row */}
      <div className="flex flex-wrap gap-2 items-center">
        {segments.map(seg => {
          const values = Array.from(distinctValues[seg] ?? []).sort();
          return (
            <Select
              key={seg}
              value={segmentFilters[seg] ?? '__all__'}
              onValueChange={v => setSegmentFilters(prev => ({ ...prev, [seg]: v }))}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder={seg} />
              </SelectTrigger>
              <SelectContent>
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
            className="gap-1"
          >
            <X className="h-3 w-3" />
            Clear
          </Button>
        )}
      </div>

      <div className="text-sm text-muted-foreground">
        Showing {filtered.length} of {rows.length} campaigns
      </div>

      <div className="rounded-lg border border-border overflow-x-auto">
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="min-w-[200px]">Campaign Name</TableHead>
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
                <TableCell colSpan={6 + segments.length} className="text-center py-8 text-muted-foreground">
                  No campaigns match the selected filters
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(row => (
                <TableRow key={row.campaignId} className="hover:bg-muted/20">
                  <TableCell className="font-medium">
                    <div className="break-words">{row.campaignName}</div>
                    <div className="text-xs text-muted-foreground">ID: {row.campaignId}</div>
                  </TableCell>
                  {segments.map(seg => (
                    <TableCell key={seg} className="text-sm">
                      {row.parsedSegments[seg] || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  ))}
                  <TableCell className="text-right">{fmt(row.impressions)}</TableCell>
                  <TableCell className="text-right">{fmt(row.clicks)}</TableCell>
                  <TableCell className="text-right">{fmtCurrency(row.spent)}</TableCell>
                  <TableCell className="text-right">{fmt(row.leads)}</TableCell>
                  <TableCell className="text-right">{row.ctr.toFixed(2)}%</TableCell>
                  <TableCell className="text-right">{fmtCurrency(row.cpc)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
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
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Label className="shrink-0">Group by</Label>
        <Select value={groupBy} onValueChange={setGroupBy}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {segments.map(seg => (
              <SelectItem key={seg} value={seg}>{seg}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border overflow-x-auto">
        <Table className="min-w-[700px]">
          <TableHeader>
            <TableRow className="bg-muted/30">
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
              <TableRow key={row.value} className="hover:bg-muted/20">
                <TableCell className="font-medium">{row.value}</TableCell>
                <TableCell className="text-right">{row.count}</TableCell>
                <TableCell className="text-right">{fmt(row.impressions)}</TableCell>
                <TableCell className="text-right">{fmt(row.clicks)}</TableCell>
                <TableCell className="text-right">{fmtCurrency(row.spent)}</TableCell>
                <TableCell className="text-right">{fmt(row.leads)}</TableCell>
                <TableCell className="text-right">{row.ctr.toFixed(2)}%</TableCell>
                <TableCell className="text-right">{fmtCurrency(row.cpc)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
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
      <div className="text-center py-16 text-muted-foreground">
        Select an account to use naming convention reports.
      </div>
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
    <div className="space-y-6">
      {/* Header: pattern + controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 text-sm font-medium">
            {convention.segments.map((seg, i) => (
              <span key={seg} className="flex items-center gap-1">
                {i > 0 && (
                  <span className="text-muted-foreground font-mono px-1">
                    {convention.separator}
                  </span>
                )}
                <Badge variant="secondary" className="capitalize">{seg}</Badge>
              </span>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="gap-1">
            <Pencil className="h-3 w-3" />
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDelete} className="gap-1 text-destructive hover:text-destructive">
            <Trash2 className="h-3 w-3" />
            Delete
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {/* Time frame picker */}
          <Select value={selectedTimeFrame} onValueChange={handleTimeFrameChange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {timeFrameOptions.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Refresh */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => fetchCampaignReport(selectedAccount)}
            disabled={isLoadingCampaigns}
          >
            <RefreshCw className={`h-4 w-4 ${isLoadingCampaigns ? 'animate-spin' : ''}`} />
          </Button>

          {/* View toggle */}
          <div className="flex rounded-md border border-border overflow-hidden">
            <Button
              variant={viewMode === 'flat' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none gap-1"
              onClick={() => setViewMode('flat')}
            >
              <LayoutList className="h-4 w-4" />
              Flat
            </Button>
            <Button
              variant={viewMode === 'grouped' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none gap-1"
              onClick={() => setViewMode('grouped')}
            >
              <BarChart3 className="h-4 w-4" />
              Grouped
            </Button>
          </div>
        </div>
      </div>

      {/* Data */}
      {isLoadingCampaigns ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      ) : campaignData.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No campaign data available for the selected time period.
        </div>
      ) : viewMode === 'flat' ? (
        <FlatView rows={flatRows} segments={convention.segments} />
      ) : (
        <GroupedView rows={flatRows} segments={convention.segments} />
      )}
    </div>
  );
}
