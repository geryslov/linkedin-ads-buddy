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
import { ArrowUpDown, ArrowUp, ArrowDown, Search, Building, Briefcase, Factory, Users, Globe } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { WidgetCard, EmptyState } from './widgets';
import { cn } from '@/lib/utils';
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

  const SortHeader = ({ field, label, align }: { field: SortField; label: string; align?: 'right' }) => (
    <button
      onClick={() => handleSort(field)}
      className={cn(
        'inline-flex items-center gap-1 font-semibold text-muted-foreground hover:text-foreground transition-colors',
        align === 'right' && 'flex-row-reverse'
      )}
    >
      {label}
      {sortField === field ? (
        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  );

  if (isLoading) {
    return (
      <WidgetCard title="Demographic analytics">
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard
      noPadding
      title="Demographic analytics"
      subtitle={`${filteredAndSortedData.length} ${pivotInfo.plural}`}
      toolbar={
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder={`Search ${pivotInfo.plural}…`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 w-[220px] pl-8 text-sm"
          />
        </div>
      }
    >
      {filteredAndSortedData.length === 0 ? (
        <EmptyState
          icon={IconComponent}
          title="No demographic data"
          description={
            searchQuery
              ? `No ${pivotInfo.plural} match your search.`
              : 'LinkedIn returns empty results below its 300-impression privacy threshold.'
          }
        />
      ) : (
        <Table className="min-w-[800px]">
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent bg-secondary/40">
              <TableHead className="min-w-[180px]"><SortHeader field="entityName" label={pivotInfo.singular} /></TableHead>
              <TableHead className="text-right"><SortHeader field="impressions" label="Impressions" align="right" /></TableHead>
              <TableHead className="text-right"><SortHeader field="clicks" label="Clicks" align="right" /></TableHead>
              <TableHead className="text-right"><SortHeader field="spent" label="Spent" align="right" /></TableHead>
              <TableHead className="text-right"><SortHeader field="leads" label="Leads" align="right" /></TableHead>
              <TableHead className="text-right"><SortHeader field="ctr" label="CTR" align="right" /></TableHead>
              <TableHead className="text-right"><SortHeader field="cpc" label="CPC" align="right" /></TableHead>
              <TableHead className="text-right"><SortHeader field="cpm" label="CPM" align="right" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedData.map((item, index) => (
              <TableRow key={item.entityUrn || index} className="border-border hover:bg-secondary/30 [&>td]:py-2.5">
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <IconComponent className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="break-words">{item.entityName}</span>
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
            ))}
          </TableBody>
        </Table>
      )}
    </WidgetCard>
  );
}
