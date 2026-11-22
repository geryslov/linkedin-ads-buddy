import { Fragment, useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { WidgetCard, EmptyState, SegmentedControl, StatusPill } from '@/components/dashboard/widgets';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { exportToCSV } from '@/lib/exportUtils';
import { buildReport, classifyCampaign, rulesFor, type OverlapReport, type TypeStats } from '@/lib/activityOverlap';
import { useActivityOverlap } from '@/hooks/useActivityOverlap';
import { AlertTriangle, ChevronDown, ChevronRight, Download, Grid3x3, Loader2, RefreshCw, Search } from 'lucide-react';

interface Props {
  accessToken: string | null;
  selectedAccount: string | null;
  accountName?: string;
}

const DAYS = [{ label: '30d', value: 30 }, { label: '60d', value: 60 }, { label: '90d', value: 90 }, { label: '180d', value: 180 }];
// LinkedIn reports no company × campaign row under 3 impressions, so a 3+ option would equal Any.
const MIN_TOUCHES = [{ label: 'Any', value: 1 }, { label: '5+', value: 5 }, { label: '10+', value: 10 }];

const iso = (d: Date) => d.toISOString().split('T')[0];
const num = (n: number) => Math.round(n).toLocaleString();
const pct = (v: number) => `${Math.round(v * 100)}%`;
// Eight validated chart slots; types past the eighth share a neutral.
const colorOf = (i: number) => (i >= 0 && i < 8 ? `hsl(var(--chart-${i + 1}))` : 'hsl(var(--muted-foreground) / 0.55)');
const orgId = (urn: string) => urn.split(':').pop() || urn;
// Columns hidden below md / lg are dropped from the template at the same breakpoints.
const TYPE_COLS = 'grid-cols-[minmax(0,1fr)_84px_104px] md:grid-cols-[minmax(0,1fr)_84px_88px_72px_104px] lg:grid-cols-[minmax(0,1fr)_64px_84px_88px_64px_64px_72px_104px]';
const keyActivate = (fn: () => void) => (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } };

const overridesKey = (acct: string) => `activityOverlap.overrides.${acct}`;
function readOverrides(acct: string | null): Record<string, string> {
  if (!acct) return {};
  try { return JSON.parse(localStorage.getItem(overridesKey(acct)) || '{}'); } catch { return {}; }
}

