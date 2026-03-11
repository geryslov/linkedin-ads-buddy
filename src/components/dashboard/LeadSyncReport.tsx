import { useEffect, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
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
import { RefreshCw, Download, ClipboardList, User, Calendar, X } from 'lucide-react';
import { useLeadGenFormsReport } from '@/hooks/useLeadGenFormsReport';
import { useLeadFormResponses } from '@/hooks/useLeadFormResponses';
import { LeadGenFormsTable } from './LeadGenFormsTable';
import { exportToCSV } from '@/lib/exportUtils';
import { useToast } from '@/hooks/use-toast';

interface LeadSyncReportProps {
  accessToken: string | null;
  selectedAccount: string | null;
}

export function LeadSyncReport({ accessToken, selectedAccount }: LeadSyncReportProps) {
  const { toast } = useToast();

  const {
    formsData,
    isLoading: formsLoading,
    error: formsError,
    fetchLeadGenForms,
    dateRange,
    timeFrameOptions,
    setTimeFrame,
  } = useLeadGenFormsReport(accessToken);

  const {
    leads,
    isLoading: leadsLoading,
    error: leadsError,
    hasMore,
    total,
    fetchLeads,
    loadMore,
    clearLeads,
  } = useLeadFormResponses(accessToken, dateRange);

  const [selectedFormUrn, setSelectedFormUrn] = useState<string | null>(null);
  const [selectedFormName, setSelectedFormName] = useState<string | null>(null);
  const [includeTestLeads, setIncludeTestLeads] = useState(false);
  const [selectedTimeFrameValue, setSelectedTimeFrameValue] = useState('last_30_days');

  useEffect(() => {
    if (selectedAccount) {
      fetchLeadGenForms(selectedAccount);
    }
  }, [selectedAccount, fetchLeadGenForms]);

  useEffect(() => {
    if (selectedAccount && selectedFormUrn) {
      fetchLeads(selectedAccount, selectedFormUrn);
    } else {
      clearLeads();
    }
  }, [selectedFormUrn, selectedAccount, fetchLeads, clearLeads]);

  const handleFormSelect = (formUrn: string, formName: string) => {
    if (selectedFormUrn === formUrn) {
      setSelectedFormUrn(null);
      setSelectedFormName(null);
    } else {
      setSelectedFormUrn(formUrn);
      setSelectedFormName(formName);
    }
  };

  const handleTimeFrameChange = (value: string) => {
    setSelectedTimeFrameValue(value);
    const opt = timeFrameOptions.find(o => o.value === value);
    if (opt) setTimeFrame(opt);
  };

  const filteredLeads = includeTestLeads
    ? leads
    : leads.filter(l => !l.testLead);

  const handleExportCSV = () => {
    if (filteredLeads.length === 0) return;
    const columns = [
      { key: 'firstName', label: 'First Name' },
      { key: 'lastName', label: 'Last Name' },
      { key: 'company', label: 'Company' },
      { key: 'email', label: 'Email' },
      { key: 'formName', label: 'Form' },
      { key: 'submittedAtFormatted', label: 'Submitted' },
      { key: 'campaignUrn', label: 'Campaign URN' },
    ];
    const exportData = filteredLeads.map(l => ({
      ...l,
      formName: selectedFormName || '',
      submittedAtFormatted: l.submittedAt ? new Date(l.submittedAt).toISOString() : '',
    }));
    exportToCSV(exportData, `leads_${(selectedFormName || 'export').replace(/\s+/g, '_')}`, columns);
    toast({ title: 'Export successful', description: `${filteredLeads.length} leads exported` });
  };

  if (!selectedAccount) {
    return (
      <div className="rounded-xl border border-border/40 bg-card/50 p-16 text-center">
        <ClipboardList className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
        <p className="text-muted-foreground font-medium">Select an account to view forms &amp; leads</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/60 px-3 py-1.5">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <Select value={selectedTimeFrameValue} onValueChange={handleTimeFrameChange}>
              <SelectTrigger className="w-[140px] border-0 bg-transparent h-7 text-xs font-medium p-0 focus:ring-0">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                {timeFrameOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <span className="text-[11px] text-muted-foreground tabular-nums">{dateRange.start} → {dateRange.end}</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => selectedAccount && fetchLeadGenForms(selectedAccount)}
          disabled={formsLoading}
          className="h-8 text-xs gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${formsLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Form Performance section */}
      <div className="rounded-xl border border-border/40 bg-card/30 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/30 bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center h-7 w-7 rounded-md bg-primary/10">
              <ClipboardList className="h-4 w-4 text-primary" />
            </div>
            <h2 className="text-sm font-semibold">Form Performance</h2>
            {selectedFormUrn && selectedFormName && (
              <Badge variant="secondary" className="text-[11px] gap-1 font-medium">
                {selectedFormName}
                <button
                  onClick={() => { setSelectedFormUrn(null); setSelectedFormName(null); }}
                  className="ml-0.5 hover:text-foreground transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">Click a form row to load leads</p>
        </div>

        <div className="p-5">
          {formsError && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-destructive text-sm mb-4">{formsError}</div>
          )}
          <LeadGenFormsTable
            data={formsData}
            isLoading={formsLoading}
            selectedFormUrn={selectedFormUrn ?? undefined}
            onSelectForm={handleFormSelect}
          />
        </div>
      </div>

      {/* Lead Records section */}
      <div className="rounded-xl border border-border/40 bg-card/30 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/30 bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center h-7 w-7 rounded-md bg-primary/10">
              <User className="h-4 w-4 text-primary" />
            </div>
            <h2 className="text-sm font-semibold">Lead Records</h2>
            {selectedFormName && (
              <Badge variant="outline" className="text-[11px] font-medium">{selectedFormName}</Badge>
            )}
            {leads.length > 0 && (
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {filteredLeads.length} of {total}
                {leads.some(l => l.testLead) && !includeTestLeads && (
                  <span className="ml-1 text-muted-foreground/60">({leads.filter(l => l.testLead).length} test hidden)</span>
                )}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={includeTestLeads ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setIncludeTestLeads(v => !v)}
              className="h-7 text-[11px] px-2.5"
            >
              {includeTestLeads ? 'Hide test leads' : 'Show test leads'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={filteredLeads.length === 0}
              className="h-7 text-[11px] px-2.5 gap-1"
            >
              <Download className="h-3 w-3" />
              CSV
            </Button>
          </div>
        </div>

        <div className="p-5">
          {!selectedFormUrn && !leadsLoading && (
            <div className="text-center py-14 text-muted-foreground">
              <ClipboardList className="h-8 w-8 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">Select a form above to see its leads</p>
            </div>
          )}

          {leadsError && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-destructive text-sm mb-4">{leadsError}</div>
          )}

          {leadsLoading && leads.length === 0 && (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-11 w-full rounded-md" />
              ))}
            </div>
          )}

          {selectedFormUrn && !leadsLoading && filteredLeads.length === 0 && !leadsError && (
            <div className="text-center py-14 text-muted-foreground">
              <p className="text-sm">No leads found for this form in the selected date range.</p>
            </div>
          )}

          {filteredLeads.length > 0 && (
            <div className="rounded-lg border border-border/40 overflow-x-auto">
              <Table className="min-w-[800px]">
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Company</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Submitted</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Campaign</TableHead>
                    <TableHead className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Test</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.map((lead, i) => (
                    <TableRow key={lead.leadUrn || i} className={`${lead.testLead ? 'opacity-50' : ''} hover:bg-muted/20`}>
                      <TableCell className="font-medium text-sm">
                        {[lead.firstName, lead.lastName].filter(Boolean).join(' ') || '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{lead.company || '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{lead.email || '—'}</TableCell>
                      <TableCell className="text-sm tabular-nums text-muted-foreground">
                        {lead.submittedAt
                          ? new Date(lead.submittedAt).toLocaleDateString(undefined, {
                              year: 'numeric', month: 'short', day: 'numeric',
                            })
                          : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono max-w-[180px] truncate">
                        {lead.campaignUrn ? lead.campaignUrn.split(':').pop() : '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        {lead.testLead && (
                          <span className="inline-flex items-center rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 ring-1 ring-inset ring-amber-500/20">test</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {hasMore && (
            <div className="mt-4 text-center">
              <Button
                variant="outline"
                size="sm"
                onClick={loadMore}
                disabled={leadsLoading}
                className="h-8 text-xs"
              >
                {leadsLoading && <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                Load more ({leads.length} of {total})
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
