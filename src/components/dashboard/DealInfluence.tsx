import { Fragment, useMemo, useState } from 'react';
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { MatchedCompany } from '@/hooks/useCompanyInfluenceMatcher';
import {
  useDealInfluence, analyzeDeals, summarizeDeals, dealDateOf, orgIdOf, bucketLabel,
  BUCKETS, WEEKS_BEFORE, DealCompany, DealVerdict,
} from '@/hooks/useDealInfluence';
import { WidgetCard, EmptyState, StatusPill, SegmentedControl, ChartLegend } from '@/components/dashboard/widgets';
import { CompanyLogo, ERROR_HELP } from '@/components/dashboard/CompanyIntelligenceTable';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { Button } from '@/components/ui/button';
import { exportToCSV } from '@/lib/exportUtils';
import { AlertTriangle, CalendarClock, Clock, Crown, Download, Info, Loader2, Megaphone, Radio, RefreshCw, Timer, UserX } from 'lucide-react';

interface DealInfluenceProps {
  accessToken: string | null;
  selectedAccount: string | null;
  matched: MatchedCompany[];
  dateColumn: string | null;
}

type Metric = 'engagements' | 'impressions';

const PAID_COLOR = 'hsl(var(--chart-1))';
const SHARE_COLOR = 'hsl(var(--chart-3))';
const TOOLTIP_STYLE = { fontSize: 12, backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, color: 'hsl(var(--foreground))' };
const AXIS_TICK = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' };
const VERDICT: Record<DealVerdict, { label: string; tone: 'success' | 'warning' | 'neutral' | 'info' }> = {
  influenced: { label: 'Touched before deal', tone: 'success' },
  post_only: { label: 'Only after deal', tone: 'warning' },
  not_reached: { label: 'Not reached', tone: 'neutral' },
  out_of_range: { label: 'Too old', tone: 'neutral' },
  no_date: { label: 'No date', tone: 'neutral' },
};
const ROWS_COLLAPSED = 40;
const DAY = 86400000;
const fmt = (n: number) => Math.round(n).toLocaleString();
const shiftDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