export function ActivityOverlap({ accessToken, selectedAccount, accountName }: Props) {
  const [days, setDays] = useState(90);
  const range = useMemo(() => ({ start: iso(new Date(Date.now() - days * 86400000)), end: iso(new Date()) }), [days]);
  const { data, names, loading, progress, namesLoading, namesError, error, load } = useActivityOverlap(accessToken, selectedAccount, range);
  const [minTouches, setMinTouches] = useState(1);
  const [overrides, setOverrides] = useState<Record<string, string>>(() => readOverrides(selectedAccount));
  const [openType, setOpenType] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [showReview, setShowReview] = useState(false);

  useEffect(() => { setOverrides(readOverrides(selectedAccount)); setOpenType(null); }, [selectedAccount]);
  useEffect(() => {
    if (!selectedAccount) return;
    try { localStorage.setItem(overridesKey(selectedAccount), JSON.stringify(overrides)); } catch { /* per-viewer convenience only */ }
  }, [overrides, selectedAccount]);

  const rules = useMemo(() => rulesFor(selectedAccount || ''), [selectedAccount]);
  const classOf = useMemo(() => (c: { id: string; name: string; status: string; format?: string; type?: string }) => classifyCampaign(c, rules, overrides[c.id]), [rules, overrides]);
  const report: OverlapReport | null = useMemo(
    () => (data ? buildReport(data.campaigns, data.breakdowns, classOf, minTouches) : null),
    [data, classOf, minTouches],
  );

  const nameOf = (urn: string) => names[urn]?.name || `Unresolved (${orgId(urn)})`;
  const typeByName = useMemo(() => new Map((report?.types || []).map((t) => [t.type, t])), [report]);
  const unresolved = useMemo(() => (report && !namesLoading ? report.companies.filter((c) => !names[c.urn]).length : 0), [report, names, namesLoading]);
  const rawTouches = useMemo(
    () => (data ? Object.values(data.breakdowns).reduce((s, rows) => s + rows.reduce((t, r) => t + r.impressions, 0), 0) : 0),
    [data],
  );
  const coverage = data?.accountImpressions ? rawTouches / data.accountImpressions : null;

  const matches = useMemo(() => {
    if (!report) return [];
    const q = query.trim().toLowerCase();
    const list = q ? report.companies.filter((c) => nameOf(c.urn).toLowerCase().includes(q) || orgId(c.urn).includes(q)) : report.companies;
    return list.slice(0, 25);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report, query, names]);

  const reviewRows = useMemo(() => {
    if (!data) return [];
    const delivering = new Set(Object.values(data.breakdowns).flatMap((rows) => rows.map((r) => r.campaignId)));
    return data.campaigns
      .map((c) => ({ c, k: classOf(c), delivering: delivering.has(c.id) }))
      .sort((a, b) => Number(b.delivering) - Number(a.delivering) || a.k.type.localeCompare(b.k.type) || a.c.name.localeCompare(b.c.name));
  }, [data, classOf]);
  const typeOptions = useMemo(
    () => [...new Set([...rules.map((r) => r.type), ...reviewRows.map((r) => r.k.type)])].filter(Boolean).sort(),
    [rules, reviewRows],
  );

  const exports = report && data && {
    companyType: () => exportToCSV(report.companies.map((c) => ({
      company: nameOf(c.urn), organization_urn: c.urn, total_touches: c.touches, activity_types: c.types, campaigns: c.campaigns,
      ...Object.fromEntries(report.types.map((t) => [t.type, c.byType[t.type] || 0])),
    })), `activity-overlap-companies-${range.start}-${range.end}`),
    companyCampaign: () => {
      const camp = new Map(data.campaigns.map((c) => [c.id, c]));
      exportToCSV(Object.entries(data.breakdowns).flatMap(([urn, rows]) => rows.map((r) => ({
        company: nameOf(urn), organization_urn: urn, campaign: camp.get(r.campaignId)?.name || r.campaignId, campaign_id: r.campaignId,
        activity_type: camp.has(r.campaignId) ? classOf(camp.get(r.campaignId)!).type : '', touches: r.impressions, clicks: r.clicks,
      }))), `activity-overlap-company-campaign-${range.start}-${range.end}`);
    },
    matrix: () => exportToCSV(report.types.map((a, i) => ({
      saw: a.type, companies: a.reach,
      ...Object.fromEntries(report.types.map((b, j) => [`also saw ${b.type}`, i === j ? '' : report.matrix[i][j].toFixed(3)])),
    })), `activity-overlap-matrix-${range.start}-${range.end}`),
  };

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <SegmentedControl size="sm" options={DAYS} value={days} onChange={setDays} />
      <Button size="sm" onClick={() => load(!!data)} disabled={loading || !accessToken || !selectedAccount}>
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        <span className="ml-1.5">{data ? 'Refresh' : 'Build report'}</span>
      </Button>
    </div>
  );

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">Pipelight × {accountName || selectedAccount || 'account'} · LinkedIn Ads · {range.start} → {range.end}</div>
        {report && <h2 className="font-display text-xl md:text-2xl font-bold leading-tight mt-1">{report.headline.text}</h2>}
      </div>
      {toolbar}
    </div>
  );

  if (!report) {
    return (
      <div className="space-y-4">
        {header}
        <WidgetCard>
          {loading ? (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {progress ? `Reading companies per campaign: batch ${progress.done} of ${progress.total} (25 campaigns each)…` : 'Loading campaigns…'}
            </div>
          ) : error ? (
            <div className="flex items-start gap-2 text-xs"><AlertTriangle className="h-4 w-4 text-destructive shrink-0" /><span className="font-medium">{error}</span></div>
          ) : (
            <EmptyState icon={Grid3x3} title="Which companies saw which activities" description="Classifies every non-draft campaign into an activity type, then reads companies per campaign for the period. Large accounts take a minute. Nothing is changed in LinkedIn." />
          )}
        </WidgetCard>
      </div>
    );
  }

  if (!report.totals.companies) {
    return (
      <div className="space-y-4">
        {header}
        <WidgetCard>
          <EmptyState icon={Grid3x3} title="No identifiable companies in this period" description={`${data!.campaigns.length} non-draft campaign${data!.campaigns.length === 1 ? '' : 's'} checked${data!.failedBatches ? `, ${data!.failedBatches} batch${data!.failedBatches === 1 ? '' : 'es'} failed` : ''}. Try a longer period.`} />
        </WidgetCard>
      </div>
    );
  }

  const { types, matrix, totals, depth } = report;
  const maxReach = Math.max(1, ...types.map((t) => t.reach));
  const maxDepth = Math.max(1, ...depth);
  const top15 = report.companies.slice(0, 15);

  return (
    <div className="space-y-4">
      {header}

      {(data!.failedBatches > 0 || loading) && (
        <div className="text-xs text-muted-foreground space-y-1">
          {loading && <p className="flex gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />Refreshing{progress ? `: batch ${progress.done} of ${progress.total}` : ''}…</p>}
          {data!.failedBatches > 0 && <p className="flex gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />{data!.failedBatches} batch{data!.failedBatches === 1 ? '' : 'es'} of 25 campaigns failed; those campaigns show no companies. Refresh to retry.</p>}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Companies reached', value: num(totals.companies) },
          { label: 'Touches', value: num(totals.touches), hint: 'One impression to a member of the company (one delivery for InMail)' },
          { label: 'Campaigns delivering', value: num(totals.campaignsDelivering) },
          { label: 'Saw 1 activity', value: pct(totals.singlePct), primary: true },
          { label: 'Saw 3+ activities', value: pct(totals.threePlusPct) },
        ].map((k) => (
          <div key={k.label} title={k.hint} className={`rounded-xl border p-3 ${k.primary ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border'}`}>
            <div className={`text-[11px] ${k.primary ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>{k.label}</div>
            <div className="font-display text-2xl font-bold tabular-nums mt-0.5">{k.value}</div>
          </div>
        ))}
      </div>

      {/* Landscape */}
      <WidgetCard
        title="Activity landscape"
        subtitle="Companies reached per activity: also saw others vs only this"
        toolbar={<div className="flex items-center gap-2 text-xs"><span className="text-muted-foreground hidden sm:inline" title="A company counts in an activity once it has at least this many touches there. LinkedIn reports nothing under 3 per company and campaign.">Min touches</span><SegmentedControl size="sm" options={MIN_TOUCHES} value={minTouches} onChange={setMinTouches} /></div>}
      >
        <div className="space-y-2">
          {types.map((t) => (
            <div key={t.type} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] sm:grid-cols-[minmax(0,13rem)_1fr_auto] items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5 min-w-0"><span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: colorOf(t.colorIndex) }} /><span className="truncate" title={t.type}>{t.type}</span></div>
              <div className="h-4 flex rounded-sm overflow-hidden bg-muted/40" style={{ width: `${(t.reach / maxReach) * 100}%`, minWidth: 4 }}>
                <div className="bg-foreground/80" style={{ width: `${(1 - t.onlyPct) * 100}%` }} title={`${num(t.reach - t.only)} also saw other activities`} />
                <div className="bg-primary" style={{ width: `${t.onlyPct * 100}%` }} title={`${num(t.only)} saw only this`} />
              </div>
              <div className="tabular-nums text-right whitespace-nowrap"><span className="font-medium">{num(t.reach)}</span> <span className={t.onlyPct >= 0.5 ? 'text-primary font-medium' : 'text-muted-foreground'}>{pct(t.onlyPct)} only</span></div>
            </div>
          ))}
          <div className="flex gap-4 text-[11px] text-muted-foreground pt-1">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-foreground/80" />Also saw others</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary" />Only this</span>
          </div>
        </div>
      </WidgetCard>

      {/* By type */}
      <WidgetCard title="By activity type" subtitle="Click a row for its top companies and campaigns" noPadding>
        {/* A grid, not a table: the drill-down spans the row without a colSpan that
            would invent phantom columns when narrow screens hide some. */}
        <div className="text-xs" role="table">
          <div role="row" className={`grid ${TYPE_COLS} bg-secondary/60 text-muted-foreground font-medium`}>
            <div role="columnheader" className="px-3 py-2">Activity</div>
            <div role="columnheader" className="px-2 py-2 text-right hidden lg:block">Camp.</div>
            <div role="columnheader" className="px-2 py-2 text-right">Companies</div>
            <div role="columnheader" className="px-2 py-2 text-right hidden md:block" title="Impressions to members of these companies (deliveries for InMail)">Touches</div>
            <div role="columnheader" className="px-2 py-2 text-right hidden lg:block" title="Average touches per company">Avg</div>
            <div role="columnheader" className="px-2 py-2 text-right hidden lg:block" title="Companies with 10 or more touches">10+</div>
            <div role="columnheader" className="px-2 py-2 text-right hidden md:block" title="Company-level clicks undercount: LinkedIn hides small values">Clicks*</div>
            <div role="columnheader" className="px-3 py-2 text-right" title="Companies whose only activity is this one">Only this</div>
          </div>
          {types.map((t) => {
            const open = openType === t.type;
            const toggle = () => setOpenType(open ? null : t.type);
            return (
              <Fragment key={t.type}>
                <div role="row" tabIndex={0} aria-expanded={open} onClick={toggle} onKeyDown={keyActivate(toggle)} className={`grid ${TYPE_COLS} border-t border-border/40 cursor-pointer hover:bg-secondary/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring tabular-nums`}>
                  <div role="cell" className="px-3 py-2 flex items-center gap-1.5 min-w-0">
                    {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                    <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: colorOf(t.colorIndex) }} />
                    <span className="font-medium truncate" title={t.type}>{t.type}</span>
                  </div>
                  <div role="cell" className="px-2 py-2 text-right hidden lg:block">{t.campaigns}</div>
                  <div role="cell" className="px-2 py-2 text-right">{num(t.reach)}</div>
                  <div role="cell" className="px-2 py-2 text-right hidden md:block">{num(t.touches)}</div>
                  <div role="cell" className="px-2 py-2 text-right hidden lg:block">{t.avgTouches.toFixed(1)}</div>
                  <div role="cell" className="px-2 py-2 text-right hidden lg:block">{num(t.heavy)}</div>
                  <div role="cell" className="px-2 py-2 text-right hidden md:block">{num(t.clicks)}</div>
                  <div role="cell" className="px-3 py-2 text-right whitespace-nowrap">{num(t.only)} <span className={t.onlyPct >= 0.5 ? 'text-primary font-semibold' : 'text-muted-foreground'}>{pct(t.onlyPct)}</span></div>
                </div>
                {open && <div className="bg-secondary/20 px-3 py-3 border-t border-border/40"><TypeDrill t={t} nameOf={nameOf} /></div>}
              </Fragment>
            );
          })}
        </div>
      </WidgetCard>

      {/* Matrix */}
      <WidgetCard title="Overlap matrix" subtitle="Of the companies that saw the row's activity, the share that also saw the column's">
        {types.length < 2 ? (
          <p className="text-sm text-muted-foreground">Only one activity type delivered in this period, so there is nothing to overlap.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-xs border-separate border-spacing-0.5">
              <thead>
                <tr>
                  <th className="text-left font-medium text-muted-foreground px-2 py-1">Saw ↓ · also saw →</th>
                  {types.map((t) => <th key={t.type} className="min-w-[72px] font-medium text-muted-foreground px-1 py-1 text-center whitespace-nowrap" title={t.type}>{t.short}</th>)}
                </tr>
              </thead>
              <tbody>
                {types.map((a, i) => (
                  <tr key={a.type}>
                    <th className="text-left font-medium px-2 py-1 whitespace-nowrap" title={`${a.type} · ${num(a.reach)} companies`}>
                      <span className="inline-block h-2 w-2 rounded-sm mr-1.5" style={{ background: colorOf(a.colorIndex) }} />{a.short} <span className="text-muted-foreground font-normal tabular-nums">{num(a.reach)}</span>
                    </th>
                    {types.map((b, j) => {
                      const v = matrix[i][j];
                      return i === j ? (
                        <td key={b.type} className="text-center text-muted-foreground rounded-md bg-muted/40 py-2">·</td>
                      ) : (
                        <td key={b.type} className={`text-center tabular-nums rounded-md py-2 ${v > 0.5 ? 'text-white font-semibold' : ''}`}
                          style={{ background: `hsl(var(--primary) / ${(0.9 * v).toFixed(3)})` }}
                          title={`${pct(v)} of ${num(a.reach)} ${a.type} companies also saw ${b.type}`}>
                          {pct(v)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </WidgetCard>

      {/* Depth + top companies */}
      <div className="grid gap-4 lg:grid-cols-2">
        <WidgetCard title="Activities per company" subtitle="How many activity types each company saw">
          <div className="space-y-1.5">
            {depth.map((n, i) => (
              <div key={i} className="grid grid-cols-[2rem_1fr_5rem] items-center gap-2 text-xs">
                <span className="tabular-nums text-right text-muted-foreground">{i + 1}</span>
                <div className="h-4 rounded-sm bg-muted/40"><div className={`h-full rounded-sm ${i === 0 ? 'bg-primary' : 'bg-foreground/70'}`} style={{ width: `${(n / maxDepth) * 100}%`, minWidth: n ? 3 : 0 }} /></div>
                <span className="tabular-nums text-right">{num(n)} <span className="text-muted-foreground">{pct(totals.companies ? n / totals.companies : 0)}</span></span>
              </div>
            ))}
          </div>
        </WidgetCard>
        <WidgetCard title="Top 15 companies" subtitle="By touches, with their activity mix">
          <div className="space-y-1.5">
            {top15.map((c) => (
              <div key={c.urn} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_3.5rem] items-center gap-2 text-xs">
                <span className="truncate" title={nameOf(c.urn)}>{nameOf(c.urn)}</span>
                <MixBar c={c} types={types} />
                <span className="tabular-nums text-right">{num(c.touches)}</span>
              </div>
            ))}
          </div>
        </WidgetCard>
      </div>

      {/* Lookup */}
      <WidgetCard
        title="Company lookup"
        subtitle={query ? `${matches.length === 25 ? 'First 25' : matches.length} match${matches.length === 1 ? '' : 'es'}` : 'Top 25 by touches'}
        toolbar={namesLoading ? <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" />Loading names…</span> : undefined}
      >
        <div className="relative mb-3">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${num(totals.companies)} companies`} className="pl-8 h-8 text-sm" />
        </div>
        {matches.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No company matches “{query}”.</p>
        ) : (
          <div className="divide-y divide-border/40">
            {matches.map((c) => (
              <div key={c.urn} className="py-2 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 text-xs">
                <div className="sm:w-56 min-w-0 shrink-0">
                  <div className="font-medium truncate" title={nameOf(c.urn)}>{nameOf(c.urn)}</div>
                  <div className="text-muted-foreground tabular-nums">{num(c.touches)} touches · {c.campaigns} campaign{c.campaigns === 1 ? '' : 's'}</div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(c.byType).sort((a, b) => b[1] - a[1]).map(([type, n]) => {
                    const t = typeByName.get(type);
                    return (
                      <span key={type} className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5" title={type}>
                        <span className="h-2 w-2 rounded-sm" style={{ background: colorOf(t?.colorIndex ?? -1) }} />{t?.short || type} <span className="tabular-nums text-muted-foreground">{num(n)}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </WidgetCard>

      {/* Classification review */}
      <WidgetCard
        title="Classification review"
        subtitle="Activity types come from campaign names and formats. Override any that are wrong; overrides are saved in this browser for this account."
        toolbar={<Button variant="outline" size="sm" onClick={() => setShowReview((v) => !v)}>{showReview ? 'Hide' : `Review ${reviewRows.length} campaigns`}</Button>}
      >
        {showReview && (
          <div className="space-y-2">
            {Object.keys(overrides).length > 0 && (
              <button className="text-xs text-primary hover:underline" onClick={() => setOverrides({})}>Clear {Object.keys(overrides).length} override{Object.keys(overrides).length === 1 ? '' : 's'}</button>
            )}
            <div className="divide-y divide-border/40">
              {reviewRows.map(({ c, k, delivering }) => (
                <div key={c.id} className="py-1.5 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_14rem] gap-1.5 sm:gap-3 items-center text-xs">
                  <div className="min-w-0">
                    <div className={`truncate ${delivering ? 'font-medium' : 'text-muted-foreground'}`} title={c.name}>{c.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {[c.status, c.format, c.objectiveType].filter(Boolean).join(' · ')}{!delivering && ' · no companies in period'} · {k.source === 'override' ? 'overridden' : k.source === 'rule' ? 'by rule' : 'by format/name'}
                    </div>
                  </div>
                  <Select value={k.type} onValueChange={(v) => setOverrides((o) => ({ ...o, [c.id]: v }))}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{typeOptions.map((t) => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        )}
      </WidgetCard>

      {/* Footnote + exports */}
      <div className="flex flex-wrap items-start justify-between gap-3 text-[11px] text-muted-foreground">
        <div className="space-y-1 max-w-3xl">
          <p>
            Source: LinkedIn Ad Analytics (company × campaign) · account {selectedAccount} · {range.start} → {range.end}. A touch is one impression to a member of the company (one delivery for InMail).
            {minTouches > 1 && ` A company counts in an activity once it has ${minTouches}+ touches there.`}
          </p>
          <p>Only companies LinkedIn can identify are included. *Company-level clicks undercount, because LinkedIn hides small values. Activity types are inferred from campaign names and formats.</p>
          {coverage !== null && (
            <p className="flex flex-wrap items-center gap-1.5">
              <StatusPill tone={coverage > 1 || coverage < 0.5 ? 'warning' : 'success'} label={`Coverage ${pct(coverage)}`} />
              Company touches are {pct(coverage)} of the account's {num(data!.accountImpressions!)} impressions for these dates.
              {coverage > 1 && ' Above 100% means company rows were double-counted; refresh, and report it if it persists.'}
              {coverage < 0.5 && ' Under half: LinkedIn could not attribute most impressions to a company (typical of CTV and broad targeting, and rows under 3 impressions are withheld), so the figures describe the identifiable part only.'}
            </p>
          )}
          {!namesLoading && unresolved > 0 && <p>{num(unresolved)} compan{unresolved === 1 ? 'y has' : 'ies have'} no name from LinkedIn and show as “Unresolved (id)”.</p>}
          {namesError && <p className="text-warning">Company names failed to load ({namesError}); companies show by ID.</p>}
        </div>
        {exports && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={exports.companyType}><Download className="h-3.5 w-3.5" /><span className="ml-1.5">Company × activity</span></Button>
            <Button variant="outline" size="sm" onClick={exports.companyCampaign}><Download className="h-3.5 w-3.5" /><span className="ml-1.5">Company × campaign</span></Button>
            <Button variant="outline" size="sm" onClick={exports.matrix}><Download className="h-3.5 w-3.5" /><span className="ml-1.5">Matrix</span></Button>
          </div>
        )}
      </div>
    </div>
  );
}

function MixBar({ c, types }: { c: OverlapReport['companies'][number]; types: TypeStats[] }) {
  return (
    <div className="h-3 flex rounded-sm overflow-hidden bg-muted/40" title={types.filter((t) => c.byType[t.type]).map((t) => `${t.short} ${num(c.byType[t.type])}`).join(' · ')}>
      {types.filter((t) => c.byType[t.type]).map((t) => (
        <div key={t.type} style={{ width: `${(c.byType[t.type] / c.touches) * 100}%`, background: colorOf(t.colorIndex) }} />
      ))}
    </div>
  );
}

function TypeDrill({ t, nameOf }: { t: TypeStats; nameOf: (urn: string) => string }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div>
        <div className="font-medium mb-1.5">Top companies</div>
        <table className="w-full table-fixed">
          <colgroup><col /><col className="w-[72px]" /><col className="w-[88px]" /></colgroup>
          <thead className="text-muted-foreground"><tr><th className="text-left font-medium py-1">Company</th><th className="text-right font-medium py-1">Touches</th><th className="text-right font-medium py-1" title="Other activity types this company saw">Other types</th></tr></thead>
          <tbody>
            {t.top.map((c) => (
              <tr key={c.urn} className="border-t border-border/40">
                <td className="py-1 truncate" title={nameOf(c.urn)}>{nameOf(c.urn)}</td>
                <td className="py-1 text-right tabular-nums">{num(c.touches)}</td>
                <td className="py-1 text-right tabular-nums">{c.otherTypes || <span className="text-primary">only</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <div className="font-medium mb-1.5">Campaigns</div>
        <table className="w-full table-fixed">
          <colgroup><col /><col className="w-[80px]" /><col className="w-[72px]" /></colgroup>
          <thead className="text-muted-foreground"><tr><th className="text-left font-medium py-1">Campaign</th><th className="text-right font-medium py-1">Companies</th><th className="text-right font-medium py-1">Touches</th></tr></thead>
          <tbody>
            {t.campaignRows.map((r) => (
              <tr key={r.id} className="border-t border-border/40">
                <td className="py-1 truncate" title={r.name}>{r.name}</td>
                <td className="py-1 text-right tabular-nums">{num(r.reach)}</td>
                <td className="py-1 text-right tabular-nums">{num(r.touches)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
