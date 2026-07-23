import { useEffect, useState, useCallback } from 'react';
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
import { WidgetCard, EmptyState, StatusPill, SegmentedControl } from './widgets';
import { RefreshCw, Download, ClipboardList, Calendar, X, ChevronDown, ChevronRight, TrendingUp } from 'lucide-react';
import { useLeadGenFormsReport } from '@/hooks/useLeadGenFormsReport';
import { useLeadFormResponses, LeadFormResponse } from '@/hooks/useLeadFormResponses';
import { useLeadJourney, JourneyData } from '@/hooks/useLeadJourney';
import { LeadGenFormsTable } from './LeadGenFormsTable';
import { exportToCSV } from '@/lib/exportUtils';
import { useToast } from '@/hooks/use-toast';

interface LeadSyncReportProps {
  accessToken: string | null;
  selectedAccount: string | null;
}

const OBJECTIVE_LABELS: Record<string, string> = {
  BRAND_AWARENESS: 'Brand Awareness',
  WEBSITE_VISITS: 'Website Visits',
  ENGAGEMENT: 'Engagement',
  VIDEO_VIEWS: 'Video Views',
  LEAD_GENERATION: 'Lead Generation',
  WEBSITE_CONVERSIONS: 'Website Conversions',
  JOB_APPLICANTS: 'Job Applicants',
  TALENT_LEADS: 'Talent Leads',
  EVENT_REGISTRATION: 'Event Registration',
  DOCUMENT_DOWNLOADS: 'Document Downloads',
};