export function DealInfluence({ accessToken, selectedAccount, matched, dateColumn }: DealInfluenceProps) {
  const { touches, intel, intelErrors, isLoading, error, loadedKey, load } = useDealInfluence(accessToken);
  const [metric, setMetric] = useState<Metric>('engagements');
  const [showAll, setShowAll] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  // What a load would request: every matched org, from 26 weeks before the
  // earliest deal to 4 weeks after the latest (the edge clamps to today / 2 years).
  const request = useMemo(() => {
    const dates = matched.map(dealDateOf).filter((d): d is string => !!d).sort();
    const orgIds = [...new Set(matched.map(orgIdOf).filter(Boolean))].sort();
    if (!dates.length || !orgIds.length) return null;
    const from = shiftDays(dates[0], -(WEEKS_BEFORE * 7 - 1));
    const to = shiftDays(dates[dates.length - 1], 28);
    return { orgIds, from, to, dated: dates.length, key: `${selectedAccount}:${from}:${to}:${orgIds.join(',')}` };
  }, [matched, selectedAccount]);

  const deals = useMemo(() => (touches ? analyzeDeals(matched, touches, intel) : []), [matched, touches, intel]);
  const summary = useMemo(() => (touches ? summarizeDeals(deals, touches.meta) : null), [deals, touches]);
  const maxCell = useMemo(() => Math.max(1, ...deals.flatMap((d) => Object.values(d.weeks).map((w) => w[metric]))), [deals, metric]);

  const stale = !!touches && !!request && loadedKey !== request.key;
  const run = () => request && selectedAccount && load(selectedAccount, request.orgIds, request.from, request.to, request.key);
  const shown = deals.filter((d) => d.verdict !== 'no_date');
  const rows = showAll ? shown : shown.slice(0, ROWS_COLLAPSED);

  const handleExport = () => exportToCSV(deals.map((d) => ({
    company: d.name,
    website: d.website,
    dealDate: d.dealDate || '',
    verdict: VERDICT[d.verdict].label,
    score: d.score,
    firstTouchDaysBefore: d.firstTouch ?? '',
    lastTouchDaysBefore: d.lastTouch ?? '',
    impressionsBeforeDeal: d.pre.impressions,
    clicksBeforeDeal: d.pre.clicks,
    engagementsBeforeDeal: d.pre.engagements,
    leadsBeforeDeal: d.pre.leads,
    spendBeforeDeal: d.pre.spend.toFixed(2),
    activeWeeksBeforeDeal: d.pre.activeWeeks,
    impressionsAfterDeal: d.postImpressions,
    campaignsBeforeDeal: d.preCampaigns.map((c) => c.name).join('; '),
    decisionMakersEngaged90d: d.decisionMakers === null ? '' : d.decisionMakers ? 'yes' : 'no',
    organicEngagements365d: d.organicEngagements ?? '',
    engagementLevel365d: d.engagementLevel || '',
    partialWindow: d.partial ? 'yes' : '',
  })), `deal-influence-${new Date().toISOString().slice(0, 10)}`);

  const toolbar = (
    <div className="flex items-center gap-2">
      {touches && <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleExport}><Download className="h-3.5 w-3.5 mr-1" />Export</Button>}
      <Button size="sm" className="h-8 text-xs" onClick={run} disabled={!request || !selectedAccount || isLoading}>
        {isLoading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
        {touches ? 'Re-analyze' : 'Analyze deal timing'}
      </Button>
    </div>
  );

  return (
    <WidgetCard
      title="Deal influence"
      subtitle={request
        ? `Every matched company aligned on its own deal date (the earliest date in your CSV) · ${request.dated} of ${matched.length} have a date`
        : 'Every matched company aligned on its own deal date'}
      toolbar={toolbar}
    >
      {!request && (
        <EmptyState
          icon={CalendarClock}
          title={dateColumn ? 'No readable dates in the date column' : 'Map a date column'}
          description={dateColumn
            ? `None of the matched rows have a date in "${dateColumn}" that could be read. Use a column like Close date or Created date (YYYY-MM-DD or M/D/YYYY).`
            : 'Deal timing needs a date per company (close, created or opportunity date). Pick the column in the CSV mapping above.'}
        />
      )}

      {request && !touches && !isLoading && !error && (
        <p className="text-xs text-muted-foreground flex items-start gap-1.5">
          <Info className="h-3.5 w-3.5 mt-px shrink-0" />
          Pulls daily paid activity for {request.orgIds.length} companies from {request.from} to {request.to} (Ad Analytics), plus organic and decision-maker engagement from Account Intel. Large date spans take a minute.
        </p>
      )}
      {isLoading && (
        <p className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Loading daily paid touches and Account Intel…</p>
      )}
      {error && (
        <p className="text-xs flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-destructive mt-px shrink-0" />
          <span>{error.message} {ERROR_HELP[error.kind] ?? ''} <button className="underline" onClick={run}>Retry</button></span>
        </p>
      )}

      {touches && summary && (
        <div className="space-y-5">
          {(stale || touches.meta.truncated || touches.meta.clampedFrom || intelErrors.length > 0) && (
            <div className="space-y-1 text-xs">
              {stale && <Note>The matched companies or dates changed since this analysis. Re-analyze to update it.</Note>}
              {touches.meta.truncated && <Note>LinkedIn returned more rows than one run can fetch, so some days are missing. Companies may show as not reached when they were. Narrow the CSV to a shorter date span.</Note>}
              {touches.meta.clampedFrom && <Note>LinkedIn keeps two years of ad data. Deals before {touches.meta.from} are marked "Too old", and those near it have a partial window.</Note>}
              {intelErrors.map((e) => <Note key={e}>{e}. Decision-maker and organic columns are blank.</Note>)}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
            <MetricCard title="Touched before deal" value={`${summary.influenced} / ${summary.dated}`} change={summary.dated ? `${Math.round((summary.influenced / summary.dated) * 100)}% of deals` : undefined} changeType="positive" icon={Megaphone} />
            <MetricCard title="Only after deal" value={summary.postOnly} icon={Clock} />
            <MetricCard title="Not reached" value={summary.notReached} change="in the 26 weeks before" icon={UserX} />
            <MetricCard title="Median first touch" value={summary.medianFirstTouch === null ? '—' : `${summary.medianFirstTouch}d`} change="before the deal" icon={Timer} />
            <MetricCard title="Median last touch" value={summary.medianLastTouch === null ? '—' : `${summary.medianLastTouch}d`} change="before the deal" icon={CalendarClock} />
            <MetricCard title="Decision makers" value={summary.dmShare === null ? '—' : `${summary.dmShare}%`} change="of touched deals, last 90d" icon={Crown} />
            <MetricCard title="Organic engaged" value={summary.organicShare === null ? '—' : `${summary.organicShare}%`} change="of touched deals, last 365d" icon={Radio} />
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div>
                <h4 className="text-sm font-semibold">Paid activity by week, relative to each deal</h4>
                <p className="text-xs text-muted-foreground">Bars: total paid {metric} across all deals. Line: share of deals touched that week (of deals whose week falls inside LinkedIn's data).</p>
              </div>
              <SegmentedControl size="sm" value={metric} onChange={setMetric} options={[{ label: 'Engagements', value: 'engagements' }, { label: 'Impressions', value: 'impressions' }]} />
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={summary.curve} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={AXIS_TICK} interval={1} />
                <YAxis yAxisId="v" tick={AXIS_TICK} width={48} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v))} />
                <YAxis yAxisId="p" orientation="right" tick={AXIS_TICK} width={40} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelFormatter={(l) => (String(l).startsWith('-') ? `${String(l).slice(1, -1)} week(s) before the deal` : `${String(l).slice(1, -1)} week(s) after the deal`)}
                  formatter={(v: number, name: string, p: { payload?: { touched: number; eligible: number } }) => name === 'pct'
                    ? [`${v ?? '—'}% (${p.payload?.touched} of ${p.payload?.eligible})`, 'Deals touched']
                    : [fmt(v), `Paid ${metric}`]}
                />
                <Bar yAxisId="v" dataKey={metric} fill={PAID_COLOR} radius={[3, 3, 0, 0]} />
                <Line yAxisId="p" dataKey="pct" stroke={SHARE_COLOR} strokeWidth={2} dot={false} connectNulls />
                <ReferenceLine yAxisId="v" x={bucketLabel(-1)} stroke="hsl(var(--foreground))" strokeDasharray="3 3" label={{ value: 'Deal', position: 'insideTopRight', fontSize: 10, fill: 'hsl(var(--foreground))' }} />
              </ComposedChart>
            </ResponsiveContainer>
            <ChartLegend className="mt-2" items={[{ label: `Paid ${metric}`, color: PAID_COLOR }, { label: 'Share of deals touched', color: SHARE_COLOR }]} />
          </div>

          <div>
            <div className="mb-2">
              <h4 className="text-sm font-semibold">Company by company</h4>
              <p className="text-xs text-muted-foreground">
                One row per deal, ranked by influence score. Each cell is a week, darker = more paid {metric}. The line marks the deal. Click a row for the campaigns that touched it before the deal.
              </p>
            </div>
            {shown.length === 0 ? (
              <EmptyState icon={CalendarClock} title="No dated deals" />
            ) : (
              <div className="rounded-lg border overflow-x-auto">
                <div className="min-w-[980px]">
                  <div className="grid grid-cols-[220px_1fr_300px] items-end gap-3 px-3 py-2 bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <span>Company · deal date</span>
                    <div className="grid" style={{ gridTemplateColumns: `repeat(${BUCKETS.length}, minmax(0, 1fr))` }}>
                      {BUCKETS.map((b) => <span key={b} className={`text-center ${b === 0 ? 'border-l border-foreground/60' : ''}`}>{b % 4 === 0 || b === -1 ? bucketLabel(b) : ''}</span>)}
                    </div>
                    <div className="grid grid-cols-[1fr_44px_56px_40px_52px] gap-2 text-right">
                      <span className="text-left">Verdict</span><span>Score</span><span>First</span><span title="Decision makers engaged (Account Intel, last 90 days)">DM</span><span title="Organic engagements (Account Intel, last 365 days)">Organic</span>
                    </div>
                  </div>
                  {rows.map((d) => (
                    <Fragment key={d.key}>
                      <button
                        className="w-full grid grid-cols-[220px_1fr_300px] items-center gap-3 px-3 py-1.5 border-t text-left hover:bg-muted/30"
                        onClick={() => setExpanded(expanded === d.key ? null : d.key)}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <CompanyLogo name={d.name} website={d.website} />
                          <span className="min-w-0">
                            <span className="block text-xs font-medium truncate">{d.name}</span>
                            <span className="block text-[10px] text-muted-foreground">{d.dealDate}{d.partial ? ' · partial' : ''}</span>
                          </span>
                        </span>
                        <div className="grid h-5" style={{ gridTemplateColumns: `repeat(${BUCKETS.length}, minmax(0, 1fr))` }}>
                          {BUCKETS.map((b) => {
                            const w = d.weeks[b];
                            const v = w ? w[metric] : 0;
                            const alpha = w ? (v > 0 ? 0.25 + 0.75 * Math.sqrt(v / maxCell) : 0.12) : 0;
                            return (
                              <span
                                key={b}
                                title={w ? `${bucketLabel(b)}: ${fmt(w.impressions)} impressions, ${fmt(w.engagements)} engagements` : bucketLabel(b)}
                                className={`mx-px rounded-[2px] ${b === 0 ? 'border-l border-foreground/60' : ''}`}
                                style={{ backgroundColor: w ? `hsl(var(--chart-1) / ${alpha.toFixed(2)})` : 'hsl(var(--muted) / 0.5)' }}
                              />
                            );
                          })}
                        </div>
                        <div className="grid grid-cols-[1fr_44px_56px_40px_52px] gap-2 items-center text-right text-xs tabular-nums">
                          <span className="text-left"><StatusPill tone={VERDICT[d.verdict].tone} label={VERDICT[d.verdict].label} /></span>
                          <span className="font-semibold">{d.verdict === 'influenced' ? d.score : '—'}</span>
                          <span>{d.firstTouch === null ? '—' : `${d.firstTouch}d`}</span>
                          <span>{d.decisionMakers === null ? '—' : d.decisionMakers ? 'Yes' : 'No'}</span>
                          <span>{d.organicEngagements === null ? '—' : fmt(d.organicEngagements)}</span>
                        </div>
                      </button>
                      {expanded === d.key && <DealDetail d={d} />}
                    </Fragment>
                  ))}
                </div>
              </div>
            )}
            {shown.length > ROWS_COLLAPSED && (
              <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={() => setShowAll(!showAll)}>
                {showAll ? 'Show top 40' : `Show all ${shown.length}`}
              </Button>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Paid touches come from Ad Analytics by day (LinkedIn applies privacy thresholds, so very light exposure can be missing). Decision makers (Director and above, last 90 days) and organic (last 365 days) come from Account Intel, whose windows end today, so they are not aligned to deal dates. Score (0–100, touched-before-deal companies only): reach 25, engagement 25, recency of last touch 15, weeks touched 10, decision makers 15, organic 10. It shows association, not proof that ads caused the deal. A holdout test is the way to prove that.
          </p>
        </div>
      )}
    </WidgetCard>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="flex items-start gap-1.5 text-muted-foreground"><AlertTriangle className="h-3.5 w-3.5 text-warning mt-px shrink-0" /><span>{children}</span></p>;
}

function DealDetail({ d }: { d: DealCompany }) {
  return (
    <div className="border-t bg-muted/10 px-6 py-3 text-xs space-y-3">
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-muted-foreground">
        <span>Before the deal: <b className="text-foreground">{fmt(d.pre.impressions)}</b> impressions · <b className="text-foreground">{fmt(d.pre.clicks)}</b> clicks · <b className="text-foreground">{fmt(d.pre.engagements)}</b> engagements · <b className="text-foreground">{fmt(d.pre.leads)}</b> leads · <b className="text-foreground">${d.pre.spend.toFixed(2)}</b> spend over {d.pre.activeWeeks} week(s)</span>
        {d.lastTouch !== null && <span>Last touch {d.lastTouch}d before</span>}
        {d.postImpressions > 0 && <span>After the deal: {fmt(d.postImpressions)} impressions</span>}
        {d.engagementLevel && <span>Engagement level (365d): {d.engagementLevel.toLowerCase().replace(/_/g, ' ')}</span>}
      </div>
      {d.preCampaigns.length > 0 ? (
        <table className="w-full max-w-3xl">
          <thead className="text-[10px] uppercase tracking-wide text-muted-foreground">
            <tr><th className="text-left py-1">Campaign before the deal</th><th className="text-right py-1">Impressions</th><th className="text-right py-1">Engagements</th></tr>
          </thead>
          <tbody className="tabular-nums">
            {d.preCampaigns.map((c) => (
              <tr key={c.id} className="border-t border-border/40"><td className="py-1">{c.name}</td><td className="text-right">{fmt(c.impressions)}</td><td className="text-right">{fmt(c.engagements)}</td></tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-muted-foreground">{d.verdict === 'influenced' ? 'Campaign split unavailable for this account (LinkedIn returned company totals only).' : 'No paid touches in the 26 weeks before the deal.'}</p>
      )}
    </div>
  );
}
