import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { EntityPicklist } from './EntityPicklist';
import { TargetingSummary } from './TargetingSummary';
import { useTargetingConfig } from '@/hooks/useTargetingConfig';
import { useTargetingEntities } from '@/hooks/useTargetingEntities';
import { TargetingFacet } from '@/types/targeting';

interface TargetingPanelProps {
  accessToken: string | null;
}

export function TargetingPanel({ accessToken }: TargetingPanelProps) {
  const {
    config,
    counts,
    exportPayload,
    addEntity,
    removeEntity,
    clearFacet,
    clearAll,
    applyPreset,
  } = useTargetingConfig();

  const { preloadStaticFacets } = useTargetingEntities(accessToken);

  // Preload static facets on mount
  useEffect(() => {
    if (accessToken) {
      preloadStaticFacets();
    }
  }, [accessToken, preloadStaticFacets]);

  const handleRemoveEntity = (facet: TargetingFacet, urn: string) => {
    removeEntity(facet, urn);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Picklists section */}
      <div className="lg:col-span-2 space-y-6">
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Audience Targeting</CardTitle>
            <CardDescription>
              Select targeting criteria to define your audience. All selections are combined with AND logic.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Row 1: Seniority + Job Function */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <EntityPicklist
                facet="SENIORITIES"
                accessToken={accessToken}
                selectedEntities={config.seniorities}
                onSelect={(entity) => addEntity('SENIORITIES', entity)}
                onDeselect={(urn) => removeEntity('SENIORITIES', urn)}
              />
              <EntityPicklist
                facet="JOB_FUNCTIONS"
                accessToken={accessToken}
                selectedEntities={config.jobFunctions}
                onSelect={(entity) => addEntity('JOB_FUNCTIONS', entity)}
                onDeselect={(urn) => removeEntity('JOB_FUNCTIONS', urn)}
              />
            </div>
            
            {/* Row 2: Company Size + Industry */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <EntityPicklist
                facet="STAFF_COUNT_RANGES"
                accessToken={accessToken}
                selectedEntities={config.companySizes}
                onSelect={(entity) => addEntity('STAFF_COUNT_RANGES', entity)}
                onDeselect={(urn) => removeEntity('STAFF_COUNT_RANGES', urn)}
              />
              <EntityPicklist
                facet="INDUSTRIES"
                accessToken={accessToken}
                selectedEntities={config.industries}
                onSelect={(entity) => addEntity('INDUSTRIES', entity)}
                onDeselect={(urn) => removeEntity('INDUSTRIES', urn)}
              />
            </div>
            
            {/* Row 3: Skills (full width) */}
            <EntityPicklist
              facet="SKILLS"
              accessToken={accessToken}
              selectedEntities={config.skills}
              onSelect={(entity) => addEntity('SKILLS', entity)}
              onDeselect={(urn) => removeEntity('SKILLS', urn)}
            />
          </CardContent>
        </Card>
      </div>
      
      {/* Summary panel */}
      <div className="lg:col-span-1">
        <div className="sticky top-4">
          <TargetingSummary
            config={config}
            counts={counts}
            exportPayload={exportPayload}
            onRemoveEntity={handleRemoveEntity}
            onClearFacet={clearFacet}
            onClearAll={clearAll}
            onApplyPreset={applyPreset}
          />
        </div>
      </div>
    </div>
  );
}