function JourneyPanel({
  journey,
  orgName,
}: {
  journey: JourneyData;
  orgName: string;
}) {
  if (!journey.orgResolved) {
    return (
      <div className="px-6 py-3 text-xs text-muted-foreground italic">
        Could not match &ldquo;{orgName}&rdquo; to a LinkedIn organization.
      </div>
    );
  }

  const { total, campaigns, window: win } = journey;

  return (
    <div className="px-6 py-4 bg-secondary/30 border-t border-border/60">
      {/* Summary row */}
      <div className="flex items-center gap-4 mb-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <TrendingUp className="h-3.5 w-3.5 text-primary" />
          <span className="text-foreground">{journey.orgName}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span><span className="font-semibold text-foreground tabular-nums">{total.impressions.toLocaleString()}</span> impr</span>
          <span><span className="font-semibold text-foreground tabular-nums">{total.clicks.toLocaleString()}</span> clicks</span>
          <span><span className="font-semibold text-foreground tabular-nums">${total.spend.toFixed(2)}</span> spend</span>
          {win && (
            <span className="text-muted-foreground/60">in {win.days}d before submission ({win.start} → {win.end})</span>
          )}
        </div>
      </div>

      {campaigns.length === 0 ? (
        <p className="text-xs text-muted-foreground">No campaign activity found for this company in the window.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border/60 bg-card">
          <Table className="min-w-[560px] text-xs">
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent bg-secondary/40">
                <TableHead className="min-w-[200px] h-8 px-3">Campaign</TableHead>
                <TableHead className="h-8 px-3">Objective</TableHead>
                <TableHead className="h-8 px-3 text-right">Impressions</TableHead>
                <TableHead className="h-8 px-3 text-right">Clicks</TableHead>
                <TableHead className="h-8 px-3 text-right">Spend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((c) => (
                <TableRow key={c.id} className="hover:bg-secondary/30 [&>td]:px-3 [&>td]:py-1.5">
                  <TableCell className="font-medium truncate max-w-[220px]">{c.name}</TableCell>
                  <TableCell>
                    {c.objectiveType ? (
                      <StatusPill tone="info" label={OBJECTIVE_LABELS[c.objectiveType] || c.objectiveType} />
                    ) : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{c.impressions.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.clicks.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums">${c.spend.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function LeadRow({
  lead,
  index,
  accountId,
  fetchJourney,
  getJourney,
  isLoadingJourney,
}: {
  lead: LeadFormResponse;
  index: number;
  accountId: string;
  fetchJourney: (accountId: string, orgName: string, submittedAtMs: number) => void;
  getJourney: (accountId: string, orgName: string) => JourneyData | undefined;
  isLoadingJourney: (accountId: string, orgName: string) => boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const company = lead.company;
  const journey = company ? getJourney(accountId, company) : undefined;
  const loading = company ? isLoadingJourney(accountId, company) : false;

  const handleToggle = useCallback(() => {
    if (!company) return;
    if (!journey && !loading) {
      fetchJourney(accountId, company, lead.submittedAt);
    }
    setExpanded(v => !v);
  }, [company, journey, loading, fetchJourney, accountId, lead.submittedAt]);

  const journeyBadge = () => {
    if (!company) return <span className="text-muted-foreground/40">—</span>;
    if (loading) return <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />;
    if (!journey) return (
      <button
        className="text-[10px] text-primary underline-offset-2 hover:underline"
        onClick={handleToggle}
      >
        Load
      </button>
    );
    if (!journey.orgResolved) return <StatusPill tone="neutral" label="Unresolved" />;
    return (
      <span className="text-[10px] tabular-nums text-muted-foreground">
        {journey.total.impressions.toLocaleString()} impr · {journey.campaigns.length} camp.
      </span>
    );
  };

  return (
    <>
      <TableRow
        className={`${lead.testLead ? 'opacity-50' : ''} hover:bg-secondary/30 ${expanded ? 'bg-secondary/20' : ''} [&>td]:py-2.5`}
      >
        <TableCell className="w-8 p-2">
          {company && (
            <button
              onClick={handleToggle}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded
                ? <ChevronDown className="h-4 w-4" />
                : <ChevronRight className="h-4 w-4" />}
            </button>
          )}
        </TableCell>
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
        <TableCell className="text-xs text-muted-foreground font-mono max-w-[160px] truncate">
          {lead.campaignUrn ? lead.campaignUrn.split(':').pop() : '—'}
        </TableCell>
        <TableCell className="text-center">
          {lead.testLead && <StatusPill tone="warning" label="Test" />}
        </TableCell>
        <TableCell className="text-xs min-w-[100px]">
          {journeyBadge()}
        </TableCell>
      </TableRow>
      {expanded && journey && (
        <tr>
          <td colSpan={8} className="p-0">
            <JourneyPanel journey={journey} orgName={company || ''} />
          </td>
        </tr>
      )}
    </>
  );
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

  const { fetchJourney, getJourney, isLoadingJourney, clearCache } = useLeadJourney(accessToken);

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

  // Auto-fetch journeys for all visible leads once they load
  useEffect(() => {
    if (!selectedAccount || leads.length === 0) return;
    const unique = [...new Set(leads.map(l => l.company).filter(Boolean))] as string[];
    // Stagger requests slightly to avoid hammering the edge function
    unique.forEach((company, i) => {
      const lead = leads.find(l => l.company === company)!;
      setTimeout(() => {
        fetchJourney(selectedAccount, company, lead.submittedAt);
      }, i * 150);
    });
  }, [leads, selectedAccount, fetchJourney]);

  // Clear journey cache when account or date range changes
  useEffect(() => {
    clearCache();
  }, [selectedAccount, dateRange, clearCache]);

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
      <WidgetCard noPadding>
        <EmptyState
          icon={ClipboardList}
          title="No account selected"
          description="Select an account to view forms and leads."
        />
      </WidgetCard>
    );
  }

  return (
    <div className="space-y-5">
      {/* Form Performance */}
      <WidgetCard
        title="Form Performance"
        subtitle={
          selectedFormUrn && selectedFormName
            ? 'Click the selected form again to deselect'
            : 'Click a form row to load leads'
        }
        toolbar={
          <>
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
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <Select value={selectedTimeFrameValue} onValueChange={handleTimeFrameChange}>
                <SelectTrigger className="h-8 w-[140px] text-xs font-medium bg-card border-border">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {timeFrameOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <span className="text-[11px] text-muted-foreground tabular-nums hidden md:inline">
              {dateRange.start} → {dateRange.end}
            </span>
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
          </>
        }
      >
        {formsError && (
          <div className="rounded-lg bg-destructive/[0.06] border border-destructive/20 px-3 py-2 text-destructive text-sm mb-4">{formsError}</div>
        )}
        <LeadGenFormsTable
          data={formsData}
          isLoading={formsLoading}
          selectedFormUrn={selectedFormUrn ?? undefined}
          onSelectForm={handleFormSelect}
        />
      </WidgetCard>

      {/* Lead Records */}
      <WidgetCard
        title={
          <span className="inline-flex items-center gap-2">
            Lead Records
            {selectedFormName && (
              <Badge variant="outline" className="text-[11px] font-medium">{selectedFormName}</Badge>
            )}
          </span>
        }
        subtitle={
          leads.length > 0 ? (
            <>
              {filteredLeads.length} of {total}
              {leads.some(l => l.testLead) && !includeTestLeads && (
                <span className="text-muted-foreground/60"> · {leads.filter(l => l.testLead).length} test hidden</span>
              )}
            </>
          ) : undefined
        }
        toolbar={
          <>
            <SegmentedControl
              size="sm"
              value={includeTestLeads ? 'all' : 'real'}
              onChange={(v) => setIncludeTestLeads(v === 'all')}
              options={[
                { value: 'real', label: 'Hide test' },
                { value: 'all', label: 'All leads' },
              ]}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={filteredLeads.length === 0}
              className="h-8 text-xs gap-1"
            >
              <Download className="h-3 w-3" />
              CSV
            </Button>
          </>
        }
      >
        {!selectedFormUrn && !leadsLoading && (
          <EmptyState
            icon={ClipboardList}
            title="No form selected"
            description="Select a form above to see its leads."
          />
        )}

        {leadsError && (
          <div className="rounded-lg bg-destructive/[0.06] border border-destructive/20 px-3 py-2 text-destructive text-sm mb-4">{leadsError}</div>
        )}

        {leadsLoading && leads.length === 0 && (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-11 w-full rounded-md" />
            ))}
          </div>
        )}

        {selectedFormUrn && !leadsLoading && filteredLeads.length === 0 && !leadsError && (
          <EmptyState
            icon={ClipboardList}
            title="No leads found"
            description="No leads found for this form in the selected date range."
          />
        )}

        {filteredLeads.length > 0 && (
          <div className="rounded-lg border border-border/70 overflow-x-auto bg-card">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent bg-secondary/40">
                  <TableHead className="w-8" />
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead className="text-center">Test</TableHead>
                  <TableHead>Ad Journey</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.map((lead, i) => (
                  <LeadRow
                    key={lead.leadUrn || i}
                    lead={lead}
                    index={i}
                    accountId={selectedAccount}
                    fetchJourney={fetchJourney}
                    getJourney={getJourney}
                    isLoadingJourney={isLoadingJourney}
                  />
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
      </WidgetCard>
    </div>
  );
}
