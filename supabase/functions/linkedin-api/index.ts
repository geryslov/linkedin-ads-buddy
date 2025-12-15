import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LINKEDIN_CLIENT_ID = Deno.env.get('LINKEDIN_CLIENT_ID');
const LINKEDIN_CLIENT_SECRET = Deno.env.get('LINKEDIN_CLIENT_SECRET');

// Helper function to format pivot values into human-readable names
function formatPivotValue(urn: string, pivot: string): string {
  const parts = urn.split(':');
  const value = parts[parts.length - 1];
  
  // Job function mappings (LinkedIn uses numeric IDs)
  const jobFunctionMap: Record<string, string> = {
    '1': 'Accounting', '2': 'Administrative', '3': 'Arts and Design',
    '4': 'Business Development', '5': 'Community & Social Services', '6': 'Consulting',
    '7': 'Education', '8': 'Engineering', '9': 'Entrepreneurship',
    '10': 'Finance', '11': 'Healthcare Services', '12': 'Human Resources',
    '13': 'Information Technology', '14': 'Legal', '15': 'Marketing',
    '16': 'Media & Communications', '17': 'Military & Protective Services', '18': 'Operations',
    '19': 'Product Management', '20': 'Program & Project Management', '21': 'Purchasing',
    '22': 'Quality Assurance', '23': 'Real Estate', '24': 'Research',
    '25': 'Sales', '26': 'Support',
  };
  
  // Seniority mappings
  const seniorityMap: Record<string, string> = {
    '1': 'Unpaid', '2': 'Training', '3': 'Entry',
    '4': 'Senior', '5': 'Manager', '6': 'Director',
    '7': 'VP', '8': 'CXO', '9': 'Partner', '10': 'Owner',
  };
  
  // Industry mappings (common ones)
  const industryMap: Record<string, string> = {
    '1': 'Defense & Space', '3': 'Computer Hardware', '4': 'Computer Software',
    '5': 'Computer Networking', '6': 'Internet', '7': 'Semiconductors',
    '8': 'Telecommunications', '9': 'Law Practice', '10': 'Legal Services',
    '11': 'Management Consulting', '12': 'Biotechnology', '13': 'Medical Practice',
    '14': 'Hospital & Health Care', '15': 'Pharmaceuticals', '16': 'Veterinary',
    '17': 'Medical Devices', '18': 'Cosmetics', '19': 'Apparel & Fashion',
    '20': 'Sporting Goods', '21': 'Tobacco', '22': 'Supermarkets',
    '23': 'Food Production', '24': 'Consumer Electronics', '25': 'Consumer Goods',
    '26': 'Furniture', '27': 'Retail', '28': 'Entertainment',
    '29': 'Gambling & Casinos', '30': 'Leisure, Travel & Tourism', '31': 'Hospitality',
    '32': 'Restaurants', '33': 'Sports', '34': 'Food & Beverages',
    '35': 'Motion Pictures and Film', '36': 'Broadcast Media', '37': 'Museums and Institutions',
    '38': 'Fine Art', '39': 'Performing Arts', '40': 'Recreational Facilities and Services',
    '41': 'Banking', '42': 'Insurance', '43': 'Financial Services',
    '44': 'Real Estate', '45': 'Investment Banking', '46': 'Investment Management',
    '47': 'Accounting', '48': 'Construction', '49': 'Building Materials',
    '50': 'Architecture & Planning', '51': 'Civil Engineering', '52': 'Aviation & Aerospace',
    '53': 'Automotive', '54': 'Chemicals', '55': 'Machinery',
    '56': 'Mining & Metals', '57': 'Oil & Energy', '58': 'Shipbuilding',
    '59': 'Utilities', '60': 'Textiles', '61': 'Paper & Forest Products',
    '62': 'Railroad Manufacture', '63': 'Farming', '64': 'Ranching',
    '65': 'Dairy', '66': 'Fishery', '67': 'Primary/Secondary Education',
    '68': 'Higher Education', '69': 'Education Management', '70': 'Research',
    '71': 'Military', '72': 'Legislative Office', '73': 'Judiciary',
    '74': 'International Affairs', '75': 'Government Administration', '76': 'Executive Office',
    '77': 'Law Enforcement', '78': 'Public Safety', '79': 'Public Policy',
    '80': 'Marketing and Advertising', '81': 'Newspapers', '82': 'Publishing',
    '83': 'Printing', '84': 'Information Services', '85': 'Libraries',
    '86': 'Environmental Services', '87': 'Package/Freight Delivery', '88': 'Individual & Family Services',
    '89': 'Religious Institutions', '90': 'Civic & Social Organization', '91': 'Consumer Services',
    '92': 'Transportation/Trucking/Railroad', '93': 'Warehousing', '94': 'Airlines/Aviation',
    '95': 'Maritime', '96': 'Information Technology and Services', '97': 'Market Research',
    '98': 'Public Relations and Communications', '99': 'Design', '100': 'Nonprofit Organization Management',
    '101': 'Fund-Raising', '102': 'Program Development', '103': 'Writing and Editing',
    '104': 'Staffing and Recruiting', '105': 'Professional Training & Coaching', '106': 'Venture Capital & Private Equity',
    '107': 'Political Organization', '108': 'Translation and Localization', '109': 'Computer Games',
    '110': 'Events Services', '111': 'Arts and Crafts', '112': 'Electrical/Electronic Manufacturing',
    '113': 'Online Media', '114': 'Nanotechnology', '115': 'Music',
    '116': 'Logistics and Supply Chain', '117': 'Plastics', '118': 'Computer & Network Security',
    '119': 'Wireless', '120': 'Alternative Dispute Resolution', '121': 'Security and Investigations',
    '122': 'Facilities Services', '123': 'Outsourcing/Offshoring', '124': 'Health, Wellness and Fitness',
    '125': 'Alternative Medicine', '126': 'Media Production', '127': 'Animation',
    '128': 'Commercial Real Estate', '129': 'Capital Markets', '130': 'Think Tanks',
    '131': 'Philanthropy', '132': 'E-Learning', '133': 'Wholesale',
    '134': 'Import and Export', '135': 'Mechanical or Industrial Engineering', '136': 'Photography',
    '137': 'Human Resources', '138': 'Business Supplies and Equipment', '139': 'Mental Health Care',
    '140': 'Graphic Design', '141': 'International Trade and Development', '142': 'Wine and Spirits',
    '143': 'Luxury Goods & Jewelry', '144': 'Renewables & Environment', '145': 'Glass, Ceramics & Concrete',
    '146': 'Packaging and Containers', '147': 'Industrial Automation', '148': 'Government Relations',
  };
  
  switch (pivot) {
    case 'MEMBER_JOB_FUNCTION':
      return jobFunctionMap[value] || `Job Function ${value}`;
    case 'MEMBER_SENIORITY':
      return seniorityMap[value] || `Seniority ${value}`;
    case 'MEMBER_INDUSTRY':
      return industryMap[value] || `Industry ${value}`;
    case 'MEMBER_COUNTRY':
      // Country codes are usually ISO 2-letter codes
      return value.toUpperCase();
    case 'MEMBER_JOB_TITLE':
      // Job titles come as-is from LinkedIn
      return value || 'Unknown Job Title';
    default:
      return value || 'Unknown';
  }
}

