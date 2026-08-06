import {
  Image,
  Video,
  LayoutGrid,
  Type,
  Star,
  Users,
  Briefcase,
  FileText,
  HelpCircle,
  Mail,
  FileSpreadsheet
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CreativeTypeBadgeProps {
  type: string;
  className?: string;
}

/* Ad-format identity chip — neutral ink, icon carries the format.
   Format is metadata, not status, so it stays out of the semantic
   (success/warning/destructive) and chart color ranges. */
const TYPE_CONFIG: Record<string, {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}> = {
  SPONSORED_CONTENT: { icon: Image, label: 'Sponsored Content' },
  IMAGE_ENG: { icon: Image, label: 'Image Engagement' },
  IMAGE_GATED: { icon: Image, label: 'Image Gated' },
  DOC_GATED: { icon: FileSpreadsheet, label: 'Doc Gated' },
  VIDEO_GATED: { icon: Video, label: 'Video Gated' },
  CAROUSEL_GATED: { icon: LayoutGrid, label: 'Carousel Gated' },
  SPONSORED_UPDATE: { icon: FileText, label: 'Sponsored Update' },
  TEXT_AD: { icon: Type, label: 'Text Ad' },
  SPOTLIGHT_AD: { icon: Star, label: 'Spotlight Ad' },
  VIDEO_AD: { icon: Video, label: 'Video Ad' },
  VIDEO: { icon: Video, label: 'Video' },
  CAROUSEL_AD: { icon: LayoutGrid, label: 'Carousel Ad' },
  CAROUSEL: { icon: LayoutGrid, label: 'Carousel' },
  FOLLOWER_AD: { icon: Users, label: 'Follower Ad' },
  JOBS_AD: { icon: Briefcase, label: 'Jobs Ad' },
  MESSAGE_AD: { icon: Mail, label: 'Message Ad' },
  DOCUMENT_AD: { icon: FileSpreadsheet, label: 'Document Ad' },
};

const DEFAULT_CONFIG = {
  icon: HelpCircle,
  label: 'Unknown',
};

export function CreativeTypeBadge({ type, className = '' }: CreativeTypeBadgeProps) {
  const config = TYPE_CONFIG[type] || DEFAULT_CONFIG;
  const Icon = config.icon;
  const displayLabel = TYPE_CONFIG[type]?.label || type.replace(/_/g, ' ');

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border border-border/70 bg-secondary/50',
        'px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground whitespace-nowrap',
        className
      )}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {displayLabel}
    </span>
  );
}
