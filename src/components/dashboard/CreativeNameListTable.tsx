import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { ArrowUp, ArrowDown, Search, List } from 'lucide-react';
import { WidgetCard, EmptyState } from './widgets';
import { CreativeData } from '@/hooks/useCreativeReporting';

interface CreativeNameListTableProps {
  data: CreativeData[];
  isLoading: boolean;
}

type SortOrder = 'asc' | 'desc';

export function CreativeNameListTable({ data, isLoading }: CreativeNameListTableProps) {
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [searchQuery, setSearchQuery] = useState('');

  const handleSort = () => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  };

  const filteredData = useMemo(() => {
    let result = [...data];

    // Apply search filter on creativeName
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item =>
        item.creativeName.toLowerCase().includes(query)
      );
    }
    return result;
  }, [data, searchQuery]);

  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      const aVal = a.creativeName;
      const bVal = b.creativeName;
      const modifier = sortOrder === 'asc' ? 1 : -1;

      return aVal.localeCompare(bVal) * modifier;
    });
  }, [filteredData, sortOrder]);

  if (isLoading) {
    return (
      <WidgetCard title="Creative names">
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
      title="Creative names"
      subtitle={`${filteredData.length} of ${data.length} creative names`}
      toolbar={
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search creative names…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 w-[220px] pl-8 text-sm"
          />
        </div>
      }
    >
      {sortedData.length === 0 ? (
        <EmptyState
          icon={List}
          title="No creative names"
          description={
            searchQuery
              ? 'No creative names match your search.'
              : 'No creative names available yet.'
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent bg-secondary/40">
              <TableHead>
                <button
                  onClick={handleSort}
                  className="inline-flex items-center gap-1 font-semibold text-muted-foreground hover:text-foreground transition-colors"
                >
                  Creative Name
                  {sortOrder === 'desc' ? (
                    <ArrowDown className="h-3 w-3" />
                  ) : (
                    <ArrowUp className="h-3 w-3" />
                  )}
                </button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.map((row, index) => (
              <TableRow key={`${row.creativeId}-${index}`} className="border-border hover:bg-secondary/30 [&>td]:py-2.5">
                <TableCell className="font-medium">
                  <span className="break-words">{row.creativeName}</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </WidgetCard>
  );
}
