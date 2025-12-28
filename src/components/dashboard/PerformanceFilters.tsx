import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Target, SlidersHorizontal, X, Plus, Trash2 } from 'lucide-react';

export const CAMPAIGN_TYPE_OPTIONS = [
  { value: 'all', label: 'All Campaign Types' },
  { value: 'LEAD_GENERATION', label: 'Lead Generation' },
  { value: 'ENGAGEMENT', label: 'Engagement' },
  { value: 'BRAND_AWARENESS', label: 'Brand Awareness' },
  { value: 'WEBSITE_VISITS', label: 'Website Visits' },
  { value: 'VIDEO_VIEWS', label: 'Video Views' },
  { value: 'JOB_APPLICANTS', label: 'Job Applicants' },
  { value: 'WEBSITE_CONVERSIONS', label: 'Website Conversions' },
];

export type MetricOperator = 'lt' | 'gt' | 'lte' | 'gte' | 'eq';

export interface MetricFilter {
  id: string;
  metric: string;
  operator: MetricOperator;
  value: number;
}

export const METRIC_OPTIONS = [
  { value: 'ctr', label: 'CTR (%)', suffix: '%' },
  { value: 'cpc', label: 'CPC ($)', prefix: '$' },
  { value: 'cpm', label: 'CPM ($)', prefix: '$' },
  { value: 'costPerLead', label: 'Cost Per Lead ($)', prefix: '$' },
  { value: 'impressions', label: 'Impressions', suffix: '' },
  { value: 'clicks', label: 'Clicks', suffix: '' },
  { value: 'spent', label: 'Spent ($)', prefix: '$' },
  { value: 'leads', label: 'Leads', suffix: '' },
];

export const OPERATOR_OPTIONS: { value: MetricOperator; label: string; symbol: string }[] = [
  { value: 'lt', label: 'Less than', symbol: '<' },
  { value: 'lte', label: 'Less than or equal', symbol: '≤' },
  { value: 'gt', label: 'Greater than', symbol: '>' },
  { value: 'gte', label: 'Greater than or equal', symbol: '≥' },
  { value: 'eq', label: 'Equals', symbol: '=' },
];

interface PerformanceFiltersProps {
  campaignType: string;
  onCampaignTypeChange: (value: string) => void;
  metricFilters: MetricFilter[];
  onMetricFiltersChange: (filters: MetricFilter[]) => void;
  showCampaignType?: boolean;
}

