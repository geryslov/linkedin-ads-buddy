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
import { SegmentedControl } from './widgets';
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
      <div className="flex items-center gap-1.5">
        <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Period</span>
      </div>

      <Select
        value={isCustom ? 'custom' : selectedTimeFrame}
        onValueChange={handleTimeFrameChange}
      >
        <SelectTrigger className="h-8 w-[150px] text-sm bg-card border-border">
          <SelectValue placeholder="Select period" />
        </SelectTrigger>
        <SelectContent className="bg-card border-border">
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
                  "h-8 w-[130px] justify-start text-left font-normal",
                  !startDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                {startDate ? format(startDate, "MMM dd, yyyy") : "Start date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-card border-border" align="start">
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

          <span className="text-muted-foreground text-xs">→</span>

          <Popover open={endOpen} onOpenChange={setEndOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "h-8 w-[130px] justify-start text-left font-normal",
                  !endDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                {endDate ? format(endDate, "MMM dd, yyyy") : "End date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-card border-border" align="start">
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

      <div className="h-5 w-px bg-border hidden sm:block" />

      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Group by</span>
        <SegmentedControl<TimeGranularity>
          size="sm"
          value={timeGranularity}
          onChange={onGranularityChange}
          options={[
            { value: 'DAILY', label: 'Daily' },
            { value: 'MONTHLY', label: 'Monthly' },
            { value: 'ALL', label: 'Total' },
          ]}
        />
      </div>

      {!isCustom && (
        <>
          <div className="h-5 w-px bg-border hidden sm:block" />
          <div className="text-xs text-muted-foreground tabular-nums">
            {dateRange.start} → {dateRange.end}
          </div>
        </>
      )}
    </div>
  );
}
