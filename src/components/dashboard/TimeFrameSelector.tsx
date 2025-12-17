import { useState } from 'react';
import { format } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { TimeFrameOption, TimeGranularity } from '@/hooks/useDemographicReporting';
import { cn } from '@/lib/utils';

interface TimeFrameSelectorProps {
  timeFrameOptions: TimeFrameOption[];
  selectedTimeFrame: string;
  onTimeFrameChange: (option: TimeFrameOption) => void;
  timeGranularity: TimeGranularity;
  onGranularityChange: (granularity: TimeGranularity) => void;
  dateRange: { start: string; end: string };
  onCustomDateChange?: (start: Date, end: Date) => void;
}

export function TimeFrameSelector({
  timeFrameOptions,
  selectedTimeFrame,
  onTimeFrameChange,
  timeGranularity,
  onGranularityChange,
  dateRange,
  onCustomDateChange,
}: TimeFrameSelectorProps) {
  const [isCustom, setIsCustom] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>(
    dateRange.start ? new Date(dateRange.start) : undefined
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    dateRange.end ? new Date(dateRange.end) : undefined
  );
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  const handleTimeFrameChange = (value: string) => {
    if (value === 'custom') {
      setIsCustom(true);
    } else {
      setIsCustom(false);
      const option = timeFrameOptions.find(o => o.value === value);
      if (option) onTimeFrameChange(option);
    }
  };

  const handleStartDateSelect = (date: Date | undefined) => {
    if (date) {
      setStartDate(date);
      setStartOpen(false);
      if (endDate && onCustomDateChange) {
        onCustomDateChange(date, endDate);
      }
    }
  };

  const handleEndDateSelect = (date: Date | undefined) => {
    if (date) {
      setEndDate(date);
      setEndOpen(false);
      if (startDate && onCustomDateChange) {
        onCustomDateChange(startDate, date);
      }
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Time Period:</span>
      </div>
      
      <Select
        value={isCustom ? 'custom' : selectedTimeFrame}
        onValueChange={handleTimeFrameChange}
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
          <SelectItem value="custom">Custom Range</SelectItem>
        </SelectContent>
      </Select>

      {isCustom && (
        <div className="flex items-center gap-2">
          <Popover open={startOpen} onOpenChange={setStartOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "w-[130px] justify-start text-left font-normal",
                  !startDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? format(startDate, "MMM dd, yyyy") : "Start date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={handleStartDateSelect}
                disabled={(date) => date > new Date() || (endDate ? date > endDate : false)}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          
          <span className="text-muted-foreground">→</span>
          
          <Popover open={endOpen} onOpenChange={setEndOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "w-[130px] justify-start text-left font-normal",
                  !endDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {endDate ? format(endDate, "MMM dd, yyyy") : "End date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={handleEndDateSelect}
                disabled={(date) => date > new Date() || (startDate ? date < startDate : false)}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      )}

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

      {!isCustom && (
        <>
          <div className="h-6 w-px bg-border/50 hidden sm:block" />
          <div className="text-xs text-muted-foreground">
            {dateRange.start} → {dateRange.end}
          </div>
        </>
      )}
    </div>
  );
}
