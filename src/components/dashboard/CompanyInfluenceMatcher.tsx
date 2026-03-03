import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCompanyDemographic, CampaignBreakdownItem, ObjectiveBreakdownItem } from '@/hooks/useCompanyDemographic';
import { useCreativeReporting, CreativeData } from '@/hooks/useCreativeReporting';
import {
  useCompanyInfluenceMatcher,
  MatchedCompany,
  MatchedObjective,
  InfluenceTab,
  isMatchedItem,
} from '@/hooks/useCompanyInfluenceMatcher';
import { useCompanyPeriodTrend } from '@/hooks/useCompanyPeriodTrend';
import { TimeFrameSelector } from '@/components/dashboard/TimeFrameSelector';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { exportToCSV, companyInfluenceColumns } from '@/lib/exportUtils';
import {
  Upload,
  Download,
  X,
  Search,
  Eye,
  MousePointerClick,
  DollarSign,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  Loader2,
  ArrowUpDown,
  ChevronRight,
  ChevronDown,
  Target,
  TrendingUp,
  Zap,
  Activity,
  Share2,
  Heart,
  BarChart3,
  Sparkles,
  ImageIcon,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';

interface CompanyInfluenceMatcherProps {
  accessToken: string | null;
  selectedAccount: string | null;
}

function fmtObj(s: string): string {
  return s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

/** Convert lazy-loaded ObjectiveBreakdownItem[] to MatchedObjective[] */
function toMatchedObjectives(items: ObjectiveBreakdownItem[]): MatchedObjective[] {
  return items.map(item => {
    const names: string[] = [];
    if (item.campaignNames) {
      for (const n of Object.values(item.campaignNames)) {
        if (n) names.push(n);
      }
    }
    return {
      objective: item.objective,
      impressions: item.impressions,
      clicks: item.clicks,
      landingPageClicks: item.landingPageClicks,
      spent: item.spent,
      leads: item.leads,
      engagements: item.engagements,
      ctr: item.ctr,
      cpc: item.cpc,
      cpm: item.cpm,
      campaignNames: names,
      campaignIds: item.campaignIds || [],
      campaignNamesMap: item.campaignNames || {},
    };
  });
}

function fmtCur(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtNum(n: number): string {
  return n.toLocaleString();
}

/** Mini metric cell for drill-down rows */
function MetricCell({ value, className = '' }: { value: string; className?: string }) {
  return (
    <td className={`px-3 py-2 text-right tabular-nums text-xs ${className}`}>{value}</td>
  );
}

export function CompanyInfluenceMatcher({ accessToken, selectedAccount }: CompanyInfluenceMatcherProps) {
  const {
    companyData,
    isLoading: isLoadingLinkedIn,
    timeGranularity,
    setTimeGranularity,
    dateRange,
    setDateRange,
    timeFrameOptions,
    setTimeFrame,
    fetchCompanyDemographic,
    fetchCampaignBreakdown,
    campaignBreakdownCache,
    loadingObjectives,
    fetchObjectiveBreakdowns,
    objectiveBreakdownCache,
    isLoadingObjectiveBreakdowns,
  } = useCompanyDemographic(accessToken);

  const {
    creativeData,
    isLoading: isLoadingCreatives,
    setDateRange: setCreativeDateRange,
    fetchCreativeAnalytics,
  } = useCreativeReporting(accessToken);

  const {
    isLoading: isLoadingTrend,
    fetchTrend,
    getCompanyTrend,
    getMatchedAggregateTrend,
  } = useCompanyPeriodTrend(accessToken);

  const [selectedTimeFrame, setSelectedTimeFrame] = useState('30d');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set());
  const [expandedObjectives, setExpandedObjectives] = useState<Set<string>>(new Set());
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());

  const {
    uploadedCompanies,
    csvHeaders,
    nameColumn,
    urlColumn,
    dateColumn,
    fileName,
    parseError,
    matched,
    unmatched,
    uniqueUploadedCount,
    matchedTotals,
    matchRate,
    avgCostPerLead,
    overallCtr,
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    sortField,
    sortDirection,
    handleSort,
    filteredData,
    parseCSV,
    clearUpload,
    updateColumnMapping,
    getExportData,
  } = useCompanyInfluenceMatcher(companyData);

  // Build campaign name → creatives map
  const creativeByCampaign = useMemo(() => {
    const map = new Map<string, CreativeData[]>();
    for (const c of creativeData) {
      const key = c.campaignName;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return map;
  }, [creativeData]);

  // Auto-fetch LinkedIn + creative data on mount
  // Trend fetch is deferred until main data loads to avoid Edge Function errors
  const [hasFetched, setHasFetched] = useState(false);
  const [trendEnabled, setTrendEnabled] = useState(false);
  useEffect(() => {
    if (selectedAccount && accessToken && !hasFetched) {
      setHasFetched(true);
      fetchCompanyDemographic(selectedAccount);
      setCreativeDateRange(dateRange);
      fetchCreativeAnalytics(selectedAccount);
    }
  }, [selectedAccount, accessToken, hasFetched, fetchCompanyDemographic, fetchCreativeAnalytics, setCreativeDateRange, dateRange]);

  // Fetch trend data only after main company data has loaded successfully
  useEffect(() => {
    if (companyData.length > 0 && selectedAccount && !trendEnabled) {
      setTrendEnabled(true);
      fetchTrend(selectedAccount);
    }
  }, [companyData.length, selectedAccount, trendEnabled, fetchTrend]);

  const handleFetch = useCallback(() => {
    if (selectedAccount) {
      fetchCompanyDemographic(selectedAccount);
      setCreativeDateRange(dateRange);
      fetchCreativeAnalytics(selectedAccount);
      setTrendEnabled(false); // re-trigger trend after data loads
    }
  }, [selectedAccount, fetchCompanyDemographic, fetchCreativeAnalytics, setCreativeDateRange, dateRange, fetchTrend]);

  const handleTimeFrameChange = useCallback((option: any) => {
    setSelectedTimeFrame(option.value);
    setTimeFrame(option);
  }, [setTimeFrame]);

  const handleCustomDateChange = useCallback((start: Date, end: Date) => {
    setSelectedTimeFrame('custom');
    setDateRange({ start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] });
  }, [setDateRange]);

  const handleFileSelect = useCallback((file: File) => {
    if (file && (file.type === 'text/csv' || file?.name.endsWith('.csv'))) {
      parseCSV(file);
    }
  }, [parseCSV]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); }, []);
  const handleDragLeave = useCallback(() => { setIsDragOver(false); }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
    e.target.value = '';
  }, [handleFileSelect]);

  const handleExport = useCallback(() => {
    exportToCSV(getExportData(dateRange), 'influence_match_results', companyInfluenceColumns);
  }, [getExportData, dateRange]);

  const toggleCompany = useCallback((key: string, m?: MatchedCompany) => {
    setExpandedCompanies(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        setExpandedObjectives(p => {
          const n = new Set(p);
          for (const k of n) { if (k.startsWith(key + '::')) n.delete(k); }
          return n;
        });
        setExpandedCampaigns(p => {
          const n = new Set(p);
          for (const k of n) { if (k.startsWith(key + '::')) n.delete(k); }
          return n;
        });
      } else {
        next.add(key);
        // If this company has no objectives (skipped for large accounts), trigger lazy load
        if (m && m.objectives.length === 0 && selectedAccount && !objectiveBreakdownCache.has(m.linkedin.entityUrn)) {
          fetchObjectiveBreakdowns(selectedAccount);
        }
      }
      return next;
    });
  }, [selectedAccount, objectiveBreakdownCache, fetchObjectiveBreakdowns]);

  const toggleObjective = useCallback((key: string, entityUrn: string, obj: MatchedObjective) => {
    setExpandedObjectives(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        // collapse campaigns under this objective
        setExpandedCampaigns(p => {
          const n = new Set(p);
          for (const k of n) { if (k.startsWith(key + '::')) n.delete(k); }
          return n;
        });
      } else {
        next.add(key);
        // Lazy-load campaign breakdown
        if (selectedAccount && obj.campaignIds.length > 0) {
          const cacheKey = `${entityUrn}::${obj.objective}`;
          if (!campaignBreakdownCache.has(cacheKey)) {
            fetchCampaignBreakdown(selectedAccount, entityUrn, obj.objective, obj.campaignIds, obj.campaignNamesMap);
          }
        }
      }
      return next;
    });
  }, [selectedAccount, campaignBreakdownCache, fetchCampaignBreakdown]);

  const toggleCampaign = useCallback((key: string) => {
    setExpandedCampaigns(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const SortHeader = ({ field, children }: { field: string; children: React.ReactNode }) => (
    <th
      className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none whitespace-nowrap"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field ? (
          <span className="text-[10px]">{sortDirection === 'asc' ? '↑' : '↓'}</span>
        ) : (
          <ArrowUpDown className="h-2.5 w-2.5 opacity-30" />
        )}
      </div>
    </th>
  );

  const hasData = uploadedCompanies.length > 0 && companyData.length > 0;
  const maxSpend = Math.max(...matched.map(m => m.linkedin.spent), 1);

  const tabOptions: { value: InfluenceTab; label: string; count: number }[] = [
    { value: 'matched', label: 'Influenced', count: matched.length },
    { value: 'unmatched', label: 'Not Reached', count: unmatched.length },
    { value: 'all', label: 'All', count: uniqueUploadedCount },
  ];

  /** Render the per-company expanded detail panel */
  const renderCompanyDetail = (m: MatchedCompany) => {
    const touchpoints = m.objectives.reduce((sum, o) => sum + o.campaignNames.length, 0);

    // Build trend chart data for this company
    const companyTrend = getCompanyTrend(m.linkedin.entityUrn);
    const trendChartData = companyTrend
      .filter(t => t.metrics !== null)
      .map(t => ({
        period: t.period === '7d' ? '7 Days' : t.period === '30d' ? '30 Days' : '90 Days',
        Impressions: t.metrics!.impressions,
        Clicks: t.metrics!.clicks,
        Spend: parseFloat(t.metrics!.spent.toFixed(2)),
        Leads: t.metrics!.leads,
      }));

    const hasTrendData = trendChartData.length > 0;

    return (
      <td colSpan={12} className="p-0">
        <div className="bg-muted/10 border-t border-b border-border/30 px-6 py-4 space-y-4">
          {/* Impact Trend + Key Insights side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Impact Trend Chart */}
            <div className="bg-background/60 rounded-lg p-4 border border-border/20">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold">Impact Trend</span>
                {isLoadingTrend && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
              </div>
              {hasTrendData ? (
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={trendChartData} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} width={45} />
                    <RechartsTooltip
                      contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid hsl(var(--border))' }}
                      formatter={(value: number, name: string) => {
                        if (name === 'Spend') return [`$${value.toLocaleString()}`, name];
                        return [value.toLocaleString(), name];
                      }}
                    />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="Impressions" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Clicks" fill="hsl(210 80% 55%)" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Leads" fill="hsl(150 60% 45%)" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[140px] text-xs text-muted-foreground">
                  {isLoadingTrend ? 'Loading trend data...' : 'No trend data available'}
                </div>
              )}
              {hasTrendData && (
                <div className="flex gap-3 mt-2 text-[10px] text-muted-foreground">
                  {companyTrend.filter(t => t.metrics).map(t => (
                    <span key={t.period}>
                      <span className="font-medium text-foreground">{t.period}:</span>{' '}
                      ${t.metrics!.spent.toFixed(0)} spend
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Key Insights */}
            <div className="bg-background/60 rounded-lg p-4 border border-border/20">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-xs font-semibold">Influence Insights</span>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Objectives</span>
                  <span className="font-medium">{m.objectives.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Campaign touchpoints</span>
                  <span className="font-medium">{touchpoints}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">LP Clicks</span>
                  <span className="font-medium">{fmtNum(m.linkedin.landingPageClicks)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Engagement Rate</span>
                  <span className="font-medium">{m.engagementRate.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reactions</span>
                  <span className="font-medium">{fmtNum(m.linkedin.reactions)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shares</span>
                  <span className="font-medium">{fmtNum(m.linkedin.shares)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Comments</span>
                  <span className="font-medium">{fmtNum(m.linkedin.comments)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Likes</span>
                  <span className="font-medium">{fmtNum(m.linkedin.likes)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CPC</span>
                  <span className="font-medium">{m.linkedin.clicks > 0 ? fmtCur(m.linkedin.spent / m.linkedin.clicks) : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CPM</span>
                  <span className="font-medium">{m.linkedin.impressions > 0 ? fmtCur((m.linkedin.spent / m.linkedin.impressions) * 1000) : '—'}</span>
                </div>
              </div>
              {m.uploadedEntries.length > 1 && (
                <div className="mt-2 pt-2 border-t border-border/20 text-[11px] text-muted-foreground">
                  CSV dates: {m.uploadedEntries.map(e => e.date).filter(Boolean).join(', ')}
                </div>
              )}
            </div>
          </div>
        </div>
      </td>
    );
  };

  /** Render campaign rows under an objective */
  const renderCampaignRows = (
    companyKey: string,
    objIdx: number,
    entityUrn: string,
    obj: MatchedObjective,
  ) => {
    const objKey = `${companyKey}::${objIdx}`;
    const cacheKey = `${entityUrn}::${obj.objective}`;
    const campaigns: CampaignBreakdownItem[] = campaignBreakdownCache.get(cacheKey) || [];
    const isObjLoading = loadingObjectives.has(cacheKey);

    if (isObjLoading) {
      return (
        <tr key={`${objKey}::loading`} className="border-l-4 border-l-primary/10">
          <td colSpan={12} className="px-12 py-3 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin inline mr-2" />
            Loading campaign breakdown...
          </td>
        </tr>
      );
    }

    if (campaigns.length === 0) {
      return (
        <tr key={`${objKey}::empty`} className="border-l-4 border-l-primary/10">
          <td colSpan={12} className="px-12 py-2.5 text-xs text-muted-foreground italic">
            No per-campaign breakdown available
          </td>
        </tr>
      );
    }

    return campaigns.map((camp, cIdx) => {
      const campKey = `${objKey}::${cIdx}`;
      const isCampExpanded = expandedCampaigns.has(campKey);
      const creatives = creativeByCampaign.get(camp.campaignName) || [];
      const campCpl = camp.leads > 0 ? camp.spent / camp.leads : 0;

      return (
        <>
          {/* Campaign row */}
          <tr
            key={campKey}
            className={`border-l-4 border-l-blue-500/20 cursor-pointer hover:bg-muted/15 ${isCampExpanded ? 'bg-muted/10' : ''}`}
            onClick={(e) => { e.stopPropagation(); toggleCampaign(campKey); }}
          >
            <td className="w-8 px-3 py-2 pl-8">
              {creatives.length > 0 && (
                isCampExpanded
                  ? <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  : <ChevronRight className="h-3 w-3 text-muted-foreground" />
              )}
            </td>
            <td className="px-3 py-2" colSpan={2}>
              <div className="flex items-center gap-2 pl-8">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                <span className="text-xs truncate max-w-[220px]" title={camp.campaignName}>
                  {camp.campaignName}
                </span>
                {creatives.length > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    {creatives.length} creative{creatives.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </td>
            <MetricCell value={fmtNum(camp.impressions)} className="text-muted-foreground" />
            <MetricCell value={fmtNum(camp.clicks)} className="text-muted-foreground" />
            <MetricCell value={fmtCur(camp.spent)} className="text-muted-foreground" />
            <MetricCell value={camp.leads > 0 ? fmtNum(camp.leads) : '—'} className="text-muted-foreground" />
            <MetricCell value={fmtNum(camp.engagements)} className="text-muted-foreground" />
            <MetricCell value={`${camp.ctr.toFixed(2)}%`} className="text-muted-foreground" />
            <MetricCell value={campCpl > 0 ? fmtCur(campCpl) : '—'} className="text-muted-foreground" />
            <td />
          </tr>

          {/* Creative rows under campaign */}
          {isCampExpanded && creatives.map((cr, crIdx) => (
            <tr key={`${campKey}::cr${crIdx}`} className="border-l-4 border-l-purple-500/10" onClick={(e) => e.stopPropagation()}>
              <td className="w-8" />
              <td className="px-3 py-1.5" colSpan={2}>
                <div className="flex items-center gap-2 pl-14">
                  <ImageIcon className="h-3 w-3 text-purple-400 shrink-0" />
                  <span className="text-[11px] text-muted-foreground truncate max-w-[200px]" title={cr.creativeName}>
                    {cr.creativeName}
                  </span>
                  <Badge variant="outline" className="text-[9px] px-1 py-0 font-normal">
                    {cr.type.replace(/_/g, ' ')}
                  </Badge>
                </div>
              </td>
              <MetricCell value={fmtNum(cr.impressions)} className="text-muted-foreground/70" />
              <MetricCell value={fmtNum(cr.clicks)} className="text-muted-foreground/70" />
              <MetricCell value={fmtCur(cr.spent)} className="text-muted-foreground/70" />
              <MetricCell value={cr.leads > 0 ? fmtNum(cr.leads) : '—'} className="text-muted-foreground/70" />
              <MetricCell value="—" className="text-muted-foreground/70" />
              <MetricCell value={`${cr.ctr.toFixed(2)}%`} className="text-muted-foreground/70" />
              <MetricCell value={cr.costPerLead > 0 ? fmtCur(cr.costPerLead) : '—'} className="text-muted-foreground/70" />
              <td />
            </tr>
          ))}
        </>
      );
    });
  };

  return (
    <div className="space-y-6">
      {/* Setup Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LinkedIn Data */}
        <div className="glass rounded-xl p-5 animate-slide-up">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-blue-500/10">
                <Activity className="h-3.5 w-3.5 text-blue-500" />
              </div>
              LinkedIn Data
            </h3>
            <div className="flex items-center gap-1.5">
              {(isLoadingLinkedIn || isLoadingCreatives) && (
                <Badge variant="outline" className="animate-pulse text-[10px]">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  {isLoadingLinkedIn ? 'Companies...' : 'Creatives...'}
                </Badge>
              )}
              {!isLoadingLinkedIn && companyData.length > 0 && (
                <Badge variant="secondary" className="text-[10px]">
                  <CheckCircle2 className="h-3 w-3 mr-1 text-green-500" />
                  {companyData.length} companies
                </Badge>
              )}
              {!isLoadingCreatives && creativeData.length > 0 && (
                <Badge variant="secondary" className="text-[10px]">
                  <ImageIcon className="h-3 w-3 mr-1 text-purple-500" />
                  {creativeData.length} creatives
                </Badge>
              )}
            </div>
          </div>
          <div className="space-y-3">
            <TimeFrameSelector
              timeFrameOptions={timeFrameOptions}
              selectedTimeFrame={selectedTimeFrame}
              onTimeFrameChange={handleTimeFrameChange}
              timeGranularity={timeGranularity}
              onGranularityChange={setTimeGranularity}
              dateRange={dateRange}
              onCustomDateChange={handleCustomDateChange}
            />
            <div className="flex items-center gap-2">
              <Button onClick={handleFetch} disabled={isLoadingLinkedIn || isLoadingCreatives || !selectedAccount} variant="outline" size="sm">
                {(isLoadingLinkedIn || isLoadingCreatives) ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                )}
                {companyData.length > 0 ? 'Reload' : 'Fetch Data'}
              </Button>
              {!selectedAccount && <span className="text-xs text-muted-foreground">Select an ad account first</span>}
            </div>
          </div>
        </div>

        {/* CSV Upload */}
        <div className="glass rounded-xl p-5 animate-slide-up" style={{ animationDelay: '50ms' }}>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-orange-500/10">
              <FileSpreadsheet className="h-3.5 w-3.5 text-orange-500" />
            </div>
            Your Company List
          </h3>
          {!fileName ? (
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-all cursor-pointer ${
                isDragOver ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border/50 hover:border-primary/40 hover:bg-primary/[0.02]'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">Drop CSV here or click to browse</p>
              <p className="text-[11px] text-muted-foreground mt-1">Columns: Company Name, URL/Website/Email, Date</p>
              <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleInputChange} />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{fileName}</span>
                  <Badge variant="outline" className="text-xs">{uploadedCompanies.length} rows</Badge>
                  {uploadedCompanies.length !== uniqueUploadedCount && (
                    <Badge variant="secondary" className="text-xs">{uniqueUploadedCount} unique</Badge>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={clearUpload} className="h-7 w-7 p-0">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              {csvHeaders.length > 0 && (
                <div className="flex flex-wrap gap-2 text-xs">
                  {([
                    { label: 'Name', value: nameColumn, type: 'name' as const },
                    { label: 'URL/Email', value: urlColumn, type: 'url' as const },
                    { label: 'Date', value: dateColumn, type: 'date' as const },
                  ]).map(({ label, value, type }) => (
                    <div key={type} className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">{label}:</span>
                      <Select value={value || ''} onValueChange={(v) => updateColumnMapping(type, v || null)}>
                        <SelectTrigger className="w-[130px] h-7 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>{csvHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {parseError && (
            <div className="mt-2 text-xs text-destructive flex items-center gap-1.5">
              <XCircle className="h-3.5 w-3.5 shrink-0" />{parseError}
            </div>
          )}
        </div>
      </div>

      {/* Impact Summary */}
      {hasData && (
        <div className="animate-slide-up" style={{ animationDelay: '100ms' }}>
          <div className="glass rounded-xl p-5 mb-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-sm font-semibold">LinkedIn Influence Coverage</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {matched.length} of {uniqueUploadedCount} companies were reached by LinkedIn ads
                  <span className="text-muted-foreground/70"> ({dateRange.start} to {dateRange.end})</span>
                </p>
              </div>
              <div className="text-right">
                <span className="text-3xl font-bold tracking-tight">{matchRate}%</span>
                <p className="text-[11px] text-muted-foreground">match rate</p>
              </div>
            </div>
            <Progress value={matchRate} className="h-2" />
            <div className="flex justify-between mt-1.5 text-[11px] text-muted-foreground">
              <span>{matched.length} influenced</span>
              <span>{unmatched.length} not reached</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            <MetricCard title="Impressions" value={fmtNum(matchedTotals.impressions)} icon={Eye} delay={0} />
            <MetricCard title="Clicks" value={fmtNum(matchedTotals.clicks)} icon={MousePointerClick} delay={30} />
            <MetricCard title="Ad Spend" value={fmtCur(matchedTotals.spent)} icon={DollarSign} delay={60} />
            <MetricCard title="Leads" value={fmtNum(matchedTotals.leads)} icon={Target} delay={90} />
            <MetricCard title="CTR" value={`${overallCtr.toFixed(2)}%`} icon={TrendingUp} delay={120} />
            <MetricCard title="Cost/Lead" value={avgCostPerLead > 0 ? fmtCur(avgCostPerLead) : '—'} icon={Zap} delay={150} />
            <MetricCard title="Engagements" value={fmtNum(matchedTotals.engagements)} icon={Heart} delay={180} />
            <MetricCard title="Shares" value={fmtNum(matchedTotals.shares)} icon={Share2} delay={210} />
          </div>

          {/* Aggregate Impact Trend */}
          {(() => {
            const matchedUrns = matched.map(m => m.linkedin.entityUrn);
            const aggTrend = getMatchedAggregateTrend(matchedUrns);
            const hasAggTrend = aggTrend.some(t => t.totals.impressions > 0);

            if (!hasAggTrend && !isLoadingTrend) return null;

            const aggChartData = aggTrend.map(t => ({
              period: t.period === '7d' ? 'Last 7 Days' : t.period === '30d' ? 'Last 30 Days' : 'Last 90 Days',
              Impressions: t.totals.impressions,
              Clicks: t.totals.clicks,
              Leads: t.totals.leads,
              Spend: parseFloat(t.totals.spent.toFixed(2)),
              'Companies Reached': t.totals.companyCount,
            }));

            return (
              <div className="glass rounded-xl p-5 mt-4 animate-slide-up" style={{ animationDelay: '130ms' }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-primary/10">
                      <BarChart3 className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold">Influence Impact Trend</h3>
                      <p className="text-[11px] text-muted-foreground">Matched companies' aggregate metrics across time windows</p>
                    </div>
                  </div>
                  {isLoadingTrend && (
                    <Badge variant="outline" className="animate-pulse text-[10px]">
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />Loading trend...
                    </Badge>
                  )}
                </div>
                {hasAggTrend ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Impressions & Clicks trend */}
                    <div>
                      <p className="text-[11px] font-medium text-muted-foreground mb-2">Impressions & Clicks</p>
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={aggChartData} barGap={4}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                          <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} width={55} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                          <RechartsTooltip
                            contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid hsl(var(--border))' }}
                            formatter={(value: number) => [value.toLocaleString(), undefined]}
                          />
                          <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                          <Bar dataKey="Impressions" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                          <Bar dataKey="Clicks" fill="hsl(210 80% 55%)" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    {/* Spend & Leads trend */}
                    <div>
                      <p className="text-[11px] font-medium text-muted-foreground mb-2">Spend & Leads</p>
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={aggChartData} barGap={4}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                          <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} width={55} tickFormatter={(v) => v >= 1000 ? `$${(v/1000).toFixed(0)}k` : `$${v}`} />
                          <RechartsTooltip
                            contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid hsl(var(--border))' }}
                            formatter={(value: number, name: string) => {
                              if (name === 'Spend') return [`$${value.toLocaleString()}`, name];
                              return [value.toLocaleString(), name];
                            }}
                          />
                          <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                          <Bar dataKey="Spend" fill="hsl(30 80% 55%)" radius={[3, 3, 0, 0]} />
                          <Bar dataKey="Leads" fill="hsl(150 60% 45%)" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[180px] text-xs text-muted-foreground">
                    Loading trend data...
                  </div>
                )}
                {/* Period summary row */}
                {hasAggTrend && (
                  <div className="grid grid-cols-3 gap-4 mt-4 pt-3 border-t border-border/30">
                    {aggTrend.map(t => (
                      <div key={t.period} className="text-center">
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{t.label}</p>
                        <div className="flex items-center justify-center gap-3 mt-1.5 text-xs">
                          <span><span className="font-semibold">{t.totals.companyCount}</span> <span className="text-muted-foreground">companies</span></span>
                          <span className="text-muted-foreground">|</span>
                          <span><span className="font-semibold">{fmtCur(t.totals.spent)}</span> <span className="text-muted-foreground">spend</span></span>
                          <span className="text-muted-foreground">|</span>
                          <span><span className="font-semibold">{fmtNum(t.totals.leads)}</span> <span className="text-muted-foreground">leads</span></span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Results Table */}
      {hasData && (
        <div className="glass rounded-xl p-5 animate-slide-up" style={{ animationDelay: '150ms' }}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex gap-1">
              {tabOptions.map(tab => (
                <Button key={tab.value} variant={activeTab === tab.value ? 'default' : 'ghost'} size="sm" className="text-xs" onClick={() => setActiveTab(tab.value)}>
                  {tab.label}
                  <Badge variant={activeTab === tab.value ? 'outline' : 'secondary'} className="ml-1.5 text-[10px] px-1.5 py-0">{tab.count}</Badge>
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8 w-[180px] h-8 text-xs" />
              </div>
              <Button variant="outline" size="sm" className="text-xs h-8" onClick={handleExport} disabled={matched.length === 0}>
                <Download className="h-3.5 w-3.5 mr-1" />Export
              </Button>
            </div>
          </div>

          <div className="rounded-lg border overflow-auto max-h-[700px]">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 sticky top-0 z-10">
                <tr>
                  {activeTab !== 'unmatched' && <th className="w-8 px-3 py-2.5" />}
                  <SortHeader field="name">Company</SortHeader>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">Match</th>
                  <SortHeader field="impressions">Impr.</SortHeader>
                  <SortHeader field="clicks">Clicks</SortHeader>
                  <SortHeader field="spent">Spend</SortHeader>
                  <SortHeader field="leads">Leads</SortHeader>
                  <SortHeader field="engagements">Engage.</SortHeader>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground whitespace-nowrap">CTR</th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground whitespace-nowrap">CPL</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap min-w-[90px]">Share</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.length === 0 ? (
                  <tr><td colSpan={11} className="text-center py-12 text-muted-foreground text-sm">No results found</td></tr>
                ) : (
                  filteredData.map((item, idx) => {
                    const companyKey = isMatchedItem(item) ? item.linkedin.entityUrn : `unmatched-${idx}`;
                    const isExpanded = expandedCompanies.has(companyKey);
                    const m = isMatchedItem(item) ? item : null;

                    return (
                      <>
                        {/* Company Row */}
                        <tr
                          key={companyKey}
                          className={`border-b border-border/30 ${m ? 'cursor-pointer hover:bg-muted/30' : ''} ${isExpanded ? 'bg-muted/15' : ''}`}
                          onClick={m ? () => toggleCompany(companyKey, m) : undefined}
                        >
                          {activeTab !== 'unmatched' && (
                            <td className="w-8 px-3 py-3 pr-0">
                              {m && (
                                isExpanded
                                  ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                            </td>
                          )}
                          <td className="px-3 py-3">
                            <div className="min-w-[140px]">
                              <div className="font-medium text-sm truncate max-w-[220px]" title={m ? m.linkedin.entityName : item.uploaded.name}>
                                {m ? m.linkedin.entityName : item.uploaded.name || '—'}
                              </div>
                              <div className="text-[11px] text-muted-foreground truncate max-w-[220px]">
                                {m ? (m.linkedin.website || item.uploaded.url || '') : (item.uploaded.url || '')}
                              </div>
                              {m && m.uploadedEntries.length > 1 && (
                                <Badge variant="outline" className="text-[10px] mt-0.5 font-normal">{m.uploadedEntries.length} CSV entries</Badge>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            {m ? (
                              <Badge variant={m.matchType === 'name' ? 'default' : 'secondary'} className="text-[10px]">{m.matchType}</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-muted-foreground">—</Badge>
                            )}
                          </td>
                          <MetricCell value={m ? fmtNum(m.linkedin.impressions) : '—'} />
                          <MetricCell value={m ? fmtNum(m.linkedin.clicks) : '—'} />
                          <td className="px-3 py-3 text-right tabular-nums text-sm font-medium">{m ? fmtCur(m.linkedin.spent) : '—'}</td>
                          <td className="px-3 py-3 text-right tabular-nums text-sm">
                            {m ? (<span className={m.linkedin.leads > 0 ? 'text-green-600 font-medium' : ''}>{fmtNum(m.linkedin.leads)}</span>) : '—'}
                          </td>
                          <MetricCell value={m ? fmtNum(m.linkedin.engagements) : '—'} />
                          <MetricCell value={m ? `${m.linkedin.ctr.toFixed(2)}%` : '—'} />
                          <MetricCell value={m && m.costPerLead > 0 ? fmtCur(m.costPerLead) : '—'} />
                          <td className="px-3 py-3">
                            {m ? (
                              <div className="flex items-center gap-1.5 min-w-[70px]">
                                <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                                  <div className="h-full bg-primary/60 rounded-full" style={{ width: `${Math.max((m.linkedin.spent / maxSpend) * 100, 2)}%` }} />
                                </div>
                                <span className="text-[10px] text-muted-foreground tabular-nums w-7 text-right">
                                  {((m.linkedin.spent / matchedTotals.spent) * 100).toFixed(0)}%
                                </span>
                              </div>
                            ) : '—'}
                          </td>
                        </tr>

                        {/* Expanded: Detail panel + Objectives */}
                        {m && isExpanded && (
                          <>
                            {/* Detail panel */}
                            <tr key={`${companyKey}::detail`} onClick={(e) => e.stopPropagation()}>
                              {renderCompanyDetail(m)}
                            </tr>

                            {/* Objective rows */}
                            {(() => {
                              // Use hook objectives if available, otherwise fall back to lazy-loaded cache
                              const objectives = m.objectives.length > 0
                                ? m.objectives
                                : (objectiveBreakdownCache.has(m.linkedin.entityUrn)
                                    ? toMatchedObjectives(objectiveBreakdownCache.get(m.linkedin.entityUrn)!)
                                    : []);

                              if (isLoadingObjectiveBreakdowns && objectives.length === 0) {
                                return (
                                  <tr key={`${companyKey}::loading-obj`} onClick={(e) => e.stopPropagation()}>
                                    <td colSpan={12} className="px-8 py-3 text-xs text-muted-foreground border-l-4 border-l-primary/10">
                                      <Loader2 className="h-3.5 w-3.5 animate-spin inline mr-2" />
                                      Loading objective breakdowns...
                                    </td>
                                  </tr>
                                );
                              }

                              if (objectives.length === 0) {
                                return (
                                  <tr key={`${companyKey}::no-obj`} onClick={(e) => e.stopPropagation()}>
                                    <td colSpan={12} className="px-8 py-2.5 text-xs text-muted-foreground italic border-l-4 border-l-primary/10">
                                      No objective breakdown available
                                    </td>
                                  </tr>
                                );
                              }

                              return objectives.map((obj, objIdx) => {
                                const objKey = `${companyKey}::${objIdx}`;
                                const isObjExpanded = expandedObjectives.has(objKey);
                                const objCpl = obj.leads > 0 ? obj.spent / obj.leads : 0;

                                return (
                                  <>
                                    <tr
                                      key={objKey}
                                      className={`border-l-4 border-l-primary/25 cursor-pointer hover:bg-muted/20 ${isObjExpanded ? 'bg-muted/10' : ''}`}
                                      onClick={(e) => { e.stopPropagation(); toggleObjective(objKey, m.linkedin.entityUrn, obj); }}
                                    >
                                      <td className="w-8 px-3 py-2 pl-5">
                                        {obj.campaignIds.length > 0 ? (
                                          isObjExpanded
                                            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                        ) : null}
                                      </td>
                                      <td className="px-3 py-2" colSpan={2}>
                                        <div className="flex items-center gap-2 pl-2">
                                          <Badge variant="outline" className="text-[10px] font-normal shrink-0 bg-blue-500/5 border-blue-500/20 text-blue-700 dark:text-blue-400">
                                            {fmtObj(obj.objective)}
                                          </Badge>
                                          <span className="text-[11px] text-muted-foreground">
                                            {obj.campaignNames.length} campaign{obj.campaignNames.length !== 1 ? 's' : ''}
                                          </span>
                                        </div>
                                      </td>
                                      <MetricCell value={fmtNum(obj.impressions)} className="text-muted-foreground" />
                                      <MetricCell value={fmtNum(obj.clicks)} className="text-muted-foreground" />
                                      <MetricCell value={fmtCur(obj.spent)} className="text-muted-foreground" />
                                      <MetricCell value={obj.leads > 0 ? fmtNum(obj.leads) : '—'} className="text-muted-foreground" />
                                      <MetricCell value={fmtNum(obj.engagements)} className="text-muted-foreground" />
                                      <MetricCell value={`${obj.ctr.toFixed(2)}%`} className="text-muted-foreground" />
                                      <MetricCell value={objCpl > 0 ? fmtCur(objCpl) : '—'} className="text-muted-foreground" />
                                      <td />
                                    </tr>

                                    {/* Campaign rows under objective */}
                                    {isObjExpanded && renderCampaignRows(companyKey, objIdx, m.linkedin.entityUrn, obj)}
                                  </>
                                );
                              });
                            })()}
                          </>
                        )}
                      </>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
            <span>Showing {filteredData.length} companies{searchQuery && ` matching "${searchQuery}"`}</span>
            <span>Impact period: {dateRange.start} to {dateRange.end}</span>
          </div>
        </div>
      )}
    </div>
  );
}
