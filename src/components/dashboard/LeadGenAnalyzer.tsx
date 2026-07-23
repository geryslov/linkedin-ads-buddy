import { useEffect, useRef, useState } from 'react';
import { useLeadGenAnalyzer } from '@/hooks/useLeadGenAnalyzer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Target, Users, DollarSign, TrendingDown, TrendingUp,
  ChevronDown, ChevronRight, Loader2, Send, CheckCircle2,
  Sparkles, RefreshCw, AlertTriangle, FileText, Tag, Zap,
  MousePointerClick, BarChart3,
} from 'lucide-react';
import {
  BarChart, Bar, ResponsiveContainer, XAxis, YAxis,
  Tooltip, Cell, CartesianGrid,
} from 'recharts';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import type { LeadGenForm, LeadGenFormCreative } from '@/hooks/useLeadGenAnalyzer';

interface LeadGenAnalyzerProps {
  accessToken: string | null;
  selectedAccount: string | null;
}

// CTA display helpers
const CTA_LABELS: Record<string, string> = {
  DOWNLOAD:         'Download',
  SIGN_UP:          'Sign Up',
  LEARN_MORE:       'Learn More',
  REGISTER:         'Register',
  REQUEST_DEMO:     'Request Demo',
  GET_QUOTE:        'Get Quote',
  SUBSCRIBE:        'Subscribe',
  APPLY_NOW:        'Apply Now',
  JOIN_NOW:         'Join Now',
  CONTACT_US:       'Contact Us',
  GET_STARTED:      'Get Started',
  WATCH_NOW:        'Watch Now',
};

function ctaLabel(cta: string) {
  return CTA_LABELS[cta] || cta.replace(/_/g, ' ');
}

function ctaColor(cta: string): string {
  if (['DOWNLOAD','GET_QUOTE','REQUEST_DEMO'].includes(cta)) return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
  if (['SIGN_UP','REGISTER','APPLY_NOW','JOIN_NOW'].includes(cta)) return 'bg-green-500/10 text-green-600 border-green-500/20';
  if (['SUBSCRIBE','LEARN_MORE'].includes(cta)) return 'bg-violet-500/10 text-violet-600 border-violet-500/20';
  return 'bg-muted text-muted-foreground border-border/60';
}

