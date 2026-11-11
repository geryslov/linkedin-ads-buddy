import { useEffect, useMemo, useState } from 'react';
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { companyKey, LookbackWindow } from '@/hooks/useCompanyIntelligence';
import { useCompanyJourney, DailyRow, WindowRow } from '@/hooks/useCompanyJourney';
import { WidgetCard, EmptyState, StatusPill, SegmentedControl, ChartLegend } from '@/components/dashboard/widgets';
import { CompanyLogo, ERROR_HELP } from '@/components/dashboard/CompanyIntelligenceTable';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { AlertTriangle, ChevronsUpDown, Info, Loader2, RefreshCw, Route } from 'lucide-react';

interface CompanyJourneyProps {
  accessToken: string | null;
  selectedAccount: string | null;
}

const WINDOWS: { value: LookbackWindow; days: number; label: string }[] = [
  { value: 'LAST_7_DAYS', days: 7, label: '7d' },
  { value: 'LAST_30_DAYS', days: 30, label: '30d' },
  { value: 'LAST_60_DAYS', days: 60, label: '60d' },
  { value: 'LAST_90_DAYS', days: 90, label: '90d' },
  { value: 'LAST_180_DAYS', days: 180, label: '180d' },
  { value: 'LAST_365_DAYS', days: 365, label: '365d' },
];

type Metric = 'impressions' | 'engagements' | 'clicks' | 'leads' | 'videoViews';
const METRICS: { label: string; value: Metric }[] = [
  { label: 'Impressions', value: 'impressions' },
  { label: 'Engagements', value: 'engagements' },
  { label: 'Clicks', value: 'clicks' },
  { label: 'Leads', value: 'leads' },
  { label: 'Video views', value: 'videoViews' },
];
// Account Intel only reports organic impressions and engagements.
const ORGANIC_FIELD: Partial<Record<Metric, 'organicImpressions' | 'organicEngagements'>> = {
  impressions: 'organicImpressions', engagements: 'organicEngagements',
};

type Show = 'both' | 'paid' | 'organic';

const LEVEL_TONE: Record<string, 'success' | 'info' | 'warning' | 'neutral'> = {
  VERY_HIGH: 'success', HIGH: 'success', MEDIUM: 'info', LOW: 'warning', VERY_LOW: 'neutral',
};
const LEVEL_RANK = ['UNKNOWN', 'VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'];
const levelLabel = (l: string) => l.toLowerCase().replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
const fmt = (n: number) => Math.round(n).toLocaleString();
const titleCase = (s: string) => s.toLowerCase().replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

const CAMPAIGN_COLORS = [1, 2, 4, 7, 5, 6].map((n) => `hsl(var(--chart-${n}))`);
const OTHER_COLOR = 'hsl(var(--muted-foreground) / 0.45)';
const ORGANIC_COLOR = 'hsl(var(--chart-3))';
const TOOLTIP_STYLE = { fontSize: 12, backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, color: 'hsl(var(--foreground))' };
const AXIS_TICK = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' };

const DAY_MS = 86400000;
const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);
const shortDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });

const EMPTY_WINDOW: Omit<WindowRow, 'window'> = {
  engagementLevel: 'UNKNOWN', paidImpressions: 0, paidClicks: 0, paidEngagements: 0, paidLeads: 0, paidQualifiedLeads: 0,
  conversions: 0, paidVideoViews: 0, organicImpressions: 0, organicEngagements: 0,
};
const NUMERIC_KEYS = ['paidImpressions', 'paidClicks', 'paidEngagements', 'paidLeads', 'paidQualifiedLeads', 'conversions', 'paidVideoViews', 'organicImpressions', 'organicEngagements'] as const;

/** A non-overlapping period built by differencing two nested lookback windows. */
interface Bucket { from: number; to: number; label: string; window: WindowRow; delta: Omit<WindowRow, 'window' | 'engagementLevel'> }

interface Point { label: string; dates: string[]; values: Record<string, number>; paid: number; organic: number | null }

