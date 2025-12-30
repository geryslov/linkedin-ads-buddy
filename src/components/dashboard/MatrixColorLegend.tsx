import { MetricType } from '@/hooks/useJobSeniorityMatrix';

interface MatrixColorLegendProps {
  minValue: number;
  maxValue: number;
  metric: MetricType;
}

const formatValue = (value: number, metric: MetricType): string => {
  switch (metric) {
    case 'impressions':
    case 'clicks':
    case 'leads':
      return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toFixed(0);
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

export function MatrixColorLegend({ minValue, maxValue, metric }: MatrixColorLegendProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground">Low</span>
      <div 
        className="h-3 w-32 rounded-sm"
        style={{
          background: 'linear-gradient(to right, hsl(220, 40%, 92%), hsl(220, 70%, 45%))'
        }}
      />
      <span className="text-xs text-muted-foreground">High</span>
      <span className="text-xs text-muted-foreground ml-2">
        ({formatValue(minValue, metric)} - {formatValue(maxValue, metric)})
      </span>
    </div>
  );
}
