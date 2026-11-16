import { useState } from 'react';
import { WidgetCard, EmptyState, StatusPill, SegmentedControl } from '@/components/dashboard/widgets';
import { Button } from '@/components/ui/button';
import { exportToCSV } from '@/lib/exportUtils';
import { MOMENTUM_RULE, Momentum, rankMovers } from '@/lib/accountMovers';
import type { useAccountMovers } from '@/hooks/useAccountMovers';
import { CompanyLogo, ERROR_HELP, LEVEL_TONE, SENIORITIES, SIZE_LABELS, levelLabel } from '@/components/dashboard/CompanyIntelligenceTable';
import { Activity, AlertTriangle, Download, Loader2, RefreshCw } from 'lucide-react';

const TABS: { value: Momentum; label: string; hint: string }[] = [
  { value: 'warming', label: 'Warming up', hint: 'Engaging faster than before. Hand these to sales.' },
  { value: 'new', label: 'Newly engaged', hint: 'First engagement in the last 30 days.' },
  { value: 'cooling', label: 'Cooling down', hint: 'Engagement is fading. Retarget or check in.' },
];

const PAGE = 25;

const change = (recent: number, prior: number) => {
  const p = prior / 60;
  if (!p) return recent ? 'from 0' : '—';
  const pct = Math.round(((recent / 30) / p - 1) * 100);
  return `${pct > 0 ? '+' : ''}${pct}%`;
};

