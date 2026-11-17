import { Fragment, useMemo, useState } from 'react';
import { WidgetCard, EmptyState, SegmentedControl } from '@/components/dashboard/widgets';
import { Button } from '@/components/ui/button';
import { exportToCSV } from '@/lib/exportUtils';
import { asIntelError, companyKey, invoke, type Breakdown, type CampaignSeniority, type IntelError, type LookbackWindow, type SeniorityMetrics } from '@/hooks/useCompanyIntelligence';
import type { AccountMovers } from '@/hooks/useAccountMovers';
import { ERROR_HELP, SENIORITIES, levelLabel } from '@/components/dashboard/CompanyIntelligenceTable';
import { activityOf, adTypeOf, type ActivitySource } from '@/lib/campaignActivity';
import { AlertTriangle, ChevronDown, ChevronRight, Download, Loader2, RefreshCw, Trophy } from 'lucide-react';

type SortKey = 'spend' | 'engaged' | 'high' | 'qualified' | 'costEngaged' | 'costHigh' | 'costQualified' | 'warming';
type GroupBy = 'both' | 'objective' | 'activity' | 'adType' | 'none';
type View = 'companies' | 'seniority';
type SenMetric = 'share' | 'impressions' | 'ctr' | 'spend' | 'leads' | 'cpl';

interface Stats {
  spend: number | null; reached: number; engaged: number; high: number; qualified: number;
  costEngaged: number | null; costHigh: number | null; costQualified: number | null; warming: number;
}

interface Row extends Stats {
  id: string; name: string; status: string; objectiveType: string; activity: string; activitySource: ActivitySource; adType: string;
}

interface Group extends Stats { key: string; label: string; rows: Row[] }

type SenTotals = Record<string, Omit<SeniorityMetrics, 'seniority'>>;

const GROUP_BY: { value: GroupBy; label: string }[] = [
  { value: 'both', label: 'Objective + activity' },
  { value: 'objective', label: 'Objective' },
  { value: 'activity', label: 'Activity' },
  { value: 'adType', label: 'Ad type' },
  { value: 'none', label: 'No grouping' },
];

const VIEWS: { value: View; label: string }[] = [
  { value: 'companies', label: 'Companies' },
  { value: 'seniority', label: 'Seniority' },
];

const SEN_METRICS: { value: SenMetric; label: string }[] = [
  { value: 'share', label: '% of impressions' },
  { value: 'impressions', label: 'Impressions' },
  { value: 'ctr', label: 'CTR' },
  { value: 'spend', label: 'Spend' },
  { value: 'leads', label: 'Leads' },
  { value: 'cpl', label: 'Cost / lead' },
];

const SENIORITY_LABELS: Record<string, string> = { '1': 'Unpaid', '2': 'Training', ...SENIORITIES };
const SENIORITY_ORDER = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

const per = (spend: number | null, n: number) => (spend !== null && spend > 0 && n > 0 ? spend / n : null);
const money = (n: number | null) => (n === null ? '—' : n.toLocaleString(undefined, { maximumFractionDigits: n < 100 ? 2 : 0 }));
const fmtObjective = (o: string) => o.toLowerCase().replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

function addSeniority(into: SenTotals, rows: SeniorityMetrics[] | undefined) {
  for (const r of rows || []) {
    const t = (into[r.seniority] ||= { impressions: 0, clicks: 0, spend: 0, leads: 0, conversions: 0 });
    t.impressions += r.impressions; t.clicks += r.clicks; t.spend += r.spend; t.leads += r.leads; t.conversions += r.conversions;
  }
  return into;
}

function senValue(t: SenTotals, id: string, metric: SenMetric): { text: string; heat: number } {
  const m = t[id];
  if (!m) return { text: '—', heat: 0 };
  const total = Object.values(t).reduce((n, x) => n + x.impressions, 0);
  const share = total ? m.impressions / total : 0;
  switch (metric) {
    case 'share': return { text: total ? `${Math.round(share * 100)}%` : '—', heat: share };
    case 'impressions': return { text: m.impressions.toLocaleString(), heat: share };
    case 'ctr': return { text: m.impressions ? `${((m.clicks / m.impressions) * 100).toFixed(2)}%` : '—', heat: 0 };
    case 'spend': return { text: money(m.spend), heat: 0 };
    case 'leads': return { text: m.leads.toLocaleString(), heat: 0 };
    case 'cpl': return { text: money(per(m.spend, m.leads)), heat: 0 };
  }
}

