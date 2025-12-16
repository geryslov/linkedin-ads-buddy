// CSV Export Utilities

export function exportToCSV(data: Record<string, any>[], filename: string, columns?: { key: string; label: string }[]) {
  if (!data || data.length === 0) {
    return;
  }

  // If columns not provided, use all keys from first object
  const headers = columns 
    ? columns.map(c => c.label) 
    : Object.keys(data[0]);
  
  const keys = columns 
    ? columns.map(c => c.key) 
    : Object.keys(data[0]);

  // Create CSV content
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      keys.map(key => {
        const value = row[key];
        // Handle different value types
        if (value === null || value === undefined) return '';
        if (typeof value === 'string') {
          // Escape quotes and wrap in quotes if contains comma or quote
          const escaped = value.replace(/"/g, '""');
          return escaped.includes(',') || escaped.includes('"') || escaped.includes('\n') 
            ? `"${escaped}"` 
            : escaped;
        }
        if (typeof value === 'number') {
          return value.toString();
        }
        return String(value);
      }).join(',')
    )
  ].join('\n');

  // Create and download file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Predefined column configs for different report types
export const creativeReportColumns = [
  { key: 'creativeName', label: 'Creative Name' },
  { key: 'campaignName', label: 'Campaign' },
  { key: 'impressions', label: 'Impressions' },
  { key: 'clicks', label: 'Clicks' },
  { key: 'spent', label: 'Spent' },
  { key: 'leads', label: 'Leads' },
  { key: 'ctr', label: 'CTR %' },
  { key: 'cpc', label: 'CPC' },
  { key: 'cpm', label: 'CPM' },
];

export const creativeNamesReportColumns = [
  { key: 'creativeName', label: 'Creative Name' },
  { key: 'campaignName', label: 'Campaign' },
  { key: 'status', label: 'Status' },
  { key: 'impressions', label: 'Impressions' },
  { key: 'clicks', label: 'Clicks' },
  { key: 'spent', label: 'Spent' },
  { key: 'leads', label: 'Leads' },
  { key: 'ctr', label: 'CTR %' },
  { key: 'cpc', label: 'CPC' },
  { key: 'cpm', label: 'CPM' },
  { key: 'costPerLead', label: 'Cost Per Lead' },
];

export const demographicReportColumns = [
  { key: 'entityName', label: 'Entity' },
  { key: 'impressions', label: 'Impressions' },
  { key: 'clicks', label: 'Clicks' },
  { key: 'spent', label: 'Spent' },
  { key: 'leads', label: 'Leads' },
  { key: 'ctr', label: 'CTR %' },
  { key: 'cpc', label: 'CPC' },
  { key: 'cpm', label: 'CPM' },
];

export const companyDemographicColumns = [
  { key: 'companyName', label: 'Company Name' },
  { key: 'websiteUrl', label: 'Website' },
  { key: 'linkedInUrl', label: 'LinkedIn URL' },
  { key: 'impressions', label: 'Impressions' },
  { key: 'clicks', label: 'Clicks' },
  { key: 'spent', label: 'Spent' },
  { key: 'leads', label: 'Leads' },
  { key: 'ctr', label: 'CTR %' },
  { key: 'cpc', label: 'CPC' },
  { key: 'cpm', label: 'CPM' },
];

export const companyIntelligenceColumns = [
  { key: 'companyName', label: 'Company Name' },
  { key: 'paidImpressions', label: 'Paid Impressions' },
  { key: 'paidClicks', label: 'Paid Clicks' },
  { key: 'leads', label: 'Leads' },
  { key: 'organicImpressions', label: 'Organic Impressions' },
  { key: 'engagementScore', label: 'Engagement Score' },
];

export const accountStructureColumns = [
  { key: 'groupName', label: 'Campaign Group' },
  { key: 'campaignName', label: 'Campaign' },
  { key: 'creativeName', label: 'Creative' },
  { key: 'status', label: 'Status' },
];
