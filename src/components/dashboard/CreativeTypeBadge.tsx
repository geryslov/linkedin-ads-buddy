import { Badge } from '@/components/ui/badge';
import { 
  Image, 
  Video, 
  LayoutGrid, 
  Type, 
  Star, 
  Users, 
  Briefcase,
  FileText,
  HelpCircle
} from 'lucide-react';

interface CreativeTypeBadgeProps {
  type: string;
  className?: string;
}

const TYPE_CONFIG: Record<string, { 
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  colors: string;
}> = {
  SPONSORED_CONTENT: {
    icon: Image,
    label: 'Sponsored Content',
    colors: 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:bg-blue-500/20 dark:text-blue-400',
  },
  SPONSORED_UPDATE: {
    icon: FileText,
    label: 'Sponsored Update',
    colors: 'bg-purple-500/10 text-purple-600 border-purple-500/20 dark:bg-purple-500/20 dark:text-purple-400',
  },
  TEXT_AD: {
    icon: Type,
    label: 'Text Ad',
    colors: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400',
  },
  SPOTLIGHT_AD: {
    icon: Star,
    label: 'Spotlight Ad',
    colors: 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400',
  },
  VIDEO_AD: {
    icon: Video,
    label: 'Video Ad',
    colors: 'bg-rose-500/10 text-rose-600 border-rose-500/20 dark:bg-rose-500/20 dark:text-rose-400',
  },
  VIDEO: {
    icon: Video,
    label: 'Video',
    colors: 'bg-rose-500/10 text-rose-600 border-rose-500/20 dark:bg-rose-500/20 dark:text-rose-400',
  },
  CAROUSEL_AD: {
    icon: LayoutGrid,
    label: 'Carousel Ad',
    colors: 'bg-orange-500/10 text-orange-600 border-orange-500/20 dark:bg-orange-500/20 dark:text-orange-400',
  },
  CAROUSEL: {
    icon: LayoutGrid,
    label: 'Carousel',
    colors: 'bg-orange-500/10 text-orange-600 border-orange-500/20 dark:bg-orange-500/20 dark:text-orange-400',
  },
  FOLLOWER_AD: {
    icon: Users,
    label: 'Follower Ad',
    colors: 'bg-pink-500/10 text-pink-600 border-pink-500/20 dark:bg-pink-500/20 dark:text-pink-400',
  },
  JOBS_AD: {
    icon: Briefcase,
    label: 'Jobs Ad',
    colors: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20 dark:bg-cyan-500/20 dark:text-cyan-400',
  },
};

const DEFAULT_CONFIG = {
  icon: HelpCircle,
  label: 'Unknown',
  colors: 'bg-muted text-muted-foreground border-muted',
};

export function CreativeTypeBadge({ type, className = '' }: CreativeTypeBadgeProps) {
  const config = TYPE_CONFIG[type] || DEFAULT_CONFIG;
  const Icon = config.icon;
  const displayLabel = TYPE_CONFIG[type]?.label || type.replace(/_/g, ' ');

  return (
    <Badge 
      variant="outline" 
      className={`text-xs gap-1.5 font-medium ${config.colors} ${className}`}
    >
      <Icon className="h-3 w-3" />
      {displayLabel}
    </Badge>
  );
}
