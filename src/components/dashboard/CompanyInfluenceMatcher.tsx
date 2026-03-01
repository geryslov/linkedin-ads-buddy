import { useCallback, useEffect, useRef, useState } from 'react';
import { useCompanyDemographic } from '@/hooks/useCompanyDemographic';
import {
  useCompanyInfluenceMatcher,
  MatchedCompany,
  MatchedObjective,
  InfluenceTab,
  isMatchedItem,
} from '@/hooks/useCompanyInfluenceMatcher';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  Users,
  CheckCircle2,
  XCircle,
  Percent,
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
} from 'lucide-react';

interface CompanyInfluenceMatcherProps {
  accessToken: string | null;
  selectedAccount: string | null;
}

function formatObjective(obj: string): string {
  return obj
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
}

function formatCurrency(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
  } = useCompanyDemographic(accessToken);

  const [selectedTimeFrame, setSelectedTimeFrame] = useState('30d');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set());
  const [expandedObjectives, setExpandedObjectives] = useState<Set<string>>(new Set());

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

  // Auto-fetch LinkedIn data on mount
  const [hasFetched, setHasFetched] = useState(false);
  useEffect(() => {
    if (selectedAccount && accessToken && !hasFetched) {
      setHasFetched(true);
      fetchCompanyDemographic(selectedAccount);
    }
  }, [selectedAccount, accessToken, hasFetched, fetchCompanyDemographic]);

  const handleFetch = useCallback(() => {
    if (selectedAccount) {
      fetchCompanyDemographic(selectedAccount);
    }
  }, [selectedAccount, fetchCompanyDemographic]);

  const handleTimeFrameChange = useCallback((option: any) => {
    setSelectedTimeFrame(option.value);
    setTimeFrame(option);
  }, [setTimeFrame]);

  const handleCustomDateChange = useCallback((start: Date, end: Date) => {
    setSelectedTimeFrame('custom');
    setDateRange({
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    });
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

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
    e.target.value = '';
  }, [handleFileSelect]);

  const handleExport = useCallback(() => {
    const data = getExportData(dateRange);
    exportToCSV(data, 'influence_match_results', companyInfluenceColumns);
  }, [getExportData, dateRange]);

  const toggleCompany = useCallback((key: string) => {
    setExpandedCompanies(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        // Also collapse any expanded objectives under this company
        setExpandedObjectives(prevObj => {
          const nextObj = new Set(prevObj);
          for (const k of nextObj) {
            if (k.startsWith(key + '::')) nextObj.delete(k);
          }
          return nextObj;
        });
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const toggleObjective = useCallback((key: string) => {
    setExpandedObjectives(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const SortHeader = ({ field, children }: { field: string; children: React.ReactNode }) => (
    <TableHead
      className="cursor-pointer hover:text-foreground select-none whitespace-nowrap"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field ? (
          <span className="text-xs">{sortDirection === 'asc' ? '↑' : '↓'}</span>
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" />
        )}
      </div>
    </TableHead>
  );

  const hasData = uploadedCompanies.length > 0 && companyData.length > 0;
  const tabOptions: { value: InfluenceTab; label: string; count: number }[] = [
    { value: 'matched', label: 'Influenced', count: matched.length },
    { value: 'unmatched', label: 'Not Reached', count: unmatched.length },
    { value: 'all', label: 'All Companies', count: uniqueUploadedCount },
  ];

  // Find highest spend for relative bar widths
  const maxSpend = Math.max(...matched.map(m => m.linkedin.spent), 1);

  return (
    <div className="space-y-6">
      {/* Setup Section: side-by-side */}
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
            {isLoadingLinkedIn && (
              <Badge variant="outline" className="animate-pulse text-xs">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Loading...
              </Badge>
            )}
            {!isLoadingLinkedIn && companyData.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                <CheckCircle2 className="h-3 w-3 mr-1 text-green-500" />
                {companyData.length} companies
              </Badge>
            )}
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
              <Button onClick={handleFetch} disabled={isLoadingLinkedIn || !selectedAccount} variant="outline" size="sm">
                {isLoadingLinkedIn ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                )}
                {companyData.length > 0 ? 'Reload' : 'Fetch Data'}
              </Button>
              {!selectedAccount && (
                <span className="text-xs text-muted-foreground">Select an ad account first</span>
              )}
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
                isDragOver
                  ? 'border-primary bg-primary/5 scale-[1.01]'
                  : 'border-border/50 hover:border-primary/40 hover:bg-primary/[0.02]'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">Drop CSV here or click to browse</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Columns: Company Name, URL/Website/Email, Date
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleInputChange}
              />
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
                  {[
                    { label: 'Name', value: nameColumn, type: 'name' as const },
                    { label: 'URL/Email', value: urlColumn, type: 'url' as const },
                    { label: 'Date', value: dateColumn, type: 'date' as const },
                  ].map(({ label, value, type }) => (
                    <div key={type} className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">{label}:</span>
                      <Select
                        value={value || ''}
                        onValueChange={(v) => updateColumnMapping(type, v || null)}
                      >
                        <SelectTrigger className="w-[130px] h-7 text-xs">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {csvHeaders.map(h => (
                            <SelectItem key={h} value={h}>{h}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {parseError && (
            <div className="mt-2 text-xs text-destructive flex items-center gap-1.5">
              <XCircle className="h-3.5 w-3.5 shrink-0" />
              {parseError}
            </div>
          )}
        </div>
      </div>

      {/* Impact Summary */}
      {hasData && (
        <div className="animate-slide-up" style={{ animationDelay: '100ms' }}>
          {/* Match rate banner */}
          <div className="glass rounded-xl p-5 mb-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-sm font-semibold">LinkedIn Influence Coverage</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {matched.length} of {uniqueUploadedCount} companies in your list were reached by LinkedIn ads
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

          {/* Metric cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            <MetricCard title="Impressions" value={matchedTotals.impressions.toLocaleString()} icon={Eye} delay={0} />
            <MetricCard title="Clicks" value={matchedTotals.clicks.toLocaleString()} icon={MousePointerClick} delay={30} />
            <MetricCard title="Ad Spend" value={formatCurrency(matchedTotals.spent)} icon={DollarSign} delay={60} />
            <MetricCard title="Leads" value={matchedTotals.leads.toLocaleString()} icon={Target} delay={90} />
            <MetricCard title="CTR" value={`${overallCtr.toFixed(2)}%`} icon={TrendingUp} delay={120} />
            <MetricCard title="Cost/Lead" value={avgCostPerLead > 0 ? formatCurrency(avgCostPerLead) : '—'} icon={Zap} delay={150} />
            <MetricCard title="Engagements" value={matchedTotals.engagements.toLocaleString()} icon={Heart} delay={180} />
            <MetricCard title="Shares" value={matchedTotals.shares.toLocaleString()} icon={Share2} delay={210} />
          </div>
        </div>
      )}

      {/* Results Table */}
      {hasData && (
        <div className="glass rounded-xl p-5 animate-slide-up" style={{ animationDelay: '150ms' }}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex gap-1">
              {tabOptions.map(tab => (
                <Button
                  key={tab.value}
                  variant={activeTab === tab.value ? 'default' : 'ghost'}
                  size="sm"
                  className="text-xs"
                  onClick={() => setActiveTab(tab.value)}
                >
                  {tab.label}
                  <Badge variant={activeTab === tab.value ? 'outline' : 'secondary'} className="ml-1.5 text-[10px] px-1.5 py-0">
                    {tab.count}
                  </Badge>
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 w-[180px] h-8 text-xs"
                />
              </div>
              <Button variant="outline" size="sm" className="text-xs h-8" onClick={handleExport} disabled={matched.length === 0}>
                <Download className="h-3.5 w-3.5 mr-1" />
                Export
              </Button>
            </div>
          </div>

          <div className="rounded-lg border overflow-auto max-h-[650px]">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  {activeTab !== 'unmatched' && <TableHead className="w-8" />}
                  <SortHeader field="name">Company</SortHeader>
                  <TableHead className="whitespace-nowrap">Match</TableHead>
                  <SortHeader field="impressions">Impr.</SortHeader>
                  <SortHeader field="clicks">Clicks</SortHeader>
                  <SortHeader field="spent">Spend</SortHeader>
                  <SortHeader field="leads">Leads</SortHeader>
                  <SortHeader field="engagements">Engage.</SortHeader>
                  <TableHead className="whitespace-nowrap">CTR</TableHead>
                  <TableHead className="whitespace-nowrap">CPL</TableHead>
                  <TableHead className="whitespace-nowrap min-w-[100px]">Spend Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                      No results found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map((item, idx) => {
                    const companyKey = isMatchedItem(item) ? item.linkedin.entityUrn : `unmatched-${idx}`;
                    const isExpanded = expandedCompanies.has(companyKey);
                    const matched_ = isMatchedItem(item) ? item : null;

                    return (
                      <>
                        {/* Company Row */}
                        <TableRow
                          key={companyKey}
                          className={`${matched_ ? 'cursor-pointer hover:bg-muted/40' : ''} ${isExpanded ? 'bg-muted/20' : ''}`}
                          onClick={matched_ ? () => toggleCompany(companyKey) : undefined}
                        >
                          {activeTab !== 'unmatched' && (
                            <TableCell className="w-8 pr-0">
                              {matched_ && matched_.objectives.length > 0 && (
                                isExpanded
                                  ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                            </TableCell>
                          )}
                          <TableCell>
                            <div className="min-w-[150px]">
                              <div className="font-medium text-sm truncate max-w-[220px]" title={matched_ ? matched_.linkedin.entityName : item.uploaded.name}>
                                {matched_ ? matched_.linkedin.entityName : item.uploaded.name || '—'}
                              </div>
                              <div className="text-[11px] text-muted-foreground truncate max-w-[220px]">
                                {matched_ ? (matched_.linkedin.website || item.uploaded.url || '') : (item.uploaded.url || '')}
                              </div>
                              {matched_ && matched_.uploadedEntries.length > 1 && (
                                <Badge variant="outline" className="text-[10px] mt-0.5 font-normal">
                                  {matched_.uploadedEntries.length} entries in CSV
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {matched_ ? (
                              <Badge
                                variant={matched_.matchType === 'name' ? 'default' : 'secondary'}
                                className="text-[10px]"
                              >
                                {matched_.matchType}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-muted-foreground">—</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm">
                            {matched_ ? matched_.linkedin.impressions.toLocaleString() : '—'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm">
                            {matched_ ? matched_.linkedin.clicks.toLocaleString() : '—'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm font-medium">
                            {matched_ ? formatCurrency(matched_.linkedin.spent) : '—'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm">
                            {matched_ ? (
                              <span className={matched_.linkedin.leads > 0 ? 'text-green-600 font-medium' : ''}>
                                {matched_.linkedin.leads.toLocaleString()}
                              </span>
                            ) : '—'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm">
                            {matched_ ? matched_.linkedin.engagements.toLocaleString() : '—'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm">
                            {matched_ ? `${matched_.linkedin.ctr.toFixed(2)}%` : '—'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm">
                            {matched_ && matched_.costPerLead > 0
                              ? formatCurrency(matched_.costPerLead)
                              : '—'}
                          </TableCell>
                          <TableCell>
                            {matched_ ? (
                              <div className="flex items-center gap-2 min-w-[80px]">
                                <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className="h-full bg-primary/60 rounded-full"
                                    style={{ width: `${Math.max((matched_.linkedin.spent / maxSpend) * 100, 2)}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">
                                  {((matched_.linkedin.spent / matchedTotals.spent) * 100).toFixed(0)}%
                                </span>
                              </div>
                            ) : '—'}
                          </TableCell>
                        </TableRow>

                        {/* Expanded: Objective Rows */}
                        {matched_ && isExpanded && matched_.objectives.map((obj, objIdx) => {
                          const objKey = `${companyKey}::${objIdx}`;
                          const isObjExpanded = expandedObjectives.has(objKey);

                          return (
                            <>
                              <TableRow
                                key={objKey}
                                className="bg-muted/10 cursor-pointer hover:bg-muted/25 border-l-2 border-l-primary/30"
                                onClick={(e) => { e.stopPropagation(); toggleObjective(objKey); }}
                              >
                                {activeTab !== 'unmatched' && (
                                  <TableCell className="w-8 pr-0 pl-4">
                                    {obj.campaignNames.length > 0 && (
                                      isObjExpanded
                                        ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                        : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                    )}
                                  </TableCell>
                                )}
                                <TableCell className="pl-6">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-[10px] font-normal shrink-0 bg-blue-500/5 border-blue-500/20 text-blue-700">
                                      {formatObjective(obj.objective)}
                                    </Badge>
                                    <span className="text-[11px] text-muted-foreground">
                                      {obj.campaignNames.length} campaign{obj.campaignNames.length !== 1 ? 's' : ''}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell />
                                <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                                  {obj.impressions.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                                  {obj.clicks.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                                  {formatCurrency(obj.spent)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                                  {obj.leads > 0 ? obj.leads.toLocaleString() : '—'}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                                  {obj.engagements.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                                  {obj.ctr.toFixed(2)}%
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                                  {obj.leads > 0 ? formatCurrency(obj.spent / obj.leads) : '—'}
                                </TableCell>
                                <TableCell />
                              </TableRow>

                              {/* Expanded: Campaign Names */}
                              {isObjExpanded && obj.campaignNames.map((name, cIdx) => (
                                <TableRow
                                  key={`${objKey}::c${cIdx}`}
                                  className="bg-muted/5 border-l-2 border-l-primary/15"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {activeTab !== 'unmatched' && <TableCell className="w-8" />}
                                  <TableCell className="pl-10">
                                    <div className="flex items-center gap-2">
                                      <div className="w-1 h-1 rounded-full bg-muted-foreground/40 shrink-0" />
                                      <span className="text-xs text-muted-foreground truncate max-w-[250px]" title={name}>
                                        {name}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell colSpan={9} />
                                </TableRow>
                              ))}
                            </>
                          );
                        })}
                      </>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
            <span>
              Showing {filteredData.length} companies
              {searchQuery && ` matching "${searchQuery}"`}
            </span>
            <span>Impact period: {dateRange.start} to {dateRange.end}</span>
          </div>
        </div>
      )}
    </div>
  );
}