function TrendBadge({ value, invert }: { value: number; invert?: boolean }) {
  const isPos = invert ? value < 0 : value > 0;
  const isNeg = invert ? value > 0 : value < 0;
  const abs = Math.abs(value);
  if (abs < 1) return <span className="text-[11px] text-muted-foreground">—</span>;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums ${
      isPos ? 'text-green-600' : isNeg ? 'text-red-500' : 'text-muted-foreground'
    }`}>
      {isPos ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {abs.toFixed(0)}%
    </span>
  );
}

function TypingDots() {
  return (
    <div className="flex gap-1 items-center h-4">
      {[0, 1, 2].map(i => (
        <span key={i} className="h-1.5 w-1.5 rounded-full bg-primary/50 animate-bounce"
          style={{ animationDelay: `${i * 160}ms`, animationDuration: '900ms' }} />
      ))}
    </div>
  );
}

// CPL comparison bar chart (7d vs 30d per form)
function CplTrendChart({ forms }: { forms: LeadGenForm[] }) {
  const data = forms
    .filter(f => f.metrics.leads > 0)
    .slice(0, 8)
    .map(f => ({
      name: f.formName.length > 22 ? f.formName.slice(0, 22) + '…' : f.formName,
      'CPL 30d': +f.metrics.cpl.toFixed(2),
      'CPL 7d':  +f.metrics.last7d.cpl.toFixed(2),
    }));

  if (data.length === 0) return null;

  return (
    <div className="border border-border/60 rounded-lg p-4 bg-card">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">CPL: 7d vs 30d by Form</p>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.4)" />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
          <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `$${v}`} />
          <Tooltip
            contentStyle={{ fontSize: 11, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', color: 'hsl(var(--foreground))' }}
            formatter={(v: number) => [`$${v.toFixed(2)}`, '']}
          />
          <Bar dataKey="CPL 30d" fill="hsl(var(--muted-foreground)/0.5)" radius={[3, 3, 0, 0]} barSize={14} />
          <Bar dataKey="CPL 7d" fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} barSize={14} />
        </BarChart>
      </ResponsiveContainer>
      <div className="flex gap-4 mt-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-muted-foreground/50 inline-block" />30d avg</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-primary inline-block" />7d (recent)</span>
      </div>
    </div>
  );
}

// Audience horizontal bar chart
function AudienceBarChart({ items, label }: { items: Array<{ name: string; leads: number; cpl: number }>; label: string }) {
  if (items.length === 0) return null;
  const maxLeads = Math.max(...items.map(i => i.leads), 1);
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{label}</p>
      <div className="space-y-2">
        {items.slice(0, 6).map((item, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-28 text-[11px] text-muted-foreground truncate shrink-0">{item.name}</span>
            <div className="flex-1 h-4 bg-muted/30 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-primary/70 transition-all duration-700"
                style={{ width: `${(item.leads / maxLeads) * 100}%` }}
              />
            </div>
            <span className="w-12 text-right tabular-nums text-[11px] font-semibold">{item.leads}</span>
            <span className="w-16 text-right tabular-nums text-[11px] text-muted-foreground">${item.cpl.toFixed(0)} CPL</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Single form card
function FormCard({ form }: { form: LeadGenForm }) {
  const [expanded, setExpanded] = useState(false);
  const cplTrend = form.metrics.last30d.cpl > 0
    ? ((form.metrics.last7d.cpl - form.metrics.last30d.cpl) / form.metrics.last30d.cpl) * 100
    : 0;
  const isFatigued = cplTrend > 20;
  const isImproving = cplTrend < -10;

  // Pick the dominant CTA from top creative
  const topCta = form.creatives.find(c => c.cta)?.cta || '';

  return (
    <div className={cn(
      'border rounded-xl bg-card shadow-sm overflow-hidden',
      isFatigued ? 'border-red-500/25' : isImproving ? 'border-green-500/25' : 'border-border/60'
    )}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold truncate">{form.formName}</span>
              {topCta && (
                <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0.5 h-auto shrink-0', ctaColor(topCta))}>
                  {ctaLabel(topCta)}
                </Badge>
              )}
              {isFatigued && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 h-auto bg-red-500/8 border-red-500/25 text-red-600 shrink-0">
                  CPL Rising
                </Badge>
              )}
              {isImproving && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 h-auto bg-green-500/8 border-green-500/25 text-green-600 shrink-0">
                  Improving
                </Badge>
              )}
            </div>
            {form.headline && (
              <p className="text-[12px] text-muted-foreground mt-1 line-clamp-1 italic">
                "{form.headline}"
              </p>
            )}
          </div>
        </div>

        {/* Field tags */}
        {form.fields.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {form.fields.map((field, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-muted/50 border border-border/50 text-muted-foreground font-mono">
                <Tag className="h-2.5 w-2.5" />
                {field.replace(/_/g, ' ')}
              </span>
            ))}
            {form.fields.length > 5 && (
              <span className="text-[10px] text-muted-foreground px-1">+{form.fields.length - 5} more</span>
            )}
          </div>
        )}

        {/* Metric row */}
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            { label: 'Leads (30d)', value: form.metrics.leads.toLocaleString() },
            { label: 'CPL', value: `$${form.metrics.cpl.toFixed(2)}`, trend: cplTrend, invertTrend: true },
            { label: 'Spend', value: `$${form.metrics.spent.toFixed(0)}` },
            { label: 'Fill Rate', value: `${form.metrics.lgfRate.toFixed(0)}%` },
          ].map(({ label, value, trend, invertTrend }) => (
            <div key={label} className="bg-muted/20 rounded-lg px-2 py-2">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground/70 font-semibold">{label}</p>
              <p className="text-sm font-bold tabular-nums mt-0.5">{value}</p>
              {trend !== undefined && Math.abs(trend) >= 1 && (
                <div className="flex justify-center mt-0.5">
                  <TrendBadge value={trend} invert={invertTrend} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Collapsible creatives */}
      {form.creatives.length > 0 && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between px-4 py-2 border-t border-border/40 text-[11px] text-muted-foreground hover:bg-muted/20 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {form.creatives.length} creative{form.creatives.length > 1 ? 's' : ''} using this form
            </span>
            <span className="text-[10px]">Click to {expanded ? 'hide' : 'show'}</span>
          </button>

          {expanded && (
            <div className="border-t border-border/40 bg-muted/10">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-border/30 text-muted-foreground">
                    <th className="text-left px-4 py-2 font-semibold">Creative</th>
                    <th className="text-center px-2 py-2 font-semibold">CTA</th>
                    <th className="text-right px-2 py-2 font-semibold">Leads</th>
                    <th className="text-right px-2 py-2 font-semibold">CPL</th>
                    <th className="text-right px-3 py-2 font-semibold">CTR</th>
                  </tr>
                </thead>
                <tbody>
                  {form.creatives.map((c, i) => (
                    <tr key={i} className="border-b border-border/20 hover:bg-muted/10">
                      <td className="px-4 py-1.5 max-w-[200px]">
                        <span className="truncate block">{c.name}</span>
                        <span className={cn('text-[9px]', c.status === 'ACTIVE' ? 'text-green-600' : 'text-muted-foreground/60')}>
                          {c.status}
                        </span>
                      </td>
                      <td className="text-center px-2 py-1.5">
                        {c.cta ? (
                          <Badge variant="outline" className={cn('text-[9px] px-1 py-0 h-auto', ctaColor(c.cta))}>
                            {ctaLabel(c.cta)}
                          </Badge>
                        ) : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="text-right px-2 py-1.5 tabular-nums font-semibold">{c.leads}</td>
                      <td className={cn('text-right px-2 py-1.5 tabular-nums font-semibold', c.cpl > 0 ? '' : 'text-muted-foreground/40')}>
                        {c.cpl > 0 ? `$${c.cpl.toFixed(2)}` : '—'}
                      </td>
                      <td className="text-right px-3 py-1.5 tabular-nums text-muted-foreground">
                        {c.ctr.toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function LeadGenAnalyzer({ accessToken, selectedAccount }: LeadGenAnalyzerProps) {
  const {
    overviewData, isLoadingData, dataError,
    fetchAndAnalyze, askFollowUp,
    messages, isLoading, error, toolEvents, toolLabels, cancel,
  } = useLeadGenAnalyzer(accessToken);

  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Auto-fetch when account is selected
  useEffect(() => {
    if (selectedAccount && accessToken) {
      fetchAndAnalyze(selectedAccount);
    }
  }, [selectedAccount, accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll chat
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, toolEvents]);

  const handleRefresh = () => {
    if (selectedAccount) fetchAndAnalyze(selectedAccount);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    if (!q) return;
    setInput('');
    askFollowUp(q);
  };

  const followUpQuestions = [
    'Which form has the highest friction?',
    'Which creative/CTA drives lowest CPL?',
    'Which audience segments should I cut?',
    'How can I improve my CPL this week?',
    'Grade each form headline A/B/C/F',
  ];

  // Loading skeleton
  if (isLoadingData && !overviewData) {
    return (
      <div className="space-y-5 animate-in fade-in-50 duration-300">
        <div className="flex items-center gap-3 pb-1">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Target className="h-4.5 w-4.5 text-primary animate-pulse" />
          </div>
          <div>
            <p className="font-semibold text-sm">Loading lead gen data...</p>
            <p className="text-xs text-muted-foreground">Fetching forms, creatives, audience breakdown — 30d + 7d</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-[76px] rounded-lg" style={{ animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
        <Skeleton className="h-52 rounded-lg" />
        <div className="grid md:grid-cols-2 gap-4">
          <Skeleton className="h-48 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
        </div>
        <Skeleton className="h-80 rounded-lg" />
      </div>
    );
  }

  // Error state
  if (dataError && !overviewData) {
    return (
      <div className="border border-destructive/20 rounded-lg p-8 bg-destructive/5 text-center">
        <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-3" />
        <p className="font-medium text-destructive mb-1">Failed to load lead gen data</p>
        <p className="text-sm text-muted-foreground mb-4">{dataError}</p>
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
        </Button>
      </div>
    );
  }

  const s = overviewData?.summary;

  return (
    <div className="space-y-5">

      {/* ── KPI Strip ─────────────────────────────────────────────── */}
      {s && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Total Leads (30d)', value: s.totalLeads.toLocaleString(), sub: `${s.leads7d} last 7d`, icon: Target },
            { label: 'Avg CPL (30d)', value: `$${s.avgCpl.toFixed(2)}`, sub: s.cpl7d > 0 ? `$${s.cpl7d.toFixed(2)} (7d)` : undefined, icon: DollarSign },
            { label: 'Total Spend (30d)', value: `$${s.totalSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, icon: DollarSign },
            { label: 'Active Forms', value: s.totalForms.toString(), sub: `${s.totalCampaigns} campaigns`, icon: FileText },
            { label: 'Lead Rate', value: overviewData.forms.length > 0
              ? `${(overviewData.forms.reduce((acc, f) => acc + f.metrics.lgfRate, 0) / overviewData.forms.length).toFixed(0)}%`
              : '—',
              sub: 'avg form fill rate', icon: MousePointerClick },
          ].map(({ label, value, sub, icon: Icon }) => (
            <div key={label} className="border border-border/60 rounded-lg px-3.5 py-3 bg-card shadow-sm flex items-start gap-3">
              <div className="p-1.5 rounded-md bg-primary/7 border border-primary/10 mt-0.5 shrink-0">
                <Icon className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground leading-none">{label}</p>
                <p className="text-lg font-bold tabular-nums mt-1 leading-none">{value}</p>
                {sub && <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── CPL Trend Chart ─────────────────────────────────────── */}
      {overviewData && overviewData.forms.length > 0 && (
        <CplTrendChart forms={overviewData.forms} />
      )}

      {/* ── Form Cards ──────────────────────────────────────────── */}
      {overviewData && overviewData.forms.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Lead Gen Forms</h3>
            <span className="text-[11px] text-muted-foreground">{overviewData.forms.length} form{overviewData.forms.length > 1 ? 's' : ''} with activity</span>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {overviewData.forms.map(form => (
              <FormCard key={form.formUrn} form={form} />
            ))}
          </div>
        </div>
      )}

      {/* ── Creative CPL Table ──────────────────────────────────── */}
      {overviewData && overviewData.topCreativesByCpl.length > 0 && (
        <div className="border border-border/60 rounded-xl bg-card shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Top Creatives by CPL
            </h3>
            <span className="text-[11px] text-muted-foreground">Sorted cheapest → most expensive</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Creative</TableHead>
                <TableHead className="text-xs text-center">CTA</TableHead>
                <TableHead className="text-xs text-center">Form</TableHead>
                <TableHead className="text-xs text-right">Leads</TableHead>
                <TableHead className="text-xs text-right">CPL</TableHead>
                <TableHead className="text-xs text-right">CTR</TableHead>
                <TableHead className="text-xs text-right">Spend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overviewData.topCreativesByCpl.slice(0, 15).map((c, i) => (
                <TableRow key={i} className="text-xs hover:bg-muted/30">
                  <TableCell className="max-w-[200px] py-2">
                    <div className="truncate font-medium">{c.name}</div>
                    <div className={cn('text-[10px]', c.status === 'ACTIVE' ? 'text-green-600' : 'text-muted-foreground/60')}>
                      {c.status}
                    </div>
                  </TableCell>
                  <TableCell className="text-center py-2">
                    {c.cta ? (
                      <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0.5 h-auto', ctaColor(c.cta))}>
                        {ctaLabel(c.cta)}
                      </Badge>
                    ) : <span className="text-muted-foreground/40">—</span>}
                  </TableCell>
                  <TableCell className="text-center py-2 text-[10px] text-muted-foreground max-w-[100px]">
                    <span className="truncate block">{(c as any).formName}</span>
                  </TableCell>
                  <TableCell className="text-right py-2 tabular-nums font-semibold">{c.leads}</TableCell>
                  <TableCell className="text-right py-2 tabular-nums font-semibold text-primary">
                    ${c.cpl.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right py-2 tabular-nums text-muted-foreground">
                    {c.ctr.toFixed(2)}%
                  </TableCell>
                  <TableCell className="text-right py-2 tabular-nums text-muted-foreground">
                    ${c.spent.toFixed(0)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── Audience Insights ───────────────────────────────────── */}
      {overviewData && (
        overviewData.audienceInsights.byJobFunction.length > 0 ||
        overviewData.audienceInsights.bySeniority.length > 0
      ) && (
        <div className="border border-border/60 rounded-xl bg-card shadow-sm p-4">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-primary" />
            Audience Insights (30d)
          </h3>
          <div className="grid md:grid-cols-2 gap-6">
            <AudienceBarChart
              items={overviewData.audienceInsights.byJobFunction}
              label="By Job Function — leads / CPL"
            />
            <AudienceBarChart
              items={overviewData.audienceInsights.bySeniority}
              label="By Seniority — leads / CPL"
            />
          </div>
        </div>
      )}

      {/* ── AI Analysis Panel ───────────────────────────────────── */}
      <div className={cn(
        'border rounded-xl bg-card shadow-sm overflow-hidden transition-all duration-300',
        isLoading ? 'border-primary/40 shadow-[0_0_0_1px_hsl(221_83%_53%_/_0.08)]' : 'border-primary/20',
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-primary/10 bg-primary/[0.03]">
          <div className="flex items-center gap-2.5">
            <div className={cn('h-6 w-6 rounded-md flex items-center justify-center transition-colors', isLoading ? 'bg-primary/20' : 'bg-primary/10')}>
              <Sparkles className={cn('h-3.5 w-3.5 text-primary', isLoading && 'animate-pulse')} />
            </div>
            <span className="text-sm font-semibold">AI Lead Gen Analysis</span>
            {isLoading && (
              <div className="flex gap-0.5 items-center ml-0.5">
                {[0, 1, 2].map(i => (
                  <span key={i} className="h-1 w-1 rounded-full bg-primary/50 animate-bounce"
                    style={{ animationDelay: `${i * 160}ms`, animationDuration: '900ms' }} />
                ))}
              </div>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isLoadingData} className="h-7 text-xs">
            <RefreshCw className={cn('h-3 w-3 mr-1', isLoadingData && 'animate-spin')} />
            Re-analyze
          </Button>
        </div>

        {/* Streaming progress bar */}
        {isLoading && (
          <div className="h-0.5 bg-primary/10 overflow-hidden">
            <div className="h-full bg-primary/40 animate-pulse w-full" />
          </div>
        )}

        {/* Message scroll area */}
        <div className="relative">
          <div
            ref={scrollRef}
            className="h-[500px] overflow-y-auto scroll-smooth"
            style={{ scrollbarWidth: 'thin', scrollbarColor: 'hsl(var(--border)) transparent' }}
          >
            <div className="px-5 py-4 space-y-5">
              {messages.length === 0 && !isLoading && (
                <div className="h-full flex flex-col items-center justify-center py-20 text-center">
                  <div className="h-10 w-10 rounded-xl bg-primary/8 border border-primary/15 flex items-center justify-center mb-3">
                    <Target className="h-4.5 w-4.5 text-primary/60" />
                  </div>
                  <p className="text-sm text-muted-foreground">Lead gen analysis will appear here</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">CPL trends, form quality, creative performance, audience fit</p>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={msg.role === 'user' ? 'flex justify-end' : 'flex flex-col gap-0'}>
                  {msg.role === 'user' ? (
                    <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm max-w-[75%] shadow-sm">
                      {msg.content}
                    </div>
                  ) : (
                    <div className="rounded-2xl rounded-tl-sm bg-muted/30 border border-border/40 px-4 py-3.5">
                      <div className="prose prose-sm dark:prose-invert max-w-none
                        [&>*:first-child]:mt-0 [&>*:last-child]:mb-0
                        [&_h1]:text-base [&_h1]:font-bold [&_h1]:mt-5 [&_h1]:mb-2
                        [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-1.5
                        [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1
                        [&_li]:text-[13px] [&_p]:text-[13px] [&_p]:leading-relaxed
                        [&_strong]:text-foreground
                        [&_table]:text-xs [&_th]:py-1.5 [&_td]:py-1.5 [&_th]:px-2 [&_td]:px-2
                        [&_table]:border-collapse [&_th]:border [&_td]:border [&_th]:border-border/50 [&_td]:border-border/50
                        [&_th]:bg-muted/40 [&_th]:font-semibold
                        [&_code]:text-[12px] [&_code]:bg-muted [&_code]:px-1 [&_code]:rounded
                        [&_ul]:space-y-0.5 [&_ol]:space-y-0.5
                        [&_hr]:border-border/40
                      ">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Tool-call status badges */}
              {toolEvents.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  {toolEvents.map(evt => (
                    <div
                      key={evt.id}
                      className={cn(
                        'inline-flex items-center gap-2 text-[11px] px-3 py-1.5 rounded-full border w-fit transition-all duration-300',
                        evt.status === 'running'
                          ? 'bg-primary/5 border-primary/25 text-primary'
                          : evt.status === 'error'
                          ? 'bg-destructive/5 border-destructive/20 text-destructive/70 opacity-60'
                          : 'bg-green-500/5 border-green-500/20 text-green-600 dark:text-green-400 opacity-70',
                      )}
                    >
                      {evt.status === 'running' ? (
                        <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                      ) : evt.status === 'error' ? (
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                      ) : (
                        <CheckCircle2 className="h-3 w-3 shrink-0" />
                      )}
                      {toolLabels[evt.tool] ?? evt.tool.replace(/_/g, ' ')}
                    </div>
                  ))}
                </div>
              )}

              {isLoading && (messages.length === 0 || messages[messages.length - 1]?.role !== 'assistant') && (
                <div className="rounded-2xl rounded-tl-sm bg-muted/20 border border-border/30 px-4 py-3">
                  <TypingDots />
                </div>
              )}

              <div ref={endRef} />
            </div>
          </div>

          {/* Bottom gradient */}
          <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-card to-transparent pointer-events-none" />
        </div>

        {/* Follow-up pills */}
        {messages.length > 0 && !isLoading && (
          <div className="px-5 py-3 border-t border-border/40 bg-muted/10">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">Follow-up</p>
            <div className="flex flex-wrap gap-1.5">
              {followUpQuestions.map(q => (
                <button
                  key={q}
                  onClick={() => setInput(q)}
                  className="text-[11px] px-2.5 py-1 rounded-full border border-border/60 text-muted-foreground
                    hover:bg-primary/5 hover:border-primary/30 hover:text-foreground transition-all duration-150 cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="mx-5 mb-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2 flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSubmit} className="flex gap-2 px-4 py-3 border-t border-border/40 bg-muted/5">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about CPL, forms, creatives, audience — or anything lead gen..."
            disabled={isLoading || isLoadingData}
            className="flex-1 h-9 text-sm"
          />
          {isLoading ? (
            <Button type="button" size="icon" variant="ghost" onClick={cancel} className="h-9 w-9 text-muted-foreground hover:text-destructive">
              <Loader2 className="h-4 w-4 animate-spin" />
            </Button>
          ) : (
            <Button type="submit" size="icon" disabled={!input.trim()} className="h-9 w-9">
              <Send className="h-4 w-4" />
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}
