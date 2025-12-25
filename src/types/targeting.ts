// Targeting entity types for LinkedIn Ads targeting picklists

export interface TargetingEntity {
  urn: string;
  id: string;
  name: string;
  facet: TargetingFacet;
}

export type TargetingFacet = 
  | 'SENIORITIES' 
  | 'JOB_FUNCTIONS' 
  | 'INDUSTRIES' 
  | 'SKILLS' 
  | 'STAFF_COUNT_RANGES';

export interface TargetingFacetInfo {
  id: TargetingFacet;
  name: string;
  description: string;
  preloadable: boolean;
  minQueryLength: number;
}

export interface TargetingConfig {
  seniorities: TargetingEntity[];
  jobFunctions: TargetingEntity[];
  industries: TargetingEntity[];
  skills: TargetingEntity[];
  companySizes: TargetingEntity[];
}

export interface TargetingEntitiesResponse {
  items: TargetingEntity[];
  paging: {
    start: number;
    count: number;
    total?: number;
  };
}

export interface TargetingFacetsResponse {
  facets: TargetingFacetInfo[];
}

// Map facet IDs to config keys
export const FACET_TO_CONFIG_KEY: Record<TargetingFacet, keyof TargetingConfig> = {
  SENIORITIES: 'seniorities',
  JOB_FUNCTIONS: 'jobFunctions',
  INDUSTRIES: 'industries',
  SKILLS: 'skills',
  STAFF_COUNT_RANGES: 'companySizes',
};

// Facet display info
export const FACET_INFO: Record<TargetingFacet, { label: string; plural: string; icon: string }> = {
  SENIORITIES: { label: 'Seniority', plural: 'Seniorities', icon: 'Award' },
  JOB_FUNCTIONS: { label: 'Job Function', plural: 'Job Functions', icon: 'Briefcase' },
  INDUSTRIES: { label: 'Industry', plural: 'Industries', icon: 'Building2' },
  SKILLS: { label: 'Skill', plural: 'Skills', icon: 'Sparkles' },
  STAFF_COUNT_RANGES: { label: 'Company Size', plural: 'Company Sizes', icon: 'Users' },
};

// Preset targeting combinations
export interface TargetingPreset {
  id: string;
  name: string;
  description: string;
  entities: Partial<TargetingConfig>;
}

export const TARGETING_PRESETS: TargetingPreset[] = [
  {
    id: 'director_plus',
    name: 'Director+',
    description: 'Director, VP, CXO, Partner, Owner seniorities',
    entities: {
      seniorities: [
        { urn: 'urn:li:seniority:6', id: '6', name: 'Director', facet: 'SENIORITIES' },
        { urn: 'urn:li:seniority:7', id: '7', name: 'VP', facet: 'SENIORITIES' },
        { urn: 'urn:li:seniority:8', id: '8', name: 'CXO', facet: 'SENIORITIES' },
        { urn: 'urn:li:seniority:9', id: '9', name: 'Partner', facet: 'SENIORITIES' },
        { urn: 'urn:li:seniority:10', id: '10', name: 'Owner', facet: 'SENIORITIES' },
      ],
    },
  },
  {
    id: 'security_it',
    name: 'Security / IT',
    description: 'IT and Engineering job functions',
    entities: {
      jobFunctions: [
        { urn: 'urn:li:function:8', id: '8', name: 'Engineering', facet: 'JOB_FUNCTIONS' },
        { urn: 'urn:li:function:13', id: '13', name: 'Information Technology', facet: 'JOB_FUNCTIONS' },
      ],
    },
  },
  {
    id: 'mid_market',
    name: 'Mid-Market (200-1000)',
    description: '201-500 and 501-1000 employee companies',
    entities: {
      companySizes: [
        { urn: 'urn:li:staffCountRange:(201,500)', id: 'E', name: '201-500 employees', facet: 'STAFF_COUNT_RANGES' },
        { urn: 'urn:li:staffCountRange:(501,1000)', id: 'F', name: '501-1,000 employees', facet: 'STAFF_COUNT_RANGES' },
      ],
    },
  },
  {
    id: 'enterprise',
    name: 'Enterprise (1000+)',
    description: '1001+ employee companies',
    entities: {
      companySizes: [
        { urn: 'urn:li:staffCountRange:(1001,5000)', id: 'G', name: '1,001-5,000 employees', facet: 'STAFF_COUNT_RANGES' },
        { urn: 'urn:li:staffCountRange:(5001,10000)', id: 'H', name: '5,001-10,000 employees', facet: 'STAFF_COUNT_RANGES' },
        { urn: 'urn:li:staffCountRange:(10001,null)', id: 'I', name: '10,001+ employees', facet: 'STAFF_COUNT_RANGES' },
      ],
    },
  },
];
