import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUpDown } from 'lucide-react';
import { useState } from 'react';
import { AggregatedAdData } from '@/hooks/useAdReporting';

interface AdReportingTableProps {
  data: AggregatedAdData[];
  isLoading: boolean;
}

type SortKey = 'name' | 'impressions' | 'clicks' | 'spent' | 'leads' | 'ctr';
type SortOrder = 'asc' | 'desc';

export function AdReportingTable({ data, isLoading }: AdReportingTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('impressions');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  const sortedData = [...data].sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    const modifier = sortOrder === 'asc' ? 1 : -1;
    
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return aVal.localeCompare(bVal) * modifier;
    }
    return ((aVal as number) - (bVal as number)) * modifier;
  });

  const totals = data.reduce(
    (acc, item) => ({
      impressions: acc.impressions + item.impressions,
      clicks: acc.clicks + item.clicks,
      spent: acc.spent + item.spent,
      leads: acc.leads + item.leads,
    }),
    { impressions: 0, clicks: 0, spent: 0, leads: 0 }
  );

  const totalCtr = totals.impressions > 0 
    ? ((totals.clicks / totals.impressions) * 100).toFixed(2) 
    : '0.00';

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No ad data available for the selected time period
      </div>
    );
  }

  const SortableHeader = ({ label, sortKeyName }: { label: string; sortKeyName: SortKey }) => (
    <TableHead 
      className="cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={() => handleSort(sortKeyName)}
    >
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown className="h-3 w-3" />
      </div>
    </TableHead>
  );

  return (
    <div className="rounded-md border border-border/50">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <SortableHeader label="Campaign Name" sortKeyName="name" />
            <SortableHeader label="Impressions" sortKeyName="impressions" />
            <SortableHeader label="Clicks" sortKeyName="clicks" />
            <SortableHeader label="Spent" sortKeyName="spent" />
            <SortableHeader label="Leads" sortKeyName="leads" />
            <SortableHeader label="CTR" sortKeyName="ctr" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedData.map((row, index) => (
            <TableRow key={index} className="hover:bg-muted/20">
              <TableCell className="font-medium">{row.name}</TableCell>
              <TableCell>{row.impressions.toLocaleString()}</TableCell>
              <TableCell>{row.clicks.toLocaleString()}</TableCell>
              <TableCell>${row.spent.toFixed(2)}</TableCell>
              <TableCell>{row.leads.toLocaleString()}</TableCell>
              <TableCell>{row.ctr.toFixed(2)}%</TableCell>
            </TableRow>
          ))}
          {/* Totals Row */}
          <TableRow className="bg-muted/50 font-semibold border-t-2">
            <TableCell>Total ({data.length} campaigns)</TableCell>
            <TableCell>{totals.impressions.toLocaleString()}</TableCell>
            <TableCell>{totals.clicks.toLocaleString()}</TableCell>
            <TableCell>${totals.spent.toFixed(2)}</TableCell>
            <TableCell>{totals.leads.toLocaleString()}</TableCell>
            <TableCell>{totalCtr}%</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