function StatCells({ s, hasSpend, warming }: { s: Stats; hasSpend: boolean; warming: boolean }) {
  return (
    <>
      <td className="px-2 py-1.5 text-right tabular-nums">{hasSpend ? money(s.spend) : '—'}</td>
      <td className="px-2 py-1.5 text-right tabular-nums">{s.engaged.toLocaleString()}</td>
      <td className="px-2 py-1.5 text-right tabular-nums">{s.high.toLocaleString()}</td>
      <td className="px-2 py-1.5 text-right tabular-nums">{s.qualified.toLocaleString()}</td>
      <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{s.reached.toLocaleString()}</td>
      <td className="px-2 py-1.5 text-right tabular-nums font-medium">{hasSpend ? money(s.costEngaged) : '—'}</td>
      <td className="px-2 py-1.5 text-right tabular-nums">{hasSpend ? money(s.costHigh) : '—'}</td>
      <td className="px-2 py-1.5 text-right tabular-nums">{hasSpend ? money(s.costQualified) : '—'}</td>
      {warming && <td className="px-2 py-1.5 text-right tabular-nums">{s.warming.toLocaleString()}</td>}
    </>
  );
}

function SenCells({ t, cols, metric }: { t: SenTotals; cols: string[]; metric: SenMetric }) {
  const impressions = Object.values(t).reduce((n, x) => n + x.impressions, 0);
  return (
    <>
      <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{impressions ? impressions.toLocaleString() : '—'}</td>
      {cols.map((id) => {
        const v = senValue(t, id, metric);
        return (
          <td key={id} className="px-2 py-1.5 text-right tabular-nums" style={v.heat ? { backgroundColor: `hsl(var(--primary) / ${Math.min(0.45, v.heat * 0.9).toFixed(2)})` } : undefined}>
            {v.text}
          </td>
        );
      })}
    </>
  );
}

