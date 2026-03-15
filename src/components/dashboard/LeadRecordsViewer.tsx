import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RefreshCw, Download, Search, Users, Mail, Building2, Calendar, ChevronDown } from 'lucide-react';
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

  const handleFetch = () => {
    if (!selectedAccount) return;
    clearLeads();
    fetchLeads(selectedAccount);
  };

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
          l.company.toLowerCase().includes(q)
      );
    }
    return result;
  }, [leads, showTestLeads, searchQuery]);

  const handleExport = () => {
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
  };

  // Gather all custom answer keys across leads
  const customKeys = useMemo(() => {
    const keys = new Set<string>();
    filteredLeads.forEach((l) => Object.keys(l.customAnswers).forEach((k) => keys.add(k)));
    return Array.from(keys);
  }, [filteredLeads]);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[180px] h-9">
            <Calendar className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button size="sm" onClick={handleFetch} disabled={isLoading || !selectedAccount}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
          {leads.length ? 'Refresh' : 'Fetch Leads'}
        </Button>

        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, company…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>

        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showTestLeads}
            onChange={(e) => setShowTestLeads(e.target.checked)}
            className="rounded border-border"
          />
          Show test leads
        </label>

        {filteredLeads.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export CSV
          </Button>
        )}
      </div>

      {/* Summary pills */}
      {leads.length > 0 && (
        <div className="flex items-center gap-3 text-sm">
          <Badge variant="secondary" className="gap-1.5 px-3 py-1">
            <Users className="h-3.5 w-3.5" />
            {filteredLeads.length.toLocaleString()} lead{filteredLeads.length !== 1 ? 's' : ''}
          </Badge>
          {total > 0 && total !== filteredLeads.length && (
            <span className="text-xs text-muted-foreground">
              ({total.toLocaleString()} total from API)
            </span>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Empty / not loaded */}
      {!isLoading && !error && leads.length === 0 && (
        <div className="rounded-xl border border-border/60 bg-muted/20 p-12 text-center">
          <Users className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground text-sm">
            {selectedAccount
              ? 'Click "Fetch Leads" to load lead form responses for this account.'
              : 'Select an account first to view lead records.'}
          </p>
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && leads.length === 0 && (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-md" />
          ))}
        </div>
      )}

      {/* Lead table */}
      {filteredLeads.length > 0 && (
        <div className="rounded-xl border border-border/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full caption-bottom text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="h-10 px-3 text-left align-middle text-xs font-semibold text-muted-foreground whitespace-nowrap">Name</th>
                  <th className="h-10 px-3 text-left align-middle text-xs font-semibold text-muted-foreground whitespace-nowrap">
                    <Mail className="h-3 w-3 inline mr-1" />
                    Email
                  </th>
                  <th className="h-10 px-3 text-left align-middle text-xs font-semibold text-muted-foreground whitespace-nowrap">
                    <Building2 className="h-3 w-3 inline mr-1" />
                    Company
                  </th>
                  <th className="h-10 px-3 text-left align-middle text-xs font-semibold text-muted-foreground whitespace-nowrap">Submitted</th>
                  {customKeys.map((k) => (
                    <th key={k} className="h-10 px-3 text-left align-middle text-xs font-semibold text-muted-foreground whitespace-nowrap">
                      {k}
                    </th>
                  ))}
                  <th className="h-10 px-3 text-left align-middle text-xs font-semibold text-muted-foreground whitespace-nowrap w-[60px]">Test</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead, idx) => (
                  <tr key={lead.leadUrn || idx} className="border-b transition-colors hover:bg-muted/20">
                    <td className="px-3 py-2.5 align-middle text-sm font-medium whitespace-nowrap">
                      {lead.firstName} {lead.lastName}
                    </td>
                    <td className="px-3 py-2.5 align-middle text-sm text-muted-foreground whitespace-nowrap">{lead.email}</td>
                    <td className="px-3 py-2.5 align-middle text-sm whitespace-nowrap">{lead.company}</td>
                    <td className="px-3 py-2.5 align-middle text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                      {lead.submittedAt
                        ? new Date(lead.submittedAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </td>
                    {customKeys.map((k) => (
                      <td key={k} className="px-3 py-2.5 align-middle text-sm max-w-[200px] truncate">
                        {lead.customAnswers[k] || '—'}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 align-middle">
                      {lead.testLead && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          Test
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Load more */}
          {hasMore && (
            <div className="border-t border-border/40 p-3 text-center">
              <Button variant="ghost" size="sm" onClick={loadMore} disabled={isLoading}>
                <ChevronDown className="h-3.5 w-3.5 mr-1.5" />
                {isLoading ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
