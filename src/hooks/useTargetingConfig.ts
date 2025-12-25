import { useState, useCallback, useMemo } from 'react';
import { 
  TargetingConfig, 
  TargetingEntity, 
  TargetingFacet, 
  FACET_TO_CONFIG_KEY,
  TargetingPreset 
} from '@/types/targeting';

const INITIAL_CONFIG: TargetingConfig = {
  seniorities: [],
  jobFunctions: [],
  industries: [],
  skills: [],
  companySizes: [],
};

export function useTargetingConfig() {
  const [config, setConfig] = useState<TargetingConfig>(INITIAL_CONFIG);

  // Add entity to a facet (de-duped by URN)
  const addEntity = useCallback((facet: TargetingFacet, entity: TargetingEntity) => {
    const key = FACET_TO_CONFIG_KEY[facet];
    setConfig(prev => {
      const existing = prev[key];
      if (existing.some(e => e.urn === entity.urn)) {
        return prev; // Already exists
      }
      return {
        ...prev,
        [key]: [...existing, entity],
      };
    });
  }, []);

  // Add multiple entities at once (de-duped)
  const addEntities = useCallback((facet: TargetingFacet, entities: TargetingEntity[]) => {
    const key = FACET_TO_CONFIG_KEY[facet];
    setConfig(prev => {
      const existing = prev[key];
      const existingUrns = new Set(existing.map(e => e.urn));
      const newEntities = entities.filter(e => !existingUrns.has(e.urn));
      if (newEntities.length === 0) return prev;
      return {
        ...prev,
        [key]: [...existing, ...newEntities],
      };
    });
  }, []);

  // Remove entity from a facet
  const removeEntity = useCallback((facet: TargetingFacet, urn: string) => {
    const key = FACET_TO_CONFIG_KEY[facet];
    setConfig(prev => ({
      ...prev,
      [key]: prev[key].filter(e => e.urn !== urn),
    }));
  }, []);

  // Clear all entities from a facet
  const clearFacet = useCallback((facet: TargetingFacet) => {
    const key = FACET_TO_CONFIG_KEY[facet];
    setConfig(prev => ({
      ...prev,
      [key]: [],
    }));
  }, []);

  // Clear entire config
  const clearAll = useCallback(() => {
    setConfig(INITIAL_CONFIG);
  }, []);

  // Apply a preset (merges with existing)
  const applyPreset = useCallback((preset: TargetingPreset) => {
    setConfig(prev => {
      const newConfig = { ...prev };
      
      if (preset.entities.seniorities) {
        const existingUrns = new Set(prev.seniorities.map(e => e.urn));
        const newEntities = preset.entities.seniorities.filter(e => !existingUrns.has(e.urn));
        newConfig.seniorities = [...prev.seniorities, ...newEntities];
      }
      if (preset.entities.jobFunctions) {
        const existingUrns = new Set(prev.jobFunctions.map(e => e.urn));
        const newEntities = preset.entities.jobFunctions.filter(e => !existingUrns.has(e.urn));
        newConfig.jobFunctions = [...prev.jobFunctions, ...newEntities];
      }
      if (preset.entities.industries) {
        const existingUrns = new Set(prev.industries.map(e => e.urn));
        const newEntities = preset.entities.industries.filter(e => !existingUrns.has(e.urn));
        newConfig.industries = [...prev.industries, ...newEntities];
      }
      if (preset.entities.skills) {
        const existingUrns = new Set(prev.skills.map(e => e.urn));
        const newEntities = preset.entities.skills.filter(e => !existingUrns.has(e.urn));
        newConfig.skills = [...prev.skills, ...newEntities];
      }
      if (preset.entities.companySizes) {
        const existingUrns = new Set(prev.companySizes.map(e => e.urn));
        const newEntities = preset.entities.companySizes.filter(e => !existingUrns.has(e.urn));
        newConfig.companySizes = [...prev.companySizes, ...newEntities];
      }
      
      return newConfig;
    });
  }, []);

  // Get counts per facet
  const counts = useMemo(() => ({
    seniorities: config.seniorities.length,
    jobFunctions: config.jobFunctions.length,
    industries: config.industries.length,
    skills: config.skills.length,
    companySizes: config.companySizes.length,
    total: config.seniorities.length + 
           config.jobFunctions.length + 
           config.industries.length + 
           config.skills.length + 
           config.companySizes.length,
  }), [config]);

  // Export as LinkedIn payload format
  const exportPayload = useMemo(() => {
    const payload: Record<string, string[]> = {};
    
    if (config.seniorities.length > 0) {
      payload.SENIORITIES = config.seniorities.map(e => e.urn);
    }
    if (config.jobFunctions.length > 0) {
      payload.JOB_FUNCTIONS = config.jobFunctions.map(e => e.urn);
    }
    if (config.industries.length > 0) {
      payload.INDUSTRIES = config.industries.map(e => e.urn);
    }
    if (config.skills.length > 0) {
      payload.SKILLS = config.skills.map(e => e.urn);
    }
    if (config.companySizes.length > 0) {
      payload.STAFF_COUNT_RANGES = config.companySizes.map(e => e.urn);
    }
    
    return {
      includedTargetingFacets: payload,
    };
  }, [config]);

  // Check if entity is selected
  const isSelected = useCallback((facet: TargetingFacet, urn: string) => {
    const key = FACET_TO_CONFIG_KEY[facet];
    return config[key].some(e => e.urn === urn);
  }, [config]);

  return {
    config,
    counts,
    exportPayload,
    addEntity,
    addEntities,
    removeEntity,
    clearFacet,
    clearAll,
    applyPreset,
    isSelected,
  };
}
