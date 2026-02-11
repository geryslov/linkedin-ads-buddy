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
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUpDown, Search } from 'lucide-react';
import { CampaignGroupPerformanceItem } from '@/hooks/useCampaignGroupPerformance';
import { CustomFieldEditor } from './CustomFieldEditor';
import { GroupedCustomFields } from '@/hooks/useCustomFields';

interface CampaignGroupPerformanceTableProps {
  data: CampaignGroupPerformanceItem[];
  isLoading: boolean;
  customFields?: GroupedCustomFields;
  uniqueFieldNames?: string[];
  onSaveCustomField?: (entityId: string, fieldName: string, fieldValue: string) => Promise<boolean>;
  onDeleteCustomField?: (entityId: string, fieldName: string) => Promise<boolean>;
}

type SortField = 'campaignGroupName' | 'spent' | 'impressions' | 'clicks' | 'leads' | 'ctr' | 'avgCpc' | 'cpl';
type SortDirection = 'asc' | 'desc';

export function CampaignGroupPerformanceTable({
  data,
  isLoading,
  customFields = {},
  uniqueFieldNames = [],
  onSaveCustomField,
  onDeleteCustomField
}: CampaignGroupPerformanceTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('spent');
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
    let result = [...data];

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(item =>
        item.campaignGroupName.toLowerCase().includes(term)
      );
    }

    // Sort
    result.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return sortDirection === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });

    return result;
  }, [data, searchTerm, sortField, sortDirection]);

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 data-[state=open]:bg-accent"
      onClick={() => handleSort(field)}
    >
      {children}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="default" className="bg-green-600">Active</Badge>;
      case 'PAUSED':
        return <Badge variant="secondary">Paused</Badge>;
      case 'ARCHIVED':
        return <Badge variant="outline">Archived</Badge>;
      case 'DRAFT':
        return <Badge variant="outline">Draft</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
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
      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search campaign groups..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
        <span className="text-sm text-muted-foreground">
          {filteredAndSortedData.length} of {data.length} groups
        </span>
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-x-auto">
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[200px]">
                <SortButton field="campaignGroupName">Campaign Group Name</SortButton>
              </TableHead>
              <TableHead className="whitespace-nowrap">Status</TableHead>
              <TableHead className="text-right">
                <SortButton field="spent">Total Spent</SortButton>
              </TableHead>
              <TableHead className="text-right">
                <SortButton field="impressions">Impressions</SortButton>
              </TableHead>
              <TableHead className="text-right">
                <SortButton field="clicks">Clicks</SortButton>
              </TableHead>
              <TableHead className="text-right">
                <SortButton field="leads">Leads</SortButton>
              </TableHead>
              <TableHead className="text-right">
                <SortButton field="ctr">CTR</SortButton>
              </TableHead>
              <TableHead className="text-right">
                <SortButton field="avgCpc">Avg. CPC</SortButton>
              </TableHead>
              <TableHead className="text-right">
                <SortButton field="cpl">CPL</SortButton>
              </TableHead>
              {onSaveCustomField && (
                <TableHead className="whitespace-nowrap">Custom Fields</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={onSaveCustomField ? 10 : 9} className="h-24 text-center">
                  No campaign groups found.
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedData.map((group) => (
                <TableRow key={group.campaignGroupId}>
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span className="break-words">
                        {group.campaignGroupName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ID: {group.campaignGroupId}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(group.status)}</TableCell>
                  <TableCell className="text-right font-medium">
                    ${group.spent.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    {group.impressions.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {group.clicks.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {group.leads.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {group.ctr.toFixed(2)}%
                  </TableCell>
                  <TableCell className="text-right">
                    ${group.avgCpc.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    {group.leads > 0 ? `$${group.cpl.toFixed(2)}` : '-'}
                  </TableCell>
                  {onSaveCustomField && onDeleteCustomField && (
                    <TableCell>
                      <CustomFieldEditor
                        entityType="campaign_group"
                        entityId={group.campaignGroupId}
                        entityName={group.campaignGroupName}
                        currentFields={customFields[`campaign_group:${group.campaignGroupId}`] || {}}
                        onSave={(fieldName, fieldValue) => onSaveCustomField(group.campaignGroupId, fieldName, fieldValue)}
                        onDelete={(fieldName) => onDeleteCustomField(group.campaignGroupId, fieldName)}
                        existingFieldNames={uniqueFieldNames}
                      />
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
