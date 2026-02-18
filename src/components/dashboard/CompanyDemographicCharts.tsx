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
  Legend,
} from 'recharts';
import { CompanyDemographicItem } from '@/hooks/useCompanyDemographic';

interface CompanyDemographicChartsProps {
  data: CompanyDemographicItem[];
}

const ENRICHMENT_COLORS: Record<string, string> = {
  resolved: '#22c55e',
  fallback: '#eab308',
  unresolved: '#94a3b8',
};

const STATUS_BAR_COLORS: Record<string, string> = {
  resolved: '#22c55e',
  fallback: '#eab308',
  unresolved: '#94a3b8',
};

export function CompanyDemographicCharts({ data }: CompanyDemographicChartsProps) {
  const top10BySpend = useMemo(() => {
    return [...data]
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 10)
      .map(item => ({
        name: item.entityName.length > 25 ? item.entityName.slice(0, 22) + '...' : item.entityName,
        fullName: item.entityName,
        spent: Number(item.spent.toFixed(2)),
        enrichmentStatus: item.enrichmentStatus,
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
      { name: 'Resolved', value: counts.resolved },
      { name: 'Fallback', value: counts.fallback },
      { name: 'Unresolved', value: counts.unresolved },
    ].filter(d => d.value > 0);
  }, [data]);

  const pieColors = enrichmentPieData.map(d =>
    ENRICHMENT_COLORS[d.name.toLowerCase()] || '#94a3b8'
  );

  if (data.length === 0) return null;

  return (
    <Tabs defaultValue="top_spend" className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="top_spend">Top Companies by Spend</TabsTrigger>
        <TabsTrigger value="enrichment">Enrichment Breakdown</TabsTrigger>
      </TabsList>
      <TabsContent value="top_spend">
        {top10BySpend.length > 0 ? (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={top10BySpend} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
              <XAxis
                type="number"
                tickFormatter={(v) => `$${Number(v).toLocaleString()}`}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={150}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(v: number) => [`$${Number(v).toFixed(2)}`, 'Spent']}
                labelFormatter={(label, payload) => {
                  if (payload && payload[0]) {
                    return (payload[0].payload as { fullName: string }).fullName;
                  }
                  return label;
                }}
              />
              <Bar dataKey="spent" radius={[0, 4, 4, 0]}>
                {top10BySpend.map((entry, i) => (
                  <Cell key={i} fill={STATUS_BAR_COLORS[entry.enrichmentStatus] || '#94a3b8'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">No spend data to display</p>
        )}
      </TabsContent>
      <TabsContent value="enrichment">
        {enrichmentPieData.length > 0 ? (
          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={enrichmentPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={95}
                  dataKey="value"
                  nameKey="name"
                  paddingAngle={2}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {enrichmentPieData.map((_, i) => (
                    <Cell key={i} fill={pieColors[i]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => [v, 'Companies']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">No enrichment data to display</p>
        )}
      </TabsContent>
    </Tabs>
  );
}
