import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowUpDown, Search, Building2, ExternalLink, Globe, AlertCircle, CheckCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { CompanyDemographicItem } from '@/hooks/useCompanyDemographic';

interface CompanyDemographicTableProps {
  data: CompanyDemographicItem[];
  isLoading: boolean;
}

type SortField = 'entityName' | 'impressions' | 'clicks' | 'spent' | 'leads' | 'ctr' | 'cpc' | 'cpm' | 'enrichmentStatus';
type SortDirection = 'asc' | 'desc';

export function CompanyDemographicTable({ data, isLoading }: CompanyDemographicTableProps) {
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

  const filteredAndSortedData = useMemo(() => {
    let filtered = data;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = data.filter(item => 
        item.entityName.toLowerCase().includes(query) ||
        (item.website && item.website.toLowerCase().includes(query))
      );
    }
    
    return [...filtered].sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue) 
          : bValue.localeCompare(aValue);
      }
      
      if (aValue === null) return 1;
      if (bValue === null) return -1;
      
      return sortDirection === 'asc' 
        ? (aValue as number) - (bValue as number) 
        : (bValue as number) - (aValue as number);
    });
  }, [data, searchQuery, sortField, sortDirection]);

  const totals = useMemo(() => {
    return filteredAndSortedData.reduce(
      (acc, item) => ({
        impressions: acc.impressions + item.impressions,
        clicks: acc.clicks + item.clicks,
        spent: acc.spent + item.spent,
        leads: acc.leads + item.leads,
      }),
      { impressions: 0, clicks: 0, spent: 0, leads: 0 }
    );
  }, [filteredAndSortedData]);

  const totalCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const totalCpc = totals.clicks > 0 ? totals.spent / totals.clicks : 0;
  const totalCpm = totals.impressions > 0 ? (totals.spent / totals.impressions) * 1000 : 0;

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 px-2 hover:bg-muted/50"
      onClick={() => handleSort(field)}
    >
      {children}
      <ArrowUpDown className="ml-1 h-3 w-3" />
    </Button>
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'resolved':
        return (
          <Badge variant="secondary" className="bg-green-500/10 text-green-600 gap-1">
            <CheckCircle className="h-3 w-3" />
            Resolved
          </Badge>
        );
      case 'fallback':
        return (
          <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600 gap-1">
            <Globe className="h-3 w-3" />
            Fallback
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="bg-muted text-muted-foreground gap-1">
            <AlertCircle className="h-3 w-3" />
            Unresolved
          </Badge>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search companies or websites..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <span className="text-sm text-muted-foreground">
          {filteredAndSortedData.length} companies
        </span>
      </div>

      <div className="rounded-lg border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-[200px]">
                <SortButton field="entityName">Company</SortButton>
              </TableHead>
              <TableHead className="w-[180px]">
                <SortButton field="enrichmentStatus">Website</SortButton>
              </TableHead>
              <TableHead className="text-right">
                <SortButton field="impressions">Impressions</SortButton>
              </TableHead>
              <TableHead className="text-right">
                <SortButton field="clicks">Clicks</SortButton>
              </TableHead>
              <TableHead className="text-right">
                <SortButton field="spent">Spent</SortButton>
              </TableHead>
              <TableHead className="text-right">
                <SortButton field="leads">Leads</SortButton>
              </TableHead>
              <TableHead className="text-right">
                <SortButton field="ctr">CTR</SortButton>
              </TableHead>
              <TableHead className="text-right">
                <SortButton field="cpc">CPC</SortButton>
              </TableHead>
              <TableHead className="text-right">
                <SortButton field="cpm">CPM</SortButton>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <Building2 className="h-8 w-8 opacity-50" />
                    <span>No company demographic data available</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedData.map((item, index) => (
                <TableRow key={item.entityUrn || index} className="hover:bg-muted/20">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="truncate max-w-[160px]" title={item.entityName}>
                        {item.entityName}
                      </span>
                      {item.linkedInUrl && (
                        <a 
                          href={item.linkedInUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary hover:text-primary/80"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {item.website ? (
                      <a 
                        href={item.website.startsWith('http') ? item.website : `https://${item.website}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline text-sm"
                      >
                        <Globe className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate max-w-[120px]">
                          {item.website.replace(/^https?:\/\//, '')}
                        </span>
                      </a>
                    ) : (
                      getStatusBadge(item.enrichmentStatus)
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {item.impressions.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {item.clicks.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    ${item.spent.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {item.leads.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {item.ctr.toFixed(2)}%
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    ${item.cpc.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    ${item.cpm.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {filteredAndSortedData.length > 0 && (
            <TableFooter>
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell>Total ({filteredAndSortedData.length} companies)</TableCell>
                <TableCell></TableCell>
                <TableCell className="text-right tabular-nums">
                  {totals.impressions.toLocaleString()}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {totals.clicks.toLocaleString()}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  ${totals.spent.toFixed(2)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {totals.leads.toLocaleString()}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {totalCtr.toFixed(2)}%
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  ${totalCpc.toFixed(2)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  ${totalCpm.toFixed(2)}
                </TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  );
}
