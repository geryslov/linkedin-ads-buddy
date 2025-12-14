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
import { ArrowUp, ArrowDown, Search } from 'lucide-react';
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
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative max-w-lg">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search creative names..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredData.length} of {data.length} creative names
      </div>

      {/* Table */}
      <div className="rounded-md border border-border/50 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 transition-colors whitespace-nowrap"
                onClick={handleSort}
              >
                <div className="flex items-center gap-1 font-semibold text-foreground">
                  Creative Name
                  {sortOrder === 'desc' ? (
                    <ArrowDown className="h-3 w-3 text-primary" />
                  ) : (
                    <ArrowUp className="h-3 w-3 text-primary" />
                  )}
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={1} className="text-center py-8 text-muted-foreground">
                  No creative names match your search
                </TableCell>
              </TableRow>
            ) : (
              sortedData.map((row, index) => (
                <TableRow key={`${row.creativeId}-${index}`} className="hover:bg-muted/20">
                  <TableCell className="font-medium max-w-[800px] truncate" title={row.creativeName}>
                    {row.creativeName}
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