export function AccountMovers({ selectedAccount, ready, state }: {
  selectedAccount: string | null;
  ready: boolean;
  state: ReturnType<typeof useAccountMovers>;
}) {
  const { movers, isLoading, error, load } = state;
  const [tab, setTab] = useState<Momentum>('warming');
  const [showAll, setShowAll] = useState(false);
  const current = movers && movers.accountId === selectedAccount ? movers : null;
  const list = current ? rankMovers(current, tab) : [];
  const shown = showAll ? list : list.slice(0, PAGE);

  const exportCsv = () => exportToCSV(
    list.map((m) => ({
      company: m.company.companyName, website: m.company.companyWebsite, linkedin: m.company.companyPageUrl,
      size: SIZE_LABELS[m.company.companySize] ?? m.company.companySize, country: m.company.countryCode,
      momentum: m.momentum, level_30d: m.level30, level_90d: m.level90,
      engagements_30d: m.recent, engagements_prior_60d: m.prior, rate_change: change(m.recent, m.prior),
      decision_makers_90d: m.dm ? m.dmSeniorities.map((s) => SENIORITIES[s] || s).join(' ') || 'yes' : '',
    })),
    `account-movers-${tab}-${selectedAccount}`,
  );

  return (
    <WidgetCard
      title="Account momentum"
      subtitle="Which companies are warming up, newly engaged or cooling down: last 30 days vs the 60 days before"
      toolbar={
        <div className="flex items-center gap-2">
          {current && list.length > 0 && (
            <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-3.5 w-3.5" /><span className="ml-1.5">Export</span></Button>
          )}
          <Button size="sm" onClick={() => selectedAccount && load(selectedAccount)} disabled={isLoading || !ready}>
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            <span className="ml-1.5">{current ? 'Refresh' : 'Find movers'}</span>
          </Button>
        </div>
      }
    >
      {error ? (
        <div className="flex items-start gap-2 text-xs">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
          <div><span className="font-medium">{error.message}</span>{ERROR_HELP[error.kind] && <p className="text-muted-foreground mt-0.5">{ERROR_HELP[error.kind]}</p>}</div>
        </div>
      ) : !current ? (
        isLoading
          ? <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" />Comparing the last 30 and 90 days, plus decision makers…</div>
          : <EmptyState icon={Activity} title="Find accounts that are moving" description="Three Company Intelligence requests (30 days, 90 days, decision makers). Nothing is changed in LinkedIn." />
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Warming up', value: current.counts.warming },
              { label: 'Newly engaged', value: current.counts.new },
              { label: 'Cooling down', value: current.counts.cooling },
              { label: 'Decision makers engaged (90d)', value: current.dmError ? '—' : current.dmCompanies },
            ].map((k) => (
              <div key={k.label} className="rounded-lg border border-border/70 px-3 py-2">
                <div className="text-[11px] text-muted-foreground">{k.label}</div>
                <div className="text-lg font-bold tabular-nums">{typeof k.value === 'number' ? k.value.toLocaleString() : k.value}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <SegmentedControl size="sm" options={TABS.map((t) => ({ value: t.value, label: `${t.label} (${current.counts[t.value]})` }))} value={tab} onChange={(v) => { setTab(v); setShowAll(false); }} />
            <span className="text-xs text-muted-foreground">{TABS.find((t) => t.value === tab)?.hint}</span>
          </div>
          {(current.truncated || current.unknownPrior > 0 || current.dmError) && (
            <div className="text-xs text-muted-foreground space-y-1">
              {current.truncated && <p className="flex gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />LinkedIn returned more companies than one run reads (10,000), so some are missing.</p>}
              {current.unknownPrior > 0 && <p className="flex gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />{current.unknownPrior} compan{current.unknownPrior === 1 ? 'y is' : 'ies are'} in the 30-day data but missing from the 90-day data, so their earlier activity is unknown and they're left out.</p>}
              {current.dmError && <p className="flex gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />The decision-maker request failed ({current.dmError.message}), so the decision-maker flag is missing.</p>}
            </div>
          )}
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No companies in this group.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <table className="w-full text-xs table-fixed min-w-[760px]">
                <colgroup><col /><col className="w-[96px]" /><col className="w-[96px]" /><col className="w-[96px]" /><col className="w-[96px]" /><col className="w-[80px]" /><col className="w-[120px]" /></colgroup>
                <thead className="bg-secondary/60 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Company</th>
                    <th className="px-2 py-2 text-left font-medium whitespace-nowrap">Level 30d</th>
                    <th className="px-2 py-2 text-left font-medium whitespace-nowrap">Level 90d</th>
                    <th className="px-2 py-2 text-right font-medium whitespace-nowrap">Eng. 30d</th>
                    <th className="px-2 py-2 text-right font-medium whitespace-nowrap">Prior 60d</th>
                    <th className="px-2 py-2 text-right font-medium whitespace-nowrap" title="Daily engagement rate, last 30 days vs the 60 days before">Rate</th>
                    <th className="px-2 py-2 text-left font-medium whitespace-nowrap">Decision makers</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((m) => {
                    const c = m.company;
                    return (
                      <tr key={c.companyPageUrl || c.companyWebsite || c.companyName} className="border-t border-border/40">
                        <td className="px-3 py-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <CompanyLogo name={c.companyName} website={c.companyWebsite} />
                            <div className="min-w-0">
                              {c.companyPageUrl
                                ? <a href={c.companyPageUrl} target="_blank" rel="noreferrer" className="font-medium truncate block hover:underline" title={c.companyName}>{c.companyName}</a>
                                : <span className="font-medium truncate block" title={c.companyName}>{c.companyName}</span>}
                              <div className="text-[11px] text-muted-foreground truncate">
                                {[c.companyWebsite.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''), SIZE_LABELS[c.companySize], c.countryCode].filter(Boolean).join(' · ')}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-1.5">{m.level30 !== 'UNKNOWN' ? <StatusPill tone={LEVEL_TONE[m.level30] ?? 'neutral'} label={levelLabel(m.level30)} /> : <span className="text-muted-foreground">—</span>}</td>
                        <td className="px-2 py-1.5"><StatusPill tone={LEVEL_TONE[m.level90] ?? 'neutral'} label={levelLabel(m.level90)} /></td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{m.recent.toLocaleString()}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{m.prior.toLocaleString()}</td>
                        <td className={`px-2 py-1.5 text-right tabular-nums ${tab === 'cooling' ? 'text-warning' : 'text-success'}`}>{change(m.recent, m.prior)}</td>
                        <td className="px-2 py-1.5 text-[11px] text-muted-foreground truncate">{m.dm ? m.dmSeniorities.map((s) => SENIORITIES[s] || s).join(', ') || 'Yes' : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {list.length > PAGE && (
            <button className="text-xs text-primary hover:underline" onClick={() => setShowAll(!showAll)}>
              {showAll ? 'Show top 25' : `Show all ${list.length}`}
            </button>
          )}
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {MOMENTUM_RULE} Engagement levels are LinkedIn's, per window, for context only. Decision makers = Director and above engaging in the last 90 days, the only window LinkedIn offers for audience filters.
            {' '}Loaded {new Date(current.at).toLocaleTimeString()}.
          </p>
        </div>
      )}
    </WidgetCard>
  );
}
