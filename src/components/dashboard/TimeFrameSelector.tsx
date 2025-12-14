import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';
import { TimeFrameOption, TimeGranularity } from '@/hooks/useAdReporting';

interface TimeFrameSelectorProps {
  timeFrameOptions: TimeFrameOption[];
  selectedTimeFrame: string;
  onTimeFrameChange: (option: TimeFrameOption) => void;
  timeGranularity: TimeGranularity;
  onGranularityChange: (granularity: TimeGranularity) => void;
  dateRange: { start: string; end: string };
}

export function TimeFrameSelector({
  timeFrameOptions,
  selectedTimeFrame,
  onTimeFrameChange,
  timeGranularity,
  onGranularityChange,
  dateRange,
}: TimeFrameSelectorProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Time Period:</span>
      </div>
      
      <Select
        value={selectedTimeFrame}
        onValueChange={(value) => {
          const option = timeFrameOptions.find(o => o.value === value);
          if (option) onTimeFrameChange(option);
        }}
      >
        <SelectTrigger className="w-[160px] bg-background/50">
          <SelectValue placeholder="Select period" />
        </SelectTrigger>
        <SelectContent>
          {timeFrameOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="h-6 w-px bg-border/50 hidden sm:block" />

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Group by:</span>
        <div className="flex gap-1">
          {(['DAILY', 'MONTHLY', 'ALL'] as TimeGranularity[]).map((granularity) => (
            <Button
              key={granularity}
              variant={timeGranularity === granularity ? 'default' : 'outline'}
              size="sm"
              onClick={() => onGranularityChange(granularity)}
              className="text-xs"
            >
              {granularity === 'ALL' ? 'Total' : granularity.charAt(0) + granularity.slice(1).toLowerCase()}
            </Button>
          ))}
        </div>
      </div>

      <div className="h-6 w-px bg-border/50 hidden sm:block" />

      <div className="text-xs text-muted-foreground">
        {dateRange.start} → {dateRange.end}
      </div>
    </div>
  );
}
