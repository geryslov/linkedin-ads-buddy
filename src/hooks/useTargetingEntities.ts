import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  TargetingEntity, 
  TargetingFacet, 
  TargetingFacetInfo,
  TargetingEntitiesResponse,
  TargetingFacetsResponse 
} from '@/types/targeting';

interface CacheEntry {
  data: TargetingEntitiesResponse;
  timestamp: number;
}

// Cache durations in ms
const STATIC_CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
const SEARCH_CACHE_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days

export function useTargetingEntities(accessToken: string | null) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facets, setFacets] = useState<TargetingFacetInfo[]>([]);
  
  // In-memory cache for entities
  const cache = useRef<Map<string, CacheEntry>>(new Map());
  
  // Request coalescing - track in-flight promises
  const inflightRequests = useRef<Map<string, Promise<TargetingEntitiesResponse>>>(new Map());
  
  // Concurrency limiter
  const activeRequests = useRef(0);
  const MAX_CONCURRENT = 3;

  const getCacheKey = (facet: TargetingFacet, query: string, start: number, count: number) => {
    return `${facet}:${query}:${start}:${count}`;
  };

  const getCacheDuration = (facet: TargetingFacet) => {
    // Static facets get longer cache
    if (['SENIORITIES', 'JOB_FUNCTIONS', 'STAFF_COUNT_RANGES'].includes(facet)) {
      return STATIC_CACHE_DURATION;
    }
    return SEARCH_CACHE_DURATION;
  };

  const fetchFacets = useCallback(async () => {
    if (!accessToken) return;
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('linkedin-api', {
        body: { action: 'get_targeting_facets', accessToken },
      });
      
      if (fnError) throw fnError;
      setFacets((data as TargetingFacetsResponse).facets);
    } catch (err) {
      console.error('Failed to fetch targeting facets:', err);
      setError('Failed to load targeting facets');
    }
  }, [accessToken]);

  const fetchEntities = useCallback(async (
    facet: TargetingFacet,
    query: string = '',
    start: number = 0,
    count: number = 25
  ): Promise<TargetingEntitiesResponse> => {
    if (!accessToken) {
      return { items: [], paging: { start, count } };
    }
    
    const cacheKey = getCacheKey(facet, query, start, count);
    
    // Check cache first
    const cached = cache.current.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < getCacheDuration(facet)) {
      return cached.data;
    }
    
    // Check for in-flight request (request coalescing)
    const inflight = inflightRequests.current.get(cacheKey);
    if (inflight) {
      return inflight;
    }
    
    // Wait if too many concurrent requests
    while (activeRequests.current >= MAX_CONCURRENT) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    activeRequests.current++;
    setIsLoading(true);
    setError(null);
    
    const requestPromise = (async () => {
      try {
        const { data, error: fnError } = await supabase.functions.invoke('linkedin-api', {
          body: {
            action: 'get_targeting_entities',
            accessToken,
            params: { facet, query, start, count },
          },
        });
        
        if (fnError) throw fnError;
        
        const response = data as TargetingEntitiesResponse;
        
        // Cache the result
        cache.current.set(cacheKey, {
          data: response,
          timestamp: Date.now(),
        });
        
        return response;
      } catch (err: any) {
        console.error(`Failed to fetch ${facet} entities:`, err);
        
        // Handle specific error codes
        if (err.status === 401) {
          setError('Re-authentication required');
        } else if (err.status === 403) {
          setError('Missing permission for targeting API');
        } else if (err.status === 429) {
          setError('Rate limit hit, please wait...');
        } else {
          setError(`Failed to load ${facet}`);
        }
        
        return { items: [], paging: { start, count } };
      } finally {
        activeRequests.current--;
        inflightRequests.current.delete(cacheKey);
        setIsLoading(false);
      }
    })();
    
    // Store promise for coalescing
    inflightRequests.current.set(cacheKey, requestPromise);
    
    return requestPromise;
  }, [accessToken]);

  // Preload static facets
  const preloadStaticFacets = useCallback(async () => {
    if (!accessToken) return;
    
    // Preload seniorities, job functions, and company sizes in parallel
    await Promise.all([
      fetchEntities('SENIORITIES', '', 0, 50),
      fetchEntities('JOB_FUNCTIONS', '', 0, 50),
      fetchEntities('STAFF_COUNT_RANGES', '', 0, 50),
    ]);
  }, [accessToken, fetchEntities]);

  // Clear cache
  const clearCache = useCallback(() => {
    cache.current.clear();
  }, []);

  return {
    isLoading,
    error,
    facets,
    fetchFacets,
    fetchEntities,
    preloadStaticFacets,
    clearCache,
  };
}
