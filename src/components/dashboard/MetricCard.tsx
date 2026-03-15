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
      className={cn(
        "relative bg-card rounded-lg p-5 animate-slide-up overflow-hidden",
        "border border-border/70 shadow-sm",
        "flex flex-col gap-3"
      )}
      style={{
        animationDelay: `${delay}ms`,
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {/* Left-edge accent bar — encodes card type visually */}
      <span
        className={cn(
          "absolute left-0 top-0 bottom-0 w-0.5 rounded-l",
          changeType === "positive" ? "bg-success" :
          changeType === "negative" ? "bg-destructive" :
          "bg-primary/40"
        )}
      />

      {/* Top row: icon (left) + trend badge (right) */}
      <div className="flex items-start justify-between">
        <div className={cn(
          "p-2 rounded-md",
          "bg-primary/8 border border-primary/12"
        )}
          style={{ background: "hsl(221 83% 53% / 0.07)", border: "1px solid hsl(221 83% 53% / 0.12)" }}
        >
          <Icon className="h-4 w-4 text-primary" />
        </div>
        {change && (
          <span
            className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border",
              changeType === "positive" && "bg-success/8 text-success border-success/20",
              changeType === "negative" && "bg-destructive/8 text-destructive border-destructive/20",
              changeType === "neutral" && "bg-muted text-muted-foreground border-border"
            )}
            style={
              changeType === "positive" ? { background: "hsl(142 71% 45% / 0.08)" } :
              changeType === "negative" ? { background: "hsl(0 72% 51% / 0.08)" } :
              undefined
            }
          >
            <TrendIcon className="h-3 w-3" />
            {change}
          </span>
        )}
      </div>

      {/* Label + value */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 leading-none">
          {title}
        </p>
        <p className="text-2xl font-bold tracking-tight tabular-nums text-foreground leading-tight">
          {value}
        </p>
      </div>
    </div>
  );
}
