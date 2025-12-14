import React, { useState, useMemo } from 'react';
import { 
  Table, TableBody, TableCell, TableHead, 
  TableHeader, TableRow 
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { CompanyIntelligence } from '@/hooks/useCompanyIntelligence';
import { Search, ArrowUpDown, ArrowUp, ArrowDown, ExternalLink } from 'lucide-react';

interface CompanyIntelligenceTableProps {
  data: CompanyIntelligence[];
  isLoading: boolean;
}

type SortKey = 'companyName' | 'paidImpressions' | 'paidClicks' | 'paidLeads' | 'paidEngagements' | 'organicImpressions' | 'organicEngagements' | 'engagementLevel' | 'paidCtr';
type SortOrder = 'asc' | 'desc';
type EngagementFilter = 'all' | 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY_LOW';

const engagementLevelOrder: Record<string, number> = {
  'VERY_HIGH': 5,
  'HIGH': 4,
  'MEDIUM': 3,
  'LOW': 2,
  'VERY_LOW': 1,
  'UNKNOWN': 0,
};

const engagementLevelColors: Record<string, string> = {
  'VERY_HIGH': 'bg-green-500/20 text-green-700 border-green-500/30',
  'HIGH': 'bg-emerald-500/20 text-emerald-700 border-emerald-500/30',
  'MEDIUM': 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30',
  'LOW': 'bg-orange-500/20 text-orange-700 border-orange-500/30',
  'VERY_LOW': 'bg-red-500/20 text-red-700 border-red-500/30',
  'UNKNOWN': 'bg-muted text-muted-foreground',
};

export function CompanyIntelligenceTable({ data, isLoading }: CompanyIntelligenceTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('paidImpressions');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [engagementFilter, setEngagementFilter] = useState<EngagementFilter>('all');

  const filteredAndSortedData = useMemo(() => {
    let result = [...data];

    // Apply engagement filter
    if (engagementFilter !== 'all') {
      result = result.filter(item => item.engagementLevel === engagementFilter);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item => 
        item.companyName.toLowerCase().includes(query) ||
        item.companyWebsite.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    result.sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;
      
      if (sortKey === 'engagementLevel') {
        aVal = engagementLevelOrder[a.engagementLevel] || 0;
        bVal = engagementLevelOrder[b.engagementLevel] || 0;
      } else if (sortKey === 'companyName') {
        aVal = a.companyName.toLowerCase();
        bVal = b.companyName.toLowerCase();
      } else if (sortKey === 'paidCtr') {
        aVal = parseFloat(a.paidCtr);
        bVal = parseFloat(b.paidCtr);
      } else {
        aVal = a[sortKey];
        bVal = b[sortKey];
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      
      return sortOrder === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

    return result;
  }, [data, searchQuery, sortKey, sortOrder, engagementFilter]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  const SortableHeader = ({ label, sortKeyName }: { label: string; sortKeyName: SortKey }) => (
    <TableHead 
      className="cursor-pointer hover:bg-muted/50 transition-colors whitespace-nowrap"
      onClick={() => handleSort(sortKeyName)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortKey === sortKeyName ? (
          sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-50" />
        )}
      </div>
    </TableHead>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by company name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={engagementFilter} onValueChange={(v) => setEngagementFilter(v as EngagementFilter)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Engagement Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="VERY_HIGH">Very High</SelectItem>
            <SelectItem value="HIGH">High</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="LOW">Low</SelectItem>
            <SelectItem value="VERY_LOW">Very Low</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-sm text-muted-foreground flex items-center">
          Showing {filteredAndSortedData.length} of {data.length} companies
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <SortableHeader label="Company Name" sortKeyName="companyName" />
                <SortableHeader label="Engagement" sortKeyName="engagementLevel" />
                <SortableHeader label="Paid Impressions" sortKeyName="paidImpressions" />
                <SortableHeader label="Paid Clicks" sortKeyName="paidClicks" />
                <SortableHeader label="CTR" sortKeyName="paidCtr" />
                <SortableHeader label="Leads" sortKeyName="paidLeads" />
                <SortableHeader label="Paid Engagements" sortKeyName="paidEngagements" />
                <SortableHeader label="Organic Impressions" sortKeyName="organicImpressions" />
                <SortableHeader label="Organic Engagements" sortKeyName="organicEngagements" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    {data.length === 0 
                      ? 'No company intelligence data available. This API requires special provisioning from LinkedIn.'
                      : 'No companies match your search criteria'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedData.map((row, index) => (
                  <TableRow key={`${row.companyName}-${index}`} className="hover:bg-muted/30">
                    <TableCell className="font-medium max-w-[250px]">
                      <div className="flex items-center gap-2">
                        <span className="truncate" title={row.companyName}>
                          {row.companyName}
                        </span>
                        {row.companyPageUrl && (
                          <a 
                            href={row.companyPageUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-primary"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline" 
                        className={engagementLevelColors[row.engagementLevel] || engagementLevelColors['UNKNOWN']}
                      >
                        {row.engagementLevel.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>{row.paidImpressions.toLocaleString()}</TableCell>
                    <TableCell>{row.paidClicks.toLocaleString()}</TableCell>
                    <TableCell>{row.paidCtr}%</TableCell>
                    <TableCell>{row.paidLeads.toLocaleString()}</TableCell>
                    <TableCell>{row.paidEngagements.toLocaleString()}</TableCell>
                    <TableCell>{row.organicImpressions.toLocaleString()}</TableCell>
                    <TableCell>{row.organicEngagements.toLocaleString()}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
