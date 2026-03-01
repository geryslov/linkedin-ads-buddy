import { useState, useCallback, useMemo } from 'react';
import Papa from 'papaparse';
import { CompanyDemographicItem } from '@/hooks/useCompanyDemographic';

export interface UploadedCompany {
  name: string;
  url: string;
  date: string;
  rawRow: Record<string, string>;
}

export interface MatchedCompany {
  uploaded: UploadedCompany;
  linkedin: CompanyDemographicItem;
  matchType: 'name' | 'domain';
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

function standardizeUrl(url: string): string {
  if (!url) return '';
  return url
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .replace(/\/$/, '');
}

function detectColumns(headers: string[]): { nameCol: string | null; urlCol: string | null; dateCol: string | null } {
  const lower = headers.map(h => h.toLowerCase().trim());

  const namePatterns = ['company name', 'company', 'name', 'account name', 'organization', 'org'];
  const urlPatterns = ['url', 'website', 'domain', 'company url', 'website url', 'web', 'site'];
  const datePatterns = ['date', 'close date', 'created date', 'created', 'closed', 'deal date', 'opportunity date'];

  const find = (patterns: string[]) => {
    for (const p of patterns) {
      const idx = lower.indexOf(p);
      if (idx !== -1) return headers[idx];
    }
    // Partial match fallback
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

export function useCompanyInfluenceMatcher(linkedInData: CompanyDemographicItem[]) {
  const [uploadedCompanies, setUploadedCompanies] = useState<UploadedCompany[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [nameColumn, setNameColumn] = useState<string | null>(null);
  const [urlColumn, setUrlColumn] = useState<string | null>(null);
  const [dateColumn, setDateColumn] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<InfluenceTab>('matched');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

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

  // Perform matching
  const { matched, unmatched } = useMemo(() => {
    const matchedResults: MatchedCompany[] = [];
    const unmatchedResults: UnmatchedCompany[] = [];

    for (const company of uploadedCompanies) {
      let linkedinMatch: CompanyDemographicItem | undefined;
      let matchType: 'name' | 'domain' = 'name';

      // Try name match first
      if (company.name) {
        const normalizedName = normalizeName(company.name);
        linkedinMatch = nameMap.get(normalizedName);
      }

      // Fall back to URL match
      if (!linkedinMatch && company.url) {
        const standardizedUrl = standardizeUrl(company.url);
        linkedinMatch = domainMap.get(standardizedUrl);
        if (linkedinMatch) matchType = 'domain';
      }

      if (linkedinMatch) {
        matchedResults.push({ uploaded: company, linkedin: linkedinMatch, matchType });
      } else {
        unmatchedResults.push({ uploaded: company });
      }
    }

    return { matched: matchedResults, unmatched: unmatchedResults };
  }, [uploadedCompanies, nameMap, domainMap]);

  // Summary totals for matched companies
  const matchedTotals = useMemo(() => {
    return matched.reduce(
      (acc, m) => ({
        impressions: acc.impressions + m.linkedin.impressions,
        clicks: acc.clicks + m.linkedin.clicks,
        spent: acc.spent + m.linkedin.spent,
        leads: acc.leads + m.linkedin.leads,
      }),
      { impressions: 0, clicks: 0, spent: 0, leads: 0 }
    );
  }, [matched]);

  const matchRate = uploadedCompanies.length > 0
    ? Math.round((matched.length / uploadedCompanies.length) * 100)
    : 0;

  // Sorting and filtering
  const filteredData = useMemo(() => {
    let data: (MatchedCompany | UnmatchedCompany)[];

    if (activeTab === 'matched') data = matched;
    else if (activeTab === 'unmatched') data = unmatched;
    else data = [...matched, ...unmatched];

    // Filter by search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter(item => {
        const name = item.uploaded.name?.toLowerCase() || '';
        const url = item.uploaded.url?.toLowerCase() || '';
        const liName = 'linkedin' in item ? (item as MatchedCompany).linkedin.entityName?.toLowerCase() || '' : '';
        return name.includes(q) || url.includes(q) || liName.includes(q);
      });
    }

    // Sort
    data.sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';

      switch (sortField) {
        case 'name':
          aVal = a.uploaded.name?.toLowerCase() || '';
          bVal = b.uploaded.name?.toLowerCase() || '';
          break;
        case 'date':
          aVal = a.uploaded.date || '';
          bVal = b.uploaded.date || '';
          break;
        case 'impressions':
          aVal = 'linkedin' in a ? (a as MatchedCompany).linkedin.impressions : 0;
          bVal = 'linkedin' in b ? (b as MatchedCompany).linkedin.impressions : 0;
          break;
        case 'clicks':
          aVal = 'linkedin' in a ? (a as MatchedCompany).linkedin.clicks : 0;
          bVal = 'linkedin' in b ? (b as MatchedCompany).linkedin.clicks : 0;
          break;
        case 'spent':
          aVal = 'linkedin' in a ? (a as MatchedCompany).linkedin.spent : 0;
          bVal = 'linkedin' in b ? (b as MatchedCompany).linkedin.spent : 0;
          break;
        case 'leads':
          aVal = 'linkedin' in a ? (a as MatchedCompany).linkedin.leads : 0;
          bVal = 'linkedin' in b ? (b as MatchedCompany).linkedin.leads : 0;
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
          setParseError('Could not detect company name or URL columns. Please ensure your CSV has columns like "Company Name", "URL", or "Website".');
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

    // Re-map uploaded companies with new column selection
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

  // Export data for matched results
  const getExportData = useCallback(() => {
    return matched.map(m => ({
      companyName: m.uploaded.name,
      companyUrl: m.uploaded.url,
      companyDate: m.uploaded.date,
      matchType: m.matchType,
      linkedInName: m.linkedin.entityName,
      linkedInWebsite: m.linkedin.website || '',
      impressions: m.linkedin.impressions,
      clicks: m.linkedin.clicks,
      spent: m.linkedin.spent.toFixed(2),
      leads: m.linkedin.leads,
      ctr: m.linkedin.ctr.toFixed(2),
    }));
  }, [matched]);

  return {
    // CSV state
    uploadedCompanies,
    csvHeaders,
    nameColumn,
    urlColumn,
    dateColumn,
    fileName,
    parseError,
    // Matching results
    matched,
    unmatched,
    matchedTotals,
    matchRate,
    // UI state
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    sortField,
    sortDirection,
    handleSort,
    filteredData,
    // Actions
    parseCSV,
    clearUpload,
    updateColumnMapping,
    getExportData,
  };
}
