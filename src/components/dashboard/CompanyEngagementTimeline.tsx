import { useEffect, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { WidgetCard, EmptyState, SegmentedControl, ChartLegend } from './widgets';
import {
  RefreshCw,
  Building2,
  Eye,
  MousePointerClick,
  Users,
  Download,
  AlertTriangle,
  Pencil,
  Check,
  X,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { useCompanyEngagementTimeline, CompanyTimeline } from '@/hooks/useCompanyEngagementTimeline';
import { TimeFrameSelector } from './TimeFrameSelector';
import { useToast } from '@/hooks/use-toast';
import { exportToCSV } from '@/lib/exportUtils';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type SortField = 'companyName' | 'impressions' | 'clicks' | 'leads' | 'spend' | 'ctr' | 'cpc' | 'cpm';
type SortDirection = 'asc' | 'desc';

// Helper function to normalize company URN and extract ID
function normalizeCompanyUrn(urn: string): { id: string | null } {
  if (!urn) return { id: null };
  const match = urn.match(/^urn:li:(organization|company|memberCompany):(\d+)$/);
  if (match) return { id: match[2] };
  const numericMatch = urn.match(/:(\d+)$/);
  return { id: numericMatch ? numericMatch[1] : null };
}

// Inline editing component for company names
function EditableCompanyName({
  company,
  onNameUpdate
}: {
  company: CompanyTimeline;
  onNameUpdate?: (orgId: string, name: string) => Promise<{ success: boolean }>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(company.companyName);
  const isUnresolved = company.companyName.startsWith('Company ');

  const handleSave = async () => {
    if (!editName.trim()) return;
    const { id } = normalizeCompanyUrn(company.companyUrn);
    if (id && onNameUpdate) {
      const result = await onNameUpdate(id, editName.trim());
      if (result.success) {
        setIsEditing(false);
      }
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          className="h-7 text-sm w-32"
          autoFocus
        />
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleSave}>
          <Check className="h-3 w-3" />
        </Button>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setIsEditing(false)}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className={isUnresolved ? 'text-muted-foreground' : ''}>
        {company.companyName}
      </span>
      {isUnresolved && onNameUpdate && (
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 opacity-50 hover:opacity-100"
          onClick={() => setIsEditing(true)}
          title="Edit company name"
        >
          <Pencil className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

interface CompanyEngagementTimelineProps {
  accessToken: string | null;
  selectedAccount: string | null;
}

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--chart-6))',
  'hsl(var(--chart-7))',
  'hsl(var(--chart-8))',
];

const CHART_TOOLTIP_STYLE = {
  fontSize: 12,
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  color: 'hsl(var(--foreground))',
};

const AXIS_TICK = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' };

function StatTile({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div
      className="bg-card border border-border/70 rounded-xl px-4 py-3"
      style={{ boxShadow: 'var(--shadow-xs)' }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground leading-none">{label}</p>
      <p className={cn('text-xl font-bold tabular-nums mt-1.5 leading-none', accent && 'text-primary')}>{value}</p>
    </div>
  );
}

export function CompanyEngagementTimeline({ accessToken, selectedAccount }: CompanyEngagementTimelineProps) {
  const {
    data,
    isLoading,
    error,
    fetchTimeline,
    dateRange,
    setDateRange,
    timeFrameOptions,
    setTimeFrame,
    selectedCompanies,
    toggleCompanySelection,
    selectAllCompanies,
    clearSelection,
    chartCompanies,
    chartData,
    updateCompanyName,
  } = useCompanyEngagementTimeline(accessToken);
  const { toast } = useToast();
  const [selectedTimeFrame, setSelectedTimeFrame] = useState('last_30_days');
  const [activeMetric, setActiveMetric] = useState<'impressions' | 'clicks' | 'leads'>('impressions');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('impressions');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const filteredAndSortedCompanies = useMemo(() => {
    if (!data?.topCompanies) return [];

    let filtered = data.topCompanies;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = data.topCompanies.filter(company =>
        company.companyName.toLowerCase().includes(query)
      );
    }

    return [...filtered].sort((a, b) => {
      let aValue: number | string;
      let bValue: number | string;

      switch (sortField) {
        case 'companyName':
          aValue = a.companyName;
          bValue = b.companyName;
          break;
        case 'impressions':
          aValue = a.totals.impressions;
          bValue = b.totals.impressions;
          break;
        case 'clicks':
          aValue = a.totals.clicks;
          bValue = b.totals.clicks;
          break;
        case 'leads':
          aValue = a.totals.leads;
          bValue = b.totals.leads;
          break;
        case 'spend':
          aValue = a.totals.spend;
          bValue = b.totals.spend;
          break;
        case 'ctr':
          aValue = a.totals.ctr;
          bValue = b.totals.ctr;
          break;
        case 'cpc':
          aValue = a.totals.clicks > 0 ? a.totals.spend / a.totals.clicks : 0;
          bValue = b.totals.clicks > 0 ? b.totals.spend / b.totals.clicks : 0;
          break;
        case 'cpm':
          aValue = a.totals.impressions > 0 ? (a.totals.spend / a.totals.impressions) * 1000 : 0;
          bValue = b.totals.impressions > 0 ? (b.totals.spend / b.totals.impressions) * 1000 : 0;
          break;
        default:
          aValue = a.totals.impressions;
          bValue = b.totals.impressions;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortDirection === 'asc'
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });
  }, [data?.topCompanies, searchQuery, sortField, sortDirection]);

  const tableTotals = useMemo(() => {
    return filteredAndSortedCompanies.reduce(
      (acc, company) => ({
        impressions: acc.impressions + company.totals.impressions,
        clicks: acc.clicks + company.totals.clicks,
        leads: acc.leads + company.totals.leads,
        spend: acc.spend + company.totals.spend,
      }),
      { impressions: 0, clicks: 0, leads: 0, spend: 0 }
    );
  }, [filteredAndSortedCompanies]);

  const totalCtr = tableTotals.impressions > 0 ? (tableTotals.clicks / tableTotals.impressions) * 100 : 0;
  const totalCpc = tableTotals.clicks > 0 ? tableTotals.spend / tableTotals.clicks : 0;
  const totalCpm = tableTotals.impressions > 0 ? (tableTotals.spend / tableTotals.impressions) * 1000 : 0;

  const SortButton = ({ field, children, align }: { field: SortField; children: React.ReactNode; align?: 'right' }) => (
    <button
      onClick={() => handleSort(field)}
      className={cn(
        'inline-flex items-center gap-1 font-semibold text-muted-foreground hover:text-foreground transition-colors',
        align === 'right' && 'flex-row-reverse'
      )}
    >
      {children}
      {sortField === field ? (
        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  );

  useEffect(() => {
    if (selectedAccount && accessToken) {
      fetchTimeline(selectedAccount);
    }
  }, [selectedAccount, accessToken, dateRange.start, dateRange.end, fetchTimeline]);

  const handleTimeFrameChange = (option: typeof timeFrameOptions[0]) => {
    setSelectedTimeFrame(option.value);
    setTimeFrame(option);
  };

  const handleRefresh = () => {
    if (selectedAccount) {
      fetchTimeline(selectedAccount);
    }
  };

  const handleExport = () => {
    if (!data?.topCompanies?.length) return;

    const exportData = data.topCompanies.map(c => ({
      companyName: c.companyName,
      totalImpressions: c.totals.impressions,
      totalClicks: c.totals.clicks,
      totalLeads: c.totals.leads,
      totalSpend: c.totals.spend.toFixed(2),
      ctr: c.totals.ctr.toFixed(2),
    }));

    const columns = [
      { key: 'companyName', label: 'Company' },
      { key: 'totalImpressions', label: 'Impressions' },
      { key: 'totalClicks', label: 'Clicks' },
      { key: 'totalLeads', label: 'Leads' },
      { key: 'totalSpend', label: 'Spend' },
      { key: 'ctr', label: 'CTR (%)' },
    ];

    exportToCSV(exportData, 'company_engagement_timeline', columns);
    toast({ title: 'Export successful', description: `${exportData.length} companies exported` });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-[400px] w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/[0.06] px-4 py-3">
        <p className="text-destructive text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Names Resolution Warning */}
      {data?.metadata?.namesResolutionFailed && (
        <div className="rounded-xl border border-warning/40 bg-warning/[0.07] px-4 py-3 flex gap-3">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-foreground">Some Company Names Unavailable</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              LinkedIn blocked automatic name resolution. Showing cached names and IDs for unknowns.
              Click the edit icon next to any "Company 12345" to set a name manually.
            </p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <TimeFrameSelector
          timeFrameOptions={timeFrameOptions}
          selectedTimeFrame={selectedTimeFrame}
          onTimeFrameChange={handleTimeFrameChange}
          timeGranularity="DAILY"
          onGranularityChange={() => {}}
          dateRange={dateRange}
          onCustomDateChange={(start, end) => {
            setDateRange({
              start: start.toISOString().split('T')[0],
              end: end.toISOString().split('T')[0],
            });
          }}
        />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} className="h-8 text-xs gap-1.5">
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh} className="h-8 text-xs gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Companies Reached" value={data?.summary?.totalCompanies || 0} />
        <StatTile label="Total Impressions" value={(data?.summary?.totalImpressions || 0).toLocaleString()} />
        <StatTile label="Total Clicks" value={(data?.summary?.totalClicks || 0).toLocaleString()} />
        <StatTile label="Total Leads" value={data?.summary?.totalLeads || 0} accent />
        <StatTile label="Total Spend" value={`$${(data?.summary?.totalSpend || 0).toFixed(2)}`} />
        <StatTile label="Days in Range" value={data?.summary?.daysInRange || 0} />
      </div>

      {/* Aggregate Timeline Chart */}
      <WidgetCard
        title="Daily Company Engagement"
        subtitle="Total engagement across all companies over time"
        toolbar={
          chartData.length > 0 ? (
            <ChartLegend
              items={[
                { label: 'Impressions', color: 'hsl(var(--chart-1))' },
                { label: 'Clicks', color: 'hsl(var(--chart-2))' },
                { label: 'Companies', color: 'hsl(var(--chart-3))' },
              ]}
            />
          ) : undefined
        }
      >
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorImpressions" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" />
              <XAxis
                dataKey="date"
                tick={AXIS_TICK}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return `${date.getMonth() + 1}/${date.getDate()}`;
                }}
              />
              <YAxis tick={AXIS_TICK} />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                labelFormatter={(label) => new Date(label).toLocaleDateString()}
                formatter={(value: number, name: string) => [
                  value.toLocaleString(),
                  name === 'totalImpressions' ? 'Impressions' :
                  name === 'totalClicks' ? 'Clicks' :
                  name === 'totalLeads' ? 'Leads' :
                  name === 'companyCount' ? 'Companies' : name
                ]}
              />
              <Area
                type="monotone"
                dataKey="totalImpressions"
                name="Impressions"
                stroke="hsl(var(--chart-1))"
                fill="url(#colorImpressions)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="totalClicks"
                name="Clicks"
                stroke="hsl(var(--chart-2))"
                fill="url(#colorClicks)"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="companyCount"
                name="Companies"
                stroke="hsl(var(--chart-3))"
                strokeWidth={2}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState
            icon={Building2}
            title="No data available"
            description="No engagement data for the selected period."
          />
        )}
      </WidgetCard>

      {/* Company Selection and Individual Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Company List */}
        <WidgetCard
          noPadding
          title="Compare Companies"
          subtitle="Select companies to chart"
          toolbar={
            <>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => {
                if (data?.topCompanies) {
                  const topFive = data.topCompanies.slice(0, 5).map(c => c.companyUrn);
                  topFive.forEach(urn => {
                    if (!selectedCompanies.has(urn)) {
                      toggleCompanySelection(urn);
                    }
                  });
                }
              }}>
                Top 5
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearSelection}>
                Clear
              </Button>
            </>
          }
        >
          <div className="max-h-[400px] overflow-y-auto px-5 pb-4">
            {data?.topCompanies?.map((company, idx) => (
              <div
                key={company.companyUrn}
                className="flex items-center gap-3 py-2 border-b border-border/60 last:border-0"
              >
                <Checkbox
                  checked={selectedCompanies.has(company.companyUrn)}
                  onCheckedChange={() => toggleCompanySelection(company.companyUrn)}
                />
                <div
                  className="w-2.5 h-2.5 rounded-[3px] shrink-0"
                  style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    <EditableCompanyName company={company} onNameUpdate={updateCompanyName} />
                  </div>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {company.totals.impressions.toLocaleString()} imp · {company.totals.clicks} clicks · {company.totals.leads} leads
                  </p>
                </div>
              </div>
            ))}
          </div>
        </WidgetCard>

        {/* Selected Companies Chart */}
        <WidgetCard
          className="lg:col-span-2"
          title="Company Comparison"
          subtitle="Daily trend for the selected companies"
          toolbar={
            <SegmentedControl
              size="sm"
              value={activeMetric}
              onChange={setActiveMetric}
              options={[
                {
                  value: 'impressions',
                  label: (
                    <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" />Impressions</span>
                  ),
                },
                {
                  value: 'clicks',
                  label: (
                    <span className="inline-flex items-center gap-1"><MousePointerClick className="h-3 w-3" />Clicks</span>
                  ),
                },
                {
                  value: 'leads',
                  label: (
                    <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />Leads</span>
                  ),
                },
              ]}
            />
          }
        >
          {chartCompanies.length > 0 && chartData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={330}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" />
                  <XAxis
                    dataKey="date"
                    tick={AXIS_TICK}
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      return `${date.getMonth() + 1}/${date.getDate()}`;
                    }}
                  />
                  <YAxis tick={AXIS_TICK} />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    labelFormatter={(label) => new Date(label).toLocaleDateString()}
                  />
                  {chartCompanies.map((company) => (
                    <Line
                      key={company.companyUrn}
                      type="monotone"
                      dataKey={`${company.companyName}_${activeMetric}`}
                      name={company.companyName}
                      stroke={CHART_COLORS[data?.topCompanies?.findIndex(c => c.companyUrn === company.companyUrn) % CHART_COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
              <ChartLegend
                className="mt-3"
                items={chartCompanies.map((company) => ({
                  label: company.companyName,
                  color: CHART_COLORS[data?.topCompanies?.findIndex(c => c.companyUrn === company.companyUrn) % CHART_COLORS.length],
                }))}
              />
            </>
          ) : (
            <EmptyState
              icon={Building2}
              title="No companies selected"
              description="Select companies from the list to compare their engagement over time."
            />
          )}
        </WidgetCard>
      </div>

      {/* Company Table */}
      <WidgetCard
        noPadding
        title="Company Engagement Summary"
        subtitle={`Top companies by total impressions · ${filteredAndSortedCompanies.length} companies`}
        toolbar={
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search companies…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-[200px] pl-8 text-sm"
            />
          </div>
        }
      >
        {filteredAndSortedCompanies.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent bg-secondary/40">
                <TableHead className="w-8">#</TableHead>
                <TableHead className="min-w-[200px]">
                  <SortButton field="companyName">Company</SortButton>
                </TableHead>
                <TableHead className="text-right">
                  <SortButton field="impressions" align="right">Impressions</SortButton>
                </TableHead>
                <TableHead className="text-right">
                  <SortButton field="clicks" align="right">Clicks</SortButton>
                </TableHead>
                <TableHead className="text-right">
                  <SortButton field="leads" align="right">Leads</SortButton>
                </TableHead>
                <TableHead className="text-right">
                  <SortButton field="spend" align="right">Spend</SortButton>
                </TableHead>
                <TableHead className="text-right">
                  <SortButton field="ctr" align="right">CTR</SortButton>
                </TableHead>
                <TableHead className="text-right">
                  <SortButton field="cpc" align="right">CPC</SortButton>
                </TableHead>
                <TableHead className="text-right">
                  <SortButton field="cpm" align="right">CPM</SortButton>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedCompanies.map((company, idx) => {
                const cpc = company.totals.clicks > 0 ? company.totals.spend / company.totals.clicks : 0;
                const cpm = company.totals.impressions > 0 ? (company.totals.spend / company.totals.impressions) * 1000 : 0;

                return (
                  <TableRow key={company.companyUrn} className="hover:bg-secondary/30 [&>td]:py-2.5">
                    <TableCell className="text-muted-foreground tabular-nums">{idx + 1}</TableCell>
                    <TableCell className="font-medium min-w-[200px]">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <EditableCompanyName company={company} onNameUpdate={updateCompanyName} />
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{company.totals.impressions.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">{company.totals.clicks.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium text-primary">{company.totals.leads}</TableCell>
                    <TableCell className="text-right tabular-nums">${company.totals.spend.toFixed(2)}</TableCell>
                    <TableCell className="text-right tabular-nums">{company.totals.ctr.toFixed(2)}%</TableCell>
                    <TableCell className="text-right tabular-nums">${cpc.toFixed(2)}</TableCell>
                    <TableCell className="text-right tabular-nums">${cpm.toFixed(2)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow className="bg-secondary/50 font-semibold">
                <TableCell></TableCell>
                <TableCell>Total ({filteredAndSortedCompanies.length} companies)</TableCell>
                <TableCell className="text-right tabular-nums">{tableTotals.impressions.toLocaleString()}</TableCell>
                <TableCell className="text-right tabular-nums">{tableTotals.clicks.toLocaleString()}</TableCell>
                <TableCell className="text-right tabular-nums font-medium text-primary">{tableTotals.leads.toLocaleString()}</TableCell>
                <TableCell className="text-right tabular-nums">${tableTotals.spend.toFixed(2)}</TableCell>
                <TableCell className="text-right tabular-nums">{totalCtr.toFixed(2)}%</TableCell>
                <TableCell className="text-right tabular-nums">${totalCpc.toFixed(2)}</TableCell>
                <TableCell className="text-right tabular-nums">${totalCpm.toFixed(2)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        ) : (
          <EmptyState
            icon={Building2}
            title="No company data"
            description="No company data available for the selected period."
          />
        )}
      </WidgetCard>
    </div>
  );
}
