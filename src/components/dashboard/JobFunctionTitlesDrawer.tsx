import { useState, useMemo } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Download, Search, ArrowUpDown, X, AlertCircle } from 'lucide-react';
import { exportToCSV } from '@/lib/exportUtils';
import { useToast } from '@/hooks/use-toast';

export interface TitleData {
  title: string;
  impressions: number;
  clicks: number;
  spent: number;
  leads: number;
  ctr: number;
  cpc: number;
  cpm: number;
  cpl: number;
}

export interface TitleDrilldownData {
  jobFunction: string;
  jobFunctionUrn: string;
  titles: TitleData[];
}

interface JobFunctionTitlesDrawerProps {
  open: boolean;
  onClose: () => void;
  data: TitleDrilldownData | null;
  isLoading: boolean;
  error: string | null;
}

type SortableMetric = 'impressions' | 'clicks' | 'ctr' | 'spent' | 'leads' | 'cpl' | 'cpc' | 'cpm';

const METRIC_OPTIONS: { value: SortableMetric; label: string }[] = [
  { value: 'impressions', label: 'Impressions' },
  { value: 'clicks', label: 'Clicks' },
  { value: 'ctr', label: 'CTR (%)' },
  { value: 'spent', label: 'Spent ($)' },
  { value: 'leads', label: 'Leads' },
  { value: 'cpl', label: 'CPL ($)' },
  { value: 'cpc', label: 'CPC ($)' },
  { value: 'cpm', label: 'CPM ($)' },
];

const jobTitleDrilldownColumns = [
  { key: 'title', label: 'Job Title' },
  { key: 'impressions', label: 'Impressions' },
  { key: 'clicks', label: 'Clicks' },
  { key: 'ctr', label: 'CTR (%)' },
  { key: 'spent', label: 'Spent ($)' },
  { key: 'leads', label: 'Leads' },
  { key: 'cpl', label: 'CPL ($)' },
  { key: 'cpc', label: 'CPC ($)' },
  { key: 'cpm', label: 'CPM ($)' },
];

export function JobFunctionTitlesDrawer({ 
  open, 
  onClose, 
  data, 
  isLoading, 
  error 
}: JobFunctionTitlesDrawerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMetric, setSortMetric] = useState<SortableMetric>('impressions');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const { toast } = useToast();

  // Filter and sort titles
  const filteredTitles = useMemo(() => {
    if (!data?.titles) return [];
    
    let filtered = data.titles;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t => t.title.toLowerCase().includes(query));
    }
    
    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      const aVal = a[sortMetric] || 0;
      const bVal = b[sortMetric] || 0;
      return sortDirection === 'desc' ? bVal - aVal : aVal - bVal;
    });
    
    return filtered;
  }, [data?.titles, searchQuery, sortMetric, sortDirection]);

  const handleExportCSV = () => {
    if (!filteredTitles.length) {
      toast({
        title: 'No data to export',
        description: 'There are no job titles to export.',
        variant: 'destructive',
      });
      return;
    }

    const exportData = filteredTitles.map(t => ({
      ...t,
      ctr: t.ctr.toFixed(2),
      spent: t.spent.toFixed(2),
      cpc: t.cpc.toFixed(2),
      cpm: t.cpm.toFixed(2),
      cpl: t.cpl.toFixed(2),
    }));

    exportToCSV(exportData, `job_titles_${data?.jobFunction || 'export'}`, jobTitleDrilldownColumns);
    toast({
      title: 'Export successful',
      description: `${exportData.length} job titles exported to CSV.`,
    });
  };

  const toggleSort = (metric: SortableMetric) => {
    if (sortMetric === metric) {
      setSortDirection(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortMetric(metric);
      setSortDirection('desc');
    }
  };

  const formatValue = (value: number, metric: string): string => {
    switch (metric) {
      case 'ctr':
        return `${value.toFixed(2)}%`;
      case 'spent':
      case 'cpc':
      case 'cpm':
      case 'cpl':
        return `$${value.toFixed(2)}`;
      default:
        return value.toLocaleString();
    }
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl">
        <SheetHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-xl">
              Job Titles — All Delivery Data
            </SheetTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <SheetDescription className="text-sm text-muted-foreground">
            All job titles that received impressions in this account. LinkedIn's API doesn't support filtering titles by job function.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search titles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Select value={sortMetric} onValueChange={(v) => setSortMetric(v as SortableMetric)}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  {METRIC_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={handleExportCSV} disabled={isLoading || !filteredTitles.length}>
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-10 w-10 text-destructive mb-3" />
              <p className="text-sm font-medium text-destructive">Title-level breakdown unavailable</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">{error}</p>
            </div>
          ) : !data || data.titles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm font-medium text-muted-foreground">No title-level data available</p>
              <p className="text-xs text-muted-foreground mt-1">
                This segment may not have sufficient volume for title breakdown.
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Showing {filteredTitles.length} of {data.titles.length} titles
              </p>
              
              <ScrollArea className="h-[calc(100vh-320px)]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">Title</TableHead>
                      {(['impressions', 'clicks', 'ctr', 'spent', 'leads', 'cpl'] as SortableMetric[]).map(metric => (
                        <TableHead 
                          key={metric} 
                          className="text-right cursor-pointer hover:bg-muted/50 min-w-[80px]"
                          onClick={() => toggleSort(metric)}
                        >
                          <div className="flex items-center justify-end gap-1">
                            {METRIC_OPTIONS.find(o => o.value === metric)?.label}
                            {sortMetric === metric && (
                              <ArrowUpDown className={`h-3 w-3 ${sortDirection === 'asc' ? 'rotate-180' : ''}`} />
                            )}
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTitles.map((title, idx) => (
                      <TableRow key={`${title.title}-${idx}`}>
                        <TableCell className="font-medium">{title.title}</TableCell>
                        <TableCell className="text-right">{formatValue(title.impressions, 'impressions')}</TableCell>
                        <TableCell className="text-right">{formatValue(title.clicks, 'clicks')}</TableCell>
                        <TableCell className="text-right">{formatValue(title.ctr, 'ctr')}</TableCell>
                        <TableCell className="text-right">{formatValue(title.spent, 'spent')}</TableCell>
                        <TableCell className="text-right">{formatValue(title.leads, 'leads')}</TableCell>
                        <TableCell className="text-right">{formatValue(title.cpl, 'cpl')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}