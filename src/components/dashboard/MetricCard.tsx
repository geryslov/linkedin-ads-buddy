import { cn } from "@/lib/utils";
import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  delay?: number;
}

export function MetricCard({
  title,
  value,
  change,
  changeType = "neutral",
  icon: Icon,
  delay = 0,
}: MetricCardProps) {
  const TrendIcon =
    changeType === "positive" ? TrendingUp
    : changeType === "negative" ? TrendingDown
    : Minus;

  return (
    <div
      className="glass rounded-xl p-5 animate-slide-up flex flex-col gap-3"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Top row: icon (left) + trend badge (right) */}
      <div className="flex items-start justify-between">
        <div className="p-2 rounded-lg bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        {change && (
          <span
            className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold",
              changeType === "positive" && "bg-success/10 text-success",
              changeType === "negative" && "bg-destructive/10 text-destructive",
              changeType === "neutral" && "bg-muted text-muted-foreground"
            )}
          >
            <TrendIcon className="h-3 w-3" />
            {change}
          </span>
        )}
      </div>

      {/* Label + value */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
          {title}
        </p>
        <p className="text-2xl font-bold tracking-tight tabular-nums">{value}</p>
      </div>
    </div>
  );
}
