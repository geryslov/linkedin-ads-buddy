import ReactMarkdown from 'react-markdown';
import { DollarSign, Eye, MousePointer, Users, BarChart2, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { KpiSnapshot } from '@/lib/serializeReportForClaude';

interface Props {
  clientName: string;
  weekStart: string;
  weekEnd: string;
  publishedAt: string;
  narrativeMarkdown: string;
  kpiSnapshot: KpiSnapshot;
  agencyLabel?: string;
}

function fmt$0(v: number) {
  if (!v) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
}
function fmt$2(v: number) {
  if (!v) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(v);
}
function fmtNum(v: number) {
  return v.toLocaleString('en-US');
}
function fmtPct(v: number) {
  return `${v.toFixed(2)}%`;
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function DeltaBadge({ pct, lowerIsBetter }: { pct: number | null; lowerIsBetter?: boolean }) {
  if (pct === null || !isFinite(pct)) return <span className="text-xs text-muted-foreground">—</span>;
  const isPositive = pct >= 0;
  const isGood = lowerIsBetter ? !isPositive : isPositive;
  const Icon = isPositive ? TrendingUp : TrendingDown;
  return (
    <span className={cn('flex items-center gap-0.5 text-xs font-medium tabular-nums whitespace-nowrap',
      isGood ? 'text-green-600' : 'text-red-500')}>
      <Icon className="h-3 w-3 shrink-0" />
      {isPositive ? '+' : ''}{pct.toFixed(1)}%
    </span>
  );
}

function KpiCard({ label, value, sub, pct, lowerIsBetter, icon: Icon }: {
  label: string; value: string; sub: string;
  pct: number | null; lowerIsBetter?: boolean;
  icon: React.ElementType;
}) {
  return (
    <div className="flex flex-col gap-1.5 p-4 rounded-lg border border-border/70 bg-card shadow-sm">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
        {label}
      </div>
      <div className="text-xl font-semibold tabular-nums text-foreground leading-none">{value}</div>
      <div className="text-[11px] text-muted-foreground tabular-nums">{sub}</div>
      <div className="flex items-center gap-1 text-[11px]">
        <span className="text-muted-foreground">WoW</span>
        <DeltaBadge pct={pct} lowerIsBetter={lowerIsBetter} />
      </div>
    </div>
  );
}

export function PublishedReportView({
  clientName, weekStart, weekEnd, publishedAt, narrativeMarkdown, kpiSnapshot, agencyLabel,
}: Props) {
  const { thisWeek, lastWeek, deltas } = kpiSnapshot;
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        {/* Header */}
        <header className="flex items-start justify-between flex-wrap gap-4 border-b border-border pb-6">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              {agencyLabel || 'LinkedIn Ads Report'}
            </p>
            <h1 className="text-2xl font-semibold text-foreground">{clientName}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Week of {formatDate(weekStart)} — {formatDate(weekEnd)}
            </p>
          </div>
        </header>

        {/* KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard label="Total Spent" value={fmt$0(thisWeek.spent)} sub={`vs. ${fmt$0(lastWeek.spent)}`} pct={deltas.spent} lowerIsBetter icon={DollarSign} />
          <KpiCard label="Impressions" value={fmtNum(thisWeek.impressions)} sub={`vs. ${fmtNum(lastWeek.impressions)}`} pct={deltas.impressions} icon={Eye} />
          <KpiCard label="Clicks" value={fmtNum(thisWeek.clicks)} sub={`vs. ${fmtNum(lastWeek.clicks)}`} pct={deltas.clicks} icon={MousePointer} />
          <KpiCard label="Leads" value={fmtNum(thisWeek.leads)} sub={`vs. ${fmtNum(lastWeek.leads)}`} pct={deltas.leads} icon={Users} />
          <KpiCard label="CTR" value={fmtPct(thisWeek.ctr)} sub={`vs. ${fmtPct(lastWeek.ctr)}`} pct={deltas.ctr} icon={BarChart2} />
          <KpiCard label="CPL" value={fmt$2(thisWeek.cpl)} sub={`vs. ${fmt$2(lastWeek.cpl)}`} pct={deltas.cpl} lowerIsBetter icon={DollarSign} />
        </div>

        {/* Narrative */}
        <article className="prose prose-sm dark:prose-invert max-w-none
          [&_h1]:text-lg [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-3
          [&_h2]:text-base [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:mb-2
          [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-1.5
          [&_p]:text-sm [&_p]:leading-relaxed
          [&_li]:text-sm [&_li]:leading-relaxed
          [&_ul]:space-y-1 [&_ol]:space-y-1
          [&_strong]:text-foreground
        ">
          <ReactMarkdown>{narrativeMarkdown}</ReactMarkdown>
        </article>

        {/* Footer */}
        <footer className="border-t border-border pt-4 text-xs text-muted-foreground">
          Published {formatDate(publishedAt)}. Prepared by {agencyLabel || 'LinkedIn Ads Buddy'}.
        </footer>
      </div>
    </div>
  );
}
