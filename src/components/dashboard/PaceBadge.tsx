import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PaceStatus } from "@/lib/paceCalculations";
import { TrendingUp, TrendingDown, Minus, CircleDashed } from "lucide-react";

interface PaceBadgeProps {
  status: PaceStatus;
  pacePercentage?: number;
  className?: string;
}

export function PaceBadge({ status, pacePercentage, className }: PaceBadgeProps) {
  const config = {
    on_track: {
      label: 'On Track',
      variant: 'default' as const,
      icon: Minus,
      className: 'bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/20',
    },
    overspending: {
      label: 'Overspending',
      variant: 'destructive' as const,
      icon: TrendingUp,
      className: 'bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20',
    },
    underspending: {
      label: 'Underspending',
      variant: 'secondary' as const,
      icon: TrendingDown,
      className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20 hover:bg-yellow-500/20',
    },
    no_budget: {
      label: 'No Budget',
      variant: 'outline' as const,
      icon: CircleDashed,
      className: 'bg-muted/50 text-muted-foreground border-muted hover:bg-muted',
    },
  };

  const { label, icon: Icon, className: statusClassName } = config[status];

  return (
    <Badge 
      variant="outline" 
      className={cn(
        "gap-1 font-medium",
        statusClassName,
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
      {pacePercentage !== undefined && status !== 'no_budget' && (
        <span className="text-xs opacity-80">
          ({Math.round(pacePercentage)}%)
        </span>
      )}
    </Badge>
  );
}
