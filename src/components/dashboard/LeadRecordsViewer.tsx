import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { cn } from '@/lib/utils';
import {
  RefreshCw,
  Download,
  Search,
  Users,
  Mail,
  Building2,
  Calendar,
  ChevronDown,
  Copy,
  Check,
  X,
  AlertCircle,
  Inbox,
} from 'lucide-react';
import { useLeadFormResponses, LeadFormResponse } from '@/hooks/useLeadFormResponses';
import { exportToCSV } from '@/lib/exportUtils';
import { useToast } from '@/hooks/use-toast';

interface LeadRecordsViewerProps {
  accessToken: string | null;
  selectedAccount: string | null;
}

const PERIOD_OPTIONS = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '180', label: 'Last 6 months' },
  { value: '365', label: 'Last 12 months' },
];

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDateRange(days: number) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  return {
    start: formatLocalDate(start),
    end: formatLocalDate(end),
  };
}

// ── Copy-to-clipboard cell button ─────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="ml-1.5 shrink-0 opacity-0 group-hover/cell:opacity-100 transition-opacity duration-150 text-muted-foreground/50 hover:text-muted-foreground focus:opacity-100 focus:outline-none"
      title={copied ? 'Copied!' : 'Copy to clipboard'}
      aria-label="Copy to clipboard"
    >
      {copied
        ? <Check className="h-3 w-3 text-green-500" />
        : <Copy className="h-3 w-3" />}
    </button>
  );
}

