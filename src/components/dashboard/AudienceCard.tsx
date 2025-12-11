import { Audience } from "@/hooks/useLinkedInAds";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";

interface AudienceCardProps {
  audience: Audience;
  delay?: number;
}

export function AudienceCard({ audience, delay = 0 }: AudienceCardProps) {
  return (
    <div 
      className="glass rounded-xl p-5 animate-slide-up hover:border-primary/30 transition-colors"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <Badge 
          variant={audience.status === "READY" ? "default" : "secondary"}
          className={audience.status === "READY" ? "bg-success/20 text-success border-success/30" : ""}
        >
          {audience.status}
        </Badge>
      </div>
      <h3 className="font-semibold mb-1 line-clamp-2">{audience.name}</h3>
      <p className="text-2xl font-bold text-primary">
        {audience.matchedCount.toLocaleString()}
      </p>
      <p className="text-xs text-muted-foreground">matched members</p>
    </div>
  );
}
