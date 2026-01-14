import { cn } from "@/lib/utils";
import { PaceStatus } from "@/lib/paceCalculations";

interface BudgetProgressBarProps {
  percentUsed: number;
  expectedPercent: number;
  status: PaceStatus;
  className?: string;
}

export function BudgetProgressBar({ 
  percentUsed, 
  expectedPercent,
  status, 
  className 
}: BudgetProgressBarProps) {
  const clampedPercent = Math.min(100, Math.max(0, percentUsed));
  const clampedExpected = Math.min(100, Math.max(0, expectedPercent));
  
  const barColorClass = {
    on_track: 'bg-green-500',
    overspending: 'bg-destructive',
    underspending: 'bg-yellow-500',
    no_budget: 'bg-muted-foreground',
  }[status];

  return (
    <div className={cn("relative w-full", className)}>
      {/* Background */}
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        {/* Progress fill */}
        <div
          className={cn("h-full transition-all duration-500 rounded-full", barColorClass)}
          style={{ width: `${clampedPercent}%` }}
        />
      </div>
      
      {/* Expected spend marker */}
      {status !== 'no_budget' && (
        <div 
          className="absolute top-0 h-2 w-0.5 bg-foreground/50"
          style={{ left: `${clampedExpected}%` }}
          title={`Expected: ${Math.round(clampedExpected)}%`}
        />
      )}
    </div>
  );
}
