import { useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from 'recharts';
import { CompanyDemographicItem } from '@/hooks/useCompanyDemographic';

const PRIMARY = '#0077B5';

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

function EnrichmentTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-md text-sm">
      <p className="font-medium">{d.name}</p>
      <p className="text-muted-foreground tabular-nums">{d.value} companies</p>
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

  const enrichmentPieData = useMemo(() => {
    const counts = { resolved: 0, fallback: 0, unresolved: 0 };
    data.forEach(c => {
      if (c.enrichmentStatus === 'resolved') counts.resolved++;
      else if (c.enrichmentStatus === 'fallback') counts.fallback++;
      else counts.unresolved++;
    });
    return [
      { name: 'Resolved',   value: counts.resolved,   color: ENRICHMENT_COLORS.resolved },
      { name: 'Fallback',   value: counts.fallback,   color: ENRICHMENT_COLORS.fallback },
      { name: 'Unresolved', value: counts.unresolved, color: ENRICHMENT_COLORS.unresolved },
    ].filter(d => d.value > 0);
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
                <Bar dataKey="spent" radius={[0, 4, 4, 0]} maxBarSize={22}>
                  {top10BySpend.map((entry, i) => (
                    <Cell key={i} fill={PRIMARY} fillOpacity={entry.opacity} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">No spend data available</p>
        )}
      </TabsContent>

      <TabsContent value="enrichment">
        {enrichmentPieData.length > 0 ? (
          <div className="flex flex-col items-center gap-4">
            <p className="text-xs text-muted-foreground self-start">
              Company enrichment status — {data.length} total companies
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={enrichmentPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={68}
                  outerRadius={98}
                  dataKey="value"
                  paddingAngle={3}
                  strokeWidth={0}
                >
                  {enrichmentPieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<EnrichmentTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Custom legend row */}
            <div className="flex items-center justify-center gap-6 flex-wrap pb-2">
              {enrichmentPieData.map(item => {
                const pct = ((item.value / data.length) * 100).toFixed(0);
                return (
                  <div key={item.name} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: item.color }} />
                    <span className="text-sm text-muted-foreground">{item.name}</span>
                    <span className="text-sm font-semibold tabular-nums">{item.value}</span>
                    <span className="text-xs text-muted-foreground">({pct}%)</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">No enrichment data available</p>
        )}
      </TabsContent>
    </Tabs>
  );
}
