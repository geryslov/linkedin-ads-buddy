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

/** Stat tile in the MetricCard style — icon chip + small-caps label,
    hero number, trend badge, "vs. last week" subline. */
function KpiCard({ label, value, sub, pct, lowerIsBetter, icon: Icon }: {
  label: string; value: string; sub: string;
  pct: number | null; lowerIsBetter?: boolean;
  icon: React.ElementType;
}) {
  const hasDelta = pct !== null && isFinite(pct);
  const isPositive = hasDelta && pct >= 0;
  const isGood = lowerIsBetter ? !isPositive : isPositive;
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;

  return (
    <div
      className="group relative bg-card rounded-xl p-5 overflow-hidden border border-border/70 flex flex-col gap-4"
      style={{ boxShadow: 'var(--shadow-sm)' }}
    >
      {/* Corner wash — barely-there brand tint, top right */}
      <div
        aria-hidden
        className="absolute -top-10 -right-10 h-28 w-28 rounded-full opacity-[0.06] transition-opacity"
        style={{ background: 'var(--gradient-primary)' }}
      />

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 bg-primary/[0.07] border border-primary/10">
            <Icon className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground truncate">
            {label}
          </p>
        </div>
        {hasDelta && (
          <span
            className={cn(
              'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-semibold shrink-0 tabular-nums',
              isGood ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
            )}
          >
            <TrendIcon className="h-3 w-3" />
            {isPositive ? '+' : ''}{pct.toFixed(1)}%
          </span>
        )}
      </div>

      <div>
        <p className="text-[26px] font-bold tracking-tight tabular-nums text-foreground leading-none">
          {value}
        </p>
        <p className="text-[11px] text-muted-foreground tabular-nums mt-1.5">{sub}</p>
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
      <div className="max-w-3xl mx-auto px-6 py-16 space-y-12">
        {/* Header — editorial treatment */}
        <header className="border-b border-border pb-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary mb-3">
            {agencyLabel || 'LinkedIn Ads Report'}
          </p>
          <h1 className="font-display text-4xl sm:text-[2.75rem] font-semibold text-foreground leading-tight">
            {clientName}
          </h1>
          <p className="text-sm text-muted-foreground mt-3">
            Week of {formatDate(weekStart)} — {formatDate(weekEnd)}
          </p>
        </header>

        {/* KPI stat tiles */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <KpiCard label="Total Spent" value={fmt$0(thisWeek.spent)} sub={`vs. ${fmt$0(lastWeek.spent)} last week`} pct={deltas.spent} lowerIsBetter icon={DollarSign} />
          <KpiCard label="Impressions" value={fmtNum(thisWeek.impressions)} sub={`vs. ${fmtNum(lastWeek.impressions)} last week`} pct={deltas.impressions} icon={Eye} />
          <KpiCard label="Clicks" value={fmtNum(thisWeek.clicks)} sub={`vs. ${fmtNum(lastWeek.clicks)} last week`} pct={deltas.clicks} icon={MousePointer} />
          <KpiCard label="Leads" value={fmtNum(thisWeek.leads)} sub={`vs. ${fmtNum(lastWeek.leads)} last week`} pct={deltas.leads} icon={Users} />
          <KpiCard label="CTR" value={fmtPct(thisWeek.ctr)} sub={`vs. ${fmtPct(lastWeek.ctr)} last week`} pct={deltas.ctr} icon={BarChart2} />
          <KpiCard label="CPL" value={fmt$2(thisWeek.cpl)} sub={`vs. ${fmt$2(lastWeek.cpl)} last week`} pct={deltas.cpl} lowerIsBetter icon={DollarSign} />
        </section>

        {/* Narrative */}
        <article className="prose dark:prose-invert max-w-none
          [&_h1]:font-display [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:mt-10 [&_h1]:mb-4
          [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-10 [&_h2]:mb-3
          [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2
          [&_p]:text-[15px] [&_p]:leading-[1.75] [&_p]:text-foreground/85
          [&_li]:text-[15px] [&_li]:leading-[1.7] [&_li]:text-foreground/85
          [&_ul]:space-y-1.5 [&_ol]:space-y-1.5
          [&_strong]:text-foreground
        ">
          <ReactMarkdown>{narrativeMarkdown}</ReactMarkdown>
        </article>

        {/* Footer */}
        <footer className="border-t border-border pt-6 text-xs text-muted-foreground">
          Published {formatDate(publishedAt)}. Prepared by {agencyLabel || 'LinkedIn Ads Buddy'}.
        </footer>
      </div>
    </div>
  );
}
