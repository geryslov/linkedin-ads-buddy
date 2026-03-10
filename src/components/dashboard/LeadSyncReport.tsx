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
import { RefreshCw, Download, ClipboardList, User } from 'lucide-react';
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

  // Fetch form metrics when account or date range changes
  useEffect(() => {
    if (selectedAccount) {
      fetchLeadGenForms(selectedAccount);
    }
  }, [selectedAccount, fetchLeadGenForms]);

  // Fetch leads when form selection changes (fetchLeads ref updates when dateRange changes)
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
      <div className="glass rounded-xl p-12 text-center">
        <p className="text-muted-foreground">Select an account to view forms &amp; leads</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Date range selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Time Period:</span>
        <Select value={selectedTimeFrameValue} onValueChange={handleTimeFrameChange}>
          <SelectTrigger className="w-[160px] bg-background/50">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            {timeFrameOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{dateRange.start} → {dateRange.end}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => selectedAccount && fetchLeadGenForms(selectedAccount)}
          disabled={formsLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${formsLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Top panel: form metrics */}
      <div className="glass rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <ClipboardList className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Form Performance</h2>
          {selectedFormUrn && (
            <Badge variant="secondary" className="ml-2">
              {selectedFormName} selected
            </Badge>
          )}
          {selectedFormUrn && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs text-muted-foreground"
              onClick={() => { setSelectedFormUrn(null); setSelectedFormName(null); }}
            >
              Clear selection
            </Button>
          )}
        </div>

        {formsError && (
          <div className="text-destructive text-sm mb-4">{formsError}</div>
        )}

        <p className="text-xs text-muted-foreground mb-3">
          Click a form row to load its lead records below.
        </p>

        <LeadGenFormsTable
          data={formsData}
          isLoading={formsLoading}
          selectedFormUrn={selectedFormUrn ?? undefined}
          onSelectForm={handleFormSelect}
        />
      </div>

      {/* Bottom panel: lead records */}
      <div className="glass rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Lead Records</h2>
            {selectedFormName && (
              <Badge variant="outline">{selectedFormName}</Badge>
            )}
            {leads.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {filteredLeads.length} shown
                {total > leads.length ? ` of ${total}` : ` of ${total}`}
                {leads.some(l => l.testLead) && !includeTestLeads && (
                  <> ({leads.filter(l => l.testLead).length} test hidden)</>
                )}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={includeTestLeads ? 'default' : 'outline'}
              size="sm"
              onClick={() => setIncludeTestLeads(v => !v)}
              className="text-xs"
            >
              {includeTestLeads ? 'Hiding test leads' : 'Show test leads'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={filteredLeads.length === 0}
            >
              <Download className="h-4 w-4 mr-1" />
              Export CSV
            </Button>
          </div>
        </div>

        {!selectedFormUrn && !leadsLoading && (
          <div className="text-center py-12 text-muted-foreground">
            <ClipboardList className="h-8 w-8 mx-auto mb-3 opacity-40" />
            <p>Select a form above to see its leads</p>
          </div>
        )}

        {leadsError && (
          <div className="text-destructive text-sm mb-4">{leadsError}</div>
        )}

        {leadsLoading && leads.length === 0 && (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        )}

        {selectedFormUrn && !leadsLoading && filteredLeads.length === 0 && !leadsError && (
          <div className="text-center py-12 text-muted-foreground">
            <p>No leads found for this form in the selected date range.</p>
          </div>
        )}

        {filteredLeads.length > 0 && (
          <div className="rounded-md border overflow-x-auto">
            <Table className="min-w-[800px]">
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead className="text-center">Test?</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.map((lead, i) => (
                  <TableRow key={lead.leadUrn || i} className={lead.testLead ? 'opacity-60' : ''}>
                    <TableCell className="font-medium">
                      {[lead.firstName, lead.lastName].filter(Boolean).join(' ') || '—'}
                    </TableCell>
                    <TableCell>{lead.company || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{lead.email || '—'}</TableCell>
                    <TableCell className="text-sm tabular-nums text-muted-foreground">
                      {lead.submittedAt
                        ? new Date(lead.submittedAt).toLocaleDateString(undefined, {
                            year: 'numeric', month: 'short', day: 'numeric',
                          })
                        : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono max-w-[180px] truncate">
                      {lead.campaignUrn
                        ? lead.campaignUrn.split(':').pop()
                        : '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      {lead.testLead && (
                        <Badge variant="outline" className="text-xs">test</Badge>
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
            >
              {leadsLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Load more ({leads.length} of {total})
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
