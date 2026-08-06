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
        "group relative bg-card rounded-xl p-5 animate-slide-up overflow-hidden",
        "border border-border/70 card-hover",
        "flex flex-col gap-4"
      )}
      style={{
        animationDelay: `${delay}ms`,
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {/* Corner wash — barely-there brand tint, top right */}
      <div
        aria-hidden
        className="absolute -top-10 -right-10 h-28 w-28 rounded-full opacity-[0.06] group-hover:opacity-[0.10] transition-opacity"
        style={{ background: "var(--gradient-primary)" }}
      />

      {/* Label row: icon chip + label left, trend badge right */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 bg-primary/[0.07] border border-primary/10">
            <Icon className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground truncate">
            {title}
          </p>
        </div>
        {change && (
          <span
            className={cn(
              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-semibold shrink-0",
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

      {/* Hero number */}
      <p className="text-[28px] font-bold tracking-tight tabular-nums text-foreground leading-none">
        {value}
      </p>
    </div>
  );
}
