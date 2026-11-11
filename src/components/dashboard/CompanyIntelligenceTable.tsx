import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  useCompanyIntelligence, CompanyIntelligence, LookbackWindow, Audience, BreakdownRow, BreakdownCampaign, companyKey,
} from '@/hooks/useCompanyIntelligence';
import { WidgetCard, EmptyState, StatusPill, SegmentedControl } from '@/components/dashboard/widgets';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { exportToCSV } from '@/lib/exportUtils';
import { Building2, Loader2, RefreshCw, Download, ExternalLink, Info, AlertTriangle, PlugZap, ChevronRight, ChevronDown } from 'lucide-react';

interface CompanyIntelligenceTableProps {
  accessToken: string | null;
  selectedAccount: string | null;
  campaigns: { id: string; name: string; status?: string }[];
}

const LOOKBACKS: { label: string; value: LookbackWindow }[] = [
  { label: '7d', value: 'LAST_7_DAYS' },
  { label: '30d', value: 'LAST_30_DAYS' },
  { label: '90d', value: 'LAST_90_DAYS' },
  { label: '180d', value: 'LAST_180_DAYS' },
  { label: '365d', value: 'LAST_365_DAYS' },
];

const SENIORITIES: Record<string, string> = {
  '3': 'Entry', '4': 'Senior', '5': 'Manager', '6': 'Director', '7': 'VP', '8': 'CXO', '9': 'Partner', '10': 'Owner',
};

const JOB_FUNCTIONS: Record<string, string> = {
  INFORMATION_TECHNOLOGY: 'IT', PRODUCT: 'Product', SALES: 'Sales', MARKETING: 'Marketing',
  OPERATIONS: 'Operations', FINANCE: 'Finance', HUMAN_RESOURCES: 'HR', OTHER: 'Other',
};

const LEVEL_TONE: Record<string, 'success' | 'info' | 'warning' | 'neutral'> = {
  VERY_HIGH: 'success', HIGH: 'success', MEDIUM: 'info', LOW: 'warning', VERY_LOW: 'neutral',
};
const LEVEL_RANK = ['UNKNOWN', 'VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'];
const levelLabel = (l: string) => l.toLowerCase().replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

const SIZE_LABELS: Record<string, string> = {
  SIZE_1: '1', SIZE_2_TO_10: '2–10', SIZE_11_TO_50: '11–50', SIZE_51_TO_200: '51–200', SIZE_201_TO_500: '201–500',
  SIZE_501_TO_1000: '501–1K', SIZE_1001_TO_5000: '1K–5K', SIZE_5001_TO_10000: '5K–10K', SIZE_10001_OR_MORE: '10K+',
};

type Mix = 'both' | 'paid' | 'organic' | 'none';
const mixOf = (c: CompanyIntelligence): Mix => {
  const paid = c.paidImpressions > 0 || c.paidClicks > 0 || c.paidEngagements > 0;
  const organic = c.organicImpressions > 0 || c.organicEngagements > 0;
  return paid && organic ? 'both' : paid ? 'paid' : organic ? 'organic' : 'none';
};
const MIX_LABEL: Record<Mix, string> = { both: 'Paid + organic', paid: 'Paid only', organic: 'Organic only', none: 'Below threshold' };

type SortKey = 'paidImpressions' | 'paidClicks' | 'paidLeads' | 'paidQualifiedLeads' | 'organicImpressions' | 'organicEngagements' | 'engagementLevel';

const fmt = (n: number) => n.toLocaleString();

const formatObjective = (o: string) => o.toLowerCase().replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

type BreakdownView = 'campaign' | 'audience';

/** Sum a set of slices; the level shown is the highest any slice reached. */
function sumRows(rows: BreakdownRow[]): Omit<BreakdownRow, 'slice'> {
  const t = { engagementLevel: 'UNKNOWN', paidImpressions: 0, paidClicks: 0, paidEngagements: 0, paidLeads: 0, paidQualifiedLeads: 0, conversions: 0, organicImpressions: 0, organicEngagements: 0 };
  for (const r of rows) {
    t.paidImpressions += r.paidImpressions; t.paidClicks += r.paidClicks; t.paidEngagements += r.paidEngagements;
    t.paidLeads += r.paidLeads; t.paidQualifiedLeads += r.paidQualifiedLeads; t.conversions += r.conversions;
    t.organicImpressions += r.organicImpressions; t.organicEngagements += r.organicEngagements;
    if (LEVEL_RANK.indexOf(r.engagementLevel) > LEVEL_RANK.indexOf(t.engagementLevel)) t.engagementLevel = r.engagementLevel;
  }
  return t;
}