// Helper to extract a name from URN when no lookup is available
function extractNameFromUrn(urn: string): string {
  if (!urn) return 'Unknown';
  const parts = urn.split(':');
  return parts[parts.length - 1] || 'Unknown';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, accessToken, params } = await req.json();
    console.log(`LinkedIn API action: ${action}`);

    switch (action) {
      case 'get_auth_url': {
        const redirectUri = params?.redirectUri || `${req.headers.get('origin')}/callback`;
        const scope = 'r_liteprofile r_ads r_ads_reporting rw_ads w_member_social';
        const state = crypto.randomUUID();
        
        const authUrl = `https://www.linkedin.com/oauth/v2/authorization?` +
          `response_type=code&` +
          `client_id=${LINKEDIN_CLIENT_ID}&` +
          `redirect_uri=${encodeURIComponent(redirectUri)}&` +
          `state=${state}&` +
          `scope=${encodeURIComponent(scope)}`;

        return new Response(JSON.stringify({ authUrl, state }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'exchange_token': {
        const { code, redirectUri } = params;
        
        const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
            client_id: LINKEDIN_CLIENT_ID!,
            client_secret: LINKEDIN_CLIENT_SECRET!,
          }),
        });

        const tokenData = await tokenResponse.json();
        console.log('Token exchange result:', tokenResponse.ok ? 'success' : 'failed');
        
        return new Response(JSON.stringify(tokenData), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_profile': {
        const profileResponse = await fetch('https://api.linkedin.com/v2/me', {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        const profile = await profileResponse.json();
        
        return new Response(JSON.stringify(profile), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_ad_accounts': {
        const accountsResponse = await fetch(
          'https://api.linkedin.com/v2/adAccountsV2?q=search&search.status.values[0]=ACTIVE',
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );
        const accounts = await accountsResponse.json();
        console.log('Ad accounts fetched:', accounts.elements?.length || 0);
        
        return new Response(JSON.stringify(accounts), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_campaigns': {
        const { accountId, status } = params || {};
        let url = `https://api.linkedin.com/v2/adCampaignsV2?q=search&search.account.values[0]=urn:li:sponsoredAccount:${accountId}`;
        if (status) {
          url += `&search.status.values[0]=${status}`;
        }
        
        const campaignsResponse = await fetch(url, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        const campaigns = await campaignsResponse.json();
        console.log('Campaigns fetched:', campaigns.elements?.length || 0);
        
        return new Response(JSON.stringify(campaigns), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_analytics': {
        const { accountId, campaignIds, dateRange } = params || {};
        const startDate = dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const endDate = dateRange?.end || new Date().toISOString().split('T')[0];
        
        let url = `https://api.linkedin.com/v2/adAnalyticsV2?q=analytics&` +
          `dateRange.start.day=${new Date(startDate).getDate()}&` +
          `dateRange.start.month=${new Date(startDate).getMonth() + 1}&` +
          `dateRange.start.year=${new Date(startDate).getFullYear()}&` +
          `dateRange.end.day=${new Date(endDate).getDate()}&` +
          `dateRange.end.month=${new Date(endDate).getMonth() + 1}&` +
          `dateRange.end.year=${new Date(endDate).getFullYear()}&` +
          `timeGranularity=DAILY&` +
          `accounts[0]=urn:li:sponsoredAccount:${accountId}&` +
          `fields=impressions,clicks,costInLocalCurrency,conversions,externalWebsiteConversions`;
        
        if (campaignIds?.length) {
          campaignIds.forEach((id: string, i: number) => {
            url += `&campaigns[${i}]=urn:li:sponsoredCampaign:${id}`;
          });
        }
        
        const analyticsResponse = await fetch(url, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        const analytics = await analyticsResponse.json();
        console.log('Analytics fetched:', analytics.elements?.length || 0);
        
        return new Response(JSON.stringify(analytics), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_audiences': {
        const { accountId } = params || {};
        const audiencesResponse = await fetch(
          `https://api.linkedin.com/v2/dmpSegments?q=account&account=urn:li:sponsoredAccount:${accountId}`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );
        const audiences = await audiencesResponse.json();
        console.log('Audiences fetched:', audiences.elements?.length || 0);
        
        return new Response(JSON.stringify(audiences), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_creatives': {
        const { accountId } = params || {};
        const creativesResponse = await fetch(
          `https://api.linkedin.com/v2/adCreativesV2?q=search&search.account.values[0]=urn:li:sponsoredAccount:${accountId}`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );
        const creatives = await creativesResponse.json();
        console.log('Creatives fetched:', creatives.elements?.length || 0);
        
        return new Response(JSON.stringify(creatives), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_creative_analytics': {
        const { accountId, dateRange, timeGranularity, campaignIds } = params || {};
        const startDate = dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const endDate = dateRange?.end || new Date().toISOString().split('T')[0];
        const granularity = timeGranularity || 'DAILY';
        
        // First fetch campaigns if not provided
        let campaigns = campaignIds || [];
        if (campaigns.length === 0) {
          const campaignsResponse = await fetch(
            `https://api.linkedin.com/v2/adCampaignsV2?q=search&search.account.values[0]=urn:li:sponsoredAccount:${accountId}&count=100`,
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
          );
          const campaignsData = await campaignsResponse.json();
          campaigns = (campaignsData.elements || []).map((c: any) => c.id.toString());
          console.log('Fetched campaigns for creative analytics:', campaigns.length);
        }

        if (campaigns.length === 0) {
          console.log('No campaigns found, returning empty creative analytics');
          return new Response(JSON.stringify({ elements: [] }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Build URL with campaigns for CREATIVE pivot
        let url = `https://api.linkedin.com/v2/adAnalyticsV2?q=analytics&` +
          `dateRange.start.day=${new Date(startDate).getDate()}&` +
          `dateRange.start.month=${new Date(startDate).getMonth() + 1}&` +
          `dateRange.start.year=${new Date(startDate).getFullYear()}&` +
          `dateRange.end.day=${new Date(endDate).getDate()}&` +
          `dateRange.end.month=${new Date(endDate).getMonth() + 1}&` +
          `dateRange.end.year=${new Date(endDate).getFullYear()}&` +
          `timeGranularity=${granularity}&` +
          `pivot=CREATIVE&` +
          `fields=impressions,clicks,costInLocalCurrency,conversions,externalWebsiteConversions,oneClickLeads,dateRange,pivotValue`;

        // Add campaigns to query (required for CREATIVE pivot)
        campaigns.slice(0, 20).forEach((id: string, i: number) => {
          url += `&campaigns[${i}]=urn:li:sponsoredCampaign:${id}`;
        });
        
        console.log('Fetching creative analytics with', Math.min(campaigns.length, 20), 'campaigns');
        const analyticsResponse = await fetch(url, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        const analytics = await analyticsResponse.json();
        console.log('Creative analytics fetched:', analytics.elements?.length || 0);
        
        return new Response(JSON.stringify(analytics), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_creative_report': {
        // Fetches creative-level analytics with legacy name resolution + fallbacks
        const { accountId, dateRange, timeGranularity } = params || {};
        const startDate = dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const endDate = dateRange?.end || new Date().toISOString().split('T')[0];
        const granularity = timeGranularity || 'ALL';
        
        console.log(`[get_creative_report] Starting for account ${accountId}, date range: ${startDate} to ${endDate}, granularity: ${granularity}`);

        // Resolution stats for logging
        const resolutionStats = {
          legacyApi: 0,
          versionedApiFallback: 0,
          referenceResolved: 0,
          placeholder: 0,
          total: 0
        };

        // Helper: Extract name from legacy adCreativesV2 creative object
        function extractCreativeNameFromLegacy(creative: any): string | null {
          // Try creativeDscName field first (descriptive name field)
          if (creative.creativeDscName && typeof creative.creativeDscName === 'string' && creative.creativeDscName.trim()) {
            return creative.creativeDscName.trim();
          }
          
          // Try top-level 'name' field 
          if (creative.name && typeof creative.name === 'string' && creative.name.trim()) {
            return creative.name.trim();
          }
          
          // Try nested creative content/variables
          const variables = creative.variables || {};
          const data = variables.data || {};
          
          // Check for creativeDscName in nested structure
          if (data.creativeDscName && typeof data.creativeDscName === 'string' && data.creativeDscName.trim()) {
            return data.creativeDscName.trim();
          }
          
          // Check for sponsored content text
          if (data.com?.linkedin?.ads?.SponsoredVideoCreativeVariables?.userGeneratedContentPost) {
            // UGC Post reference - would need separate resolution
            return null;
          }
          
          // Check for text-based creative content
          if (data.com?.linkedin?.ads?.TextAdCreativeVariables?.text) {
            return data.com.linkedin.ads.TextAdCreativeVariables.text;
          }
          
          // Check for InMail subject
          if (data.com?.linkedin?.ads?.MessageAdCreativeVariables?.subject) {
            return data.com.linkedin.ads.MessageAdCreativeVariables.subject;
          }
          
          // Check for carousel headline
          if (data.com?.linkedin?.ads?.CarouselAdCreativeVariables?.headline) {
            return data.com.linkedin.ads.CarouselAdCreativeVariables.headline;
          }
          
          // Try reference field for UGC content
          if (creative.reference && typeof creative.reference === 'string') {
            // Reference contains URN to share/ugcPost - could resolve but skip for now
            return null;
          }
          
          return null;
        }

        // Helper: Fetch creative names via LEGACY adCreativesV2 endpoint
        async function fetchCreativeNamesLegacy(accountId: string, token: string): Promise<Map<string, { name: string; source: string; campaignId: string; status: string; type: string }>> {
          const creativeData = new Map<string, { name: string; source: string; campaignId: string; status: string; type: string }>();
          
          console.log('[Legacy API] Fetching creatives from adCreativesV2...');
          const url = `https://api.linkedin.com/v2/adCreativesV2?q=search&search.account.values[0]=urn:li:sponsoredAccount:${accountId}&count=500`;
          
          try {
            const response = await fetch(url, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!response.ok) {
              console.log(`[Legacy API] Failed with status ${response.status}`);
              return creativeData;
            }
            
            const data = await response.json();
            const elements = data.elements || [];
            console.log(`[Legacy API] Retrieved ${elements.length} creatives`);
            
            // Log first 3 creatives' raw structure for debugging
            if (elements.length > 0) {
              console.log('[Legacy API] === SAMPLE RAW CREATIVE DATA (first 3) ===');
              elements.slice(0, 3).forEach((creative: any, idx: number) => {
                console.log(`[Legacy API] Creative ${idx + 1} ID: ${creative.id}`);
                console.log(`[Legacy API] Creative ${idx + 1} Keys: ${Object.keys(creative).join(', ')}`);
                console.log(`[Legacy API] Creative ${idx + 1} name: ${creative.name || 'MISSING'}`);
                console.log(`[Legacy API] Creative ${idx + 1} creativeDscName: ${creative.creativeDscName || 'MISSING'}`);
                console.log(`[Legacy API] Creative ${idx + 1} status: ${creative.status || 'MISSING'}`);
                console.log(`[Legacy API] Creative ${idx + 1} type: ${creative.type || 'MISSING'}`);
                if (creative.variables) {
                  console.log(`[Legacy API] Creative ${idx + 1} variables.type: ${creative.variables.type || 'MISSING'}`);
                  console.log(`[Legacy API] Creative ${idx + 1} variables keys: ${Object.keys(creative.variables).join(', ')}`);
                }
                if (creative.reference) {
                  console.log(`[Legacy API] Creative ${idx + 1} reference: ${creative.reference}`);
                }
              });
              console.log('[Legacy API] === END SAMPLE RAW CREATIVE DATA ===');
            }
            
            for (const creative of elements) {
              const creativeId = creative.id?.toString() || '';
              if (!creativeId) continue;
              
              const campaignUrn = creative.campaign || '';
              const campaignId = campaignUrn.split(':').pop() || '';
              
              let creativeType = 'SPONSORED_CONTENT';
              if (creative.type) creativeType = creative.type;
              else if (creative.variables?.type) creativeType = creative.variables.type;
              
              const extractedName = extractCreativeNameFromLegacy(creative);
              
              creativeData.set(creativeId, {
                name: extractedName || '', // Empty if not found - will use fallback later
                source: extractedName ? 'legacy_api' : 'pending',
                campaignId,
                status: creative.status || 'UNKNOWN',
                type: creativeType,
              });
            }
            
            console.log(`[Legacy API] Extracted names for ${[...creativeData.values()].filter(v => v.name).length} of ${creativeData.size} creatives`);
          } catch (err) {
            console.error('[Legacy API] Error:', err);
          }
          
          return creativeData;
        }

        // Helper: Fetch ALL creatives via V2 adCreativesV2 API (this works reliably)
        // Then fetch names from individual creative lookup if needed
        async function fetchCreativesVersioned(accountId: string, token: string): Promise<Map<string, { name: string; campaignId: string; status: string; type: string; reference: string }>> {
          const creativeData = new Map<string, { name: string; campaignId: string; status: string; type: string; reference: string }>();
          
          console.log('[Creative Metadata] Fetching creatives from V2 adCreativesV2 API...');
          
          // Use V2 API which works reliably
          const url = `https://api.linkedin.com/v2/adCreativesV2?q=search&search.account.values[0]=urn:li:sponsoredAccount:${accountId}&count=500`;
          
          try {
            const response = await fetch(url, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!response.ok) {
              console.log(`[Creative Metadata] V2 API failed with status ${response.status}`);
              return creativeData;
            }
            
            const data = await response.json();
            const elements = data.elements || [];
            console.log(`[Creative Metadata] V2 API returned ${elements.length} creatives`);
            
            // Log sample for debugging
            if (elements.length > 0) {
              console.log('[Creative Metadata] === SAMPLE CREATIVE DATA ===');
              const sample = elements[0];
              console.log(`[Creative Metadata] Keys: ${Object.keys(sample).join(', ')}`);
              console.log(`[Creative Metadata] id: ${sample.id}`);
              console.log(`[Creative Metadata] campaign: ${sample.campaign}`);
              console.log(`[Creative Metadata] status: ${sample.status}`);
              console.log(`[Creative Metadata] type: ${sample.type}`);
              console.log(`[Creative Metadata] reference: ${sample.reference}`);
              if (sample.variables) {
                console.log(`[Creative Metadata] variables.type: ${sample.variables?.type}`);
              }
              console.log('[Creative Metadata] === END SAMPLE ===');
            }
            
            // Collect all creative IDs to fetch names via individual lookup
            const creativeIds: string[] = [];
            
            for (const creative of elements) {
              const creativeId = creative.id?.toString() || '';
              if (!creativeId) continue;
              
              creativeIds.push(creativeId);
              
              const campaignUrn = creative.campaign || '';
              const campaignId = campaignUrn.split(':').pop() || '';
              
              let creativeType = 'SPONSORED_CONTENT';
              if (creative.type) creativeType = creative.type;
              else if (creative.variables?.type) creativeType = creative.variables.type;
              
              creativeData.set(creativeId, {
                name: '', // Will be resolved below
                campaignId,
                status: creative.status || 'UNKNOWN',
                type: creativeType,
                reference: creative.reference || '',
              });
            }
            
            // Now fetch names using individual creative lookup via versioned API
            // This is more reliable than batch endpoint
            console.log(`[Creative Metadata] Fetching names for ${creativeIds.length} creatives...`);
            
            let namesResolved = 0;
            const batchSize = 10;
            
            for (let i = 0; i < Math.min(creativeIds.length, 200); i += batchSize) {
              const batch = creativeIds.slice(i, i + batchSize);
              
              await Promise.all(batch.map(async (creativeId) => {
                try {
                  // Use exact endpoint format: /rest/adAccounts/{accountId}/creatives/{creativeUrn}
                  const creativeUrn = encodeURIComponent(`urn:li:sponsoredCreative:${creativeId}`);
                  const creativeUrl = `https://api.linkedin.com/rest/adAccounts/${accountId}/creatives/${creativeUrn}`;
                  const creativeResp = await fetch(creativeUrl, {
                    headers: {
                      'Authorization': `Bearer ${token}`,
                      'LinkedIn-Version': '202511',
                      'X-Restli-Protocol-Version': '2.0.0'
                    }
                  });
                  
                  if (creativeResp.ok) {
                    const creativeDetail = await creativeResp.json();
                    if (creativeDetail.name) {
                      const existing = creativeData.get(creativeId);
                      if (existing) {
                        existing.name = creativeDetail.name;
                        creativeData.set(creativeId, existing);
                        namesResolved++;
                      }
                    }
                  } else {
                    console.log(`[Creative Metadata] Failed to fetch creative ${creativeId}: ${creativeResp.status}`);
                  }
                } catch (err) {
                  console.log(`[Creative Metadata] Error fetching creative ${creativeId}:`, err);
                }
              }));
            }
            
            console.log(`[Creative Metadata] Resolved ${namesResolved} creative names via individual lookup`);
            
          } catch (err) {
            console.error('[Creative Metadata] Error:', err);
          }
          
          const totalWithNames = [...creativeData.values()].filter(v => v.name).length;
          console.log(`[Creative Metadata] Total creatives: ${creativeData.size}, with names: ${totalWithNames}`);
          return creativeData;
        }
        
        // Helper: Fetch post/share content to extract readable text for creatives without names
        async function fetchShareContent(shareUrns: string[], token: string): Promise<Map<string, string>> {
          const shareTexts = new Map<string, string>();
          if (shareUrns.length === 0) return shareTexts;
          
          console.log(`[Share API] Fetching content for ${shareUrns.length} shares...`);
          
          for (const urn of shareUrns.slice(0, 50)) { // Limit to first 50
            try {
              // Determine if it's a share or ugcPost
              const isUgc = urn.includes('ugcPost');
              const endpoint = isUgc 
                ? `https://api.linkedin.com/v2/ugcPosts/${encodeURIComponent(urn)}`
                : `https://api.linkedin.com/v2/shares/${encodeURIComponent(urn)}`;
              
              const response: Response = await fetch(endpoint, {
                headers: { 'Authorization': `Bearer ${token}` }
              });
              
              if (response.ok) {
                const data: any = await response.json();
                
                // Extract text from share/ugcPost
                let text = '';
                if (isUgc) {
                  // UGC Post structure
                  text = data.specificContent?.['com.linkedin.ugc.ShareContent']?.shareCommentary?.text || '';
                } else {
                  // Share structure
                  text = data.text?.text || data.commentary || '';
                }
                
                if (text) {
                  // Truncate long text
                  const truncated = text.length > 80 ? text.substring(0, 77) + '...' : text;
                  shareTexts.set(urn, truncated);
                }
              }
            } catch (err) {
              console.error(`[Share API] Error fetching ${urn}:`, err);
            }
          }
          
          console.log(`[Share API] Resolved ${shareTexts.size} share texts`);
          return shareTexts;
        }

        // Step 1: Fetch campaigns for campaign name resolution
        console.log('[Step 1] Fetching campaigns...');
        const campaignsResponse = await fetch(
          `https://api.linkedin.com/v2/adCampaignsV2?q=search&search.account.values[0]=urn:li:sponsoredAccount:${accountId}&count=100`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );
        
        if (!campaignsResponse.ok) {
          throw new Error(`Failed to fetch campaigns: ${campaignsResponse.status}`);
        }
        
        const campaignsData = await campaignsResponse.json();
        const campaignMap = new Map<string, string>();
        (campaignsData.elements || []).forEach((c: any) => {
          campaignMap.set(c.id?.toString() || '', c.name || `Campaign ${c.id}`);
        });
        const campaignIds = Array.from(campaignMap.keys());
        console.log(`[Step 1] Found ${campaignIds.length} campaigns`);

        if (campaignIds.length === 0) {
          return new Response(JSON.stringify({ elements: [], metadata: { accountId, totalCreatives: 0 } }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Step 2: Fetch creatives via VERSIONED Creatives API: /rest/adAccounts/{accountId}/creatives
        // The `name` field from this API is the ONLY valid source for creative names
        console.log('[Step 2] Fetching creative metadata via versioned Creatives API (/rest/adAccounts/{id}/creatives)...');
        const versionedCreativeData = await fetchCreativesVersioned(accountId, accessToken);
        console.log(`[Step 2] Versioned Creatives API returned ${versionedCreativeData.size} creatives`);

        // Step 3: Fetch Ad Analytics pivoted by CREATIVE
        console.log('[Step 3] Fetching analytics with pivot=CREATIVE...');
        const analyticsUrl = `https://api.linkedin.com/v2/adAnalyticsV2?q=analytics&` +
          `dateRange.start.day=${new Date(startDate).getDate()}&` +
          `dateRange.start.month=${new Date(startDate).getMonth() + 1}&` +
          `dateRange.start.year=${new Date(startDate).getFullYear()}&` +
          `dateRange.end.day=${new Date(endDate).getDate()}&` +
          `dateRange.end.month=${new Date(endDate).getMonth() + 1}&` +
          `dateRange.end.year=${new Date(endDate).getFullYear()}&` +
          `timeGranularity=${granularity}&` +
          `pivot=CREATIVE&` +
          `accounts[0]=urn:li:sponsoredAccount:${accountId}&` +
          `fields=impressions,clicks,costInLocalCurrency,costInUsd,oneClickLeads,externalWebsiteConversions,pivotValue&` +
          `count=500&` +
          campaignIds.slice(0, 20).map((id, i) => `campaigns[${i}]=urn:li:sponsoredCampaign:${id}`).join('&');

        const analyticsResponse = await fetch(analyticsUrl, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        
        const analyticsData = analyticsResponse.ok ? await analyticsResponse.json() : { elements: [] };
        console.log(`[Step 3] Received ${analyticsData.elements?.length || 0} analytics records`);

        // Step 4: Aggregate analytics by creative ID
        const analyticsMap = new Map<string, { impressions: number; clicks: number; spent: number; spentUsd: number; leads: number }>();
        
        (analyticsData.elements || []).forEach((el: any) => {
          const pivotValue = el.pivotValue || '';
          if (pivotValue) {
            const creativeId = pivotValue.split(':').pop() || pivotValue;
            const existing = analyticsMap.get(creativeId) || { impressions: 0, clicks: 0, spent: 0, spentUsd: 0, leads: 0 };
            analyticsMap.set(creativeId, {
              impressions: existing.impressions + (el.impressions || 0),
              clicks: existing.clicks + (el.clicks || 0),
              spent: existing.spent + parseFloat(el.costInLocalCurrency || '0'),
              spentUsd: existing.spentUsd + parseFloat(el.costInUsd || '0'),
              leads: existing.leads + (el.oneClickLeads || 0) + (el.externalWebsiteConversions || 0),
            });
          }
        });
        console.log(`[Step 4] Aggregated ${analyticsMap.size} unique creatives with analytics`);

        // Step 5: Identify creatives that need share/post resolution for names
        const unresolvedShareUrns: string[] = [];
        versionedCreativeData.forEach((data, creativeId) => {
          if (!data.name && data.reference) {
            unresolvedShareUrns.push(data.reference);
          }
        });
        console.log(`[Step 5] ${unresolvedShareUrns.length} creatives have share references for name resolution`);

        // Step 6: Fetch share content for creatives without names (optional fallback)
        let shareTexts = new Map<string, string>();
        if (unresolvedShareUrns.length > 0) {
          shareTexts = await fetchShareContent(unresolvedShareUrns, accessToken);
          console.log(`[Step 6] Share API resolved ${shareTexts.size} share texts`);
        }

        // Step 7: Build final report with resolution tracking
        console.log('[Step 7] Building final report...');
        const reportElements: any[] = [];
        
        versionedCreativeData.forEach((meta, creativeId) => {
          resolutionStats.total++;
          
          let creativeName = '';
          let resolutionSource = '';
          
          // Priority 1: Versioned API name (canonical source)
          if (meta.name) {
            creativeName = meta.name;
            resolutionSource = 'versioned_api';
            resolutionStats.legacyApi++; // Reusing counter for versioned_api
          }
          // Priority 2: Share/Post text fallback
          else if (meta.reference && shareTexts.has(meta.reference)) {
            creativeName = shareTexts.get(meta.reference)!;
            resolutionSource = 'share_api';
            resolutionStats.versionedApiFallback++; // Reusing counter for share_api
          }
          // Priority 3: Placeholder with campaign context
          else {
            const campaignName = campaignMap.get(meta.campaignId) || 'Unknown Campaign';
            creativeName = `${campaignName} - Creative ${creativeId}`;
            resolutionSource = 'placeholder';
            resolutionStats.placeholder++;
          }
          
          const campaignName = campaignMap.get(meta.campaignId) || 'Unknown Campaign';
          const metrics = analyticsMap.get(creativeId) || { impressions: 0, clicks: 0, spent: 0, spentUsd: 0, leads: 0 };
          
          const ctr = metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : 0;
          const cpc = metrics.clicks > 0 ? metrics.spent / metrics.clicks : 0;
          const cpm = metrics.impressions > 0 ? (metrics.spent / metrics.impressions) * 1000 : 0;
          
          reportElements.push({
            creativeId,
            creativeName,
            campaignName,
            status: meta.status || 'UNKNOWN',
            type: meta.type || 'UNKNOWN',
            impressions: metrics.impressions,
            clicks: metrics.clicks,
            costInLocalCurrency: metrics.spent.toFixed(2),
            costInUsd: metrics.spentUsd.toFixed(2),
            leads: metrics.leads,
            ctr: ctr.toFixed(2),
            cpc: cpc.toFixed(2),
            cpm: cpm.toFixed(2),
            _resolutionSource: resolutionSource,
          });
        });

        // Sort by spend descending
        reportElements.sort((a, b) => parseFloat(b.costInLocalCurrency) - parseFloat(a.costInLocalCurrency));
        
        // Log resolution statistics
        console.log('[Resolution Stats] Creative name resolution breakdown:');
        console.log(`  - Versioned API (name field): ${resolutionStats.legacyApi}`);
        console.log(`  - Share/Post API fallback: ${resolutionStats.versionedApiFallback}`);
        console.log(`  - Placeholder (unresolved): ${resolutionStats.placeholder}`);
        console.log(`  - Total creatives: ${resolutionStats.total}`);
        
        const creativesWithData = reportElements.filter(r => r.impressions > 0 || parseFloat(r.costInLocalCurrency) > 0).length;
        
        console.log(`[get_creative_report] Complete. Total: ${reportElements.length}, with data: ${creativesWithData}`);
        
        return new Response(JSON.stringify({ 
          elements: reportElements,
          metadata: {
            accountId,
            dateRange: { start: startDate, end: endDate },
            timeGranularity: granularity,
            totalCreatives: reportElements.length,
            creativesWithData,
            resolutionStats,
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_ad_analytics': {
        const { accountId, dateRange, timeGranularity } = params || {};
        const startDate = dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const endDate = dateRange?.end || new Date().toISOString().split('T')[0];
        const granularity = timeGranularity || 'ALL';
        
        console.log(`[get_ad_analytics] Starting for account ${accountId}, date range: ${startDate} to ${endDate}, granularity: ${granularity}`);

        // Step 1: Call Ad Analytics API with q=statistics and pivot=CREATIVE
        console.log('[Step 1] Fetching analytics with pivot=CREATIVE...');
        
        // First need campaigns for the CREATIVE pivot
        const campaignsResponse = await fetch(
          `https://api.linkedin.com/v2/adCampaignsV2?q=search&search.account.values[0]=urn:li:sponsoredAccount:${accountId}&count=100`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );
        
        if (!campaignsResponse.ok) {
          const errorText = await campaignsResponse.text();
          console.error('[Error] Failed to fetch campaigns:', campaignsResponse.status, errorText);
          throw new Error(`Failed to fetch campaigns: ${campaignsResponse.status}`);
        }
        
        const campaignsData = await campaignsResponse.json();
        const campaignMap = new Map((campaignsData.elements || []).map((c: any) => [c.id.toString(), c.name]));
        const campaignIds = (campaignsData.elements || []).map((c: any) => c.id.toString());
        console.log(`[Step 1] Found ${campaignIds.length} campaigns`);

        if (campaignIds.length === 0) {
          console.log('[Warning] No campaigns found, returning empty result');
          return new Response(JSON.stringify({ elements: [] }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Build analytics URL with pagination support - must include accounts parameter
        const analyticsUrl = `https://api.linkedin.com/v2/adAnalyticsV2?q=analytics&` +
          `dateRange.start.day=${new Date(startDate).getDate()}&` +
          `dateRange.start.month=${new Date(startDate).getMonth() + 1}&` +
          `dateRange.start.year=${new Date(startDate).getFullYear()}&` +
          `dateRange.end.day=${new Date(endDate).getDate()}&` +
          `dateRange.end.month=${new Date(endDate).getMonth() + 1}&` +
          `dateRange.end.year=${new Date(endDate).getFullYear()}&` +
          `timeGranularity=${granularity === 'ALL' ? 'ALL' : granularity}&` +
          `pivot=CREATIVE&` +
          `accounts[0]=urn:li:sponsoredAccount:${accountId}&` +
          `fields=impressions,clicks,costInLocalCurrency,costInUsd,externalWebsiteConversions,oneClickLeads,pivotValue&` +
          `count=500&` +
          campaignIds.slice(0, 20).map((id: string, i: number) => `campaigns[${i}]=urn:li:sponsoredCampaign:${id}`).join('&');

        console.log(`[Step 1] Calling Ad Analytics API with ${Math.min(campaignIds.length, 20)} campaigns...`);
        const analyticsResponse = await fetch(analyticsUrl, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        
        if (!analyticsResponse.ok) {
          const errorText = await analyticsResponse.text();
          console.error('[Error] Failed to fetch analytics:', analyticsResponse.status, errorText);
          throw new Error(`Failed to fetch analytics: ${analyticsResponse.status}`);
        }
        
        const analyticsData = await analyticsResponse.json();
        console.log(`[Step 1] Received ${analyticsData.elements?.length || 0} analytics records`);

        // Aggregate analytics by creative URN
        const analyticsMap = new Map<string, { impressions: number; clicks: number; spent: number; spentUsd: number; leads: number }>();
        (analyticsData.elements || []).forEach((el: any) => {
          const creativeUrn = el.pivotValue || '';
          const creativeId = creativeUrn.split(':').pop() || '';
          if (!creativeId) return;
          
          const existing = analyticsMap.get(creativeId) || { impressions: 0, clicks: 0, spent: 0, spentUsd: 0, leads: 0 };
          analyticsMap.set(creativeId, {
            impressions: existing.impressions + (el.impressions || 0),
            clicks: existing.clicks + (el.clicks || 0),
            spent: existing.spent + parseFloat(el.costInLocalCurrency || '0'),
            spentUsd: existing.spentUsd + parseFloat(el.costInUsd || '0'),
            leads: existing.leads + (el.oneClickLeads || 0) + (el.externalWebsiteConversions || 0),
          });
        });
        console.log(`[Step 1] Aggregated analytics for ${analyticsMap.size} unique creatives`);

        // Step 2: Resolve creative URNs to names by calling Ad Creatives metadata endpoint
        console.log('[Step 2] Fetching creative metadata to resolve names...');
        const creativesResponse = await fetch(
          `https://api.linkedin.com/v2/adCreativesV2?q=search&search.account.values[0]=urn:li:sponsoredAccount:${accountId}&count=500`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );
        
        if (!creativesResponse.ok) {
          const errorText = await creativesResponse.text();
          console.error('[Error] Failed to fetch creatives:', creativesResponse.status, errorText);
          throw new Error(`Failed to fetch creatives: ${creativesResponse.status}`);
        }
        
        const creativesData = await creativesResponse.json();
        console.log(`[Step 2] Fetched ${creativesData.elements?.length || 0} creative metadata records`);

        // Collect share URNs that need resolution
        const shareUrnsToResolve: string[] = [];
        const creativeToShareMap = new Map<string, string>(); // creativeId -> shareUrn
        
        // First pass: identify share URNs that need fetching
        (creativesData.elements || []).forEach((c: any) => {
          const creativeId = c.id?.toString() || '';
          if (c.variables?.data) {
            const variablesData = c.variables.data;
            const dsContent = variablesData['com.linkedin.ads.DirectSponsoredContentCreativeVariables'];
            const sponsoredUpdate = variablesData['com.linkedin.ads.SponsoredUpdateCreativeVariables'];
            
            if (dsContent?.share) {
              shareUrnsToResolve.push(dsContent.share);
              creativeToShareMap.set(creativeId, dsContent.share);
            } else if (sponsoredUpdate?.activity) {
              shareUrnsToResolve.push(sponsoredUpdate.activity);
              creativeToShareMap.set(creativeId, sponsoredUpdate.activity);
            }
          }
        });
        
        console.log(`[Step 2b] Found ${shareUrnsToResolve.length} shares to resolve for post content`);
        
        // Batch fetch share/post content to get human-readable titles
        const shareContentMap = new Map<string, string>(); // shareUrn -> post text/title
        
        if (shareUrnsToResolve.length > 0) {
          const uniqueShareUrns = [...new Set(shareUrnsToResolve)];
          const batchSize = 10;
          
          for (let i = 0; i < uniqueShareUrns.length; i += batchSize) {
            const batch = uniqueShareUrns.slice(i, i + batchSize);
            
            const sharePromises = batch.map(async (shareUrn) => {
              try {
                // Try shares endpoint first
                const shareId = shareUrn.split(':').pop();
                const shareResponse = await fetch(
                  `https://api.linkedin.com/v2/shares/${shareUrn}`,
                  { headers: { 'Authorization': `Bearer ${accessToken}` } }
                );
                
                if (shareResponse.ok) {
                  const shareData = await shareResponse.json();
                  // Extract text from share content
                  let text = shareData.text?.text || '';
                  if (!text && shareData.content?.title) {
                    text = shareData.content.title;
                  }
                  if (!text && shareData.content?.description) {
                    text = shareData.content.description;
                  }
                  // Truncate to reasonable length for display
                  if (text && text.length > 60) {
                    text = text.substring(0, 57) + '...';
                  }
                  return { urn: shareUrn, text: text || null };
                }
                
                // Try ugcPosts endpoint as fallback (for ugcPost URNs)
                if (shareUrn.includes('ugcPost')) {
                  const ugcResponse = await fetch(
                    `https://api.linkedin.com/v2/ugcPosts/${shareUrn}`,
                    { headers: { 'Authorization': `Bearer ${accessToken}` } }
                  );
                  
                  if (ugcResponse.ok) {
                    const ugcData = await ugcResponse.json();
                    let text = ugcData.specificContent?.['com.linkedin.ugc.ShareContent']?.shareCommentary?.text || '';
                    if (!text) {
                      const media = ugcData.specificContent?.['com.linkedin.ugc.ShareContent']?.media?.[0];
                      text = media?.title?.text || media?.description?.text || '';
                    }
                    if (text && text.length > 60) {
                      text = text.substring(0, 57) + '...';
                    }
                    return { urn: shareUrn, text: text || null };
                  }
                }
                
                return { urn: shareUrn, text: null };
              } catch (e) {
                console.log(`[Warning] Share lookup error for ${shareUrn}:`, e);
                return { urn: shareUrn, text: null };
              }
            });
            
            const results = await Promise.all(sharePromises);
            results.forEach(result => {
              if (result.text) {
                shareContentMap.set(result.urn, result.text);
              }
            });
          }
          console.log(`[Step 2b] Resolved ${shareContentMap.size} share texts`);
        }

        // Build creative metadata map with resolved names
        const creativeMetadataMap = new Map<string, { name: string; campaignId: string; campaignName: string; status: string; type: string }>();
        (creativesData.elements || []).forEach((c: any) => {
          const creativeId = c.id?.toString() || '';
          const campaignUrn = c.campaign || '';
          const campaignId = campaignUrn.split(':').pop() || '';
          
          let creativeName = '';
          let creativeType = 'UNKNOWN';
          
          if (c.variables?.data) {
            const variablesData = c.variables.data;
            const dsContent = variablesData['com.linkedin.ads.DirectSponsoredContentCreativeVariables'];
            const sponsoredUpdate = variablesData['com.linkedin.ads.SponsoredUpdateCreativeVariables'];
            const textAd = variablesData['com.linkedin.ads.TextAdCreativeVariables'];
            const spotlightAd = variablesData['com.linkedin.ads.SpotlightCreativeVariables'];
            const followerAd = variablesData['com.linkedin.ads.FollowerCreativeVariables'];
            const jobsAd = variablesData['com.linkedin.ads.JobsCreativeVariables'];
            const videoAd = variablesData['com.linkedin.ads.VideoCreativeVariables'];
            const carouselAd = variablesData['com.linkedin.ads.CarouselCreativeVariables'];
            
            // Check for explicit name field first
            if (dsContent?.name) {
              creativeName = dsContent.name;
              creativeType = 'SPONSORED_CONTENT';
            } else if (dsContent?.share) {
              // Try to get share content text
              const shareText = shareContentMap.get(dsContent.share);
              if (shareText) {
                creativeName = shareText;
              } else {
                creativeName = `Sponsored Content #${dsContent.share.split(':').pop() || creativeId}`;
              }
              creativeType = 'SPONSORED_CONTENT';
            } else if (sponsoredUpdate?.activity) {
              // Try to get activity content text  
              const activityText = shareContentMap.get(sponsoredUpdate.activity);
              if (activityText) {
                creativeName = activityText;
              } else {
                creativeName = `Sponsored Update #${sponsoredUpdate.activity.split(':').pop() || creativeId}`;
              }
              creativeType = 'SPONSORED_UPDATE';
            } else if (textAd) {
              // Text ads have title and description
              creativeName = textAd.title || textAd.text || `Text Ad #${creativeId}`;
              creativeType = 'TEXT_AD';
            } else if (spotlightAd) {
              // Spotlight/Dynamic ads
              creativeName = spotlightAd.headline || spotlightAd.ctaLabel || `Spotlight Ad #${creativeId}`;
              creativeType = 'SPOTLIGHT_AD';
            } else if (followerAd) {
              creativeName = followerAd.headline || `Follower Ad #${creativeId}`;
              creativeType = 'FOLLOWER_AD';
            } else if (jobsAd) {
              creativeName = jobsAd.headline || `Jobs Ad #${creativeId}`;
              creativeType = 'JOBS_AD';
            } else if (videoAd) {
              creativeName = videoAd.name || videoAd.title || `Video Ad #${creativeId}`;
              creativeType = 'VIDEO_AD';
            } else if (carouselAd) {
              const cardCount = carouselAd.cards?.length || 0;
              creativeName = `Carousel Ad (${cardCount} cards) #${creativeId}`;
              creativeType = 'CAROUSEL_AD';
            }
          }
          
          // Fallback naming based on creative reference or type
          if (!creativeName) {
            if (c.reference) {
              const refType = c.reference.split(':')[2] || '';
              if (refType === 'share') {
                creativeName = `Share Ad #${c.reference.split(':').pop()}`;
              } else if (refType === 'ugcPost') {
                creativeName = `UGC Post Ad #${c.reference.split(':').pop()}`;
              } else {
                creativeName = `Ad #${creativeId}`;
              }
            } else {
              creativeName = `Ad #${creativeId}`;
            }
          }
          
          const resolvedCampaignName = campaignMap.get(campaignId);
          creativeMetadataMap.set(creativeId, {
            name: creativeName,
            campaignId,
            campaignName: typeof resolvedCampaignName === 'string' ? resolvedCampaignName : `Campaign ${campaignId}`,
            status: c.status || 'UNKNOWN',
            type: creativeType !== 'UNKNOWN' ? creativeType : (c.type || 'UNKNOWN'),
          });
        });
        console.log(`[Step 2] Built metadata map for ${creativeMetadataMap.size} creatives`);

        // Step 3: Merge analytics metrics with resolved ad names
        console.log('[Step 3] Merging analytics with creative metadata...');
        const reportElements: any[] = [];
        
        analyticsMap.forEach((metrics, creativeId) => {
          const metadata = creativeMetadataMap.get(creativeId) || {
            name: `Creative ${creativeId}`,
            campaignId: '',
            campaignName: 'Unknown Campaign',
            status: 'UNKNOWN',
            type: 'UNKNOWN',
          };
          
          // Calculate derived metrics
          const ctr = metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : 0;
          const cpc = metrics.clicks > 0 ? metrics.spent / metrics.clicks : 0;
          const cpm = metrics.impressions > 0 ? (metrics.spent / metrics.impressions) * 1000 : 0;
          
          reportElements.push({
            adId: creativeId,
            adName: metadata.name,
            campaignName: metadata.campaignName,
            status: metadata.status,
            type: metadata.type,
            impressions: metrics.impressions,
            clicks: metrics.clicks,
            costInLocalCurrency: metrics.spent.toFixed(2),
            costInUsd: metrics.spentUsd.toFixed(2),
            leads: metrics.leads,
            ctr: ctr.toFixed(2),
            cpc: cpc.toFixed(2),
            cpm: cpm.toFixed(2),
          });
        });

        // Also include creatives with metadata but no analytics (zero metrics)
        creativeMetadataMap.forEach((metadata, creativeId) => {
          if (!analyticsMap.has(creativeId)) {
            reportElements.push({
              adId: creativeId,
              adName: metadata.name,
              campaignName: metadata.campaignName,
              status: metadata.status,
              type: metadata.type,
              impressions: 0,
              clicks: 0,
              costInLocalCurrency: '0.00',
              costInUsd: '0.00',
              leads: 0,
              ctr: '0.00',
              cpc: '0.00',
              cpm: '0.00',
            });
          }
        });

        // Sort by spend descending
        reportElements.sort((a, b) => parseFloat(b.costInLocalCurrency) - parseFloat(a.costInLocalCurrency));
        
        console.log(`[Step 3] Final report contains ${reportElements.length} ads`);
        console.log(`[get_ad_analytics] Complete. Total ads: ${reportElements.length}`);
        
        return new Response(JSON.stringify({ 
          elements: reportElements,
          metadata: {
            accountId,
            dateRange: { start: startDate, end: endDate },
            timeGranularity: granularity,
            totalAds: reportElements.length,
            adsWithData: analyticsMap.size,
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'update_campaign_status': {
        const { campaignId, status } = params;
        const updateResponse = await fetch(
          `https://api.linkedin.com/v2/adCampaignsV2/${campaignId}`,
          {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'X-Restli-Method': 'partial_update',
            },
            body: JSON.stringify({ patch: { $set: { status } } }),
          }
        );
        
        console.log('Campaign status update:', updateResponse.ok ? 'success' : 'failed');
        return new Response(JSON.stringify({ success: updateResponse.ok }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_demographic_analytics': {
        const { accountId, dateRange, timeGranularity, pivot } = params || {};
        const startDate = dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const endDate = dateRange?.end || new Date().toISOString().split('T')[0];
        const granularity = timeGranularity || 'ALL';
        const selectedPivot = pivot || 'MEMBER_COMPANY';
        
        console.log(`[get_demographic_analytics] Starting for account ${accountId}, pivot: ${selectedPivot}, date range: ${startDate} to ${endDate}`);

        // Build analytics URL with specified pivot
        const analyticsUrl = `https://api.linkedin.com/v2/adAnalyticsV2?q=analytics&` +
          `dateRange.start.day=${new Date(startDate).getDate()}&` +
          `dateRange.start.month=${new Date(startDate).getMonth() + 1}&` +
          `dateRange.start.year=${new Date(startDate).getFullYear()}&` +
          `dateRange.end.day=${new Date(endDate).getDate()}&` +
          `dateRange.end.month=${new Date(endDate).getMonth() + 1}&` +
          `dateRange.end.year=${new Date(endDate).getFullYear()}&` +
          `timeGranularity=${granularity === 'ALL' ? 'ALL' : granularity}&` +
          `pivot=${selectedPivot}&` +
          `accounts[0]=urn:li:sponsoredAccount:${accountId}&` +
          `fields=impressions,clicks,costInLocalCurrency,costInUsd,externalWebsiteConversions,oneClickLeads,pivotValue&` +
          `count=500`;

        console.log(`[get_demographic_analytics] Fetching analytics with pivot=${selectedPivot}...`);
        const analyticsResponse = await fetch(analyticsUrl, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        
        if (!analyticsResponse.ok) {
          const errorText = await analyticsResponse.text();
          console.error('[Error] Failed to fetch demographic analytics:', analyticsResponse.status, errorText);
          
          if (analyticsResponse.status === 400) {
            return new Response(JSON.stringify({ 
              error: `${selectedPivot} pivot may not be available for this account or requires additional permissions`,
              details: errorText,
              elements: [] 
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          throw new Error(`Demographic Analytics API error: ${analyticsResponse.status}`);
        }
        
        const analyticsData = await analyticsResponse.json();
        console.log(`[get_demographic_analytics] Received ${analyticsData.elements?.length || 0} demographic records`);

        // Aggregate by pivot value
        const entityMap = new Map<string, { 
          entityUrn: string;
          impressions: number; 
          clicks: number; 
          spent: number; 
          spentUsd: number; 
          leads: number;
        }>();
        
        (analyticsData.elements || []).forEach((el: any) => {
          const entityUrn = el.pivotValue || '';
          if (!entityUrn) return;
          
          const existing = entityMap.get(entityUrn) || { 
            entityUrn,
            impressions: 0, 
            clicks: 0, 
            spent: 0, 
            spentUsd: 0, 
            leads: 0 
          };
          entityMap.set(entityUrn, {
            entityUrn,
            impressions: existing.impressions + (el.impressions || 0),
            clicks: existing.clicks + (el.clicks || 0),
            spent: existing.spent + parseFloat(el.costInLocalCurrency || '0'),
            spentUsd: existing.spentUsd + parseFloat(el.costInUsd || '0'),
            leads: existing.leads + (el.oneClickLeads || 0) + (el.externalWebsiteConversions || 0),
          });
        });

        console.log(`[get_demographic_analytics] Aggregated data for ${entityMap.size} unique entities`);

        // Resolve entity names based on pivot type
        const entityNames = new Map<string, string>();
        const entityUrns = Array.from(entityMap.keys());
        
        if (selectedPivot === 'MEMBER_COMPANY' && entityUrns.length > 0) {
          // Resolve company URNs to names via Organization API
          const companyIds = entityUrns
            .map(urn => urn.split(':').pop())
            .filter(id => id && !isNaN(Number(id)));
          
          if (companyIds.length > 0) {
            const batchSize = 50;
            for (let i = 0; i < companyIds.length; i += batchSize) {
              const batch = companyIds.slice(i, i + batchSize);
              const idsParam = batch.map((id, idx) => `ids[${idx}]=${id}`).join('&');
              
              try {
                const orgResponse = await fetch(
                  `https://api.linkedin.com/v2/organizationsLookup?${idsParam}&projection=(results*(id,localizedName))`,
                  { headers: { 'Authorization': `Bearer ${accessToken}` } }
                );
                
                if (orgResponse.ok) {
                  const orgData = await orgResponse.json();
                  const results = orgData.results || {};
                  Object.entries(results).forEach(([id, org]: [string, any]) => {
                    if (org?.localizedName) {
                      entityNames.set(`urn:li:organization:${id}`, org.localizedName);
                    }
                  });
                }
              } catch (e) {
                console.log('[Warning] Organization lookup failed:', e);
              }
            }
          }
        } else if (selectedPivot === 'MEMBER_JOB_TITLE') {
          // Resolve job title URNs using LinkedIn Titles API
          // Format: urn:li:title:X -> call /v2/titles/{X}?locale=en_US
          const titleIds: string[] = [];
          entityUrns.forEach(urn => {
            const match = urn.match(/^urn:li:title:(\d+)$/);
            if (match) {
              titleIds.push(match[1]);
            } else {
              // Plain text or unknown format - use as-is
              entityNames.set(urn, urn || 'Unknown Job Title');
            }
          });
          
          console.log(`[get_demographic_analytics] Resolving ${titleIds.length} job title URNs`);
          
          // Batch lookup titles (LinkedIn doesn't have a batch endpoint, so we parallelize)
          const batchSize = 20;
          for (let i = 0; i < titleIds.length; i += batchSize) {
            const batch = titleIds.slice(i, i + batchSize);
            
            const titlePromises = batch.map(async (titleId) => {
              try {
              const titleResponse = await fetch(
                  `https://api.linkedin.com/v2/titles/${titleId}?locale=en_US`,
                  { headers: { 'Authorization': `Bearer ${accessToken}` } }
                );
                
                if (titleResponse.ok) {
                  const titleData = await titleResponse.json();
                  // Extract localized name: name.localized.en_US
                  let localizedName: string | null = null;
                  if (titleData?.name?.localized?.en_US) {
                    localizedName = titleData.name.localized.en_US;
                  } else if (titleData?.name?.localized) {
                    // Try first available locale
                    const locales = Object.values(titleData.name.localized);
                    if (locales.length > 0 && typeof locales[0] === 'string') {
                      localizedName = locales[0];
                    }
                  }
                  return { 
                    urn: `urn:li:title:${titleId}`, 
                    name: localizedName || `Title ${titleId}` 
                  };
                } else {
                  console.log(`[Warning] Title lookup failed for ${titleId}: ${titleResponse.status}`);
                  return { urn: `urn:li:title:${titleId}`, name: `Title ${titleId}` };
                }
              } catch (e) {
                console.log(`[Warning] Title lookup error for ${titleId}:`, e);
                return { urn: `urn:li:title:${titleId}`, name: `Title ${titleId}` };
              }
            });
            
            const results = await Promise.all(titlePromises);
            results.forEach((result) => {
              entityNames.set(result.urn, result.name);
            });
          }
        } else {
          // For other pivots, extract human-readable name from URN or use as-is
          entityUrns.forEach(urn => {
            if (urn.includes(':')) {
              // URN format like "urn:li:function:1"
              entityNames.set(urn, formatPivotValue(urn, selectedPivot));
            } else {
              // Plain text value
              entityNames.set(urn, urn || 'Unknown');
            }
          });
        }

        console.log(`[get_demographic_analytics] Resolved ${entityNames.size} entity names`);

        // Build final report
        const reportElements: any[] = [];
        entityMap.forEach((metrics, entityUrn) => {
          const entityName = entityNames.get(entityUrn) || extractNameFromUrn(entityUrn);
          
          const ctr = metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : 0;
          const cpc = metrics.clicks > 0 ? metrics.spent / metrics.clicks : 0;
          const cpm = metrics.impressions > 0 ? (metrics.spent / metrics.impressions) * 1000 : 0;
          
          reportElements.push({
            entityUrn,
            entityName,
            impressions: metrics.impressions,
            clicks: metrics.clicks,
            costInLocalCurrency: metrics.spent.toFixed(2),
            costInUsd: metrics.spentUsd.toFixed(2),
            leads: metrics.leads,
            ctr: ctr.toFixed(2),
            cpc: cpc.toFixed(2),
            cpm: cpm.toFixed(2),
          });
        });

        reportElements.sort((a, b) => b.impressions - a.impressions);
        
        console.log(`[get_demographic_analytics] Complete. Total entities: ${reportElements.length}`);
        
        return new Response(JSON.stringify({ 
          elements: reportElements,
          metadata: {
            accountId,
            pivot: selectedPivot,
            dateRange: { start: startDate, end: endDate },
            timeGranularity: granularity,
            totalEntities: reportElements.length,
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_company_intelligence': {
        const { accountId, lookbackWindow, campaignId } = params || {};
        const lookback = lookbackWindow || 'LAST_30_DAYS';
        
        console.log(`[get_company_intelligence] Starting for account ${accountId}, lookback: ${lookback}`);

        // Build the filterCriteria parameter
        let filterCriteria = `(lookbackWindow:${lookback}`;
        if (campaignId) {
          filterCriteria += `,campaign:urn:li:sponsoredCampaign:${campaignId}`;
        }
        filterCriteria += ')';
        
        // Use REST API version with required headers
        const baseUrl = `https://api.linkedin.com/rest/accountIntelligence`;
        const queryParams = new URLSearchParams({
          q: 'account',
          account: `urn:li:sponsoredAccount:${accountId}`,
          start: '0',
          count: '500',
        });
        
        const url = `${baseUrl}?${queryParams.toString()}&filterCriteria=${encodeURIComponent(filterCriteria)}`;
        console.log(`[get_company_intelligence] Fetching from: ${url}`);
        
        const response = await fetch(url, {
          headers: { 
            'Authorization': `Bearer ${accessToken}`,
            'LinkedIn-Version': '202511',
            'X-Restli-Protocol-Version': '2.0.0',
          },
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Error] Company Intelligence API failed:', response.status, errorText);
          
          // Check for specific permission errors
          if (response.status === 403) {
            return new Response(JSON.stringify({ 
              error: 'Access denied - Company Intelligence API requires special provisioning',
              details: errorText,
              elements: [] 
            }), {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          throw new Error(`Company Intelligence API error: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        console.log(`[get_company_intelligence] Fetched ${data.elements?.length || 0} companies`);
        
        // Map and enhance the response data
        const companies = (data.elements || []).map((company: any) => ({
          companyName: company.companyName || 'Unknown Company',
          companyPageUrl: company.companyPageUrl || '',
          companyWebsite: company.companyWebsite || '',
          engagementLevel: company.engagementLevel || 'UNKNOWN',
          paidImpressions: company.paidImpressions || 0,
          paidClicks: company.paidClicks || 0,
          paidLeads: company.paidLeads || 0,
          paidEngagements: company.paidEngagements || 0,
          organicImpressions: company.organicImpressions || 0,
          organicEngagements: company.organicEngagements || 0,
          // Calculate CTR for paid
          paidCtr: company.paidImpressions > 0 
            ? ((company.paidClicks / company.paidImpressions) * 100).toFixed(2) 
            : '0.00',
        }));
        
        // Sort by paid impressions descending
        companies.sort((a: any, b: any) => b.paidImpressions - a.paidImpressions);
        
        console.log(`[get_company_intelligence] Complete. Returning ${companies.length} companies`);
        
        return new Response(JSON.stringify({ 
          elements: companies,
          paging: data.paging || {},
          metadata: {
            accountId,
            lookbackWindow: lookback,
            totalCompanies: companies.length,
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_company_demographic': {
        const { accountId, dateRange, timeGranularity } = params || {};
        const startDate = dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const endDate = dateRange?.end || new Date().toISOString().split('T')[0];
        const granularity = timeGranularity || 'ALL';
        
        console.log(`[get_company_demographic] Starting for account ${accountId}, date range: ${startDate} to ${endDate}`);

        // Step 1: Fetch demographic analytics with MEMBER_COMPANY pivot
        const analyticsUrl = `https://api.linkedin.com/v2/adAnalyticsV2?q=analytics&` +
          `dateRange.start.day=${new Date(startDate).getDate()}&` +
          `dateRange.start.month=${new Date(startDate).getMonth() + 1}&` +
          `dateRange.start.year=${new Date(startDate).getFullYear()}&` +
          `dateRange.end.day=${new Date(endDate).getDate()}&` +
          `dateRange.end.month=${new Date(endDate).getMonth() + 1}&` +
          `dateRange.end.year=${new Date(endDate).getFullYear()}&` +
          `timeGranularity=${granularity === 'ALL' ? 'ALL' : granularity}&` +
          `pivot=MEMBER_COMPANY&` +
          `accounts[0]=urn:li:sponsoredAccount:${accountId}&` +
          `fields=impressions,clicks,costInLocalCurrency,costInUsd,externalWebsiteConversions,oneClickLeads,pivotValue&` +
          `count=500`;

        console.log('[get_company_demographic] Step 1: Fetching company demographic analytics...');
        const analyticsResponse = await fetch(analyticsUrl, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        
        if (!analyticsResponse.ok) {
          const errorText = await analyticsResponse.text();
          console.error('[Error] Failed to fetch company demographic:', analyticsResponse.status, errorText);
          
          return new Response(JSON.stringify({ 
            error: 'MEMBER_COMPANY pivot may not be available for this account',
            details: errorText,
            elements: [] 
          }), {
            status: analyticsResponse.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        const analyticsData = await analyticsResponse.json();
        console.log(`[get_company_demographic] Received ${analyticsData.elements?.length || 0} company records`);

        // Aggregate by company URN
        const companyMap = new Map<string, { 
          entityUrn: string;
          impressions: number; 
          clicks: number; 
          spent: number; 
          spentUsd: number; 
          leads: number;
        }>();
        
        (analyticsData.elements || []).forEach((el: any) => {
          const entityUrn = el.pivotValue || '';
          if (!entityUrn) return;
          
          const existing = companyMap.get(entityUrn) || { 
            entityUrn,
            impressions: 0, 
            clicks: 0, 
            spent: 0, 
            spentUsd: 0, 
            leads: 0 
          };
          companyMap.set(entityUrn, {
            entityUrn,
            impressions: existing.impressions + (el.impressions || 0),
            clicks: existing.clicks + (el.clicks || 0),
            spent: existing.spent + parseFloat(el.costInLocalCurrency || '0'),
            spentUsd: existing.spentUsd + parseFloat(el.costInUsd || '0'),
            leads: existing.leads + (el.oneClickLeads || 0) + (el.externalWebsiteConversions || 0),
          });
        });

        console.log(`[get_company_demographic] Aggregated data for ${companyMap.size} unique companies`);

        // Step 2: Resolve company names via Organization Lookup
        const companyNames = new Map<string, string>();
        const companyWebsites = new Map<string, { website: string | null; linkedInUrl: string | null; status: string }>();
        const companyUrns = Array.from(companyMap.keys());
        
        // Extract organization IDs from URNs
        const orgIdToUrn = new Map<string, string>();
        companyUrns.forEach(urn => {
          const match = urn.match(/^urn:li:organization:(\d+)$/);
          if (match) {
            orgIdToUrn.set(match[1], urn);
          }
        });
        
        const orgIds = Array.from(orgIdToUrn.keys());
        console.log(`[get_company_demographic] Step 2: Resolving ${orgIds.length} organization IDs...`);

        // Batch fetch organization data
        if (orgIds.length > 0) {
          const batchSize = 50;
          for (let i = 0; i < orgIds.length; i += batchSize) {
            const batch = orgIds.slice(i, i + batchSize);
            const idsParam = batch.map((id, idx) => `ids[${idx}]=${id}`).join('&');
            
            try {
              const orgResponse = await fetch(
                `https://api.linkedin.com/v2/organizationsLookup?${idsParam}&projection=(results*(id,localizedName,localizedWebsite,vanityName))`,
                { headers: { 'Authorization': `Bearer ${accessToken}` } }
              );
              
              if (orgResponse.ok) {
                const orgData = await orgResponse.json();
                const results = orgData.results || {};
                
                Object.entries(results).forEach(([id, org]: [string, any]) => {
                  const urn = orgIdToUrn.get(id);
                  if (!urn) return;
                  
                  if (org?.localizedName) {
                    companyNames.set(urn, org.localizedName);
                  }
                  
                  // Extract website from organization data
                  const website = org?.localizedWebsite || null;
                  const vanityName = org?.vanityName || null;
                  const linkedInUrl = vanityName ? `https://www.linkedin.com/company/${vanityName}` : null;
                  
                  companyWebsites.set(urn, {
                    website,
                    linkedInUrl,
                    status: website ? 'resolved' : (vanityName ? 'fallback' : 'unresolved'),
                  });
                });
              } else {
                console.log(`[Warning] Organization lookup batch failed: ${orgResponse.status}`);
              }
            } catch (e) {
              console.log('[Warning] Organization lookup failed:', e);
            }
          }
        }
        
        console.log(`[get_company_demographic] Resolved ${companyNames.size} company names, ${companyWebsites.size} with website info`);

        // Step 3: For companies without website, try vanity name lookup
        const unresolvedUrns = companyUrns.filter(urn => {
          const info = companyWebsites.get(urn);
          return !info || info.status === 'unresolved';
        });
        
        if (unresolvedUrns.length > 0) {
          console.log(`[get_company_demographic] Step 3: Attempting vanity lookup for ${unresolvedUrns.length} unresolved companies...`);
          
          // For each unresolved company, try to guess vanity name and look it up
          const batchSize = 10;
          for (let i = 0; i < Math.min(unresolvedUrns.length, 50); i += batchSize) {
            const batch = unresolvedUrns.slice(i, i + batchSize);
            
            const vanityPromises = batch.map(async (urn) => {
              const companyName = companyNames.get(urn);
              if (!companyName) return { urn, result: null };
              
              // Create vanity name guess: lowercase, hyphenated, URL encoded
              const vanityGuess = companyName
                .toLowerCase()
                .replace(/[^\w\s-]/g, '')
                .replace(/\s+/g, '-')
                .slice(0, 50);
              
              try {
                const vanityResponse = await fetch(
                  `https://api.linkedin.com/rest/organizations?q=vanityName&vanityName=${encodeURIComponent(vanityGuess)}`,
                  { 
                    headers: { 
                      'Authorization': `Bearer ${accessToken}`,
                      'LinkedIn-Version': '202511',
                      'X-Restli-Protocol-Version': '2.0.0',
                    } 
                  }
                );
                
                if (vanityResponse.ok) {
                  const vanityData = await vanityResponse.json();
                  if (vanityData.elements && vanityData.elements.length > 0) {
                    const org = vanityData.elements[0];
                    return {
                      urn,
                      result: {
                        website: org.localizedWebsite || null,
                        linkedInUrl: org.vanityName ? `https://www.linkedin.com/company/${org.vanityName}` : null,
                        status: org.localizedWebsite ? 'resolved' : 'fallback',
                      }
                    };
                  }
                }
                return { urn, result: null };
              } catch (e) {
                console.log(`[Warning] Vanity lookup failed for ${companyName}:`, e);
                return { urn, result: null };
              }
            });
            
            const results = await Promise.all(vanityPromises);
            results.forEach(({ urn, result }) => {
              if (result) {
                companyWebsites.set(urn, result);
              }
            });
          }
        }

        // Build final report
        const reportElements: any[] = [];
        companyMap.forEach((metrics, entityUrn) => {
          const entityName = companyNames.get(entityUrn) || extractNameFromUrn(entityUrn);
          const websiteInfo = companyWebsites.get(entityUrn) || { website: null, linkedInUrl: null, status: 'unresolved' };
          
          const ctr = metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : 0;
          const cpc = metrics.clicks > 0 ? metrics.spent / metrics.clicks : 0;
          const cpm = metrics.impressions > 0 ? (metrics.spent / metrics.impressions) * 1000 : 0;
          
          reportElements.push({
            entityUrn,
            entityName,
            website: websiteInfo.website,
            linkedInUrl: websiteInfo.linkedInUrl,
            enrichmentStatus: websiteInfo.status,
            impressions: metrics.impressions,
            clicks: metrics.clicks,
            costInLocalCurrency: metrics.spent.toFixed(2),
            costInUsd: metrics.spentUsd.toFixed(2),
            leads: metrics.leads,
            ctr: ctr.toFixed(2),
            cpc: cpc.toFixed(2),
            cpm: cpm.toFixed(2),
          });
        });

        reportElements.sort((a, b) => b.impressions - a.impressions);
        
        const resolvedCount = reportElements.filter(r => r.enrichmentStatus === 'resolved').length;
        const unresolvedCount = reportElements.filter(r => r.enrichmentStatus === 'unresolved').length;
        
        console.log(`[get_company_demographic] Complete. Total: ${reportElements.length}, Resolved: ${resolvedCount}, Unresolved: ${unresolvedCount}`);
        
        return new Response(JSON.stringify({ 
          elements: reportElements,
          metadata: {
            accountId,
            dateRange: { start: startDate, end: endDate },
            timeGranularity: granularity,
            totalCompanies: reportElements.length,
            resolvedCount,
            unresolvedCount,
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_creative_names_report': {
        // Fetches creative names with performance metrics and status info
        const { accountId, dateRange, timeGranularity } = params || {};
        const startDate = dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const endDate = dateRange?.end || new Date().toISOString().split('T')[0];
        const granularity = timeGranularity || 'ALL';
        
        // Parse date strings directly to avoid timezone issues
        const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
        const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
        
        console.log(`[get_creative_names_report] Starting for account ${accountId}, date range: ${startDate} to ${endDate}, granularity: ${granularity}`);
        console.log(`[get_creative_names_report] Parsed dates: start=${startYear}-${startMonth}-${startDay}, end=${endYear}-${endMonth}-${endDay}`);
        
        // Step 1: Fetch campaigns to get campaign names
        console.log('[Step 1] Fetching campaigns...');
        const campaignsUrl = `https://api.linkedin.com/rest/adAccounts/${accountId}/adCampaigns?q=search&sortOrder=DESCENDING&count=100`;
        const campaignsResponse = await fetch(campaignsUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'LinkedIn-Version': '202511',
            'X-Restli-Protocol-Version': '2.0.0',
          },
        });
        
        const campaignNames = new Map<string, string>();
        if (campaignsResponse.ok) {
          const campaignsData = await campaignsResponse.json();
          const campaigns = campaignsData.elements || [];
          console.log(`[Step 1] Found ${campaigns.length} campaigns`);
          
          for (const campaign of campaigns) {
            const campaignId = campaign.id?.toString() || campaign.$URN?.split(':').pop();
            if (campaignId) {
              campaignNames.set(campaignId, campaign.name || `Campaign ${campaignId}`);
            }
          }
        } else {
          // Fallback to V2 API
          const v2Url = `https://api.linkedin.com/v2/adCampaignsV2?q=search&search.account.values[0]=urn:li:sponsoredAccount:${accountId}&count=100`;
          const v2Response = await fetch(v2Url, { headers: { 'Authorization': `Bearer ${accessToken}` } });
          if (v2Response.ok) {
            const v2Data = await v2Response.json();
            const campaigns = v2Data.elements || [];
            for (const campaign of campaigns) {
              const campaignId = campaign.id?.toString();
              if (campaignId) {
                campaignNames.set(campaignId, campaign.name || `Campaign ${campaignId}`);
              }
            }
          }
        }
        
        // Step 2: Fetch all creatives with metadata using V2 API
        console.log('[Step 2] Fetching creatives metadata...');
        const creativesUrl = `https://api.linkedin.com/v2/adCreativesV2?q=search&search.account.values[0]=urn:li:sponsoredAccount:${accountId}&count=500`;
        const creativesResponse = await fetch(creativesUrl, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        interface CreativeInfo {
          id: string;
          name: string;
          campaignId: string;
          campaignName: string;
          status: string;
          type: string;
        }
        
        const creativeInfoMap = new Map<string, CreativeInfo>();
        
        if (creativesResponse.ok) {
          const creativesData = await creativesResponse.json();
          const creatives = creativesData.elements || [];
          console.log(`[Step 2] Found ${creatives.length} creatives`);
          
          for (const creative of creatives) {
            const creativeId = creative.id?.toString() || '';
            if (!creativeId) continue;
            
            const campaignUrn = creative.campaign || '';
            const campaignId = campaignUrn.split(':').pop() || '';
            
            let creativeType = 'SPONSORED_CONTENT';
            if (creative.type) creativeType = creative.type;
            else if (creative.variables?.type) creativeType = creative.variables.type;
            
            creativeInfoMap.set(creativeId, {
              id: creativeId,
              name: '', // Will be resolved next
              campaignId,
              campaignName: campaignNames.get(campaignId) || `Campaign ${campaignId}`,
              status: creative.status || 'UNKNOWN',
              type: creativeType,
            });
          }
        }
        
        // Step 3: Fetch creative names via versioned API
        console.log('[Step 3] Fetching creative names via versioned API...');
        const creativeIds = [...creativeInfoMap.keys()];
        
        const batchSize = 10;
        for (let i = 0; i < Math.min(creativeIds.length, 200); i += batchSize) {
          const batch = creativeIds.slice(i, i + batchSize);
          
          await Promise.all(batch.map(async (creativeId) => {
            try {
              const creativeUrn = encodeURIComponent(`urn:li:sponsoredCreative:${creativeId}`);
              const creativeUrl = `https://api.linkedin.com/rest/adAccounts/${accountId}/creatives/${creativeUrn}`;
              const creativeResp = await fetch(creativeUrl, {
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'LinkedIn-Version': '202511',
                  'X-Restli-Protocol-Version': '2.0.0'
                }
              });
              
              if (creativeResp.ok) {
                const creativeDetail = await creativeResp.json();
                const existing = creativeInfoMap.get(creativeId);
                if (existing && creativeDetail.name) {
                  existing.name = creativeDetail.name;
                  creativeInfoMap.set(creativeId, existing);
                }
              }
            } catch (err) {
              console.log(`[Step 3] Error fetching creative ${creativeId}:`, err);
            }
          }));
        }
        
        const namesResolved = [...creativeInfoMap.values()].filter(c => c.name).length;
        console.log(`[Step 3] Resolved ${namesResolved} of ${creativeInfoMap.size} creative names`);
        
        // Step 4: Fetch analytics data for creatives (batch campaigns since API limits to 20 per request)
        console.log('[Step 4] Fetching creative analytics...');
        
        // Get campaign IDs to filter
        const campaignIds = [...new Set([...creativeInfoMap.values()].map(c => c.campaignId))].filter(Boolean);
        console.log(`[Step 4] Found ${campaignIds.length} unique campaigns to query`);
        
        // Aggregate analytics by creative
        const creativeMetrics = new Map<string, { impressions: number; clicks: number; spent: number; leads: number }>();
        
        // Batch campaigns in groups of 20 (API limit)
        const campaignBatchSize = 20;
        for (let i = 0; i < campaignIds.length; i += campaignBatchSize) {
          const campaignBatch = campaignIds.slice(i, i + campaignBatchSize);
          
          let analyticsUrl = `https://api.linkedin.com/v2/adAnalyticsV2?q=analytics&` +
            `dateRange.start.day=${startDay}&` +
            `dateRange.start.month=${startMonth}&` +
            `dateRange.start.year=${startYear}&` +
            `dateRange.end.day=${endDay}&` +
            `dateRange.end.month=${endMonth}&` +
            `dateRange.end.year=${endYear}&` +
            `timeGranularity=${granularity}&` +
            `pivot=CREATIVE&` +
            `fields=impressions,clicks,costInLocalCurrency,conversions,externalWebsiteConversions,oneClickLeads,dateRange,pivotValue`;
          
          // Add campaigns for this batch
          campaignBatch.forEach((id, idx) => {
            analyticsUrl += `&campaigns[${idx}]=urn:li:sponsoredCampaign:${id}`;
          });
          
          try {
            const analyticsResponse = await fetch(analyticsUrl, {
              headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            
            if (analyticsResponse.ok) {
              const analyticsData = await analyticsResponse.json();
              const elements = analyticsData.elements || [];
              console.log(`[Step 4] Batch ${Math.floor(i / campaignBatchSize) + 1}: Received ${elements.length} analytics records`);
              
              for (const element of elements) {
                const pivotValue = element.pivotValue;
                const creativeId = pivotValue?.split(':').pop() || '';
                
                if (!creativeId) continue;
                
                const existing = creativeMetrics.get(creativeId) || { impressions: 0, clicks: 0, spent: 0, leads: 0 };
                existing.impressions += element.impressions || 0;
                existing.clicks += element.clicks || 0;
                existing.spent += parseFloat(element.costInLocalCurrency || '0');
                existing.leads += (element.oneClickLeads || 0) + (element.externalWebsiteConversions || 0);
                creativeMetrics.set(creativeId, existing);
              }
            } else {
              console.log(`[Step 4] Batch ${Math.floor(i / campaignBatchSize) + 1} failed: ${analyticsResponse.status}`);
            }
          } catch (err) {
            console.log(`[Step 4] Batch ${Math.floor(i / campaignBatchSize) + 1} error:`, err);
          }
        }
        
        console.log(`[Step 4] Total: Aggregated metrics for ${creativeMetrics.size} creatives`);
        
        // Step 5: Build final report
        console.log('[Step 5] Building final report...');
        
        const reportElements: any[] = [];
        
        for (const [creativeId, info] of creativeInfoMap) {
          const metrics = creativeMetrics.get(creativeId) || { impressions: 0, clicks: 0, spent: 0, leads: 0 };
          
          const ctr = metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : 0;
          const cpc = metrics.clicks > 0 ? metrics.spent / metrics.clicks : 0;
          const cpm = metrics.impressions > 0 ? (metrics.spent / metrics.impressions) * 1000 : 0;
          const costPerLead = metrics.leads > 0 ? metrics.spent / metrics.leads : 0;
          
          reportElements.push({
            creativeId,
            creativeName: info.name || `Creative ${creativeId}`,
            campaignName: info.campaignName,
            status: info.status,
            type: info.type,
            impressions: metrics.impressions,
            clicks: metrics.clicks,
            spent: metrics.spent.toFixed(2),
            leads: metrics.leads,
            ctr: ctr.toFixed(2),
            cpc: cpc.toFixed(2),
            cpm: cpm.toFixed(2),
            costPerLead: costPerLead.toFixed(2),
          });
        }
        
        // Sort by impressions descending
        reportElements.sort((a, b) => b.impressions - a.impressions);
        
        console.log(`[get_creative_names_report] Complete. Total creatives: ${reportElements.length}`);
        
        return new Response(JSON.stringify({
          elements: reportElements,
          metadata: {
            accountId,
            dateRange: { start: startDate, end: endDate },
            timeGranularity: granularity,
            totalCreatives: reportElements.length,
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_account_structure': {
        // Fetches the complete account hierarchy: Campaign Groups -> Campaigns -> Creatives
        const { accountId } = params || {};
        
        console.log(`[get_account_structure] Starting for account ${accountId}`);
        
        // Step 1: Fetch all Campaign Groups using versioned API
        console.log('[Step 1] Fetching campaign groups...');
        const campaignGroupsUrl = `https://api.linkedin.com/rest/adAccounts/${accountId}/adCampaignGroups?q=search&sortOrder=DESCENDING`;
        const campaignGroupsResponse = await fetch(campaignGroupsUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'LinkedIn-Version': '202511',
            'X-Restli-Protocol-Version': '2.0.0',
          },
        });
        
        let campaignGroups: any[] = [];
        if (campaignGroupsResponse.ok) {
          const groupsData = await campaignGroupsResponse.json();
          campaignGroups = groupsData.elements || [];
          console.log(`[Step 1] Found ${campaignGroups.length} campaign groups`);
        } else {
          // Fallback to v2 API if versioned API fails
          console.log('[Step 1] Versioned API failed, trying v2 API...');
          const v2GroupsUrl = `https://api.linkedin.com/v2/adCampaignGroupsV2?q=search&search.account.values[0]=urn:li:sponsoredAccount:${accountId}`;
          const v2GroupsResponse = await fetch(v2GroupsUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          });
          if (v2GroupsResponse.ok) {
            const v2Data = await v2GroupsResponse.json();
            campaignGroups = v2Data.elements || [];
            console.log(`[Step 1] V2 API found ${campaignGroups.length} campaign groups`);
          }
        }

        // Step 2: Fetch all Campaigns using versioned API
        console.log('[Step 2] Fetching campaigns...');
        const campaignsUrl = `https://api.linkedin.com/rest/adAccounts/${accountId}/adCampaigns?q=search&sortOrder=DESCENDING&count=100`;
        const campaignsResponse = await fetch(campaignsUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'LinkedIn-Version': '202511',
            'X-Restli-Protocol-Version': '2.0.0',
          },
        });
        
        let campaigns: any[] = [];
        if (campaignsResponse.ok) {
          const campaignsData = await campaignsResponse.json();
          campaigns = campaignsData.elements || [];
          console.log(`[Step 2] Found ${campaigns.length} campaigns`);
        } else {
          // Fallback to v2 API
          console.log('[Step 2] Versioned API failed, trying v2 API...');
          const v2CampaignsUrl = `https://api.linkedin.com/v2/adCampaignsV2?q=search&search.account.values[0]=urn:li:sponsoredAccount:${accountId}&count=100`;
          const v2CampaignsResponse = await fetch(v2CampaignsUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          });
          if (v2CampaignsResponse.ok) {
            const v2Data = await v2CampaignsResponse.json();
            campaigns = v2Data.elements || [];
            console.log(`[Step 2] V2 API found ${campaigns.length} campaigns`);
          }
        }

        // Step 3: Fetch all Creatives using versioned REST API
        console.log('[Step 3] Fetching creatives using versioned API...');
        
        // First, get all creatives for this account using the versioned API
        const creativesListUrl = `https://api.linkedin.com/rest/adAccounts/${accountId}/creatives?q=search&sortOrder=DESCENDING&count=100`;
        const creativesListResponse = await fetch(creativesListUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'LinkedIn-Version': '202511',
            'X-Restli-Protocol-Version': '2.0.0',
          },
        });
        
        let creatives: any[] = [];
        if (creativesListResponse.ok) {
          const creativesData = await creativesListResponse.json();
          creatives = creativesData.elements || [];
          console.log(`[Step 3] Found ${creatives.length} creatives from list endpoint`);
        } else {
          console.log(`[Step 3] Failed to fetch creatives list: ${creativesListResponse.status}`);
        }
        
        // Step 3b: Fetch individual creative details to get the 'name' field
        console.log('[Step 3b] Fetching individual creative names...');
        
        const creativesWithNames: any[] = [];
        for (const creative of creatives) {
          const creativeId = creative.id || creative.$URN?.split(':').pop();
          const creativeUrn = `urn:li:sponsoredCreative:${creativeId}`;
          
          try {
            const encodedUrn = encodeURIComponent(creativeUrn);
            const creativeDetailUrl = `https://api.linkedin.com/rest/adAccounts/${accountId}/creatives/${encodedUrn}`;
            
            const creativeDetailResponse = await fetch(creativeDetailUrl, {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'LinkedIn-Version': '202511',
                'X-Restli-Protocol-Version': '2.0.0',
              },
            });
            
            if (creativeDetailResponse.ok) {
              const creativeDetail = await creativeDetailResponse.json();
              creativesWithNames.push({
                ...creative,
                name: creativeDetail.name || `Creative ${creativeId}`,
              });
              console.log(`[Step 3b] Creative ${creativeId} name: ${creativeDetail.name || 'not found'}`);
            } else {
              creativesWithNames.push({
                ...creative,
                name: `Creative ${creativeId}`,
              });
            }
          } catch (err) {
            console.log(`[Step 3b] Error fetching creative ${creativeId}:`, err);
            creativesWithNames.push({
              ...creative,
              name: `Creative ${creativeId}`,
            });
          }
        }
        
        console.log(`[Step 3] Found ${creativesWithNames.length} total creatives with names`);

        // Step 4: Build the hierarchy
        console.log('[Step 4] Building account structure hierarchy...');
        
        // Create creative lookup by campaign
        const creativesByCampaign: Record<string, any[]> = {};
        for (const creative of creativesWithNames) {
          // Extract campaign ID from the creative's campaign URN
          const campaignUrn = creative.campaign;
          const campaignId = campaignUrn?.split(':').pop();
          
          if (campaignId) {
            if (!creativesByCampaign[campaignId]) {
              creativesByCampaign[campaignId] = [];
            }
            
            creativesByCampaign[campaignId].push({
              id: (creative.id || creative.$URN?.split(':').pop())?.toString() || 'unknown',
              name: creative.name,
              status: creative.status || 'UNKNOWN',
            });
          }
        }

        // Create campaign lookup by campaign group
        const campaignsByGroup: Record<string, any[]> = {};
        const ungroupedCampaigns: any[] = [];
        
        for (const campaign of campaigns) {
          const campaignGroupUrn = campaign.campaignGroup;
          const campaignId = campaign.id?.toString() || campaign.$URN?.split(':').pop() || 'unknown';
          
          const campaignData = {
            id: campaignId,
            name: campaign.name || `Campaign ${campaignId}`,
            status: campaign.status || 'UNKNOWN',
            type: campaign.type || campaign.objectiveType || '-',
            creatives: creativesByCampaign[campaignId] || [],
          };
          
          if (campaignGroupUrn) {
            const groupId = campaignGroupUrn.split(':').pop();
            if (!campaignsByGroup[groupId]) {
              campaignsByGroup[groupId] = [];
            }
            campaignsByGroup[groupId].push(campaignData);
          } else {
            ungroupedCampaigns.push(campaignData);
          }
        }

        // Build final structure
        const structure: any[] = [];
        
        for (const group of campaignGroups) {
          const groupId = group.id?.toString() || group.$URN?.split(':').pop() || 'unknown';
          structure.push({
            id: groupId,
            name: group.name || `Campaign Group ${groupId}`,
            status: group.status || 'UNKNOWN',
            campaigns: campaignsByGroup[groupId] || [],
          });
        }
        
        // Add ungrouped campaigns as a pseudo-group if any exist
        if (ungroupedCampaigns.length > 0) {
          structure.push({
            id: 'ungrouped',
            name: '(Ungrouped Campaigns)',
            status: 'ACTIVE',
            campaigns: ungroupedCampaigns,
          });
        }

        const totalCampaigns = structure.reduce((sum, g) => sum + (g.campaigns?.length || 0), 0);
        const totalCreatives = structure.reduce((sum, g) => 
          sum + (g.campaigns?.reduce((cSum: number, c: any) => cSum + (c.creatives?.length || 0), 0) || 0), 0
        );
        
        console.log(`[get_account_structure] Complete. Groups: ${structure.length}, Campaigns: ${totalCampaigns}, Creatives: ${totalCreatives}`);

        return new Response(JSON.stringify({
          accountId,
          accountName: `Account ${accountId}`,
          campaignGroups: structure,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error: unknown) {
    console.error('LinkedIn API error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
