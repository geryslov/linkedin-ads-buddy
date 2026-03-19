import { useState, useCallback, useMemo } from 'react';
import Papa from 'papaparse';
import { CompanyDemographicItem, ObjectiveBreakdownItem } from '@/hooks/useCompanyDemographic';

export interface UploadedCompany {
  name: string;
  url: string;
  date: string;
  rawRow: Record<string, string>;
}

export interface MatchedObjective {
  objective: string;
  impressions: number;
  clicks: number;
  landingPageClicks: number;
  spent: number;
  leads: number;
  engagements: number;
  ctr: number;
  cpc: number;
  cpm: number;
  campaignNames: string[];
  campaignIds: string[];
  campaignNamesMap: Record<string, string>;
}

export interface MatchedCompany {
  /** First uploaded entry used as display name */
  uploaded: UploadedCompany;
  /** All CSV rows that matched to this LinkedIn company */
  uploadedEntries: UploadedCompany[];
  linkedin: CompanyDemographicItem;
  matchType: 'name' | 'domain';
  objectives: MatchedObjective[];
  allCampaignNames: string[];
  /** Derived metrics */
  costPerLead: number;
  engagementRate: number;
}

export interface UnmatchedCompany {
  uploaded: UploadedCompany;
}

export type InfluenceTab = 'matched' | 'unmatched' | 'all';

