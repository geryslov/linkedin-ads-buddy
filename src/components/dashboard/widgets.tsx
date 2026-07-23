import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

/* Shared widget primitives — every dashboard panel builds from these so the
   whole app reads as one system. */

/** Card shell with a consistent header row: title + optional subtitle left,
    toolbar (filters, actions, legend) right. */
export function WidgetCard({
  title,
  subtitle,
  toolbar,
  children,
  className,
  contentClassName,
  noPadding,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  noPadding?: boolean;
}) {
  return (
    <section
      className={cn(
        "bg-card border border-border/70 rounded-xl overflow-hidden",
        className
      )}
      style={{ boxShadow: "var(--shadow-sm)" }}
    >
      {(title || toolbar) && (
        <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 flex-wrap">
          <div className="min-w-0">
            {title && <h3 className="text-sm font-bold text-foreground leading-tight">{title}</h3>}
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
          {toolbar && <div className="flex items-center gap-2 shrink-0">{toolbar}</div>}
        </header>
      )}
      <div className={cn(noPadding ? "" : "px-5 pb-5", !title && !toolbar && !noPadding && "pt-5", contentClassName)}>
        {children}
      </div>
    </section>
  );
}

/** Empty state: icon in a soft ring, short headline, one-line guidance, optional action. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("py-14 px-6 text-center animate-fade-in", className)}>
      <div className="mx-auto h-12 w-12 rounded-xl bg-primary/[0.06] border border-primary/10 flex items-center justify-center mb-4">
        <Icon className="h-5 w-5 text-primary/70" />
      </div>
      <h3 className="font-semibold text-foreground mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Status pill — dot + label, tinted by semantic state. */
const STATUS_STYLES: Record<string, { dot: string; text: string; bg: string }> = {
  success: { dot: "bg-success", text: "text-success", bg: "bg-success/[0.08]" },
  warning: { dot: "bg-warning", text: "text-warning", bg: "bg-warning/[0.08]" },
  danger: { dot: "bg-destructive", text: "text-destructive", bg: "bg-destructive/[0.08]" },
  info: { dot: "bg-primary", text: "text-primary", bg: "bg-primary/[0.08]" },
  neutral: { dot: "bg-muted-foreground/50", text: "text-muted-foreground", bg: "bg-muted" },
};

export function StatusPill({
  tone,
  label,
  className,
}: {
  tone: keyof typeof STATUS_STYLES;
  label: string;
  className?: string;
}) {
  const s = STATUS_STYLES[tone] ?? STATUS_STYLES.neutral;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium",
        s.bg,
        s.text,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", s.dot)} />
      {label}
    </span>
  );
}

/** Segmented control — the standard picker for periods, metrics, densities. */
export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  size = "default",
  className,
}: {
  options: { label: ReactNode; value: T }[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "default";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 p-0.5 bg-muted rounded-lg",
        className
      )}
    >
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-md font-medium transition-colors",
            size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm",
            value === opt.value
              ? "bg-card text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/** Legend row for multi-series charts — mark swatch + series name in text ink. */
export function ChartLegend({
  items,
  className,
}: {
  items: { label: string; color: string }[];
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-4 flex-wrap", className)}>
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className="h-2.5 w-2.5 rounded-[3px] shrink-0"
            style={{ background: item.color }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}
