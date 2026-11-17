import { Fragment, useMemo, useState } from 'react';
import { WidgetCard, EmptyState, SegmentedControl } from '@/components/dashboard/widgets';
import { Button } from '@/components/ui/button';
import { exportToCSV } from '@/lib/exportUtils';
import { companyKey, type Breakdown, type IntelError, type LookbackWindow } from '@/hooks/useCompanyIntelligence';
import type { AccountMovers } from '@/hooks/useAccountMovers';
import { ERROR_HELP, levelLabel } from '@/components/dashboard/CompanyIntelligenceTable';
import { activityOf, type ActivitySource } from '@/lib/campaignActivity';
import { AlertTriangle, Download, Loader2, RefreshCw, Trophy } from 'lucide-react';

type SortKey = 'spend' | 'engaged' | 'high' | 'qualified' | 'costEngaged' | 'costHigh' | 'costQualified' | 'warming';
type GroupBy = 'both' | 'objective' | 'activity' | 'none';

interface Stats {
  spend: number | null; reached: number; engaged: number; high: number; qualified: number;
  costEngaged: number | null; costHigh: number | null; costQualified: number | null; warming: number;
}

interface Row extends Stats {
  id: string; name: string; status: string; objectiveType: string; activity: string; activitySource: ActivitySource;
}

interface Group extends Stats { key: string; label: string; rows: Row[] }

const GROUP_BY: { value: GroupBy; label: string }[] = [
  { value: 'both', label: 'Objective + activity' },
  { value: 'objective', label: 'Objective' },
  { value: 'activity', label: 'Activity' },
  { value: 'none', label: 'No grouping' },
];

const per = (spend: number | null, n: number) => (spend !== null && spend > 0 && n > 0 ? spend / n : null);
const money = (n: number | null) => (n === null ? '—' : n.toLocaleString(undefined, { maximumFractionDigits: n < 100 ? 2 : 0 }));
const fmtObjective = (o: string) => o.toLowerCase().replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

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

export function CampaignScorecard({ selectedAccount, lookback, ready, breakdown, loading, error, load, movers }: {
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
        id: c.id, name: c.name, status: c.status, objectiveType: c.objectiveType, activity, activitySource: source, spend, ...t,
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
    }).sort((a, b) => (groupBy === 'activity' ? cmp(a, b) : a.label.localeCompare(b.label)));
  }, [current, rows, groupBy, sortKey, warmingKeys]);
  const sorted = groups.flatMap((g) => g.rows);

  const exportCsv = () => exportToCSV(
    sorted.map((r) => ({
      campaign: r.name, campaign_id: r.id, objective: r.objectiveType, activity: r.activity, activity_from: r.activitySource, status: r.status, spend: r.spend ?? '',
      companies_reached: r.reached, companies_engaged: r.engaged, companies_high_engagement: r.high, qualified_leads: r.qualified,
      cost_per_engaged_company: r.costEngaged ?? '', cost_per_high_engagement_company: r.costHigh ?? '', cost_per_qualified_lead: r.costQualified ?? '',
      ...(warmingKeys ? { warming_or_new_accounts_reached: r.warming } : {}),
    })),
    `campaign-scorecard-${selectedAccount}-${lookback}`,
  );

  const Th = ({ k, children, title }: { k: SortKey; children: string; title?: string }) => (
    <th className="px-2 py-2 text-right font-medium whitespace-nowrap" title={title}>
      <button onClick={() => setSortKey(k)} className={sortKey === k ? 'text-foreground' : 'hover:text-foreground'}>
        {children}{sortKey === k ? (k.startsWith('cost') ? ' ↑' : ' ↓') : ''}
      </button>
    </th>
  );

  const outside = current?.meta.spendOutside;

  return (
    <WidgetCard
      title="Campaign scorecard"
      subtitle="What each campaign pays per engaged company, per highly engaged company and per qualified lead"
      toolbar={
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap hidden md:inline" title="Change it in Engaged companies below">{lookback.replace(/^LAST_(\d+)_DAYS$/, '$1d')} · set in Engaged companies</span>
          {current && rows.length > 0 && (
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
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground">Group by</span>
              <SegmentedControl size="sm" options={GROUP_BY} value={groupBy} onChange={setGroupBy} />
            </div>
          )}
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
                {groups.map((g) => (
                  <Fragment key={g.key}>
                    {groupBy !== 'none' && (
                      <tr className="border-t border-border/60 bg-secondary/30 font-semibold">
                        <td className="px-3 py-1.5">
                          <div className="truncate" title={g.label}>{g.label}</div>
                          <div className="text-[11px] font-normal text-muted-foreground">{g.rows.length} campaign{g.rows.length === 1 ? '' : 's'} · companies counted once</div>
                        </td>
                        <StatCells s={g} hasSpend={hasSpend} warming={!!warmingKeys} />
                      </tr>
                    )}
                    {g.rows.map((r) => (
                      <tr key={r.id} className="border-t border-border/40">
                        <td className={`py-1.5 pr-3 ${groupBy === 'none' ? 'pl-3' : 'pl-6'}`}>
                          <div className="font-medium truncate" title={r.name}>{r.name}</div>
                          <div className="text-[11px] text-muted-foreground truncate" title={r.activitySource === 'name' ? 'Activity inferred from the campaign name' : undefined}>
                            {[
                              (groupBy === 'activity' || groupBy === 'none') && fmtObjective(r.objectiveType),
                              (groupBy === 'objective' || groupBy === 'none') ? `${r.activity}${r.activitySource === 'name' ? ' (by name)' : ''}` : r.activitySource === 'name' && 'activity by name',
                              levelLabel(r.status),
                            ].filter(Boolean).join(' · ')}
                          </div>
                        </td>
                        <StatCells s={r} hasSpend={hasSpend} warming={!!warmingKeys} />
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Companies and levels come from Company Intelligence per campaign; spend comes from Ad Analytics for the same number of days ending today, in the account's currency, and can be off by a day at the edges.
            Costs aren't comparable across objectives (awareness buys reach, lead gen buys leads), so campaigns are grouped by objective and activity, cheapest cost per engaged company first; group rows count each company once.
            Activity comes from the LinkedIn ad format (message ads, video, carousel, CTV when flagged), else from the campaign name: thought leadership can only come from the name (&quot;TL&quot;, &quot;thought leader&quot;), because LinkedIn doesn&apos;t expose the post author to this app.
            A company engaging with several campaigns counts in each. LinkedIn can't split decision makers by campaign.
            {' '}{warmingKeys ? 'Movers = companies in Account momentum (warming up or newly engaged, last 30 days) that this campaign reached in the selected window.' : 'Run Account momentum above to see which campaigns reach the accounts that are warming up.'}
          </p>
        </div>
      )}
    </WidgetCard>
  );
}
