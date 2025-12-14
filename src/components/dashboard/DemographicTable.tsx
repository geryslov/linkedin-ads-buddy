import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, Search, Building, Briefcase, Factory, Users, Globe } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { DemographicItem, DemographicPivot } from '@/hooks/useDemographicReporting';

interface DemographicTableProps {
  data: DemographicItem[];
  isLoading: boolean;
  pivot: DemographicPivot;
}

type SortField = 'entityName' | 'impressions' | 'clicks' | 'spent' | 'leads' | 'ctr' | 'cpc' | 'cpm';
type SortDirection = 'asc' | 'desc';

const PIVOT_LABELS: Record<DemographicPivot, { singular: string; plural: string; icon: typeof Building }> = {
  MEMBER_COMPANY: { singular: 'Company', plural: 'companies', icon: Building },
  MEMBER_JOB_TITLE: { singular: 'Job Title', plural: 'job titles', icon: Briefcase },
  MEMBER_JOB_FUNCTION: { singular: 'Job Function', plural: 'job functions', icon: Users },
  MEMBER_INDUSTRY: { singular: 'Industry', plural: 'industries', icon: Factory },
  MEMBER_SENIORITY: { singular: 'Seniority', plural: 'seniority levels', icon: Users },
  MEMBER_COUNTRY: { singular: 'Country', plural: 'countries', icon: Globe },
};

export function DemographicTable({ data, isLoading, pivot }: DemographicTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('impressions');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const pivotInfo = PIVOT_LABELS[pivot];
  const IconComponent = pivotInfo.icon;

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
        item.entityName.toLowerCase().includes(query)
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
      
      return sortDirection === 'asc' 
        ? (aValue as number) - (bValue as number) 
        : (bValue as number) - (aValue as number);
    });
  }, [data, searchQuery, sortField, sortDirection]);

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
            placeholder={`Search ${pivotInfo.plural}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <span className="text-sm text-muted-foreground">
          {filteredAndSortedData.length} {pivotInfo.plural}
        </span>
      </div>

      <div className="rounded-lg border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-[280px]">
                <SortButton field="entityName">{pivotInfo.singular}</SortButton>
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
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <IconComponent className="h-8 w-8 opacity-50" />
                    <span>No demographic data available</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedData.map((item, index) => (
                <TableRow key={item.entityUrn || index} className="hover:bg-muted/20">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <IconComponent className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate max-w-[240px]" title={item.entityName}>
                        {item.entityName}
                      </span>
                    </div>
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
        </Table>
      </div>
    </div>
  );
}