// ── Individual lead row ────────────────────────────────────────────────────────
function LeadRow({
  lead,
  customKeys,
}: {
  lead: LeadFormResponse;
  customKeys: string[];
}) {
  return (
    <TableRow
      className={cn(
        'group transition-colors duration-150',
        lead.testLead && 'opacity-60',
        'hover:bg-muted/20',
      )}
    >
      {/* Name */}
      <TableCell className="px-4 py-2.5 font-medium text-sm whitespace-nowrap">
        {[lead.firstName, lead.lastName].filter(Boolean).join(' ') || '—'}
      </TableCell>

      {/* Company */}
      <TableCell className="px-4 py-2.5">
        <div className="group/cell flex items-center min-w-0">
          <span className="text-sm text-foreground/80 truncate max-w-[180px]">
            {lead.company || '—'}
          </span>
          {lead.company && <CopyButton text={lead.company} />}
        </div>
      </TableCell>

      {/* Email */}
      <TableCell className="px-4 py-2.5">
        <div className="group/cell flex items-center gap-0.5">
          <span className="text-sm text-muted-foreground font-mono whitespace-nowrap truncate max-w-[220px]">
            {lead.email || '—'}
          </span>
          {lead.email && <CopyButton text={lead.email} />}
        </div>
      </TableCell>

      {/* Submitted date */}
      <TableCell className="px-4 py-2.5 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
        {lead.submittedAt
          ? new Date(lead.submittedAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : '—'}
      </TableCell>

      {/* Custom field columns */}
      {customKeys.map((key) => (
        <TableCell key={key} className="px-4 py-2.5 text-sm text-foreground/80 max-w-[200px] truncate">
          {lead.customAnswers[key] || '—'}
        </TableCell>
      ))}

      {/* Status badge */}
      <TableCell className="px-4 py-2.5 w-[64px] text-center">
        {lead.testLead ? (
          <span className="inline-flex items-center rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 ring-1 ring-inset ring-amber-500/20">
            test
          </span>
        ) : (
          <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 ring-1 ring-inset ring-emerald-500/20">
            real
          </span>
        )}
      </TableCell>
    </TableRow>
  );
}

// ── Skeleton table ─────────────────────────────────────────────────────────────
function LeadTableSkeleton() {
  return (
    <div className="rounded-xl border border-border/60 overflow-hidden">
      {/* Header */}
      <div className="bg-muted/30 border-b border-border/40 px-4 h-10 flex items-center gap-6">
        <Skeleton className="h-3 w-16 rounded" />
        <Skeleton className="h-3 w-20 rounded" />
        <Skeleton className="h-3 w-28 rounded" />
        <Skeleton className="h-3 w-14 rounded" />
        <Skeleton className="h-3 w-10 rounded" />
      </div>
      {/* Rows */}
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className="border-b border-border/20 px-4 py-3 flex items-center gap-6"
          style={{ animationDelay: `${i * 40}ms` }}
        >
          <Skeleton className="h-3.5 w-28 rounded" />
          <Skeleton className="h-3.5 w-24 rounded" />
          <Skeleton className="h-3 w-40 rounded" />
          <Skeleton className="h-3 w-16 rounded" />
          <Skeleton className="h-4 w-8 rounded-md" />
        </div>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function LeadRecordsViewer({ accessToken, selectedAccount }: LeadRecordsViewerProps) {
  const { toast } = useToast();
  const [period, setPeriod] = useState('90');
  const [searchQuery, setSearchQuery] = useState('');
  const [showTestLeads, setShowTestLeads] = useState(false);

  const dateRange = useMemo(() => getDateRange(Number(period)), [period]);

  const {
    leads,
    isLoading,
    error,
    hasMore,
    total,
    fetchLeads,
    loadMore,
    clearLeads,
  } = useLeadFormResponses(accessToken, dateRange);

  const handleFetch = useCallback(() => {
    if (!selectedAccount) return;
    clearLeads();
    fetchLeads(selectedAccount);
  }, [selectedAccount, clearLeads, fetchLeads]);

  const filteredLeads = useMemo(() => {
    let result = leads;
    if (!showTestLeads) {
      result = result.filter((l) => !l.testLead);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (l) =>
          l.firstName.toLowerCase().includes(q) ||
          l.lastName.toLowerCase().includes(q) ||
          l.email.toLowerCase().includes(q) ||
          l.company.toLowerCase().includes(q),
      );
    }
    return result;
  }, [leads, showTestLeads, searchQuery]);

  // Collect unique custom field keys from all loaded leads (stable order)
  const customKeys = useMemo(() => {
    const keys = new Set<string>();
    leads.forEach(l => Object.keys(l.customAnswers).forEach(k => keys.add(k)));
    return Array.from(keys);
  }, [leads]);

  const handleExport = useCallback(() => {
    if (!filteredLeads.length) return;
    const rows = filteredLeads.map((l) => ({
      'First Name': l.firstName,
      'Last Name': l.lastName,
      Email: l.email,
      Company: l.company,
      'Submitted At': l.submittedAt ? new Date(l.submittedAt).toLocaleString() : '',
      'Test Lead': l.testLead ? 'Yes' : 'No',
      'Form URN': l.formUrn,
      ...l.customAnswers,
    }));
    exportToCSV(rows, `lead-records-${dateRange.start}-to-${dateRange.end}`);
    toast({ title: 'Exported', description: `${rows.length} leads exported to CSV` });
  }, [filteredLeads, dateRange, toast]);

  const isFiltered = searchQuery.trim().length > 0 || !showTestLeads;

  return (
    <div className="space-y-5">
      {/* ── Controls bar ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Period selector */}
        <div className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-card/60 px-3 py-1.5">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="border-0 bg-transparent h-7 text-xs font-medium p-0 focus:ring-0 w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Fetch button */}
        <Button
          size="sm"
          onClick={handleFetch}
          disabled={isLoading || !selectedAccount}
          className="h-8 text-xs gap-1.5"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
          {leads.length ? 'Refresh' : 'Fetch Leads'}
        </Button>

        {/* Search input with clear */}
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search name, email, company…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-8 h-8 text-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Test leads toggle */}
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showTestLeads}
            onChange={(e) => setShowTestLeads(e.target.checked)}
            className="rounded border-border h-3.5 w-3.5 accent-primary"
          />
          Show test leads
        </label>

        {/* Export */}
        {filteredLeads.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="h-8 text-xs gap-1.5 ml-auto"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        )}
      </div>

      {/* ── Stats bar ─────────────────────────────────────────────────── */}
      {leads.length > 0 && (
        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-1.5">
            <Users className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="font-semibold tabular-nums">{filteredLeads.length.toLocaleString()}</span>
            <span className="text-muted-foreground text-xs">
              {filteredLeads.length === 1 ? 'lead' : 'leads'}
            </span>
          </div>
          {isFiltered && filteredLeads.length !== leads.length && (
            <span className="text-xs text-muted-foreground">
              filtered from {leads.length.toLocaleString()} total
            </span>
          )}
          {total > leads.length && (
            <span className="text-xs text-muted-foreground/60">
              · {total.toLocaleString()} available on server
            </span>
          )}
        </div>
      )}

      {/* ── Error state ───────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Failed to load leads</p>
            <p className="text-destructive/80 text-xs mt-0.5">{error}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleFetch}
            className="ml-auto h-7 text-xs shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            Retry
          </Button>
        </div>
      )}

      {/* ── Empty state: no account ───────────────────────────────────── */}
      {!selectedAccount && !isLoading && (
        <div className="rounded-xl border border-border/60 bg-muted/10 py-16 px-6 text-center">
          <Users className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No account selected</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Select an ad account from the header to view leads</p>
        </div>
      )}

      {/* ── Empty state: no leads loaded ─────────────────────────────── */}
      {selectedAccount && !isLoading && !error && leads.length === 0 && (
        <div className="rounded-xl border border-border/60 bg-muted/10 py-16 px-6 text-center">
          <Inbox className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No leads loaded</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Click "Fetch Leads" to load responses for this account</p>
          <Button size="sm" onClick={handleFetch} disabled={isLoading} className="mt-4 text-xs h-8 gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Fetch Leads
          </Button>
        </div>
      )}

      {/* ── Empty state: search returned nothing ─────────────────────── */}
      {!isLoading && leads.length > 0 && filteredLeads.length === 0 && (
        <div className="rounded-xl border border-border/60 bg-muted/10 py-12 px-6 text-center">
          <Search className="h-8 w-8 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No results for "{searchQuery}"</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Try a different name, email, or company</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSearchQuery('')}
            className="mt-4 text-xs h-7 gap-1"
          >
            <X className="h-3 w-3" />
            Clear search
          </Button>
        </div>
      )}

      {/* ── Loading skeleton ─────────────────────────────────────────── */}
      {isLoading && leads.length === 0 && <LeadTableSkeleton />}

      {/* ── Lead table ───────────────────────────────────────────────── */}
      {filteredLeads.length > 0 && (
        <div className="rounded-xl border border-border/60 overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="min-w-[680px]">
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap py-2.5">
                    Name
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap py-2.5">
                    <span className="flex items-center gap-1.5">
                      <Building2 className="h-3 w-3" />
                      Company
                    </span>
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap py-2.5">
                    <span className="flex items-center gap-1.5">
                      <Mail className="h-3 w-3" />
                      Email
                    </span>
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap py-2.5">
                    Submitted
                  </TableHead>
                  {customKeys.map((_, i) => (
                    <TableHead
                      key={i}
                      className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap py-2.5"
                    >
                      Custom {i + 1}
                    </TableHead>
                  ))}
                  <TableHead className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap py-2.5 w-[64px]">
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.map((lead, idx) => (
                  <LeadRow
                    key={lead.leadUrn || idx}
                    lead={lead}
                    customKeys={customKeys}
                  />
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Load more */}
          {hasMore && (
            <div className="border-t border-border/40 p-3 text-center bg-muted/10">
              <Button
                variant="ghost"
                size="sm"
                onClick={loadMore}
                disabled={isLoading}
                className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
              >
                {isLoading
                  ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  : <ChevronDown className="h-3.5 w-3.5" />}
                {isLoading ? 'Loading…' : `Load more (${leads.length} of ${total.toLocaleString()})`}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Inline loading indicator for load-more */}
      {isLoading && leads.length > 0 && (
        <div className="text-center py-2">
          <RefreshCw className="h-4 w-4 animate-spin mx-auto text-muted-foreground/50" />
        </div>
      )}
    </div>
  );
}
