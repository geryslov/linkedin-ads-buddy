import { MatrixData, MetricType } from '@/hooks/useJobSeniorityMatrix';
import { MatrixColorLegend } from './MatrixColorLegend';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

interface JobSeniorityMatrixProps {
  matrixData: MatrixData | null;
  isLoading: boolean;
  selectedMetric: MetricType;
  onMetricChange: (metric: MetricType) => void;
}

const METRIC_OPTIONS: { value: MetricType; label: string }[] = [
  { value: 'impressions', label: 'Impressions' },
  { value: 'clicks', label: 'Clicks' },
  { value: 'ctr', label: 'CTR (%)' },
  { value: 'spent', label: 'Spent ($)' },
  { value: 'cpc', label: 'CPC ($)' },
  { value: 'cpm', label: 'CPM ($)' },
  { value: 'leads', label: 'Leads' },
  { value: 'cpl', label: 'CPL ($)' },
];

const getHeatmapColor = (value: number, min: number, max: number): string => {
  if (value === 0) return 'hsl(220, 10%, 95%)'; // Light gray for no data
  if (max <= min) return 'hsl(220, 50%, 75%)';
  const normalized = (value - min) / (max - min);
  // Blue gradient: lighter for low values, darker for high
  const lightness = 92 - (normalized * 47); // 92% to 45%
  const saturation = 40 + (normalized * 30); // 40% to 70%
  return `hsl(220, ${saturation}%, ${lightness}%)`;
};

const formatCellValue = (value: number, metric: MetricType): string => {
  switch (metric) {
    case 'impressions':
    case 'clicks':
    case 'leads':
      return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toFixed(0);
    case 'spent':
    case 'cpc':
    case 'cpm':
    case 'cpl':
      return `$${value.toFixed(0)}`;
    case 'ctr':
      return `${value.toFixed(1)}%`;
    default:
      return value.toString();
  }
};

const formatTooltipValue = (value: number, metric: MetricType): string => {
  switch (metric) {
    case 'impressions':
    case 'clicks':
    case 'leads':
      return value.toLocaleString();
    case 'spent':
    case 'cpc':
    case 'cpm':
    case 'cpl':
      return `$${value.toFixed(2)}`;
    case 'ctr':
      return `${value.toFixed(2)}%`;
    default:
      return value.toString();
  }
};

export function JobSeniorityMatrix({ matrixData, isLoading, selectedMetric, onMetricChange }: JobSeniorityMatrixProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-6 w-48" />
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!matrixData || matrixData.rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-lg font-medium text-muted-foreground">No data available</p>
        <p className="text-sm text-muted-foreground mt-1">
          Select an account and time range to view the job function × seniority matrix
        </p>
      </div>
    );
  }

  const { rows, columns, cells, minValue, maxValue } = matrixData;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Color by:</span>
          <Select value={selectedMetric} onValueChange={(v) => onMetricChange(v as MetricType)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {METRIC_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <MatrixColorLegend minValue={minValue} maxValue={maxValue} metric={selectedMetric} />
      </div>

      {/* Matrix Grid */}
      <ScrollArea className="w-full">
        <div className="min-w-[600px]">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-background border border-border p-2 text-left font-semibold min-w-[140px]">
                  Job Function
                </th>
                {columns.map(col => (
                  <th key={col} className="border border-border p-2 text-center font-medium min-w-[80px]">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row}>
                  <td className="sticky left-0 z-10 bg-background border border-border p-2 font-medium">
                    {row}
                  </td>
                  {columns.map(col => {
                    const key = `${row}|${col}`;
                    const cell = cells.get(key);
                    const value = cell ? cell[selectedMetric] : 0;
                    const bgColor = getHeatmapColor(value, minValue, maxValue);
                    const textColor = value === 0 ? 'text-muted-foreground' : 
                      (value - minValue) / (maxValue - minValue) > 0.6 ? 'text-white' : 'text-foreground';

                    return (
                      <TooltipProvider key={key}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <td 
                              className={`border border-border p-2 text-center cursor-default transition-colors hover:ring-2 hover:ring-primary/50 ${textColor}`}
                              style={{ backgroundColor: bgColor }}
                            >
                              {value > 0 ? formatCellValue(value, selectedMetric) : '—'}
                            </td>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            {cell ? (
                              <div className="space-y-1">
                                <p className="font-semibold">{row} × {col}</p>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                  <span>Impressions:</span>
                                  <span className="font-medium">{formatTooltipValue(cell.impressions, 'impressions')}</span>
                                  <span>Clicks:</span>
                                  <span className="font-medium">{formatTooltipValue(cell.clicks, 'clicks')}</span>
                                  <span>CTR:</span>
                                  <span className="font-medium">{formatTooltipValue(cell.ctr, 'ctr')}</span>
                                  <span>Spent:</span>
                                  <span className="font-medium">{formatTooltipValue(cell.spent, 'spent')}</span>
                                  <span>CPC:</span>
                                  <span className="font-medium">{formatTooltipValue(cell.cpc, 'cpc')}</span>
                                  <span>CPM:</span>
                                  <span className="font-medium">{formatTooltipValue(cell.cpm, 'cpm')}</span>
                                  <span>Leads:</span>
                                  <span className="font-medium">{formatTooltipValue(cell.leads, 'leads')}</span>
                                  <span>CPL:</span>
                                  <span className="font-medium">{formatTooltipValue(cell.cpl, 'cpl')}</span>
                                </div>
                              </div>
                            ) : (
                              <p>No data for {row} × {col}</p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
