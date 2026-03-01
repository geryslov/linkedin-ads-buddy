import { useCallback, useEffect, useRef, useState } from 'react';
import { useCompanyDemographic } from '@/hooks/useCompanyDemographic';
import {
  useCompanyInfluenceMatcher,
  MatchedCompany,
  InfluenceTab,
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
} from 'lucide-react';

interface CompanyInfluenceMatcherProps {
  accessToken: string | null;
  selectedAccount: string | null;
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
    matchedTotals,
    matchRate,
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

  // Auto-fetch LinkedIn data on mount so it's ready when user uploads CSV
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
    if (file && file.type === 'text/csv' || file?.name.endsWith('.csv')) {
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
    // Reset input so re-uploading same file triggers onChange
    e.target.value = '';
  }, [handleFileSelect]);

  const handleExport = useCallback(() => {
    const data = getExportData(dateRange);
    exportToCSV(data, 'influence_match_results', companyInfluenceColumns);
  }, [getExportData, dateRange]);

  const SortHeader = ({ field, children }: { field: string; children: React.ReactNode }) => (
    <TableHead
      className="cursor-pointer hover:text-foreground select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field && (
          <span className="text-xs">{sortDirection === 'asc' ? '↑' : '↓'}</span>
        )}
        {sortField !== field && <ArrowUpDown className="h-3 w-3 opacity-40" />}
      </div>
    </TableHead>
  );

  const isMatched = (item: any): item is MatchedCompany => 'linkedin' in item;

  const hasData = uploadedCompanies.length > 0 && companyData.length > 0;
  const tabOptions: { value: InfluenceTab; label: string; count: number }[] = [
    { value: 'matched', label: 'Matched', count: matched.length },
    { value: 'unmatched', label: 'Unmatched', count: unmatched.length },
    { value: 'all', label: 'All', count: uploadedCompanies.length },
  ];

  return (
    <div className="space-y-6">
      {/* Step 1: Date Range + Fetch */}
      <div className="glass rounded-xl p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Step 1: LinkedIn Company Data</h3>
          <div className="flex items-center gap-2">
            {isLoadingLinkedIn && (
              <Badge variant="outline" className="animate-pulse">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Loading...
              </Badge>
            )}
            {!isLoadingLinkedIn && companyData.length > 0 && (
              <Badge variant="secondary">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {companyData.length} companies loaded ({dateRange.start} to {dateRange.end})
              </Badge>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <TimeFrameSelector
            timeFrameOptions={timeFrameOptions}
            selectedTimeFrame={selectedTimeFrame}
            onTimeFrameChange={handleTimeFrameChange}
            timeGranularity={timeGranularity}
            onGranularityChange={setTimeGranularity}
            dateRange={dateRange}
            onCustomDateChange={handleCustomDateChange}
          />
          <div className="flex items-center gap-3">
            <Button onClick={handleFetch} disabled={isLoadingLinkedIn || !selectedAccount} variant="outline" size="sm">
              {isLoadingLinkedIn ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              {companyData.length > 0 ? 'Reload Data' : 'Fetch LinkedIn Data'}
            </Button>
            {!selectedAccount && (
              <span className="text-sm text-muted-foreground">Select an ad account first</span>
            )}
          </div>
        </div>
      </div>

      {/* Step 2: CSV Upload */}
      <div className="glass rounded-xl p-6 animate-slide-up" style={{ animationDelay: '50ms' }}>
        <h3 className="text-sm font-semibold mb-4">Step 2: Upload Your Company List (CSV)</h3>

        {!fileName ? (
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
              isDragOver
                ? 'border-primary bg-primary/5'
                : 'border-border/50 hover:border-primary/50'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-medium">Drag & drop your CSV file here</p>
            <p className="text-xs text-muted-foreground mt-1">
              or click to browse. Expected columns: Company Name, URL/Website/Email, Date
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
                <Badge variant="outline">{uploadedCompanies.length} rows</Badge>
              </div>
              <Button variant="ghost" size="sm" onClick={clearUpload}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Column mapping */}
            {csvHeaders.length > 0 && (
              <div className="flex flex-wrap gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Name:</span>
                  <Select
                    value={nameColumn || ''}
                    onValueChange={(v) => updateColumnMapping('name', v || null)}
                  >
                    <SelectTrigger className="w-[160px] h-8 text-xs">
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      {csvHeaders.map(h => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">URL/Email:</span>
                  <Select
                    value={urlColumn || ''}
                    onValueChange={(v) => updateColumnMapping('url', v || null)}
                  >
                    <SelectTrigger className="w-[160px] h-8 text-xs">
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      {csvHeaders.map(h => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Date:</span>
                  <Select
                    value={dateColumn || ''}
                    onValueChange={(v) => updateColumnMapping('date', v || null)}
                  >
                    <SelectTrigger className="w-[160px] h-8 text-xs">
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      {csvHeaders.map(h => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        )}

        {parseError && (
          <div className="mt-3 text-sm text-destructive flex items-center gap-2">
            <XCircle className="h-4 w-4" />
            {parseError}
          </div>
        )}
      </div>

      {/* Summary Cards */}
      {hasData && (
        <div className="space-y-4 animate-slide-up" style={{ animationDelay: '100ms' }}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Uploaded Companies"
              value={uploadedCompanies.length}
              icon={FileSpreadsheet}
              delay={0}
            />
            <MetricCard
              title="Matched (Influenced)"
              value={matched.length}
              icon={CheckCircle2}
              delay={50}
            />
            <MetricCard
              title="Unmatched"
              value={unmatched.length}
              icon={XCircle}
              delay={100}
            />
            <MetricCard
              title="Match Rate"
              value={`${matchRate}%`}
              icon={Percent}
              delay={150}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="LinkedIn Impressions"
              value={matchedTotals.impressions.toLocaleString()}
              icon={Eye}
              delay={200}
            />
            <MetricCard
              title="LinkedIn Clicks"
              value={matchedTotals.clicks.toLocaleString()}
              icon={MousePointerClick}
              delay={250}
            />
            <MetricCard
              title="LinkedIn Spend"
              value={`$${matchedTotals.spent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              icon={DollarSign}
              delay={300}
            />
            <MetricCard
              title="LinkedIn Leads"
              value={matchedTotals.leads.toLocaleString()}
              icon={Users}
              delay={350}
            />
          </div>
        </div>
      )}

      {/* Results Table */}
      {hasData && (
        <div className="glass rounded-xl p-6 animate-slide-up" style={{ animationDelay: '150ms' }}>
          {/* Tab bar + search + export */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex gap-1">
              {tabOptions.map(tab => (
                <Button
                  key={tab.value}
                  variant={activeTab === tab.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveTab(tab.value)}
                >
                  {tab.label} ({tab.count})
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search companies..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-[220px] h-9"
                />
              </div>
              <Button variant="outline" size="sm" onClick={handleExport} disabled={matched.length === 0}>
                <Download className="h-4 w-4 mr-1" />
                Export CSV
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-md border overflow-auto max-h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHeader field="name">Company Name</SortHeader>
                  <TableHead>URL</TableHead>
                  <SortHeader field="date">Date</SortHeader>
                  {activeTab !== 'unmatched' && (
                    <>
                      <TableHead>Match Type</TableHead>
                      <TableHead>LinkedIn Name</TableHead>
                      <TableHead>Objectives</TableHead>
                      <TableHead>Campaigns</TableHead>
                      <TableHead>Impact Period</TableHead>
                      <SortHeader field="impressions">Impressions</SortHeader>
                      <SortHeader field="clicks">Clicks</SortHeader>
                      <SortHeader field="spent">Spend</SortHeader>
                      <SortHeader field="leads">Leads</SortHeader>
                      <SortHeader field="engagements">Engagements</SortHeader>
                      <TableHead>CTR</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={activeTab !== 'unmatched' ? 14 : 3} className="text-center py-8 text-muted-foreground">
                      No results found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {item.uploaded.name || '—'}
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate text-xs text-muted-foreground">
                        {item.uploaded.url || '—'}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {item.uploaded.date || '—'}
                      </TableCell>
                      {activeTab !== 'unmatched' && (
                        <>
                          <TableCell>
                            {isMatched(item) ? (
                              <Badge variant={item.matchType === 'name' ? 'default' : 'secondary'}>
                                {item.matchType}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">none</Badge>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[180px] truncate text-sm">
                            {isMatched(item) ? item.linkedin.entityName : '—'}
                          </TableCell>
                          <TableCell className="max-w-[200px]">
                            {isMatched(item) && item.objectives.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {item.objectives.map((obj, i) => (
                                  <Badge key={i} variant="outline" className="text-[10px] font-normal">
                                    {obj.replace(/_/g, ' ')}
                                  </Badge>
                                ))}
                              </div>
                            ) : '—'}
                          </TableCell>
                          <TableCell className="max-w-[250px]">
                            {isMatched(item) && item.campaignNames.length > 0 ? (
                              <div className="text-xs text-muted-foreground space-y-0.5 max-h-[60px] overflow-auto">
                                {item.campaignNames.map((name, i) => (
                                  <div key={i} className="truncate" title={name}>{name}</div>
                                ))}
                              </div>
                            ) : '—'}
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                            {isMatched(item) ? `${dateRange.start} → ${dateRange.end}` : '—'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {isMatched(item) ? item.linkedin.impressions.toLocaleString() : '—'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {isMatched(item) ? item.linkedin.clicks.toLocaleString() : '—'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {isMatched(item) ? `$${item.linkedin.spent.toFixed(2)}` : '—'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {isMatched(item) ? item.linkedin.leads.toLocaleString() : '—'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {isMatched(item) ? item.linkedin.engagements.toLocaleString() : '—'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {isMatched(item) ? `${item.linkedin.ctr.toFixed(2)}%` : '—'}
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-3 text-xs text-muted-foreground">
            Showing {filteredData.length} of {uploadedCompanies.length} companies
          </div>
        </div>
      )}
    </div>
  );
}
