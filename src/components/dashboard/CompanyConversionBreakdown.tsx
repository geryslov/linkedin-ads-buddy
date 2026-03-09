import { useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, Grid3x3 } from 'lucide-react';
import { useCompanyConversionBreakdown } from '@/hooks/useCompanyConversionBreakdown';

interface CompanyConversionBreakdownProps {
  accessToken: string | null;
  selectedAccount: string | null;
}

export function CompanyConversionBreakdown({ accessToken, selectedAccount }: CompanyConversionBreakdownProps) {
  const {
    data,
    isLoading,
    error,
    dateRange,
    timeFrameOptions,
    setTimeFrame,
    fetchBreakdown,
  } = useCompanyConversionBreakdown(accessToken);

  useEffect(() => {
    if (selectedAccount) {
      fetchBreakdown(selectedAccount);
    }
  }, [selectedAccount, fetchBreakdown]);

  // Derive currently selected time frame label
  const selectedTimeFrameValue = (() => {
    for (const opt of timeFrameOptions) {
      const start = opt.startDate.toISOString().split('T')[0];
      const end = opt.endDate.toISOString().split('T')[0];
      if (start === dateRange.start && end === dateRange.end) return opt.value;
    }
    return 'custom';
  })();

  const handleTimeFrameChange = (value: string) => {
    const opt = timeFrameOptions.find(o => o.value === value);
    if (opt) setTimeFrame(opt);
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-48 bg-secondary" />
        </div>
        <div className="glass rounded-xl p-6 space-y-3">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full bg-secondary" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="glass rounded-xl p-12 text-center space-y-2">
        <p className="text-destructive font-medium">Failed to load conversion breakdown</p>
        <p className="text-muted-foreground text-sm">{error}</p>
      </div>
    );
  }

  // No account selected
  if (!selectedAccount) {
    return (
      <div className="glass rounded-xl p-12 text-center">
        <p className="text-muted-foreground">Select an account to view conversion breakdown</p>
      </div>
    );
  }

  // Empty state — no conversions configured
  if (data && data.conversions.length === 0) {
    return (
      <div className="space-y-4">
        <TimeFramePicker
          value={selectedTimeFrameValue}
          options={timeFrameOptions}
          onChange={handleTimeFrameChange}
        />
        <div className="glass rounded-xl p-12 text-center space-y-3">
          <Grid3x3 className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground font-medium">No conversion events configured for this account</p>
          <p className="text-muted-foreground text-sm">
            Set up conversion tracking in LinkedIn Campaign Manager to see per-company breakdown.
          </p>
        </div>
      </div>
    );
  }

  // No data yet (initial state)
  if (!data) {
    return (
      <div className="space-y-4">
        <TimeFramePicker
          value={selectedTimeFrameValue}
          options={timeFrameOptions}
          onChange={handleTimeFrameChange}
        />
        <div className="glass rounded-xl p-12 text-center">
          <p className="text-muted-foreground">No data available for the selected period</p>
        </div>
      </div>
    );
  }

  const { conversions, companies } = data;
  const cappedNote = conversions.length === 20;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Building2 className="h-4 w-4" />
          <span>{companies.length} companies</span>
          {cappedNote && (
            <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
              Showing top 20 conversions
            </span>
          )}
        </div>
        <TimeFramePicker
          value={selectedTimeFrameValue}
          options={timeFrameOptions}
          onChange={handleTimeFrameChange}
        />
      </div>

      {companies.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <p className="text-muted-foreground">No conversion data for the selected period</p>
        </div>
      ) : (
        <div className="glass rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px] sticky left-0 bg-card z-10">Company</TableHead>
                  {conversions.map(conv => (
                    <TableHead key={conv.id} className="text-center min-w-[120px] whitespace-nowrap">
                      {conv.name}
                    </TableHead>
                  ))}
                  <TableHead className="text-center font-semibold min-w-[80px]">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map(company => (
                  <TableRow key={company.entityUrn}>
                    <TableCell className="font-medium sticky left-0 bg-card z-10">
                      {company.entityName}
                    </TableCell>
                    {conversions.map(conv => {
                      const count = company.byConversion[conv.id] || 0;
                      return (
                        <TableCell key={conv.id} className="text-center">
                          {count > 0 ? count.toLocaleString() : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center font-semibold">
                      {company.totalConversions.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}

interface TimeFramePickerProps {
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}

function TimeFramePicker({ value, options, onChange }: TimeFramePickerProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-44">
        <SelectValue placeholder="Select time frame" />
      </SelectTrigger>
      <SelectContent>
        {options.map(opt => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