export function CampaignScorecard({ accessToken, selectedAccount, lookback, ready, breakdown, loading, error, load, movers }: {
  accessToken: string | null;
  selectedAccount: string | null;
  /** The table's lookback — the breakdown has one cache slot, shared with the drill-down. */
  lookback: LookbackWindow;
  ready: boolean;
  /** The shared campaign breakdown (also feeds the per-company drill-down). */
  breakdown: Breakdown | null;
  loading: boolean;
  error: IntelError | null;
  load: (lookback: LookbackWindow) => void;
  movers: AccountMovers | null;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('costEngaged');
  const [groupBy, setGroupBy] = useState<GroupBy>('both');
  const [view, setView] = useState<View>('companies');
  const [senMetric, setSenMetric] = useState<SenMetric>('share');
  const [showCampaigns, setShowCampaigns] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());
  // Kept here, not in the shared breakdown slot, so it can't evict the campaign breakdown.
  const [sen, setSen] = useState<{ key: string; data: CampaignSeniority | null; loading: boolean; error: IntelError | null } | null>(null);
  const current = breakdown?.key === `${selectedAccount}:${lookback}` ? breakdown : null;
  const warmingKeys = useMemo(
    () => (movers && movers.accountId === selectedAccount
      ? new Set(movers.movers.filter((m) => m.momentum === 'warming' || m.momentum === 'new').map((m) => companyKey(m.company)))
      : null),
    [movers, selectedAccount],
  );
  // An older edge deploy has no spend field at all — show the counts, hide the costs.
  const hasSpend = !!current?.campaigns?.length && current.campaigns.every((c) => c.spend !== undefined);
  const hasFormat = !!current?.campaigns?.length && current.campaigns.every((c) => c.format !== undefined);
  const senKey = current ? `${current.key}:${(current.campaigns || []).map((c) => c.id).join(',')}` : '';
  const senData = sen?.key === senKey ? sen : null;

  const loadSeniority = async () => {
    if (!accessToken || !selectedAccount || !current?.campaigns?.length) return;
    const key = senKey;
    setSen({ key, data: null, loading: true, error: null });
    try {
      const data = await invoke<CampaignSeniority>(accessToken, { accountId: selectedAccount, lookbackWindow: lookback, breakdown: 'campaign_seniority', campaignIds: current.campaigns.map((c) => c.id) });
      setSen({ key, data, loading: false, error: null });
    } catch (e) {
      setSen({ key, data: null, loading: false, error: await asIntelError(e) });
    }
  };

  const switchView = (v: View) => {
    setView(v);
    if (v === 'seniority' && !senData?.data && !senData?.loading) loadSeniority();
  };

  const rows = useMemo<Row[]>(() => {
    if (!current?.campaigns) return [];
    const by: Record<string, { reached: number; engaged: number; high: number; qualified: number; warming: number }> = {};
    for (const c of current.campaigns) by[c.id] = { reached: 0, engaged: 0, high: 0, qualified: 0, warming: 0 };
    for (const [key, slices] of Object.entries(current.byCompany)) {
      for (const s of slices) {
        const t = by[s.slice];
        if (!t) continue;
        t.reached++;
        if (s.paidEngagements > 0 || s.paidClicks > 0) t.engaged++;
        if (s.engagementLevel === 'HIGH' || s.engagementLevel === 'VERY_HIGH') t.high++;
        t.qualified += s.paidQualifiedLeads;
        if (warmingKeys?.has(key)) t.warming++;
      }
    }
    return current.campaigns.map((c) => {
      const t = by[c.id];
      const spend = c.spend ?? null;
      const { activity, source } = activityOf(c);
      return {
        id: c.id, name: c.name, status: c.status, objectiveType: c.objectiveType, activity, activitySource: source, adType: adTypeOf(c), spend, ...t,
        costEngaged: per(spend, t.engaged), costHigh: per(spend, t.high), costQualified: per(spend, t.qualified),
      };
    });
  }, [current, warmingKeys]);

  const groups = useMemo<Group[]>(() => {
    if (!current) return [];
    // Costs ascending with n/a last; counts and spend descending.
    const asc = (a: number | null, b: number | null) => (a === null ? 1 : b === null ? -1 : a - b);
    const cmp = (a: Stats, b: Stats) => {
      switch (sortKey) {
        case 'costEngaged': case 'costHigh': case 'costQualified': return asc(a[sortKey], b[sortKey]) || b.reached - a.reached;
        case 'spend': return (b.spend ?? -1) - (a.spend ?? -1);
        default: return b[sortKey] - a[sortKey];
      }
    };
    const keyOf = (r: Row) => (groupBy === 'objective' ? fmtObjective(r.objectiveType)
      : groupBy === 'activity' ? r.activity
        : groupBy === 'adType' ? r.adType
          : groupBy === 'both' ? `${fmtObjective(r.objectiveType)} · ${r.activity}` : 'All campaigns');
    const byKey = new Map<string, Row[]>();
    for (const r of rows) byKey.set(keyOf(r), [...(byKey.get(keyOf(r)) || []), r]);
    // Group totals count each company once, so a company two campaigns reached isn't double-counted.
    const groupOf = new Map(rows.map((r) => [r.id, keyOf(r)]));
    const sets: Record<string, { reached: Set<string>; engaged: Set<string>; high: Set<string>; warming: Set<string>; qualified: number }> = {};
    for (const k of byKey.keys()) sets[k] = { reached: new Set(), engaged: new Set(), high: new Set(), warming: new Set(), qualified: 0 };
    for (const [company, slices] of Object.entries(current.byCompany)) {
      for (const s of slices) {
        const g = groupOf.get(s.slice);
        if (!g) continue;
        const t = sets[g];
        t.reached.add(company);
        if (s.paidEngagements > 0 || s.paidClicks > 0) t.engaged.add(company);
        if (s.engagementLevel === 'HIGH' || s.engagementLevel === 'VERY_HIGH') t.high.add(company);
        if (warmingKeys?.has(company)) t.warming.add(company);
        t.qualified += s.paidQualifiedLeads;
      }
    }
    return [...byKey.entries()].map(([key, rs]) => {
      const t = sets[key];
      const spend = rs.some((r) => r.spend === null) ? null : rs.reduce((n, r) => n + (r.spend ?? 0), 0);
      return {
        key, label: key, rows: [...rs].sort(cmp), spend,
        reached: t.reached.size, engaged: t.engaged.size, high: t.high.size, qualified: t.qualified, warming: t.warming.size,
        costEngaged: per(spend, t.engaged.size), costHigh: per(spend, t.high.size), costQualified: per(spend, t.qualified),
      };
    }).sort((a, b) => (groupBy === 'activity' || groupBy === 'adType' ? cmp(a, b) : a.label.localeCompare(b.label)));
  }, [current, rows, groupBy, sortKey, warmingKeys]);
  const sorted = groups.flatMap((g) => g.rows);

  // Member metrics add up across campaigns, so group seniority is a straight sum.
  const senByCampaign = senData?.data?.bySeniority;
  const senCols = useMemo(
    () => (senByCampaign ? SENIORITY_ORDER.filter((id) => Object.values(senByCampaign).some((rs) => rs.some((r) => r.seniority === id && r.impressions > 0))) : []),
    [senByCampaign],
  );
  const senOf = (ids: string[]) => ids.reduce((t, id) => addSeniority(t, senByCampaign?.[id]), {} as SenTotals);

  const exportCsv = () => exportToCSV(
    view === 'seniority' && senByCampaign
      ? sorted.flatMap((r) => (senByCampaign[r.id] || []).map((s) => ({
        campaign: r.name, campaign_id: r.id, objective: r.objectiveType, activity: r.activity, ad_type: r.adType,
        seniority: SENIORITY_LABELS[s.seniority] || s.seniority, impressions: s.impressions, clicks: s.clicks, spend: s.spend, leads: s.leads, conversions: s.conversions,
      })))
      : sorted.map((r) => ({
        campaign: r.name, campaign_id: r.id, objective: r.objectiveType, activity: r.activity, activity_from: r.activitySource, ad_type: r.adType, status: r.status, spend: r.spend ?? '',
        companies_reached: r.reached, companies_engaged: r.engaged, companies_high_engagement: r.high, qualified_leads: r.qualified,
        cost_per_engaged_company: r.costEngaged ?? '', cost_per_high_engagement_company: r.costHigh ?? '', cost_per_qualified_lead: r.costQualified ?? '',
        ...(warmingKeys ? { warming_or_new_accounts_reached: r.warming } : {}),
      })),
    `campaign-scorecard-${view}-${selectedAccount}-${lookback}`,
  );

  const Th = ({ k, children, title }: { k: SortKey; children: string; title?: string }) => (
    <th className="px-2 py-2 text-right font-medium whitespace-nowrap" title={title}>
      <button onClick={() => setSortKey(k)} className={sortKey === k ? 'text-foreground' : 'hover:text-foreground'}>
        {children}{sortKey === k ? (k.startsWith('cost') ? ' ↑' : ' ↓') : ''}
      </button>
    </th>
  );

  const toggle = (key: string) => setOpen((s) => {
    const n = new Set(s);
    if (n.has(key)) n.delete(key); else n.add(key);
    return n;
  });

  const campaignSubtitle = (r: Row) => [
    (groupBy === 'activity' || groupBy === 'adType' || groupBy === 'none') && fmtObjective(r.objectiveType),
    (groupBy === 'objective' || groupBy === 'adType' || groupBy === 'none') ? `${r.activity}${r.activitySource === 'name' ? ' (by name)' : ''}` : r.activitySource === 'name' && 'activity by name',
    groupBy !== 'adType' && r.adType !== r.activity && r.adType,
    levelLabel(r.status),
  ].filter(Boolean).join(' · ');

  const outside = current?.meta.spendOutside;
  const seniorityView = view === 'seniority';

  const renderRows = (cells: (s: Group | Row) => JSX.Element, groupHint: string) => groups.map((g) => {
    const expanded = groupBy === 'none' || showCampaigns || open.has(g.key);
    return (
      <Fragment key={g.key}>
        {groupBy !== 'none' && (
          <tr className="border-t border-border/60 bg-secondary/30 font-semibold cursor-pointer hover:bg-secondary/50" onClick={() => toggle(g.key)}>
            <td className="px-3 py-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                {expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                <span className="truncate" title={g.label}>{g.label}</span>
              </div>
              <div className="pl-5 text-[11px] font-normal text-muted-foreground">{g.rows.length} campaign{g.rows.length === 1 ? '' : 's'} · {groupHint}</div>
            </td>
            {cells(g)}
          </tr>
        )}
        {expanded && g.rows.map((r) => (
          <tr key={r.id} className="border-t border-border/40">
            <td className={`py-1.5 pr-3 ${groupBy === 'none' ? 'pl-3' : 'pl-8'}`}>
              <div className="font-medium truncate" title={r.name}>{r.name}</div>
              <div className="text-[11px] text-muted-foreground truncate" title={r.activitySource === 'name' ? 'Activity inferred from the campaign name' : undefined}>{campaignSubtitle(r)}</div>
            </td>
            {cells(r)}
          </tr>
        ))}
      </Fragment>
    );
  });

  return (
    <WidgetCard
      title="Campaign scorecard"
      subtitle="What each campaign, objective, activity and ad type pays per engaged company, and which seniorities it reaches"
      toolbar={
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap hidden md:inline" title="Change it in Engaged companies below">{lookback.replace(/^LAST_(\d+)_DAYS$/, '$1d')} · set in Engaged companies</span>
          {current && rows.length > 0 && (!seniorityView || senByCampaign) && (
            <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-3.5 w-3.5" /><span className="ml-1.5">Export</span></Button>
          )}
          <Button size="sm" onClick={() => load(lookback)} disabled={loading || !ready}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            <span className="ml-1.5">{current ? 'Refresh' : 'Build scorecard'}</span>
          </Button>
        </div>
      }
    >
      {!current ? (
        loading
          ? <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" />Querying each campaign (up to 60) plus spend…</div>
          : error
            ? (
              <div className="flex items-start gap-2 text-xs">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                <div><span className="font-medium">{error.message}</span>{ERROR_HELP[error.kind] && <p className="text-muted-foreground mt-0.5">{ERROR_HELP[error.kind]}</p>}</div>
              </div>
            )
            : <EmptyState icon={Trophy} title="Rank campaigns by the accounts they move" description="One Company Intelligence request per campaign (up to 60, active first) plus one spend request. Nothing is changed in LinkedIn." />
      ) : (
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground space-y-1">
            {current.campaigns?.length === 0 && <p>No campaigns ran in this window.</p>}
            {!hasFormat && !!current.campaigns?.length && <p className="flex gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />The deployed edge function doesn't return ad formats yet, so activity comes from campaign names only. Deploy linkedin-api.</p>}
            {!hasSpend && !!current.campaigns?.length && <p className="flex gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />The deployed edge function returns no spend yet, so costs are hidden. Deploy linkedin-api.</p>}
            {current.meta.spendError && <p className="flex gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />Spend couldn't be loaded ({current.meta.spendError}), so costs are missing.</p>}
            {outside && outside.campaigns > 0 && <p className="flex gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />{outside.campaigns} other campaign{outside.campaigns === 1 ? '' : 's'} spent {money(outside.spend)} in this window but {outside.campaigns === 1 ? 'is' : 'are'} outside the {current.meta.campaignsQueried} analysed.</p>}
            {current.meta.failed.length > 0 && <p className="flex gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />{current.meta.failed.length} campaign{current.meta.failed.length === 1 ? '' : 's'} failed and show no companies.</p>}
            {current.meta.truncated && <p className="flex gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />Some campaigns reached more than 2,000 companies; only the first 2,000 are counted.</p>}
          </div>
          {rows.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
              <SegmentedControl size="sm" options={VIEWS} value={view} onChange={switchView} />
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground">Group by</span>
                <SegmentedControl size="sm" options={GROUP_BY} value={groupBy} onChange={(v) => { setGroupBy(v); setOpen(new Set()); }} />
              </div>
              {groupBy !== 'none' && (
                <label className="flex items-center gap-1.5 text-muted-foreground cursor-pointer">
                  <input type="checkbox" checked={showCampaigns} onChange={(e) => setShowCampaigns(e.target.checked)} />
                  Show campaigns
                </label>
              )}
              {seniorityView && <SegmentedControl size="sm" options={SEN_METRICS} value={senMetric} onChange={setSenMetric} />}
            </div>
          )}

          {seniorityView ? (
            !senData ? (
              <Button variant="outline" size="sm" onClick={loadSeniority} disabled={!accessToken}>Load seniority for {current.campaigns?.length} campaigns</Button>
            ) : senData.loading ? (
              <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" />Reading member seniority for {current.campaigns?.length} campaigns…</div>
            ) : senData.error ? (
              <div className="flex items-start gap-2 text-xs">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                <div>
                  <span className="font-medium">{senData.error.message}</span>{ERROR_HELP[senData.error.kind] && <p className="text-muted-foreground mt-0.5">{ERROR_HELP[senData.error.kind]}</p>}
                  <button className="mt-1 text-primary hover:underline" onClick={loadSeniority}>Try again</button>
                </div>
              </div>
            ) : (
              <>
                {senData.data!.meta.failed.length > 0 && (
                  <p className="text-xs text-muted-foreground flex gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />{senData.data!.meta.failed.length} campaign{senData.data!.meta.failed.length === 1 ? '' : 's'} failed and show no seniority.</p>
                )}
                {senCols.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">LinkedIn returned no seniority data for these campaigns (each campaign × seniority needs enough impressions to be reported).</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-border/60">
                    <table className="w-full text-xs table-fixed" style={{ minWidth: 300 + 90 + senCols.length * 84 }}>
                      <colgroup><col /><col className="w-[90px]" />{senCols.map((id) => <col key={id} className="w-[84px]" />)}</colgroup>
                      <thead className="bg-secondary/60 text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Campaign</th>
                          <th className="px-2 py-2 text-right font-medium" title="Impressions LinkedIn reported by seniority">Impr.</th>
                          {senCols.map((id) => <th key={id} className="px-2 py-2 text-right font-medium whitespace-nowrap">{SENIORITY_LABELS[id] || id}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {renderRows((s) => <SenCells t={'rows' in s ? senOf(s.rows.map((r) => r.id)) : senOf([s.id])} cols={senCols} metric={senMetric} />, 'summed')}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <table className="w-full text-xs table-fixed min-w-[980px]">
                <colgroup>
                  <col /><col className="w-[90px]" /><col className="w-[80px]" /><col className="w-[80px]" /><col className="w-[80px]" /><col className="w-[72px]" />
                  <col className="w-[96px]" /><col className="w-[96px]" /><col className="w-[90px]" />{warmingKeys && <col className="w-[90px]" />}
                </colgroup>
                <thead className="bg-secondary/60 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Campaign</th>
                    <Th k="spend">Spend</Th>
                    <Th k="engaged" title="Companies with at least one paid click or engagement">Engaged</Th>
                    <Th k="high" title="Companies LinkedIn rates High or Very high for this campaign">High+</Th>
                    <Th k="qualified">Qual. leads</Th>
                    <th className="px-2 py-2 text-right font-medium whitespace-nowrap" title="All companies reached, including below one engagement">Reached</th>
                    <Th k="costEngaged">Cost / engaged</Th>
                    <Th k="costHigh">Cost / High+</Th>
                    <Th k="costQualified">Cost / QL</Th>
                    {warmingKeys && <Th k="warming" title="Companies from Account momentum (warming up or newly engaged) this campaign reached">Movers</Th>}
                  </tr>
                </thead>
                <tbody>
                  {renderRows((s) => <StatCells s={s} hasSpend={hasSpend} warming={!!warmingKeys} />, 'companies counted once')}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {seniorityView ? (
              <>
                Seniority comes from Ad Analytics (members, not companies): LinkedIn can&apos;t split Company Intelligence by campaign and seniority together. Same number of days ending today.
                LinkedIn leaves out a campaign × seniority slice with too few impressions, so totals here can be lower than the campaign&apos;s own, and % of impressions is a share of what was reported. Groups are straight sums.
              </>
            ) : (
              <>
                Companies and levels come from Company Intelligence per campaign; spend comes from Ad Analytics for the same number of days ending today, in the account&apos;s currency, and can be off by a day at the edges.
                Costs aren&apos;t comparable across objectives (awareness buys reach, lead gen buys leads), so campaigns are grouped, cheapest cost per engaged company first; group rows count each company once.
                {' '}{warmingKeys ? 'Movers = companies in Account momentum (warming up or newly engaged, last 30 days) that this campaign reached in the selected window.' : 'Run Account momentum above to see which campaigns reach the accounts that are warming up.'}
              </>
            )}
            {' '}<em>Activity</em> is what the campaign is for: the LinkedIn ad format first (message ads, CTV when flagged), else the campaign name; thought leadership only comes from the name (&quot;TL&quot;, &quot;thought leader&quot;), because LinkedIn doesn&apos;t expose the post author to this app.
            {' '}<em>Ad type</em> is LinkedIn&apos;s format only; a single image and a document are the same format at campaign level.
          </p>
        </div>
      )}
    </WidgetCard>
  );
}