export function PerformanceFilters({
  campaignType,
  onCampaignTypeChange,
  metricFilters,
  onMetricFiltersChange,
  showCampaignType = true,
}: PerformanceFiltersProps) {
  const [isMetricFilterOpen, setIsMetricFilterOpen] = useState(false);

  const addMetricFilter = () => {
    const newFilter: MetricFilter = {
      id: crypto.randomUUID(),
      metric: 'ctr',
      operator: 'lt',
      value: 1,
    };
    onMetricFiltersChange([...metricFilters, newFilter]);
  };

  const updateMetricFilter = (id: string, updates: Partial<MetricFilter>) => {
    onMetricFiltersChange(
      metricFilters.map((f) => (f.id === id ? { ...f, ...updates } : f))
    );
  };

  const removeMetricFilter = (id: string) => {
    onMetricFiltersChange(metricFilters.filter((f) => f.id !== id));
  };

  const getMetricLabel = (metricValue: string) => {
    return METRIC_OPTIONS.find((m) => m.value === metricValue)?.label || metricValue;
  };

  const getOperatorSymbol = (op: MetricOperator) => {
    return OPERATOR_OPTIONS.find((o) => o.value === op)?.symbol || op;
  };

  const formatFilterBadge = (filter: MetricFilter) => {
    const metric = METRIC_OPTIONS.find((m) => m.value === filter.metric);
    const prefix = metric?.prefix || '';
    const suffix = metric?.suffix || '';
    return `${getMetricLabel(filter.metric)} ${getOperatorSymbol(filter.operator)} ${prefix}${filter.value}${suffix}`;
  };

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {showCampaignType && (
        <Select value={campaignType} onValueChange={onCampaignTypeChange}>
          <SelectTrigger className="w-[180px]">
            <Target className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Campaign Type" />
          </SelectTrigger>
          <SelectContent>
            {CAMPAIGN_TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Metric Filters Popover */}
      <Popover open={isMetricFilterOpen} onOpenChange={setIsMetricFilterOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            Performance Filters
            {metricFilters.length > 0 && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
                {metricFilters.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-4" align="start">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">Metric Filters</h4>
              <Button variant="ghost" size="sm" onClick={addMetricFilter} className="gap-1 h-7">
                <Plus className="h-3 w-3" />
                Add Filter
              </Button>
            </div>

            {metricFilters.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                No filters applied. Click "Add Filter" to filter by performance metrics.
              </p>
            ) : (
              <div className="space-y-3">
                {metricFilters.map((filter) => (
                  <div key={filter.id} className="flex items-center gap-2">
                    <Select
                      value={filter.metric}
                      onValueChange={(v) => updateMetricFilter(filter.id, { metric: v })}
                    >
                      <SelectTrigger className="w-[120px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {METRIC_OPTIONS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={filter.operator}
                      onValueChange={(v) =>
                        updateMetricFilter(filter.id, { operator: v as MetricOperator })
                      }
                    >
                      <SelectTrigger className="w-[60px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPERATOR_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.symbol}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Input
                      type="number"
                      value={filter.value}
                      onChange={(e) =>
                        updateMetricFilter(filter.id, { value: parseFloat(e.target.value) || 0 })
                      }
                      className="w-[80px] h-8 text-xs"
                      step="0.01"
                    />

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => removeMetricFilter(filter.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="text-xs text-muted-foreground pt-2 border-t">
              <p className="font-medium mb-1">Examples:</p>
              <ul className="space-y-0.5">
                <li>• CTR &lt; 1% (find underperforming ads)</li>
                <li>• Cost Per Lead &gt; $500 (find expensive leads)</li>
                <li>• Impressions &gt; 10000 (find high-reach ads)</li>
              </ul>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Active Filter Badges */}
      {metricFilters.map((filter) => (
        <Badge
          key={filter.id}
          variant="secondary"
          className="gap-1 pr-1 cursor-pointer hover:bg-destructive/20"
          onClick={() => removeMetricFilter(filter.id)}
        >
          {formatFilterBadge(filter)}
          <X className="h-3 w-3" />
        </Badge>
      ))}

      {(campaignType !== 'all' || metricFilters.length > 0) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onCampaignTypeChange('all');
            onMetricFiltersChange([]);
          }}
          className="gap-1 h-7 text-xs"
        >
          <X className="h-3 w-3" />
          Clear All
        </Button>
      )}
    </div>
  );
}

// Utility function to apply metric filters to data
export function applyMetricFilters<T extends Record<string, any>>(
  data: T[],
  filters: MetricFilter[]
): T[] {
  if (filters.length === 0) return data;

  return data.filter((item) => {
    return filters.every((filter) => {
      const value = item[filter.metric];
      if (typeof value !== 'number') return true;

      switch (filter.operator) {
        case 'lt':
          return value < filter.value;
        case 'lte':
          return value <= filter.value;
        case 'gt':
          return value > filter.value;
        case 'gte':
          return value >= filter.value;
        case 'eq':
          return value === filter.value;
        default:
          return true;
      }
    });
  });
}

// Utility function to apply campaign type filter
export function applyCampaignTypeFilter<T extends { campaignType?: string; objectiveType?: string }>(
  data: T[],
  campaignType: string
): T[] {
  if (campaignType === 'all') return data;
  return data.filter(
    (item) => item.campaignType === campaignType || item.objectiveType === campaignType
  );
}