const sliceLabel = (slice: string) =>
  slice.startsWith('sen:') ? SENIORITIES[slice.slice(4)] ?? slice : slice.startsWith('fn:') ? JOB_FUNCTIONS[slice.slice(3)] ?? slice : slice;

const ERROR_HELP: Record<string, string> = {
  not_provisioned: 'The LinkedIn developer app needs the Company Intelligence API product added in the LinkedIn developer portal.',
  no_account_role: 'Your LinkedIn user needs Viewer access or higher on this ad account.',
  no_reporting_scope: 'Log out and reconnect LinkedIn so the token carries r_ads_reporting.',
  stale_deploy: 'The new handler is in the repo but not deployed. Deploy linkedin-api (see CLAUDE.md → Deployment matrix).',
  token_invalid: 'Log out and reconnect LinkedIn.',
  rate_limited:'LinkedIn is throttling requests. Wait a minute and try again.',
  bad_request: 'That filter combination is not supported by LinkedIn.',
};

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card px-4 py-3" style={{ boxShadow: 'var(--shadow-sm)' }}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-bold tabular-nums mt-0.5">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

export function CompanyIntelligenceTable({ accessToken, selectedAccount, campaigns }: CompanyIntelligenceTableProps) {
  const {
    companies, meta, isLoading, error, load, check, isChecking, runCheck, reset,
    campaignBreakdown, audienceBreakdown, loadingBreakdown, breakdownError, loadBreakdown,
  } = useCompanyIntelligence(accessToken);

  const [lookback, setLookback] = useState<LookbackWindow>('LAST_90_DAYS');
  const [audience, setAudience] = useState<Audience>('all');
  const [campaignId, setCampaignId] = useState<string>('all');
  const [mix, setMix] = useState<Mix | 'all'>('all');
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('paidImpressions');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [expandedObjectives, setExpandedObjectives] = useState<Set<string>>(new Set());
  const [view, setView] = useState<BreakdownView>('campaign');

  const audienceFiltered = audience !== 'all';
  const campaignScoped = !audienceFiltered && campaignId !== 'all';

  useEffect(() => {
    reset();
    if (selectedAccount) runCheck(selectedAccount);
  }, [selectedAccount, runCheck, reset]);

  // Breakdowns follow the lookback the table was loaded with.
  const breakdownLookback = (meta?.lookbackWindow ?? lookback) as LookbackWindow;
  const campaignKey = `${selectedAccount}:${breakdownLookback}`;
  const activeBreakdown = view === 'campaign'
    ? (campaignBreakdown?.key === campaignKey ? campaignBreakdown : null)
    : (audienceBreakdown?.key === selectedAccount ? audienceBreakdown : null);

  useEffect(() => {
    if (!selectedAccount || !meta || expanded.size === 0 || activeBreakdown || loadingBreakdown || breakdownError) return;
    loadBreakdown(view, selectedAccount, breakdownLookback);
  }, [selectedAccount, meta, expanded.size, activeBreakdown, loadingBreakdown, breakdownError, view, breakdownLookback, loadBreakdown]);

  const campaignsById = useMemo(
    () => new Map<string, BreakdownCampaign>((campaignBreakdown?.campaigns ?? []).map((c) => [c.id, c])),
    [campaignBreakdown],
  );

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, key: string) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key); else next.add(key);
    setter(next);
  };

  const run = () => {
    setExpanded(new Set());
    setExpandedObjectives(new Set());
    if (!selectedAccount) return;
    load(selectedAccount, { lookbackWindow: lookback, audience, campaignId: campaignId === 'all' ? null : campaignId });
  };

  const stats = useMemo(() => {
    const byMix: Record<Mix, number> = { both: 0, paid: 0, organic: 0, none: 0 };
    let hot = 0;
    for (const c of companies) {
      byMix[mixOf(c)]++;
      if (c.engagementLevel === 'HIGH' || c.engagementLevel === 'VERY_HIGH') hot++;
    }
    return { byMix, hot };
  }, [companies]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return companies
      .filter((c) => mix === 'all' || mixOf(c) === mix)
      .filter((c) => !q || c.companyName.toLowerCase().includes(q) || c.companyWebsite.toLowerCase().includes(q))
      .sort((a, b) => sortKey === 'engagementLevel'
        ? LEVEL_RANK.indexOf(b.engagementLevel) - LEVEL_RANK.indexOf(a.engagementLevel) || b.paidImpressions - a.paidImpressions
        : b[sortKey] - a[sortKey]);
  }, [companies, mix, query, sortKey]);

  const exportCsv = () => exportToCSV(
    rows.map((c) => ({ ...c, mix: MIX_LABEL[mixOf(c)], seniorities: (c.seniorities || []).map((s) => SENIORITIES[s] || s).join(' ') })),
    `account-intel-${selectedAccount}-${meta?.lookbackWindow ?? lookback}`,
  );

  const Th = ({ k, children }: { k: SortKey; children: string }) => (
    <th className="px-3 py-2 text-right font-medium">
      <button onClick={() => setSortKey(k)} className={sortKey === k ? 'text-foreground' : 'hover:text-foreground'}>
        {children}{sortKey === k ? ' ↓' : ''}
      </button>
    </th>
  );

  const showSeniorities = audience === 'dm';
  const colCount = 11 + (showSeniorities ? 1 : 0);

  /** A breakdown row aligned to the main table's columns. */
  const SubRow = ({ label, extra, t, depth, onClick, open, organicNa }: {
    label: React.ReactNode; extra?: React.ReactNode; t: Omit<BreakdownRow, 'slice'>; depth: 1 | 2;
    onClick?: () => void; open?: boolean; organicNa?: boolean;
  }) => (
    <tr
      onClick={onClick}
      className={`border-t border-border/40 ${depth === 1 ? 'bg-primary/[0.03]' : 'bg-primary/[0.06]'} ${onClick ? 'cursor-pointer hover:bg-primary/[0.08]' : ''}`}
    >
      <td className={`px-3 py-1.5 ${depth === 1 ? 'pl-9' : 'pl-14'}`}>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {onClick && (open ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />)}
          {label}
        </div>
      </td>
      <td className="px-3 py-1.5"><StatusPill tone={LEVEL_TONE[t.engagementLevel] ?? 'neutral'} label={levelLabel(t.engagementLevel)} /></td>
      {showSeniorities && <td />}
      <td className="px-3 py-1.5 text-muted-foreground">{extra}</td>
      <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{fmt(t.paidImpressions)}</td>
      <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{fmt(t.paidClicks)}</td>
      <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{fmt(t.paidLeads)}</td>
      <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{fmt(t.paidQualifiedLeads)}</td>
      <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{organicNa ? '—' : fmt(t.organicImpressions)}</td>
      <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{organicNa ? '—' : fmt(t.organicEngagements)}</td>
      <td colSpan={2} />
    </tr>
  );

  const renderBreakdown = (c: CompanyIntelligence) => {
    const key = companyKey(c);
    const note = (text: React.ReactNode) => (
      <tr className="bg-primary/[0.03]"><td colSpan={colCount} className="pl-9 px-3 py-2 text-xs text-muted-foreground">{text}</td></tr>
    );
    const header = (
      <tr className="bg-primary/[0.03] border-t border-border/40">
        <td colSpan={colCount} className="pl-9 px-3 py-1.5">
          <div className="flex items-center gap-3 flex-wrap">
            <SegmentedControl
              size="sm"
              options={[{ label: 'By campaign', value: 'campaign' as const }, { label: 'By audience', value: 'audience' as const }]}
              value={view}
              onChange={setView}
            />
            <span className="text-[11px] text-muted-foreground">
              {view === 'campaign'
                ? `${levelLabel(breakdownLookback)}, all members · LinkedIn reports organic as 0 per campaign`
                : 'Last 90 days, all campaigns · qualified leads are 0 per seniority / function (LinkedIn)'}
            </span>
          </div>
        </td>
      </tr>
    );

    if (loadingBreakdown === view && !activeBreakdown) {
      return <>{header}{note(<span className="flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" />{view === 'campaign' ? 'Querying each campaign — one batch fills every company…' : 'Querying 8 seniorities and 8 job functions…'}</span>)}</>;
    }
    if (breakdownError && !activeBreakdown) {
      return <>{header}{note(<span className="text-destructive">{breakdownError.message} <button className="underline ml-1" onClick={() => loadBreakdown(view, selectedAccount!, breakdownLookback)}>Retry</button></span>)}</>;
    }
    if (!activeBreakdown) return header;

    const rows = activeBreakdown.byCompany[key] ?? [];
    const failedNote = activeBreakdown.meta.failed.length > 0 && note(`${activeBreakdown.meta.failed.length} slice(s) failed and are missing.`);
    if (!rows.length) return <>{header}{note(view === 'campaign' ? 'No campaign-level engagement for this company (or below LinkedIn\'s privacy threshold).' : 'No seniority or job-function engagement for this company in the last 90 days.')}{failedNote}</>;

    if (view === 'audience') {
      const group = (prefix: string, title: string) => {
        const g = rows.filter((r) => r.slice.startsWith(prefix)).sort((a, b) => LEVEL_RANK.indexOf(b.engagementLevel) - LEVEL_RANK.indexOf(a.engagementLevel) || b.paidImpressions - a.paidImpressions);
        if (!g.length) return null;
        return (
          <Fragment key={prefix}>
            {note(<span className="font-medium text-foreground/80">{title}</span>)}
            {g.map((r) => <SubRow key={r.slice} depth={2} label={sliceLabel(r.slice)} t={r} />)}
          </Fragment>
        );
      };
      return <>{header}{group('sen:', 'By seniority')}{group('fn:', 'By job function')}{failedNote}</>;
    }

    const byObjective = new Map<string, BreakdownRow[]>();
    for (const r of rows) {
      const obj = campaignsById.get(r.slice)?.objectiveType ?? 'UNCLASSIFIED';
      byObjective.set(obj, [...(byObjective.get(obj) ?? []), r]);
    }
    const objectives = [...byObjective.entries()].map(([obj, rs]) => ({ obj, rs, t: sumRows(rs) })).sort((a, b) => b.t.paidImpressions - a.t.paidImpressions);
    return (
      <>
        {header}
        {objectives.map(({ obj, rs, t }) => {
          const objKey = `${key}::${obj}`;
          const open = expandedObjectives.has(objKey);
          return (
            <Fragment key={objKey}>
              <SubRow
                depth={1} t={t} organicNa open={open}
                onClick={() => toggle(expandedObjectives, setExpandedObjectives, objKey)}
                label={<span>{formatObjective(obj)}</span>}
                extra={`${rs.length} campaign${rs.length === 1 ? '' : 's'}`}
              />
              {open && [...rs].sort((a, b) => b.paidImpressions - a.paidImpressions).map((r) => {
                const camp = campaignsById.get(r.slice);
                return (
                  <SubRow
                    key={r.slice} depth={2} t={r} organicNa
                    label={<span className="break-words">{camp?.name ?? `Campaign ${r.slice}`}</span>}
                    extra={camp ? formatObjective(camp.status) : undefined}
                  />
                );
              })}
            </Fragment>
          );
        })}
        {failedNote}
      </>
    );
  };

  if (!selectedAccount) {
    return <EmptyState icon={Building2} title="Select an ad account" description="Account Intel reports on one ad account at a time." />;
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* 1. Connection check — proves provisioning, role and scope with a one-row call. */}
      <WidgetCard
        title="API connection"
        subtitle="Company Intelligence API (/rest/accountIntelligence)"
        toolbar={
          <Button variant="outline" size="sm" onClick={() => runCheck(selectedAccount)} disabled={isChecking}>
            {isChecking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlugZap className="h-3.5 w-3.5" />}
            <span className="ml-1.5">Run check</span>
          </Button>
        }
      >
        {!check ? (
          <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking…</div>
        ) : check.ok ? (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
            <StatusPill tone="success" label="Connected" />
            <span><span className="text-muted-foreground">Version</span> {check.meta?.version}</span>
            <span><span className="text-muted-foreground">Account</span> {check.meta?.accountId}</span>
            <span><span className="text-muted-foreground">Companies (90d)</span> {check.meta?.total ?? '—'}</span>
            <span><span className="text-muted-foreground">Round trip</span> {check.meta?.durationMs} ms</span>
            <span className="text-muted-foreground">Checked {new Date(check.at).toLocaleTimeString()}</span>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div className="text-xs space-y-1">
              <div className="flex items-center gap-2"><StatusPill tone="danger" label={check.error?.kind ?? 'error'} /> <span className="font-medium">{check.error?.message}</span></div>
              {check.error && ERROR_HELP[check.error.kind] && <p className="text-muted-foreground">{ERROR_HELP[check.error.kind]}</p>}
            </div>
          </div>
        )}
      </WidgetCard>

      {/* 2. Query */}
      <WidgetCard
        title="Engaged companies"
        subtitle="Paid and organic engagement per company, from LinkedIn's Company Intelligence data"
        toolbar={
          <Button size="sm" onClick={run} disabled={isLoading || !check?.ok}>
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            <span className="ml-1.5">{meta ? 'Reload' : 'Load companies'}</span>
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl
            size="sm"
            options={LOOKBACKS.map((l) => ({ ...l, label: audienceFiltered && l.value !== 'LAST_90_DAYS' ? <span className="opacity-40">{l.label}</span> : l.label }))}
            value={audienceFiltered ? 'LAST_90_DAYS' : lookback}
            onChange={(v) => !audienceFiltered && setLookback(v)}
          />
          <Select value={audience} onValueChange={setAudience}>
            <SelectTrigger className="h-8 w-[220px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All members</SelectItem>
              <SelectItem value="dm">Decision makers (Director+)</SelectItem>
              <SelectGroup>
                <SelectLabel>Seniority</SelectLabel>
                {Object.entries(SENIORITIES).map(([id, label]) => <SelectItem key={id} value={`sen:${id}`}>{label}</SelectItem>)}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>Job function</SelectLabel>
                {Object.entries(JOB_FUNCTIONS).map(([id, label]) => <SelectItem key={id} value={`fn:${id}`}>{label}</SelectItem>)}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select value={audienceFiltered ? 'all' : campaignId} onValueChange={setCampaignId} disabled={audienceFiltered}>
            <SelectTrigger className="h-8 w-[240px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All campaigns + organic</SelectItem>
              {campaigns.filter((c) => c.id).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {(audienceFiltered || campaignScoped) && (
          <p className="mt-3 text-xs text-muted-foreground flex items-start gap-1.5">
            <Info className="h-3.5 w-3.5 mt-px shrink-0" />
            {audienceFiltered
              ? 'Seniority and job-function filters are LinkedIn-limited to the last 90 days across all campaigns, and report qualified leads as 0.'
              : 'LinkedIn reports organic metrics as 0 when a campaign is selected.'}
          </p>
        )}
        {audience === 'dm' && (
          <p className="mt-1 text-xs text-muted-foreground">Runs one request per seniority (Director, VP, CXO, Partner, Owner) and merges them; a company's level is the highest it reached.</p>
        )}
      </WidgetCard>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/[0.05] px-4 py-3 text-xs">
          <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <div><div className="font-medium">{error.message}</div>{ERROR_HELP[error.kind] && <div className="text-muted-foreground mt-0.5">{ERROR_HELP[error.kind]}</div>}</div>
        </div>
      )}

      {meta && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Companies engaged" value={fmt(companies.length)} hint={meta.truncated ? `of ${fmt(meta.total ?? 0)} — capped` : `${meta.pages} page${meta.pages === 1 ? '' : 's'} · ${meta.durationMs} ms`} />
            <Kpi label="High / very high" value={fmt(stats.hot)} hint="LinkedIn engagement level" />
            <Kpi label="Paid + organic" value={fmt(stats.byMix.both)} hint="Seeing ads and engaging with your page" />
            <Kpi label="Organic only" value={fmt(stats.byMix.organic)} hint={campaignScoped ? 'n/a with a campaign filter' : 'Engaging, but not reached by ads'} />
          </div>

          <WidgetCard
            noPadding
            title={`${fmt(rows.length)} companies`}
            subtitle={`${levelLabel(meta.lookbackWindow)} · filter ${meta.filterCriteria.length > 1 ? `${meta.filterCriteria.length} merged requests` : meta.filterCriteria[0]}`}
            toolbar={
              <>
                <SegmentedControl
                  size="sm"
                  options={[
                    { label: 'All', value: 'all' as const },
                    { label: 'Paid + organic', value: 'both' as const },
                    { label: 'Organic only', value: 'organic' as const },
                    { label: 'Paid only', value: 'paid' as const },
                  ]}
                  value={mix}
                  onChange={setMix}
                />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search company" className="h-8 w-[160px] text-xs" />
                <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows.length}><Download className="h-3.5 w-3.5" /></Button>
              </>
            }
          >
            {rows.length === 0 ? (
              <EmptyState icon={Building2} title="No companies" description="Nothing matches this filter. Small numbers are reported as 0 by LinkedIn for privacy." />
            ) : (
              <div className="overflow-x-auto max-h-[640px]">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted/60 backdrop-blur text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Company</th>
                      <th className="px-3 py-2 text-left font-medium">
                        <button onClick={() => setSortKey('engagementLevel')} className={sortKey === 'engagementLevel' ? 'text-foreground' : 'hover:text-foreground'}>
                          Engagement{sortKey === 'engagementLevel' ? ' ↓' : ''}
                        </button>
                      </th>
                      {showSeniorities && <th className="px-3 py-2 text-left font-medium">Seniorities</th>}
                      <th className="px-3 py-2 text-left font-medium">Mix</th>
                      <Th k="paidImpressions">Paid impr.</Th>
                      <Th k="paidClicks">Clicks</Th>
                      <Th k="paidLeads">Leads</Th>
                      <Th k="paidQualifiedLeads">Qual. leads</Th>
                      <Th k="organicImpressions">Organic impr.</Th>
                      <Th k="organicEngagements">Organic eng.</Th>
                      <th className="px-3 py-2 text-left font-medium">Size</th>
                      <th className="px-3 py-2 text-left font-medium">HQ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((c) => {
                      const m = mixOf(c);
                      const key = companyKey(c);
                      const open = expanded.has(key);
                      return (
                        <Fragment key={key}>
                        <tr onClick={() => toggle(expanded, setExpanded, key)} className={`border-t border-border/50 cursor-pointer ${open ? 'bg-primary/[0.05]' : 'hover:bg-muted/30'}`}>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5 font-medium">
                              {open ? <ChevronDown className="h-3.5 w-3.5 text-primary/70 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                              {c.companyName}
                              {c.companyPageUrl && (
                                <a href={c.companyPageUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-muted-foreground hover:text-primary"><ExternalLink className="h-3 w-3" /></a>
                              )}
                            </div>
                            {c.companyWebsite && <div className="text-[11px] text-muted-foreground pl-5">{c.companyWebsite.replace(/^https?:\/\/(www\.)?/, '')}</div>}
                          </td>
                          <td className="px-3 py-2"><StatusPill tone={LEVEL_TONE[c.engagementLevel] ?? 'neutral'} label={levelLabel(c.engagementLevel)} /></td>
                          {showSeniorities && (
                            <td className="px-3 py-2 text-muted-foreground">{(c.seniorities || []).map((s) => SENIORITIES[s] || s).join(', ')}</td>
                          )}
                          <td className={`px-3 py-2 ${m === 'organic' ? 'text-primary font-medium' : 'text-muted-foreground'}`}>{MIX_LABEL[m]}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmt(c.paidImpressions)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmt(c.paidClicks)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmt(c.paidLeads)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmt(c.paidQualifiedLeads)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmt(c.organicImpressions)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmt(c.organicEngagements)}</td>
                          <td className="px-3 py-2 text-muted-foreground">{SIZE_LABELS[c.companySize] ?? '—'}</td>
                          <td className="px-3 py-2 text-muted-foreground">{c.countryCode || '—'}</td>
                        </tr>
                        {open && renderBreakdown(c)}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </WidgetCard>
        </>
      )}
    </div>
  );
}
