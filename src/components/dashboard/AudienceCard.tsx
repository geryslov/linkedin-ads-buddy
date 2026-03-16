import { Audience } from "@/hooks/useLinkedInAds";
import { Badge } from "@/components/ui/badge";
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

  return (
    <div
      className="glass rounded-xl p-5 animate-slide-up hover:border-primary/30 transition-colors"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div className="flex items-center gap-1.5">
          {audience.type && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {typeLabels[audience.type] || audience.type}
            </Badge>
          )}
          <Badge
            variant={audience.status === "READY" ? "default" : "secondary"}
            className={audience.status === "READY" ? "bg-success/20 text-success border-success/30" : ""}
          >
            {audience.status}
          </Badge>
        </div>
      </div>
      <h3 className="font-semibold mb-1 line-clamp-2">{audience.name}</h3>
      <p className="text-2xl font-bold text-primary">
        {audience.matchedCount.toLocaleString()}
      </p>
      <p className="text-xs text-muted-foreground">matched members</p>

      {(audience.sourcePlatform || audience.createdAt || audience.lastModifiedAt) && (
        <div className="mt-3 pt-3 border-t border-border/50 space-y-1">
          {audience.sourcePlatform && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Globe className="h-3 w-3" />
              <span>{audience.sourcePlatform}</span>
            </div>
          )}
          {audience.createdAt && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>Created {formatDate(audience.createdAt)}</span>
            </div>
          )}
          {audience.lastModifiedAt && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>Updated {formatDate(audience.lastModifiedAt)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
