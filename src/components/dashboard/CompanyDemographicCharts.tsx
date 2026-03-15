import { useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LabelList,
} from 'recharts';
import { CompanyDemographicItem } from '@/hooks/useCompanyDemographic';

// Design system colors (from ui-ux-pro-max analytics dashboard palette)
const PRIMARY = '#2563EB';

const ENRICHMENT_COLORS: Record<string, string> = {
  resolved:   '#22c55e',
  fallback:   '#f59e0b',
  unresolved: '#94a3b8',
};

function SpendTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { fullName: string; spent: number; enrichmentStatus: string } }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-md text-sm min-w-[160px]">
      <p className="font-medium text-foreground mb-1 truncate max-w-[220px]">{d.fullName}</p>
      <p className="text-muted-foreground">
        Spent:{' '}
        <span className="tabular-nums font-semibold text-foreground">
          ${d.spent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </p>
      <p className="text-xs text-muted-foreground capitalize mt-0.5">{d.enrichmentStatus}</p>
    </div>
  );
}

function EnrichmentTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { pct: string } }> }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-md text-sm space-y-0.5">
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">{p.name}</span>
          <span className="tabular-nums font-semibold">{p.value} <span className="font-normal text-muted-foreground">({p.payload.pct}%)</span></span>
        </div>
      ))}
    </div>
  );
}

interface CompanyDemographicChartsProps {
  data: CompanyDemographicItem[];
}

export function CompanyDemographicCharts({ data }: CompanyDemographicChartsProps) {
  const top10BySpend = useMemo(() => {
    return [...data]
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 10)
      .map((item, i) => ({
        name: item.entityName.length > 28 ? item.entityName.slice(0, 25) + '…' : item.entityName,
        fullName: item.entityName,
        spent: Number(item.spent.toFixed(2)),
        enrichmentStatus: item.enrichmentStatus,
        opacity: 1 - i * 0.055,
      }));
  }, [data]);

  // Stacked 100% bar data (AA accessibility — better than donut's B grade per ui-ux-pro-max)
  const enrichmentBarData = useMemo(() => {
    const counts = { resolved: 0, fallback: 0, unresolved: 0 };
    data.forEach(c => {
      if (c.enrichmentStatus === 'resolved') counts.resolved++;
      else if (c.enrichmentStatus === 'fallback') counts.fallback++;
      else counts.unresolved++;
    });
    const total = data.length || 1;
    return [{
      resolved:   counts.resolved,
      fallback:   counts.fallback,
      unresolved: counts.unresolved,
      resolvedPct:   ((counts.resolved   / total) * 100).toFixed(0),
      fallbackPct:   ((counts.fallback   / total) * 100).toFixed(0),
      unresolvedPct: ((counts.unresolved / total) * 100).toFixed(0),
      pct: '100',
    }];
  }, [data]);

  if (data.length === 0) return null;

  return (
    <Tabs defaultValue="top_spend" className="w-full">
      <TabsList className="mb-6 h-9">
        <TabsTrigger value="top_spend" className="text-sm">Top Companies by Spend</TabsTrigger>
        <TabsTrigger value="enrichment" className="text-sm">Enrichment Breakdown</TabsTrigger>
      </TabsList>

      <TabsContent value="top_spend">
        {top10BySpend.length > 0 ? (
          <>
            <p className="text-xs text-muted-foreground mb-4">Top 10 companies ranked by total ad spend</p>
            <ResponsiveContainer width="100%" height={340}>
              <BarChart
                data={top10BySpend}
                layout="vertical"
                margin={{ left: 16, right: 40, top: 4, bottom: 4 }}
              >
                <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="hsl(214 32% 91%)" />
                <XAxis
                  type="number"
                  tickFormatter={(v) =>
                    Number(v) >= 1000 ? `$${(Number(v) / 1000).toFixed(0)}k` : `$${Number(v)}`
                  }
                  tick={{ fontSize: 11, fill: 'hsl(215 16% 47%)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={164}
                  tick={{ fontSize: 11, fill: 'hsl(222 47% 11%)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<SpendTooltip />} cursor={{ fill: 'hsl(210 20% 96%)' }} />
                <Bar dataKey="spent" radius={[0, 4, 4, 0]} maxBarSize={22} fill={PRIMARY}>
                  <LabelList
                    dataKey="spent"
                    position="right"
                    style={{ fontSize: 11, fill: 'hsl(215 16% 47%)' }}
                    formatter={(v: number) =>
                      v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(0)}`
                    }
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">No spend data available</p>
        )}
      </TabsContent>

      {/* Enrichment: stacked 100% bar (AA accessibility, better than donut B grade) */}
      <TabsContent value="enrichment">
        <div className="space-y-6">
          <p className="text-xs text-muted-foreground">
            Company enrichment status — {data.length} total companies
          </p>

          {/* Stacked 100% bar */}
          <ResponsiveContainer width="100%" height={72}>
            <BarChart data={enrichmentBarData} layout="vertical" margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
              <XAxis type="number" domain={[0, data.length]} hide />
              <YAxis type="category" hide />
              <Tooltip content={<EnrichmentTooltip />} cursor={false} />
              <Bar dataKey="resolved"   stackId="a" fill={ENRICHMENT_COLORS.resolved}   radius={[4, 0, 0, 4]} maxBarSize={40}>
                <LabelList dataKey="resolvedPct"   position="center" style={{ fontSize: 12, fill: '#fff', fontWeight: 600 }} formatter={(v: string) => v !== '0' ? `${v}%` : ''} />
              </Bar>
              <Bar dataKey="fallback"   stackId="a" fill={ENRICHMENT_COLORS.fallback}   radius={[0, 0, 0, 0]} maxBarSize={40}>
                <LabelList dataKey="fallbackPct"   position="center" style={{ fontSize: 12, fill: '#fff', fontWeight: 600 }} formatter={(v: string) => v !== '0' ? `${v}%` : ''} />
              </Bar>
              <Bar dataKey="unresolved" stackId="a" fill={ENRICHMENT_COLORS.unresolved} radius={[0, 4, 4, 0]} maxBarSize={40}>
                <LabelList dataKey="unresolvedPct" position="center" style={{ fontSize: 12, fill: '#fff', fontWeight: 600 }} formatter={(v: string) => v !== '0' ? `${v}%` : ''} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Legend with count + % — always visible (a11y requirement) */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { key: 'resolved',   label: 'Resolved',   color: ENRICHMENT_COLORS.resolved,   count: enrichmentBarData[0].resolved,   pct: enrichmentBarData[0].resolvedPct },
              { key: 'fallback',   label: 'Fallback',   color: ENRICHMENT_COLORS.fallback,   count: enrichmentBarData[0].fallback,   pct: enrichmentBarData[0].fallbackPct },
              { key: 'unresolved', label: 'Unresolved', color: ENRICHMENT_COLORS.unresolved, count: enrichmentBarData[0].unresolved, pct: enrichmentBarData[0].unresolvedPct },
            ].map(item => (
              <div key={item.key} className="rounded-lg border border-border/50 bg-card/50 px-4 py-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: item.color }} />
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                </div>
                <p className="text-xl font-bold tabular-nums">{item.count}</p>
                <p className="text-xs text-muted-foreground tabular-nums">{item.pct}% of total</p>
              </div>
            ))}
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