const COMPANY_SUFFIXES = /\b(inc\.?|incorporated|llc|ltd\.?|limited|corp\.?|corporation|gmbh|co\.?|company|plc|ag|sa|s\.?a\.?|s\.?r\.?l\.?|pty|pvt|n\.?v\.?|b\.?v\.?|l\.?p\.?)\s*$/i;

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(COMPANY_SUFFIXES, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractDomainFromEmail(value: string): string {
  const atIndex = value.indexOf('@');
  if (atIndex !== -1) {
    return value.substring(atIndex + 1).toLowerCase().trim();
  }
  return '';
}

function standardizeUrl(url: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (trimmed.includes('@')) {
    return extractDomainFromEmail(trimmed);
  }
  return trimmed
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .replace(/\/$/, '');
}

function detectColumns(headers: string[]): { nameCol: string | null; urlCol: string | null; dateCol: string | null } {
  const lower = headers.map(h => h.toLowerCase().trim());

  const namePatterns = ['company name', 'company', 'name', 'account name', 'organization', 'org'];
  const urlPatterns = ['url', 'website', 'domain', 'company url', 'website url', 'web', 'site', 'email', 'e-mail', 'email address', 'contact email'];
  const datePatterns = ['date', 'close date', 'created date', 'created', 'closed', 'deal date', 'opportunity date'];

  const find = (patterns: string[]) => {
    for (const p of patterns) {
      const idx = lower.indexOf(p);
      if (idx !== -1) return headers[idx];
    }
    for (const p of patterns) {
      const idx = lower.findIndex(h => h.includes(p));
      if (idx !== -1) return headers[idx];
    }
    return null;
  };

  return {
    nameCol: find(namePatterns),
    urlCol: find(urlPatterns),
    dateCol: find(datePatterns),
  };
}

function buildObjectives(ob: ObjectiveBreakdownItem[]): { objectives: MatchedObjective[]; allNames: string[] } {
  const allNames = new Set<string>();
  const objectives: MatchedObjective[] = ob.map(item => {
    const names: string[] = [];
    if (item.campaignNames) {
      for (const n of Object.values(item.campaignNames)) {
        if (n) {
          names.push(n);
          allNames.add(n);
        }
      }
    }
    return {
      objective: item.objective,
      impressions: item.impressions,
      clicks: item.clicks,
      landingPageClicks: item.landingPageClicks,
      spent: item.spent,
      leads: item.leads,
      engagements: item.engagements,
      ctr: item.ctr,
      cpc: item.cpc,
      cpm: item.cpm,
      campaignNames: names,
      campaignIds: item.campaignIds || [],
      campaignNamesMap: item.campaignNames || {},
    };
  });
  return { objectives, allNames: Array.from(allNames) };
}

export function isMatchedItem(item: MatchedCompany | UnmatchedCompany): item is MatchedCompany {
  return 'linkedin' in item;
}

export function useCompanyInfluenceMatcher(linkedInData: CompanyDemographicItem[], objectiveBreakdownCache?: Map<string, ObjectiveBreakdownItem[]>) {
  const [uploadedCompanies, setUploadedCompanies] = useState<UploadedCompany[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [nameColumn, setNameColumn] = useState<string | null>(null);
  const [urlColumn, setUrlColumn] = useState<string | null>(null);
  const [dateColumn, setDateColumn] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<InfluenceTab>('matched');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<string>('spent');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Build lookup maps from LinkedIn data
  const { nameMap, domainMap } = useMemo(() => {
    const nMap = new Map<string, CompanyDemographicItem>();
    const dMap = new Map<string, CompanyDemographicItem>();

    for (const item of linkedInData) {
      if (item.entityName) {
        const normalized = normalizeName(item.entityName);
        if (normalized && !nMap.has(normalized)) {
          nMap.set(normalized, item);
        }
      }
      if (item.website) {
        const domain = standardizeUrl(item.website);
        if (domain && !dMap.has(domain)) {
          dMap.set(domain, item);
        }
      }
    }

    return { nameMap: nMap, domainMap: dMap };
  }, [linkedInData]);

  // Perform matching with deduplication
  const { matched, unmatched, uniqueUploadedCount } = useMemo(() => {
    // Deduplicate: group uploaded companies by their normalized match key
    // so the same company appearing N times only produces 1 matched row
    const matchedMap = new Map<string, MatchedCompany>();
    const unmatchedResults: UnmatchedCompany[] = [];
    const seenUnmatched = new Set<string>();

    for (const company of uploadedCompanies) {
      let linkedinMatch: CompanyDemographicItem | undefined;
      let matchType: 'name' | 'domain' = 'name';
      let dedupeKey = '';

      // Try name match first
      if (company.name) {
        const normalizedName = normalizeName(company.name);
        linkedinMatch = nameMap.get(normalizedName);
        if (linkedinMatch) dedupeKey = linkedinMatch.entityUrn || normalizedName;
      }

      // Fall back to URL match
      if (!linkedinMatch && company.url) {
        const standardizedUrl = standardizeUrl(company.url);
        linkedinMatch = domainMap.get(standardizedUrl);
        if (linkedinMatch) {
          matchType = 'domain';
          dedupeKey = linkedinMatch.entityUrn || standardizedUrl;
        }
      }

      if (linkedinMatch) {
        const existing = matchedMap.get(dedupeKey);
        if (existing) {
          // Merge: just add this uploaded entry to the existing match
          existing.uploadedEntries.push(company);
        } else {
          const breakdownSource = linkedinMatch.objectiveBreakdown 
            || objectiveBreakdownCache?.get(linkedinMatch.entityUrn) 
            || [];
          const { objectives, allNames } = breakdownSource.length > 0
            ? buildObjectives(breakdownSource)
            : { objectives: [], allNames: [] };

          const costPerLead = linkedinMatch.leads > 0
            ? linkedinMatch.spent / linkedinMatch.leads
            : 0;
          const engagementRate = linkedinMatch.impressions > 0
            ? (linkedinMatch.engagements / linkedinMatch.impressions) * 100
            : 0;

          matchedMap.set(dedupeKey, {
            uploaded: company,
            uploadedEntries: [company],
            linkedin: linkedinMatch,
            matchType,
            objectives,
            allCampaignNames: allNames,
            costPerLead,
            engagementRate,
          });
        }
      } else {
        // Deduplicate unmatched too
        const unmatchedKey = normalizeName(company.name) || standardizeUrl(company.url);
        if (!seenUnmatched.has(unmatchedKey)) {
          seenUnmatched.add(unmatchedKey);
          unmatchedResults.push({ uploaded: company });
        }
      }
    }

    const matchedResults = Array.from(matchedMap.values());
    const uniqueCount = matchedResults.length + unmatchedResults.length;

    return { matched: matchedResults, unmatched: unmatchedResults, uniqueUploadedCount: uniqueCount };
  }, [uploadedCompanies, nameMap, domainMap, objectiveBreakdownCache]);

  // Summary totals for matched companies
  const matchedTotals = useMemo(() => {
    return matched.reduce(
      (acc, m) => ({
        impressions: acc.impressions + m.linkedin.impressions,
        clicks: acc.clicks + m.linkedin.clicks,
        spent: acc.spent + m.linkedin.spent,
        leads: acc.leads + m.linkedin.leads,
        engagements: acc.engagements + m.linkedin.engagements,
        landingPageClicks: acc.landingPageClicks + m.linkedin.landingPageClicks,
        reactions: acc.reactions + m.linkedin.reactions,
        shares: acc.shares + m.linkedin.shares,
      }),
      { impressions: 0, clicks: 0, spent: 0, leads: 0, engagements: 0, landingPageClicks: 0, reactions: 0, shares: 0 }
    );
  }, [matched]);

  const matchRate = uniqueUploadedCount > 0
    ? Math.round((matched.length / uniqueUploadedCount) * 100)
    : 0;

  const avgCostPerLead = matchedTotals.leads > 0
    ? matchedTotals.spent / matchedTotals.leads
    : 0;

  const overallCtr = matchedTotals.impressions > 0
    ? (matchedTotals.clicks / matchedTotals.impressions) * 100
    : 0;

  // Sorting and filtering
  const filteredData = useMemo(() => {
    let data: (MatchedCompany | UnmatchedCompany)[];

    if (activeTab === 'matched') data = [...matched];
    else if (activeTab === 'unmatched') data = [...unmatched];
    else data = [...matched, ...unmatched];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter(item => {
        const name = item.uploaded.name?.toLowerCase() || '';
        const url = item.uploaded.url?.toLowerCase() || '';
        if (isMatchedItem(item)) {
          const liName = item.linkedin.entityName?.toLowerCase() || '';
          const campaigns = item.allCampaignNames.join(' ').toLowerCase();
          const objectives = item.objectives.map(o => o.objective).join(' ').toLowerCase();
          return name.includes(q) || url.includes(q) || liName.includes(q) || campaigns.includes(q) || objectives.includes(q);
        }
        return name.includes(q) || url.includes(q);
      });
    }

    data.sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';

      switch (sortField) {
        case 'name':
          aVal = (isMatchedItem(a) ? a.linkedin.entityName : a.uploaded.name)?.toLowerCase() || '';
          bVal = (isMatchedItem(b) ? b.linkedin.entityName : b.uploaded.name)?.toLowerCase() || '';
          break;
        case 'date':
          aVal = a.uploaded.date || '';
          bVal = b.uploaded.date || '';
          break;
        case 'impressions':
          aVal = isMatchedItem(a) ? a.linkedin.impressions : 0;
          bVal = isMatchedItem(b) ? b.linkedin.impressions : 0;
          break;
        case 'clicks':
          aVal = isMatchedItem(a) ? a.linkedin.clicks : 0;
          bVal = isMatchedItem(b) ? b.linkedin.clicks : 0;
          break;
        case 'spent':
          aVal = isMatchedItem(a) ? a.linkedin.spent : 0;
          bVal = isMatchedItem(b) ? b.linkedin.spent : 0;
          break;
        case 'leads':
          aVal = isMatchedItem(a) ? a.linkedin.leads : 0;
          bVal = isMatchedItem(b) ? b.linkedin.leads : 0;
          break;
        case 'engagements':
          aVal = isMatchedItem(a) ? a.linkedin.engagements : 0;
          bVal = isMatchedItem(b) ? b.linkedin.engagements : 0;
          break;
      }

      if (typeof aVal === 'string') {
        const cmp = aVal.localeCompare(bVal as string);
        return sortDirection === 'asc' ? cmp : -cmp;
      }
      return sortDirection === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

    return data;
  }, [activeTab, matched, unmatched, searchQuery, sortField, sortDirection]);

  const handleSort = useCallback((field: string) => {
    setSortDirection(prev => (sortField === field ? (prev === 'asc' ? 'desc' : 'asc') : 'desc'));
    setSortField(field);
  }, [sortField]);

  const parseCSV = useCallback((file: File) => {
    setParseError(null);
    setFileName(file.name);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          setParseError(`CSV parse error: ${results.errors[0].message}`);
          return;
        }

        const headers = results.meta.fields || [];
        setCsvHeaders(headers);

        const detected = detectColumns(headers);
        setNameColumn(detected.nameCol);
        setUrlColumn(detected.urlCol);
        setDateColumn(detected.dateCol);

        if (!detected.nameCol && !detected.urlCol) {
          setParseError('Could not detect company name, URL, or email columns. Please ensure your CSV has columns like "Company Name", "URL", "Website", or "Email".');
          return;
        }

        const companies: UploadedCompany[] = (results.data as Record<string, string>[]).map(row => ({
          name: detected.nameCol ? (row[detected.nameCol] || '').trim() : '',
          url: detected.urlCol ? (row[detected.urlCol] || '').trim() : '',
          date: detected.dateCol ? (row[detected.dateCol] || '').trim() : '',
          rawRow: row,
        })).filter(c => c.name || c.url);

        setUploadedCompanies(companies);
      },
      error: (err) => {
        setParseError(`Failed to parse CSV: ${err.message}`);
      },
    });
  }, []);

  const clearUpload = useCallback(() => {
    setUploadedCompanies([]);
    setCsvHeaders([]);
    setNameColumn(null);
    setUrlColumn(null);
    setDateColumn(null);
    setFileName(null);
    setParseError(null);
    setSearchQuery('');
  }, []);

  const updateColumnMapping = useCallback((type: 'name' | 'url' | 'date', column: string | null) => {
    if (type === 'name') setNameColumn(column);
    else if (type === 'url') setUrlColumn(column);
    else setDateColumn(column);

    if (uploadedCompanies.length > 0) {
      const newNameCol = type === 'name' ? column : nameColumn;
      const newUrlCol = type === 'url' ? column : urlColumn;
      const newDateCol = type === 'date' ? column : dateColumn;

      setUploadedCompanies(prev =>
        prev.map(c => ({
          name: newNameCol ? (c.rawRow[newNameCol] || '').trim() : '',
          url: newUrlCol ? (c.rawRow[newUrlCol] || '').trim() : '',
          date: newDateCol ? (c.rawRow[newDateCol] || '').trim() : '',
          rawRow: c.rawRow,
        })).filter(c => c.name || c.url)
      );
    }
  }, [uploadedCompanies, nameColumn, urlColumn, dateColumn]);

  const getExportData = useCallback((linkedInDateRange?: { start: string; end: string }, campaignBreakdownCache?: Map<string, any[]>) => {
    return matched.map(m => {
      // Build campaign list: prefer per-company breakdown cache (most accurate),
      // fall back to objective-level campaign names (time-frame filtered by edge fn)
      const campaignNamesForExport = new Set<string>();
      for (const obj of m.objectives) {
        const cacheKey = `${m.linkedin.entityUrn}::${obj.objective}`;
        const perCompanyCampaigns = campaignBreakdownCache?.get(cacheKey);
        if (perCompanyCampaigns && perCompanyCampaigns.length > 0) {
          for (const cb of perCompanyCampaigns) {
            if ((cb.impressions || 0) > 0 && cb.campaignName) {
              campaignNamesForExport.add(cb.campaignName);
            }
          }
        } else {
          for (const name of obj.campaignNames) {
            campaignNamesForExport.add(name);
          }
        }
      }

      return {
        companyName: m.uploaded.name,
        companyUrl: m.uploaded.url,
        companyDate: m.uploadedEntries.map(e => e.date).filter(Boolean).join('; '),
        matchType: m.matchType,
        linkedInName: m.linkedin.entityName,
        linkedInWebsite: m.linkedin.website || '',
        objectives: m.objectives.map(o => o.objective).join('; '),
        campaignNames: Array.from(campaignNamesForExport).join('; '),
        impactPeriod: linkedInDateRange ? `${linkedInDateRange.start} to ${linkedInDateRange.end}` : '',
        impressions: m.linkedin.impressions,
        clicks: m.linkedin.clicks,
        landingPageClicks: m.linkedin.landingPageClicks,
        spent: m.linkedin.spent.toFixed(2),
        leads: m.linkedin.leads,
        engagements: m.linkedin.engagements,
        costPerLead: m.costPerLead > 0 ? m.costPerLead.toFixed(2) : '',
        ctr: m.linkedin.ctr.toFixed(2),
        cpc: m.linkedin.cpc.toFixed(2),
        cpm: m.linkedin.cpm.toFixed(2),
      };
    });
  }, [matched]);

  return {
    uploadedCompanies,
    csvHeaders,
    nameColumn,
    urlColumn,
    dateColumn,
    fileName,
    parseError,
    matched,
    unmatched,
    uniqueUploadedCount,
    matchedTotals,
    matchRate,
    avgCostPerLead,
    overallCtr,
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    sortField,
    sortDirection,
    handleSort,
    filteredData,
    parseCSV,
    clearUpload,
    updateColumnMapping,
    getExportData,
  };
}
