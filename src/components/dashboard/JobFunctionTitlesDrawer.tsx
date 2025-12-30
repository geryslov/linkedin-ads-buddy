import { useState, useMemo } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Download, Search, ArrowUpDown, X, AlertCircle, Pencil } from 'lucide-react';
import { exportToCSV } from '@/lib/exportUtils';
import { useToast } from '@/hooks/use-toast';
import type { TitleMapping } from '@/hooks/useJobSeniorityMatrix';

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

export interface TitleWithMapping extends TitleData {
  mapping?: TitleMapping;
}

export interface TitleDrilldownData {
  jobFunction: string;
  jobFunctionUrn: string;
  jobFunctionId: string;
  titles: TitleWithMapping[];
  allTitlesCount: number;
}

interface JobFunctionOption {
  id: string;
  label: string;
}

interface JobFunctionTitlesDrawerProps {
  open: boolean;
  onClose: () => void;
  data: TitleDrilldownData | null;
  isLoading: boolean;
  error: string | null;
  jobFunctionOptions: JobFunctionOption[];
  onOverrideMapping?: (title: string, newFunctionId: string, newFunctionLabel: string, reason?: string) => Promise<boolean>;
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
  { key: 'confidence', label: 'Confidence' },
];

export function JobFunctionTitlesDrawer({ 
  open, 
  onClose, 
  data, 
  isLoading, 
  error,
  jobFunctionOptions,
  onOverrideMapping,
}: JobFunctionTitlesDrawerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMetric, setSortMetric] = useState<SortableMetric>('impressions');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Override dialog state
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [selectedTitleForOverride, setSelectedTitleForOverride] = useState<TitleWithMapping | null>(null);
  const [newFunctionId, setNewFunctionId] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [isOverriding, setIsOverriding] = useState(false);
  
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
      title: t.title,
      impressions: t.impressions,
      clicks: t.clicks,
      ctr: t.ctr.toFixed(2),
      spent: t.spent.toFixed(2),
      leads: t.leads,
      cpl: t.cpl.toFixed(2),
      confidence: t.mapping ? `${(t.mapping.confidence * 100).toFixed(0)}%` : 'N/A',
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

  const handleOpenOverrideDialog = (title: TitleWithMapping) => {
    setSelectedTitleForOverride(title);
    setNewFunctionId(title.mapping?.job_function_id || '');
    setOverrideReason('');
    setOverrideDialogOpen(true);
  };

  const handleOverrideSubmit = async () => {
    if (!selectedTitleForOverride || !newFunctionId || !onOverrideMapping) return;
    
    const newLabel = jobFunctionOptions.find(o => o.id === newFunctionId)?.label || '';
    if (!newLabel) return;
    
    setIsOverriding(true);
    const success = await onOverrideMapping(
      selectedTitleForOverride.title,
      newFunctionId,
      newLabel,
      overrideReason || undefined
    );
    setIsOverriding(false);
    
    if (success) {
      setOverrideDialogOpen(false);
      setSelectedTitleForOverride(null);
    }
  };

  const ConfidenceBadge = ({ mapping }: { mapping?: TitleMapping }) => {
    if (!mapping) return <Badge variant="outline">N/A</Badge>;
    
    if (mapping.method === 'user_override') {
      return <Badge variant="default" className="bg-primary">Manual</Badge>;
    }
    
    const confidence = mapping.confidence;
    if (confidence >= 0.8) {
      return <Badge variant="default">{(confidence * 100).toFixed(0)}%</Badge>;
    } else if (confidence >= 0.5) {
      return <Badge variant="secondary">{(confidence * 100).toFixed(0)}%</Badge>;
    } else {
      return <Badge variant="outline">{(confidence * 100).toFixed(0)}%</Badge>;
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <SheetContent className="w-full sm:max-w-2xl">
          <SheetHeader className="space-y-1">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-xl">
                Job Titles — {data?.jobFunction || 'Loading...'}
              </SheetTitle>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <SheetDescription className="text-sm text-muted-foreground">
              Titles classified as "{data?.jobFunction}" based on keyword matching. 
              Click the edit button to correct any misclassifications.
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
                <p className="text-sm font-medium text-muted-foreground">No titles found for {data?.jobFunction}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {data?.allTitlesCount ? `${data.allTitlesCount} total titles in account, but none matched this function.` : 'No title data available for this date range.'}
                </p>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Showing {filteredTitles.length} of {data.titles.length} titles 
                  <span className="text-xs ml-1">({data.allTitlesCount} total in account)</span>
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
                        <TableHead className="text-center min-w-[80px]">Confidence</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
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
                          <TableCell className="text-center">
                            <ConfidenceBadge mapping={title.mapping} />
                          </TableCell>
                          <TableCell>
                            {onOverrideMapping && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7"
                                onClick={() => handleOpenOverrideDialog(title)}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            )}
                          </TableCell>
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

      {/* Override Dialog */}
      <Dialog open={overrideDialogOpen} onOpenChange={setOverrideDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override Classification</DialogTitle>
            <DialogDescription>
              Change the job function classification for "{selectedTitleForOverride?.title}"
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">New Job Function</label>
              <Select value={newFunctionId} onValueChange={setNewFunctionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select job function" />
                </SelectTrigger>
                <SelectContent>
                  {jobFunctionOptions.map(opt => (
                    <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason (optional)</label>
              <Textarea
                placeholder="Why is this classification better?"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleOverrideSubmit} disabled={!newFunctionId || isOverriding}>
              {isOverriding ? 'Saving...' : 'Save Override'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}