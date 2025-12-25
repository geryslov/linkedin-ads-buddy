import React, { useState } from 'react';
import { 
  Award, 
  Briefcase, 
  Building2, 
  Sparkles, 
  Users, 
  X, 
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Trash2,
  Zap
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { 
  TargetingConfig, 
  TargetingFacet, 
  FACET_INFO,
  TARGETING_PRESETS,
  TargetingPreset 
} from '@/types/targeting';

interface TargetingSummaryProps {
  config: TargetingConfig;
  counts: {
    seniorities: number;
    jobFunctions: number;
    industries: number;
    skills: number;
    companySizes: number;
    total: number;
  };
  exportPayload: { includedTargetingFacets: Record<string, string[]> };
  onRemoveEntity: (facet: TargetingFacet, urn: string) => void;
  onClearFacet: (facet: TargetingFacet) => void;
  onClearAll: () => void;
  onApplyPreset: (preset: TargetingPreset) => void;
  className?: string;
}

const FACET_ICONS = {
  SENIORITIES: Award,
  JOB_FUNCTIONS: Briefcase,
  INDUSTRIES: Building2,
  SKILLS: Sparkles,
  STAFF_COUNT_RANGES: Users,
};

interface FacetSectionProps {
  facet: TargetingFacet;
  entities: { urn: string; name: string }[];
  onRemove: (urn: string) => void;
  onClear: () => void;
}

function FacetSection({ facet, entities, onRemove, onClear }: FacetSectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const info = FACET_INFO[facet];
  const Icon = FACET_ICONS[facet];

  if (entities.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border-b border-border/50 last:border-b-0">
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">{info.plural}</span>
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                {entities.length}
              </Badge>
            </div>
            {isOpen ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {entities.map(entity => (
                <TooltipProvider key={entity.urn}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        variant="outline"
                        className="pl-2 pr-1 py-1 gap-1 text-xs font-normal cursor-default"
                      >
                        <span className="truncate max-w-[120px]">{entity.name}</span>
                        <button
                          onClick={() => onRemove(entity.urn)}
                          className="ml-0.5 hover:bg-muted rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs font-mono">
                      {entity.urn}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-destructive"
              onClick={onClear}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Clear {info.plural}
            </Button>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function TargetingSummary({
  config,
  counts,
  exportPayload,
  onRemoveEntity,
  onClearFacet,
  onClearAll,
  onApplyPreset,
  className,
}: TargetingSummaryProps) {
  const [showPayload, setShowPayload] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyPayload = async () => {
    await navigator.clipboard.writeText(JSON.stringify(exportPayload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className={cn('bg-card/50 backdrop-blur-sm border-border/50', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Targeting Summary</CardTitle>
          {counts.total > 0 && (
            <Badge variant="default" className="h-6 px-2">
              {counts.total} selected
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Empty state */}
        {counts.total === 0 && (
          <div className="py-6 text-center text-muted-foreground text-sm">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No targeting criteria selected</p>
            <p className="text-xs mt-1">Use the picklists to add targeting</p>
          </div>
        )}
        
        {/* Selected facets */}
        {counts.total > 0 && (
          <ScrollArea className="max-h-[300px]">
            <div className="rounded-lg border border-border/50 overflow-hidden">
              <FacetSection
                facet="SENIORITIES"
                entities={config.seniorities}
                onRemove={(urn) => onRemoveEntity('SENIORITIES', urn)}
                onClear={() => onClearFacet('SENIORITIES')}
              />
              <FacetSection
                facet="JOB_FUNCTIONS"
                entities={config.jobFunctions}
                onRemove={(urn) => onRemoveEntity('JOB_FUNCTIONS', urn)}
                onClear={() => onClearFacet('JOB_FUNCTIONS')}
              />
              <FacetSection
                facet="INDUSTRIES"
                entities={config.industries}
                onRemove={(urn) => onRemoveEntity('INDUSTRIES', urn)}
                onClear={() => onClearFacet('INDUSTRIES')}
              />
              <FacetSection
                facet="SKILLS"
                entities={config.skills}
                onRemove={(urn) => onRemoveEntity('SKILLS', urn)}
                onClear={() => onClearFacet('SKILLS')}
              />
              <FacetSection
                facet="STAFF_COUNT_RANGES"
                entities={config.companySizes}
                onRemove={(urn) => onRemoveEntity('STAFF_COUNT_RANGES', urn)}
                onClear={() => onClearFacet('STAFF_COUNT_RANGES')}
              />
            </div>
          </ScrollArea>
        )}
        
        {/* Presets */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Zap className="h-4 w-4" />
            Quick Presets
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TARGETING_PRESETS.map(preset => (
              <TooltipProvider key={preset.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => onApplyPreset(preset)}
                    >
                      {preset.name}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs max-w-[200px]">
                    {preset.description}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t border-border/50">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => setShowPayload(!showPayload)}
            disabled={counts.total === 0}
          >
            {showPayload ? 'Hide' : 'Show'} Payload
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-destructive hover:text-destructive"
            onClick={onClearAll}
            disabled={counts.total === 0}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Clear All
          </Button>
        </div>
        
        {/* Payload preview */}
        {showPayload && counts.total > 0 && (
          <div className="relative">
            <pre className="p-3 rounded-lg bg-muted/50 text-xs overflow-x-auto max-h-[200px]">
              <code>{JSON.stringify(exportPayload, null, 2)}</code>
            </pre>
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2 h-7 w-7 p-0"
              onClick={handleCopyPayload}
            >
              {copied ? (
                <Check className="h-3 w-3 text-green-500" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
