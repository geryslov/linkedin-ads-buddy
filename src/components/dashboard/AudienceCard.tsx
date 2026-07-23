import { Audience } from "@/hooks/useLinkedInAds";
import { Badge } from "@/components/ui/badge";
import { StatusPill } from "./widgets";
import { Users, Calendar, Globe } from "lucide-react";

interface AudienceCardProps {
  audience: Audience;
  delay?: number;
}

const typeLabels: Record<string, string> = {
  COMPANY: "Company",
  CONTACT: "Contact",
  LOOKALIKE: "Lookalike",
  UNKNOWN: "Segment",
};

export function AudienceCard({ audience, delay = 0 }: AudienceCardProps) {
  const formatDate = (iso?: string) => {
    if (!iso) return null;
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const ready = audience.status === "READY";

  return (
    <div
      className="bg-card border border-border/70 rounded-xl p-5 animate-slide-up card-hover"
      style={{ animationDelay: `${delay}ms`, boxShadow: "var(--shadow-sm)" }}
    >
      <div className="flex items-start justify-between mb-4 gap-2">
        <div className="h-8 w-8 rounded-lg bg-primary/[0.07] border border-primary/10 flex items-center justify-center shrink-0">
          <Users className="h-4 w-4 text-primary" />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {audience.type && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {typeLabels[audience.type] || audience.type}
            </Badge>
          )}
          <StatusPill
            tone={ready ? "success" : "neutral"}
            label={ready ? "Ready" : audience.status.charAt(0) + audience.status.slice(1).toLowerCase()}
          />
        </div>
      </div>

      <h3 className="text-sm font-semibold mb-3 line-clamp-2 leading-snug" title={audience.name}>
        {audience.name}
      </h3>

      <p className="text-[26px] font-bold tabular-nums tracking-tight leading-none">
        {audience.matchedCount.toLocaleString()}
      </p>
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground mt-1">
        matched members
      </p>

      {(audience.sourcePlatform || audience.createdAt || audience.lastModifiedAt) && (
        <div className="mt-4 pt-3 border-t border-border/50 flex items-center gap-3 flex-wrap">
          {audience.sourcePlatform && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Globe className="h-3 w-3" />
              {audience.sourcePlatform}
            </span>
          )}
          {(audience.lastModifiedAt || audience.createdAt) && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {audience.lastModifiedAt
                ? `Updated ${formatDate(audience.lastModifiedAt)}`
                : `Created ${formatDate(audience.createdAt)}`}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