function Kpi({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card px-4 py-3" style={{ boxShadow: 'var(--shadow-sm)' }}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-bold tabular-nums mt-0.5">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

export function CompanyJourney({ accessToken, selectedAccount }: CompanyJourneyProps) {
  const { series, seriesLoading, seriesError, loadSeries, daily, loadDaily } = useCompanyJourney(accessToken);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [lookback, setLookback] = useState<LookbackWindow>('LAST_90_DAYS');
  const [metric, setMetric] = useState<Metric>('impressions');
  const [show, setShow] = useState<Show>('both');
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  useEffect(() => {
    setCompanyId(null);
    if (selectedAccount) loadSeries(selectedAccount);
  }, [selectedAccount, loadSeries]);

  const companies = series?.accountId === selectedAccount ? series.companies : [];
  const company = companies.find((c) => companyKey(c) === companyId) ?? companies[0] ?? null;
  const key = company ? companyKey(company) : '';
  const days = WINDOWS.find((w) => w.value === lookback)!.days;

  const dailyKey = company ? `${selectedAccount}:${lookback}:${company.companyPageUrl}` : '';
  const dailyState = dailyKey ? daily[dailyKey] : undefined;
  const dailyData = dailyState && dailyState !== 'loading' && 'rows' in dailyState ? dailyState : null;
  const dailyError = dailyState && dailyState !== 'loading' && 'message' in dailyState ? dailyState : null;

  useEffect(() => {
    setSelectedIdx(null);
    if (selectedAccount && company?.companyPageUrl && !daily[dailyKey]) loadDaily(selectedAccount, lookback, company);
  }, [selectedAccount, company, company?.companyPageUrl, lookback, dailyKey, daily, loadDaily]);

  const windows = useMemo(() => {
    const rows = series?.byCompany[key] ?? [];
    return WINDOWS.map((w) => rows.find((r) => r.window === w.value) ?? { ...EMPTY_WINDOW, window: w.value });
  }, [series, key]);
  const totals = windows[WINDOWS.findIndex((w) => w.value === lookback)];

  const buckets = useMemo<Bucket[]>(() => WINDOWS.filter((w) => w.days <= days).map((w, i, arr) => {
    const row = windows[WINDOWS.indexOf(w)];
    const prev = i > 0 ? windows[WINDOWS.indexOf(arr[i - 1])] : null;
    const from = i > 0 ? arr[i - 1].days : 0;
    const delta = Object.fromEntries(NUMERIC_KEYS.map((k) => [k, Math.max(0, row[k] - (prev ? prev[k] : 0))])) as Bucket['delta'];
    return { from, to: w.days, label: from === 0 ? `Last ${w.days} days` : `${from + 1}–${w.days} days ago`, window: row, delta };
  }), [windows, days]);
  const bucketForAge = (age: number) => buckets.find((b) => age >= b.from && age < b.to) ?? null;

  // Campaigns ranked by the chosen metric; the top six get their own colour.
  const { topCampaigns, campaignName } = useMemo(() => {
    const totalsBy = new Map<string, number>();
    for (const r of dailyData?.rows ?? []) if (r.campaignId) totalsBy.set(r.campaignId, (totalsBy.get(r.campaignId) ?? 0) + r[metric]);
    const top = [...totalsBy.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id]) => id);
    return { topCampaigns: top, campaignName: (id: string) => dailyData?.campaigns[id]?.name ?? `Campaign ${id}` };
  }, [dailyData, metric]);

  const weekly = days > 90;
  const points = useMemo<Point[]>(() => {
    const today = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
    const rowsByDate = new Map<string, DailyRow[]>();
    for (const r of dailyData?.rows ?? []) rowsByDate.set(r.date, [...(rowsByDate.get(r.date) ?? []), r]);
    const organicField = ORGANIC_FIELD[metric];
    const step = weekly ? 7 : 1;
    const out: Point[] = [];
    for (let age = days - 1; age >= 0; age -= step) {
      const ages = Array.from({ length: Math.min(step, age + 1) }, (_, i) => age - i);
      const dates = ages.map((a) => isoDay(today - a * DAY_MS));
      const values: Record<string, number> = {};
      let paid = 0;
      for (const d of dates) {
        for (const r of rowsByDate.get(d) ?? []) {
          const k = !r.campaignId ? 'paid' : topCampaigns.includes(r.campaignId) ? `c_${r.campaignId}` : 'other';
          values[k] = (values[k] ?? 0) + r[metric];
          paid += r[metric];
        }
      }
      // Organic is a per-day average of the Account Intel period the day falls in.
      const organic = organicField
        ? ages.reduce((s, a) => { const b = bucketForAge(a); return s + (b ? b.delta[organicField] / (b.to - b.from) : 0); }, 0)
        : null;
      out.push({ label: dates[0], dates, values, paid, organic });
    }
    return out;
    // bucketForAge reads buckets
  }, [dailyData, metric, days, weekly, topCampaigns, buckets]); // eslint-disable-line react-hooks/exhaustive-deps

  const chartData = points.map((p) => ({ label: p.label, ...p.values, organic: p.organic }));
  const firstTouch = points.find((p) => p.paid > 0);
  const peak = points.reduce<Point | null>((m, p) => (p.paid > (m?.paid ?? 0) ? p : m), null);
  const hasOther = points.some((p) => p.values.other);
  const showPaid = show !== 'organic';
  const showOrganic = show !== 'paid' && ORGANIC_FIELD[metric] !== undefined;

  const momentum = (() => {
    const short = LEVEL_RANK.indexOf(windows[1].engagementLevel); // 30d
    const long = LEVEL_RANK.indexOf(windows[3].engagementLevel); // 90d
    if (short <= 0 && long <= 0) return null;
    return short > long ? { label: 'Warming up', tone: 'success' as const } : short < long ? { label: 'Cooling down', tone: 'warning' as const } : { label: 'Steady', tone: 'info' as const };
  })();

  const selected = selectedIdx !== null ? points[selectedIdx] : null;
  const selectedRows = useMemo(() => {
    if (!selected) return [];
    const by = new Map<string, DailyRow>();
    for (const r of dailyData?.rows ?? []) {
      if (!selected.dates.includes(r.date)) continue;
      const k = r.campaignId ?? 'all';
      const t = by.get(k) ?? { ...r, impressions: 0, clicks: 0, engagements: 0, leads: 0, conversions: 0, videoViews: 0, spend: 0 };
      t.impressions += r.impressions; t.clicks += r.clicks; t.engagements += r.engagements; t.leads += r.leads;
      t.conversions += r.conversions; t.videoViews += r.videoViews; t.spend = Math.round((t.spend + r.spend) * 100) / 100;
      by.set(k, t);
    }
    return [...by.values()].sort((a, b) => b.impressions - a.impressions);
  }, [selected, dailyData]);
  const selectedBucket = selected ? bucketForAge(Math.round((Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()) - Date.parse(`${selected.dates[selected.dates.length - 1]}T00:00:00Z`)) / DAY_MS)) : null;

  if (!selectedAccount) {
    return <EmptyState icon={Route} title="Select an ad account" description="Company Journey reports on one ad account at a time." />;
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <WidgetCard
        title="Company"
        subtitle="Pick a company engaged in the last 365 days and a time frame"
        toolbar={
          <Button variant="outline" size="sm" onClick={() => loadSeries(selectedAccount)} disabled={seriesLoading}>
            {seriesLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            <span className="ml-1.5">Reload</span>
          </Button>
        }
      >
        {seriesError ? (
          <div className="flex items-start gap-3 text-xs">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div><div className="font-medium">{seriesError.message}</div>{ERROR_HELP[seriesError.kind] && <div className="text-muted-foreground mt-0.5">{ERROR_HELP[seriesError.kind]}</div>}</div>
          </div>
        ) : seriesLoading && !companies.length ? (
          <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading engaged companies across six time windows…</div>
        ) : !companies.length ? (
          <div className="text-sm text-muted-foreground">No engaged companies in the last 365 days.</div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 w-[280px] justify-between">
                  <span className="flex items-center gap-2 truncate">
                    {company && <CompanyLogo name={company.companyName} website={company.companyWebsite} />}
                    <span className="truncate">{company?.companyName ?? 'Select company'}</span>
                  </span>
                  <ChevronsUpDown className="h-3.5 w-3.5 opacity-50 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[320px] p-0" align="start">
                <Command>
                  <CommandInput placeholder={`Search ${companies.length.toLocaleString()} companies…`} />
                  <CommandList>
                    <CommandEmpty>No company found.</CommandEmpty>
                    {companies.slice(0, 500).map((c) => (
                      <CommandItem key={companyKey(c)} value={`${c.companyName} ${companyKey(c)}`} onSelect={() => { setCompanyId(companyKey(c)); setPickerOpen(false); }}>
                        <CompanyLogo name={c.companyName} website={c.companyWebsite} />
                        <span className="ml-2 truncate flex-1">{c.companyName}</span>
                        <span className="text-[10px] text-muted-foreground">{levelLabel(c.engagementLevel)}</span>
                      </CommandItem>
                    ))}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <SegmentedControl size="sm" options={WINDOWS.map((w) => ({ label: w.label, value: w.value }))} value={lookback} onChange={setLookback} />
          </div>
        )}
      </WidgetCard>

      {company && (
        <>
          {/* Engagement level per window — LinkedIn's own score, cumulative. */}
          <div className="rounded-xl border border-border/70 bg-card px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs" style={{ boxShadow: 'var(--shadow-sm)' }}>
            <span className="font-medium">Engagement level</span>
            {WINDOWS.map((w, i) => (
              <span key={w.value} className={`flex items-center gap-1.5 ${w.value === lookback ? '' : 'opacity-70'}`}>
                <span className="text-muted-foreground">{w.label}</span>
                <StatusPill tone={LEVEL_TONE[windows[i].engagementLevel] ?? 'neutral'} label={levelLabel(windows[i].engagementLevel)} />
              </span>
            ))}
            {momentum && <span className="ml-auto flex items-center gap-1.5"><span className="text-muted-foreground">30d vs 90d</span><StatusPill tone={momentum.tone} label={momentum.label} /></span>}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <Kpi label="Paid impressions" value={fmt(totals.paidImpressions)} hint={`Account Intel · ${days}d`} />
            <Kpi label="Paid engagements" value={fmt(totals.paidEngagements)} hint={`${fmt(totals.paidClicks)} clicks`} />
            <Kpi label="Organic impressions" value={fmt(totals.organicImpressions)} hint="Your page's posts" />
            <Kpi label="Organic engagements" value={fmt(totals.organicEngagements)} />
            <Kpi label="Leads" value={fmt(totals.paidLeads)} hint={`${fmt(totals.paidQualifiedLeads)} qualified · ${fmt(totals.conversions)} conv.`} />
            <Kpi label="Video views" value={fmt(totals.paidVideoViews)} />
          </div>

          <WidgetCard
            title="Timeline"
            subtitle={`${weekly ? 'Weekly' : 'Daily'} paid ${METRICS.find((m) => m.value === metric)!.label.toLowerCase()} by campaign${ORGANIC_FIELD[metric] ? ', with organic per period' : ''} · click a bar for details`}
            toolbar={
              <>
                <SegmentedControl size="sm" options={METRICS} value={metric} onChange={setMetric} />
                <SegmentedControl size="sm" options={[{ label: 'Both', value: 'both' as const }, { label: 'Paid', value: 'paid' as const }, { label: 'Organic', value: 'organic' as const }]} value={show} onChange={setShow} />
              </>
            }
          >
            {dailyState === 'loading' && (
              <div className="mb-3 text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Loading daily paid activity from Ad Analytics…</div>
            )}
            {dailyError && (
              <div className="mb-3 text-xs flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive mt-px shrink-0" />
                <span>
                  {dailyError.message} {ERROR_HELP[dailyError.kind] ?? ''} The organic periods below still come from Account Intel.{' '}
                  <button className="underline" onClick={() => company && loadDaily(selectedAccount, lookback, company)}>Retry</button>
                </span>
              </div>
            )}
            {!ORGANIC_FIELD[metric] && show === 'organic' && (
              <p className="mb-3 text-xs text-muted-foreground">LinkedIn reports organic only as impressions and engagements.</p>
            )}

            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart
                data={chartData}
                margin={{ top: 16, right: 8, left: 0, bottom: 0 }}
                onClick={(s) => { if (s && s.activeTooltipIndex != null) setSelectedIdx(Number(s.activeTooltipIndex)); }}
                style={{ cursor: 'pointer' }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tickFormatter={shortDate} tick={AXIS_TICK} minTickGap={24} />
                <YAxis tick={AXIS_TICK} width={48} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(Math.round(v)))} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelFormatter={(l) => (weekly ? `Week of ${shortDate(String(l))}` : shortDate(String(l)))}
                  formatter={(v: number, name: string) => [fmt(v), name === 'organic' ? `Organic (period avg)` : name === 'other' ? 'Other campaigns' : name === 'paid' ? 'Paid' : campaignName(name.slice(2))]}
                />
                {showPaid && topCampaigns.map((id, i) => <Bar key={id} dataKey={`c_${id}`} stackId="paid" fill={CAMPAIGN_COLORS[i]} />)}
                {showPaid && hasOther && <Bar dataKey="other" stackId="paid" fill={OTHER_COLOR} />}
                {showPaid && dailyData && !dailyData.meta.campaignSplit && <Bar dataKey="paid" stackId="paid" fill={CAMPAIGN_COLORS[0]} />}
                {showOrganic && <Line dataKey="organic" type="stepAfter" stroke={ORGANIC_COLOR} strokeWidth={2} strokeDasharray="5 3" dot={false} />}
                {showPaid && firstTouch && <ReferenceLine x={firstTouch.label} stroke="hsl(var(--muted-foreground))" strokeDasharray="2 2" label={{ value: 'First touch', position: 'top', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />}
                {showPaid && peak && peak !== firstTouch && <ReferenceLine x={peak.label} stroke="hsl(var(--muted-foreground))" strokeDasharray="2 2" label={{ value: 'Peak', position: 'top', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />}
                {selected && <ReferenceLine x={selected.label} stroke="hsl(var(--primary))" strokeWidth={2} />}
              </ComposedChart>
            </ResponsiveContainer>

            <ChartLegend
              className="mt-2"
              items={[
                ...(showPaid ? topCampaigns.map((id, i) => ({ label: campaignName(id), color: CAMPAIGN_COLORS[i] })) : []),
                ...(showPaid && hasOther ? [{ label: 'Other campaigns', color: OTHER_COLOR }] : []),
                ...(showPaid && dailyData && !dailyData.meta.campaignSplit ? [{ label: 'Paid (all campaigns)', color: CAMPAIGN_COLORS[0] }] : []),
                ...(showOrganic ? [{ label: 'Organic, average per day of each period', color: ORGANIC_COLOR }] : []),
              ]}
            />
            <p className="mt-2 text-[11px] text-muted-foreground flex items-start gap-1.5">
              <Info className="h-3 w-3 mt-px shrink-0" />
              Paid bars are Ad Analytics (approximate; LinkedIn drops a company's day below 3 events), so they won't exactly match the Account Intel totals above. Organic has no daily data — it's each period's total spread evenly over its days.
              {dailyData?.meta.truncated && ' Some days hit LinkedIn\'s response limit and may be incomplete.'}
              {dailyData && !dailyData.meta.campaignSplit && ' LinkedIn rejected the per-campaign split for this account, so paid is shown as one total.'}
            </p>
          </WidgetCard>

          {selected && (
            <WidgetCard
              title={weekly ? `Week of ${shortDate(selected.dates[0])}` : shortDate(selected.dates[0])}
              subtitle={selectedBucket ? `In the "${selectedBucket.label}" period` : undefined}
              toolbar={<Button variant="ghost" size="sm" onClick={() => setSelectedIdx(null)}>Close</Button>}
            >
              {selectedRows.length === 0 ? (
                <p className="text-xs text-muted-foreground">No paid activity reported for this company on these days.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-muted-foreground">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-medium">Campaign</th>
                        <th className="px-2 py-1.5 text-right font-medium">Impr.</th>
                        <th className="px-2 py-1.5 text-right font-medium">Clicks</th>
                        <th className="px-2 py-1.5 text-right font-medium">Engagements</th>
                        <th className="px-2 py-1.5 text-right font-medium">Leads</th>
                        <th className="px-2 py-1.5 text-right font-medium">Conv.</th>
                        <th className="px-2 py-1.5 text-right font-medium">Video views</th>
                        <th className="px-2 py-1.5 text-right font-medium">Spend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRows.map((r) => {
                        const camp = r.campaignId ? dailyData?.campaigns[r.campaignId] : null;
                        const color = r.campaignId && topCampaigns.includes(r.campaignId) ? CAMPAIGN_COLORS[topCampaigns.indexOf(r.campaignId)] : OTHER_COLOR;
                        return (
                          <tr key={r.campaignId ?? 'all'} className="border-t border-border/50">
                            <td className="px-2 py-1.5">
                              <div className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: color }} />
                                <span className="font-medium">{r.campaignId ? campaignName(r.campaignId) : 'All campaigns'}</span>
                              </div>
                              {camp && <div className="text-[11px] text-muted-foreground pl-[18px]">{titleCase(camp.objectiveType)} · {titleCase(camp.status)}</div>}
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{fmt(r.impressions)}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{fmt(r.clicks)}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{fmt(r.engagements)}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{fmt(r.leads)}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{fmt(r.conversions)}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{fmt(r.videoViews)}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{r.spend.toLocaleString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {selectedBucket && (
                <div className="mt-3 rounded-lg bg-muted/40 px-3 py-2 text-xs flex flex-wrap gap-x-5 gap-y-1">
                  <span className="font-medium">{selectedBucket.label} (Account Intel)</span>
                  <span><span className="text-muted-foreground">Organic impr.</span> {fmt(selectedBucket.delta.organicImpressions)}</span>
                  <span><span className="text-muted-foreground">Organic eng.</span> {fmt(selectedBucket.delta.organicEngagements)}</span>
                  <span><span className="text-muted-foreground">Paid impr.</span> {fmt(selectedBucket.delta.paidImpressions)}</span>
                  <span><span className="text-muted-foreground">Leads</span> {fmt(selectedBucket.delta.paidLeads)}</span>
                </div>
              )}
            </WidgetCard>
          )}

          {/* Exact paid vs organic per period — the differenced Account Intel windows. */}
          <WidgetCard noPadding title="By period" subtitle="Paid and organic per non-overlapping period, from Account Intel (each window minus the shorter one)">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/60 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Period</th>
                    <th className="px-3 py-2 text-right font-medium">Paid impr.</th>
                    <th className="px-3 py-2 text-right font-medium">Paid eng.</th>
                    <th className="px-3 py-2 text-right font-medium">Clicks</th>
                    <th className="px-3 py-2 text-right font-medium">Leads</th>
                    <th className="px-3 py-2 text-right font-medium">Organic impr.</th>
                    <th className="px-3 py-2 text-right font-medium">Organic eng.</th>
                    <th className="px-3 py-2 text-left font-medium">Mix</th>
                  </tr>
                </thead>
                <tbody>
                  {buckets.map((b) => {
                    const paid = b.delta.paidImpressions + b.delta.paidEngagements > 0;
                    const organic = b.delta.organicImpressions + b.delta.organicEngagements > 0;
                    return (
                      <tr key={b.label} className="border-t border-border/50">
                        <td className="px-3 py-2 font-medium">{b.label}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt(b.delta.paidImpressions)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt(b.delta.paidEngagements)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt(b.delta.paidClicks)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt(b.delta.paidLeads)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt(b.delta.organicImpressions)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt(b.delta.organicEngagements)}</td>
                        <td className="px-3 py-2 text-muted-foreground">{paid && organic ? 'Paid + organic' : paid ? 'Paid only' : organic ? 'Organic only' : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </WidgetCard>
        </>
      )}
    </div>
  );
}
