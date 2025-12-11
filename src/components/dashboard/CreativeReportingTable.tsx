import { useMemo, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { AggregatedCreativeData } from '@/hooks/useCreativeReporting';

interface CreativeReportingTableProps {
  data: AggregatedCreativeData[];
  isLoading: boolean;
}

type SortField = 'name' | 'impressions' | 'clicks' | 'spent' | 'leads' | 'ctr';
type SortDirection = 'asc' | 'desc';

export function CreativeReportingTable({ data, isLoading }: CreativeReportingTableProps) {
  const [sortField, setSortField] = useState<SortField>('spent');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
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
  }, [data, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="ml-1 h-3 w-3" />
      : <ArrowDown className="ml-1 h-3 w-3" />;
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(Math.round(num));
  };

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(num);
  };

  const formatPercentage = (num: number) => {
    return `${num.toFixed(2)}%`;
  };

  // Calculate totals
  const totals = useMemo(() => {
    return data.reduce(
      (acc, item) => ({
        impressions: acc.impressions + item.impressions,
        clicks: acc.clicks + item.clicks,
        spent: acc.spent + item.spent,
        leads: acc.leads + item.leads,
      }),
      { impressions: 0, clicks: 0, spent: 0, leads: 0 }
    );
  }, [data]);

  const totalCtr = totals.impressions > 0 
    ? (totals.clicks / totals.impressions) * 100 
    : 0;

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No creative data available for the selected time period
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/50 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead className="w-[300px]">
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 font-semibold hover:bg-transparent"
                onClick={() => handleSort('name')}
              >
                Creative Name
                <SortIcon field="name" />
              </Button>
            </TableHead>
            <TableHead className="text-right">
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 font-semibold hover:bg-transparent ml-auto"
                onClick={() => handleSort('impressions')}
              >
                Impressions
                <SortIcon field="impressions" />
              </Button>
            </TableHead>
            <TableHead className="text-right">
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 font-semibold hover:bg-transparent ml-auto"
                onClick={() => handleSort('clicks')}
              >
                Clicks
                <SortIcon field="clicks" />
              </Button>
            </TableHead>
            <TableHead className="text-right">
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 font-semibold hover:bg-transparent ml-auto"
                onClick={() => handleSort('spent')}
              >
                Spent
                <SortIcon field="spent" />
              </Button>
            </TableHead>
            <TableHead className="text-right">
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 font-semibold hover:bg-transparent ml-auto"
                onClick={() => handleSort('leads')}
              >
                Leads
                <SortIcon field="leads" />
              </Button>
            </TableHead>
            <TableHead className="text-right">
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 font-semibold hover:bg-transparent ml-auto"
                onClick={() => handleSort('ctr')}
              >
                CTR
                <SortIcon field="ctr" />
              </Button>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedData.map((item, index) => (
            <TableRow key={index} className="hover:bg-muted/20">
              <TableCell className="font-medium">{item.name}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatNumber(item.impressions)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatNumber(item.clicks)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(item.spent)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatNumber(item.leads)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatPercentage(item.ctr)}
              </TableCell>
            </TableRow>
          ))}
          {/* Totals row */}
          <TableRow className="bg-muted/50 font-semibold border-t-2 border-border">
            <TableCell>Total</TableCell>
            <TableCell className="text-right tabular-nums">
              {formatNumber(totals.impressions)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatNumber(totals.clicks)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatCurrency(totals.spent)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatNumber(totals.leads)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatPercentage(totalCtr)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
