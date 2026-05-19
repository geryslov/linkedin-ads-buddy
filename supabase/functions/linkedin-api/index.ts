// GitHub Sync: 2026-02-01
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LINKEDIN_CLIENT_ID = Deno.env.get('LINKEDIN_CLIENT_ID');
const LINKEDIN_CLIENT_SECRET = Deno.env.get('LINKEDIN_CLIENT_SECRET');

// Initialize Supabase client for company cache operations
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

// Helper: Extract image URNs from creative content object (deep scan)
function extractImageUrns(content: any): string[] {
  const urns: string[] = [];
  if (!content || typeof content !== 'object') return urns;

  function scan(obj: any) {
    if (!obj || typeof obj !== 'object') {
      if (typeof obj === 'string' && obj.startsWith('urn:li:image:')) {
        urns.push(obj);
      }
      return;
    }
    if (Array.isArray(obj)) {
      for (const item of obj) scan(item);
      return;
    }
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (typeof val === 'string' && val.startsWith('urn:li:image:')) {
        urns.push(val);
      } else if (typeof val === 'object' && val !== null) {
        scan(val);
      }
    }
  }
  scan(content);
  return [...new Set(urns)];
}

// Helper: Batch resolve image URNs via LinkedIn /rest/images API
async function resolveImageUrnsBatch(imageUrns: string[], token: string): Promise<Map<string, string>> {
  const resolved = new Map<string, string>();
  if (imageUrns.length === 0) return resolved;

  // Chunk into batches of 20 to avoid URI length limits
  const chunkSize = 20;
  for (let i = 0; i < imageUrns.length; i += chunkSize) {
    const chunk = imageUrns.slice(i, i + chunkSize);
    const encodedIds = chunk.map(u => encodeURIComponent(u)).join(',');
    const url = `https://api.linkedin.com/rest/images?ids=List(${encodedIds})`;

    try {
      const resp = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'LinkedIn-Version': '202511',
          'X-Restli-Protocol-Version': '2.0.0',
        },
      });

      if (resp.ok) {
        const data = await resp.json();
        // Response structure: { results: { "urn:li:image:XXX": { downloadUrl, downloadUrlExpiresAt, ... }, ... } }
        const results = data.results || data.elements || {};
        if (typeof results === 'object' && !Array.isArray(results)) {
          for (const [urn, record] of Object.entries(results)) {
            const rec = record as any;
            if (rec?.downloadUrl) {
              resolved.set(urn, rec.downloadUrl);
            }
          }
        }
        // Also handle if it's an array format
        if (Array.isArray(results)) {
          for (const rec of results) {
            if (rec?.id && rec?.downloadUrl) resolved.set(rec.id, rec.downloadUrl);
          }
        }
      } else {
        const errText = await resp.text();
        console.error(`[resolveImageUrnsBatch] Failed: ${resp.status} ${errText.substring(0, 200)}`);
      }
    } catch (err) {
      console.error('[resolveImageUrnsBatch] Error:', err);
    }
  }

  console.log(`[resolveImageUrnsBatch] Resolved ${resolved.size} of ${imageUrns.length} image URNs`);
  return resolved;
}

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
  
  // Industry mappings - LinkedIn Industry Codes V2
  // Reference: https://learn.microsoft.com/en-us/linkedin/shared/references/reference-tables/industry-codes-v2
  const industryMap: Record<string, string> = {
    // Accommodation Services
    '2190': 'Accommodation Services',
    '34': 'Food and Beverage Services',
    '2217': 'Bars, Taverns, and Nightclubs',
    '2212': 'Caterers',
    '32': 'Restaurants',
    '31': 'Hospitality',
    // Administrative and Support Services
    '1912': 'Administrative and Support Services',
    '110': 'Events Services',
    '122': 'Facilities Services',
    '2435': 'Office Administration',
    '104': 'Staffing and Recruiting',
    '108': 'Translation and Localization',
    '2436': 'Security Guards and Patrol Services',
    '2437': 'Janitorial Services',
    '2438': 'Landscaping Services',
    // Construction
    '48': 'Construction',
    '49': 'Building Materials',
    '2383': 'Residential Building Construction',
    '2384': 'Nonresidential Building Construction',
    '51': 'Civil Engineering',
    '2386': 'Highway, Street, and Bridge Construction',
    '2387': 'Utility System Construction',
    '2388': 'Subdivision of Land',
    '2389': 'Building Equipment Contractors',
    '2390': 'Building Finishing Contractors',
    '2391': 'Specialty Trade Contractors',
    // Consumer Services
    '91': 'Consumer Services',
    '2439': 'Repair and Maintenance',
    '2440': 'Vehicle Repair and Maintenance',
    '2441': 'Electronic and Precision Equipment Maintenance',
    '2442': 'Commercial and Industrial Machinery Maintenance',
    '2443': 'Personal and Household Goods Repair and Maintenance',
    '2444': 'Personal Care Services',
    '2445': 'Laundry and Drycleaning Services',
    '2447': 'Pet Services',
    '136': 'Photography',
    // Education
    '67': 'Primary and Secondary Education',
    '68': 'Higher Education',
    '132': 'E-Learning Providers',
    '69': 'Education Administration Programs',
    '2201': 'Secretarial Schools',
    '2202': 'Technical and Vocational Training',
    '2203': 'Language Schools',
    '105': 'Professional Training and Coaching',
    // Entertainment Providers
    '28': 'Entertainment Providers',
    '35': 'Movies, Videos, and Sound',
    '2285': 'Movies and Sound Recording',
    '2286': 'Sheet Music Publishing',
    '115': 'Musicians',
    '2288': 'Sound Recording',
    '2289': 'Animation and Post-production',
    '127': 'Animation',
    '36': 'Media Production',
    '126': 'Broadcast Media Production and Distribution',
    '2293': 'Radio and Television Broadcasting',
    '2294': 'Cable and Satellite Programming',
    '29': 'Gambling Facilities and Casinos',
    '40': 'Recreational Facilities',
    '2297': 'Golf Courses and Country Clubs',
    '2298': 'Skiing Facilities',
    '2299': 'Amusement Parks and Arcades',
    '33': 'Spectator Sports',
    '39': 'Performing Arts',
    '2302': 'Performing Arts and Spectator Sports',
    '2303': 'Dance Companies',
    '2304': 'Circuses and Magic Shows',
    '109': 'Computer Games',
    '2306': 'Mobile Gaming Apps',
    // Farming, Ranching, Forestry
    '201': 'Farming, Ranching, Forestry',
    '63': 'Farming',
    '64': 'Ranching',
    '2309': 'Ranching and Fisheries',
    '66': 'Fisheries',
    '61': 'Forestry and Logging',
    '2312': 'Timber Tract Operations',
    '2313': 'Logging',
    '2314': 'Forest Fire Management',
    '2315': 'Reforestation Services',
    // Financial Services
    '43': 'Financial Services',
    '41': 'Banking',
    '2319': 'Credit Intermediation',
    '129': 'Capital Markets',
    '45': 'Investment Banking',
    '46': 'Investment Management',
    '2323': 'Securities and Commodity Exchanges',
    '2324': 'Funds and Trusts',
    '2325': 'Insurance and Employee Benefit Funds',
    '2326': 'Pension Funds',
    '2327': 'Trusts and Estates',
    '106': 'Venture Capital and Private Equity Principals',
    '42': 'Insurance',
    '2330': 'Insurance Carriers',
    '2331': 'Insurance Agencies and Brokerages',
    '2332': 'Claims Adjusting, Actuarial Services',
    '47': 'Accounting',
    '2334': 'Financial Auditing',
    '2335': 'Tax Preparation Services',
    // Government Administration
    '75': 'Government Administration',
    '76': 'Executive Offices',
    '72': 'Legislative Offices',
    '73': 'Judiciary',
    '148': 'Government Relations Services',
    '2341': 'Administration of Justice',
    '79': 'Public Policy Offices',
    '74': 'International Affairs',
    '78': 'Public Safety',
    '2345': 'Fire Protection',
    '77': 'Law Enforcement',
    '2347': 'Correctional Institutions',
    '2348': 'Space Research and Technology',
    '71': 'Armed Forces',
    // Holding Companies
    '2350': 'Holding Companies',
    // Hospitals and Health Care
    '14': 'Hospitals and Health Care',
    '2352': 'Hospitals',
    '2353': 'Outpatient Care Centers',
    '2354': 'Mental Health Care',
    '139': 'Mental Health Care',
    '2356': 'Physical, Occupational and Speech Therapists',
    '2357': 'Chiropractors',
    '2358': 'Optometrists',
    '2359': 'Physicians',
    '2360': 'Dentists',
    '125': 'Alternative Medicine',
    '2362': 'Home Health Care Services',
    '2363': 'Ambulance Services',
    '2364': 'Medical and Diagnostic Laboratories',
    '13': 'Medical Practices',
    '16': 'Veterinary Services',
    // Human Resources Services
    '137': 'Human Resources Services',
    // Individual and Family Services
    '88': 'Individual and Family Services',
    '2369': 'Child Day Care Services',
    '2370': 'Community Services',
    '2371': 'Social Services',
    '2372': 'Food and Housing, and Emergency and Relief Services',
    '2373': 'Vocational Rehabilitation Services',
    // Information Services
    '84': 'Information Services',
    '2377': 'Data Infrastructure and Analytics',
    '2378': 'Custom Computer Programming Services',
    '2379': 'Computer Systems Design Services',
    '2380': 'IT System Installation and Disposal',
    '2381': 'Satellite Telecommunications',
    // IT Services and IT Consulting
    '96': 'IT Services and IT Consulting',
    // Law Practice
    '9': 'Law Practice',
    '10': 'Legal Services',
    '120': 'Alternative Dispute Resolution',
    // Leasing Non-residential Real Estate
    '2393': 'Leasing Non-residential Real Estate',
    // Manufacturing
    '112': 'Appliances, Electrical, and Electronics Manufacturing',
    '2396': 'Household Appliance Manufacturing',
    '2397': 'Audio and Video Equipment Manufacturing',
    '24': 'Consumer Electronics',
    '2399': 'Computers and Peripherals Manufacturing',
    '2400': 'Communications Equipment Manufacturing',
    '2401': 'Semiconductor Manufacturing',
    '7': 'Semiconductors',
    '2403': 'Electronic Components Manufacturing',
    '2404': 'Measuring and Control Instrument Manufacturing',
    '2405': 'Magnetic and Optical Media Manufacturing',
    '53': 'Motor Vehicle Manufacturing',
    '2407': 'Automobile Manufacturing',
    '2408': 'Motor Vehicle Parts Manufacturing',
    '2409': 'Aerospace Product and Parts Manufacturing',
    '52': 'Aviation and Aerospace Component Manufacturing',
    '58': 'Shipbuilding',
    '2412': 'Boatbuilding',
    '62': 'Railroad Equipment Manufacturing',
    '2414': 'Defense and Space Manufacturing',
    '1': 'Defense and Space Manufacturing',
    '54': 'Chemical Manufacturing',
    '2417': 'Chemical Raw Materials Manufacturing',
    '2418': 'Synthetic Fiber and Filament Manufacturing',
    '2419': 'Agricultural Chemical Manufacturing',
    '2420': 'Paint, Coating, and Adhesive Manufacturing',
    '2421': 'Soap and Cleaning Product Manufacturing',
    '18': 'Personal Care Product Manufacturing',
    '23': 'Food and Beverage Manufacturing',
    '2424': 'Animal Feed Manufacturing',
    '2425': 'Sugar and Confectionery Product Manufacturing',
    '2426': 'Fruit and Vegetable Preserves Manufacturing',
    '65': 'Dairy Product Manufacturing',
    '2428': 'Meat Products Manufacturing',
    '2429': 'Seafood Product Manufacturing',
    '2430': 'Baked Goods Manufacturing',
    '2431': 'Beverage Manufacturing',
    '2432': 'Wineries',
    '2433': 'Breweries',
    '2434': 'Distilleries',
    '21': 'Tobacco Manufacturing',
    '60': 'Textile Manufacturing',
    '19': 'Apparel Manufacturing',
    '2449': 'Leather Product Manufacturing',
    '143': 'Retail Luxury Goods and Jewelry',
    '26': 'Furniture and Home Furnishings Manufacturing',
    '2452': 'Household and Institutional Furniture Manufacturing',
    '2453': 'Office Furniture and Fixtures Manufacturing',
    '2454': 'Mattress and Blinds Manufacturing',
    '145': 'Glass, Ceramics and Concrete Manufacturing',
    '2456': 'Glass Product Manufacturing',
    '2457': 'Clay and Refractory Products Manufacturing',
    '2458': 'Lime and Gypsum Products Manufacturing',
    '2459': 'Abrasives and Nonmetallic Minerals Manufacturing',
    '56': 'Mining',
    '2461': 'Metal Ore Mining',
    '2462': 'Coal Mining',
    '57': 'Oil and Gas',
    '2464': 'Oil Extraction',
    '2465': 'Natural Gas Extraction',
    '2466': 'Nonmetallic Mineral Mining',
    '2467': 'Paper and Forest Products',
    '2468': 'Sawmills',
    '2469': 'Veneer, Plywood, and Engineered Wood Product Manufacturing',
    '2470': 'Prefabricated Wood Building Manufacturing',
    '2471': 'Wood Container and Pallet Manufacturing',
    '2472': 'Pulp and Paper Mills',
    '2473': 'Converted Paper Product Manufacturing',
    '146': 'Packaging and Containers Manufacturing',
    '117': 'Plastics Manufacturing',
    '2476': 'Plastics and Rubber Product Manufacturing',
    '2477': 'Rubber Products Manufacturing',
    '83': 'Printing Services',
    '2479': 'Metal Treatments',
    '2480': 'Primary Metal Manufacturing',
    '2481': 'Iron and Steel Mills and Ferroalloy Manufacturing',
    '2482': 'Alumina and Aluminum Production and Processing',
    '2483': 'Nonferrous Metal Production and Processing',
    '2484': 'Foundries',
    '2485': 'Fabricated Metal Products',
    '2486': 'Cutlery and Handtool Manufacturing',
    '2487': 'Architectural and Structural Metal Manufacturing',
    '2488': 'Boilers, Tanks, and Shipping Container Manufacturing',
    '2489': 'Hardware Manufacturing',
    '2490': 'Machine Shops, Turned Product, and Screw, Nut, and Bolt Manufacturing',
    '2491': 'Coating, Engraving, Heat Treating, and Allied Activities',
    '55': 'Industrial Machinery Manufacturing',
    '2493': 'Agriculture, Construction, Mining Machinery Manufacturing',
    '147': 'Automation Machinery Manufacturing',
    '2495': 'Commercial and Service Industry Machinery Manufacturing',
    '2496': 'HVAC and Refrigeration Equipment Manufacturing',
    '2497': 'Metalworking Machinery Manufacturing',
    '2498': 'Engines and Power Transmission Equipment Manufacturing',
    '20': 'Sporting Goods Manufacturing',
    '2500': 'Toy and Sporting Goods Manufacturing',
    '17': 'Medical Equipment Manufacturing',
    '15': 'Pharmaceutical Manufacturing',
    '12': 'Biotechnology Research',
    // Media and Telecommunications
    '2505': 'Media and Telecommunications',
    '6': 'Internet News',
    '82': 'Book and Periodical Publishing',
    '2508': 'Book Publishing',
    '81': 'Newspaper Publishing',
    '2510': 'Periodical Publishing',
    '8': 'Telecommunications',
    '2512': 'Telecommunications Carriers',
    '119': 'Wireless Services',
    '5': 'Cable and Satellite Television',
    '2515': 'Internet Publishing',
    '113': 'Online Audio and Video Media',
    '2517': 'Blogs',
    '2518': 'Social Networking Platforms',
    // Non-profit Organizations
    '100': 'Non-profit Organizations',
    '90': 'Civic and Social Organizations',
    '89': 'Religious Institutions',
    '107': 'Political Organizations',
    '131': 'Philanthropic Fundraising Services',
    '101': 'Fundraising',
    '2525': 'Grantmaking Foundations',
    // Personal Care and Household Products
    '25': 'Consumer Goods',
    // Professional Services
    '11': 'Business Consulting and Services',
    '80': 'Advertising Services',
    '2530': 'Advertising and Public Relations',
    '98': 'Public Relations and Communications Services',
    '97': 'Market Research',
    '2533': 'Marketing Services',
    '50': 'Architecture and Planning',
    '2535': 'Architects',
    '2536': 'Landscape Architects',
    '2537': 'Interior Design',
    '140': 'Graphic Design',
    '99': 'Design Services',
    '135': 'Engineering Services',
    '2541': 'Surveying and Mapping Services',
    '2542': 'Testing Laboratories',
    '2543': 'Environmental Quality Programs',
    '86': 'Environmental Services',
    '144': 'Renewable Energy Semiconductor Manufacturing',
    '70': 'Research Services',
    '114': 'Nanotechnology Research',
    '130': 'Think Tanks',
    '103': 'Writing and Editing',
    // Real Estate
    '44': 'Real Estate',
    '128': 'Commercial Real Estate',
    '2553': 'Real Estate Agents and Brokers',
    '2554': 'Residential Real Estate',
    // Retail
    '27': 'Retail',
    '2556': 'Retail Groceries',
    '22': 'Supermarkets',
    '2558': 'Retail Health and Personal Care Products',
    '2559': 'Retail Gasoline',
    '2560': 'Retail Apparel and Fashion',
    '2562': 'Retail Furniture and Home Furnishings',
    '2563': 'Retail Electronics',
    '2565': 'Retail Building Materials and Garden Equipment',
    '2567': 'Retail Motor Vehicles',
    '2568': 'Retail Office Supplies and Gifts',
    '2569': 'Retail Musical Instruments',
    '2570': 'Retail Books and Printed News',
    '2571': 'Retail Florists',
    '2572': 'Retail Office Equipment',
    '2573': 'Retail Pet Products',
    '2574': 'Retail Art Dealers',
    '38': 'Artists and Writers',
    '2576': 'Retail Recyclable Materials and Used Merchandise',
    '133': 'Wholesale',
    '138': 'Wholesale Office Equipment',
    '134': 'Wholesale Import and Export',
    // Technology, Information and Media
    '3': 'Computer Hardware Manufacturing',
    '4': 'Software Development',
    '2582': 'Software Publishers',
    '118': 'Computer and Network Security',
    '116': 'Supply Chain and Logistics',
    // Transportation, Logistics, Supply Chain
    '92': 'Transportation, Logistics, Supply Chain and Storage',
    '94': 'Airlines and Aviation',
    '2587': 'Air, Water, and Waste Program Management',
    '95': 'Maritime Transportation',
    '2589': 'Sea and Inland Shipping',
    '87': 'Freight and Package Transportation',
    '2591': 'Ground Passenger Transportation',
    '2592': 'Urban Transit Services',
    '2593': 'Interurban and Rural Bus Services',
    '2594': 'Taxi and Limousine Services',
    '2595': 'School and Employee Bus Services',
    '2596': 'Shuttles and Special Needs Transportation Services',
    '2597': 'Sightseeing Transportation',
    '2598': 'Pipeline Transportation',
    '2599': 'Truck Transportation',
    '93': 'Warehousing and Storage',
    '2601': 'Postal Services',
    '2602': 'Couriers and Express Delivery Services',
    // Travel Arrangements
    '30': 'Travel Arrangements',
    '2604': 'Travel Agencies',
    '2605': 'Tour Operators',
    // Utilities
    '59': 'Utilities',
    '2607': 'Electric Power Transmission, Control, and Distribution',
    '2608': 'Electric Power Generation',
    '2609': 'Hydroelectric Power Generation',
    '2610': 'Fossil Fuel Electric Power Generation',
    '2611': 'Nuclear Electric Power Generation',
    '2612': 'Solar Electric Power Generation',
    '2613': 'Wind Electric Power Generation',
    '2614': 'Geothermal Electric Power Generation',
    '2615': 'Biomass Electric Power Generation',
    '2616': 'Natural Gas Distribution',
    '2617': 'Water, Waste, Steam, and Air Conditioning Services',
    '2618': 'Water Supply and Irrigation Systems',
    '2619': 'Steam and Air-Conditioning Supply',
    '2620': 'Waste Collection',
    '2621': 'Waste Treatment and Disposal',
    // Wellness and Fitness Services
    '124': 'Wellness and Fitness Services',
    '2623': 'Gyms, Fitness, and Sports Centers',
    '2624': 'Wellness and Spa Services',
    // Museums, Historical Sites, and Zoos
    '37': 'Museums, Historical Sites, and Zoos',
    '2626': 'Museums',
    '2627': 'Historical Sites',
    '2628': 'Zoos and Botanical Gardens',
    // Libraries
    '85': 'Libraries',
    // Other legacy mappings for backwards compatibility
    '2': 'Think Tanks',
    '102': 'Program Development',
    '111': 'Artists and Writers',
    '121': 'Security and Investigations',
    '123': 'Outsourcing and Offshoring Consulting',
    '142': 'Wine and Spirits',
    '141': 'International Trade and Development',
  };
  
  const companySizeMap: Record<string, string> = {
    'SIZE_1': '1',
    'SIZE_2_TO_10': '2-10',
    'SIZE_11_TO_50': '11-50',
    'SIZE_51_TO_200': '51-200',
    'SIZE_201_TO_500': '201-500',
    'SIZE_501_TO_1000': '501-1,000',
    'SIZE_1001_TO_5000': '1,001-5,000',
    'SIZE_5001_TO_10000': '5,001-10,000',
    'SIZE_10001_OR_MORE': '10,001+',
  };

  switch (pivot) {
    case 'MEMBER_JOB_FUNCTION':
      return jobFunctionMap[value] || `Job Function ${value}`;
    case 'MEMBER_SENIORITY':
      return seniorityMap[value] || `Seniority ${value}`;
    case 'MEMBER_INDUSTRY':
      return industryMap[value] || `Industry ${value}`;
    case 'MEMBER_COMPANY_SIZE':
      return companySizeMap[value] || value.replace(/^SIZE_/i, '').replace(/_/g, ' ') || 'Unknown';
    case 'MEMBER_COUNTRY':
      return value.toUpperCase();
    case 'MEMBER_JOB_TITLE':
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

// Normalize company URN to extract the numeric ID
// Supports: urn:li:organization:123, urn:li:company:123, urn:li:memberCompany:123
function normalizeCompanyUrn(urn: string): { id: string | null; originalUrn: string } {
  if (!urn) return { id: null, originalUrn: urn };
  
  const match = urn.match(/^urn:li:(organization|company|memberCompany):(\d+)$/);
  if (match) {
    return { id: match[2], originalUrn: urn };
  }
  
  // Fallback: try to extract any numeric ID at the end
  const numericMatch = urn.match(/:(\d+)$/);
  if (numericMatch) {
    return { id: numericMatch[1], originalUrn: urn };
  }
  
  return { id: null, originalUrn: urn };
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
        const scope = 'r_liteprofile r_ads r_ads_reporting rw_ads w_member_social r_marketing_leadgen_automation';
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
        const accountsMap = new Map<string, any>();
        const userRoles = new Map<string, { role: string; accessSource: string }>();
        
        // Step 1: Try REST adAccountUsers?q=authenticatedUser (includes Business Manager accounts)
        try {
          const usersResponse = await fetch(
            'https://api.linkedin.com/rest/adAccountUsers?q=authenticatedUser',
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'LinkedIn-Version': '202511',
                'X-Restli-Protocol-Version': '2.0.0',
              },
            }
          );
          
          if (usersResponse.ok) {
            const usersData = await usersResponse.json();
            const userElements = usersData?.elements || [];
            console.log(`[get_ad_accounts] adAccountUsers returned ${userElements.length} account-user mappings`);
            
            // Store user role info for each account
            for (const el of userElements) {
              const accountUrn = el.account || '';
              const accountId = accountUrn.split(':').pop();
              if (accountId) {
                userRoles.set(accountId, { role: el.role || 'UNKNOWN', accessSource: 'authenticatedUser' });
              }
            }
          } else {
            console.log(`[get_ad_accounts] adAccountUsers failed: ${usersResponse.status}`);
          }
        } catch (err) {
          console.error('[get_ad_accounts] Error fetching adAccountUsers:', err);
        }
        
        // Step 2: Fetch all accounts via search (main discovery method)
        try {
          const searchResponse = await fetch(
            'https://api.linkedin.com/v2/adAccountsV2?q=search&search.status.values[0]=ACTIVE',
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
          );
          
          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            const searchElements = searchData?.elements || [];
            console.log(`[get_ad_accounts] adAccountsV2 search returned ${searchElements.length} accounts`);
            
            for (const acc of searchElements) {
              if (acc.id) {
                const accId = String(acc.id);
                const roleInfo = userRoles.get(accId);
                acc.userRole = roleInfo?.role || 'DIRECT_ACCESS';
                acc.accessSource = roleInfo?.accessSource || 'search';
                accountsMap.set(accId, acc);
              }
            }
          }
        } catch (err) {
          console.error('[get_ad_accounts] Error fetching via search:', err);
        }
        
        // Step 3: For any accounts in userRoles but not in search, try to fetch individually
        const missingAccountIds = [...userRoles.keys()].filter(id => !accountsMap.has(id));
        if (missingAccountIds.length > 0) {
          console.log(`[get_ad_accounts] Fetching ${missingAccountIds.length} accounts not in search results...`);
          
          for (const accId of missingAccountIds) {
            try {
              const accResponse = await fetch(
                `https://api.linkedin.com/v2/adAccountsV2/${accId}`,
                { headers: { 'Authorization': `Bearer ${accessToken}` } }
              );
              
              if (accResponse.ok) {
                const acc = await accResponse.json();
                if (acc && acc.status === 'ACTIVE') {
                  const roleInfo = userRoles.get(accId);
                  acc.userRole = roleInfo?.role || 'UNKNOWN';
                  acc.accessSource = 'authenticatedUser';
                  accountsMap.set(accId, acc);
                  console.log(`[get_ad_accounts] Added Business Manager account: ${acc.name || accId}`);
                }
              }
            } catch (err) {
              // Silently continue if individual fetch fails
            }
          }
        }
        
        // Roles that allow write operations (create/update campaigns, targeting, etc.)
        const writeCapableRoles = ['ACCOUNT_MANAGER', 'CAMPAIGN_MANAGER', 'CREATIVE_MANAGER'];
        
        // Combine and filter for ACTIVE status, add canWrite, accountUrn, and type
        const allAccounts = Array.from(accountsMap.values())
          .filter((acc: any) => acc.status === 'ACTIVE')
          .map((acc: any) => ({
            id: String(acc.id),
            accountUrn: `urn:li:sponsoredAccount:${acc.id}`,
            name: acc.name || `Account ${acc.id}`,
            currency: acc.currency || 'USD',
            status: acc.status,
            type: acc.type || 'UNKNOWN', // BUSINESS, ENTERPRISE, etc.
            userRole: acc.userRole || 'UNKNOWN',
            accessSource: acc.accessSource || 'unknown',
            canWrite: writeCapableRoles.includes(acc.userRole || ''),
          }));
        
        console.log(`[get_ad_accounts] Total unique accounts: ${allAccounts.length}`);
        console.log(`[get_ad_accounts] Accounts with write access: ${allAccounts.filter(a => a.canWrite).length}`);
        
        return new Response(JSON.stringify({ elements: allAccounts }), {
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

        // Parse dates by splitting string to avoid timezone issues
        const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
        const [endYear, endMonth, endDay] = endDate.split('-').map(Number);

        let url = `https://api.linkedin.com/v2/adAnalyticsV2?q=analytics&` +
          `dateRange.start.day=${startDay}&` +
          `dateRange.start.month=${startMonth}&` +
          `dateRange.start.year=${startYear}&` +
          `dateRange.end.day=${endDay}&` +
          `dateRange.end.month=${endMonth}&` +
          `dateRange.end.year=${endYear}&` +
          `timeGranularity=DAILY&` +
          `accounts[0]=urn:li:sponsoredAccount:${accountId}&` +
          `fields=impressions,clicks,costInLocalCurrency,externalWebsiteConversions,oneClickLeads`;
        
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

        // Parse dates by splitting string to avoid timezone issues
        const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
        const [endYear, endMonth, endDay] = endDate.split('-').map(Number);

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
          `dateRange.start.day=${startDay}&` +
          `dateRange.start.month=${startMonth}&` +
          `dateRange.start.year=${startYear}&` +
          `dateRange.end.day=${endDay}&` +
          `dateRange.end.month=${endMonth}&` +
          `dateRange.end.year=${endYear}&` +
          `timeGranularity=${granularity}&` +
          `pivot=CREATIVE&` +
          `fields=impressions,clicks,costInLocalCurrency,externalWebsiteConversions,oneClickLeads,dateRange,pivotValue`;

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
        async function fetchCreativesVersioned(accountId: string, token: string): Promise<Map<string, { name: string; campaignId: string; status: string; type: string; reference: string; imageUrl: string }>> {
          // Track image URNs found in creative content for batch resolution
          const creativeImageUrns = new Map<string, string[]>(); // creativeId -> URNs
          const creativeData = new Map<string, { name: string; campaignId: string; status: string; type: string; reference: string; imageUrl: string }>();
          
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
                imageUrl: '', // Will be resolved below
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
                    const existing = creativeData.get(creativeId);
                    if (existing) {
                      if (creativeDetail.name) {
                        existing.name = creativeDetail.name;
                        namesResolved++;
                      }
                      // Extract reference URN for image resolution via share/UGC content
                      const ref = creativeDetail.content?.reference;
                      if (ref) existing.reference = ref;
                      // Extract image URL from creative content
                      // Try multiple paths where LinkedIn stores image data
                      let imageUrl = '';
                      const content = creativeDetail.content;
                      if (content) {
                        // Standard single image
                        imageUrl = content.media?.downloadUrl || '';
                        // Try landingPage thumbnail
                        if (!imageUrl && content.landingPage?.landingPageMedia?.thumbnail) {
                          imageUrl = content.landingPage.landingPageMedia.thumbnail;
                        }
                        // Try spotlight format
                        if (!imageUrl && content.spotlight?.logo?.downloadUrl) {
                          imageUrl = content.spotlight.logo.downloadUrl;
                        }
                        // Try follow company format
                        if (!imageUrl && content.followCompany?.logo?.downloadUrl) {
                          imageUrl = content.followCompany.logo.downloadUrl;
                        }
                      }
                      // If no direct URL found, extract image URNs for batch resolution
                      if (!imageUrl && content) {
                        const urns = extractImageUrns(content);
                        if (urns.length > 0) {
                          creativeImageUrns.set(creativeId, urns);
                        }
                      }
                      // Log first creative's structure for debugging
                      if (namesResolved === 0) {
                        console.log(`[Creative Detail] Sample content keys: ${content ? JSON.stringify(Object.keys(content)) : 'null'}`);
                        console.log(`[Creative Detail] Extracted imageUrl: ${imageUrl || 'none'}`);
                        const urns = extractImageUrns(content);
                        console.log(`[Creative Detail] Image URNs found: ${urns.length > 0 ? urns.join(', ') : 'none'}`);
                      }
                      existing.imageUrl = imageUrl;
                      creativeData.set(creativeId, existing);
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
            
            // Batch resolve image URNs for creatives without direct URLs
            if (creativeImageUrns.size > 0) {
              const allUrns = new Set<string>();
              for (const urns of creativeImageUrns.values()) {
                for (const u of urns) allUrns.add(u);
              }
              console.log(`[Creative Metadata] Resolving ${allUrns.size} unique image URNs via /rest/images...`);
              const resolvedUrls = await resolveImageUrnsBatch([...allUrns], token);
              
              // Apply resolved URLs to creatives
              let resolvedCount = 0;
              for (const [cid, urns] of creativeImageUrns) {
                const existing = creativeData.get(cid);
                if (existing && !existing.imageUrl) {
                  for (const urn of urns) {
                    const url = resolvedUrls.get(urn);
                    if (url) {
                      existing.imageUrl = url;
                      resolvedCount++;
                      break;
                    }
                  }
                }
              }
              console.log(`[Creative Metadata] Applied ${resolvedCount} resolved image URLs from URNs`);
            }
            
          } catch (err) {
            console.error('[Creative Metadata] Error:', err);
          }
          
          const totalWithNames = [...creativeData.values()].filter(v => v.name).length;
          const totalWithImages = [...creativeData.values()].filter(v => v.imageUrl).length;
          console.log(`[Creative Metadata] Total creatives: ${creativeData.size}, with names: ${totalWithNames}, with images: ${totalWithImages}`);
          return creativeData;
        }
        
        // Helper: Fetch post/share content to extract readable text and image URLs for creatives
        async function fetchShareContent(shareUrns: string[], token: string): Promise<Map<string, { text: string; imageUrl: string }>> {
          const shareData = new Map<string, { text: string; imageUrl: string }>();
          if (shareUrns.length === 0) return shareData;

          console.log(`[Share API] Fetching content for ${shareUrns.length} shares...`);

          // Track URNs that have a media ID but no direct URL, for batch resolution later
          const unresolvedMediaIds = new Map<string, string>(); // shareUrn -> imageUrn

          for (const urn of shareUrns.slice(0, 100)) { // Limit to first 100
            try {
              // First, try the versioned /rest/posts API which returns richer media data (including downloadUrl)
              let data: any = null;
              let usedPostsApi = false;

              try {
                const postsResp = await fetch(`https://api.linkedin.com/rest/posts/${encodeURIComponent(urn)}`, {
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'LinkedIn-Version': '202511',
                    'X-Restli-Protocol-Version': '2.0.0',
                  }
                });
                if (postsResp.ok) {
                  data = await postsResp.json();
                  usedPostsApi = true;
                }
              } catch (e) {
                // /rest/posts failed, will fall back to v2 below
              }

              // Fallback: v2 shares/ugcPosts API
              if (!data) {
                const isUgc = urn.includes('ugcPost');
                const endpoint = isUgc
                  ? `https://api.linkedin.com/v2/ugcPosts/${encodeURIComponent(urn)}`
                  : `https://api.linkedin.com/v2/shares/${encodeURIComponent(urn)}`;

                const response: Response = await fetch(endpoint, {
                  headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.ok) {
                  data = await response.json();
                }
              }

              if (!data) continue;

              // Debug: log first share response structure
              if (shareData.size === 0) {
                console.log(`[Share API] Sample response keys for ${urn} (postsApi=${usedPostsApi}):`, JSON.stringify(Object.keys(data)));
                if (usedPostsApi) {
                  console.log(`[Share API] Posts API content:`, JSON.stringify(data.content || {}).substring(0, 500));
                } else if (urn.includes('ugcPost')) {
                  const sc = data.specificContent?.['com.linkedin.ugc.ShareContent'];
                  console.log(`[Share API] UGC specificContent keys:`, sc ? JSON.stringify(Object.keys(sc)) : 'null');
                  console.log(`[Share API] UGC media:`, sc?.media ? JSON.stringify(sc.media[0]?.thumbnails?.[0] || sc.media[0]?.originalUrl || 'no-thumb-or-url') : 'no-media');
                } else {
                  console.log(`[Share API] Share content keys:`, data.content ? JSON.stringify(Object.keys(data.content)) : 'null');
                  console.log(`[Share API] Full content sample:`, JSON.stringify(data.content || data).substring(0, 500));
                }
              }

              // Extract text and image URL
              let text = '';
              let imageUrl = '';
              const isUgc = urn.includes('ugcPost');

              if (usedPostsApi) {
                // /rest/posts response structure
                text = data.commentary || '';
                const mediaContent = data.content?.media;
                if (mediaContent) {
                  // The Posts API may include the image ID directly
                  const mediaId = mediaContent.id || '';
                  if (mediaId.startsWith('urn:li:image:')) {
                    // Collect for batch resolution via /rest/images
                    unresolvedMediaIds.set(urn, mediaId);
                  }
                }
              } else if (isUgc) {
                // UGC Post structure
                const shareContent = data.specificContent?.['com.linkedin.ugc.ShareContent'];
                text = shareContent?.shareCommentary?.text || '';
                const media = shareContent?.media?.[0];
                if (media) {
                  imageUrl = media.thumbnails?.[0]?.url || media.originalUrl || '';
                  // If no direct URL, check for media URN
                  if (!imageUrl) {
                    const mediaUrn = media.media || media.id || '';
                    if (typeof mediaUrn === 'string' && mediaUrn.startsWith('urn:li:image:')) {
                      unresolvedMediaIds.set(urn, mediaUrn);
                    }
                  }
                }
              } else {
                // v2 Share structure
                text = data.text?.text || data.commentary || '';
                const contentEntity = data.content?.contentEntities?.[0];
                if (contentEntity) {
                  imageUrl = contentEntity.thumbnails?.[0]?.resolvedUrl || '';
                }
                if (!imageUrl && data.content?.multiImage?.images?.[0]) {
                  const img = data.content.multiImage.images[0];
                  imageUrl = img.resolvedUrl || img.url || '';
                }
                if (!imageUrl && data.content?.media?.id) {
                  const mediaId = data.content.media.id;
                  if (typeof mediaId === 'string' && mediaId.startsWith('urn:li:image:')) {
                    unresolvedMediaIds.set(urn, mediaId);
                  } else {
                    console.log(`[Share API] Share has non-image media ID: ${mediaId}`);
                  }
                }
              }

              // Store what we have so far (imageUrl may still be empty, will be filled after batch resolution)
              const truncated = text.length > 80 ? text.substring(0, 77) + '...' : text;
              if (text || imageUrl) {
                shareData.set(urn, { text: truncated, imageUrl });
              } else {
                // Still store entry with empty values so batch resolution can fill imageUrl later
                shareData.set(urn, { text: truncated, imageUrl: '' });
              }
            } catch (err) {
              console.error(`[Share API] Error fetching ${urn}:`, err);
            }
          }

          // Batch resolve all unresolved media IDs via /rest/images API
          if (unresolvedMediaIds.size > 0) {
            console.log(`[Share API] Batch resolving ${unresolvedMediaIds.size} unresolved media IDs via /rest/images...`);
            const uniqueUrns = [...new Set(unresolvedMediaIds.values())];
            const resolvedUrls = await resolveImageUrnsBatch(uniqueUrns, token);

            let resolvedCount = 0;
            for (const [shareUrn, imageUrn] of unresolvedMediaIds) {
              const downloadUrl = resolvedUrls.get(imageUrn);
              if (downloadUrl) {
                const existing = shareData.get(shareUrn);
                if (existing) {
                  existing.imageUrl = downloadUrl;
                  shareData.set(shareUrn, existing);
                } else {
                  shareData.set(shareUrn, { text: '', imageUrl: downloadUrl });
                }
                resolvedCount++;
              }
            }
            console.log(`[Share API] Batch resolution: resolved ${resolvedCount} of ${unresolvedMediaIds.size} media IDs`);
          }

          const withImages = [...shareData.values()].filter(v => v.imageUrl).length;
          console.log(`[Share API] Resolved ${shareData.size} share entries, ${withImages} with images`);
          return shareData;
        }

        // Step 1: Fetch campaigns for campaign name resolution
        console.log('[Step 1] Fetching campaigns...');
        const campaignsResponse = await fetch(
          `https://api.linkedin.com/v2/adCampaignsV2?q=search&search.account.values[0]=urn:li:sponsoredAccount:${accountId}&count=100`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );
        
        if (!campaignsResponse.ok) {
          const errorText = await campaignsResponse.text();
          console.error('[get_creative_report] Failed to fetch campaigns:', campaignsResponse.status, errorText);
          return new Response(JSON.stringify({ error: `Failed to fetch campaigns: ${campaignsResponse.status}`, elements: [] }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
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
        // Parse dates explicitly to avoid timezone issues
        const startDateObj = new Date(startDate);
        const endDateObj = new Date(endDate);
        const startDay = startDateObj.getDate();
        const startMonth = startDateObj.getMonth() + 1;
        const startYear = startDateObj.getFullYear();
        const endDay = endDateObj.getDate();
        const endMonth = endDateObj.getMonth() + 1;
        const endYear = endDateObj.getFullYear();
        
        // Use account-level query ONLY (no campaigns[] filter) for Business Manager compatibility
        const analyticsUrl = `https://api.linkedin.com/v2/adAnalyticsV2?q=analytics&` +
          `dateRange.start.day=${startDay}&` +
          `dateRange.start.month=${startMonth}&` +
          `dateRange.start.year=${startYear}&` +
          `dateRange.end.day=${endDay}&` +
          `dateRange.end.month=${endMonth}&` +
          `dateRange.end.year=${endYear}&` +
          `timeGranularity=${granularity}&` +
          `pivot=CREATIVE&` +
          `accounts[0]=urn:li:sponsoredAccount:${accountId}&` +
          `fields=impressions,clicks,costInLocalCurrency,costInUsd,oneClickLeads,externalWebsiteConversions,pivotValue&` +
          `count=10000`;
        
        console.log(`[Step 3] Analytics URL: ${analyticsUrl}`);

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

        // Step 5: Collect ALL share URNs for image extraction + unresolved ones for name fallback
        const allShareUrns: string[] = [];
        const unresolvedShareUrns: string[] = [];
        versionedCreativeData.forEach((data, creativeId) => {
          if (data.reference) {
            allShareUrns.push(data.reference);
          }
          if (!data.name && data.reference) {
            unresolvedShareUrns.push(data.reference);
          }
        });
        console.log(`[Step 5] ${allShareUrns.length} total share references, ${unresolvedShareUrns.length} need name resolution`);

        // Step 6: Fetch share content for ALL references (for images + name fallback)
        let shareContentData = new Map<string, { text: string; imageUrl: string }>();
        if (allShareUrns.length > 0) {
          shareContentData = await fetchShareContent(allShareUrns, accessToken);
          console.log(`[Step 6] Share API resolved ${shareContentData.size} share entries`);
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
          else if (meta.reference && shareContentData.has(meta.reference)) {
            creativeName = shareContentData.get(meta.reference)!.text;
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
          
          // Extract imageUrl - prefer versioned API, fallback to share content
          let imageUrl = meta.imageUrl || '';
          if (!imageUrl && meta.reference && shareContentData.has(meta.reference)) {
            imageUrl = shareContentData.get(meta.reference)!.imageUrl;
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
            imageUrl: imageUrl || undefined,
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
        const creativesWithImages = reportElements.filter(r => r.imageUrl).length;
        
        console.log(`[get_creative_report] Complete. Total: ${reportElements.length}, with data: ${creativesWithData}, with images: ${creativesWithImages}`);
        
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
          console.error('[get_ad_analytics] Failed to fetch campaigns:', campaignsResponse.status, errorText);
          return new Response(JSON.stringify({ error: `Failed to fetch campaigns: ${campaignsResponse.status}`, elements: [] }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
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
        
        // Batch fetch share/post content to get human-readable titles and image URLs
        const shareContentMap = new Map<string, { text: string; imageUrl: string }>(); // shareUrn -> { text, imageUrl }
        
        if (shareUrnsToResolve.length > 0) {
          const uniqueShareUrns = [...new Set(shareUrnsToResolve)];
          const batchSize = 10;
          
          for (let i = 0; i < uniqueShareUrns.length; i += batchSize) {
            const batch = uniqueShareUrns.slice(i, i + batchSize);
            
            const sharePromises = batch.map(async (shareUrn) => {
              try {
                // Try shares endpoint first
                const shareResponse = await fetch(
                  `https://api.linkedin.com/v2/shares/${shareUrn}`,
                  { headers: { 'Authorization': `Bearer ${accessToken}` } }
                );
                
                if (shareResponse.ok) {
                  const shareData = await shareResponse.json();
                  let text = shareData.text?.text || '';
                  if (!text && shareData.content?.title) {
                    text = shareData.content.title;
                  }
                  if (!text && shareData.content?.description) {
                    text = shareData.content.description;
                  }
                  if (text && text.length > 60) {
                    text = text.substring(0, 57) + '...';
                  }
                  // Extract image from share content
                  const contentEntity = shareData.content?.contentEntities?.[0];
                  const imageUrl = contentEntity?.thumbnails?.[0]?.resolvedUrl || '';
                  return { urn: shareUrn, text: text || null, imageUrl };
                }
                
                // Try ugcPosts endpoint as fallback (for ugcPost URNs)
                if (shareUrn.includes('ugcPost')) {
                  const ugcResponse = await fetch(
                    `https://api.linkedin.com/v2/ugcPosts/${shareUrn}`,
                    { headers: { 'Authorization': `Bearer ${accessToken}` } }
                  );
                  
                  if (ugcResponse.ok) {
                    const ugcData = await ugcResponse.json();
                    const shareContent = ugcData.specificContent?.['com.linkedin.ugc.ShareContent'];
                    let text = shareContent?.shareCommentary?.text || '';
                    if (!text) {
                      const media = shareContent?.media?.[0];
                      text = media?.title?.text || media?.description?.text || '';
                    }
                    if (text && text.length > 60) {
                      text = text.substring(0, 57) + '...';
                    }
                    // Extract image from UGC post media
                    const media = shareContent?.media?.[0];
                    const imageUrl = media?.thumbnails?.[0]?.url || media?.originalUrl || '';
                    return { urn: shareUrn, text: text || null, imageUrl };
                  }
                }
                
                return { urn: shareUrn, text: null, imageUrl: '' };
              } catch (e) {
                console.log(`[Warning] Share lookup error for ${shareUrn}:`, e);
                return { urn: shareUrn, text: null, imageUrl: '' };
              }
            });
            
            const results = await Promise.all(sharePromises);
            results.forEach(result => {
              if (result.text || result.imageUrl) {
                shareContentMap.set(result.urn, { text: result.text || '', imageUrl: result.imageUrl });
              }
            });
          }
          console.log(`[Step 2b] Resolved ${shareContentMap.size} share entries`);
        }

        // Build creative metadata map with resolved names
        const creativeMetadataMap = new Map<string, { name: string; campaignId: string; campaignName: string; status: string; type: string; imageUrl: string }>();
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
              const shareEntry = shareContentMap.get(dsContent.share);
              if (shareEntry?.text) {
                creativeName = shareEntry.text;
              } else {
                creativeName = `Sponsored Content #${dsContent.share.split(':').pop() || creativeId}`;
              }
              creativeType = 'SPONSORED_CONTENT';
            } else if (sponsoredUpdate?.activity) {
              // Try to get activity content text  
              const activityEntry = shareContentMap.get(sponsoredUpdate.activity);
              if (activityEntry?.text) {
                creativeName = activityEntry.text;
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
          
          // Resolve imageUrl from share content
          const shareUrn = creativeToShareMap.get(creativeId);
          const shareEntry = shareUrn ? shareContentMap.get(shareUrn) : undefined;
          const imageUrl = shareEntry?.imageUrl || '';
          
          const resolvedCampaignName = campaignMap.get(campaignId);
          creativeMetadataMap.set(creativeId, {
            name: creativeName,
            campaignId,
            campaignName: typeof resolvedCampaignName === 'string' ? resolvedCampaignName : `Campaign ${campaignId}`,
            status: c.status || 'UNKNOWN',
            type: creativeType !== 'UNKNOWN' ? creativeType : (c.type || 'UNKNOWN'),
            imageUrl,
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
            imageUrl: '',
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
            imageUrl: metadata.imageUrl || undefined,
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
              imageUrl: metadata.imageUrl || undefined,
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
        const { accountId, dateRange, timeGranularity, pivot, campaignIds } = params || {};
        const startDate = dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const endDate = dateRange?.end || new Date().toISOString().split('T')[0];
        const granularity = timeGranularity || 'ALL';
        const selectedPivot = pivot || 'MEMBER_COMPANY';
        
        console.log(`[get_demographic_analytics] Starting for account ${accountId}, pivot: ${selectedPivot}, date range: ${startDate} to ${endDate}, campaigns: ${campaignIds?.length || 'all'}`);

        // Build campaign filter params if campaigns are specified
        let campaignParams = '';
        if (campaignIds && campaignIds.length > 0) {
          campaignParams = campaignIds.map((id: string, idx: number) => 
            `campaigns[${idx}]=urn:li:sponsoredCampaign:${id}`
          ).join('&') + '&';
        }

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
          `${campaignParams}` +
          `accounts[0]=urn:li:sponsoredAccount:${accountId}&` +
          `fields=impressions,clicks,costInLocalCurrency,costInUsd,externalWebsiteConversions,oneClickLeads,pivotValue&` +
          `count=10000`;

        console.log(`[get_demographic_analytics] Fetching analytics with pivot=${selectedPivot}...`);
        
        // Paginated fetch to get all demographic records
        let allElements: any[] = [];
        let startOffset = 0;
        const pageSize = 10000;
        let hasMore = true;
        
        while (hasMore) {
          const paginatedUrl = `${analyticsUrl}&start=${startOffset}`;
          console.log(`[get_demographic_analytics] Fetching page at offset ${startOffset}...`);
          
          const analyticsResponse = await fetch(paginatedUrl, {
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
          const pageElements = analyticsData.elements || [];
          allElements = allElements.concat(pageElements);
          
          console.log(`[get_demographic_analytics] Page returned ${pageElements.length} records, total so far: ${allElements.length}`);
          
          // Check if there are more pages
          const paging = analyticsData.paging;
          if (paging && paging.total && (startOffset + pageElements.length) < paging.total) {
            startOffset += pageSize;
          } else if (pageElements.length === pageSize) {
            // No paging info but got full page, try fetching more
            startOffset += pageSize;
          } else {
            hasMore = false;
          }
          
          // Safety limit to prevent infinite loops
          if (startOffset > 100000) {
            console.log(`[get_demographic_analytics] Reached safety limit at offset ${startOffset}`);
            hasMore = false;
          }
        }
        
        console.log(`[get_demographic_analytics] Total received: ${allElements.length} demographic records`);

        // Aggregate by pivot value
        const entityMap = new Map<string, { 
          entityUrn: string;
          impressions: number; 
          clicks: number; 
          spent: number; 
          spentUsd: number; 
          leads: number;
        }>();
        
        allElements.forEach((el: any) => {
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
        const { accountId, dateRange, timeGranularity, campaignIds, offset: reqOffset, limit: reqLimit } = params || {};
        const startDate = dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const endDate = dateRange?.end || new Date().toISOString().split('T')[0];
        const granularity = timeGranularity || 'ALL';
        const batchOffset = typeof reqOffset === 'number' ? reqOffset : 0;
        const batchLimit = typeof reqLimit === 'number' ? reqLimit : 2000;
        
        const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
        const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
        
        console.log(`[get_company_demographic] Starting for account ${accountId}, date range: ${startDate} to ${endDate}, campaigns: ${campaignIds?.length || 'all'}, offset: ${batchOffset}, limit: ${batchLimit}`);

        // Step 1: Fetch demographic analytics with MEMBER_COMPANY pivot (account-level aggregation)
        let analyticsUrl = `https://api.linkedin.com/v2/adAnalyticsV2?q=analytics&` +
          `dateRange.start.day=${startDay}&` +
          `dateRange.start.month=${startMonth}&` +
          `dateRange.start.year=${startYear}&` +
          `dateRange.end.day=${endDay}&` +
          `dateRange.end.month=${endMonth}&` +
          `dateRange.end.year=${endYear}&` +
          `timeGranularity=${granularity === 'ALL' ? 'ALL' : granularity}&` +
          `pivot=MEMBER_COMPANY&` +
          `accounts[0]=urn:li:sponsoredAccount:${accountId}&` +
          `fields=impressions,clicks,landingPageClicks,costInLocalCurrency,costInUsd,externalWebsiteConversions,oneClickLeads,totalEngagements,likes,comments,reactions,shares,pivotValue&` +
          `count=10000`;
        
        if (campaignIds && campaignIds.length > 0) {
          campaignIds.forEach((id: string, i: number) => {
            analyticsUrl += `&campaigns[${i}]=urn:li:sponsoredCampaign:${id}`;
          });
        }

        console.log('[get_company_demographic] Step 1: Fetching company demographic analytics...');
        
        // Aggregate by company URN directly during pagination to reduce peak memory
        const companyMap = new Map<string, { 
          entityUrn: string;
          impressions: number; 
          clicks: number; 
          spent: number; 
          spentUsd: number; 
          leads: number;
          engagements: number;
          landingPageClicks: number;
          likes: number;
          comments: number;
          reactions: number;
          shares: number;
        }>();
        
        let startOffset = 0;
        const pageSize = 10000;
        let hasMore = true;
        let totalReceived = 0;
        
        while (hasMore) {
          const paginatedUrl = `${analyticsUrl}&start=${startOffset}`;
          const analyticsResponse = await fetch(paginatedUrl, {
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
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          
          const analyticsData = await analyticsResponse.json();
          const pageElements = analyticsData.elements || [];
          totalReceived += pageElements.length;
          
          // Aggregate immediately instead of collecting all elements
          for (const el of pageElements) {
            const entityUrn = el.pivotValue || '';
            if (!entityUrn) continue;
            
            const existing = companyMap.get(entityUrn);
            if (existing) {
              existing.impressions += (el.impressions || 0);
              existing.clicks += (el.clicks || 0);
              existing.spent += parseFloat(el.costInLocalCurrency || '0');
              existing.spentUsd += parseFloat(el.costInUsd || '0');
              existing.leads += (el.oneClickLeads || 0) + (el.externalWebsiteConversions || 0);
              existing.landingPageClicks += (el.landingPageClicks || 0);
              existing.engagements += (el.totalEngagements || 0);
              existing.likes += (el.likes || 0);
              existing.comments += (el.comments || 0);
              existing.reactions += (el.reactions || 0);
              existing.shares += (el.shares || 0);
            } else {
              companyMap.set(entityUrn, {
                entityUrn,
                impressions: el.impressions || 0,
                clicks: el.clicks || 0,
                spent: parseFloat(el.costInLocalCurrency || '0'),
                spentUsd: parseFloat(el.costInUsd || '0'),
                leads: (el.oneClickLeads || 0) + (el.externalWebsiteConversions || 0),
                landingPageClicks: el.landingPageClicks || 0,
                engagements: el.totalEngagements || 0,
                likes: el.likes || 0,
                comments: el.comments || 0,
                reactions: el.reactions || 0,
                shares: el.shares || 0,
              });
            }
          }
          
          const paging = analyticsData.paging;
          if (pageElements.length === 0) {
            hasMore = false;
          } else if (paging && paging.total && (startOffset + pageElements.length) < paging.total) {
            startOffset += pageElements.length;
          } else if (!paging?.total && pageElements.length >= pageSize) {
            startOffset += pageElements.length;
          } else {
            hasMore = false;
          }

          if (startOffset > 100000) {
            hasMore = false;
          }
        }
        
        console.log(`[get_company_demographic] Total received: ${totalReceived} records, aggregated to ${companyMap.size} unique companies`);

        // Filter out zero-metric entries before sorting/slicing so totalCompanies and hasMore are accurate
        const allCompaniesSorted = Array.from(companyMap.entries())
          .filter(([, m]) => m.impressions > 0 || m.clicks > 0 || m.spent > 0 || m.leads > 0)
          .sort((a, b) => b[1].impressions - a[1].impressions);
        const totalCompaniesCount = allCompaniesSorted.length;
        const slicedCompanies = allCompaniesSorted.slice(batchOffset, batchOffset + batchLimit);
        const hasMoreCompanies = (batchOffset + batchLimit) < totalCompaniesCount;
        
        // Build a trimmed companyMap for this batch only
        const batchCompanyMap = new Map(slicedCompanies);
        console.log(`[get_company_demographic] Returning batch: offset=${batchOffset}, limit=${batchLimit}, batchSize=${slicedCompanies.length}, total=${totalCompaniesCount}, hasMore=${hasMoreCompanies}`);

        // Run name resolution (Steps 2+3) — objective breakdown is always lazy-loaded via get_objective_breakdowns
        const companyUrns = Array.from(batchCompanyMap.keys());
        const companyNames = new Map<string, string>();
        const companyWebsites = new Map<string, { website: string | null; linkedInUrl: string | null; status: string }>();

        // Name resolution task (Steps 2+3)
        const nameResolutionTask = async () => {
          const orgIdToUrn = new Map<string, string>();
          companyUrns.forEach(urn => {
            const match = urn.match(/^urn:li:organization:(\d+)$/);
            if (match) orgIdToUrn.set(match[1], urn);
          });
          
          const orgIds = Array.from(orgIdToUrn.keys());
          console.log(`[get_company_demographic] Step 2: Resolving ${orgIds.length} organization IDs...`);

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
                    if (org?.localizedName) companyNames.set(urn, org.localizedName);
                    const website = org?.localizedWebsite || null;
                    const vanityName = org?.vanityName || null;
                    const linkedInUrl = vanityName ? `https://www.linkedin.com/company/${vanityName}` : null;
                    companyWebsites.set(urn, {
                      website, linkedInUrl,
                      status: website ? 'resolved' : (vanityName ? 'fallback' : 'unresolved'),
                    });
                  });
                }
              } catch (e) {
                console.log('[Warning] Organization lookup failed:', e);
              }
            }
          }
          
          console.log(`[get_company_demographic] Resolved ${companyNames.size} company names`);

          // Step 3: Vanity lookups for unresolved companies
          const unresolvedUrns = companyUrns.filter(urn => {
            const info = companyWebsites.get(urn);
            return !info || info.status === 'unresolved';
          });
          
          if (unresolvedUrns.length > 0) {
            console.log(`[get_company_demographic] Step 3: Vanity lookup for ${unresolvedUrns.length} unresolved companies...`);
            const batchSize = 10;
            for (let i = 0; i < Math.min(unresolvedUrns.length, 50); i += batchSize) {
              const batch = unresolvedUrns.slice(i, i + batchSize);
              const vanityPromises = batch.map(async (urn) => {
                const companyName = companyNames.get(urn);
                if (!companyName) return { urn, result: null };
                const vanityGuess = companyName.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').slice(0, 50);
                try {
                  const vanityResponse = await fetch(
                    `https://api.linkedin.com/rest/organizations?q=vanityName&vanityName=${encodeURIComponent(vanityGuess)}`,
                    { headers: { 'Authorization': `Bearer ${accessToken}`, 'LinkedIn-Version': '202511', 'X-Restli-Protocol-Version': '2.0.0' } }
                  );
                  if (vanityResponse.ok) {
                    const vanityData = await vanityResponse.json();
                    if (vanityData.elements && vanityData.elements.length > 0) {
                      const org = vanityData.elements[0];
                      return { urn, result: { website: org.localizedWebsite || null, linkedInUrl: org.vanityName ? `https://www.linkedin.com/company/${org.vanityName}` : null, status: org.localizedWebsite ? 'resolved' : 'fallback' } };
                    }
                  }
                  return { urn, result: null };
                } catch (e) { return { urn, result: null }; }
              });
              const results = await Promise.all(vanityPromises);
              results.forEach(({ urn, result }) => { if (result) companyWebsites.set(urn, result); });
            }
          }
        };

        // Objective breakdowns are always lazy-loaded via get_objective_breakdowns action
        // Just run name resolution
        console.log(`[get_company_demographic] Running name resolution for ${companyUrns.length} companies...`);
        await nameResolutionTask();

        // Build final report
        const reportElements: any[] = [];
        batchCompanyMap.forEach((metrics, entityUrn) => {
          const entityName = companyNames.get(entityUrn) || extractNameFromUrn(entityUrn);
          const websiteInfo = companyWebsites.get(entityUrn) || { website: null, linkedInUrl: null, status: 'unresolved' };
          
          const ctr = metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : 0;
          const cpc = metrics.clicks > 0 ? metrics.spent / metrics.clicks : 0;
          const cpm = metrics.impressions > 0 ? (metrics.spent / metrics.impressions) * 1000 : 0;
          
          reportElements.push({
            entityUrn, entityName,
            website: websiteInfo.website,
            linkedInUrl: websiteInfo.linkedInUrl,
            enrichmentStatus: websiteInfo.status,
            impressions: metrics.impressions,
            clicks: metrics.clicks,
            landingPageClicks: metrics.landingPageClicks,
            costInLocalCurrency: metrics.spent.toFixed(2),
            costInUsd: metrics.spentUsd.toFixed(2),
            leads: metrics.leads,
            engagements: metrics.engagements,
            likes: metrics.likes,
            comments: metrics.comments,
            reactions: metrics.reactions,
            shares: metrics.shares,
            ctr: ctr.toFixed(2), cpc: cpc.toFixed(2), cpm: cpm.toFixed(2),
          });
        });

        const filteredElements = reportElements;
        filteredElements.sort((a, b) => b.impressions - a.impressions);
        
        const resolvedCount = filteredElements.filter(r => r.enrichmentStatus === 'resolved').length;
        const unresolvedCount = filteredElements.filter(r => r.enrichmentStatus === 'unresolved').length;
        
        console.log(`[get_company_demographic] Complete. Batch: ${filteredElements.length}, Total: ${totalCompaniesCount}, HasMore: ${hasMoreCompanies}`);
        
        return new Response(JSON.stringify({ 
          elements: filteredElements,
          metadata: {
            accountId,
            dateRange: { start: startDate, end: endDate },
            timeGranularity: granularity,
            totalCompanies: totalCompaniesCount,
            batchSize: filteredElements.length,
            offset: batchOffset,
            hasMore: hasMoreCompanies,
            resolvedCount, unresolvedCount,
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_objective_breakdowns': {
        // Lazy-load objective breakdowns; optionally scoped to specific company URNs
        const { accountId, dateRange, campaignIds: filterCampaignIds, companyUrns: filterCompanyUrns } = params || {};
        const companyUrnSet: Set<string> | null = filterCompanyUrns && filterCompanyUrns.length > 0 ? new Set(filterCompanyUrns) : null;
        const startDate = dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const endDate = dateRange?.end || new Date().toISOString().split('T')[0];
        const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
        const [endYear, endMonth, endDay] = endDate.split('-').map(Number);

        console.log(`[get_objective_breakdowns] Starting for account ${accountId}`);

        try {
          // Step 1: Fetch all campaigns with pagination
          const allCampaigns: any[] = [];
          let campStart = 0;
          const campPageSize = 500;
          let hasMoreCamps = true;
          while (hasMoreCamps) {
            const campUrl = `https://api.linkedin.com/v2/adCampaignsV2?q=search&search.account.values[0]=urn:li:sponsoredAccount:${accountId}&count=${campPageSize}&start=${campStart}`;
            const campResponse = await fetch(campUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } });
            if (!campResponse.ok) { hasMoreCamps = false; break; }
            const campData = await campResponse.json();
            const pageCamps = campData.elements || [];
            allCampaigns.push(...pageCamps);
            if (pageCamps.length < campPageSize) { hasMoreCamps = false; } else { campStart += campPageSize; }
          }
          console.log(`[get_objective_breakdowns] Fetched ${allCampaigns.length} campaigns`);

          // Step 1.5: Find campaigns that actually delivered in the date range (paginated)
          const campaignsActiveInRange = new Set<string>();
          try {
            const actPageSize = 10000;
            let actStart = 0;
            let actHasMore = true;
            while (actHasMore && actStart <= 100000) {
              const actQp = new URLSearchParams();
              actQp.set('q', 'analytics');
              actQp.set('dateRange.start.day', String(startDay));
              actQp.set('dateRange.start.month', String(startMonth));
              actQp.set('dateRange.start.year', String(startYear));
              actQp.set('dateRange.end.day', String(endDay));
              actQp.set('dateRange.end.month', String(endMonth));
              actQp.set('dateRange.end.year', String(endYear));
              actQp.set('timeGranularity', 'ALL');
              actQp.set('pivot', 'CAMPAIGN');
              actQp.set('accounts[0]', `urn:li:sponsoredAccount:${accountId}`);
              actQp.set('fields', 'pivotValue,impressions');
              actQp.set('count', String(actPageSize));
              actQp.set('start', String(actStart));
              const actResp = await fetch(`https://api.linkedin.com/v2/adAnalyticsV2?${actQp.toString()}`, {
                headers: { 'Authorization': `Bearer ${accessToken}` },
              });
              if (!actResp.ok) { actHasMore = false; break; }
              const actData = await actResp.json();
              const actEls = actData.elements || [];
              for (const el of actEls) {
                if ((el.impressions || 0) > 0 && el.pivotValue) {
                  const m = el.pivotValue.match(/:(\d+)$/);
                  if (m) campaignsActiveInRange.add(m[1]);
                }
              }
              const paging = actData.paging;
              if (actEls.length === 0) { actHasMore = false; }
              else if (paging?.total && (actStart + actEls.length) < paging.total) { actStart += actEls.length; }
              else if (!paging?.total && actEls.length >= actPageSize) { actStart += actEls.length; }
              else { actHasMore = false; }
            }
            console.log(`[get_objective_breakdowns] Activity probe paged: ${campaignsActiveInRange.size} campaigns active in range`);
          } catch (e) {
            console.log('[get_objective_breakdowns] Campaign activity query failed, using all campaigns');
          }

          // Step 2: Group campaigns by objective. Keep UNCLASSIFIED bucket so deleted/objectiveless campaigns still count.
          const objectiveToCampaigns = new Map<string, string[]>();
          const campaignNameMap = new Map<string, string>();
          const filteredCampaignSet = filterCampaignIds && filterCampaignIds.length > 0 ? new Set(filterCampaignIds.map(String)) : null;
          const seenCampaignIds = new Set<string>();

          for (const campaign of allCampaigns) {
            const campaignId = campaign.id?.toString() || '';
            if (!campaignId) continue;
            // Bucket by objectiveType, fall back to type, fall back to UNCLASSIFIED
            const objective = campaign.objectiveType || campaign.type || 'UNCLASSIFIED';
            const campaignName = campaign.name || `Campaign ${campaignId}`;
            if (filteredCampaignSet && !filteredCampaignSet.has(campaignId)) continue;
            // Skip campaigns with no deliveries in the selected time frame
            if (campaignsActiveInRange.size > 0 && !campaignsActiveInRange.has(campaignId)) continue;
            campaignNameMap.set(campaignId, campaignName);
            seenCampaignIds.add(campaignId);
            const existing = objectiveToCampaigns.get(objective) || [];
            existing.push(campaignId);
            objectiveToCampaigns.set(objective, existing);
          }

          // Step 2.5: Backfill campaigns that delivered impressions but aren't in /adCampaignsV2
          // (deleted/archived). Bucket them under UNCLASSIFIED so their company impressions show up.
          if (campaignsActiveInRange.size > 0) {
            const orphanIds: string[] = [];
            for (const id of campaignsActiveInRange) {
              if (seenCampaignIds.has(id)) continue;
              if (filteredCampaignSet && !filteredCampaignSet.has(id)) continue;
              orphanIds.push(id);
              campaignNameMap.set(id, `Campaign ${id}`);
            }
            if (orphanIds.length > 0) {
              const existing = objectiveToCampaigns.get('UNCLASSIFIED') || [];
              objectiveToCampaigns.set('UNCLASSIFIED', existing.concat(orphanIds));
              console.log(`[get_objective_breakdowns] Backfilled ${orphanIds.length} orphan campaigns into UNCLASSIFIED`);
            }
          }

          const uniqueObjectives = Array.from(objectiveToCampaigns.keys());
          console.log(`[get_objective_breakdowns] Found ${uniqueObjectives.length} objectives: ${uniqueObjectives.join(', ')}`);

          // Step 2.6: Probe creatives that delivered in range, then resolve names + parent campaigns
          // (LinkedIn doesn't allow MEMBER_COMPANY × CREATIVE dual pivot, so we list creatives that
          //  ran inside the matched campaigns instead of attributing per-company-per-creative.)
          // creativeId -> { name, campaignId }
          const creativeIdToInfo = new Map<string, { name: string; campaignId: string }>();
          try {
            const activeCreativeIds = new Set<string>();
            const crPageSize = 10000;
            let crStart = 0;
            let crHasMore = true;
            while (crHasMore && crStart <= 100000) {
              const crQp = new URLSearchParams();
              crQp.set('q', 'analytics');
              crQp.set('dateRange.start.day', String(startDay));
              crQp.set('dateRange.start.month', String(startMonth));
              crQp.set('dateRange.start.year', String(startYear));
              crQp.set('dateRange.end.day', String(endDay));
              crQp.set('dateRange.end.month', String(endMonth));
              crQp.set('dateRange.end.year', String(endYear));
              crQp.set('timeGranularity', 'ALL');
              crQp.set('pivot', 'CREATIVE');
              crQp.set('accounts[0]', `urn:li:sponsoredAccount:${accountId}`);
              crQp.set('fields', 'pivotValue,impressions');
              crQp.set('count', String(crPageSize));
              crQp.set('start', String(crStart));
              const crResp = await fetch(`https://api.linkedin.com/v2/adAnalyticsV2?${crQp.toString()}`, {
                headers: { 'Authorization': `Bearer ${accessToken}` },
              });
              if (!crResp.ok) { crHasMore = false; break; }
              const crData = await crResp.json();
              const crEls = crData.elements || [];
              for (const el of crEls) {
                if ((el.impressions || 0) > 0 && el.pivotValue) {
                  const m = el.pivotValue.match(/:(\d+)$/);
                  if (m) activeCreativeIds.add(m[1]);
                }
              }
              const paging = crData.paging;
              if (crEls.length === 0) { crHasMore = false; }
              else if (paging?.total && (crStart + crEls.length) < paging.total) { crStart += crEls.length; }
              else if (!paging?.total && crEls.length >= crPageSize) { crStart += crEls.length; }
              else { crHasMore = false; }
            }
            console.log(`[get_objective_breakdowns] Creative probe: ${activeCreativeIds.size} creatives active in range`);

            // Resolve names + parent campaign for each active creative (cap 500, batches of 10)
            const creativeIdList = Array.from(activeCreativeIds).slice(0, 500);
            const batchSize = 10;
            for (let i = 0; i < creativeIdList.length; i += batchSize) {
              const batch = creativeIdList.slice(i, i + batchSize);
              await Promise.all(batch.map(async (cid) => {
                try {
                  const cUrn = encodeURIComponent(`urn:li:sponsoredCreative:${cid}`);
                  const cUrl = `https://api.linkedin.com/rest/adAccounts/${accountId}/creatives/${cUrn}`;
                  const cResp = await fetch(cUrl, {
                    headers: {
                      'Authorization': `Bearer ${accessToken}`,
                      'LinkedIn-Version': '202511',
                      'X-Restli-Protocol-Version': '2.0.0',
                    },
                  });
                  if (!cResp.ok) {
                    creativeIdToInfo.set(cid, { name: `Creative ${cid}`, campaignId: '' });
                    return;
                  }
                  const cd = await cResp.json();
                  const campaignUrn = cd.campaign || '';
                  const campaignId = campaignUrn.split(':').pop() || '';
                  const name = cd.name || `Creative ${cid}`;
                  creativeIdToInfo.set(cid, { name, campaignId });
                } catch {
                  creativeIdToInfo.set(cid, { name: `Creative ${cid}`, campaignId: '' });
                }
              }));
            }
            console.log(`[get_objective_breakdowns] Resolved ${creativeIdToInfo.size} creative names`);
          } catch (e) {
            console.log('[get_objective_breakdowns] Creative probe failed:', e);
          }

          // Build campaignId -> objective lookup for grouping creatives
          const campaignIdToObjective = new Map<string, string>();
          for (const [obj, ids] of objectiveToCampaigns.entries()) {
            for (const id of ids) campaignIdToObjective.set(id, obj);
          }
          // objective -> { creativeIds, creativeNames, creativeCampaignMap }
          const objectiveCreativeInfo: Record<string, { creativeIds: string[]; creativeNames: Record<string, string>; creativeCampaignMap: Record<string, string> }> = {};
          for (const [cid, info] of creativeIdToInfo.entries()) {
            const obj = campaignIdToObjective.get(info.campaignId) || 'UNCLASSIFIED';
            if (!objectiveCreativeInfo[obj]) objectiveCreativeInfo[obj] = { creativeIds: [], creativeNames: {}, creativeCampaignMap: {} };
            objectiveCreativeInfo[obj].creativeIds.push(cid);
            objectiveCreativeInfo[obj].creativeNames[cid] = info.name;
            if (info.campaignId) objectiveCreativeInfo[obj].creativeCampaignMap[cid] = info.campaignId;
          }

          // Step 3: Query per objective group in parallel (avoids 150s edge timeout)
          // companyUrn -> [{objective, metrics, campaignIds, campaignNames, creativeIds, creativeNames}]
          const result: Record<string, any[]> = {};
          const objectiveCampaignInfo: Record<string, { campaignIds: string[]; campaignNames: Record<string, string> }> = {};

          const objectivesWithCampaigns = uniqueObjectives
            .map(objective => ({ objective, campIds: objectiveToCampaigns.get(objective) || [] }))
            .filter(o => o.campIds.length > 0);

          for (const { objective, campIds } of objectivesWithCampaigns) {
            const names: Record<string, string> = {};
            campIds.forEach(id => { names[id] = campaignNameMap.get(id) || `Campaign ${id}`; });
            objectiveCampaignInfo[objective] = { campaignIds: campIds, campaignNames: names };
          }

          // Run all objective queries concurrently
          const objectiveResults = await Promise.all(objectivesWithCampaigns.map(async ({ objective, campIds }) => {
            try {
              const qParams = new URLSearchParams();
              qParams.set('q', 'analytics');
              qParams.set('dateRange.start.day', String(startDay));
              qParams.set('dateRange.start.month', String(startMonth));
              qParams.set('dateRange.start.year', String(startYear));
              qParams.set('dateRange.end.day', String(endDay));
              qParams.set('dateRange.end.month', String(endMonth));
              qParams.set('dateRange.end.year', String(endYear));
              qParams.set('timeGranularity', 'ALL');
              qParams.set('pivot', 'MEMBER_COMPANY');
              qParams.set('accounts[0]', `urn:li:sponsoredAccount:${accountId}`);
              qParams.set('fields', 'impressions,clicks,landingPageClicks,costInLocalCurrency,oneClickLeads,externalWebsiteConversions,totalEngagements,likes,comments,reactions,shares,pivotValue');
              qParams.set('count', '10000');
              campIds.forEach((id, idx) => { qParams.set(`campaigns[${idx}]`, `urn:li:sponsoredCampaign:${id}`); });

              const queryString = qParams.toString();
              const baseUrl = 'https://api.linkedin.com/v2/adAnalyticsV2';
              const fullUrl = `${baseUrl}?${queryString}`;

              let response: Response;
              if (fullUrl.length > 4000) {
                response = await fetch(baseUrl, {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/x-www-form-urlencoded', 'X-HTTP-Method-Override': 'GET' },
                  body: queryString,
                });
              } else {
                response = await fetch(fullUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } });
              }

              if (!response.ok) {
                console.log(`[get_objective_breakdowns] Objective ${objective} failed: ${response.status}`);
                return { objective, elements: [] as any[] };
              }
              const data = await response.json();
              return { objective, elements: data.elements || [] };
            } catch (e) {
              console.log(`[get_objective_breakdowns] Objective ${objective} error:`, e);
              return { objective, elements: [] as any[] };
            }
          }));

          for (const { objective, elements } of objectiveResults) {
            for (const el of elements) {
              const entityUrn = el.pivotValue || '';
              if (!entityUrn) continue;
              const impressions = el.impressions || 0;
              const clicks = el.clicks || 0;
              const spent = parseFloat(el.costInLocalCurrency || '0');
              const leads = (el.oneClickLeads || 0) + (el.externalWebsiteConversions || 0);
              const landingPageClicks = el.landingPageClicks || 0;
              const engagements = el.totalEngagements || 0;
              const likes = el.likes || 0;
              const comments = el.comments || 0;
              const reactions = el.reactions || 0;
              const shares = el.shares || 0;
              if (impressions === 0 && clicks === 0 && spent === 0 && leads === 0 && engagements === 0 && landingPageClicks === 0) continue;

              if (!result[entityUrn]) result[entityUrn] = [];
              const existing = result[entityUrn].find((e: any) => e.objective === objective);
              if (existing) {
                existing.impressions += impressions; existing.clicks += clicks; existing.spent += spent;
                existing.leads += leads; existing.landingPageClicks += landingPageClicks;
                existing.engagements += engagements; existing.likes += likes;
                existing.comments += comments; existing.reactions += reactions; existing.shares += shares;
              } else {
                result[entityUrn].push({ objective, impressions, clicks, spent: parseFloat(spent.toFixed(2)), leads, landingPageClicks, engagements, likes, comments, reactions, shares });
              }
            }
            console.log(`[get_objective_breakdowns] Objective ${objective}: processed ${elements.length} elements`);
          }

          // Compute derived metrics and attach campaign info
          const finalResult: Record<string, any[]> = {};
          for (const [entityUrn, breakdowns] of Object.entries(result)) {
            finalResult[entityUrn] = breakdowns.map((b: any) => {
              const info = objectiveCampaignInfo[b.objective] || { campaignIds: [], campaignNames: {} };
              const cInfo = objectiveCreativeInfo[b.objective] || { creativeIds: [], creativeNames: {}, creativeCampaignMap: {} };
              return {
                ...b,
                ctr: b.impressions > 0 ? parseFloat(((b.clicks / b.impressions) * 100).toFixed(2)) : 0,
                cpc: b.clicks > 0 ? parseFloat((b.spent / b.clicks).toFixed(2)) : 0,
                cpm: b.impressions > 0 ? parseFloat(((b.spent / b.impressions) * 1000).toFixed(2)) : 0,
                campaignIds: info.campaignIds,
                campaignNames: info.campaignNames,
                creativeIds: cInfo.creativeIds,
                creativeNames: cInfo.creativeNames,
                creativeCampaignMap: cInfo.creativeCampaignMap,
              };
            });
          }

          const filteredResult = companyUrnSet
            ? Object.fromEntries(Object.entries(finalResult).filter(([urn]) => companyUrnSet.has(urn)))
            : finalResult;
          console.log(`[get_objective_breakdowns] Complete. ${Object.keys(finalResult).length} companies in data, returning ${Object.keys(filteredResult).length}`);

          return new Response(JSON.stringify({ breakdowns: filteredResult }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (e: any) {
          console.error(`[get_objective_breakdowns] Fatal error:`, e);
          return new Response(JSON.stringify({ error: e.message || 'Failed to fetch objective breakdowns' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      case 'get_creative_company_breakdown': {
        // Per-creative MEMBER_COMPANY pivot, one query per creative, optionally filtered to companyUrns.
        const { accountId, dateRange, creativeIds: rawCreativeIds, companyUrns } = params || {};
        const creativeIds: string[] = Array.isArray(rawCreativeIds) ? rawCreativeIds.filter((x: any) => typeof x === 'string' && x) : [];
        const companyUrnSet: Set<string> | undefined = Array.isArray(companyUrns) && companyUrns.length > 0 ? new Set(companyUrns as string[]) : undefined;
        const startDate = dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const endDate = dateRange?.end || new Date().toISOString().split('T')[0];
        const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
        const [endYear, endMonth, endDay] = endDate.split('-').map(Number);

        if (!accountId || creativeIds.length === 0) {
          return new Response(JSON.stringify({ breakdowns: {} }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        console.log(`[get_creative_company_breakdown] ${creativeIds.length} creatives × ${companyUrnSet ? companyUrnSet.size : 'all'} companies, concurrency=5`);

        const result: Record<string, Record<string, any>> = {};

        const fetchOne = async (creativeId: string) => {
          try {
            const pageSize = 10000;
            let start = 0;
            let hasMore = true;
            while (hasMore && start <= 100000) {
              const qp = new URLSearchParams();
              qp.set('q', 'analytics');
              qp.set('dateRange.start.day', String(startDay));
              qp.set('dateRange.start.month', String(startMonth));
              qp.set('dateRange.start.year', String(startYear));
              qp.set('dateRange.end.day', String(endDay));
              qp.set('dateRange.end.month', String(endMonth));
              qp.set('dateRange.end.year', String(endYear));
              qp.set('timeGranularity', 'ALL');
              qp.set('pivot', 'MEMBER_COMPANY');
              qp.set('accounts[0]', `urn:li:sponsoredAccount:${accountId}`);
              qp.set('creatives[0]', `urn:li:sponsoredCreative:${creativeId}`);
              qp.set('fields', 'pivotValue,impressions,clicks,landingPageClicks,costInLocalCurrency,oneClickLeads,externalWebsiteConversions,totalEngagements');
              qp.set('count', String(pageSize));
              qp.set('start', String(start));
              const resp = await fetch(`https://api.linkedin.com/v2/adAnalyticsV2?${qp.toString()}`, {
                headers: { 'Authorization': `Bearer ${accessToken}` },
              });
              if (!resp.ok) {
                console.log(`[get_creative_company_breakdown] Creative ${creativeId} failed: ${resp.status}`);
                hasMore = false;
                break;
              }
              const data = await resp.json();
              const els = data.elements || [];
              for (const el of els) {
                const companyUrn = el.pivotValue || '';
                if (!companyUrn) continue;
                if (companyUrnSet && !companyUrnSet.has(companyUrn)) continue;
                const impressions = el.impressions || 0;
                const clicks = el.clicks || 0;
                const spent = parseFloat(el.costInLocalCurrency || '0');
                const leads = (el.oneClickLeads || 0) + (el.externalWebsiteConversions || 0);
                if (impressions === 0 && clicks === 0 && spent === 0 && leads === 0) continue;
                if (!result[companyUrn]) result[companyUrn] = {};
                result[companyUrn][creativeId] = {
                  impressions,
                  clicks,
                  landingPageClicks: el.landingPageClicks || 0,
                  spent: parseFloat(spent.toFixed(2)),
                  leads,
                  engagements: el.totalEngagements || 0,
                  ctr: impressions > 0 ? parseFloat(((clicks / impressions) * 100).toFixed(2)) : 0,
                  cpc: clicks > 0 ? parseFloat((spent / clicks).toFixed(2)) : 0,
                  cpm: impressions > 0 ? parseFloat(((spent / impressions) * 1000).toFixed(2)) : 0,
                  costPerLead: leads > 0 ? parseFloat((spent / leads).toFixed(2)) : 0,
                };
              }
              const paging = data.paging;
              if (els.length === 0) hasMore = false;
              else if (paging?.total && (start + els.length) < paging.total) start += els.length;
              else if (!paging?.total && els.length >= pageSize) start += els.length;
              else hasMore = false;
            }
          } catch (e) {
            console.log(`[get_creative_company_breakdown] Creative ${creativeId} error:`, e);
          }
        };

        const concurrency = 5;
        let idx = 0;
        const workers = Array.from({ length: Math.min(concurrency, creativeIds.length) }, async () => {
          while (idx < creativeIds.length) {
            const myIdx = idx++;
            await fetchOne(creativeIds[myIdx]);
          }
        });
        await Promise.all(workers);

        console.log(`[get_creative_company_breakdown] Complete: ${Object.keys(result).length} companies have creative-level data`);
        return new Response(JSON.stringify({ breakdowns: result }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_company_campaign_breakdown': {
        // Lazy-load campaign-level breakdown for a specific objective's campaigns
        const { accountId, dateRange, campaignIds: objCampaignIds, campaignNames: objCampaignNames } = params || {};
        const startDate = dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const endDate = dateRange?.end || new Date().toISOString().split('T')[0];
        
        const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
        const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
        
        console.log(`[get_company_campaign_breakdown] Starting for ${objCampaignIds?.length || 0} campaigns`);
        
        if (!objCampaignIds || objCampaignIds.length === 0) {
          return new Response(JSON.stringify({ breakdowns: {} }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        // Query each campaign individually with MEMBER_COMPANY pivot, in batches of 5
        const BATCH_SIZE = 5;
        const allResults: Array<{ campaignId: string; elements: any[] }> = [];
        
        for (let i = 0; i < objCampaignIds.length; i += BATCH_SIZE) {
          const batch = objCampaignIds.slice(i, i + BATCH_SIZE);
          const promises = batch.map(async (campaignId: string) => {
            try {
              const url = `https://api.linkedin.com/v2/adAnalyticsV2?q=analytics&` +
                `dateRange.start.day=${startDay}&` +
                `dateRange.start.month=${startMonth}&` +
                `dateRange.start.year=${startYear}&` +
                `dateRange.end.day=${endDay}&` +
                `dateRange.end.month=${endMonth}&` +
                `dateRange.end.year=${endYear}&` +
                `timeGranularity=ALL&` +
                `pivot=MEMBER_COMPANY&` +
                `accounts[0]=urn:li:sponsoredAccount:${accountId}&` +
                `campaigns[0]=urn:li:sponsoredCampaign:${campaignId}&` +
                `fields=impressions,clicks,landingPageClicks,costInLocalCurrency,oneClickLeads,externalWebsiteConversions,totalEngagements,likes,comments,reactions,shares,pivotValue&` +
                `count=10000`;
              
              const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${accessToken}` },
              });
              
              if (!response.ok) return { campaignId, elements: [] };
              const data = await response.json();
              return { campaignId, elements: data.elements || [] };
            } catch (e) {
              return { campaignId, elements: [] };
            }
          });
          
          const results = await Promise.all(promises);
          allResults.push(...results);
        }
        
        console.log(`[get_company_campaign_breakdown] Completed ${allResults.length} campaign queries`);
        
        // Build breakdowns: companyUrn -> [{ campaignId, campaignName, metrics }]
        const breakdowns: Record<string, Array<{ campaignId: string; campaignName: string; impressions: number; clicks: number; landingPageClicks: number; spent: number; leads: number; engagements: number; likes: number; comments: number; reactions: number; shares: number; ctr: number; cpc: number; cpm: number }>> = {};
        const nameMap = objCampaignNames || {};
        
        for (const { campaignId, elements } of allResults) {
          const campName = nameMap[campaignId] || `Campaign ${campaignId}`;
          
          for (const el of elements) {
            const entityUrn = el.pivotValue || '';
            if (!entityUrn) continue;
            
            const impressions = el.impressions || 0;
            const clicks = el.clicks || 0;
            const spent = parseFloat(el.costInLocalCurrency || '0');
            const leads = (el.oneClickLeads || 0) + (el.externalWebsiteConversions || 0);
            const landingPageClicks = el.landingPageClicks || 0;
            const engagements = el.totalEngagements || 0;
            const likes = el.likes || 0;
            const comments = el.comments || 0;
            const reactions = el.reactions || 0;
            const shares = el.shares || 0;
            
            if (impressions === 0 && clicks === 0 && spent === 0 && leads === 0 && engagements === 0 && landingPageClicks === 0) continue;
            
            if (!breakdowns[entityUrn]) breakdowns[entityUrn] = [];
            
            const existing = breakdowns[entityUrn].find(e => e.campaignId === campaignId);
            if (existing) {
              existing.impressions += impressions;
              existing.clicks += clicks;
              existing.spent += spent;
              existing.leads += leads;
              existing.landingPageClicks += landingPageClicks;
              existing.engagements += engagements;
              existing.likes += likes;
              existing.comments += comments;
              existing.reactions += reactions;
              existing.shares += shares;
              existing.ctr = existing.impressions > 0 ? parseFloat(((existing.clicks / existing.impressions) * 100).toFixed(2)) : 0;
              existing.cpc = existing.clicks > 0 ? parseFloat((existing.spent / existing.clicks).toFixed(2)) : 0;
              existing.cpm = existing.impressions > 0 ? parseFloat(((existing.spent / existing.impressions) * 1000).toFixed(2)) : 0;
            } else {
              breakdowns[entityUrn].push({
                campaignId,
                campaignName: campName,
                impressions,
                clicks,
                landingPageClicks,
                spent: parseFloat(spent.toFixed(2)),
                leads,
                engagements,
                likes,
                comments,
                reactions,
                shares,
                ctr: impressions > 0 ? parseFloat(((clicks / impressions) * 100).toFixed(2)) : 0,
                cpc: clicks > 0 ? parseFloat((spent / clicks).toFixed(2)) : 0,
                cpm: impressions > 0 ? parseFloat(((spent / impressions) * 1000).toFixed(2)) : 0,
              });
            }
          }
        }
        
        console.log(`[get_company_campaign_breakdown] Built breakdowns for ${Object.keys(breakdowns).length} companies`);
        
        return new Response(JSON.stringify({ breakdowns }), {
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
        
        // Step 2: Fetch analytics FIRST to know which creatives have data
        console.log('[Step 2] Fetching analytics to identify active creatives...');
        
        const analyticsUrl = `https://api.linkedin.com/v2/adAnalyticsV2?q=analytics&` +
          `dateRange.start.day=${startDay}&` +
          `dateRange.start.month=${startMonth}&` +
          `dateRange.start.year=${startYear}&` +
          `dateRange.end.day=${endDay}&` +
          `dateRange.end.month=${endMonth}&` +
          `dateRange.end.year=${endYear}&` +
          `timeGranularity=${granularity}&` +
          `pivot=CREATIVE&` +
          `accounts[0]=urn:li:sponsoredAccount:${accountId}&` +
          `fields=impressions,clicks,costInLocalCurrency,externalWebsiteConversions,oneClickLeads,oneClickLeadFormOpens,dateRange,pivotValue&` +
          `count=10000`;
        
        console.log(`[Step 2] Analytics URL:`, analyticsUrl);
        
        // Aggregate analytics by creative
        const creativeMetrics = new Map<string, { impressions: number; clicks: number; spent: number; leads: number; lgfFormOpens: number }>();
        const creativeIdsWithData = new Set<string>();
        let totalAnalyticsRows = 0;
        
        try {
          const analyticsResponse = await fetch(analyticsUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });
          
          if (analyticsResponse.ok) {
            const analyticsData = await analyticsResponse.json();
            const elements = analyticsData.elements || [];
            console.log(`[Step 2] Analytics returned ${elements.length} rows`);
            totalAnalyticsRows = elements.length;
            
            for (const element of elements) {
              const pivotValue = element.pivotValue;
              const creativeId = pivotValue?.split(':').pop() || '';
              
              if (!creativeId) continue;
              
              creativeIdsWithData.add(creativeId);
              const existing = creativeMetrics.get(creativeId) || { impressions: 0, clicks: 0, spent: 0, leads: 0, lgfFormOpens: 0 };
              existing.impressions += element.impressions || 0;
              existing.clicks += element.clicks || 0;
              existing.spent += parseFloat(element.costInLocalCurrency || '0');
              existing.leads += (element.oneClickLeads || 0) + (element.externalWebsiteConversions || 0);
              existing.lgfFormOpens += element.oneClickLeadFormOpens || 0;
              creativeMetrics.set(creativeId, existing);
            }
          } else {
            const errorText = await analyticsResponse.text();
            console.error(`[Step 2] Analytics request failed: ${analyticsResponse.status} - ${errorText}`);
          }
        } catch (err) {
          console.error(`[Step 2] Analytics request error:`, err);
        }
        
        console.log(`[Step 2] Found ${creativeIdsWithData.size} creatives with analytics data`);
        
        if (totalAnalyticsRows === 0) {
          console.warn(`[Step 2] WARNING: Analytics API returned zero rows! Date range: ${startDate} to ${endDate}`);
          // Return empty result early
          return new Response(JSON.stringify({
            elements: [],
            metadata: {
              accountId,
              dateRange: { start: startDate, end: endDate },
              timeGranularity: granularity,
              totalCreatives: 0,
              totalAnalyticsRows: 0,
              warning: 'No analytics data found for this date range'
            }
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        
        // Step 3: Fetch creative metadata ONLY for creatives with analytics data
        console.log(`[Step 3] Fetching metadata for ${creativeIdsWithData.size} creatives with data...`);
        
        interface CreativeInfo {
          id: string;
          name: string;
          campaignId: string;
          campaignName: string;
          status: string;
          type: string;
          reference?: string;
          imageUrl?: string;
        }

        const creativeInfoMap = new Map<string, CreativeInfo>();
        const referenceNameCache = new Map<string, string>();
        const referenceImageCache = new Map<string, string>();
        
        // Step 3: Create placeholder entries for all creatives with analytics data
        // (Step 4 will fetch names + references via versioned REST API)
        console.log(`[Step 3] Creating placeholders for ${creativeIdsWithData.size} creatives with data...`);
        
        for (const creativeId of creativeIdsWithData) {
          creativeInfoMap.set(String(creativeId), {
            id: String(creativeId),
            name: '',
            campaignId: '',
            campaignName: 'Unknown Campaign',
            status: 'UNKNOWN',
            type: 'SPONSORED_CONTENT',
            reference: '',
          });
        }
        
        console.log(`[Step 3] Mapped ${creativeInfoMap.size} creatives with analytics`);
        
        // Step 4: Fetch names via versioned API ONLY for creatives with data (much smaller set)
        console.log(`[Step 4] Fetching names for ${creativeInfoMap.size} creatives...`);
        const creativeIdsToFetch = [...creativeInfoMap.keys()];
        
        const nameBatchSize = 10;
        for (let i = 0; i < creativeIdsToFetch.length; i += nameBatchSize) {
          const batch = creativeIdsToFetch.slice(i, i + nameBatchSize);
          
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
                if (existing) {
                  if (creativeDetail.name) existing.name = creativeDetail.name;
                  // Extract campaign info
                  const campaignUrn = creativeDetail.campaign || '';
                  const campaignId = campaignUrn.split(':').pop() || '';
                  if (campaignId) {
                    existing.campaignId = campaignId;
                    existing.campaignName = campaignNames.get(campaignId) || `Campaign ${campaignId}`;
                  }
                  if (creativeDetail.status) existing.status = creativeDetail.status;
                  // Extract reference URN for image resolution
                  const ref = creativeDetail.content?.reference;
                  if (ref) existing.reference = ref;
                  creativeInfoMap.set(creativeId, existing);
                }
              }
            } catch (err) {
              // Silently ignore individual fetch errors
            }
          }));
        }
        
        const namesResolved = [...creativeInfoMap.values()].filter(c => c.name).length;
        console.log(`[Step 4] Resolved ${namesResolved} of ${creativeInfoMap.size} creative names`);
        
        // Step 5: Resolve post text AND images for ALL creatives with references
        const uniqueReferences = new Set<string>();
        for (const [_, info] of creativeInfoMap) {
          if (info.reference) {
            uniqueReferences.add(info.reference);
          }
        }

        console.log(`[Step 5] Resolving ${uniqueReferences.size} unique post references for names + images...`);

        for (const reference of uniqueReferences) {
          try {
            if (reference.includes('ugcPost')) {
              const postId = reference.split(':').pop();
              const postUrl = `https://api.linkedin.com/v2/ugcPosts/${postId}`;
              const postResp = await fetch(postUrl, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
              });
              if (postResp.ok) {
                const post = await postResp.json();
                const shareContent = post.specificContent?.['com.linkedin.ugc.ShareContent'];
                const text = shareContent?.shareCommentary?.text || '';
                if (text.trim()) {
                  referenceNameCache.set(reference, text.replace(/\s+/g, ' ').trim().slice(0, 80));
                }
                // Extract image from media array
                const media = shareContent?.media?.[0];
                if (media) {
                  const imgUrl = media.thumbnails?.[0]?.url || media.thumbnails?.[0]?.resolvedUrl || media.originalUrl || '';
                  if (imgUrl) referenceImageCache.set(reference, imgUrl);
                }
              }
            } else if (reference.includes('share')) {
              const shareId = reference.split(':').pop();
              const shareUrl = `https://api.linkedin.com/v2/shares/${shareId}`;
              const shareResp = await fetch(shareUrl, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
              });
              if (shareResp.ok) {
                const share = await shareResp.json();
                const text = share.text?.text || '';
                if (text.trim()) {
                  referenceNameCache.set(reference, text.replace(/\s+/g, ' ').trim().slice(0, 80));
                }
                // Extract image from content entities
                const contentEntity = share.content?.contentEntities?.[0];
                const imgUrl = contentEntity?.thumbnails?.[0]?.resolvedUrl || contentEntity?.thumbnails?.[0]?.url || '';
                if (imgUrl) referenceImageCache.set(reference, imgUrl);
                }
              }
          } catch (err) {
            // Silently ignore reference fetch errors
          }
        }

        // Apply cached names and images
        for (const [creativeId, info] of creativeInfoMap) {
          if (info.reference) {
            if (!info.name) {
              const cachedName = referenceNameCache.get(info.reference);
              if (cachedName) {
                info.name = cachedName;
              }
            }
            const cachedImage = referenceImageCache.get(info.reference);
            if (cachedImage) {
              info.imageUrl = cachedImage;
            }
            creativeInfoMap.set(creativeId, info);
          }
        }
        const imagesResolved = Array.from(referenceImageCache.values()).filter(v => v).length;
        console.log(`[Image Debug] referenceImageCache size: ${referenceImageCache.size}, images resolved: ${imagesResolved}, creativeInfoMap size: ${creativeInfoMap.size}`);
        
        // Step 5: Build final report
        console.log('[Step 5] Building final report...');
        
        const reportElements: any[] = [];
        
        for (const [creativeId, info] of creativeInfoMap) {
          const metrics = creativeMetrics.get(creativeId) || { impressions: 0, clicks: 0, spent: 0, leads: 0, lgfFormOpens: 0 };
          
          const ctr = metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : 0;
          const cpc = metrics.clicks > 0 ? metrics.spent / metrics.clicks : 0;
          const cpm = metrics.impressions > 0 ? (metrics.spent / metrics.impressions) * 1000 : 0;
          const costPerLead = metrics.leads > 0 ? metrics.spent / metrics.leads : 0;
          const lgfCompletionRate = metrics.lgfFormOpens > 0 ? (metrics.leads / metrics.lgfFormOpens) * 100 : 0;
          
          const imageUrl = info.reference ? (referenceImageCache.get(info.reference) || '') : '';
          
          reportElements.push({
            creativeId,
            creativeName: info.name || 'Sponsored Image Ad',
            campaignName: info.campaignName,
            status: info.status,
            type: info.type,
            imageUrl: imageUrl || undefined,
            impressions: metrics.impressions,
            clicks: metrics.clicks,
            spent: metrics.spent.toFixed(2),
            leads: metrics.leads,
            lgfFormOpens: metrics.lgfFormOpens,
            lgfCompletionRate: lgfCompletionRate.toFixed(2),
            ctr: ctr.toFixed(2),
            cpc: cpc.toFixed(2),
            cpm: cpm.toFixed(2),
            costPerLead: costPerLead.toFixed(2),
          });
        }
        
        // Sort by impressions descending
        reportElements.sort((a, b) => b.impressions - a.impressions);
        
        console.log(`[get_creative_names_report] Complete. Total creatives: ${reportElements.length}, Analytics rows: ${totalAnalyticsRows}`);
        
        // Build response with warning if no analytics data
        const response: any = {
          elements: reportElements,
          metadata: {
            accountId,
            dateRange: { start: startDate, end: endDate },
            timeGranularity: granularity,
            totalCreatives: reportElements.length,
            totalAnalyticsRows,
          }
        };
        
        if (totalAnalyticsRows === 0) {
          response.warning = `Analytics API returned zero rows for date range ${startDate} to ${endDate}. This may indicate no ad activity during this period.`;
        }
        
        return new Response(JSON.stringify(response), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_creative_performance_report': {
        // Batched multi-period creative report: fetches metadata ONCE, analytics for multiple date ranges in parallel
        const { accountId, dateRanges } = params || {};
        if (!accountId || !dateRanges || !Array.isArray(dateRanges)) {
          return new Response(JSON.stringify({ error: 'accountId and dateRanges[] required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        console.log(`[get_creative_performance_report] Starting for account ${accountId}, ${dateRanges.length} periods`);

        // Step 1: Fetch ALL campaigns (paginated) - store name + status + type
        const cpCampaignNames = new Map<string, string>();
        const cpCampaignStatuses = new Map<string, string>();
        const cpCampaignTypes = new Map<string, string>();
        try {
          let cpCampStart = 0;
          let cpCampTotal = 0;
          do {
            const cpCampaignsUrl = `https://api.linkedin.com/rest/adAccounts/${accountId}/adCampaigns?q=search&sortOrder=DESCENDING&count=100&start=${cpCampStart}`;
            const cpCampaignsResp = await fetch(cpCampaignsUrl, {
              headers: { 'Authorization': `Bearer ${accessToken}`, 'LinkedIn-Version': '202511', 'X-Restli-Protocol-Version': '2.0.0' },
            });
            if (cpCampaignsResp.ok) {
              const cpCampaignsData = await cpCampaignsResp.json();
              const elements = cpCampaignsData.elements || [];
              cpCampTotal = cpCampaignsData.paging?.total || elements.length;
              for (const c of elements) {
                const cid = c.id?.toString() || c.$URN?.split(':').pop();
                if (cid) {
                  cpCampaignNames.set(cid, c.name || `Campaign ${cid}`);
                  // Normalize status to uppercase
                  const rawStatus = c.status || c.runSchedule?.status || 'UNKNOWN';
                  cpCampaignStatuses.set(cid, String(rawStatus).toUpperCase());
                  // Capture campaign type for creative type detection
                  if (c.type) cpCampaignTypes.set(cid, String(c.type).toUpperCase());
                }
              }
              cpCampStart += elements.length;
              if (elements.length === 0) break;
            } else { break; }
          } while (cpCampStart < cpCampTotal);
          console.log(`[Step 1] Fetched ${cpCampaignNames.size} campaigns, campaign types:`, Object.fromEntries([...cpCampaignTypes.entries()].slice(0, 10)));
        } catch (e) { console.error('[Step 1] campaign fetch error', e); }

        // Step 2: Run analytics for ALL periods in parallel
        const periodResults = await Promise.all(dateRanges.map(async (range: { start: string; end: string; key: string }) => {
          const [sY, sM, sD] = range.start.split('-').map(Number);
          const [eY, eM, eD] = range.end.split('-').map(Number);
          const url = `https://api.linkedin.com/v2/adAnalyticsV2?q=analytics&dateRange.start.day=${sD}&dateRange.start.month=${sM}&dateRange.start.year=${sY}&dateRange.end.day=${eD}&dateRange.end.month=${eM}&dateRange.end.year=${eY}&timeGranularity=ALL&pivot=CREATIVE&accounts[0]=urn:li:sponsoredAccount:${accountId}&fields=impressions,clicks,costInLocalCurrency,externalWebsiteConversions,oneClickLeads,pivotValue&count=10000`;
          try {
            const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } });
            if (resp.ok) {
              const data = await resp.json();
              return { key: range.key, elements: data.elements || [] };
            }
          } catch (e) { /* ignore */ }
          return { key: range.key, elements: [] };
        }));

        // Collect ALL unique creative IDs across all periods
        const allCreativeIds = new Set<string>();
        const periodMetrics = new Map<string, Map<string, { impressions: number; clicks: number; spent: number; leads: number }>>();

        for (const pr of periodResults) {
          const metricsMap = new Map<string, { impressions: number; clicks: number; spent: number; leads: number }>();
          for (const el of pr.elements) {
            const cid = el.pivotValue?.split(':').pop() || '';
            if (!cid) continue;
            allCreativeIds.add(cid);
            const ex = metricsMap.get(cid) || { impressions: 0, clicks: 0, spent: 0, leads: 0 };
            ex.impressions += el.impressions || 0;
            ex.clicks += el.clicks || 0;
            ex.spent += parseFloat(el.costInLocalCurrency || '0');
            ex.leads += (el.oneClickLeads || 0) + (el.externalWebsiteConversions || 0);
            metricsMap.set(cid, ex);
          }
          periodMetrics.set(pr.key, metricsMap);
        }

        console.log(`[Step 2] Found ${allCreativeIds.size} unique creatives across all periods`);

        if (allCreativeIds.size === 0) {
          return new Response(JSON.stringify({ periods: dateRanges.map((r: any) => r.key), elements: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Step 3: Fetch creative metadata ONCE for all creatives (large parallel batches)
        interface CPCreativeInfo { name: string; campaignId: string; campaignName: string; campaignStatus: string; creativeStatus: string; type: string; reference?: string; imageUrl?: string; }
        const cpCreativeInfo = new Map<string, CPCreativeInfo>();
        const cpRefImageCache = new Map<string, string>();
        const cpCreativeImageUrns = new Map<string, string[]>(); // creativeId -> image URNs for batch resolution

        const cpIds = [...allCreativeIds];
        // Fire ALL creative metadata fetches in parallel (max 50 concurrent)
        const cpBatchSize = 50;
        for (let i = 0; i < cpIds.length; i += cpBatchSize) {
          const batch = cpIds.slice(i, i + cpBatchSize);
          await Promise.all(batch.map(async (creativeId) => {
            try {
              const urn = encodeURIComponent(`urn:li:sponsoredCreative:${creativeId}`);
              const url = `https://api.linkedin.com/rest/adAccounts/${accountId}/creatives/${urn}`;
              const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}`, 'LinkedIn-Version': '202511', 'X-Restli-Protocol-Version': '2.0.0' } });
              if (resp.ok) {
                const d = await resp.json();
                const campId = (d.campaign || '').split(':').pop() || '';
                const creativeStatus = String(d.status || d.servingStatus || 'UNKNOWN').toUpperCase();
                
                // Detect creative type from campaign type (reliable) + content hints
                const campaignType = cpCampaignTypes.get(campId) || '';
                const content = d.content || {};
                const ref = (typeof content === 'string' ? content : content.reference) || '';
                let creativeType = 'SPONSORED_CONTENT';
                let imageUrl = '';

                // Extract image URL directly from creative detail content first
                // (most reliable for sponsored creatives)
                if (content && typeof content === 'object') {
                  imageUrl = content.media?.downloadUrl || '';

                  if (!imageUrl && content.landingPage?.landingPageMedia?.thumbnail) {
                    imageUrl = content.landingPage.landingPageMedia.thumbnail;
                  }

                  if (!imageUrl && content.spotlight?.logo?.downloadUrl) {
                    imageUrl = content.spotlight.logo.downloadUrl;
                  }

                  if (!imageUrl && content.followCompany?.logo?.downloadUrl) {
                    imageUrl = content.followCompany.logo.downloadUrl;
                  }

                  if (!imageUrl && Array.isArray(content.mediaContent) && content.mediaContent[0]) {
                    imageUrl = content.mediaContent[0]?.media?.downloadUrl || content.mediaContent[0]?.downloadUrl || '';
                  }
                  // If no direct URL, collect image URNs for batch resolution
                  if (!imageUrl && content && typeof content === 'object') {
                    const urns = extractImageUrns(content);
                    if (urns.length > 0) {
                      cpCreativeImageUrns.set(creativeId, urns);
                    }
                  }
                }

                if (campaignType === 'TEXT_AD') {
                  creativeType = 'TEXT_AD';
                } else if (campaignType === 'SPONSORED_INMAILS' || campaignType === 'SPONSORED_MESSAGING') {
                  creativeType = 'MESSAGE_AD';
                } else if (campaignType === 'DYNAMIC') {
                  // Dynamic ads do have content sub-fields
                  if (content.followerAd) creativeType = 'FOLLOWER_AD';
                  else if (content.jobsAd) creativeType = 'JOBS_AD';
                  else creativeType = 'SPOTLIGHT_AD';
                } else if (campaignType === 'SPONSORED_UPDATES' || campaignType === 'SPONSORED_STATUS_UPDATE' || !campaignType) {
                  // Use content reference to distinguish sub-types
                  if (ref.includes('video') || ref.includes('ugcVideo')) {
                    creativeType = 'VIDEO';
                  } else if (content.carouselCards || content.carouselAd || (Array.isArray(content.mediaContent) && content.mediaContent.length > 1)) {
                    creativeType = 'CAROUSEL';
                  } else if (ref.includes('document')) {
                    creativeType = 'DOCUMENT_AD';
                  } else {
                    creativeType = 'SPONSORED_CONTENT';
                  }
                } else {
                  // Fallback: map any other campaign type directly if recognized
                  const directTypes = ['VIDEO_AD', 'CAROUSEL_AD', 'SPOTLIGHT_AD', 'FOLLOWER_AD', 'JOBS_AD'];
                  if (directTypes.includes(campaignType)) {
                    creativeType = campaignType;
                  }
                }

                cpCreativeInfo.set(creativeId, {
                  name: d.name || '',
                  campaignId: campId,
                  campaignName: cpCampaignNames.get(campId) || `Campaign ${campId}`,
                  campaignStatus: cpCampaignStatuses.get(campId) || 'UNKNOWN',
                  creativeStatus,
                  type: creativeType,
                  reference: content.reference || undefined,
                  imageUrl: imageUrl || undefined,
                });
              } else { await resp.text(); }
            } catch (e) { /* ignore */ }
          }));
        }

        // Log type distribution for debugging
        const typeDistribution: Record<string, number> = {};
        for (const [, info] of cpCreativeInfo) {
          typeDistribution[info.type] = (typeDistribution[info.type] || 0) + 1;
        }
        console.log(`[Step 3] Creative type distribution:`, JSON.stringify(typeDistribution));

        // Step 3b: Batch resolve image URNs for creatives without direct URLs
        if (cpCreativeImageUrns.size > 0) {
          const allCpUrns = new Set<string>();
          for (const urns of cpCreativeImageUrns.values()) {
            for (const u of urns) allCpUrns.add(u);
          }
          console.log(`[Step 3b] Resolving ${allCpUrns.size} unique image URNs via /rest/images...`);
          const cpResolvedUrls = await resolveImageUrnsBatch([...allCpUrns], accessToken);
          
          let cpResolvedCount = 0;
          for (const [cid, urns] of cpCreativeImageUrns) {
            const info = cpCreativeInfo.get(cid);
            if (info && !info.imageUrl) {
              for (const urn of urns) {
                const url = cpResolvedUrls.get(urn);
                if (url) {
                  info.imageUrl = url;
                  cpResolvedCount++;
                  break;
                }
              }
            }
          }
          console.log(`[Step 3b] Applied ${cpResolvedCount} resolved image URLs from URNs`);
        }

        // Step 4: Resolve references for images/names in parallel
        const cpUniqueRefs = new Set<string>();
        for (const [, info] of cpCreativeInfo) {
          if (info.reference) cpUniqueRefs.add(info.reference);
        }

        const cpRefNameCache = new Map<string, string>();
        const refArray = [...cpUniqueRefs];
        const refBatchSize = 30;
        for (let i = 0; i < refArray.length; i += refBatchSize) {
          const batch = refArray.slice(i, i + refBatchSize);
          await Promise.all(batch.map(async (reference) => {
            try {
              if (reference.includes('ugcPost')) {
                const pid = reference.split(':').pop();
                const resp = await fetch(`https://api.linkedin.com/v2/ugcPosts/${pid}`, { headers: { 'Authorization': `Bearer ${accessToken}` } });
                if (resp.ok) {
                  const post = await resp.json();
                  const sc = post.specificContent?.['com.linkedin.ugc.ShareContent'];
                  const txt = sc?.shareCommentary?.text || '';
                  if (txt.trim()) cpRefNameCache.set(reference, txt.replace(/\s+/g, ' ').trim().slice(0, 80));
                  const media = sc?.media?.[0];
                  if (media) {
                    const img = media.thumbnails?.[0]?.url || media.thumbnails?.[0]?.resolvedUrl || media.originalUrl || '';
                    if (img) cpRefImageCache.set(reference, img);
                  }
                } else { await resp.text(); }
              } else if (reference.includes('share')) {
                const sid = reference.split(':').pop();
                const resp = await fetch(`https://api.linkedin.com/v2/shares/${sid}`, { headers: { 'Authorization': `Bearer ${accessToken}` } });
                if (resp.ok) {
                  const share = await resp.json();
                  const txt = share.text?.text || '';
                  if (txt.trim()) cpRefNameCache.set(reference, txt.replace(/\s+/g, ' ').trim().slice(0, 80));
                  const ce = share.content?.contentEntities?.[0];
                  const img = ce?.thumbnails?.[0]?.resolvedUrl || ce?.thumbnails?.[0]?.url || '';
                  if (img) cpRefImageCache.set(reference, img);
                } else { await resp.text(); }
              }
            } catch (e) { /* ignore */ }
          }));
        }

        // Apply cached names/images
        for (const [, info] of cpCreativeInfo) {
          if (info.reference) {
            if (!info.name) info.name = cpRefNameCache.get(info.reference) || '';
            if (!info.imageUrl) info.imageUrl = cpRefImageCache.get(info.reference) || undefined;
          }
        }

        // Step 5: Build merged elements - one per creative with all period metrics
        const cpElements: any[] = [];
        for (const creativeId of allCreativeIds) {
          const info = cpCreativeInfo.get(creativeId);
          const campaignNames2 = new Set<string>();
          const periodData: Record<string, any> = {};

          for (const pr of periodResults) {
            const m = periodMetrics.get(pr.key)?.get(creativeId);
            if (m) {
              campaignNames2.add(info?.campaignName || '');
              periodData[pr.key] = {
                impressions: m.impressions,
                clicks: m.clicks,
                spent: m.spent,
                leads: m.leads,
                costInLocalCurrency: m.spent.toFixed(2),
              };
            }
          }

          cpElements.push({
            creativeId,
            creativeName: info?.name || `Creative ${creativeId}`,
            campaignId: info?.campaignId || '',
            campaignName: info?.campaignName || 'Unknown',
            campaignStatus: info?.campaignStatus || 'UNKNOWN',
            creativeStatus: info?.creativeStatus || 'UNKNOWN',
            type: info?.type || 'UNKNOWN',
            imageUrl: info?.imageUrl || undefined,
            periods: periodData,
          });
        }

        console.log(`[get_creative_performance_report] Complete. ${cpElements.length} creatives, ${dateRanges.length} periods`);

        return new Response(JSON.stringify({ periods: dateRanges.map((r: any) => r.key), elements: cpElements }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_campaign_performance_report': {
        // Multi-period campaign trend report: fetches campaign metadata ONCE, analytics for multiple date ranges in parallel
        // Each campaign row expands to show its individual ad (creative) breakdown
        const { accountId: campPerfAccountId, dateRanges: campPerfDateRanges } = params || {};
        if (!campPerfAccountId || !campPerfDateRanges || !Array.isArray(campPerfDateRanges)) {
          return new Response(JSON.stringify({ error: 'accountId and dateRanges[] required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        console.log(`[get_campaign_performance_report] Starting for account ${campPerfAccountId}, ${campPerfDateRanges.length} periods`);

        // Step 1: Fetch ALL campaigns (paginated) - name, status, objective
        const campPerfCampaigns = new Map<string, { name: string; status: string; objectiveType: string; groupId: string }>();
        try {
          let cpStart = 0; let cpTotal = 0;
          do {
            const url = `https://api.linkedin.com/rest/adAccounts/${campPerfAccountId}/adCampaigns?q=search&sortOrder=DESCENDING&count=100&start=${cpStart}`;
            const r = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}`, 'LinkedIn-Version': '202511', 'X-Restli-Protocol-Version': '2.0.0' } });
            if (r.ok) {
              const d = await r.json();
              const els = d.elements || [];
              cpTotal = d.paging?.total || els.length;
              for (const c of els) {
                const cid = c.id?.toString() || c.$URN?.split(':').pop();
                if (cid) {
                  const groupId = (c.campaignGroup || '').split(':').pop() || '';
                  campPerfCampaigns.set(cid, {
                    name: c.name || `Campaign ${cid}`,
                    status: String(c.status || 'UNKNOWN').toUpperCase(),
                    objectiveType: String(c.objectiveType || 'UNKNOWN').toUpperCase(),
                    groupId,
                  });
                }
              }
              cpStart += els.length;
              if (els.length === 0) break;
            } else { break; }
          } while (cpStart < cpTotal);
          console.log(`[get_campaign_performance_report Step 1] Fetched ${campPerfCampaigns.size} campaigns`);
        } catch (e) { console.error('[get_campaign_performance_report Step 1] error', e); }

        // Step 2: Fetch campaign-pivot analytics for all periods in parallel
        const campPerfPeriodResults = await Promise.all(campPerfDateRanges.map(async (range: { start: string; end: string; key: string }) => {
          const [sY, sM, sD] = range.start.split('-').map(Number);
          const [eY, eM, eD] = range.end.split('-').map(Number);
          const url = `https://api.linkedin.com/v2/adAnalyticsV2?q=analytics&dateRange.start.day=${sD}&dateRange.start.month=${sM}&dateRange.start.year=${sY}&dateRange.end.day=${eD}&dateRange.end.month=${eM}&dateRange.end.year=${eY}&timeGranularity=ALL&pivot=CAMPAIGN&accounts[0]=urn:li:sponsoredAccount:${campPerfAccountId}&fields=impressions,clicks,costInLocalCurrency,oneClickLeads,externalWebsiteConversions,pivotValue&count=10000`;
          try {
            const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } });
            if (resp.ok) { const d = await resp.json(); return { key: range.key, elements: d.elements || [] }; }
          } catch (e) { /* ignore */ }
          return { key: range.key, elements: [] };
        }));

        // Step 3: Fetch creative-pivot analytics for all periods (for ad breakdown)
        const campPerfCreativePeriodResults = await Promise.all(campPerfDateRanges.map(async (range: { start: string; end: string; key: string }) => {
          const [sY, sM, sD] = range.start.split('-').map(Number);
          const [eY, eM, eD] = range.end.split('-').map(Number);
          const url = `https://api.linkedin.com/v2/adAnalyticsV2?q=analytics&dateRange.start.day=${sD}&dateRange.start.month=${sM}&dateRange.start.year=${sY}&dateRange.end.day=${eD}&dateRange.end.month=${eM}&dateRange.end.year=${eY}&timeGranularity=ALL&pivot=CREATIVE&accounts[0]=urn:li:sponsoredAccount:${campPerfAccountId}&fields=impressions,clicks,costInLocalCurrency,oneClickLeads,externalWebsiteConversions,pivotValue&count=10000`;
          try {
            const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } });
            if (resp.ok) { const d = await resp.json(); return { key: range.key, elements: d.elements || [] }; }
          } catch (e) { /* ignore */ }
          return { key: range.key, elements: [] };
        }));

        // Build campaign-level metrics map
        const campPerfMetrics = new Map<string, Map<string, { impressions: number; clicks: number; spent: number; leads: number }>>();
        const allCampIds = new Set<string>();
        for (const pr of campPerfPeriodResults) {
          const m = new Map<string, { impressions: number; clicks: number; spent: number; leads: number }>();
          for (const el of pr.elements) {
            const cid = el.pivotValue?.split(':').pop() || '';
            if (!cid) continue;
            allCampIds.add(cid);
            const ex = m.get(cid) || { impressions: 0, clicks: 0, spent: 0, leads: 0 };
            ex.impressions += el.impressions || 0;
            ex.clicks += el.clicks || 0;
            ex.spent += parseFloat(el.costInLocalCurrency || '0');
            ex.leads += (el.oneClickLeads || 0) + (el.externalWebsiteConversions || 0);
            m.set(cid, ex);
          }
          campPerfMetrics.set(pr.key, m);
        }

        // Step 4: Fetch creative metadata for all creatives seen in analytics
        const campCreativeMetrics = new Map<string, Map<string, { impressions: number; clicks: number; spent: number; leads: number }>>();
        const allCreativeIdsForCamp = new Set<string>();
        for (const pr of campPerfCreativePeriodResults) {
          const m = new Map<string, { impressions: number; clicks: number; spent: number; leads: number }>();
          for (const el of pr.elements) {
            const cid = el.pivotValue?.split(':').pop() || '';
            if (!cid) continue;
            allCreativeIdsForCamp.add(cid);
            const ex = m.get(cid) || { impressions: 0, clicks: 0, spent: 0, leads: 0 };
            ex.impressions += el.impressions || 0;
            ex.clicks += el.clicks || 0;
            ex.spent += parseFloat(el.costInLocalCurrency || '0');
            ex.leads += (el.oneClickLeads || 0) + (el.externalWebsiteConversions || 0);
            m.set(cid, ex);
          }
          campCreativeMetrics.set(pr.key, m);
        }

        console.log(`[get_campaign_performance_report Step 3] ${allCreativeIdsForCamp.size} unique creatives`);

        // Fetch creative metadata (name + campaign association) in parallel batches
        const campPerfCreativeInfo = new Map<string, { name: string; campaignId: string; status: string; reference: string }>();
        const cpCreativeIds = [...allCreativeIdsForCamp];
        for (let i = 0; i < cpCreativeIds.length; i += 50) {
          const batch = cpCreativeIds.slice(i, i + 50);
          await Promise.all(batch.map(async (creativeId) => {
            try {
              const urn = encodeURIComponent(`urn:li:sponsoredCreative:${creativeId}`);
              const r = await fetch(`https://api.linkedin.com/rest/adAccounts/${campPerfAccountId}/creatives/${urn}`, {
                headers: { 'Authorization': `Bearer ${accessToken}`, 'LinkedIn-Version': '202511', 'X-Restli-Protocol-Version': '2.0.0' },
              });
              if (r.ok) {
                const d = await r.json();
                const campaignId = (d.campaign || '').split(':').pop() || '';
                let name = d.name || '';
                // Extract reference URN for UGC/share name resolution
                const content = d.content || {};
                const reference = typeof content === 'string' ? content : (content.reference || d.reference || '');
                campPerfCreativeInfo.set(creativeId, { name, campaignId, status: String(d.status || 'UNKNOWN').toUpperCase(), reference: String(reference) });
              }
            } catch (e) { /* ignore */ }
          }));
        }

        // Resolve creative names from UGC posts / shares for any without a direct name
        const campPerfRefNameCache = new Map<string, string>();
        const refsToResolve = new Set<string>();
        for (const [, info] of campPerfCreativeInfo) {
          if (!info.name && info.reference && (info.reference.includes('ugcPost') || info.reference.includes('share'))) {
            refsToResolve.add(info.reference);
          }
        }
        if (refsToResolve.size > 0) {
          await Promise.all([...refsToResolve].slice(0, 80).map(async (ref) => {
            try {
              const isUgc = ref.includes('ugcPost');
              const endpoint = isUgc
                ? `https://api.linkedin.com/v2/ugcPosts/${encodeURIComponent(ref)}`
                : `https://api.linkedin.com/v2/shares/${encodeURIComponent(ref)}`;
              const resp = await fetch(endpoint, { headers: { 'Authorization': `Bearer ${accessToken}` } });
              if (resp.ok) {
                const data = await resp.json();
                let text = '';
                if (isUgc) {
                  text = data.specificContent?.['com.linkedin.ugc.ShareContent']?.shareCommentary?.text || '';
                } else {
                  text = data.text?.text || '';
                }
                if (text.trim()) {
                  campPerfRefNameCache.set(ref, text.replace(/\s+/g, ' ').trim().slice(0, 80));
                }
              }
            } catch (e) { /* ignore */ }
          }));
        }
        // Apply resolved names
        for (const [creativeId, info] of campPerfCreativeInfo) {
          if (!info.name && info.reference) {
            const resolved = campPerfRefNameCache.get(info.reference);
            if (resolved) info.name = resolved;
          }
          if (!info.name) info.name = `Ad ${creativeId}`;
        }

        // Build per-campaign ad breakdown
        const campPerfAdsByCampaign = new Map<string, Array<{ creativeId: string; name: string; status: string; periods: Record<string, any> }>>();
        for (const creativeId of allCreativeIdsForCamp) {
          const info = campPerfCreativeInfo.get(creativeId);
          const campaignId = info?.campaignId || '';
          if (!campaignId) continue;
          if (!campPerfAdsByCampaign.has(campaignId)) campPerfAdsByCampaign.set(campaignId, []);
          const adPeriods: Record<string, any> = {};
          for (const pr of campPerfCreativePeriodResults) {
            const m = campCreativeMetrics.get(pr.key)?.get(creativeId);
            if (m) adPeriods[pr.key] = m;
          }
          campPerfAdsByCampaign.get(campaignId)!.push({
            creativeId,
            name: info?.name || `Ad ${creativeId}`,
            status: info?.status || 'UNKNOWN',
            periods: adPeriods,
          });
        }

        // Step 5: Build final campaign elements
        const campPerfElements: any[] = [];
        for (const campId of allCampIds) {
          const meta = campPerfCampaigns.get(campId);
          const periodData: Record<string, any> = {};
          for (const pr of campPerfPeriodResults) {
            const m = campPerfMetrics.get(pr.key)?.get(campId);
            if (m) periodData[pr.key] = m;
          }
          const ads = campPerfAdsByCampaign.get(campId) || [];
          campPerfElements.push({
            campaignId: campId,
            campaignName: meta?.name || `Campaign ${campId}`,
            campaignStatus: meta?.status || 'UNKNOWN',
            objectiveType: meta?.objectiveType || 'UNKNOWN',
            adCount: ads.length,
            ads,
            periods: periodData,
          });
        }

        console.log(`[get_campaign_performance_report] Complete. ${campPerfElements.length} campaigns`);
        return new Response(JSON.stringify({ periods: campPerfDateRanges.map((r: any) => r.key), elements: campPerfElements }), {
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

      case 'get_campaign_report': {
        // Fetches campaign-level analytics with performance metrics
        const { accountId, dateRange, timeGranularity } = params || {};
        const startDate = dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const endDate = dateRange?.end || new Date().toISOString().split('T')[0];
        const granularity = timeGranularity || 'ALL';
        
        console.log(`[get_campaign_report] Starting for account ${accountId}, date range: ${startDate} to ${endDate}`);
        
        // Step 1: Fetch ALL campaigns with pagination
        const allCampaigns: any[] = [];
        let campaignsStart = 0;
        const campaignsPageSize = 500;
        let hasMoreCampaigns = true;
        
        while (hasMoreCampaigns) {
          const campaignsUrl = `https://api.linkedin.com/v2/adCampaignsV2?q=search&search.account.values[0]=urn:li:sponsoredAccount:${accountId}&count=${campaignsPageSize}&start=${campaignsStart}`;
          const campaignsResponse = await fetch(campaignsUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });
          
          if (!campaignsResponse.ok) {
            const errorText = await campaignsResponse.text();
            console.error(`[get_campaign_report] Campaigns fetch failed:`, errorText);
            return new Response(JSON.stringify({ error: 'Failed to fetch campaigns', details: errorText }), {
              status: campaignsResponse.status,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          const campaignsData = await campaignsResponse.json();
          const pageCampaigns = campaignsData.elements || [];
          allCampaigns.push(...pageCampaigns);
          
          console.log(`[get_campaign_report] Fetched ${pageCampaigns.length} campaigns (total: ${allCampaigns.length})`);
          
          // Check if there are more pages
          if (pageCampaigns.length < campaignsPageSize) {
            hasMoreCampaigns = false;
          } else {
            campaignsStart += campaignsPageSize;
          }
        }
        
        const campaigns = allCampaigns;
        console.log(`[get_campaign_report] Total campaigns fetched: ${campaigns.length}`);
        
        if (campaigns.length === 0) {
          return new Response(JSON.stringify({ 
            elements: [],
            metadata: { accountId, dateRange: { start: startDate, end: endDate } }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Build campaign info map
        const campaignInfoMap = new Map<string, any>();
        for (const campaign of campaigns) {
          const campaignId = campaign.id?.toString() || '';
          campaignInfoMap.set(campaignId, {
            id: campaignId,
            name: campaign.name || `Campaign ${campaignId}`,
            status: campaign.status || 'UNKNOWN',
            type: campaign.type || 'UNKNOWN',
            objectiveType: campaign.objectiveType || 'UNKNOWN',
            costType: campaign.costType || 'UNKNOWN',
            dailyBudget: campaign.dailyBudget,
            totalBudget: campaign.totalBudget,
          });
        }
        
        // Step 2: Fetch analytics with CAMPAIGN pivot using account-level query
        // Use account-level query pattern for Business Manager compatibility
        const startDateObj = new Date(startDate);
        const endDateObj = new Date(endDate);
        
        const analyticsUrl = `https://api.linkedin.com/v2/adAnalyticsV2?q=analytics&` +
          `dateRange.start.day=${startDateObj.getDate()}&` +
          `dateRange.start.month=${startDateObj.getMonth() + 1}&` +
          `dateRange.start.year=${startDateObj.getFullYear()}&` +
          `dateRange.end.day=${endDateObj.getDate()}&` +
          `dateRange.end.month=${endDateObj.getMonth() + 1}&` +
          `dateRange.end.year=${endDateObj.getFullYear()}&` +
          `timeGranularity=${granularity}&` +
          `pivot=CAMPAIGN&` +
          `accounts[0]=urn:li:sponsoredAccount:${accountId}&` +
          `fields=impressions,clicks,costInLocalCurrency,externalWebsiteConversions,oneClickLeads,oneClickLeadFormOpens,pivotValue,dateRange`;
        
        console.log(`[get_campaign_report] Analytics URL (account-level):`, analyticsUrl);
        
        const analyticsResponse = await fetch(analyticsUrl, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        const allAnalytics: any[] = [];
        if (analyticsResponse.ok) {
          const analyticsData = await analyticsResponse.json();
          allAnalytics.push(...(analyticsData.elements || []));
        } else {
          const errText = await analyticsResponse.text();
          console.error(`[get_campaign_report] Analytics fetch failed: ${analyticsResponse.status}`, errText);
        }
        
        console.log(`[get_campaign_report] Fetched ${allAnalytics.length} analytics rows`);
        
        // Step 3: Aggregate metrics - by campaign only for ALL, by campaign+date for DAILY
        if (granularity === 'DAILY') {
          // For DAILY granularity, return raw rows with date info for daily spend analysis
          const dailyElements: any[] = [];
          
          for (const row of allAnalytics) {
            const pivotValue = row.pivotValue || '';
            const campaignId = pivotValue.split(':').pop() || '';
            if (!campaignId) continue;
            
            const info = campaignInfoMap.get(campaignId) || {};
            const spent = parseFloat(row.costInLocalCurrency || '0');
            const isLeadGen = (info.objectiveType === 'LEAD_GENERATION');
            const leads = isLeadGen ? (row.oneClickLeads || 0) + (row.externalWebsiteConversions || 0) : 0;
            
            dailyElements.push({
              campaignId,
              campaignName: info.name || `Campaign ${campaignId}`,
              status: info.status || 'UNKNOWN',
              objectiveType: info.objectiveType || 'UNKNOWN',
              costType: info.costType || 'UNKNOWN',
              dailyBudget: info.dailyBudget,
              totalBudget: info.totalBudget,
              impressions: row.impressions || 0,
              clicks: row.clicks || 0,
              costInLocalCurrency: spent.toFixed(2),
              leads,
              dateRange: row.dateRange, // Include the date range from LinkedIn API
            });
          }
          
          console.log(`[get_campaign_report] DAILY granularity - returning ${dailyElements.length} daily rows`);
          
          return new Response(JSON.stringify({
            elements: dailyElements,
            metadata: {
              accountId,
              dateRange: { start: startDate, end: endDate },
              timeGranularity: granularity,
              totalRows: dailyElements.length,
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // For ALL granularity, aggregate by campaign
        const campaignMetrics = new Map<string, { impressions: number; clicks: number; spent: number; leads: number; lgfFormOpens: number }>();
        
        for (const row of allAnalytics) {
          const pivotValue = row.pivotValue || '';
          const campaignId = pivotValue.split(':').pop() || '';
          if (!campaignId) continue;
          
          const existing = campaignMetrics.get(campaignId) || { impressions: 0, clicks: 0, spent: 0, leads: 0, lgfFormOpens: 0 };
          existing.impressions += row.impressions || 0;
          existing.clicks += row.clicks || 0;
          existing.spent += parseFloat(row.costInLocalCurrency || '0');
          const info = campaignInfoMap.get(campaignId) || {};
          const isLeadGen = (info.objectiveType === 'LEAD_GENERATION');
          existing.leads += isLeadGen ? (row.oneClickLeads || 0) + (row.externalWebsiteConversions || 0) : 0;
          existing.lgfFormOpens += isLeadGen ? (row.oneClickLeadFormOpens || 0) : 0;
          campaignMetrics.set(campaignId, existing);
        }
        
        // Step 4: Build final report
        const reportElements: any[] = [];
        
        for (const [campaignId, info] of campaignInfoMap) {
          const metrics = campaignMetrics.get(campaignId) || { impressions: 0, clicks: 0, spent: 0, leads: 0, lgfFormOpens: 0 };
          
          // Skip campaigns with no data if there's analytics data available
          if (allAnalytics.length > 0 && metrics.impressions === 0 && metrics.spent === 0) continue;
          
          const ctr = metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : 0;
          const cpc = metrics.clicks > 0 ? metrics.spent / metrics.clicks : 0;
          const cpm = metrics.impressions > 0 ? (metrics.spent / metrics.impressions) * 1000 : 0;
          const costPerLead = metrics.leads > 0 ? metrics.spent / metrics.leads : 0;
          const lgfCompletionRate = metrics.lgfFormOpens > 0 ? (metrics.leads / metrics.lgfFormOpens) * 100 : 0;
          
          reportElements.push({
            campaignId,
            campaignName: info.name,
            status: info.status,
            objectiveType: info.objectiveType,
            costType: info.costType,
            dailyBudget: info.dailyBudget,
            totalBudget: info.totalBudget,
            impressions: metrics.impressions,
            clicks: metrics.clicks,
            costInLocalCurrency: metrics.spent.toFixed(2),
            leads: metrics.leads,
            lgfFormOpens: metrics.lgfFormOpens,
            lgfCompletionRate: lgfCompletionRate.toFixed(2),
            ctr: ctr.toFixed(2),
            cpc: cpc.toFixed(2),
            cpm: cpm.toFixed(2),
            costPerLead: costPerLead.toFixed(2),
          });
        }
        
        // Sort by impressions descending
        reportElements.sort((a, b) => b.impressions - a.impressions);
        
        console.log(`[get_campaign_report] Complete. Campaigns with data: ${reportElements.length}`);
        
        return new Response(JSON.stringify({
          elements: reportElements,
          metadata: {
            accountId,
            dateRange: { start: startDate, end: endDate },
            timeGranularity: granularity,
            totalCampaigns: reportElements.length,
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'get_job_seniority_matrix': {
        // Fetches Job Function x Seniority matrix using two separate pivot calls
        // LinkedIn API doesn't support dual pivots in a single call
        const { accountId, dateRange, campaignIds } = params || {};
        const startDate = dateRange?.start || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const endDate = dateRange?.end || new Date().toISOString().split('T')[0];
        
        // Parse date strings directly to avoid timezone issues
        const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
        const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
        
        console.log(`[get_job_seniority_matrix] Starting for account ${accountId}, date range: ${startDate} to ${endDate}`);

        // Build base URL parameters
        const baseParams = 
          `dateRange.start.day=${startDay}&` +
          `dateRange.start.month=${startMonth}&` +
          `dateRange.start.year=${startYear}&` +
          `dateRange.end.day=${endDay}&` +
          `dateRange.end.month=${endMonth}&` +
          `dateRange.end.year=${endYear}&` +
          `timeGranularity=ALL&` +
          `accounts[0]=urn:li:sponsoredAccount:${accountId}&` +
          `fields=impressions,clicks,costInLocalCurrency,externalWebsiteConversions,oneClickLeads,pivotValue&` +
          `count=10000`;
        
        // Add campaign filter if provided
        let campaignParams = '';
        if (campaignIds && campaignIds.length > 0) {
          campaignIds.slice(0, 20).forEach((id: string, idx: number) => {
            campaignParams += `&campaigns[${idx}]=urn:li:sponsoredCampaign:${id}`;
          });
          console.log(`[get_job_seniority_matrix] Filtering by ${Math.min(campaignIds.length, 20)} campaigns`);
        }
        
        // Make two parallel API calls - one for each pivot
        const jobFunctionUrl = `https://api.linkedin.com/v2/adAnalyticsV2?q=analytics&pivot=MEMBER_JOB_FUNCTION&${baseParams}${campaignParams}`;
        const seniorityUrl = `https://api.linkedin.com/v2/adAnalyticsV2?q=analytics&pivot=MEMBER_SENIORITY&${baseParams}${campaignParams}`;
        
        console.log(`[get_job_seniority_matrix] Fetching job function and seniority data in parallel...`);
        
        const [jobFunctionResponse, seniorityResponse] = await Promise.all([
          fetch(jobFunctionUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } }),
          fetch(seniorityUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } })
        ]);
        
        if (!jobFunctionResponse.ok || !seniorityResponse.ok) {
          const errorText = !jobFunctionResponse.ok 
            ? await jobFunctionResponse.text() 
            : await seniorityResponse.text();
          console.error(`[get_job_seniority_matrix] Analytics API error:`, errorText);
          return new Response(JSON.stringify({ 
            error: `LinkedIn API error`,
            elements: []
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const [jobFunctionData, seniorityData] = await Promise.all([
          jobFunctionResponse.json(),
          seniorityResponse.json()
        ]);
        
        console.log(`[get_job_seniority_matrix] Job functions: ${jobFunctionData.elements?.length || 0}, Seniorities: ${seniorityData.elements?.length || 0}`);
        
        // Process job function data - store URNs for drill-down
        const jobFunctionMetrics: Record<string, { impressions: number; clicks: number; spent: number; leads: number; urn: string }> = {};
        let totalImpressions = 0;
        
        for (const row of (jobFunctionData.elements || [])) {
          const pivotValue = row.pivotValue || '';
          const jobFunction = formatPivotValue(pivotValue, 'MEMBER_JOB_FUNCTION');
          
          const impressions = row.impressions || 0;
          const clicks = row.clicks || 0;
          const spent = parseFloat(row.costInLocalCurrency || '0');
          const leads = (row.oneClickLeads || 0) + (row.externalWebsiteConversions || 0);
          
          totalImpressions += impressions;
          jobFunctionMetrics[jobFunction] = { impressions, clicks, spent, leads, urn: pivotValue };
        }
        
        // Process seniority data
        const seniorityMetrics: Record<string, { impressions: number; clicks: number; spent: number; leads: number }> = {};
        
        for (const row of (seniorityData.elements || [])) {
          const pivotValue = row.pivotValue || '';
          const seniority = formatPivotValue(pivotValue, 'MEMBER_SENIORITY');
          
          const impressions = row.impressions || 0;
          const clicks = row.clicks || 0;
          const spent = parseFloat(row.costInLocalCurrency || '0');
          const leads = (row.oneClickLeads || 0) + (row.externalWebsiteConversions || 0);
          
          seniorityMetrics[seniority] = { impressions, clicks, spent, leads };
        }
        
        // Create matrix by distributing proportionally
        // This is an approximation since we can't get true cross-tabulated data
        const matrixElements: any[] = [];
        const jobFunctions = Object.keys(jobFunctionMetrics);
        const seniorities = Object.keys(seniorityMetrics);
        
        for (const jobFunction of jobFunctions) {
          const jfMetrics = jobFunctionMetrics[jobFunction];
          const jfProportion = totalImpressions > 0 ? jfMetrics.impressions / totalImpressions : 0;
          
          for (const seniority of seniorities) {
            const sMetrics = seniorityMetrics[seniority];
            
            // Approximate cell values using proportional distribution
            const impressions = Math.round(sMetrics.impressions * jfProportion);
            const clicks = Math.round(sMetrics.clicks * jfProportion);
            const spent = sMetrics.spent * jfProportion;
            const leads = Math.round(sMetrics.leads * jfProportion);
            
            // Only add cells with some data
            if (impressions > 0 || spent > 0) {
              const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
              const cpc = clicks > 0 ? spent / clicks : 0;
              const cpm = impressions > 0 ? (spent / impressions) * 1000 : 0;
              const cpl = leads > 0 ? spent / leads : 0;
              
              matrixElements.push({
                jobFunction,
                jobFunctionUrn: jfMetrics.urn,
                seniority,
                impressions,
                clicks,
                spent: spent.toFixed(2),
                leads,
                ctr: ctr.toFixed(2),
                cpc: cpc.toFixed(2),
                cpm: cpm.toFixed(2),
                cpl: cpl.toFixed(2),
              });
            }
          }
        }
        
        console.log(`[get_job_seniority_matrix] Complete. Matrix cells: ${matrixElements.length}`);
        
        return new Response(JSON.stringify({
          elements: matrixElements,
          metadata: {
            accountId,
            dateRange: { start: startDate, end: endDate },
            totalCells: matrixElements.length,
            note: 'Matrix values are proportionally estimated from separate job function and seniority data'
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'get_job_titles_index': {
        // Fetches ALL job titles with metrics using stable single-pivot endpoint
        // Then resolves title IDs to human-readable names via Standardized Titles API
        const { accountId, dateRange, campaignIds } = params || {};
        const startDate = dateRange?.start || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const endDate = dateRange?.end || new Date().toISOString().split('T')[0];
        
        // Parse date strings directly to avoid timezone issues
        const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
        const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
        
        console.log(`[get_job_titles_index] Starting for account ${accountId}, date range: ${startDate} to ${endDate}`);

        // Build stable /v2/adAnalyticsV2 URL with single MEMBER_JOB_TITLE pivot
        let analyticsUrl = `https://api.linkedin.com/v2/adAnalyticsV2?q=analytics&` +
          `pivot=MEMBER_JOB_TITLE&timeGranularity=ALL&` +
          `dateRange.start.day=${startDay}&` +
          `dateRange.start.month=${startMonth}&` +
          `dateRange.start.year=${startYear}&` +
          `dateRange.end.day=${endDay}&` +
          `dateRange.end.month=${endMonth}&` +
          `dateRange.end.year=${endYear}&` +
          `accounts[0]=urn:li:sponsoredAccount:${accountId}&` +
          `fields=impressions,clicks,costInLocalCurrency,externalWebsiteConversions,oneClickLeads,pivotValue&` +
          `count=10000`;
        
        // Add campaign filter if provided
        if (campaignIds?.length) {
          campaignIds.slice(0, 20).forEach((id: string, i: number) => {
            analyticsUrl += `&campaigns[${i}]=urn:li:sponsoredCampaign:${id}`;
          });
        }
        
        console.log(`[get_job_titles_index] Fetching job titles...`);
        const analyticsResponse = await fetch(analyticsUrl, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        
        if (!analyticsResponse.ok) {
          const errorText = await analyticsResponse.text();
          console.error(`[get_job_titles_index] Analytics API error (${analyticsResponse.status}): ${errorText}`);
          return new Response(JSON.stringify({ 
            error: `LinkedIn API error: ${analyticsResponse.status}`,
            status: analyticsResponse.status,
            details: errorText,
            titles: []
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const analyticsData = await analyticsResponse.json();
        console.log(`[get_job_titles_index] Received ${analyticsData.elements?.length || 0} title rows`);
        
        // Extract title IDs from pivot values
        // Format: urn:li:title:12345 -> 12345
        const extractTitleId = (pivotValue: string): string => {
          if (!pivotValue) return '';
          if (pivotValue.startsWith('urn:li:title:')) {
            return pivotValue.split(':').pop() || '';
          }
          return pivotValue;
        };
        
        // Build map of titleId -> metrics
        const titleMetrics: Record<string, any> = {};
        const titleIds: string[] = [];
        
        for (const row of (analyticsData.elements || [])) {
          const titleUrn = row.pivotValue || '';
          const titleId = extractTitleId(titleUrn);
          if (!titleId) continue;
          
          const impressions = row.impressions || 0;
          const clicks = row.clicks || 0;
          const spent = Number(row.costInLocalCurrency || 0);
          const leads = (row.oneClickLeads || 0) + (row.externalWebsiteConversions || 0);
          
          // Skip rows with no activity
          if (impressions === 0 && spent === 0) continue;
          
          const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
          const cpc = clicks > 0 ? spent / clicks : 0;
          const cpm = impressions > 0 ? (spent / impressions) * 1000 : 0;
          const cpl = leads > 0 ? spent / leads : 0;
          
          titleMetrics[titleId] = {
            titleId,
            titleUrn,
            impressions,
            clicks,
            spent,
            leads,
            ctr,
            cpc,
            cpm,
            cpl,
          };
          titleIds.push(titleId);
        }
        
        console.log(`[get_job_titles_index] Found ${titleIds.length} title IDs with activity`);
        
        if (titleIds.length === 0) {
          return new Response(JSON.stringify({
            titles: [],
            metadata: {
              accountId,
              dateRange: { start: startDate, end: endDate },
              totalTitles: 0,
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Check DB cache for resolved title metadata
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
        
        // Check cache for existing metadata (TTL: 30 days)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data: cachedMetadata, error: cacheError } = await supabaseAdmin
          .from('title_metadata_cache')
          .select('*')
          .in('title_id', titleIds)
          .gte('updated_at', thirtyDaysAgo);
        
        if (cacheError) {
          console.error(`[get_job_titles_index] Cache lookup error:`, cacheError);
        }
        
        const cachedMap = new Map<string, any>();
        for (const row of (cachedMetadata || [])) {
          cachedMap.set(row.title_id, row);
        }
        console.log(`[get_job_titles_index] Found ${cachedMap.size} cached title metadata entries`);
        
        // Find title IDs that need resolution
        const uncachedIds = titleIds.filter(id => !cachedMap.has(id));
        console.log(`[get_job_titles_index] Need to resolve ${uncachedIds.length} title IDs`);
        
        // Resolve uncached titles via LinkedIn Standardized Titles API
        const newMetadata: any[] = [];
        
        if (uncachedIds.length > 0) {
          // Process in batches of 50
          const batchSize = 50;
          
          for (let i = 0; i < uncachedIds.length; i += batchSize) {
            const batchIds = uncachedIds.slice(i, i + batchSize);
            
            // Build batch request URL for Standardized Titles API
            // GET https://api.linkedin.com/v2/standardizedTitles?ids=List(123,456,789)
            const idsParam = `ids=List(${batchIds.join(',')})`;
            const titlesApiUrl = `https://api.linkedin.com/v2/standardizedTitles?${idsParam}`;
            
            console.log(`[get_job_titles_index] Fetching batch ${Math.floor(i/batchSize) + 1}, ${batchIds.length} titles`);
            
            try {
              const titlesResponse = await fetch(titlesApiUrl, {
                headers: { 
                  'Authorization': `Bearer ${accessToken}`,
                  'X-Restli-Protocol-Version': '2.0.0',
                },
              });
              
              if (titlesResponse.status === 403) {
                console.error(`[get_job_titles_index] Titles API access denied (403)`);
                // Return what we have with an error flag
                return new Response(JSON.stringify({
                  error: 'Titles API access required to resolve job title IDs to names. Please ensure your LinkedIn app has the required permissions.',
                  titles: [],
                  requiresTitlesApiAccess: true,
                }), {
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
              }
              
              if (!titlesResponse.ok) {
                const errorText = await titlesResponse.text();
                console.error(`[get_job_titles_index] Titles API error (${titlesResponse.status}): ${errorText}`);
                // Continue with cached data only
                continue;
              }
              
              const titlesData = await titlesResponse.json();
              const results = titlesData.results || {};
              
              // Process each resolved title
              for (const [titleId, titleInfo] of Object.entries(results)) {
                if (!titleInfo) continue;
                const info = titleInfo as any;
                
                // Extract name and function URN
                const name = info.name?.localized?.en_US || info.name?.preferredLocale?.name || `Title ${titleId}`;
                const functionUrn = info.jobFunction || null;
                const superTitleUrn = info.superTitle || null;
                
                cachedMap.set(titleId, {
                  title_id: titleId,
                  name,
                  function_urn: functionUrn,
                  super_title_urn: superTitleUrn,
                });
                
                newMetadata.push({
                  title_id: titleId,
                  name,
                  function_urn: functionUrn,
                  super_title_urn: superTitleUrn,
                });
              }
            } catch (fetchError) {
              console.error(`[get_job_titles_index] Titles API fetch error:`, fetchError);
              // Continue with cached data only
            }
          }
          
          // Cache new metadata
          if (newMetadata.length > 0) {
            console.log(`[get_job_titles_index] Caching ${newMetadata.length} new title metadata entries`);
            const { error: insertError } = await supabaseAdmin
              .from('title_metadata_cache')
              .upsert(newMetadata, { onConflict: 'title_id' });
            
            if (insertError) {
              console.error(`[get_job_titles_index] Cache insert error:`, insertError);
            }
          }
        }
        
        // Build final titles array with resolved names and metrics
        const titles = titleIds.map(titleId => {
          const metrics = titleMetrics[titleId];
          const metadata = cachedMap.get(titleId);
          
          return {
            titleId,
            title: metadata?.name || `Title ID: ${titleId}`,
            functionUrn: metadata?.function_urn || null,
            superTitleUrn: metadata?.super_title_urn || null,
            impressions: metrics.impressions,
            clicks: metrics.clicks,
            spent: metrics.spent,
            leads: metrics.leads,
            ctr: metrics.ctr,
            cpc: metrics.cpc,
            cpm: metrics.cpm,
            cpl: metrics.cpl,
          };
        }).filter((t: any) => t.impressions > 0 || t.spent > 0);
        
        // Sort by impressions descending
        titles.sort((a: any, b: any) => b.impressions - a.impressions);
        
        // Count how many have resolved names vs fallback
        const resolvedCount = titles.filter(t => !t.title.startsWith('Title ID:')).length;
        console.log(`[get_job_titles_index] Complete. ${titles.length} titles, ${resolvedCount} with resolved names`);
        
        return new Response(JSON.stringify({
          titles,
          metadata: {
            accountId,
            dateRange: { start: startDate, end: endDate },
            totalTitles: titles.length,
            resolvedTitles: resolvedCount,
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'resolve_titles_to_functions': {
        // Maps job titles to job functions using DB cache + rules classifier
        const { titles } = params || {};
        
        if (!titles || !Array.isArray(titles) || titles.length === 0) {
          return new Response(JSON.stringify({ mappings: {} }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        console.log(`[resolve_titles_to_functions] Resolving ${titles.length} titles`);
        
        // Helper: Normalize title for consistent matching
        const normalizeTitle = (title: string): string => {
          return title.toLowerCase().trim().replace(/\s+/g, ' ');
        };
        
        // Job function keywords for rules-based classification
        const FUNCTION_KEYWORDS: Record<string, { id: string; keywords: string[] }> = {
          'Accounting': { id: '1', keywords: ['accountant', 'accounting', 'bookkeeper', 'auditor', 'cpa', 'controller', 'accounts payable', 'accounts receivable'] },
          'Administrative': { id: '2', keywords: ['administrative', 'admin', 'secretary', 'receptionist', 'office manager', 'executive assistant', 'office coordinator'] },
          'Arts and Design': { id: '3', keywords: ['designer', 'artist', 'creative director', 'ux', 'ui', 'graphic', 'illustrator', 'art director', 'visual designer'] },
          'Business Development': { id: '4', keywords: ['business development', 'bd', 'partnerships', 'strategic partnerships', 'alliance'] },
          'Community & Social Services': { id: '5', keywords: ['social worker', 'community', 'nonprofit', 'counselor', 'case manager', 'outreach'] },
          'Consulting': { id: '6', keywords: ['consultant', 'consulting', 'advisor', 'advisory'] },
          'Education': { id: '7', keywords: ['teacher', 'professor', 'instructor', 'educator', 'tutor', 'academic', 'dean', 'principal'] },
          'Engineering': { id: '8', keywords: ['engineer', 'developer', 'architect', 'devops', 'sre', 'software', 'backend', 'frontend', 'fullstack', 'qa engineer', 'test engineer', 'data engineer', 'ml engineer', 'platform engineer'] },
          'Entrepreneurship': { id: '9', keywords: ['founder', 'co-founder', 'entrepreneur', 'startup'] },
          'Finance': { id: '10', keywords: ['finance', 'financial', 'analyst', 'investment', 'portfolio', 'treasury', 'risk', 'cfo', 'financial analyst'] },
          'Healthcare Services': { id: '11', keywords: ['nurse', 'doctor', 'physician', 'medical', 'healthcare', 'clinical', 'therapist', 'pharmacist', 'surgeon'] },
          'Human Resources': { id: '12', keywords: ['hr', 'human resources', 'recruiter', 'talent', 'people operations', 'hrbp', 'benefits', 'compensation', 'learning and development'] },
          'Information Technology': { id: '13', keywords: ['it', 'information technology', 'system administrator', 'network', 'helpdesk', 'support engineer', 'infrastructure', 'security analyst', 'cybersecurity'] },
          'Legal': { id: '14', keywords: ['lawyer', 'attorney', 'legal', 'paralegal', 'counsel', 'compliance', 'contracts'] },
          'Marketing': { id: '15', keywords: ['marketing', 'growth', 'brand', 'content', 'seo', 'demand gen', 'digital marketing', 'social media', 'performance marketing', 'cmo', 'marketing manager'] },
          'Media & Communications': { id: '16', keywords: ['journalist', 'writer', 'editor', 'communications', 'pr', 'public relations', 'media', 'copywriter'] },
          'Military & Protective Services': { id: '17', keywords: ['military', 'police', 'security', 'veteran', 'officer', 'guard'] },
          'Operations': { id: '18', keywords: ['operations', 'ops', 'logistics', 'supply chain', 'warehouse', 'fulfillment', 'coo', 'operations manager'] },
          'Product Management': { id: '19', keywords: ['product manager', 'product owner', 'product lead', 'head of product', 'vp product', 'cpo', 'product director'] },
          'Program & Project Management': { id: '20', keywords: ['project manager', 'program manager', 'scrum master', 'pmo', 'delivery manager', 'agile coach'] },
          'Purchasing': { id: '21', keywords: ['purchasing', 'procurement', 'buyer', 'sourcing', 'vendor management'] },
          'Quality Assurance': { id: '22', keywords: ['quality assurance', 'qa', 'quality control', 'qc', 'testing', 'test engineer', 'quality manager'] },
          'Real Estate': { id: '23', keywords: ['real estate', 'realtor', 'broker', 'property manager', 'leasing'] },
          'Research': { id: '24', keywords: ['researcher', 'research', 'scientist', 'r&d', 'lab', 'phd', 'postdoc'] },
          'Sales': { id: '25', keywords: ['sales', 'account executive', 'sdr', 'bdr', 'business development rep', 'closer', 'sales manager', 'ae', 'account manager', 'sales director', 'vp sales'] },
          'Support': { id: '26', keywords: ['support', 'customer success', 'customer service', 'help desk', 'technical support', 'customer experience'] },
        };
        
        // Rules classifier
        const classifyTitle = (title: string): { functionId: string; functionLabel: string; confidence: number } => {
          const lower = title.toLowerCase();
          const scores: Record<string, number> = {};
          
          for (const [func, config] of Object.entries(FUNCTION_KEYWORDS)) {
            let score = 0;
            for (const kw of config.keywords) {
              if (lower.includes(kw)) {
                // Longer keywords get higher score
                score += kw.length / 5;
              }
            }
            if (score > 0) scores[func] = score;
          }
          
          const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
          if (sorted.length === 0) {
            return { functionId: '0', functionLabel: 'Unknown', confidence: 0 };
          }
          
          const [bestFunc, bestScore] = sorted[0];
          const confidence = Math.min(bestScore / 3, 1);
          
          return {
            functionId: FUNCTION_KEYWORDS[bestFunc].id,
            functionLabel: bestFunc,
            confidence: Math.round(confidence * 100) / 100,
          };
        };
        
        // Normalize all titles
        const normalizedTitles = titles.map((t: string) => normalizeTitle(t));
        
        // Check DB cache for existing mappings (use service role for insert/select)
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
        
        const { data: cachedData, error: cacheError } = await supabaseAdmin
          .from('title_function_map')
          .select('*')
          .in('normalized_title', normalizedTitles);
        
        if (cacheError) {
          console.error(`[resolve_titles_to_functions] Cache lookup error:`, cacheError);
        }
        
        const cachedMap = new Map<string, any>();
        for (const row of (cachedData || [])) {
          cachedMap.set(row.normalized_title, row);
        }
        
        console.log(`[resolve_titles_to_functions] Found ${cachedMap.size} cached mappings`);
        
        // Process each title
        const mappings: Record<string, any> = {};
        const newMappings: any[] = [];
        
        for (let i = 0; i < titles.length; i++) {
          const originalTitle = titles[i];
          const normalized = normalizedTitles[i];
          
          const cached = cachedMap.get(normalized);
          if (cached) {
            mappings[originalTitle] = {
              job_function_id: cached.job_function_id,
              job_function_label: cached.job_function_label,
              confidence: cached.confidence,
              method: cached.method,
            };
          } else {
            // Classify using rules
            const classification = classifyTitle(originalTitle);
            mappings[originalTitle] = {
              job_function_id: classification.functionId,
              job_function_label: classification.functionLabel,
              confidence: classification.confidence,
              method: 'rules',
            };
            
            // Prepare for DB insert
            newMappings.push({
              normalized_title: normalized,
              original_title: originalTitle,
              job_function_id: classification.functionId,
              job_function_label: classification.functionLabel,
              confidence: classification.confidence,
              method: 'rules',
            });
          }
        }
        
        // Bulk insert new mappings
        if (newMappings.length > 0) {
          console.log(`[resolve_titles_to_functions] Inserting ${newMappings.length} new mappings`);
          const { error: insertError } = await supabaseAdmin
            .from('title_function_map')
            .upsert(newMappings, { onConflict: 'normalized_title' });
          
          if (insertError) {
            console.error(`[resolve_titles_to_functions] Insert error:`, insertError);
          }
        }
        
        console.log(`[resolve_titles_to_functions] Complete. Resolved ${Object.keys(mappings).length} titles`);
        
        return new Response(JSON.stringify({ mappings }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'override_title_mapping': {
        // Allow users to correct title-to-function mappings
        const { normalizedTitle, originalTitle, newFunctionId, newFunctionLabel, reason, userId } = params || {};
        
        if (!normalizedTitle || !newFunctionId || !newFunctionLabel) {
          return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        console.log(`[override_title_mapping] Overriding ${normalizedTitle} to ${newFunctionLabel}`);
        
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
        
        const { error: updateError } = await supabaseAdmin
          .from('title_function_map')
          .upsert({
            normalized_title: normalizedTitle,
            original_title: originalTitle || normalizedTitle,
            job_function_id: newFunctionId,
            job_function_label: newFunctionLabel,
            confidence: 1.0,
            method: 'user_override',
            overridden_by: userId || null,
            override_reason: reason || null,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'normalized_title' });
        
        if (updateError) {
          console.error(`[override_title_mapping] Update error:`, updateError);
          return new Response(JSON.stringify({ error: updateError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        console.log(`[override_title_mapping] Successfully overridden`);
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'get_lead_gen_forms': {
        // V2 API approach: Creative analytics + V2 Creatives API + Lead Forms API
        const { accountId, dateRange, campaignIds } = params || {};
        const startDate = dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const endDate = dateRange?.end || new Date().toISOString().split('T')[0];
        
        const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
        const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
        
        console.log(`[get_lead_gen_forms] Starting for account ${accountId}, date range: ${startDate} to ${endDate}`);
        
        // Debug counters
        let totalLeads = 0;
        let numCreativesWithLeads = 0;
        
        // Step 1: Fetch creative-level analytics (source of truth for activity)
        console.log('[Step 1] Fetching creative-level analytics with CREATIVE pivot...');
        const lgfCreativeAnalytics = new Map<string, {
          creativeUrn: string;
          impressions: number;
          clicks: number;
          spent: number;
          leads: number;
          formOpens: number;
        }>();
        
        let creativeAnalyticsUrl = `https://api.linkedin.com/v2/adAnalyticsV2?q=analytics&` +
          `dateRange.start.day=${startDay}&` +
          `dateRange.start.month=${startMonth}&` +
          `dateRange.start.year=${startYear}&` +
          `dateRange.end.day=${endDay}&` +
          `dateRange.end.month=${endMonth}&` +
          `dateRange.end.year=${endYear}&` +
          `timeGranularity=ALL&` +
          `pivot=CREATIVE&` +
          `accounts[0]=urn:li:sponsoredAccount:${accountId}&` +
          `fields=impressions,clicks,costInLocalCurrency,externalWebsiteConversions,oneClickLeads,oneClickLeadFormOpens,pivotValue&` +
          `count=10000`;
        
        if (campaignIds && campaignIds.length > 0) {
          campaignIds.forEach((id: string, i: number) => {
            creativeAnalyticsUrl += `&campaigns[${i}]=urn:li:sponsoredCampaign:${id}`;
          });
        }
        
        try {
          const creativeResponse = await fetch(creativeAnalyticsUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });
          
          if (creativeResponse.ok) {
            const creativeData = await creativeResponse.json();
            const elements = creativeData.elements || [];
            console.log(`[Step 1] CREATIVE pivot returned ${elements.length} rows`);
            
            for (const el of elements) {
              const pivotValue = el.pivotValue || '';
              const leads = (el.oneClickLeads || 0) + (el.externalWebsiteConversions || 0);
              
              lgfCreativeAnalytics.set(pivotValue, {
                creativeUrn: pivotValue,
                impressions: el.impressions || 0,
                clicks: el.clicks || 0,
                spent: parseFloat(el.costInLocalCurrency || '0'),
                leads,
                formOpens: el.oneClickLeadFormOpens || 0,
              });
              
              if (leads > 0) {
                numCreativesWithLeads++;
                totalLeads += leads;
              }
            }
          } else {
            const errorText = await creativeResponse.text();
            console.error(`[Step 1] CREATIVE pivot failed: ${creativeResponse.status} - ${errorText.substring(0, 200)}`);
          }
        } catch (err) {
          console.error(`[Step 1] CREATIVE pivot error:`, err);
        }
        
        console.log(`[Step 1] Found ${lgfCreativeAnalytics.size} creatives, ${numCreativesWithLeads} with leads > 0, ${totalLeads} total leads`);
        
        // Step 2: Fetch creative metadata from V2 API (with pagination)
        console.log('[Step 2] Fetching creative metadata from V2 adCreativesV2 API...');
        const creativeMetadata = new Map<string, { name: string; campaignId: string; leadFormUrn?: string; status?: string }>();
        const discoveredFormUrns = new Set<string>();
        
        // Helper function to extract lead form URN from V2 creative
        const extractLeadFormUrn = (creative: any): string | undefined => {
          let leadFormUrn: string | undefined;
          
          // V2: Check direct leadGenFormUrn field
          if (creative.leadGenFormUrn) {
            leadFormUrn = creative.leadGenFormUrn;
          }
          
          // V2: Check variables.data for sponsored content types
          const variables = creative.variables || {};
          const data = variables.data || {};
          
          // Check various nested locations in V2 structure
          const sponsoredContentVars = data['com.linkedin.ads.SponsoredContentCreativeVariables'];
          const sponsoredVideoVars = data['com.linkedin.ads.SponsoredVideoCreativeVariables'];
          const sponsoredUpdateVars = data['com.linkedin.ads.SponsoredUpdateCreativeVariables'];
          
          if (!leadFormUrn && sponsoredContentVars?.leadGenerationContext?.leadGenFormUrn) {
            leadFormUrn = sponsoredContentVars.leadGenerationContext.leadGenFormUrn;
          }
          if (!leadFormUrn && sponsoredVideoVars?.leadGenerationContext?.leadGenFormUrn) {
            leadFormUrn = sponsoredVideoVars.leadGenerationContext.leadGenFormUrn;
          }
          if (!leadFormUrn && sponsoredUpdateVars?.leadGenerationContext?.leadGenFormUrn) {
            leadFormUrn = sponsoredUpdateVars.leadGenerationContext.leadGenFormUrn;
          }
          
          // Check reference field for lead gen form URN
          const reference = creative.reference || '';
          if (!leadFormUrn && typeof reference === 'string' && reference.includes('leadGenForm')) {
            const formMatch = reference.match(/urn:li:leadGenForm:\(?(\d+)(?:,\d+\))?/);
            if (formMatch) leadFormUrn = `urn:li:leadGenForm:${formMatch[1]}`;
          }
          
          // Deep search fallback: search entire creative JSON for form URN pattern
          if (!leadFormUrn) {
            const creativeJson = JSON.stringify(creative);
            // Match both plain and versioned adForm/leadGenForm URNs
            const formMatch = creativeJson.match(/urn:li:(?:adForm|leadGenForm):\(?(\d+)(?:,\d+\))?/);
            if (formMatch) {
              const formId = formMatch[1];
              // Normalize to plain leadGenForm URN for consistent key usage
              leadFormUrn = `urn:li:leadGenForm:${formId}`;
            }
          }
          
          return leadFormUrn;
        };
        
        // Helper function to extract creative name from V2 creative
        const extractCreativeName = (creative: any, creativeId: string): string => {
          // Try creativeDscName (descriptive name field in V2)
          if (creative.creativeDscName) {
            return creative.creativeDscName;
          }
          if (creative.name) {
            return creative.name;
          }
          
          // Try variables.data for display name
          const variables = creative.variables || {};
          const data = variables.data || {};
          if (data.creativeDscName) {
            return data.creativeDscName;
          }
          
          // Extract from content/commentary if available
          const sponsoredContentVars = data['com.linkedin.ads.SponsoredContentCreativeVariables'];
          if (sponsoredContentVars?.share?.commentary?.text) {
            const text = sponsoredContentVars.share.commentary.text;
            return text.substring(0, 80) + (text.length > 80 ? '...' : '');
          }
          
          return `Creative ${creativeId}`;
        };
        
        try {
          let hasMoreCreatives = true;
          let creativesStart = 0;
          const creativesCount = 500;
          
          while (hasMoreCreatives) {
            const creativesUrl = `https://api.linkedin.com/v2/adCreativesV2?q=search&search.account.values[0]=urn:li:sponsoredAccount:${accountId}&count=${creativesCount}&start=${creativesStart}`;
            
            const creativesResponse = await fetch(creativesUrl, {
              headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            
            if (creativesResponse.ok) {
              const creativesData = await creativesResponse.json();
              const creatives = creativesData.elements || [];
              console.log(`[Step 2] V2 API returned ${creatives.length} creatives (start=${creativesStart})`);
              
              // Log first creative structure for debugging on first page
              if (creativesStart === 0 && creatives.length > 0) {
                console.log(`[Step 2] Sample V2 creative keys:`, Object.keys(creatives[0]).join(', '));
                console.log(`[Step 2] Sample V2 creative:`, JSON.stringify(creatives[0], null, 2).substring(0, 3000));
              }
              
              for (const creative of creatives) {
                // V2 uses $URN format or id field
                const creativeId = creative.id?.toString() || creative.$URN?.split(':').pop();
                if (!creativeId) continue;
                
                const creativeUrn = `urn:li:sponsoredCreative:${creativeId}`;
                const campaignUrn = creative.campaign || '';
                const campaignId = campaignUrn.split(':').pop() || '';
                
                const creativeName = extractCreativeName(creative, creativeId);
                const leadFormUrn = extractLeadFormUrn(creative);
                
                const creativeStatus = creative.status || 'UNKNOWN';
                creativeMetadata.set(creativeUrn, { name: creativeName, campaignId, leadFormUrn, status: creativeStatus });
                if (leadFormUrn) discoveredFormUrns.add(leadFormUrn);
              }
              
              // Check if there are more pages
              if (creatives.length < creativesCount) {
                hasMoreCreatives = false;
              } else {
                creativesStart += creativesCount;
                // Safety limit
                if (creativesStart > 5000) {
                  console.log(`[Step 2] Reached pagination limit at ${creativesStart}`);
                  hasMoreCreatives = false;
                }
              }
            } else {
              const errorText = await creativesResponse.text();
              console.log(`[Step 2] V2 Creatives API returned ${creativesResponse.status}: ${errorText.substring(0, 200)}`);
              hasMoreCreatives = false;
            }
          }
        } catch (err) {
          console.log(`[Step 2] V2 Creatives API error:`, err);
        }

        console.log(`[Step 2] Mapped ${creativeMetadata.size} creatives, discovered ${discoveredFormUrns.size} form URNs from metadata`);

        // Step 2b: Resolve proper creative names via versioned REST API for all LGF creatives.
        // adCreativesV2 batch endpoint rarely includes a meaningful name; the versioned endpoint always does.
        console.log('[Step 2b] Fetching creative names via versioned REST API...');
        const lgfCreativeUrns = Array.from(lgfCreativeAnalytics.keys());
        const BATCH_SIZE = 10;
        for (let bi = 0; bi < lgfCreativeUrns.length; bi += BATCH_SIZE) {
          await Promise.all(lgfCreativeUrns.slice(bi, bi + BATCH_SIZE).map(async (creativeUrn) => {
            try {
              const resp = await fetch(
                `https://api.linkedin.com/rest/adAccounts/${accountId}/creatives/${encodeURIComponent(creativeUrn)}`,
                { headers: { 'Authorization': `Bearer ${accessToken}`, 'X-Restli-Protocol-Version': '2.0.0', 'LinkedIn-Version': '202511' } }
              );
              if (resp.ok) {
                const cd = await resp.json();
                const resolvedName = cd.name || cd.creativeDscName;
                const resolvedLeadFormUrn = extractLeadFormUrn(cd);

                const existing = creativeMetadata.get(creativeUrn) || { name: '', campaignId: '' };
                creativeMetadata.set(creativeUrn, {
                  ...existing,
                  name: resolvedName || existing.name,
                  leadFormUrn: existing.leadFormUrn || resolvedLeadFormUrn,
                });

                if (resolvedLeadFormUrn) discoveredFormUrns.add(resolvedLeadFormUrn);
              }
            } catch (_) { /* non-fatal */ }
          }));
        }
        console.log(`[Step 2b] Versioned name resolution done for ${lgfCreativeUrns.length} creatives`);

        // Step 3: Resolve form names — multi-strategy approach
        console.log('[Step 3] Resolving lead form names...');
        console.log(`[Step 3] Discovered ${discoveredFormUrns.size} form URNs from creatives:`, Array.from(discoveredFormUrns).join(', '));

        const lgfFormNames = new Map<string, string>();

        // Helper to extract numeric form ID from any URN format
        const extractFormId = (urn: string): string => {
          if (!urn) return '';
          const versionedMatch = urn.match(/(?:adForm|leadGenForm|leadForm):\((\d+),\d+\)/);
          if (versionedMatch) return versionedMatch[1];
          const plainMatch = urn.match(/(?:adForm|leadGenForm|leadForm):(\d+)/);
          if (plainMatch) return plainMatch[1];
          return urn.split(':').pop() || '';
        };

        // Helper to extract name from a form object (handles plain string, multi-locale, localized variants)
        const extractFormName = (form: any): string | null => {
          if (!form) return null;
          // Try direct 'name' field
          const nameField = form.name;
          if (typeof nameField === 'string' && nameField.trim()) return nameField.trim();
          if (nameField && typeof nameField === 'object') {
            // Multi-locale: { localized: { en_US: "Form Name" }, preferredLocale: {...} }
            const localized = nameField.localized;
            if (localized && typeof localized === 'object') {
              const pref = nameField.preferredLocale;
              const prefKey = pref ? `${pref.language}_${pref.country}` : null;
              const fromPref = prefKey ? localized[prefKey] : null;
              if (typeof fromPref === 'string') return fromPref;
              for (const val of Object.values(localized)) {
                if (typeof val === 'string' && val.trim()) return val.trim();
              }
            }
            // Flat localized (no wrapper): { en_US: "Form Name" }
            for (const val of Object.values(nameField)) {
              if (typeof val === 'string' && val.trim()) return val.trim();
            }
          }
          // Fallback: headline field
          if (form.headline) {
            const h = form.headline;
            if (typeof h === 'string' && h.trim()) return h.trim();
            if (h?.localized) {
              for (const val of Object.values(h.localized)) {
                if (typeof val === 'string' && val.trim()) return val.trim();
              }
            }
          }
          // Fallback: description
          if (form.description) {
            const d = form.description;
            if (typeof d === 'string' && d.trim()) return d.trim();
            if (d?.localized) {
              for (const val of Object.values(d.localized)) {
                if (typeof val === 'string' && val.trim()) return val.trim();
              }
            }
          }
          return null;
        };

        // Strategy A: Bulk fetch via /rest/leadForms?q=owner (Lead Sync API)
        try {
          const ownerParam = `(sponsoredAccount:urn%3Ali%3AsponsoredAccount%3A${accountId})`;
          const leadFormsUrl = `https://api.linkedin.com/rest/leadForms?q=owner&owner=${ownerParam}&count=500`;
          console.log(`[Step 3A] Bulk: ${leadFormsUrl}`);

          const resp = await fetch(leadFormsUrl, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'X-Restli-Protocol-Version': '2.0.0',
              'LinkedIn-Version': '202511',
            },
          });

          const respText = await resp.text();
          console.log(`[Step 3A] Status: ${resp.status}, body length: ${respText.length}`);

          if (resp.ok) {
            let data: any;
            try { data = JSON.parse(respText); } catch { data = null; }
            const elements = data?.elements || [];
            console.log(`[Step 3A] Got ${elements.length} forms`);

            if (elements.length > 0) {
              console.log(`[Step 3A] Sample form keys:`, Object.keys(elements[0]).join(', '));
              console.log(`[Step 3A] Sample form (raw):`, JSON.stringify(elements[0]).substring(0, 2000));
            }

            for (const form of elements) {
              // Extract ID — could be plain number, versioned "(id,version)", or from entityUrn
              const rawId = String(form.id ?? '').trim();
              const vMatch = rawId.match(/^\((\d+),\d+\)$/);
              const formId = vMatch ? vMatch[1] : (rawId || extractFormId(form.entityUrn || form['$URN'] || ''));
              if (!formId) continue;

              const name = extractFormName(form);
              console.log(`[Step 3A] Form id=${formId}, resolved name="${name}", raw name=${JSON.stringify(form.name)?.substring(0, 200)}`);
              if (name) lgfFormNames.set(formId, name);
            }
          } else {
            console.log(`[Step 3A] Failed: ${resp.status} - ${respText.substring(0, 500)}`);
          }
        } catch (err) {
          console.log(`[Step 3A] Error:`, (err as Error).message);
        }

        // Strategy B: Individual lookups for any forms still unresolved
        const unresolvedFormIds = Array.from(discoveredFormUrns)
          .map(urn => extractFormId(urn))
          .filter(id => id && !lgfFormNames.has(id));

        if (unresolvedFormIds.length > 0) {
          console.log(`[Step 3B] ${unresolvedFormIds.length} forms still unresolved, trying individual lookups: ${unresolvedFormIds.join(', ')}`);

          // Try /rest/leadForms/{id} individually (parallel, batched)
          const BATCH = 5;
          for (let i = 0; i < unresolvedFormIds.length && i < 30; i += BATCH) {
            await Promise.all(unresolvedFormIds.slice(i, i + BATCH).map(async (formId) => {
              try {
                const resp = await fetch(`https://api.linkedin.com/rest/leadForms/${formId}`, {
                  headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'X-Restli-Protocol-Version': '2.0.0',
                    'LinkedIn-Version': '202511',
                  },
                });
                if (resp.ok) {
                  const formData = await resp.json();
                  const name = extractFormName(formData);
                  console.log(`[Step 3B] /rest/leadForms/${formId} → "${name}", keys: ${Object.keys(formData).join(',')}`);
                  if (name) lgfFormNames.set(formId, name);
                } else {
                  const errText = await resp.text();
                  console.log(`[Step 3B] /rest/leadForms/${formId} → ${resp.status}: ${errText.substring(0, 200)}`);
                }
              } catch (_) {}
            }));
          }
        }

        // Strategy C: Try old /v2/adForms endpoint for any still unresolved
        const stillUnresolved = Array.from(discoveredFormUrns)
          .map(urn => extractFormId(urn))
          .filter(id => id && !lgfFormNames.has(id));

        if (stillUnresolved.length > 0) {
          console.log(`[Step 3C] ${stillUnresolved.length} forms still unresolved, trying /v2/adForms...`);
          try {
            const v2Url = `https://api.linkedin.com/v2/adForms?q=account&account=urn:li:sponsoredAccount:${accountId}&count=500`;
            const resp = await fetch(v2Url, {
              headers: { 'Authorization': `Bearer ${accessToken}` },
            });
            if (resp.ok) {
              const data = await resp.json();
              const elements = data?.elements || [];
              console.log(`[Step 3C] /v2/adForms returned ${elements.length} forms`);
              if (elements.length > 0) {
                console.log(`[Step 3C] Sample keys:`, Object.keys(elements[0]).join(', '));
                console.log(`[Step 3C] Sample:`, JSON.stringify(elements[0]).substring(0, 1000));
              }
              for (const form of elements) {
                const formId = extractFormId(form.id?.toString() || form.entityUrn || form['$URN'] || '');
                if (!formId || lgfFormNames.has(formId)) continue;
                const name = extractFormName(form);
                if (name) lgfFormNames.set(formId, name);
              }
            } else {
              const errText = await resp.text();
              console.log(`[Step 3C] /v2/adForms failed: ${resp.status} - ${errText.substring(0, 300)}`);
            }
          } catch (err) {
            console.log(`[Step 3C] Error:`, (err as Error).message);
          }
        }

        // Strategy D: Try old /v2/adFormsV2 (another deprecated variant)
        const finalUnresolved = Array.from(discoveredFormUrns)
          .map(urn => extractFormId(urn))
          .filter(id => id && !lgfFormNames.has(id));

        if (finalUnresolved.length > 0) {
          console.log(`[Step 3D] ${finalUnresolved.length} forms still unresolved. Trying individual /v2/adFormsV2...`);
          for (const formId of finalUnresolved.slice(0, 10)) {
            try {
              // Try fetching by direct URN
              const resp = await fetch(`https://api.linkedin.com/v2/adForms/urn:li:adForm:(${accountId},${formId})`, {
                headers: { 'Authorization': `Bearer ${accessToken}` },
              });
              if (resp.ok) {
                const formData = await resp.json();
                const name = extractFormName(formData);
                console.log(`[Step 3D] adForm ${formId} → "${name}"`);
                if (name) lgfFormNames.set(formId, name);
              } else {
                console.log(`[Step 3D] adForm ${formId} → ${resp.status}`);
              }
            } catch (_) {}
          }
        }

        console.log(`[Step 3] Final: resolved ${lgfFormNames.size}/${discoveredFormUrns.size} form names:`,
          Array.from(lgfFormNames.entries()).map(([id, name]) => `${id}="${name}"`).join(', '));
        
        // Step 3d: Fetch campaign names for all campaigns referenced by creatives
        const lgfCampaignNames = new Map<string, string>();
        const allCampaignIds = new Set<string>();
        for (const meta of creativeMetadata.values()) {
          if (meta.campaignId) allCampaignIds.add(meta.campaignId);
        }
        if (allCampaignIds.size > 0) {
          try {
            const campParams = new URLSearchParams();
            campParams.set('q', 'search');
            campParams.set('search.account.values[0]', `urn:li:sponsoredAccount:${accountId}`);
            campParams.set('count', '500');
            const campResponse = await fetch(`https://api.linkedin.com/v2/adCampaignsV2?${campParams.toString()}`, {
              headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            if (campResponse.ok) {
              const campData = await campResponse.json();
              for (const c of campData.elements || []) {
                const id = c.id?.toString() || '';
                if (id) lgfCampaignNames.set(id, c.name || `Campaign ${id}`);
              }
              console.log(`[Step 3d] Resolved ${lgfCampaignNames.size} campaign names`);
            }
          } catch (err) {
            console.log(`[Step 3d] Campaign name fetch error:`, err);
          }
        }

        // Step 4: Join + Aggregate - group creatives by form URN
        console.log('[Step 4] Building form aggregates from creatives...');
        
        const formAggregates = new Map<string, {
          formUrn: string;
          formName: string;
          impressions: number;
          clicks: number;
          spent: number;
          leads: number;
          formOpens: number;
          creatives: Array<{
            creativeId: string;
            creativeName: string;
            campaignId: string;
            campaignName: string;
            impressions: number;
            clicks: number;
            spent: number;
            leads: number;
            formOpens: number;
            ctr: number;
            cpc: number;
            cpl: number;
            lgfRate: number;
          }>;
        }>();
        
        const lgfCreativesWithoutForm: any[] = [];
        let inferredFormAssignments = 0;

        const normalizeFormName = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

        const inferFormNameFromCreativeName = (creativeName: string): string | null => {
          if (!creativeName) return null;

          const bracketMatch = creativeName.match(/^\[([^\]]+)\]/);
          if (bracketMatch?.[1]?.trim()) return bracketMatch[1].trim();

          const pipeIdx = creativeName.indexOf(' | ');
          if (pipeIdx > 0) return creativeName.slice(0, pipeIdx).trim() || null;

          const dashIdx = creativeName.indexOf(' - ');
          if (dashIdx > 0) {
            const candidate = creativeName.slice(0, dashIdx).trim();
            if (candidate && candidate.length <= 80 && !candidate.toLowerCase().includes('campaign')) return candidate;
          }

          const colonIdx = creativeName.indexOf(': ');
          if (colonIdx > 0) {
            const candidate = creativeName.slice(0, colonIdx).trim();
            if (candidate && candidate.length <= 80) return candidate;
          }

          return null;
        };

        const formIdByNormalizedName = new Map<string, string>();
        for (const [formId, formName] of lgfFormNames.entries()) {
          formIdByNormalizedName.set(normalizeFormName(formName), formId);
        }

        const addCreativeToFormAggregate = (targetFormUrn: string, targetFormName: string, metrics: any, creativeData: any) => {
          let formData = formAggregates.get(targetFormUrn);
          if (!formData) {
            formData = {
              formUrn: targetFormUrn,
              formName: targetFormName,
              impressions: 0,
              clicks: 0,
              spent: 0,
              leads: 0,
              formOpens: 0,
              creatives: [],
            };
            formAggregates.set(targetFormUrn, formData);
          }

          formData.creatives.push(creativeData);
          formData.impressions += metrics.impressions;
          formData.clicks += metrics.clicks;
          formData.spent += metrics.spent;
          formData.leads += metrics.leads;
          formData.formOpens += metrics.formOpens;
        };
        
        const campaignToResolvedFormUrns = new Map<string, Set<string>>();
        for (const meta of creativeMetadata.values()) {
          if (!meta.campaignId || !meta.leadFormUrn) continue;
          if (!campaignToResolvedFormUrns.has(meta.campaignId)) {
            campaignToResolvedFormUrns.set(meta.campaignId, new Set<string>());
          }
          campaignToResolvedFormUrns.get(meta.campaignId)!.add(meta.leadFormUrn);
        }

        const globallyResolvedFormUrns = new Set<string>();
        for (const meta of creativeMetadata.values()) {
          if (meta.leadFormUrn) globallyResolvedFormUrns.add(meta.leadFormUrn);
        }

        // Process each creative with analytics
        for (const [creativeUrn, metrics] of lgfCreativeAnalytics.entries()) {
          const meta = creativeMetadata.get(creativeUrn) || { name: `Creative ${creativeUrn.split(':').pop()}`, campaignId: '' };
          const creativeId = creativeUrn.split(':').pop() || '';
          
          const ctr = metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : 0;
          const cpc = metrics.clicks > 0 ? metrics.spent / metrics.clicks : 0;
          const cpl = metrics.leads > 0 ? metrics.spent / metrics.leads : 0;
          const lgfRate = metrics.formOpens > 0 ? (metrics.leads / metrics.formOpens) * 100 : 0;
          
          const creativeData = {
            creativeId,
            creativeName: meta.name,
            campaignId: meta.campaignId,
            campaignName: lgfCampaignNames.get(meta.campaignId) || `Campaign ${meta.campaignId}`,
            impressions: metrics.impressions,
            clicks: metrics.clicks,
            spent: metrics.spent,
            leads: metrics.leads,
            formOpens: metrics.formOpens,
            ctr,
            cpc,
            cpl,
            lgfRate,
            status: meta.status || 'UNKNOWN',
          };
          
          const formUrn = meta.leadFormUrn;

          if (formUrn) {
            const formId = extractFormId(formUrn);
            addCreativeToFormAggregate(formUrn, lgfFormNames.get(formId) || `Form ${formId}`, metrics, creativeData);
            continue;
          }

          if (metrics.leads > 0 || metrics.formOpens > 0) {
            const inferredFormName = inferFormNameFromCreativeName(meta.name);

            if (inferredFormName) {
              const normalized = normalizeFormName(inferredFormName);
              const matchedFormId = formIdByNormalizedName.get(normalized);

              if (matchedFormId) {
                addCreativeToFormAggregate(`urn:li:leadGenForm:${matchedFormId}`, lgfFormNames.get(matchedFormId) || inferredFormName, metrics, creativeData);
              } else {
                addCreativeToFormAggregate(`inferred:${normalized}`, inferredFormName, metrics, creativeData);
              }

              inferredFormAssignments++;
              continue;
            }

            const campaignResolvedUrns = meta.campaignId ? Array.from(campaignToResolvedFormUrns.get(meta.campaignId) || []) : [];
            if (campaignResolvedUrns.length === 1) {
              const campaignFormUrn = campaignResolvedUrns[0];
              const campaignFormId = extractFormId(campaignFormUrn);
              addCreativeToFormAggregate(campaignFormUrn, lgfFormNames.get(campaignFormId) || `Form ${campaignFormId}`, metrics, creativeData);
              inferredFormAssignments++;
              continue;
            }

            if (globallyResolvedFormUrns.size === 1) {
              const onlyFormUrn = Array.from(globallyResolvedFormUrns)[0];
              const onlyFormId = extractFormId(onlyFormUrn);
              addCreativeToFormAggregate(onlyFormUrn, lgfFormNames.get(onlyFormId) || `Form ${onlyFormId}`, metrics, creativeData);
              inferredFormAssignments++;
              continue;
            }

            lgfCreativesWithoutForm.push(creativeData);
          }
        }

        console.log(`[Step 4] Fallback inferred form assignments: ${inferredFormAssignments}`);
        
        // If we have creatives with leads but no form associations, create an "Unknown Form" bucket
        if (lgfCreativesWithoutForm.length > 0) {
          const unknownFormMetrics = lgfCreativesWithoutForm.reduce((acc, c) => ({
            impressions: acc.impressions + c.impressions,
            clicks: acc.clicks + c.clicks,
            spent: acc.spent + c.spent,
            leads: acc.leads + c.leads,
            formOpens: acc.formOpens + c.formOpens,
          }), { impressions: 0, clicks: 0, spent: 0, leads: 0, formOpens: 0 });
          
          formAggregates.set('unknown', {
            formUrn: 'unknown',
            formName: 'Unknown Form (creatives with leads)',
            ...unknownFormMetrics,
            creatives: lgfCreativesWithoutForm,
          });
        }
        
        // Build final array with calculated metrics
        const lgfForms = Array.from(formAggregates.values()).map(form => {
          const ctr = form.impressions > 0 ? (form.clicks / form.impressions) * 100 : 0;
          const cpc = form.clicks > 0 ? form.spent / form.clicks : 0;
          const cpl = form.leads > 0 ? form.spent / form.leads : 0;
          const lgfRate = form.formOpens > 0 ? (form.leads / form.formOpens) * 100 : 0;
          
          form.creatives.sort((a, b) => b.leads - a.leads);
          
          return { ...form, ctr, cpc, cpl, lgfRate };
        });
        
        // Sort forms by leads descending
        lgfForms.sort((a, b) => b.leads - a.leads);
        
        const lgfTotals = lgfForms.reduce((acc, form) => ({
          impressions: acc.impressions + form.impressions,
          clicks: acc.clicks + form.clicks,
          spent: acc.spent + form.spent,
          leads: acc.leads + form.leads,
          formOpens: acc.formOpens + form.formOpens,
        }), { impressions: 0, clicks: 0, spent: 0, leads: 0, formOpens: 0 });
        
        console.log(`[get_lead_gen_forms] Complete. ${lgfForms.length} forms, ${lgfTotals.leads} total leads, ${lgfCreativesWithoutForm.length} creatives without form`);
        
        return new Response(JSON.stringify({
          forms: lgfForms,
          creativesWithoutForm: lgfCreativesWithoutForm,
          totals: lgfTotals,
          debug: {
            totalLeads,
            numCreativesWithLeads,
            numCreativesTotal: lgfCreativeAnalytics.size,
            numFormsDiscoveredFromCreatives: discoveredFormUrns.size,
            numFormNamesResolved: lgfFormNames.size,
          },
          metadata: {
            accountId,
            dateRange: { start: startDate, end: endDate },
            totalForms: lgfForms.length,
            totalCreativesWithForms: lgfForms.reduce((sum, f) => sum + f.creatives.length, 0),
            creativesWithoutFormCount: lgfCreativesWithoutForm.length,
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'get_form_creative_analytics': {
        // Extracts form names from creative names and groups analytics by form
        // Supports multiple naming conventions: "FormName | Creative", "FormName - Creative", "[FormName] Creative"
        const { accountId, dateRange, separator } = params || {};
        const startDate = dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const endDate = dateRange?.end || new Date().toISOString().split('T')[0];

        const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
        const [endYear, endMonth, endDay] = endDate.split('-').map(Number);

        console.log(`[get_form_creative_analytics] Starting for account ${accountId}, date range: ${startDate} to ${endDate}`);

        // Helper function to extract form name from creative name
        const extractFormName = (creativeName: string, customSeparator?: string): { formName: string; creativePart: string } => {
          if (!creativeName) {
            return { formName: 'Unknown Form', creativePart: creativeName };
          }

          // Try custom separator first if provided
          if (customSeparator && creativeName.includes(customSeparator)) {
            const parts = creativeName.split(customSeparator);
            return {
              formName: parts[0].trim(),
              creativePart: parts.slice(1).join(customSeparator).trim()
            };
          }

          // Pattern 1: "FormName | CreativeDescription"
          if (creativeName.includes(' | ')) {
            const parts = creativeName.split(' | ');
            return {
              formName: parts[0].trim(),
              creativePart: parts.slice(1).join(' | ').trim()
            };
          }

          // Pattern 2: "FormName - CreativeDescription" (but not "Campaign - Creative" patterns)
          // Only split on " - " if the first part looks like a form name (shorter, no "Campaign" word)
          if (creativeName.includes(' - ')) {
            const parts = creativeName.split(' - ');
            const firstPart = parts[0].trim();
            // Heuristic: form names are usually shorter and don't contain "Campaign"
            if (firstPart.length <= 50 && !firstPart.toLowerCase().includes('campaign')) {
              return {
                formName: firstPart,
                creativePart: parts.slice(1).join(' - ').trim()
              };
            }
          }

          // Pattern 3: "[FormName] CreativeDescription"
          const bracketMatch = creativeName.match(/^\[([^\]]+)\]\s*(.*)$/);
          if (bracketMatch) {
            return {
              formName: bracketMatch[1].trim(),
              creativePart: bracketMatch[2].trim()
            };
          }

          // Pattern 4: "FormName: CreativeDescription"
          if (creativeName.includes(': ')) {
            const parts = creativeName.split(': ');
            const firstPart = parts[0].trim();
            if (firstPart.length <= 50) {
              return {
                formName: firstPart,
                creativePart: parts.slice(1).join(': ').trim()
              };
            }
          }

          // No pattern matched - return as unknown
          return { formName: 'Unknown Form', creativePart: creativeName };
        };

        // Step 1: Fetch creative-level analytics
        console.log('[Step 1] Fetching creative-level analytics...');
        const creativeAnalytics = new Map<string, {
          creativeUrn: string;
          impressions: number;
          clicks: number;
          spent: number;
          leads: number;
          formOpens: number;
          videoViews: number;
          videoCompletions: number;
        }>();

        const analyticsUrl = `https://api.linkedin.com/v2/adAnalyticsV2?q=analytics&` +
          `dateRange.start.day=${startDay}&dateRange.start.month=${startMonth}&dateRange.start.year=${startYear}&` +
          `dateRange.end.day=${endDay}&dateRange.end.month=${endMonth}&dateRange.end.year=${endYear}&` +
          `timeGranularity=ALL&pivot=CREATIVE&accounts[0]=urn:li:sponsoredAccount:${accountId}&` +
          `fields=impressions,clicks,costInLocalCurrency,oneClickLeads,externalWebsiteConversions,oneClickLeadFormOpens,videoViews,videoCompletions,pivotValue&count=10000`;

        try {
          const response = await fetch(analyticsUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });

          if (response.ok) {
            const data = await response.json();
            for (const el of (data.elements || [])) {
              const pivotValue = el.pivotValue || '';
              creativeAnalytics.set(pivotValue, {
                creativeUrn: pivotValue,
                impressions: el.impressions || 0,
                clicks: el.clicks || 0,
                spent: parseFloat(el.costInLocalCurrency || '0'),
                leads: (el.oneClickLeads || 0) + (el.externalWebsiteConversions || 0),
                formOpens: el.oneClickLeadFormOpens || 0,
                videoViews: el.videoViews || 0,
                videoCompletions: el.videoCompletions || 0,
              });
            }
          }
        } catch (err) {
          console.error('[Step 1] Analytics fetch error:', err);
        }

        console.log(`[Step 1] Found ${creativeAnalytics.size} creatives with analytics`);

        // Step 2: Fetch creative metadata (names)
        console.log('[Step 2] Fetching creative metadata...');
        const creativeMetadata = new Map<string, { name: string; campaignId: string; status: string }>();

        try {
          let hasMore = true;
          let start = 0;
          const count = 500;

          while (hasMore) {
            const creativesUrl = `https://api.linkedin.com/v2/adCreativesV2?q=search&search.account.values[0]=urn:li:sponsoredAccount:${accountId}&count=${count}&start=${start}`;
            const response = await fetch(creativesUrl, {
              headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            if (response.ok) {
              const data = await response.json();
              const elements = data.elements || [];

              for (const creative of elements) {
                const creativeId = creative.id?.toString();
                if (!creativeId) continue;

                const creativeUrn = `urn:li:sponsoredCreative:${creativeId}`;
                const campaignId = (creative.campaign || '').split(':').pop() || '';

                // Extract name from creative
                let name = creative.creativeDscName || creative.name || '';

                // If no name, try variables
                if (!name && creative.variables?.data) {
                  const data = creative.variables.data;
                  if (data.creativeDscName) name = data.creativeDscName;
                }

                creativeMetadata.set(creativeUrn, {
                  name: name || `Creative ${creativeId}`,
                  campaignId,
                  status: creative.status || 'UNKNOWN'
                });
              }

              hasMore = elements.length === count;
              start += count;
              if (start > 5000) hasMore = false; // Safety limit
            } else {
              hasMore = false;
            }
          }
        } catch (err) {
          console.error('[Step 2] Creative metadata fetch error:', err);
        }

        console.log(`[Step 2] Found ${creativeMetadata.size} creative metadata records`);

        // Step 3: Fetch creative names via versioned API for better accuracy
        console.log('[Step 3] Enhancing creative names via versioned API...');
        const creativesToEnhance = Array.from(creativeMetadata.keys()).slice(0, 200);

        for (let i = 0; i < creativesToEnhance.length; i += 10) {
          const batch = creativesToEnhance.slice(i, i + 10);
          await Promise.all(batch.map(async (creativeUrn) => {
            try {
              const creativeId = creativeUrn.split(':').pop();
              const encodedUrn = encodeURIComponent(creativeUrn);
              const url = `https://api.linkedin.com/rest/adAccounts/${accountId}/creatives/${encodedUrn}`;

              const response = await fetch(url, {
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'LinkedIn-Version': '202511',
                  'X-Restli-Protocol-Version': '2.0.0'
                }
              });

              if (response.ok) {
                const data = await response.json();
                if (data.name) {
                  const existing = creativeMetadata.get(creativeUrn);
                  if (existing) {
                    existing.name = data.name;
                    creativeMetadata.set(creativeUrn, existing);
                  }
                }
              }
            } catch {}
          }));
        }

        // Step 4: Group creatives by extracted form name
        console.log('[Step 4] Grouping creatives by form name...');
        const formGroups = new Map<string, {
          formName: string;
          impressions: number;
          clicks: number;
          spent: number;
          leads: number;
          formOpens: number;
          videoViews: number;
          videoCompletions: number;
          creatives: Array<{
            creativeId: string;
            creativeName: string;
            creativePart: string;
            campaignId: string;
            status: string;
            impressions: number;
            clicks: number;
            spent: number;
            leads: number;
            formOpens: number;
            ctr: number;
            cpc: number;
            cpl: number;
            lgfRate: number;
          }>;
        }>();

        // Track form name detection stats
        const detectionStats = {
          pipe: 0,
          dash: 0,
          bracket: 0,
          colon: 0,
          custom: 0,
          unknown: 0
        };

        for (const [creativeUrn, metrics] of creativeAnalytics.entries()) {
          const meta = creativeMetadata.get(creativeUrn) || { name: `Creative ${creativeUrn.split(':').pop()}`, campaignId: '', status: 'UNKNOWN' };
          const creativeId = creativeUrn.split(':').pop() || '';

          // Extract form name from creative name
          const { formName, creativePart } = extractFormName(meta.name, separator);

          // Track detection method
          if (meta.name.includes(' | ')) detectionStats.pipe++;
          else if (meta.name.includes(' - ') && formName !== 'Unknown Form') detectionStats.dash++;
          else if (meta.name.match(/^\[/)) detectionStats.bracket++;
          else if (meta.name.includes(': ') && formName !== 'Unknown Form') detectionStats.colon++;
          else if (separator && meta.name.includes(separator)) detectionStats.custom++;
          else detectionStats.unknown++;

          // Calculate creative-level metrics
          const ctr = metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : 0;
          const cpc = metrics.clicks > 0 ? metrics.spent / metrics.clicks : 0;
          const cpl = metrics.leads > 0 ? metrics.spent / metrics.leads : 0;
          const lgfRate = metrics.formOpens > 0 ? (metrics.leads / metrics.formOpens) * 100 : 0;

          const creativeData = {
            creativeId,
            creativeName: meta.name,
            creativePart,
            campaignId: meta.campaignId,
            status: meta.status,
            impressions: metrics.impressions,
            clicks: metrics.clicks,
            spent: metrics.spent,
            leads: metrics.leads,
            formOpens: metrics.formOpens,
            ctr,
            cpc,
            cpl,
            lgfRate,
          };

          // Add to form group
          let group = formGroups.get(formName);
          if (!group) {
            group = {
              formName,
              impressions: 0,
              clicks: 0,
              spent: 0,
              leads: 0,
              formOpens: 0,
              videoViews: 0,
              videoCompletions: 0,
              creatives: []
            };
            formGroups.set(formName, group);
          }

          group.creatives.push(creativeData);
          group.impressions += metrics.impressions;
          group.clicks += metrics.clicks;
          group.spent += metrics.spent;
          group.leads += metrics.leads;
          group.formOpens += metrics.formOpens;
          group.videoViews += metrics.videoViews;
          group.videoCompletions += metrics.videoCompletions;
        }

        // Build final response with calculated metrics
        const forms = Array.from(formGroups.values()).map(form => {
          const ctr = form.impressions > 0 ? (form.clicks / form.impressions) * 100 : 0;
          const cpc = form.clicks > 0 ? form.spent / form.clicks : 0;
          const cpl = form.leads > 0 ? form.spent / form.leads : 0;
          const lgfRate = form.formOpens > 0 ? (form.leads / form.formOpens) * 100 : 0;

          // Sort creatives by leads then spend
          form.creatives.sort((a, b) => b.leads - a.leads || b.spent - a.spent);

          return {
            ...form,
            ctr,
            cpc,
            cpl,
            lgfRate,
            creativeCount: form.creatives.length
          };
        });

        // Sort forms by leads then spend
        forms.sort((a, b) => b.leads - a.leads || b.spent - a.spent);

        // Calculate totals
        const totals = forms.reduce((acc, form) => ({
          impressions: acc.impressions + form.impressions,
          clicks: acc.clicks + form.clicks,
          spent: acc.spent + form.spent,
          leads: acc.leads + form.leads,
          formOpens: acc.formOpens + form.formOpens,
        }), { impressions: 0, clicks: 0, spent: 0, leads: 0, formOpens: 0 });

        console.log(`[get_form_creative_analytics] Complete. ${forms.length} forms extracted from ${creativeAnalytics.size} creatives`);
        console.log(`[Detection Stats] pipe: ${detectionStats.pipe}, dash: ${detectionStats.dash}, bracket: ${detectionStats.bracket}, colon: ${detectionStats.colon}, unknown: ${detectionStats.unknown}`);

        return new Response(JSON.stringify({
          forms,
          totals: {
            ...totals,
            ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
            cpc: totals.clicks > 0 ? totals.spent / totals.clicks : 0,
            cpl: totals.leads > 0 ? totals.spent / totals.leads : 0,
            lgfRate: totals.formOpens > 0 ? (totals.leads / totals.formOpens) * 100 : 0,
          },
          metadata: {
            accountId,
            dateRange: { start: startDate, end: endDate },
            totalForms: forms.length,
            totalCreatives: creativeAnalytics.size,
            detectionStats,
            separatorUsed: separator || 'auto-detect'
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'test_titles_api': {
        // Test the LinkedIn Standardized Titles API access
        // GET https://api.linkedin.com/v2/standardizedTitles?q=criteria&name=Engineer
        console.log('[test_titles_api] Testing Titles API access...');
        
        const titlesTestUrl = new URL('https://api.linkedin.com/v2/standardizedTitles');
        titlesTestUrl.searchParams.set('q', 'criteria');
        titlesTestUrl.searchParams.set('name', 'Engineer');
        
        const titlesTestResponse = await fetch(titlesTestUrl.toString(), {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0',
            'LinkedIn-Version': '202511'
          }
        });
        
        const statusCode = titlesTestResponse.status;
        console.log(`[test_titles_api] Response status: ${statusCode}`);
        
        if (statusCode === 200) {
          const data = await titlesTestResponse.json();
          console.log(`[test_titles_api] Success - found ${data.elements?.length || 0} titles`);
          return new Response(JSON.stringify({ 
            success: true, 
            titlesApiEnabled: true,
            message: 'Titles API access confirmed',
            sampleCount: data.elements?.length || 0
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else if (statusCode === 403) {
          const errorText = await titlesTestResponse.text();
          console.log(`[test_titles_api] 403 Forbidden - Titles API not accessible:`, errorText);
          return new Response(JSON.stringify({ 
            success: true, 
            titlesApiEnabled: false,
            message: 'Titles API access denied (403). Using local classification fallback.',
            error: errorText
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else {
          // For 404 or other errors, treat as API not available (not a hard error)
          const errorText = await titlesTestResponse.text();
          console.log(`[test_titles_api] Status ${statusCode} - API not available:`, errorText);
          return new Response(JSON.stringify({ 
            success: true, 
            titlesApiEnabled: false,
            message: `Titles API not available (${statusCode}). Using local classification fallback.`,
            error: errorText
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      case 'search_job_titles': {
        // Search for targetable job titles using LinkedIn's adTargetingEntities typeahead API
        const { query, accountId } = params;
        
        if (!query || query.trim().length < 2) {
          return new Response(JSON.stringify({ 
            titles: [],
            message: 'Query must be at least 2 characters'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        console.log(`[search_job_titles] Searching for: "${query}"`);
        
        // Use the adTargetingEntities typeahead API for job titles
        // The facet for job titles is "titles"
        const searchParams = new URLSearchParams({
          q: 'typeahead',
          facet: 'urn:li:adTargetingFacet:titles',
          query: query.trim(),
          count: '50',
        });
        
        const searchUrl = `https://api.linkedin.com/rest/adTargetingEntities?${searchParams.toString()}`;
        console.log(`[search_job_titles] API URL: ${searchUrl}`);
        
        const searchResponse = await fetch(searchUrl, {
          headers: { 
            'Authorization': `Bearer ${accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0',
            'LinkedIn-Version': '202511',
          },
        });
        
        if (!searchResponse.ok) {
          const errorText = await searchResponse.text();
          console.error(`[search_job_titles] Error ${searchResponse.status}:`, errorText);
          
          // Try fallback to standardizedTitles endpoint
          console.log('[search_job_titles] Trying standardizedTitles fallback...');
          const fallbackParams = new URLSearchParams({
            q: 'criteria',
            name: query.trim(),
          });
          
          const fallbackUrl = `https://api.linkedin.com/v2/standardizedTitles?${fallbackParams.toString()}`;
          const fallbackResponse = await fetch(fallbackUrl, {
            headers: { 
              'Authorization': `Bearer ${accessToken}`,
              'X-Restli-Protocol-Version': '2.0.0',
            },
          });
          
          if (!fallbackResponse.ok) {
            const fallbackError = await fallbackResponse.text();
            console.error(`[search_job_titles] Fallback also failed ${fallbackResponse.status}:`, fallbackError);
            return new Response(JSON.stringify({ 
              error: 'Job title search not available',
              details: errorText,
              titles: []
            }), {
              status: searchResponse.status,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          const fallbackData = await fallbackResponse.json();
          console.log(`[search_job_titles] Fallback returned ${fallbackData.elements?.length || 0} results`);
          
          const titles = (fallbackData.elements || []).map((el: any) => ({
            id: el.id,
            urn: `urn:li:title:${el.id}`,
            name: el.name?.localized?.en_US || el.name?.localized?.[Object.keys(el.name?.localized || {})[0]] || `Title ${el.id}`,
            targetable: true, // Assume targetable if returned by API
          }));
          
          return new Response(JSON.stringify({ 
            titles,
            source: 'standardizedTitles',
            count: titles.length
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const searchData = await searchResponse.json();
        console.log(`[search_job_titles] Typeahead returned ${searchData.elements?.length || 0} results`);
        
        // Log a sample of URN formats to debug super title detection
        const sampleUrns = (searchData.elements || []).slice(0, 5).map((el: any) => el.urn || el.entity || 'no-urn');
        console.log(`[search_job_titles] Sample URNs: ${JSON.stringify(sampleUrns)}`);
        
        // DIAGNOSTIC: Log first typeahead element to see what fields are available
        if (searchData.elements?.length > 0) {
          console.log('[search_job_titles] TYPEAHEAD_SAMPLE:', JSON.stringify(searchData.elements[0], null, 2));
        }
        
        // Define type for parsed titles - includes superTitleId for proper parent resolution
        type ParsedTitle = {
          id: string;
          urn: string;
          name: string;
          targetable: boolean;
          facetUrn: string;
          isSuperTitle: boolean;
          superTitleId: string | null;
          superTitleUrn: string | null;
          parentSuperTitle: { urn: string; name: string } | null;
        };
        
        // Parse the adTargetingEntities response - extract parent references from typeahead
        const parsedTitles: ParsedTitle[] = (searchData.elements || []).map((el: any) => {
          // URN format: urn:li:title:123 or urn:li:adTargetingEntity:...
          const urn = el.urn || el.entity || '';
          const name = el.name?.localized?.en_US || 
                       el.name?.localized?.[Object.keys(el.name?.localized || {})[0]] ||
                       el.displayName ||
                       el.name ||
                       'Unknown Title';
          
          // Extract numeric ID from URN if present
          let id = '';
          const titleMatch = urn.match(/urn:li:title:(\d+)/);
          const superTitleMatchUrn = urn.match(/urn:li:superTitle:(\d+)/);
          
          if (titleMatch) {
            id = titleMatch[1];
          } else if (superTitleMatchUrn) {
            id = superTitleMatchUrn[1];
          }
          
          // Check if this is a super title based on URN format
          const isSuperTitle = urn.includes(':superTitle:');
          
          // IMPORTANT: Extract parent super title reference from typeahead payload
          // LinkedIn may return this in various fields
          const superTitleRef = el.superTitleUrn || el.superTitle || el.parentSuperTitle || el.parent || null;
          let superTitleUrn: string | null = null;
          let superTitleId: string | null = null;
          
          if (superTitleRef) {
            if (typeof superTitleRef === 'string') {
              superTitleUrn = superTitleRef;
              const idMatch = superTitleRef.match(/:(\d+)$/);
              if (idMatch) {
                superTitleId = idMatch[1];
              } else if (/^\d+$/.test(superTitleRef)) {
                superTitleId = superTitleRef;
                superTitleUrn = `urn:li:superTitle:${superTitleRef}`;
              }
            } else if (typeof superTitleRef === 'object' && superTitleRef !== null) {
              superTitleUrn = superTitleRef.urn || superTitleRef.entityUrn || null;
              superTitleId = superTitleRef.id ? String(superTitleRef.id) : 
                             (superTitleUrn?.match(/:(\d+)$/)?.[1] || null);
            } else if (typeof superTitleRef === 'number') {
              superTitleId = String(superTitleRef);
              superTitleUrn = `urn:li:superTitle:${superTitleId}`;
            }
            
            if (superTitleId) {
              console.log(`[search_job_titles] Typeahead element "${name}" has parent from payload: superTitleId=${superTitleId}`);
            }
          }
          
          return {
            id,
            urn,
            name: typeof name === 'string' ? name : JSON.stringify(name),
            targetable: true, // All returned results are targetable
            facetUrn: el.facetUrn || 'urn:li:adTargetingFacet:titles',
            isSuperTitle,
            superTitleId,
            superTitleUrn,
            parentSuperTitle: null,
          };
        });
        
        // For standard titles, try to fetch super title metadata
        const standardTitleIds = (parsedTitles as ParsedTitle[])
          .filter((t: ParsedTitle) => !t.isSuperTitle && t.id)
          .map((t: ParsedTitle) => t.id);

        // Extended type to include _superTitleId and _functionUrn for internal resolution
        let superTitleMetadata: Record<string, { urn: string; name: string; _superTitleId?: string; _functionUrn?: string }> = {};

        // Dynamic super title name cache - fetched from API
        const superTitleNamesCache: Record<string, string> = {};

        if (standardTitleIds.length > 0) {
          try {
            // Batch fetch metadata from standardizedTitles API
            const batchSize = 50;
            const uniqueSuperTitleIds = new Set<string>();

            for (let i = 0; i < standardTitleIds.length; i += batchSize) {
              const batchIds = standardTitleIds.slice(i, i + batchSize);
              const idsParam = `ids=List(${batchIds.join(',')})`;
              const metadataUrl = `https://api.linkedin.com/v2/standardizedTitles?${idsParam}`;

              console.log(`[search_job_titles] Fetching metadata for ${batchIds.length} titles`);

              const metadataResponse = await fetch(metadataUrl, {
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'X-Restli-Protocol-Version': '2.0.0',
                },
              });

              if (metadataResponse.ok) {
                const metadataData = await metadataResponse.json();
                const results = metadataData.results || {};

                // Debug: log ALL keys from API response
                const allKeys = Object.keys(results);
                console.log(`[search_job_titles] Requested IDs: ${JSON.stringify(batchIds)}`);
                console.log(`[search_job_titles] API returned ${allKeys.length} results with keys: ${JSON.stringify(allKeys)}`);

                for (const [titleId, titleData] of Object.entries(results)) {
                  const data = titleData as any;
                  const normalizedTitleId = titleId.replace(/^urn:li:title:/, '');
                  const wasRequested = batchIds.includes(normalizedTitleId) || batchIds.includes(titleId);

                  // Extract title name from API response for debugging
                  const apiTitleName = data.name?.localized?.en_US ||
                                       data.name?.localized?.[Object.keys(data.name?.localized || {})[0]] ||
                                       data.name ||
                                       'UNKNOWN';

                  console.log(`[search_job_titles] Result key="${titleId}", normalized="${normalizedTitleId}", wasRequested=${wasRequested}, hasSuperTitle=${!!data.superTitle}, apiName="${apiTitleName}"`);

                  if (data.superTitle) {
                    // Debug: log the actual superTitle value to understand its format
                    console.log(`[search_job_titles] Title "${normalizedTitleId}" superTitle value:`, JSON.stringify(data.superTitle));

                    // Handle multiple superTitle formats
                    let superTitleUrn: string | null = null;
                    let superTitleId: string | null = null;

                    if (typeof data.superTitle === 'string') {
                      // Format: "urn:li:superTitle:407" or just "407"
                      superTitleUrn = data.superTitle;
                      const idMatch = data.superTitle.match(/:(\d+)$/);
                      if (idMatch) {
                        superTitleId = idMatch[1];
                      } else if (/^\d+$/.test(data.superTitle)) {
                        superTitleId = data.superTitle;
                        superTitleUrn = `urn:li:superTitle:${data.superTitle}`;
                      }
                    } else if (typeof data.superTitle === 'object' && data.superTitle !== null) {
                      // Format: { id: "407", ... } or { urn: "urn:li:superTitle:407", ... }
                      console.log(`[search_job_titles] superTitle is object with keys: ${Object.keys(data.superTitle).join(', ')}`);
                      if (data.superTitle.urn) {
                        superTitleUrn = data.superTitle.urn;
                        const idMatch = data.superTitle.urn.match(/:(\d+)$/);
                        if (idMatch) superTitleId = idMatch[1];
                      } else if (data.superTitle.id) {
                        superTitleId = String(data.superTitle.id);
                        superTitleUrn = `urn:li:superTitle:${superTitleId}`;
                      }
                    } else if (typeof data.superTitle === 'number') {
                      // Format: 407 (numeric)
                      superTitleId = String(data.superTitle);
                      superTitleUrn = `urn:li:superTitle:${superTitleId}`;
                    }

                    console.log(`[search_job_titles] Parsed: superTitleUrn="${superTitleUrn}", superTitleId="${superTitleId}"`);

                    if (superTitleUrn && superTitleId) {
                      // ONLY store if this was actually a requested ID
                      if (wasRequested) {
                        // KEY FIX: Store mapping from TITLE ID to its SUPER TITLE ID
                        // This allows us to look up by title.id and get the correct parent
                        const titleFunctionUrn = data.jobFunction || data.function || null;
                        superTitleMetadata[normalizedTitleId] = {
                          urn: superTitleUrn,
                          name: '', // Will be resolved below by fetching from API
                          _superTitleId: superTitleId,
                          _functionUrn: typeof titleFunctionUrn === 'string' ? titleFunctionUrn : undefined,
                        };
                        uniqueSuperTitleIds.add(superTitleId);
                        console.log(`[search_job_titles] ✓ Stored: title "${normalizedTitleId}" -> superTitleId "${superTitleId}" (${superTitleUrn})`);
                      } else {
                        console.log(`[search_job_titles] ✗ Skipped unrequested result: "${normalizedTitleId}"`);
                      }
                    } else {
                      console.log(`[search_job_titles] ✗ Could not parse superTitle for "${normalizedTitleId}"`);
                    }
                  } else {
                    // No superTitle, but still capture jobFunction if present
                    if (wasRequested) {
                      const titleFunctionUrn = data.jobFunction || data.function || null;
                      if (titleFunctionUrn && !superTitleMetadata[normalizedTitleId]) {
                        superTitleMetadata[normalizedTitleId] = {
                          urn: '',
                          name: '',
                          _functionUrn: typeof titleFunctionUrn === 'string' ? titleFunctionUrn : undefined,
                        };
                      }
                    }
                    console.log(`[search_job_titles] Title "${normalizedTitleId}" has no superTitle field`);
                  }
                }

                // Debug: show what we stored vs what title.id values look like
                const storedKeys = Object.keys(superTitleMetadata);
                const titleIdsSample = (parsedTitles as ParsedTitle[]).slice(0, 5).map((t: ParsedTitle) => t.id);
                console.log(`[search_job_titles] Final stored metadata keys: ${JSON.stringify(storedKeys)}`);
                console.log(`[search_job_titles] Title IDs that need lookup: ${JSON.stringify(titleIdsSample)}`);
              } else {
                console.log(`[search_job_titles] Metadata fetch returned ${metadataResponse.status} - skipping super title detection`);
              }
            }

            // Fetch super title names from dedicated LinkedIn API endpoint
            if (uniqueSuperTitleIds.size > 0) {
              console.log(`[search_job_titles] Fetching names for ${uniqueSuperTitleIds.size} unique super titles: ${JSON.stringify([...uniqueSuperTitleIds])}`);

              const superTitleIdsParam = `ids=List(${[...uniqueSuperTitleIds].join(',')})`;
              const superTitlesUrl = `https://api.linkedin.com/v2/superTitles?${superTitleIdsParam}`;

              console.log(`[search_job_titles] Calling /v2/superTitles: ${superTitlesUrl}`);

              const superTitlesResponse = await fetch(superTitlesUrl, {
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'X-Restli-Protocol-Version': '2.0.0',
                },
              });

              if (superTitlesResponse.ok) {
                const superTitlesData = await superTitlesResponse.json();
                const results = superTitlesData.results || {};

                console.log(`[search_job_titles] /v2/superTitles returned ${Object.keys(results).length} results`);

                for (const [key, value] of Object.entries(results)) {
                  const stData = value as any;
                  // Key could be "407" or "urn:li:superTitle:407"
                  const stId = key.replace(/^urn:li:superTitle:/, '');

                  let name = '';
                  if (stData.name) {
                    if (typeof stData.name === 'string') {
                      name = stData.name;
                    } else if (stData.name.localized) {
                      name = stData.name.localized.en_US ||
                             stData.name.localized[Object.keys(stData.name.localized)[0]] || '';
                    }
                  }

                  if (name) {
                    superTitleNamesCache[stId] = name;
                    console.log(`[search_job_titles] ✓ Super title "${stId}" = "${name}"`);
                  }
                }
              } else {
                const errorText = await superTitlesResponse.text();
                console.log(`[search_job_titles] /v2/superTitles failed ${superTitlesResponse.status}: ${errorText.slice(0, 200)}`);
              }

              // Log final cache state
              console.log(`[search_job_titles] Super title cache after fetching: ${JSON.stringify(superTitleNamesCache)}`);
            }

            // Resolve super title names from cache
            const entriesWithSuperTitle = Object.entries(superTitleMetadata).filter(([_, v]) => (v as any)._superTitleId);
            for (const [titleId, metadata] of entriesWithSuperTitle) {
              const superTitleId = (metadata as any)._superTitleId;
              if (superTitleId && superTitleNamesCache[superTitleId]) {
                superTitleMetadata[titleId].name = superTitleNamesCache[superTitleId];
                console.log(`[search_job_titles] ✓ Resolved: title "${titleId}" -> "${superTitleNamesCache[superTitleId]}"`);
              }
            }
          } catch (metadataError) {
            console.log('[search_job_titles] Error fetching super title metadata:', metadataError);
            // Continue without super title info
          }
        }

        // Build reverse mapping from fetched super title names for isSuperTitle detection
        const superTitleNameToId: Record<string, string> = {};
        for (const [id, name] of Object.entries(superTitleNamesCache)) {
          superTitleNameToId[name.toLowerCase()] = id;
        }

        // Log full state before building final titles
        console.log(`[search_job_titles] FINAL STATE - superTitleNamesCache:`, JSON.stringify(superTitleNamesCache));
        console.log(`[search_job_titles] FINAL STATE - superTitleMetadata keys:`, Object.keys(superTitleMetadata));

        // Enhance titles with parent super title info and determine if title IS a super title
        const titles = parsedTitles.map((title: ParsedTitle) => {
          // Get the super title metadata for this title
          const metadata = superTitleMetadata[title.id] || null;
          const superTitleId = metadata ? (metadata as any)._superTitleId : null;

          // Log for each title
          console.log(`[search_job_titles] Processing "${title.name}" (id=${title.id}): metadata=${metadata ? 'found' : 'null'}, superTitleId=${superTitleId}, cachedName=${superTitleId ? superTitleNamesCache[superTitleId] : 'N/A'}`);

          // Determine if this title IS a super title:
          // 1. URN contains :superTitle: (already checked in isSuperTitle)
          // 2. Title name matches a known super title name AND its superTitle points to that category
          let isSuperTitle = title.isSuperTitle; // From URN check

          if (!isSuperTitle && superTitleId) {
            const normalizedName = title.name.toLowerCase().trim();
            const matchingSuperTitleId = superTitleNameToId[normalizedName];

            // If title name matches a super title name and the API confirms it belongs to that category
            if (matchingSuperTitleId && matchingSuperTitleId === superTitleId) {
              isSuperTitle = true;
              console.log(`[search_job_titles] "${title.name}" IS a super title (name matches and superTitleId=${superTitleId})`);
            }
          }

          // Build parent super title info (only for non-super-titles)
          let parentSuperTitle: { urn: string; name: string } | null = null;

          if (!isSuperTitle && metadata && superTitleId) {
            const superTitleName = superTitleNamesCache[superTitleId] || '';
            console.log(`[search_job_titles] "${title.name}" -> superTitleId "${superTitleId}" -> resolved name: "${superTitleName}"`);
            if (superTitleName) {
              parentSuperTitle = {
                urn: metadata.urn,
                name: superTitleName,
              };
            }
          }

          // Build job function info
          const functionUrn = metadata?._functionUrn || null;
          const stFunctionNames: Record<string, string> = {
            'urn:li:function:1': 'Accounting', 'urn:li:function:2': 'Administrative',
            'urn:li:function:3': 'Arts & Design', 'urn:li:function:4': 'Business Development',
            'urn:li:function:5': 'Community & Social Services', 'urn:li:function:6': 'Consulting',
            'urn:li:function:7': 'Education', 'urn:li:function:8': 'Engineering',
            'urn:li:function:9': 'Entrepreneurship', 'urn:li:function:10': 'Finance',
            'urn:li:function:11': 'Healthcare Services', 'urn:li:function:12': 'Human Resources',
            'urn:li:function:13': 'Information Technology', 'urn:li:function:14': 'Legal',
            'urn:li:function:15': 'Marketing', 'urn:li:function:16': 'Media & Communications',
            'urn:li:function:17': 'Military & Protective Services', 'urn:li:function:18': 'Operations',
            'urn:li:function:19': 'Product Management', 'urn:li:function:20': 'Program & Project Management',
            'urn:li:function:21': 'Purchasing', 'urn:li:function:22': 'Quality Assurance',
            'urn:li:function:23': 'Real Estate', 'urn:li:function:24': 'Research',
            'urn:li:function:25': 'Sales', 'urn:li:function:26': 'Support',
          };
          const jobFunction = functionUrn ? {
            urn: functionUrn,
            name: stFunctionNames[functionUrn] || functionUrn,
          } : null;

          return {
            ...title,
            isSuperTitle,
            parentSuperTitle,
            jobFunction,
          };
        });

        // Final summary log: show all title-to-superTitle mappings for debugging
        const mappingSummary = titles
          .filter((t: any) => t.parentSuperTitle?.name)
          .map((t: any) => `"${t.name}" (${t.id}) -> "${t.parentSuperTitle.name}"`)
          .join(', ');
        console.log(`[search_job_titles] FINAL MAPPINGS: ${mappingSummary || 'none'}`);

        return new Response(JSON.stringify({
          titles,
          source: 'adTargetingEntities',
          count: titles.length
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'get_title_details': {
        // Search titles via typeahead, then fetch full details from /v2/titles API
        // Returns each title with its resolved function name and super title name
        const { query: tdQuery } = params || {};
        if (!tdQuery || tdQuery.trim().length < 2) {
          return new Response(JSON.stringify({ titles: [], message: 'Query must be at least 2 characters' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        console.log(`[get_title_details] Searching for: "${tdQuery}"`);

        // Step 1: Use typeahead to find matching title IDs
        const tdSearchParams = new URLSearchParams({
          q: 'typeahead',
          facet: 'urn:li:adTargetingFacet:titles',
          query: tdQuery.trim(),
          count: '50',
        });
        const tdSearchUrl = `https://api.linkedin.com/rest/adTargetingEntities?${tdSearchParams.toString()}`;
        const tdSearchResp = await fetch(tdSearchUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0',
            'LinkedIn-Version': '202511',
          },
        });

        if (!tdSearchResp.ok) {
          const errText = await tdSearchResp.text();
          console.error(`[get_title_details] Typeahead failed ${tdSearchResp.status}: ${errText.slice(0, 200)}`);
          return new Response(JSON.stringify({ error: 'Title search not available', titles: [] }), {
            status: tdSearchResp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const tdSearchData = await tdSearchResp.json();
        const tdElements = tdSearchData.elements || [];
        console.log(`[get_title_details] Typeahead returned ${tdElements.length} results`);

        // Extract title IDs from typeahead results
        const tdParsed = tdElements.map((el: any) => {
          const urn = el.urn || el.entity || '';
          const name = el.name?.localized?.en_US ||
                       el.name?.localized?.[Object.keys(el.name?.localized || {})[0]] ||
                       el.displayName || el.name || '';
          const titleMatch = urn.match(/urn:li:title:(\d+)/);
          const superTitleMatch = urn.match(/urn:li:superTitle:(\d+)/);
          const id = titleMatch ? titleMatch[1] : (superTitleMatch ? superTitleMatch[1] : '');
          const isSuperTitle = urn.includes(':superTitle:');
          return { id, urn, name: typeof name === 'string' ? name : JSON.stringify(name), isSuperTitle };
        }).filter((t: any) => t.id);

        // Step 2: Batch fetch full title details from /v2/titles API
        // This returns { function: "urn:li:function:8", superTitle: "urn:li:superTitle:407", name: {...} }
        const titleIds = tdParsed.filter((t: any) => !t.isSuperTitle).map((t: any) => t.id);
        const tdFunctionMap: Record<string, string> = {};
        const tdSuperTitleUrnMap: Record<string, string> = {};

        if (titleIds.length > 0) {
          // Batch in groups of 20 (using ids=X&ids=Y format from LinkedIn docs)
          for (let i = 0; i < titleIds.length; i += 20) {
            const batch = titleIds.slice(i, i + 20);
            const idsParam = batch.map((id: string) => `ids=${id}`).join('&');
            const titlesUrl = `https://api.linkedin.com/v2/titles?${idsParam}&locale=en_US`;
            console.log(`[get_title_details] Fetching /v2/titles batch: ${batch.length} IDs`);

            try {
              const titlesResp = await fetch(titlesUrl, {
                headers: { 'Authorization': `Bearer ${accessToken}`, 'X-Restli-Protocol-Version': '2.0.0' },
              });
              if (titlesResp.ok) {
                const titlesData = await titlesResp.json();
                const results = titlesData.results || {};
                for (const [key, value] of Object.entries(results)) {
                  const d = value as any;
                  const tid = key.replace(/^urn:li:title:/, '');
                  if (d.function) tdFunctionMap[tid] = d.function;
                  if (d.superTitle) tdSuperTitleUrnMap[tid] = d.superTitle;
                }
                console.log(`[get_title_details] /v2/titles batch returned ${Object.keys(results).length} results`);
              } else {
                console.log(`[get_title_details] /v2/titles batch failed: ${titlesResp.status}`);
              }
            } catch (e) {
              console.log(`[get_title_details] /v2/titles batch error:`, e);
            }
          }
        }

        // Step 3: Batch resolve super title names
        const tdUniqueSuperTitleIds = new Set<string>();
        for (const stUrn of Object.values(tdSuperTitleUrnMap)) {
          const stId = stUrn.replace(/^urn:li:superTitle:/, '');
          if (stId) tdUniqueSuperTitleIds.add(stId);
        }

        const tdSuperTitleNames: Record<string, string> = {};
        if (tdUniqueSuperTitleIds.size > 0) {
          const stUrl = `https://api.linkedin.com/v2/superTitles?ids=List(${[...tdUniqueSuperTitleIds].join(',')})`;
          console.log(`[get_title_details] Resolving ${tdUniqueSuperTitleIds.size} super titles`);
          try {
            const stResp = await fetch(stUrl, {
              headers: { 'Authorization': `Bearer ${accessToken}`, 'X-Restli-Protocol-Version': '2.0.0' },
            });
            if (stResp.ok) {
              const stData = await stResp.json();
              for (const [key, value] of Object.entries(stData.results || {})) {
                const d = value as any;
                const stId = key.replace(/^urn:li:superTitle:/, '');
                let name = '';
                if (d.name) {
                  if (typeof d.name === 'string') name = d.name;
                  else if (d.name.localized) name = d.name.localized.en_US || d.name.localized[Object.keys(d.name.localized)[0]] || '';
                }
                if (name) tdSuperTitleNames[stId] = name;
              }
              console.log(`[get_title_details] Resolved ${Object.keys(tdSuperTitleNames).length} super title names`);
            }
          } catch (e) {
            console.log(`[get_title_details] Super titles error:`, e);
          }
        }

        // Step 4: Build enriched response
        const tdFunctionNames: Record<string, string> = {
          'urn:li:function:1': 'Accounting', 'urn:li:function:2': 'Administrative',
          'urn:li:function:3': 'Arts & Design', 'urn:li:function:4': 'Business Development',
          'urn:li:function:5': 'Community & Social Services', 'urn:li:function:6': 'Consulting',
          'urn:li:function:7': 'Education', 'urn:li:function:8': 'Engineering',
          'urn:li:function:9': 'Entrepreneurship', 'urn:li:function:10': 'Finance',
          'urn:li:function:11': 'Healthcare Services', 'urn:li:function:12': 'Human Resources',
          'urn:li:function:13': 'Information Technology', 'urn:li:function:14': 'Legal',
          'urn:li:function:15': 'Marketing', 'urn:li:function:16': 'Media & Communications',
          'urn:li:function:17': 'Military & Protective Services', 'urn:li:function:18': 'Operations',
          'urn:li:function:19': 'Product Management', 'urn:li:function:20': 'Program & Project Management',
          'urn:li:function:21': 'Purchasing', 'urn:li:function:22': 'Quality Assurance',
          'urn:li:function:23': 'Real Estate', 'urn:li:function:24': 'Research',
          'urn:li:function:25': 'Sales', 'urn:li:function:26': 'Support',
        };

        const tdTitles = tdParsed.map((t: any) => {
          const funcUrn = tdFunctionMap[t.id] || null;
          const stUrn = tdSuperTitleUrnMap[t.id] || null;
          const stId = stUrn ? stUrn.replace(/^urn:li:superTitle:/, '') : null;

          return {
            id: t.id,
            urn: t.urn,
            name: t.name,
            isSuperTitle: t.isSuperTitle,
            jobFunction: funcUrn ? { urn: funcUrn, name: tdFunctionNames[funcUrn] || funcUrn } : null,
            parentSuperTitle: stId && tdSuperTitleNames[stId] ? { urn: stUrn, name: tdSuperTitleNames[stId] } : null,
          };
        });

        console.log(`[get_title_details] Complete: ${tdTitles.length} titles with ${Object.keys(tdFunctionMap).length} functions resolved, ${Object.keys(tdSuperTitleNames).length} super titles resolved`);
        return new Response(JSON.stringify({ titles: tdTitles, count: tdTitles.length }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'search_skills': {
        const { query } = params;
        
        if (!query || query.trim().length < 2) {
          return new Response(JSON.stringify({ 
            skills: [],
            message: 'Query must be at least 2 characters'
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        
        console.log(`[search_skills] Searching for skills matching "${query}"`);
        
        // Use adTargetingEntities typeahead API with skills facet
        const searchParams = new URLSearchParams({
          q: 'typeahead',
          facet: 'urn:li:adTargetingFacet:skills',
          query: query.trim(),
          count: '50',
        });
        
        const searchUrl = `https://api.linkedin.com/rest/adTargetingEntities?${searchParams}`;
        console.log(`[search_skills] Calling API: ${searchUrl}`);
        
        const searchResponse = await fetch(searchUrl, {
          headers: { 
            'Authorization': `Bearer ${accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0',
            'LinkedIn-Version': '202511',
          },
        });
        
        if (!searchResponse.ok) {
          const errorText = await searchResponse.text();
          console.error(`[search_skills] API error ${searchResponse.status}:`, errorText);
          return new Response(JSON.stringify({ 
            error: `LinkedIn API error: ${searchResponse.status}`,
            details: errorText
          }), { 
            status: searchResponse.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }
        
        const searchData = await searchResponse.json();
        console.log(`[search_skills] Typeahead returned ${searchData.elements?.length || 0} results`);
        
        // Parse the adTargetingEntities response
        const skills = (searchData.elements || []).map((el: any) => {
          const urn = el.urn || el.entity || '';
          const name = el.name?.localized?.en_US || 
                       el.name?.localized?.[Object.keys(el.name?.localized || {})[0]] ||
                       el.displayName ||
                       el.name ||
                       'Unknown Skill';
          
          // Extract numeric ID from URN (urn:li:skill:123)
          let id = '';
          const skillMatch = urn.match(/urn:li:skill:(\d+)/);
          if (skillMatch) {
            id = skillMatch[1];
          }
          
          return {
            id,
            urn,
            name: typeof name === 'string' ? name : JSON.stringify(name),
            targetable: true, // All returned results are targetable
            facetUrn: el.facetUrn || 'urn:li:adTargetingFacet:skills',
          };
        });
        
        return new Response(JSON.stringify({ 
          skills,
          source: 'adTargetingEntities',
          count: skills.length
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'sync_ad_accounts': {
        // Sync all ad accounts to database for the authenticated user
        // This reuses get_ad_accounts logic but also persists to DB
        
        console.log('[sync_ad_accounts] Starting account sync...');
        
        // Get user from authorization header
        const authHeader = req.headers.get('Authorization');
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
        const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
        
        // Import Supabase client dynamically
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
        const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          global: { headers: { Authorization: authHeader || '' } }
        });
        
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
        if (userError || !user) {
          console.error('[sync_ad_accounts] Failed to get user:', userError);
          return new Response(JSON.stringify({ 
            success: false, 
            error: 'Authentication required' 
          }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Discover accounts using same logic as get_ad_accounts
        const accountsMap = new Map<string, any>();
        const userRoles = new Map<string, { role: string; accessSource: string }>();
        
        // Step 1: Try REST adAccountUsers
        try {
          const usersResponse = await fetch(
            'https://api.linkedin.com/rest/adAccountUsers?q=authenticatedUser',
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'LinkedIn-Version': '202511',
                'X-Restli-Protocol-Version': '2.0.0',
              },
            }
          );
          
          if (usersResponse.ok) {
            const usersData = await usersResponse.json();
            for (const el of (usersData?.elements || [])) {
              const accountUrn = el.account || '';
              const accountId = accountUrn.split(':').pop();
              if (accountId) {
                userRoles.set(accountId, { role: el.role || 'UNKNOWN', accessSource: 'authenticatedUser' });
              }
            }
          }
        } catch (err) {
          console.error('[sync_ad_accounts] Error fetching adAccountUsers:', err);
        }
        
        // Step 2: Fetch via search
        try {
          const searchResponse = await fetch(
            'https://api.linkedin.com/v2/adAccountsV2?q=search&search.status.values[0]=ACTIVE',
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
          );
          
          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            for (const acc of (searchData?.elements || [])) {
              if (acc.id) {
                const accId = String(acc.id);
                const roleInfo = userRoles.get(accId);
                acc.userRole = roleInfo?.role || 'DIRECT_ACCESS';
                acc.accessSource = roleInfo?.accessSource || 'search';
                accountsMap.set(accId, acc);
              }
            }
          }
        } catch (err) {
          console.error('[sync_ad_accounts] Error fetching via search:', err);
        }
        
        // Step 3: Fetch missing accounts individually
        const missingAccountIds = [...userRoles.keys()].filter(id => !accountsMap.has(id));
        for (const accId of missingAccountIds) {
          try {
            const accResponse = await fetch(
              `https://api.linkedin.com/v2/adAccountsV2/${accId}`,
              { headers: { 'Authorization': `Bearer ${accessToken}` } }
            );
            
            if (accResponse.ok) {
              const acc = await accResponse.json();
              if (acc && acc.status === 'ACTIVE') {
                const roleInfo = userRoles.get(accId);
                acc.userRole = roleInfo?.role || 'UNKNOWN';
                acc.accessSource = 'authenticatedUser';
                accountsMap.set(accId, acc);
              }
            }
          } catch (err) {
            // Continue
          }
        }
        
        const writeCapableRoles = ['ACCOUNT_MANAGER', 'CAMPAIGN_MANAGER', 'CREATIVE_MANAGER'];
        
        const allAccounts = Array.from(accountsMap.values())
          .filter((acc: any) => acc.status === 'ACTIVE')
          .map((acc: any) => ({
            id: String(acc.id),
            accountUrn: `urn:li:sponsoredAccount:${acc.id}`,
            name: acc.name || `Account ${acc.id}`,
            currency: acc.currency || 'USD',
            status: acc.status,
            type: acc.type || 'UNKNOWN',
            userRole: acc.userRole || 'UNKNOWN',
            accessSource: acc.accessSource || 'unknown',
            canWrite: writeCapableRoles.includes(acc.userRole || ''),
          }));
        
        console.log(`[sync_ad_accounts] Discovered ${allAccounts.length} accounts`);
        
        // Upsert all accounts to database
        const now = new Date().toISOString();
        const { error: upsertError } = await supabaseClient
          .from('linkedin_ad_accounts')
          .upsert(
            allAccounts.map(acc => ({
              user_id: user.id,
              account_id: acc.id,
              account_urn: acc.accountUrn,
              name: acc.name,
              status: acc.status,
              type: acc.type,
              currency: acc.currency,
              user_role: acc.userRole,
              can_write: acc.canWrite,
              last_synced_at: now,
            })),
            { onConflict: 'user_id,account_id' }
          );
        
        if (upsertError) {
          console.error('[sync_ad_accounts] Error upserting accounts:', upsertError);
        }
        
        // Check if user's default account still exists
        const { data: defaultAcc } = await supabaseClient
          .from('user_linked_accounts')
          .select('account_id')
          .eq('user_id', user.id)
          .eq('is_default', true)
          .single();
        
        const defaultStillExists = defaultAcc && 
          allAccounts.some(a => a.id === defaultAcc.account_id);
        
        if (!defaultStillExists && defaultAcc) {
          // Unset default if account no longer accessible
          await supabaseClient
            .from('user_linked_accounts')
            .update({ is_default: false })
            .eq('user_id', user.id)
            .eq('account_id', defaultAcc.account_id);
          
          console.log(`[sync_ad_accounts] Invalidated default account ${defaultAcc.account_id} - no longer accessible`);
        }
        
        return new Response(JSON.stringify({
          success: true,
          accounts: allAccounts,
          syncedAt: now,
          defaultInvalidated: !defaultStillExists && !!defaultAcc,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'bulk_search_titles': {
        // Bulk resolve job titles - accepts array of title strings, returns matched entities
        const { titles } = params;
        
        if (!titles || !Array.isArray(titles) || titles.length === 0) {
          return new Response(JSON.stringify({ 
            results: [],
            notFound: [],
            message: 'No titles provided'
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        
        // Limit to 50 titles per request
        const limitedTitles = titles.slice(0, 50);
        console.log(`[bulk_search_titles] Processing ${limitedTitles.length} titles`);
        
        const results: any[] = [];
        const notFound: string[] = [];
        
        // Process titles sequentially with small delay to avoid rate limiting
        for (const title of limitedTitles) {
          const trimmedTitle = title.trim();
          if (!trimmedTitle || trimmedTitle.length < 2) {
            notFound.push(title);
            continue;
          }
          
          try {
            const searchParams = new URLSearchParams({
              q: 'typeahead',
              facet: 'urn:li:adTargetingFacet:titles',
              query: trimmedTitle,
              count: '5', // Get top 5 matches for each
            });
            
            const searchUrl = `https://api.linkedin.com/rest/adTargetingEntities?${searchParams}`;
            const response = await fetch(searchUrl, {
              headers: { 
                'Authorization': `Bearer ${accessToken}`,
                'X-Restli-Protocol-Version': '2.0.0',
                'LinkedIn-Version': '202511',
              },
            });
            
            if (response.ok) {
              const data = await response.json();
              const elements = data.elements || [];
              
              // Find best match (exact or closest)
              const lowerTitle = trimmedTitle.toLowerCase();
              let bestMatch = null;
              
              for (const el of elements) {
                const name = el.name?.localized?.en_US || 
                             el.name?.localized?.[Object.keys(el.name?.localized || {})[0]] ||
                             el.displayName || '';
                
                if (typeof name === 'string' && name.toLowerCase() === lowerTitle) {
                  bestMatch = el;
                  break;
                }
              }
              
              // If no exact match, use first result
              if (!bestMatch && elements.length > 0) {
                bestMatch = elements[0];
              }
              
              if (bestMatch) {
                const urn = bestMatch.urn || bestMatch.entity || '';
                const name = bestMatch.name?.localized?.en_US || 
                             bestMatch.name?.localized?.[Object.keys(bestMatch.name?.localized || {})[0]] ||
                             bestMatch.displayName || trimmedTitle;
                
                let id = '';
                const titleMatch = urn.match(/urn:li:title:(\d+)/);
                if (titleMatch) id = titleMatch[1];
                
                results.push({
                  id,
                  urn,
                  name: typeof name === 'string' ? name : String(name),
                  type: 'title',
                  targetable: true,
                  originalQuery: trimmedTitle,
                });
              } else {
                notFound.push(trimmedTitle);
              }
            } else {
              console.log(`[bulk_search_titles] Failed for "${trimmedTitle}": ${response.status}`);
              notFound.push(trimmedTitle);
            }
          } catch (err) {
            console.log(`[bulk_search_titles] Error for "${trimmedTitle}":`, err);
            notFound.push(trimmedTitle);
          }
          
          // Small delay between requests
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        console.log(`[bulk_search_titles] Done: ${results.length} matched, ${notFound.length} not found`);
        
        return new Response(JSON.stringify({ 
          results,
          notFound,
          count: results.length
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'get_title_suggestions': {
        const { titleNames, excludeUrns: excludeTitleUrns } = params || {};

        if (!titleNames || !Array.isArray(titleNames) || titleNames.length === 0) {
          return new Response(JSON.stringify({ suggestions: [] }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const excludeTitleSet = new Set<string>(excludeTitleUrns || []);
        const titleSuggestionMap = new Map<string, any>();

        // Build queries: full title + first word for broader results
        const titleQueries = new Set<string>();
        for (const titleName of titleNames.slice(0, 3)) {
          const trimmed = titleName.trim();
          if (!trimmed || trimmed.length < 2) continue;
          titleQueries.add(trimmed);
          const firstWord = trimmed.split(/\s+/)[0];
          if (firstWord.length >= 3 && firstWord !== trimmed) titleQueries.add(firstWord);
        }

        for (const query of titleQueries) {
          try {
            const searchParams = new URLSearchParams({
              q: 'typeahead',
              facet: 'urn:li:adTargetingFacet:titles',
              query,
              count: '20',
            });

            const response = await fetch(
              `https://api.linkedin.com/rest/adTargetingEntities?${searchParams}`,
              {
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'X-Restli-Protocol-Version': '2.0.0',
                  'LinkedIn-Version': '202511',
                },
              }
            );

            if (response.ok) {
              const data = await response.json();
              console.log(`[get_title_suggestions] query="${query}" returned ${data.elements?.length || 0} elements`);
              for (const el of (data.elements || [])) {
                const urn = el.urn || el.entity || '';
                if (!urn || titleSuggestionMap.has(urn)) continue;
                const name = el.name?.localized?.en_US ||
                             el.name?.localized?.[Object.keys(el.name?.localized || {})[0]] ||
                             el.displayName ||
                             (typeof el.name === 'string' ? el.name : '') || '';
                if (!name) continue;
                let id = '';
                const titleMatch = urn.match(/urn:li:title:(\d+)/);
                if (titleMatch) id = titleMatch[1];
                titleSuggestionMap.set(urn, {
                  id,
                  urn,
                  name: typeof name === 'string' ? name : String(name),
                  type: 'title',
                  targetable: true,
                  excluded: excludeTitleSet.has(urn),
                });
              }
            }
          } catch (err) {
            console.log(`[get_title_suggestions] Error for "${query}":`, err);
          }

          await new Promise(resolve => setTimeout(resolve, 50));
        }

        const titleSuggestions = Array.from(titleSuggestionMap.values())
          .filter(s => !s.excluded)
          .map(({ excluded: _excluded, ...s }) => s)
          .slice(0, 20);
        console.log(`[get_title_suggestions] Returning ${titleSuggestions.length} suggestions for ${titleNames.length} seed titles`);

        return new Response(JSON.stringify({ suggestions: titleSuggestions }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'bulk_search_skills': {
        const { skills } = params;

        if (!skills || !Array.isArray(skills) || skills.length === 0) {
          return new Response(JSON.stringify({
            results: [],
            notFound: [],
            message: 'No skills provided'
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const limitedSkills = skills.slice(0, 50);
        console.log(`[bulk_search_skills] Processing ${limitedSkills.length} skills`);

        const results: any[] = [];
        const notFound: string[] = [];

        for (const skill of limitedSkills) {
          const trimmedSkill = skill.trim();
          if (!trimmedSkill || trimmedSkill.length < 2) {
            notFound.push(skill);
            continue;
          }

          try {
            const searchParams = new URLSearchParams({
              q: 'typeahead',
              facet: 'urn:li:adTargetingFacet:skills',
              query: trimmedSkill,
              count: '5',
            });

            const searchUrl = `https://api.linkedin.com/rest/adTargetingEntities?${searchParams}`;
            const response = await fetch(searchUrl, {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'X-Restli-Protocol-Version': '2.0.0',
                'LinkedIn-Version': '202511',
              },
            });

            if (response.ok) {
              const data = await response.json();
              const elements = data.elements || [];

              const lowerSkill = trimmedSkill.toLowerCase();
              let bestMatch = null;

              for (const el of elements) {
                const name = el.name?.localized?.en_US ||
                             el.name?.localized?.[Object.keys(el.name?.localized || {})[0]] ||
                             el.displayName || '';
                if (typeof name === 'string' && name.toLowerCase() === lowerSkill) {
                  bestMatch = el;
                  break;
                }
              }

              if (!bestMatch && elements.length > 0) bestMatch = elements[0];

              if (bestMatch) {
                const urn = bestMatch.urn || bestMatch.entity || '';
                const name = bestMatch.name?.localized?.en_US ||
                             bestMatch.name?.localized?.[Object.keys(bestMatch.name?.localized || {})[0]] ||
                             bestMatch.displayName || trimmedSkill;
                let id = '';
                const skillMatch = urn.match(/urn:li:skill:(\d+)/);
                if (skillMatch) id = skillMatch[1];

                results.push({
                  id,
                  urn,
                  name: typeof name === 'string' ? name : String(name),
                  type: 'skill',
                  targetable: true,
                  originalQuery: trimmedSkill,
                });
              } else {
                notFound.push(trimmedSkill);
              }
            } else {
              console.log(`[bulk_search_skills] Failed for "${trimmedSkill}": ${response.status}`);
              notFound.push(trimmedSkill);
            }
          } catch (err) {
            console.log(`[bulk_search_skills] Error for "${trimmedSkill}":`, err);
            notFound.push(trimmedSkill);
          }

          await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log(`[bulk_search_skills] Done: ${results.length} matched, ${notFound.length} not found`);

        return new Response(JSON.stringify({
          results,
          notFound,
          count: results.length
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'get_skill_suggestions': {
        const { skillNames, excludeUrns } = params || {};

        if (!skillNames || !Array.isArray(skillNames) || skillNames.length === 0) {
          return new Response(JSON.stringify({ suggestions: [] }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const excludeSet = new Set<string>(excludeUrns || []);
        const suggestionMap = new Map<string, any>();

        // Build a deduplicated set of queries: for each skill, use the full name
        // AND the first word (e.g. "Okta Identity Cloud" → also search "Okta")
        // This casts a wider net when the full name returns only exact matches.
        const queries = new Set<string>();
        for (const skillName of skillNames.slice(0, 3)) {
          const trimmed = skillName.trim();
          if (!trimmed || trimmed.length < 2) continue;
          queries.add(trimmed);
          const firstWord = trimmed.split(/\s+/)[0];
          if (firstWord.length >= 3 && firstWord !== trimmed) queries.add(firstWord);
        }

        for (const query of queries) {
          try {
            const searchParams = new URLSearchParams({
              q: 'typeahead',
              facet: 'urn:li:adTargetingFacet:skills',
              query,
              count: '20',
            });

            const response = await fetch(
              `https://api.linkedin.com/rest/adTargetingEntities?${searchParams}`,
              {
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'X-Restli-Protocol-Version': '2.0.0',
                  'LinkedIn-Version': '202511',
                },
              }
            );

            if (response.ok) {
              const data = await response.json();
              console.log(`[get_skill_suggestions] query="${query}" returned ${data.elements?.length || 0} elements`);
              for (const el of (data.elements || [])) {
                const urn = el.urn || el.entity || '';
                if (!urn || suggestionMap.has(urn)) continue;
                const name = el.name?.localized?.en_US ||
                             el.name?.localized?.[Object.keys(el.name?.localized || {})[0]] ||
                             el.displayName ||
                             (typeof el.name === 'string' ? el.name : '') || '';
                if (!name) continue;
                let id = '';
                const skillMatch = urn.match(/urn:li:skill:(\d+)/);
                if (skillMatch) id = skillMatch[1];
                suggestionMap.set(urn, {
                  id,
                  urn,
                  name: typeof name === 'string' ? name : String(name),
                  type: 'skill',
                  targetable: true,
                  excluded: excludeSet.has(urn),
                });
              }
            }
          } catch (err) {
            console.log(`[get_skill_suggestions] Error for "${query}":`, err);
          }

          await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Return all results; frontend filters out already-selected ones
        const suggestions = Array.from(suggestionMap.values())
          .filter(s => !s.excluded)
          .map(({ excluded: _excluded, ...s }) => s)
          .slice(0, 20);
        console.log(`[get_skill_suggestions] Returning ${suggestions.length} suggestions for ${skillNames.length} seed skills`);

        return new Response(JSON.stringify({ suggestions }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'get_skills_for_titles': {
        // Derive skill suggestions from job title names.
        // LinkedIn has no direct cross-facet API, so we extract functional keywords
        // from titles (skipping common title stop words) and run skills typeahead.
        const { titleNames, excludeUrns: stExcludeUrns = [] } = params || {};

        if (!titleNames || !Array.isArray(titleNames) || titleNames.length === 0) {
          return new Response(JSON.stringify({ suggestions: [] }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Stop words: common title qualifiers that don't map to skills
        const titleStopWords = new Set([
          'chief', 'vice', 'vp', 'president', 'director', 'manager', 'head',
          'lead', 'senior', 'junior', 'associate', 'assistant', 'officer',
          'executive', 'global', 'regional', 'national', 'principal', 'staff',
          'the', 'of', 'and', 'for', 'in', 'at', 'to', 'a', 'an', 'de',
          'general', 'group', 'corporate', 'enterprise', 'business', 'strategic',
        ]);

        const stExcludeSet = new Set<string>(stExcludeUrns);
        const stSuggestionMap = new Map<string, any>();
        const stQueries = new Set<string>();

        for (const titleName of titleNames.slice(0, 5)) {
          const words = titleName.toLowerCase().split(/[\s\-&/,]+/);
          for (const word of words) {
            const cleaned = word.replace(/[^a-z]/g, '');
            if (cleaned.length >= 4 && !titleStopWords.has(cleaned)) {
              stQueries.add(cleaned.charAt(0).toUpperCase() + cleaned.slice(1)); // capitalize
            }
          }
        }

        console.log(`[get_skills_for_titles] titles=${titleNames.length} → queries: ${JSON.stringify([...stQueries])}`);

        for (const query of stQueries) {
          try {
            const sp = new URLSearchParams({ q: 'typeahead', facet: 'urn:li:adTargetingFacet:skills', query, count: '15' });
            const resp = await fetch(`https://api.linkedin.com/rest/adTargetingEntities?${sp}`, {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'X-Restli-Protocol-Version': '2.0.0',
                'LinkedIn-Version': '202511',
              },
            });
            if (resp.ok) {
              const d = await resp.json();
              for (const el of (d.elements || [])) {
                const urn = el.urn || el.entity || '';
                if (!urn || stSuggestionMap.has(urn)) continue;
                const name = el.name?.localized?.en_US ||
                             el.name?.localized?.[Object.keys(el.name?.localized || {})[0]] ||
                             el.displayName ||
                             (typeof el.name === 'string' ? el.name : '') || '';
                if (!name) continue;
                const skillMatch = urn.match(/urn:li:skill:(\d+)/);
                stSuggestionMap.set(urn, {
                  id: skillMatch ? skillMatch[1] : '',
                  urn,
                  name: typeof name === 'string' ? name : String(name),
                  type: 'skill',
                  targetable: true,
                  excluded: stExcludeSet.has(urn),
                });
              }
            }
          } catch (err) {
            console.log(`[get_skills_for_titles] Error for "${query}":`, err);
          }
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        const stSuggestions = Array.from(stSuggestionMap.values())
          .filter(s => !s.excluded)
          .map(({ excluded: _, ...s }) => s)
          .slice(0, 20);

        console.log(`[get_skills_for_titles] Returning ${stSuggestions.length} skill suggestions`);
        return new Response(JSON.stringify({ suggestions: stSuggestions }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'get_audience_count': {
        // LinkedIn Audience Counts API - estimate reach for targeting criteria
        // Docs: https://learn.microsoft.com/en-us/linkedin/marketing/integrations/ads/advertising-targeting/audience-counts
        const { titleUrns = [], skillUrns = [] } = params;

        if (titleUrns.length === 0 && skillUrns.length === 0) {
          return new Response(JSON.stringify({ total: 0, active: 0 }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // URL-encode URN colons per Restli 2.0 requirement
        const e = (urn: string) => urn.replace(/:/g, '%3A');

        const facets: string[] = [];
        if (titleUrns.length > 0) {
          const facetKey = e('urn:li:adTargetingFacet:titles');
          const titleList = titleUrns.map((u: string) => e(u)).join(',');
          facets.push(`(or:(${facetKey}:List(${titleList})))`);
        }
        if (skillUrns.length > 0) {
          const facetKey = e('urn:li:adTargetingFacet:skills');
          const skillList = skillUrns.map((u: string) => e(u)).join(',');
          facets.push(`(or:(${facetKey}:List(${skillList})))`);
        }

        const targetingCriteria = `(include:(and:List(${facets.join(',')})))`;
        const url = `https://api.linkedin.com/rest/audienceCounts?q=targetingCriteriaV2&targetingCriteria=${targetingCriteria}`;

        console.log(`[get_audience_count] titles=${titleUrns.length} skills=${skillUrns.length}`);
        const acResponse = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0',
            'LinkedIn-Version': '202511',
          }
        });

        if (!acResponse.ok) {
          const errText = await acResponse.text();
          console.error(`[get_audience_count] API error ${acResponse.status}: ${errText}`);
          return new Response(JSON.stringify({ error: `API error ${acResponse.status}`, total: 0, active: 0 }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const acData = await acResponse.json();
        const element = acData.elements?.[0];
        console.log(`[get_audience_count] total=${element?.total} active=${element?.active}`);

        return new Response(JSON.stringify({
          total: element?.total ?? 0,
          active: element?.active ?? 0,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'update_campaign_targeting': {
        // Support both single campaignId and array of campaignIds
        // NOTE: accountId is no longer required - derived from campaign
        const { campaignId, campaignIds, titleUrns, skillUrns, mode } = params;
        
        // Normalize to array
        const idsToUpdate: string[] = campaignIds && Array.isArray(campaignIds) 
          ? campaignIds 
          : (campaignId ? [campaignId] : []);
        
        if (idsToUpdate.length === 0) {
          return new Response(JSON.stringify({ 
            success: false, 
            message: 'Campaign ID(s) are required' 
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        console.log(`[update_campaign_targeting] Updating ${idsToUpdate.length} campaigns, Mode: ${mode}`);
        console.log(`[update_campaign_targeting] Titles: ${titleUrns?.length || 0}, Skills: ${skillUrns?.length || 0}`);
        
        // Initialize Supabase client for permission checks
        const authHeader = req.headers.get('Authorization');
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
        const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
        
        const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          global: { headers: { Authorization: authHeader || '' } }
        });
        
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
        if (userError || !user) {
          return new Response(JSON.stringify({ 
            success: false, 
            message: 'Authentication required' 
          }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const results: { campaignId: string; success: boolean; message: string; errorCode?: string; accountId?: string }[] = [];
        
        for (const currentCampaignId of idsToUpdate) {
          try {
            // Step 1: Fetch campaign to get targeting AND derive account
            let existingTargeting: any = null;
            let campaignAccountUrn: string | null = null;
            
            const campaignUrl = `https://api.linkedin.com/v2/adCampaignsV2/${currentCampaignId}`;
            const campaignResponse = await fetch(campaignUrl, {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'X-Restli-Protocol-Version': '2.0.0',
                'LinkedIn-Version': '202511',
              }
            });
            
            if (campaignResponse.ok) {
              const campaignData = await campaignResponse.json();
              existingTargeting = campaignData.targetingCriteria || {};
              
              // Extract account URN from campaign (commonly: account or accountUrn field)
              campaignAccountUrn = campaignData.account || campaignData.accountUrn || null;
              console.log(`[update_campaign_targeting] Campaign ${currentCampaignId} belongs to account: ${campaignAccountUrn}`);
            } else {
              const errText = await campaignResponse.text();
              console.error(`[update_campaign_targeting] Failed to fetch campaign ${currentCampaignId}: ${campaignResponse.status}`, errText);
              results.push({
                campaignId: currentCampaignId,
                success: false,
                message: `Could not fetch campaign: ${campaignResponse.status}`,
                errorCode: 'CAMPAIGN_FETCH_FAILED'
              });
              continue;
            }
            
            // Step 2: Derive accountId from URN
            const derivedAccountId = campaignAccountUrn?.split(':').pop() || null;
            
            if (!derivedAccountId) {
              console.error(`[update_campaign_targeting] Missing account URN on campaign ${currentCampaignId}`);
              results.push({
                campaignId: currentCampaignId,
                success: false,
                message: 'Could not determine ad account for this campaign.',
                errorCode: 'ACCOUNT_NOT_FOUND_ON_CAMPAIGN'
              });
              continue;
            }
            
            // Step 3: Check cached permissions from linkedin_ad_accounts table
            let { data: accRow, error: accErr } = await supabaseClient
              .from('linkedin_ad_accounts')
              .select('can_write, user_role, account_urn')
              .eq('user_id', user.id)
              .eq('account_id', derivedAccountId)
              .maybeSingle();
            
            // If not in cache, attempt to sync accounts and retry once
            if (!accRow) {
              console.log(`[update_campaign_targeting] Account ${derivedAccountId} not in cache, triggering discovery...`);
              
              // Inline minimal discovery for this specific account
              try {
                const accResponse = await fetch(
                  `https://api.linkedin.com/v2/adAccountsV2/${derivedAccountId}`,
                  { headers: { 'Authorization': `Bearer ${accessToken}` } }
                );
                
                if (accResponse.ok) {
                  const accData = await accResponse.json();
                  
                  // Get user's role on this account
                  let userRole = 'UNKNOWN';
                  try {
                    const usersResponse = await fetch(
                      'https://api.linkedin.com/rest/adAccountUsers?q=authenticatedUser',
                      {
                        headers: {
                          'Authorization': `Bearer ${accessToken}`,
                          'LinkedIn-Version': '202511',
                          'X-Restli-Protocol-Version': '2.0.0',
                        },
                      }
                    );
                    if (usersResponse.ok) {
                      const usersData = await usersResponse.json();
                      for (const el of (usersData?.elements || [])) {
                        const accountId = (el.account || '').split(':').pop();
                        if (accountId === derivedAccountId) {
                          userRole = el.role || 'UNKNOWN';
                          break;
                        }
                      }
                    }
                  } catch (e) {
                    console.log('[update_campaign_targeting] Could not fetch user role:', e);
                  }
                  
                  const writeCapableRoles = ['ACCOUNT_MANAGER', 'CAMPAIGN_MANAGER', 'CREATIVE_MANAGER'];
                  const canWrite = writeCapableRoles.includes(userRole);
                  
                  // Upsert to cache
                  await supabaseClient
                    .from('linkedin_ad_accounts')
                    .upsert({
                      user_id: user.id,
                      account_id: derivedAccountId,
                      account_urn: `urn:li:sponsoredAccount:${derivedAccountId}`,
                      name: accData.name || `Account ${derivedAccountId}`,
                      status: accData.status || 'ACTIVE',
                      type: accData.type || 'UNKNOWN',
                      currency: accData.currency || 'USD',
                      user_role: userRole,
                      can_write: canWrite,
                      last_synced_at: new Date().toISOString(),
                    }, { onConflict: 'user_id,account_id' });
                  
                  // Re-query
                  const { data: accRow2 } = await supabaseClient
                    .from('linkedin_ad_accounts')
                    .select('can_write, user_role, account_urn')
                    .eq('user_id', user.id)
                    .eq('account_id', derivedAccountId)
                    .maybeSingle();
                  
                  accRow = accRow2;
                }
              } catch (discoverErr) {
                console.error('[update_campaign_targeting] Discovery failed:', discoverErr);
              }
              
              // If still not found after discovery
              if (!accRow) {
                results.push({
                  campaignId: currentCampaignId,
                  success: false,
                  message: 'This campaign belongs to an ad account you cannot access in this app.',
                  errorCode: 'ACCOUNT_NOT_ACCESSIBLE',
                  accountId: derivedAccountId
                });
                continue;
              }
            }
            
            // Step 4: Gate on can_write - don't even attempt PATCH if false
            if (!accRow.can_write) {
              console.log(`[update_campaign_targeting] User lacks write permission on account ${derivedAccountId} (role: ${accRow.user_role})`);
              results.push({
                campaignId: currentCampaignId,
                success: false,
                message: `You don't have a write-capable role on this ad account (role: ${accRow.user_role || 'UNKNOWN'}). Needs Account/Campaign Manager.`,
                errorCode: 'ROLE_INSUFFICIENT',
                accountId: derivedAccountId
              });
              continue;
            }
            
            // Step 5: Build targeting criteria
            let targetingCriteria: any;
            
            if (mode === 'replace') {
              const existingAndClauses: any[] = existingTargeting?.include?.and || [];
              
              const requiredFacetPrefixes = [
                'urn:li:adTargetingFacet:locations',
                'urn:li:adTargetingFacet:profileLocations', 
                'urn:li:adTargetingFacet:ipLocations',
                'urn:li:adTargetingFacet:interfaceLocales',
                'urn:li:adTargetingFacet:locales',
              ];
              
              const replacedFacets = [
                'urn:li:adTargetingFacet:titles',
                'urn:li:adTargetingFacet:skills',
              ];
              
              const preservedClauses = existingAndClauses.filter((clause: any) => {
                if (!clause.or) return true;
                const facetKeys = Object.keys(clause.or);
                const hasRequiredFacet = facetKeys.some(key => 
                  requiredFacetPrefixes.some(prefix => key.startsWith(prefix))
                );
                const hasReplacedFacet = facetKeys.some(key =>
                  replacedFacets.includes(key)
                );
                return hasRequiredFacet || !hasReplacedFacet;
              });
              
              const newAndClauses = [...preservedClauses];
              
              if (titleUrns && titleUrns.length > 0) {
                newAndClauses.push({
                  or: { 'urn:li:adTargetingFacet:titles': titleUrns }
                });
              }
              
              if (skillUrns && skillUrns.length > 0) {
                newAndClauses.push({
                  or: { 'urn:li:adTargetingFacet:skills': skillUrns }
                });
              }
              
              targetingCriteria = {
                include: { and: newAndClauses },
                exclude: existingTargeting?.exclude || {}
              };
            } else {
              // APPEND MODE
              const existingAndClauses: any[] = existingTargeting?.include?.and || [];
              const newAndClauses = [...existingAndClauses];
              
              if (titleUrns && titleUrns.length > 0) {
                newAndClauses.push({
                  or: { 'urn:li:adTargetingFacet:titles': titleUrns }
                });
              }
              
              if (skillUrns && skillUrns.length > 0) {
                newAndClauses.push({
                  or: { 'urn:li:adTargetingFacet:skills': skillUrns }
                });
              }
              
              targetingCriteria = {
                include: { and: newAndClauses },
                exclude: existingTargeting?.exclude || {}
              };
            }
            
            // Step 6: Perform PATCH update
            const updateUrl = `https://api.linkedin.com/v2/adCampaignsV2/${currentCampaignId}`;
            const updatePayload = {
              patch: {
                $set: {
                  targetingCriteria
                }
              }
            };
            
            const updateResponse = await fetch(updateUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'X-Restli-Method': 'partial_update',
                'X-Restli-Protocol-Version': '2.0.0',
                'LinkedIn-Version': '202511',
              },
              body: JSON.stringify(updatePayload)
            });
            
            if (updateResponse.ok) {
              results.push({ 
                campaignId: currentCampaignId, 
                success: true, 
                message: 'Updated',
                accountId: derivedAccountId 
              });
            } else {
              const errorText = await updateResponse.text();
              console.error(`[update_campaign_targeting] LinkedIn error for campaign ${currentCampaignId}: ${updateResponse.status}`, errorText);
              
              let errorMessage = `Failed: ${updateResponse.status}`;
              let errorCode = 'UNKNOWN_ERROR';
              
              if (updateResponse.status === 401) {
                errorMessage = 'Your LinkedIn session has expired. Please re-authenticate.';
                errorCode = 'TOKEN_EXPIRED';
              } else if (updateResponse.status === 403) {
                // Robust 403 classification based on actual LinkedIn error messages
                const txt = (errorText || '').toLowerCase();
                
                const isTierOrAllowlist =
                  txt.includes('account management list') ||
                  txt.includes('added the account id') ||
                  txt.includes('add the account id') ||
                  txt.includes('not authorized for this account') ||
                  txt.includes('application is not authorized') ||
                  txt.includes('not configured to access') ||
                  txt.includes('not approved');
                
                const isRoleIssue =
                  txt.includes('insufficient') ||
                  txt.includes('do not have permission') ||
                  txt.includes('does not have the required role') ||
                  txt.includes('not have permission');
                
                if (isTierOrAllowlist) {
                  errorMessage = 'LinkedIn blocked this write because the app isn\'t authorized for this ad account (Account Management allowlist / tier restriction).';
                  errorCode = 'APP_NOT_AUTHORIZED_FOR_ACCOUNT';
                } else if (isRoleIssue) {
                  errorMessage = 'You don\'t have a write-capable role on this ad account (needs Account/Campaign/Creative Manager).';
                  errorCode = 'ROLE_INSUFFICIENT';
                } else {
                  errorMessage = 'LinkedIn denied this action (403). See error details for the exact restriction.';
                  errorCode = 'FORBIDDEN';
                }
              } else if (updateResponse.status === 400 || updateResponse.status === 404) {
                errorMessage = 'Invalid account or campaign ID. The resource may have been deleted.';
                errorCode = 'INVALID_RESOURCE';
              } else {
                try {
                  const errorJson = JSON.parse(errorText);
                  errorMessage = errorJson.message || errorMessage;
                } catch {}
              }
              
              results.push({ 
                campaignId: currentCampaignId, 
                success: false, 
                message: errorMessage,
                errorCode,
                accountId: derivedAccountId
              });
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            results.push({ campaignId: currentCampaignId, success: false, message });
          }
          
          // Small delay between campaign updates
          if (idsToUpdate.length > 1) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
        
        const successCount = results.filter(r => r.success).length;
        const allSuccess = successCount === idsToUpdate.length;
        
        console.log(`[update_campaign_targeting] Completed: ${successCount}/${idsToUpdate.length} successful`);
        
        return new Response(JSON.stringify({ 
          success: allSuccess,
          message: allSuccess 
            ? `Targeting ${mode === 'append' ? 'appended' : 'replaced'} on ${successCount} campaign(s)`
            : `${successCount}/${idsToUpdate.length} campaigns updated`,
          results,
          titlesAdded: titleUrns?.length || 0,
          skillsAdded: skillUrns?.length || 0,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'exclude_companies_from_campaigns': {
        // Exclude companies from campaign targeting
        const { campaignIds: excludeCampaignIds, companyUrns } = params || {};
        
        if (!excludeCampaignIds || excludeCampaignIds.length === 0) {
          return new Response(JSON.stringify({ error: 'campaignIds required' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        if (!companyUrns || companyUrns.length === 0) {
          return new Response(JSON.stringify({ error: 'companyUrns required' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        console.log(`[exclude_companies] Excluding ${companyUrns.length} companies from ${excludeCampaignIds.length} campaigns`);
        
        const excludeResults: any[] = [];
        
        for (const campaignId of excludeCampaignIds) {
          try {
            // Fetch existing campaign targeting
            const campUrl = `https://api.linkedin.com/v2/adCampaignsV2/${campaignId}?fields=targetingCriteria`;
            const campResp = await fetch(campUrl, {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'X-Restli-Protocol-Version': '2.0.0',
                'LinkedIn-Version': '202511',
              },
            });
            
            if (!campResp.ok) {
              const errText = await campResp.text();
              excludeResults.push({ campaignId, success: false, message: `Failed to fetch campaign: ${campResp.status}` });
              continue;
            }
            
            const campData = await campResp.json();
            const existingTargeting = campData.targetingCriteria || {};
            
            // Build new exclude criteria - merge with existing
            const existingExclude = existingTargeting.exclude || {};
            const existingExcludeOr = existingExclude.or || {};
            
            // LinkedIn uses "urn:li:adTargetingFacet:employers" for company exclusions
            const existingEmployerExclusions: string[] = existingExcludeOr['urn:li:adTargetingFacet:employers'] || [];
            
            // Merge new company URNs (avoid duplicates)
            const newExclusions = [...new Set([...existingEmployerExclusions, ...companyUrns])];
            
            const targetingCriteria = {
              include: existingTargeting.include || { and: [] },
              exclude: {
                or: {
                  ...existingExcludeOr,
                  'urn:li:adTargetingFacet:employers': newExclusions,
                }
              }
            };
            
            // PATCH update
            const updateUrl = `https://api.linkedin.com/v2/adCampaignsV2/${campaignId}`;
            const updatePayload = {
              patch: {
                $set: { targetingCriteria }
              }
            };
            
            const updateResp = await fetch(updateUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'X-Restli-Method': 'partial_update',
                'X-Restli-Protocol-Version': '2.0.0',
                'LinkedIn-Version': '202511',
              },
              body: JSON.stringify(updatePayload),
            });
            
            if (updateResp.ok) {
              excludeResults.push({ campaignId, success: true });
            } else {
              const errText = await updateResp.text();
              console.error(`[exclude_companies] LinkedIn error for ${campaignId}: ${updateResp.status}`, errText);
              excludeResults.push({ campaignId, success: false, message: `LinkedIn error: ${updateResp.status}` });
            }
            
            // Rate limit delay
            if (excludeCampaignIds.length > 1) {
              await new Promise(r => setTimeout(r, 200));
            }
          } catch (err) {
            excludeResults.push({ campaignId, success: false, message: (err as Error).message || 'Unknown error' });
          }
        }
        
        const excSuccessCount = excludeResults.filter(r => r.success).length;
        console.log(`[exclude_companies] Completed: ${excSuccessCount}/${excludeCampaignIds.length} successful`);
        
        return new Response(JSON.stringify({
          success: excSuccessCount === excludeCampaignIds.length,
          results: excludeResults,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'get_budget_pacing': {
        // Budget Pacing Dashboard - compares actual spend vs planned budget
        const { accountId, dateRange } = params || {};
        const now = new Date();
        // Format as YYYY-MM-01 for date column compatibility
        const currentMonthDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        // Default to current month if no date range specified
        const startDate = dateRange?.start || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        const endDate = dateRange?.end || now.toISOString().split('T')[0];

        const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
        const [endYear, endMonth, endDay] = endDate.split('-').map(Number);

        console.log(`[get_budget_pacing] Account ${accountId}, period: ${startDate} to ${endDate}`);

        // Step 1: Fetch daily spend data
        const dailySpendUrl = `https://api.linkedin.com/v2/adAnalyticsV2?q=analytics&` +
          `dateRange.start.day=${startDay}&dateRange.start.month=${startMonth}&dateRange.start.year=${startYear}&` +
          `dateRange.end.day=${endDay}&dateRange.end.month=${endMonth}&dateRange.end.year=${endYear}&` +
          `timeGranularity=DAILY&pivot=ACCOUNT&accounts[0]=urn:li:sponsoredAccount:${accountId}&` +
          `fields=dateRange,costInLocalCurrency,impressions,clicks,oneClickLeads,externalWebsiteConversions&count=100`;

        const dailyData: Array<{
          date: string;
          spend: number;
          impressions: number;
          clicks: number;
          leads: number;
        }> = [];

        try {
          const response = await fetch(dailySpendUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });

          if (response.ok) {
            const data = await response.json();
            for (const el of (data.elements || [])) {
              const dr = el.dateRange?.start;
              if (dr) {
                const dateStr = `${dr.year}-${String(dr.month).padStart(2, '0')}-${String(dr.day).padStart(2, '0')}`;
                dailyData.push({
                  date: dateStr,
                  spend: parseFloat(el.costInLocalCurrency || '0'),
                  impressions: el.impressions || 0,
                  clicks: el.clicks || 0,
                  leads: (el.oneClickLeads || 0) + (el.externalWebsiteConversions || 0),
                });
              }
            }
          }
        } catch (err) {
          console.error('[get_budget_pacing] Daily spend fetch error:', err);
        }

        // Sort by date
        dailyData.sort((a, b) => a.date.localeCompare(b.date));

        // Step 2: Fetch budget from Supabase (if exists)
        let budgetAmount = 0;
        let budgetCurrency = 'USD';

        try {
          const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
          const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
          const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
          const supabase = createClient(supabaseUrl, supabaseKey);

          // Query with YYYY-MM-01 format for the date column
          const { data: budgetData, error: budgetError } = await supabase
            .from('account_budgets')
            .select('budget_amount, currency')
            .eq('account_id', accountId)
            .eq('month', currentMonthDate)
            .single();

          console.log(`[get_budget_pacing] Budget query for ${accountId}, month ${currentMonthDate}:`, budgetData, budgetError);

          if (budgetData) {
            budgetAmount = budgetData.budget_amount || 0;
            budgetCurrency = budgetData.currency || 'USD';
          }
        } catch (err) {
          console.log('[get_budget_pacing] Budget fetch error (may not exist):', err);
        }

        // Step 3: Calculate pacing metrics
        const totalSpent = dailyData.reduce((sum, d) => sum + d.spend, 0);
        const totalImpressions = dailyData.reduce((sum, d) => sum + d.impressions, 0);
        const totalClicks = dailyData.reduce((sum, d) => sum + d.clicks, 0);
        const totalLeads = dailyData.reduce((sum, d) => sum + d.leads, 0);

        const daysElapsed = dailyData.length;
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const daysRemaining = daysInMonth - now.getDate();

        const avgDailySpend = daysElapsed > 0 ? totalSpent / daysElapsed : 0;
        const projectedMonthSpend = avgDailySpend * daysInMonth;
        const idealDailySpend = budgetAmount > 0 ? budgetAmount / daysInMonth : 0;
        const idealSpentToDate = idealDailySpend * now.getDate();

        // Pacing status
        let pacingStatus: 'on_track' | 'underspend' | 'overspend' = 'on_track';
        let pacingPercent = 0;

        if (budgetAmount > 0) {
          pacingPercent = (totalSpent / idealSpentToDate) * 100;
          if (pacingPercent < 85) pacingStatus = 'underspend';
          else if (pacingPercent > 115) pacingStatus = 'overspend';
        }

        // Calculate 7-day trend
        const last7Days = dailyData.slice(-7);
        const prev7Days = dailyData.slice(-14, -7);
        const last7Spend = last7Days.reduce((sum, d) => sum + d.spend, 0);
        const prev7Spend = prev7Days.reduce((sum, d) => sum + d.spend, 0);
        const spendTrend = prev7Spend > 0 ? ((last7Spend - prev7Spend) / prev7Spend) * 100 : 0;

        // Generate recommendations
        const recommendations: string[] = [];

        if (budgetAmount > 0) {
          if (pacingStatus === 'underspend') {
            const deficit = idealSpentToDate - totalSpent;
            const increasedDaily = (budgetAmount - totalSpent) / Math.max(daysRemaining, 1);
            recommendations.push(`Increase daily spend by $${(increasedDaily - avgDailySpend).toFixed(0)} to hit budget`);
            recommendations.push(`Consider increasing bids or expanding audience`);
          } else if (pacingStatus === 'overspend') {
            const surplus = totalSpent - idealSpentToDate;
            recommendations.push(`Currently $${surplus.toFixed(0)} over pace - consider reducing bids`);
            recommendations.push(`Projected to exceed budget by $${(projectedMonthSpend - budgetAmount).toFixed(0)}`);
          }
        }

        if (totalLeads > 0) {
          const cpl = totalSpent / totalLeads;
          recommendations.push(`Current CPL: $${cpl.toFixed(2)} - ${cpl < 100 ? 'Good efficiency' : 'Consider optimization'}`);
        }

        console.log(`[get_budget_pacing] Complete. ${daysElapsed} days, $${totalSpent.toFixed(2)} spent, ${pacingStatus}`);

        return new Response(JSON.stringify({
          period: { start: startDate, end: endDate, month: currentMonth },
          budget: {
            amount: budgetAmount,
            currency: budgetCurrency,
            isSet: budgetAmount > 0,
          },
          spending: {
            total: totalSpent,
            daily: dailyData,
            avgDaily: avgDailySpend,
            projected: projectedMonthSpend,
          },
          pacing: {
            status: pacingStatus,
            percent: pacingPercent,
            idealSpentToDate,
            daysElapsed,
            daysRemaining,
            daysInMonth,
          },
          performance: {
            impressions: totalImpressions,
            clicks: totalClicks,
            leads: totalLeads,
            ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
            cpl: totalLeads > 0 ? totalSpent / totalLeads : 0,
          },
          trends: {
            last7DaysSpend: last7Spend,
            prev7DaysSpend: prev7Spend,
            spendTrendPercent: spendTrend,
          },
          recommendations,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'get_creative_fatigue': {
        // Creative Fatigue Detector - analyzes performance trends over time
        const { accountId, dateRange, thresholds } = params || {};
        const now = new Date();
        const startDate = dateRange?.start || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const endDate = dateRange?.end || now.toISOString().split('T')[0];

        const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
        const [endYear, endMonth, endDay] = endDate.split('-').map(Number);

        // Configurable thresholds
        const ctrDeclineThreshold = thresholds?.ctrDecline || 20; // % decline to flag
        const cplIncreaseThreshold = thresholds?.cplIncrease || 30; // % increase to flag
        const minImpressions = thresholds?.minImpressions || 1000; // Min impressions to analyze

        console.log(`[get_creative_fatigue] Account ${accountId}, period: ${startDate} to ${endDate}`);

        // Step 1: Fetch creative-level daily analytics
        const analyticsUrl = `https://api.linkedin.com/v2/adAnalyticsV2?q=analytics&` +
          `dateRange.start.day=${startDay}&dateRange.start.month=${startMonth}&dateRange.start.year=${startYear}&` +
          `dateRange.end.day=${endDay}&dateRange.end.month=${endMonth}&dateRange.end.year=${endYear}&` +
          `timeGranularity=DAILY&pivot=CREATIVE&accounts[0]=urn:li:sponsoredAccount:${accountId}&` +
          `fields=dateRange,pivotValue,impressions,clicks,costInLocalCurrency,oneClickLeads,externalWebsiteConversions,oneClickLeadFormOpens&count=10000`;

        const creativeDaily = new Map<string, Array<{
          date: string;
          impressions: number;
          clicks: number;
          spend: number;
          leads: number;
          formOpens: number;
        }>>();

        try {
          const response = await fetch(analyticsUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });

          if (response.ok) {
            const data = await response.json();
            for (const el of (data.elements || [])) {
              const creativeUrn = el.pivotValue || '';
              const dr = el.dateRange?.start;
              if (!creativeUrn || !dr) continue;

              const dateStr = `${dr.year}-${String(dr.month).padStart(2, '0')}-${String(dr.day).padStart(2, '0')}`;

              if (!creativeDaily.has(creativeUrn)) {
                creativeDaily.set(creativeUrn, []);
              }

              creativeDaily.get(creativeUrn)!.push({
                date: dateStr,
                impressions: el.impressions || 0,
                clicks: el.clicks || 0,
                spend: parseFloat(el.costInLocalCurrency || '0'),
                leads: (el.oneClickLeads || 0) + (el.externalWebsiteConversions || 0),
                formOpens: el.oneClickLeadFormOpens || 0,
              });
            }
          }
        } catch (err) {
          console.error('[get_creative_fatigue] Analytics fetch error:', err);
        }

        console.log(`[get_creative_fatigue] Found ${creativeDaily.size} creatives with daily data`);

        // Step 2: Fetch creative names using multi-stage resolution (matching creative report approach)
        const creativeNames = new Map<string, string>();
        const creativeMetadata = new Map<string, { name: string; reference: string; campaignUrn: string }>();
        const creativeUrns = Array.from(creativeDaily.keys());
        console.log(`[get_creative_fatigue] Need names for ${creativeUrns.length} creatives`);

        let namesResolved = 0;

        // Step 2A: Try batch fetch from adCreativesV2 API first (fast batch fetch)
        try {
          const batchUrl = `https://api.linkedin.com/v2/adCreativesV2?q=search&search.account.values[0]=urn:li:sponsoredAccount:${accountId}&count=500`;
          const batchResp = await fetch(batchUrl, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'LinkedIn-Version': '202511',
              'X-Restli-Protocol-Version': '2.0.0'
            }
          });

          if (batchResp.ok) {
            const batchData = await batchResp.json();
            for (const creative of (batchData.elements || [])) {
              const creativeId = creative.id?.toString() || '';
              const name = creative.name || creative.creativeDscName || '';
              const reference = creative.reference || '';
              const campaignUrn = creative.campaign || '';
              const urn = `urn:li:sponsoredCreative:${creativeId}`;
              creativeMetadata.set(urn, { name, reference, campaignUrn });
              
              if (name) {
                creativeNames.set(urn, name);
                namesResolved++;
              }
            }
            console.log(`[get_creative_fatigue] adCreativesV2 batch: got metadata for ${creativeMetadata.size} creatives, ${namesResolved} with names`);
          } else {
            console.log(`[get_creative_fatigue] adCreativesV2 batch returned ${batchResp.status}`);
          }
        } catch (err) {
          console.error('[get_creative_fatigue] adCreativesV2 batch fetch error:', err);
        }

        // Step 2B: Individual REST API lookup for creatives without names
        const needsLookup = creativeUrns.filter(urn => !creativeNames.has(urn));
        console.log(`[get_creative_fatigue] Need individual lookup for ${needsLookup.length} creatives`);

        const batchSize = 10;
        for (let i = 0; i < needsLookup.length && i < 50; i += batchSize) {
          const batch = needsLookup.slice(i, i + batchSize);

          await Promise.all(batch.map(async (creativeUrn) => {
            try {
              const encodedUrn = encodeURIComponent(creativeUrn);
              const creativeUrl = `https://api.linkedin.com/rest/adAccounts/${accountId}/creatives/${encodedUrn}`;

              const creativeResp = await fetch(creativeUrl, {
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'LinkedIn-Version': '202511',
                  'X-Restli-Protocol-Version': '2.0.0'
                }
              });

              if (creativeResp.ok) {
                const creativeDetail = await creativeResp.json();
                if (creativeDetail.name && typeof creativeDetail.name === 'string') {
                  creativeNames.set(creativeUrn, creativeDetail.name);
                  namesResolved++;
                }
                // Store reference and campaign for share/ugc fallback
                if (!creativeMetadata.has(creativeUrn)) {
                  creativeMetadata.set(creativeUrn, { 
                    name: creativeDetail.name || '', 
                    reference: creativeDetail.reference || '',
                    campaignUrn: creativeDetail.campaign || ''
                  });
                }
              }
            } catch (err) {
              // Silently continue on error
            }
          }));
        }

        console.log(`[get_creative_fatigue] After REST lookups: ${namesResolved} names resolved`);

        // Step 2C: Share/UGC text fallback for creatives with reference but no name
        const needsShareFallback = creativeUrns.filter(urn => {
          if (creativeNames.has(urn)) return false;
          const meta = creativeMetadata.get(urn);
          return meta?.reference && (meta.reference.includes('share') || meta.reference.includes('ugcPost'));
        });

        console.log(`[get_creative_fatigue] Trying share/UGC fallback for ${needsShareFallback.length} creatives`);

        for (let i = 0; i < needsShareFallback.length && i < 30; i += 5) {
          const batch = needsShareFallback.slice(i, i + 5);

          await Promise.all(batch.map(async (creativeUrn) => {
            const meta = creativeMetadata.get(creativeUrn);
            if (!meta?.reference) return;

            try {
              const isUgc = meta.reference.includes('ugcPost');
              const endpoint = isUgc
                ? `https://api.linkedin.com/v2/ugcPosts/${encodeURIComponent(meta.reference)}`
                : `https://api.linkedin.com/v2/shares/${encodeURIComponent(meta.reference)}`;

              const resp = await fetch(endpoint, {
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'LinkedIn-Version': '202511',
                  'X-Restli-Protocol-Version': '2.0.0'
                }
              });

              if (resp.ok) {
                const data = await resp.json();
                let text = '';
                if (isUgc) {
                  text = data.specificContent?.['com.linkedin.ugc.ShareContent']?.shareCommentary?.text || '';
                } else {
                  text = data.text?.text || '';
                }
                if (text) {
                  // Truncate to first 60 chars
                  const truncatedText = text.slice(0, 60) + (text.length > 60 ? '...' : '');
                  creativeNames.set(creativeUrn, truncatedText);
                  namesResolved++;
                }
              }
            } catch (e) {
              // Continue on error
            }
          }));
        }

        console.log(`[get_creative_fatigue] FINAL: Resolved ${namesResolved} creative names out of ${creativeUrns.length}`);

        // Step 2D: Fetch ALL campaigns for this account to get objectives
        // Use V2 API which is more reliable for campaign metadata
        const campaignObjectives = new Map<string, string>();

        try {
          const campaignsUrl = `https://api.linkedin.com/v2/adCampaignsV2?q=search&search.account.values[0]=urn:li:sponsoredAccount:${accountId}&count=500`;
          const campaignsResp = await fetch(campaignsUrl, {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          });

          if (campaignsResp.ok) {
            const campaignsData = await campaignsResp.json();
            for (const campaign of (campaignsData.elements || [])) {
              const campaignId = campaign.id?.toString() || '';
              const campaignUrn = `urn:li:sponsoredCampaign:${campaignId}`;
              const objectiveType = campaign.objectiveType || campaign.type || '';
              if (campaignId && objectiveType) {
                campaignObjectives.set(campaignUrn, objectiveType);
                // Also store by ID for fallback
                campaignObjectives.set(campaignId, objectiveType);
              }
            }
            console.log(`[get_creative_fatigue] Got objectives for ${campaignObjectives.size / 2} campaigns`);
          } else {
            console.log(`[get_creative_fatigue] Campaigns API returned ${campaignsResp.status}`);
          }
        } catch (err) {
          console.error('[get_creative_fatigue] Campaign objectives fetch error:', err);
        }

        // Step 3: Analyze each creative for fatigue signals
        const fatigueAnalysis: Array<{
          creativeId: string;
          creativeName: string;
          campaignId?: string;
           objectiveType?: string;
          primaryMetric?: string;
          status: 'healthy' | 'warning' | 'fatigued';
          signals: string[];
          metrics: {
            totalImpressions: number;
            totalSpend: number;
            totalLeads: number;
            avgCtr: number;
            avgCpl: number;
            ctrTrend: number;
            cplTrend: number;
            impressionTrend: number;
          };
          recommendation: string;
          dailyData: Array<{ date: string; ctr: number; cpl: number; impressions: number }>;
        }> = [];

        for (const [creativeUrn, dailyData] of creativeDaily.entries()) {
          // Sort by date
          dailyData.sort((a, b) => a.date.localeCompare(b.date));

          // Calculate totals
          const totalImpressions = dailyData.reduce((sum, d) => sum + d.impressions, 0);
          const totalClicks = dailyData.reduce((sum, d) => sum + d.clicks, 0);
          const totalSpend = dailyData.reduce((sum, d) => sum + d.spend, 0);
          const totalLeads = dailyData.reduce((sum, d) => sum + d.leads, 0);

          // Skip low-volume creatives
          if (totalImpressions < minImpressions) continue;

          const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
          const avgCpl = totalLeads > 0 ? totalSpend / totalLeads : 0;

          // Calculate weekly trends (compare last 7 days vs previous 7 days)
          const last7 = dailyData.slice(-7);
          const prev7 = dailyData.slice(-14, -7);

          const last7Impr = last7.reduce((sum, d) => sum + d.impressions, 0);
          const last7Clicks = last7.reduce((sum, d) => sum + d.clicks, 0);
          const last7Spend = last7.reduce((sum, d) => sum + d.spend, 0);
          const last7Leads = last7.reduce((sum, d) => sum + d.leads, 0);

          const prev7Impr = prev7.reduce((sum, d) => sum + d.impressions, 0);
          const prev7Clicks = prev7.reduce((sum, d) => sum + d.clicks, 0);
          const prev7Spend = prev7.reduce((sum, d) => sum + d.spend, 0);
          const prev7Leads = prev7.reduce((sum, d) => sum + d.leads, 0);

          const last7Ctr = last7Impr > 0 ? (last7Clicks / last7Impr) * 100 : 0;
          const prev7Ctr = prev7Impr > 0 ? (prev7Clicks / prev7Impr) * 100 : 0;
          const last7Cpl = last7Leads > 0 ? last7Spend / last7Leads : 0;
          const prev7Cpl = prev7Leads > 0 ? prev7Spend / prev7Leads : 0;

          // Calculate trend percentages
          const ctrTrend = prev7Ctr > 0 ? ((last7Ctr - prev7Ctr) / prev7Ctr) * 100 : 0;
          const cplTrend = prev7Cpl > 0 ? ((last7Cpl - prev7Cpl) / prev7Cpl) * 100 : 0;
          const impressionTrend = prev7Impr > 0 ? ((last7Impr - prev7Impr) / prev7Impr) * 100 : 0;

          // Get campaign/objective info for this creative (needed for objective-specific fatigue detection)
          const creativeMeta = creativeMetadata.get(creativeUrn);
          const campaignUrn = creativeMeta?.campaignUrn || '';
          const campaignId = campaignUrn.split(':').pop() || '';
          // Try both URN and ID lookup for objectiveType
          const objectiveType = campaignObjectives.get(campaignUrn) || campaignObjectives.get(campaignId) || '';

          // Detect fatigue signals - OBJECTIVE-SPECIFIC LOGIC
          const signals: string[] = [];
          let status: 'healthy' | 'warning' | 'fatigued' = 'healthy';
          let primaryMetric = 'CTR'; // Default primary metric

          // Apply different thresholds and focus metrics based on campaign objective
          if (objectiveType === 'LEAD_GENERATION') {
            // Lead Generation: Focus primarily on CPL (Cost Per Lead)
            primaryMetric = 'CPL';
            const cplThreshold = cplIncreaseThreshold * 0.8; // More sensitive to CPL changes (24% instead of 30%)

            if (cplTrend > cplThreshold && totalLeads > 0) {
              signals.push(`CPL increased ${cplTrend.toFixed(0)}% ($${prev7Cpl.toFixed(0)} → $${last7Cpl.toFixed(0)}) - Lead costs rising`);
              status = cplTrend > cplThreshold * 1.5 ? 'fatigued' : 'warning';
            }
            // Secondary check: CTR with higher tolerance
            if (ctrTrend < -ctrDeclineThreshold * 1.25 && status !== 'fatigued') {
              signals.push(`CTR declined ${Math.abs(ctrTrend).toFixed(0)}% (${prev7Ctr.toFixed(2)}% → ${last7Ctr.toFixed(2)}%)`);
              if (status === 'healthy') status = 'warning';
            }
          } else if (objectiveType === 'ENGAGEMENT') {
            // Engagement: Focus primarily on CTR (Click-Through Rate)
            primaryMetric = 'CTR';
            const ctrThreshold = ctrDeclineThreshold * 0.8; // More sensitive to CTR changes (16% instead of 20%)

            if (ctrTrend < -ctrThreshold) {
              signals.push(`CTR declined ${Math.abs(ctrTrend).toFixed(0)}% (${prev7Ctr.toFixed(2)}% → ${last7Ctr.toFixed(2)}%) - Engagement dropping`);
              status = ctrTrend < -ctrThreshold * 1.5 ? 'fatigued' : 'warning';
            }
            // Secondary check: Impression trend
            if (impressionTrend < -30 && status !== 'fatigued') {
              signals.push(`Impressions dropped ${Math.abs(impressionTrend).toFixed(0)}% - Reach declining`);
              if (status === 'healthy') status = 'warning';
            }
          } else {
            // Default/Other objectives: Use balanced approach
            if (ctrTrend < -ctrDeclineThreshold) {
              signals.push(`CTR declined ${Math.abs(ctrTrend).toFixed(0)}% (${prev7Ctr.toFixed(2)}% → ${last7Ctr.toFixed(2)}%)`);
              status = ctrTrend < -ctrDeclineThreshold * 1.5 ? 'fatigued' : 'warning';
            }

            if (cplTrend > cplIncreaseThreshold && totalLeads > 0) {
              signals.push(`CPL increased ${cplTrend.toFixed(0)}% ($${prev7Cpl.toFixed(0)} → $${last7Cpl.toFixed(0)})`);
              status = cplTrend > cplIncreaseThreshold * 1.5 ? 'fatigued' : status === 'fatigued' ? 'fatigued' : 'warning';
            }

            if (impressionTrend < -30 && last7Impr < 500) {
              signals.push(`Impressions dropped ${Math.abs(impressionTrend).toFixed(0)}% - losing auction competitiveness`);
              if (status !== 'fatigued') status = 'warning';
            }
          }

          // Generate objective-specific recommendation
          let recommendation = 'Creative performing well - no action needed';
          if (status === 'fatigued') {
            if (objectiveType === 'LEAD_GENERATION') {
              recommendation = 'Lead costs too high - pause and test new creative variants with different messaging';
            } else if (objectiveType === 'ENGAGEMENT') {
              recommendation = 'Engagement declining - refresh creative with new visuals or copy';
            } else {
              recommendation = 'Consider pausing this creative and launching new variants';
            }
          } else if (status === 'warning') {
            if (objectiveType === 'LEAD_GENERATION') {
              recommendation = 'Monitor CPL closely - prepare replacement creative optimized for leads';
            } else if (objectiveType === 'ENGAGEMENT') {
              recommendation = 'Monitor CTR closely - prepare replacement creative to maintain engagement';
            } else {
              recommendation = 'Monitor closely - prepare replacement creative';
            }
          }

          // Daily CTR/CPL for charts
          const chartData = dailyData.map(d => ({
            date: d.date,
            ctr: d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0,
            cpl: d.leads > 0 ? d.spend / d.leads : 0,
            impressions: d.impressions,
          }));

          fatigueAnalysis.push({
            creativeId: creativeUrn.split(':').pop() || '',
            creativeName: creativeNames.get(creativeUrn) || `Creative ${creativeUrn.split(':').pop()}`,
            campaignId,
            objectiveType,
            primaryMetric,
            status,
            signals,
            metrics: {
              totalImpressions,
              totalSpend,
              totalLeads,
              avgCtr,
              avgCpl,
              ctrTrend,
              cplTrend,
              impressionTrend,
            },
            recommendation,
            dailyData: chartData,
          });
        }

        // Sort by status severity
        const statusOrder = { fatigued: 0, warning: 1, healthy: 2 };
        fatigueAnalysis.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

        // Summary stats
        const summary = {
          total: fatigueAnalysis.length,
          fatigued: fatigueAnalysis.filter(c => c.status === 'fatigued').length,
          warning: fatigueAnalysis.filter(c => c.status === 'warning').length,
          healthy: fatigueAnalysis.filter(c => c.status === 'healthy').length,
        };

        // Get unique objectives from creatives for the filter dropdown
        const uniqueObjectives = [...new Set(fatigueAnalysis.map(c => c.objectiveType).filter(Boolean))].sort();

        console.log(`[get_creative_fatigue] Complete. ${summary.fatigued} fatigued, ${summary.warning} warning, ${summary.healthy} healthy. Objectives: ${uniqueObjectives.join(', ')}`);

        return new Response(JSON.stringify({
          period: { start: startDate, end: endDate },
          thresholds: { ctrDeclineThreshold, cplIncreaseThreshold, minImpressions },
          summary,
          creatives: fatigueAnalysis,
          availableObjectives: uniqueObjectives,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'get_campaign_group_performance': {
        // Campaign Group Performance Report - aggregates metrics by campaign group
        // Only counts leads from LEAD_GENERATION objective campaigns
        const { accountId, dateRange } = params || {};
        const now = new Date();
        const startDate = dateRange?.start || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const endDate = dateRange?.end || now.toISOString().split('T')[0];

        const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
        const [endYear, endMonth, endDay] = endDate.split('-').map(Number);

        console.log(`[get_campaign_group_performance] Account ${accountId}, period: ${startDate} to ${endDate}`);

        // Step 1: Fetch all campaign groups for this account
        const campaignGroupMap = new Map<string, { id: string; name: string; status: string }>();

        try {
          const groupsUrl = `https://api.linkedin.com/v2/adCampaignGroupsV2?q=search&search.account.values[0]=urn:li:sponsoredAccount:${accountId}&count=500`;
          const groupsResp = await fetch(groupsUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });

          if (groupsResp.ok) {
            const groupsData = await groupsResp.json();
            for (const group of (groupsData.elements || [])) {
              const groupId = group.id?.toString() || '';
              const groupName = group.name || `Campaign Group ${groupId}`;
              const groupStatus = group.status || 'UNKNOWN';
              if (groupId) {
                campaignGroupMap.set(`urn:li:sponsoredCampaignGroup:${groupId}`, {
                  id: groupId,
                  name: groupName,
                  status: groupStatus
                });
              }
            }
            console.log(`[get_campaign_group_performance] Found ${campaignGroupMap.size} campaign groups`);
          } else {
            const errorText = await groupsResp.text();
            console.error(`[get_campaign_group_performance] Campaign groups API error: ${groupsResp.status}`, errorText.slice(0, 300));
            return new Response(JSON.stringify({
              error: `LinkedIn API error: ${groupsResp.status}`,
              details: errorText.slice(0, 200)
            }), {
              status: groupsResp.status,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        } catch (err) {
          console.error('[get_campaign_group_performance] Campaign groups fetch error:', err);
        }

        // Step 2: Fetch analytics by CAMPAIGN_GROUP pivot (main metrics)
        const analyticsUrl = `https://api.linkedin.com/v2/adAnalyticsV2?q=analytics&` +
          `dateRange.start.day=${startDay}&dateRange.start.month=${startMonth}&dateRange.start.year=${startYear}&` +
          `dateRange.end.day=${endDay}&dateRange.end.month=${endMonth}&dateRange.end.year=${endYear}&` +
          `timeGranularity=ALL&pivot=CAMPAIGN_GROUP&accounts[0]=urn:li:sponsoredAccount:${accountId}&` +
          `fields=pivotValue,impressions,clicks,costInLocalCurrency&count=500`;

        // Store main metrics per group (without leads)
        const groupMainMetrics = new Map<string, { impressions: number; clicks: number; spent: number }>();

        try {
          const analyticsResp = await fetch(analyticsUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });

          if (analyticsResp.ok) {
            const analyticsData = await analyticsResp.json();
            for (const el of (analyticsData.elements || [])) {
              const groupUrn = el.pivotValue || '';
              if (!groupUrn) continue;
              groupMainMetrics.set(groupUrn, {
                impressions: el.impressions || 0,
                clicks: el.clicks || 0,
                spent: parseFloat(el.costInLocalCurrency || '0'),
              });
            }
            console.log(`[get_campaign_group_performance] Got main metrics for ${groupMainMetrics.size} campaign groups`);
          } else {
            const errorText = await analyticsResp.text();
            console.error(`[get_campaign_group_performance] Analytics API error: ${analyticsResp.status}`, errorText.slice(0, 300));
            return new Response(JSON.stringify({
              error: `LinkedIn API error: ${analyticsResp.status}`,
              details: errorText.slice(0, 200)
            }), {
              status: analyticsResp.status,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        } catch (err) {
          console.error('[get_campaign_group_performance] Analytics fetch error:', err);
          return new Response(JSON.stringify({
            error: 'Failed to fetch campaign group analytics',
            details: err instanceof Error ? err.message : 'Unknown error'
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Step 3: Fetch campaigns to get objectiveType + campaignGroup mapping
        const campaignInfoMap = new Map<string, { objectiveType: string; campaignGroupUrn: string }>();
        try {
          let campaignStart = 0;
          let hasMoreCampaigns = true;
          while (hasMoreCampaigns) {
            const campaignsUrl = `https://api.linkedin.com/v2/adCampaignsV2?q=search&search.account.values[0]=urn:li:sponsoredAccount:${accountId}&count=500&start=${campaignStart}`;
            const campaignsResp = await fetch(campaignsUrl, {
              headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            if (campaignsResp.ok) {
              const campaignsData = await campaignsResp.json();
              const elements = campaignsData.elements || [];
              for (const c of elements) {
                const cId = c.id?.toString() || '';
                if (cId) {
                  campaignInfoMap.set(`urn:li:sponsoredCampaign:${cId}`, {
                    objectiveType: c.objectiveType || '',
                    campaignGroupUrn: c.campaignGroup || ''
                  });
                }
              }
              hasMoreCampaigns = elements.length === 500;
              campaignStart += 500;
            } else {
              hasMoreCampaigns = false;
            }
          }
          console.log(`[get_campaign_group_performance] Fetched ${campaignInfoMap.size} campaigns for lead objective filtering`);
        } catch (err) {
          console.error('[get_campaign_group_performance] Campaigns fetch error:', err);
        }

        // Step 4: Fetch CAMPAIGN-level leads analytics, filter by LEAD_GENERATION, aggregate to group
        const leadsPerGroup = new Map<string, number>();
        try {
          const leadsAnalyticsUrl = `https://api.linkedin.com/v2/adAnalyticsV2?q=analytics&` +
            `dateRange.start.day=${startDay}&dateRange.start.month=${startMonth}&dateRange.start.year=${startYear}&` +
            `dateRange.end.day=${endDay}&dateRange.end.month=${endMonth}&dateRange.end.year=${endYear}&` +
            `timeGranularity=ALL&pivot=CAMPAIGN&accounts[0]=urn:li:sponsoredAccount:${accountId}&` +
            `fields=pivotValue,oneClickLeads&count=10000`;

          const leadsResp = await fetch(leadsAnalyticsUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });

          if (leadsResp.ok) {
            const leadsData = await leadsResp.json();
            console.log(`[get_campaign_group_performance] Total campaign-level lead elements: ${(leadsData.elements || []).length}`);
            for (const el of (leadsData.elements || [])) {
              const campaignUrn = el.pivotValue || '';
              if (!campaignUrn) continue;
              const cInfo = campaignInfoMap.get(campaignUrn);
              const leads = el.oneClickLeads || 0;
              console.log(`[get_campaign_group_performance] Campaign ${campaignUrn}: objective=${cInfo?.objectiveType || 'NOT_FOUND'}, oneClickLeads=${leads}`);
              if (!cInfo || cInfo.objectiveType !== 'LEAD_GENERATION') continue;
              if (leads > 0) {
                const groupUrn = cInfo.campaignGroupUrn;
                leadsPerGroup.set(groupUrn, (leadsPerGroup.get(groupUrn) || 0) + leads);
              }
            }
            console.log(`[get_campaign_group_performance] Lead gen leads aggregated for ${leadsPerGroup.size} groups, totals:`, JSON.stringify(Object.fromEntries(leadsPerGroup)));
          } else {
            const errorText = await leadsResp.text();
            console.error(`[get_campaign_group_performance] Leads analytics error: ${leadsResp.status}`, errorText.slice(0, 300));
          }
        } catch (err) {
          console.error('[get_campaign_group_performance] Leads analytics fetch error:', err);
        }

        // Step 5: Build final performance array
        const groupPerformance: Array<{
          campaignGroupId: string;
          campaignGroupName: string;
          status: string;
          impressions: number;
          clicks: number;
          spent: number;
          leads: number;
          ctr: number;
          avgCpc: number;
          cpl: number;
        }> = [];

        for (const [groupUrn, metrics] of groupMainMetrics.entries()) {
          const groupInfo = campaignGroupMap.get(groupUrn);
          const groupId = groupUrn.split(':').pop() || '';
          const leads = leadsPerGroup.get(groupUrn) || 0;

          const ctr = metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : 0;
          const avgCpc = metrics.clicks > 0 ? metrics.spent / metrics.clicks : 0;
          const cpl = leads > 0 ? metrics.spent / leads : 0;

          groupPerformance.push({
            campaignGroupId: groupId,
            campaignGroupName: groupInfo?.name || `Campaign Group ${groupId}`,
            status: groupInfo?.status || 'UNKNOWN',
            impressions: metrics.impressions,
            clicks: metrics.clicks,
            spent: metrics.spent,
            leads,
            ctr,
            avgCpc,
            cpl,
          });
        }

        // Sort by spent descending
        groupPerformance.sort((a, b) => b.spent - a.spent);

        // Calculate totals
        const totals = {
          impressions: groupPerformance.reduce((sum, g) => sum + g.impressions, 0),
          clicks: groupPerformance.reduce((sum, g) => sum + g.clicks, 0),
          spent: groupPerformance.reduce((sum, g) => sum + g.spent, 0),
          leads: groupPerformance.reduce((sum, g) => sum + g.leads, 0),
        };

        return new Response(JSON.stringify({
          period: { start: startDate, end: endDate },
          totals,
          campaignGroups: groupPerformance,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'get_audience_expansion': {
        // Smart Audience Expander - suggests similar titles/skills based on top performers
        const { accountId, dateRange, topN } = params || {};
        const now = new Date();
        const startDate = dateRange?.start || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const endDate = dateRange?.end || now.toISOString().split('T')[0];
        const topCount = topN || 10;

        const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
        const [endYear, endMonth, endDay] = endDate.split('-').map(Number);

        console.log(`[get_audience_expansion] Account ${accountId}, period: ${startDate} to ${endDate}, top ${topCount}`);

        // Step 1: Get job title performance data
        const titleAnalyticsUrl = `https://api.linkedin.com/v2/adAnalyticsV2?q=analytics&` +
          `dateRange.start.day=${startDay}&dateRange.start.month=${startMonth}&dateRange.start.year=${startYear}&` +
          `dateRange.end.day=${endDay}&dateRange.end.month=${endMonth}&dateRange.end.year=${endYear}&` +
          `timeGranularity=ALL&pivot=MEMBER_JOB_TITLE&accounts[0]=urn:li:sponsoredAccount:${accountId}&` +
          `fields=pivotValue,impressions,clicks,costInLocalCurrency,oneClickLeads,externalWebsiteConversions&count=500`;

        const titlePerformance: Array<{
          titleUrn: string;
          titleId: string;
          impressions: number;
          clicks: number;
          spend: number;
          leads: number;
          ctr: number;
          cpl: number;
        }> = [];

        try {
          const response = await fetch(titleAnalyticsUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });

          if (response.ok) {
            const data = await response.json();
            for (const el of (data.elements || [])) {
              const titleUrn = el.pivotValue || '';
              if (!titleUrn) continue;

              const impressions = el.impressions || 0;
              const clicks = el.clicks || 0;
              const spend = parseFloat(el.costInLocalCurrency || '0');
              const leads = (el.oneClickLeads || 0) + (el.externalWebsiteConversions || 0);

              titlePerformance.push({
                titleUrn,
                titleId: titleUrn.split(':').pop() || '',
                impressions,
                clicks,
                spend,
                leads,
                ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
                cpl: leads > 0 ? spend / leads : Infinity,
              });
            }
          }
        } catch (err) {
          console.error('[get_audience_expansion] Title analytics fetch error:', err);
        }

        // Step 2: Get job function performance for context
        const functionAnalyticsUrl = `https://api.linkedin.com/v2/adAnalyticsV2?q=analytics&` +
          `dateRange.start.day=${startDay}&dateRange.start.month=${startMonth}&dateRange.start.year=${startYear}&` +
          `dateRange.end.day=${endDay}&dateRange.end.month=${endMonth}&dateRange.end.year=${endYear}&` +
          `timeGranularity=ALL&pivot=MEMBER_JOB_FUNCTION&accounts[0]=urn:li:sponsoredAccount:${accountId}&` +
          `fields=pivotValue,impressions,clicks,costInLocalCurrency,oneClickLeads,externalWebsiteConversions&count=100`;

        const topFunctions: Array<{ functionUrn: string; leads: number; cpl: number }> = [];

        try {
          const response = await fetch(functionAnalyticsUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });

          if (response.ok) {
            const data = await response.json();
            for (const el of (data.elements || [])) {
              const leads = (el.oneClickLeads || 0) + (el.externalWebsiteConversions || 0);
              const spend = parseFloat(el.costInLocalCurrency || '0');
              if (leads > 0) {
                topFunctions.push({
                  functionUrn: el.pivotValue || '',
                  leads,
                  cpl: spend / leads,
                });
              }
            }
          }
        } catch (err) {
          console.error('[get_audience_expansion] Function analytics fetch error:', err);
        }

        // Sort functions by CPL (lower is better)
        topFunctions.sort((a, b) => a.cpl - b.cpl);

        // Step 3: Identify top performing titles (by CPL, with min lead threshold)
        const titlesWithLeads = titlePerformance.filter(t => t.leads >= 1);
        titlesWithLeads.sort((a, b) => a.cpl - b.cpl);
        const topTitles = titlesWithLeads.slice(0, topCount);

        console.log(`[get_audience_expansion] Found ${titlesWithLeads.length} titles with leads, top ${topTitles.length} selected`);

        // Step 4: Resolve title names and find similar titles
        const suggestions: Array<{
          basedOn: {
            titleId: string;
            titleName: string;
            cpl: number;
            leads: number;
          };
          suggestedTitles: Array<{
            titleId: string;
            titleName: string;
            reason: string;
          }>;
        }> = [];

        // Resolve top title names via title_metadata_cache first, then API as fallback
        const titleNames = new Map<string, string>();
        const allTitleIds = topTitles.map(t => t.titleId);

        // First, try to get cached titles from Supabase (this is the primary source)
        try {
          const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
          const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
          const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
          const supabase = createClient(supabaseUrl, supabaseKey);

          const { data: cachedTitles, error: cacheError } = await supabase
            .from('title_metadata_cache')
            .select('title_id, name')
            .in('title_id', allTitleIds);

          if (cachedTitles && !cacheError) {
            for (const cached of cachedTitles) {
              if (cached.name && cached.name.trim()) {
                titleNames.set(cached.title_id, cached.name);
              }
            }
          }
          console.log(`[get_audience_expansion] Found ${titleNames.size} cached title names out of ${allTitleIds.length}`);
        } catch (cacheErr) {
          console.log('[get_audience_expansion] Cache lookup error:', cacheErr);
        }

        // Resolve missing titles via LinkedIn API (only for those not in cache)
        const missingTitleIds = allTitleIds.filter(id => !titleNames.has(id));
        console.log(`[get_audience_expansion] Need to resolve ${missingTitleIds.length} titles from API`);

        for (const titleId of missingTitleIds.slice(0, 20)) { // Limit API calls
          const titleObj = topTitles.find(t => t.titleId === titleId);
          if (!titleObj) continue;

          try {
            const titleUrl = `https://api.linkedin.com/v2/standardizedTitles/${encodeURIComponent(titleObj.titleUrn)}`;
            const response = await fetch(titleUrl, {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'X-Restli-Protocol-Version': '2.0.0',
              }
            });

            if (response.ok) {
              const data = await response.json();
              const name = data.name?.localized?.en_US || data.name || null;
              if (name && typeof name === 'string' && name.trim()) {
                titleNames.set(titleId, name);
                
                // Also save to cache for future use
                try {
                  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
                  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
                  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
                  const supabase = createClient(supabaseUrl, supabaseKey);
                  
                  await supabase.from('title_metadata_cache').upsert({
                    title_id: titleId,
                    name: name,
                  }, { onConflict: 'title_id' });
                } catch (saveErr) {
                  // Ignore cache save errors
                }
              }
            } else if (response.status === 403) {
              console.log(`[get_audience_expansion] Titles API access denied (403) for ${titleId}`);
              // Don't set a fallback - we'll handle unknown titles at the end
            } else {
              console.log(`[get_audience_expansion] Title API returned ${response.status} for ${titleId}`);
            }
          } catch (err) {
            console.log(`[get_audience_expansion] Title name lookup error for ${titleId}:`, err);
          }
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        console.log(`[get_audience_expansion] Resolved ${titleNames.size} total title names`)

        // Then, search for similar titles for the top 5
        for (const title of topTitles.slice(0, 5)) {
          const name = titleNames.get(title.titleId) || `Title ${title.titleId}`;
          
          try {
            // Search for similar titles
            const searchUrl = `https://api.linkedin.com/v2/standardizedTitles?q=search&keywords=${encodeURIComponent(name.split(' ')[0])}&count=20`;
            const searchResponse = await fetch(searchUrl, {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'X-Restli-Protocol-Version': '2.0.0',
              }
            });

            if (searchResponse.ok) {
              const searchData = await searchResponse.json();
              const similarTitles: Array<{ titleId: string; titleName: string; reason: string }> = [];

              for (const st of (searchData.elements || []).slice(0, 5)) {
                const stId = st.id?.toString() || st.$URN?.split(':').pop();
                const stName = st.name?.localized?.en_US || st.name || '';

                // Skip if it's the same title or already in targeting
                if (stId === title.titleId) continue;
                if (titlePerformance.some(t => t.titleId === stId)) continue;

                similarTitles.push({
                  titleId: stId,
                  titleName: stName,
                  reason: `Similar to "${name}" (top performer with $${title.cpl.toFixed(0)} CPL)`,
                });
              }

              if (similarTitles.length > 0) {
                suggestions.push({
                  basedOn: {
                    titleId: title.titleId,
                    titleName: name,
                    cpl: title.cpl,
                    leads: title.leads,
                  },
                  suggestedTitles: similarTitles,
                });
              }
            }
          } catch (err) {
            console.log(`[get_audience_expansion] Title search error for ${title.titleId}:`, err);
          }

          // Small delay between API calls
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Step 5: Generate function-based suggestions
        const functionSuggestions: Array<{
          functionName: string;
          currentPerformance: { leads: number; cpl: number };
          suggestion: string;
        }> = [];

        // Job function name mapping (simplified)
        const functionNames: Record<string, string> = {
          'urn:li:function:1': 'Accounting', 'urn:li:function:2': 'Administrative',
          'urn:li:function:3': 'Arts & Design', 'urn:li:function:4': 'Business Development',
          'urn:li:function:5': 'Community & Social Services', 'urn:li:function:6': 'Consulting',
          'urn:li:function:7': 'Education', 'urn:li:function:8': 'Engineering',
          'urn:li:function:9': 'Entrepreneurship', 'urn:li:function:10': 'Finance',
          'urn:li:function:11': 'Healthcare Services', 'urn:li:function:12': 'Human Resources',
          'urn:li:function:13': 'Information Technology', 'urn:li:function:14': 'Legal',
          'urn:li:function:15': 'Marketing', 'urn:li:function:16': 'Media & Communications',
          'urn:li:function:17': 'Military & Protective Services', 'urn:li:function:18': 'Operations',
          'urn:li:function:19': 'Product Management', 'urn:li:function:20': 'Program & Project Management',
          'urn:li:function:21': 'Purchasing', 'urn:li:function:22': 'Quality Assurance',
          'urn:li:function:23': 'Real Estate', 'urn:li:function:24': 'Research',
          'urn:li:function:25': 'Sales', 'urn:li:function:26': 'Support',
        };

        for (const func of topFunctions.slice(0, 3)) {
          const funcName = functionNames[func.functionUrn] || func.functionUrn;
          functionSuggestions.push({
            functionName: funcName,
            currentPerformance: { leads: func.leads, cpl: func.cpl },
            suggestion: `Expand targeting within ${funcName} - currently your best performing function at $${func.cpl.toFixed(0)} CPL`,
          });
        }

        // Summary
        const totalSuggestedTitles = suggestions.reduce((sum, s) => sum + s.suggestedTitles.length, 0);

        console.log(`[get_audience_expansion] Complete. ${suggestions.length} expansion groups, ${totalSuggestedTitles} suggested titles`);

        // Filter out titles without resolved names - only show titles with proper names
        const titlesWithNames = topTitles.slice(0, 10)
          .map(t => ({
            ...t,
            titleName: titleNames.get(t.titleId) || null,
          }))
          .filter(t => t.titleName && !t.titleName.startsWith('Title '));

        // If we have fewer than expected, add the ones with IDs but mark them clearly
        const titlesToShow = titlesWithNames.length > 0 
          ? titlesWithNames 
          : topTitles.slice(0, 10).map(t => ({
              ...t,
              titleName: titleNames.get(t.titleId) || `Unknown (ID: ${t.titleId})`,
            }));

        console.log(`[get_audience_expansion] Returning ${titlesToShow.length} titles with names`);

        return new Response(JSON.stringify({
          period: { start: startDate, end: endDate },
          topPerformers: {
            titles: titlesToShow,
            functions: topFunctions.slice(0, 5).map(f => ({
              ...f,
              functionName: functionNames[f.functionUrn] || f.functionUrn,
            })),
          },
          suggestions,
          functionSuggestions,
          summary: {
            totalTitlesAnalyzed: titlePerformance.length,
            titlesWithLeads: titlesWithLeads.length,
            expansionSuggestions: totalSuggestedTitles,
          },
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'get_company_influence': {
        // Company Influence Report - uses EXACT same pattern as working get_company_demographic
        const { accountId, dateRange, minImpressions } = params || {};
        const startDate = dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const endDate = dateRange?.end || new Date().toISOString().split('T')[0];
        const impressionThreshold = minImpressions || 100;

        const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
        const [endYear, endMonth, endDay] = endDate.split('-').map(Number);

        console.log(`[get_company_influence] Account ${accountId}, period: ${startDate} to ${endDate}`);

        // Step 1: Fetch all campaigns to get objective types (v2 API)
        const campaignsUrl = `https://api.linkedin.com/v2/adCampaignsV2?q=search&search.account.values[0]=urn:li:sponsoredAccount:${accountId}&count=200`;
        const campaignMeta = new Map<string, { name: string; objective: string; status: string }>();

        try {
          const response = await fetch(campaignsUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });
          if (response.ok) {
            const data = await response.json();
            for (const c of (data.elements || [])) {
              const id = c.id?.toString();
              if (id) {
                campaignMeta.set(id, {
                  name: c.name || `Campaign ${id}`,
                  objective: c.objectiveType || 'UNKNOWN',
                  status: c.status || 'UNKNOWN',
                });
              }
            }
          }
        } catch (err) {
          console.error('[get_company_influence] Campaign fetch error:', err);
        }

        console.log(`[get_company_influence] Found ${campaignMeta.size} campaigns`);

        // Step 2: Fetch company analytics (v2 API - same as demographic)
        const companyData = new Map<string, {
          companyUrn: string;
          companyName: string;
          totalImpressions: number;
          totalClicks: number;
          totalSpend: number;
          totalLeads: number;
          totalFormOpens: number;
          objectiveMix: Set<string>;
        }>();

        const analyticsUrl = `https://api.linkedin.com/v2/adAnalyticsV2?q=analytics&` +
          `dateRange.start.day=${startDay}&` +
          `dateRange.start.month=${startMonth}&` +
          `dateRange.start.year=${startYear}&` +
          `dateRange.end.day=${endDay}&` +
          `dateRange.end.month=${endMonth}&` +
          `dateRange.end.year=${endYear}&` +
          `timeGranularity=ALL&` +
          `pivot=MEMBER_COMPANY&` +
          `accounts[0]=urn:li:sponsoredAccount:${accountId}&` +
          `fields=impressions,clicks,costInLocalCurrency,oneClickLeads,externalWebsiteConversions,oneClickLeadFormOpens,pivotValue&` +
          `count=10000`;

        try {
          const response = await fetch(analyticsUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });

          if (response.ok) {
            const data = await response.json();
            console.log(`[get_company_influence] Analytics returned ${(data.elements || []).length} entries`);

            for (const el of (data.elements || [])) {
              const companyUrn = el.pivotValue || '';
              if (!companyUrn) continue;

              const impressions = el.impressions || 0;
              const clicks = el.clicks || 0;
              const spend = parseFloat(el.costInLocalCurrency || '0');
              const leads = (el.oneClickLeads || 0) + (el.externalWebsiteConversions || 0);
              const formOpens = el.oneClickLeadFormOpens || 0;

              let company = companyData.get(companyUrn);
              if (!company) {
                company = {
                  companyUrn,
                  companyName: '',
                  totalImpressions: 0,
                  totalClicks: 0,
                  totalSpend: 0,
                  totalLeads: 0,
                  totalFormOpens: 0,
                  objectiveMix: new Set(),
                };
                companyData.set(companyUrn, company);
              }

              company.totalImpressions += impressions;
              company.totalClicks += clicks;
              company.totalSpend += spend;
              company.totalLeads += leads;
              company.totalFormOpens += formOpens;
            }
          } else {
            const errorText = await response.text();
            console.error(`[get_company_influence] Analytics API error: ${response.status}`, errorText);
          }
        } catch (err) {
          console.error('[get_company_influence] Analytics fetch error:', err);
        }

        console.log(`[get_company_influence] Found ${companyData.size} unique companies`);

        // Step 3: Three-step company name resolution pipeline
        // Step 3A: Load cached names from Supabase first
        // Step 3B: Query LinkedIn API only for missing IDs
        // Step 3C: Upsert resolved names to cache
        
        const companyUrns = Array.from(companyData.keys()).slice(0, 200);
        const companyNames = new Map<string, string>();

        console.log(`[get_company_influence] Resolving names for ${companyUrns.length} companies...`);

        // Extract organization IDs from URNs
        const orgIdToUrn = new Map<string, string>();
        companyUrns.forEach(urn => {
          const { id } = normalizeCompanyUrn(urn);
          if (id) {
            orgIdToUrn.set(id, urn);
          }
        });
        
        const orgIds = Array.from(orgIdToUrn.keys());
        console.log(`[get_company_influence] Extracted ${orgIds.length} valid org IDs from ${companyUrns.length} URNs`);

        // Step 3A: Load cached names from Supabase first
        try {
          const { data: cached, error: cacheError } = await supabaseClient
            .from('linkedin_company_cache')
            .select('org_id, name, vanity_name')
            .in('org_id', orgIds);

          if (!cacheError && cached) {
            console.log(`[get_company_influence] Loaded ${cached.length} cached company names`);
            cached.forEach((row: { org_id: string; name: string; vanity_name: string | null }) => {
              const displayName = row.name || row.vanity_name || '';
              if (displayName) {
                companyNames.set(row.org_id, displayName);
                companyNames.set(`urn:li:organization:${row.org_id}`, displayName);
                companyNames.set(`urn:li:company:${row.org_id}`, displayName);
                companyNames.set(`urn:li:memberCompany:${row.org_id}`, displayName);
              }
            });
          } else if (cacheError) {
            console.error('[get_company_influence] Cache lookup error:', cacheError);
          }
        } catch (e) {
          console.error('[get_company_influence] Cache lookup error:', e);
        }

        // Step 3B: Only query LinkedIn for IDs not in cache
        const idsMissing = orgIds.filter(id => !companyNames.has(id));
        console.log(`[get_company_influence] ${orgIds.length - idsMissing.length} from cache, ${idsMissing.length} need API lookup`);

        // Track if name resolution failed due to permissions
        let namesResolutionFailed = false;
        let namesResolutionError: string | null = null;

        // Use batch organizationsLookup for missing IDs (same approach as working get_company_demographic)
        if (idsMissing.length > 0) {
          console.log(`[get_company_influence] Resolving ${idsMissing.length} org names via batch lookup...`);

          const idsToResolve = idsMissing.slice(0, 500);
          let successCount = 0;
          const newlyResolved: Array<{ id: string; name: string; vanityName: string | null }> = [];

          // Batch fetch organization data (same as get_company_demographic)
          const batchSize = 50;
          for (let i = 0; i < idsToResolve.length; i += batchSize) {
            const batch = idsToResolve.slice(i, i + batchSize);
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
                  const originalUrn = orgIdToUrn.get(id);
                  const name = org?.localizedName || org?.vanityName;
                  const vanityName = org?.vanityName || null;

                  if (name) {
                    if (originalUrn) companyNames.set(originalUrn, name);
                    companyNames.set(`urn:li:organization:${id}`, name);
                    companyNames.set(`urn:li:company:${id}`, name);
                    companyNames.set(`urn:li:memberCompany:${id}`, name);
                    companyNames.set(id, name);
                    successCount++;
                    newlyResolved.push({ id, name, vanityName });
                  }
                });
              } else {
                const errorText = await orgResponse.text();
                console.log(`[get_company_influence] Org lookup batch failed: ${orgResponse.status}`, errorText.slice(0, 200));
                if (orgResponse.status === 403) {
                  namesResolutionFailed = true;
                  namesResolutionError = errorText.slice(0, 200);
                }
              }
            } catch (e) {
              console.log('[get_company_influence] Organization lookup failed:', e);
            }
          }

          console.log(`[get_company_influence] Batch lookups complete: ${successCount} resolved`);
          
          // Step 3C: Upsert newly resolved names to cache
          if (newlyResolved.length > 0) {
            console.log(`[get_company_influence] Caching ${newlyResolved.length} newly resolved names...`);
            try {
              const upsertData = newlyResolved.map(r => ({
                org_id: r.id,
                name: r.name,
                vanity_name: r.vanityName,
                source: 'linkedin_org_api',
                last_seen_at: new Date().toISOString(),
              }));
              
              const { error: upsertError } = await supabaseClient
                .from('linkedin_company_cache')
                .upsert(upsertData, { onConflict: 'org_id' });
              
              if (upsertError) {
                console.error('[get_company_influence] Cache upsert error:', upsertError);
              } else {
                console.log(`[get_company_influence] Cached ${newlyResolved.length} company names`);
              }
            } catch (e) {
              console.error('[get_company_influence] Cache upsert error:', e);
            }
          }
          
          // Only mark as failed if ALL lookups failed with 403
          if (successCount === 0 && namesResolutionFailed) {
            namesResolutionError = 'All organization lookups returned 403 Forbidden';
          } else if (successCount > 0) {
            namesResolutionFailed = false;
          }
        }

        console.log(`[get_company_influence] FINAL: Resolved ${companyNames.size} company names out of ${companyUrns.length}`);

        // Step 4: Fetch campaign-level breakdown per company (using per-campaign analytics)
        // Fetch analytics for each active campaign to build company breakdown
        const campaignCompanyData = new Map<string, Map<string, {
          campaignId: string;
          campaignName: string;
          objective: string;
          impressions: number;
          clicks: number;
          spend: number;
          leads: number;
        }>>();

        // Only process top 50 campaigns to avoid rate limits
        const campaignIds = Array.from(campaignMeta.keys()).slice(0, 50);
        console.log(`[get_company_influence] Fetching company breakdown for ${campaignIds.length} campaigns...`);

        for (let i = 0; i < campaignIds.length; i += 5) {
          const batch = campaignIds.slice(i, i + 5);
          
          await Promise.all(batch.map(async (campaignId) => {
            const meta = campaignMeta.get(campaignId);
            if (!meta) return;

            try {
              const campaignAnalyticsUrl = `https://api.linkedin.com/v2/adAnalyticsV2?q=analytics&` +
                `dateRange.start.day=${startDay}&dateRange.start.month=${startMonth}&dateRange.start.year=${startYear}&` +
                `dateRange.end.day=${endDay}&dateRange.end.month=${endMonth}&dateRange.end.year=${endYear}&` +
                `timeGranularity=ALL&pivot=MEMBER_COMPANY&campaigns[0]=urn:li:sponsoredCampaign:${campaignId}&` +
                `fields=pivotValue,impressions,clicks,costInLocalCurrency,oneClickLeads,externalWebsiteConversions&count=1000`;

              const response = await fetch(campaignAnalyticsUrl, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
              });

              if (response.ok) {
                const data = await response.json();
                for (const el of (data.elements || [])) {
                  const companyUrn = el.pivotValue || '';
                  if (!companyUrn || !companyData.has(companyUrn)) continue;

                  if (!campaignCompanyData.has(companyUrn)) {
                    campaignCompanyData.set(companyUrn, new Map());
                  }

                  const existing = campaignCompanyData.get(companyUrn)!.get(campaignId);
                  const impressions = el.impressions || 0;
                  const clicks = el.clicks || 0;
                  const spend = parseFloat(el.costInLocalCurrency || '0');
                  const leads = (el.oneClickLeads || 0) + (el.externalWebsiteConversions || 0);

                  if (existing) {
                    existing.impressions += impressions;
                    existing.clicks += clicks;
                    existing.spend += spend;
                    existing.leads += leads;
                  } else {
                    campaignCompanyData.get(companyUrn)!.set(campaignId, {
                      campaignId,
                      campaignName: meta.name,
                      objective: meta.objective,
                      impressions,
                      clicks,
                      spend,
                      leads,
                    });
                  }
                }
              }
            } catch (err) {
              // Silent fail for individual campaign lookups
            }
          }));
        }

        console.log(`[get_company_influence] Built campaign breakdown for ${campaignCompanyData.size} companies`);

        // Step 5: Add objective data from campaigns (aggregate by campaign objective)
        const allObjectives = Array.from(campaignMeta.values()).map(c => c.objective);
        const uniqueObjectives = [...new Set(allObjectives)];

        // Step 6: Build final report with engagement scoring
        const companies: Array<{
          companyUrn: string;
          companyName: string;
          engagementScore: number;
          totalImpressions: number;
          totalClicks: number;
          totalSpend: number;
          totalLeads: number;
          totalFormOpens: number;
          ctr: number;
          cpl: number;
          campaignDepth: number;
          objectiveTypes: string[];
          campaignBreakdown: Array<{
            campaignId: string;
            campaignName: string;
            objective: string;
            impressions: number;
            clicks: number;
            spend: number;
            leads: number;
          }>;
        }> = [];

        for (const [companyUrn, data] of companyData.entries()) {
          // Filter by minimum impressions
          if (data.totalImpressions < impressionThreshold) continue;

          // Calculate engagement score
          const engagementScore = (data.totalLeads * 100) + (data.totalClicks * 5) + (data.totalImpressions * 0.01);

          // Get company name - use multi-key lookup
          const { id: companyId } = normalizeCompanyUrn(companyUrn);
          const lookupKeys = [
            companyUrn,
            companyId ?? '',
            `urn:li:organization:${companyId}`,
            `urn:li:company:${companyId}`,
            `urn:li:memberCompany:${companyId}`,
          ].filter(Boolean);
          
          let companyName = lookupKeys.map(k => companyNames.get(k)).find(Boolean);
          
          // Final fallback: show "Company" + ID from URN
          if (!companyName) {
            companyName = companyId ? `Company ${companyId}` : 'Unknown Company';
          }

          // Get campaign breakdown for this company
          const breakdown = campaignCompanyData.get(companyUrn);
          const campaignBreakdown = breakdown ? Array.from(breakdown.values()) : [];

          // Get unique objectives from this company's campaigns
          const companyObjectives = campaignBreakdown.length > 0 
            ? [...new Set(campaignBreakdown.map(c => c.objective))]
            : uniqueObjectives;

          companies.push({
            companyUrn,
            companyName,
            engagementScore: Math.round(engagementScore),
            totalImpressions: data.totalImpressions,
            totalClicks: data.totalClicks,
            totalSpend: data.totalSpend,
            totalLeads: data.totalLeads,
            totalFormOpens: data.totalFormOpens,
            ctr: data.totalImpressions > 0 ? (data.totalClicks / data.totalImpressions) * 100 : 0,
            cpl: data.totalLeads > 0 ? data.totalSpend / data.totalLeads : 0,
            campaignDepth: campaignBreakdown.length || uniqueObjectives.length,
            objectiveTypes: companyObjectives,
            campaignBreakdown: campaignBreakdown.sort((a, b) => b.impressions - a.impressions),
          });
        }

        // Sort by engagement score
        companies.sort((a, b) => b.engagementScore - a.engagementScore);

        // Calculate summary metrics
        const summary = {
          totalCompanies: companies.length,
          companiesEngaged: companies.filter(c => c.totalClicks > 0).length,
          companiesConverted: companies.filter(c => c.totalLeads > 0).length,
          totalImpressions: companies.reduce((sum, c) => sum + c.totalImpressions, 0),
          totalClicks: companies.reduce((sum, c) => sum + c.totalClicks, 0),
          totalSpend: companies.reduce((sum, c) => sum + c.totalSpend, 0),
          totalLeads: companies.reduce((sum, c) => sum + c.totalLeads, 0),
        };

        // Objective breakdown — aggregate metrics from per-company campaign breakdowns
        const objectiveStats = new Map<string, { companies: number; impressions: number; clicks: number; spend: number; leads: number }>();
        for (const company of companies) {
          const seenObjectives = new Set<string>();
          for (const cb of company.campaignBreakdown) {
            const obj = cb.objective;
            if (!obj) continue;
            const stats = objectiveStats.get(obj) || { companies: 0, impressions: 0, clicks: 0, spend: 0, leads: 0 };
            if (!seenObjectives.has(obj)) { stats.companies++; seenObjectives.add(obj); }
            stats.impressions += cb.impressions || 0;
            stats.clicks += cb.clicks || 0;
            stats.spend += cb.spend || 0;
            stats.leads += cb.leads || 0;
            objectiveStats.set(obj, stats);
          }
          // Fallback: if no campaign breakdown, just count company per objective
          if (company.campaignBreakdown.length === 0) {
            for (const obj of company.objectiveTypes) {
              const stats = objectiveStats.get(obj) || { companies: 0, impressions: 0, clicks: 0, spend: 0, leads: 0 };
              stats.companies++;
              objectiveStats.set(obj, stats);
            }
          }
        }

        console.log(`[get_company_influence] FINAL: Resolved ${companyNames.size} company names. Resolution failed: ${namesResolutionFailed}`);
        console.log(`[get_company_influence] Complete. ${companies.length} companies above threshold`);

        return new Response(JSON.stringify({
          period: { start: startDate, end: endDate },
          summary,
          companies: companies.slice(0, 500), // Limit response size
          objectiveBreakdown: Array.from(objectiveStats.entries()).map(([objective, stats]) => ({
            objective,
            ...stats,
          })),
          metadata: {
            accountId,
            impressionThreshold,
            totalCampaignsAnalyzed: campaignMeta.size,
            namesResolutionFailed,
            namesResolutionError,
            namesResolvedCount: companyNames.size,
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'get_company_engagement_timeline': {
        // Company Engagement Timeline - uses EXACT same v2 API pattern as working get_company_demographic
        const { accountId, dateRange, companyIds } = params || {};
        const startDate = dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const endDate = dateRange?.end || new Date().toISOString().split('T')[0];

        const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
        const [endYear, endMonth, endDay] = endDate.split('-').map(Number);

        console.log(`[get_company_engagement_timeline] Account ${accountId}, period: ${startDate} to ${endDate}`);

        // Step 1: Fetch daily company analytics with MEMBER_COMPANY pivot (v2 API - same as demographic)
        const analyticsUrl = `https://api.linkedin.com/v2/adAnalyticsV2?q=analytics&` +
          `dateRange.start.day=${startDay}&` +
          `dateRange.start.month=${startMonth}&` +
          `dateRange.start.year=${startYear}&` +
          `dateRange.end.day=${endDay}&` +
          `dateRange.end.month=${endMonth}&` +
          `dateRange.end.year=${endYear}&` +
          `timeGranularity=DAILY&` +
          `pivot=MEMBER_COMPANY&` +
          `accounts[0]=urn:li:sponsoredAccount:${accountId}&` +
          `fields=dateRange,pivotValue,impressions,clicks,costInLocalCurrency,oneClickLeads,externalWebsiteConversions&` +
          `count=10000`;

        let allElements: any[] = [];
        try {
          const response = await fetch(analyticsUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });

          if (response.ok) {
            const data = await response.json();
            allElements = data.elements || [];
            console.log(`[get_company_engagement_timeline] Fetched ${allElements.length} daily records`);
          } else {
            const errorText = await response.text();
            console.error(`[get_company_engagement_timeline] API error: ${response.status}`, errorText.slice(0, 300));
            return new Response(JSON.stringify({
              error: `LinkedIn API error: ${response.status}`,
              details: errorText.slice(0, 200)
            }), {
              status: response.status,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        } catch (err) {
          console.error('[get_company_engagement_timeline] Fetch error:', err);
          return new Response(JSON.stringify({ 
            error: 'Failed to fetch analytics data',
            details: err instanceof Error ? err.message : 'Unknown error'
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Step 2: Aggregate data by date and company
        const dailyData = new Map<string, Map<string, {
          impressions: number;
          clicks: number;
          spend: number;
          leads: number;
        }>>();

        const companyTotals = new Map<string, {
          impressions: number;
          clicks: number;
          spend: number;
          leads: number;
        }>();

        for (const el of allElements) {
          // v2 API returns pivotValue
          const companyUrn = el.pivotValue || '';
          if (!companyUrn) continue;

          // Extract date from dateRange
          const dr = el.dateRange?.start;
          if (!dr) continue;
          const dateKey = `${dr.year}-${String(dr.month).padStart(2, '0')}-${String(dr.day).padStart(2, '0')}`;

          const impressions = el.impressions || 0;
          const clicks = el.clicks || 0;
          const spend = parseFloat(el.costInLocalCurrency || '0');
          const leads = (el.oneClickLeads || 0) + (el.externalWebsiteConversions || 0);

          // Update daily data
          if (!dailyData.has(dateKey)) {
            dailyData.set(dateKey, new Map());
          }
          const dayMap = dailyData.get(dateKey)!;
          const existing = dayMap.get(companyUrn) || { impressions: 0, clicks: 0, spend: 0, leads: 0 };
          dayMap.set(companyUrn, {
            impressions: existing.impressions + impressions,
            clicks: existing.clicks + clicks,
            spend: existing.spend + spend,
            leads: existing.leads + leads,
          });

          // Update company totals
          const total = companyTotals.get(companyUrn) || { impressions: 0, clicks: 0, spend: 0, leads: 0 };
          companyTotals.set(companyUrn, {
            impressions: total.impressions + impressions,
            clicks: total.clicks + clicks,
            spend: total.spend + spend,
            leads: total.leads + leads,
          });
        }

        // Step 3: Three-step company name resolution pipeline
        // Step 3A: Load cached names from Supabase first
        // Step 3B: Query LinkedIn API only for missing IDs
        // Step 3C: Upsert resolved names to cache
        
        const topCompanyUrns = Array.from(companyTotals.entries())
          .sort((a, b) => b[1].impressions - a[1].impressions)
          .slice(0, 100)
          .map(([urn]) => urn);

        const companyNames = new Map<string, string>();
        const orgIdToUrn = new Map<string, string>();
        let namesResolutionFailed = false;
        let namesResolutionError: string | null = null;

        // Use normalizeCompanyUrn to extract IDs from all URN formats
        topCompanyUrns.forEach(urn => {
          const { id, originalUrn } = normalizeCompanyUrn(urn);
          if (id) {
            orgIdToUrn.set(id, originalUrn);
          }
        });

        const orgIds = Array.from(orgIdToUrn.keys());
        console.log(`[get_company_engagement_timeline] Extracted ${orgIds.length} valid org IDs from ${topCompanyUrns.length} URNs`);

        // Step 3A: Load cached names from Supabase first
        try {
          const { data: cached, error: cacheError } = await supabaseClient
            .from('linkedin_company_cache')
            .select('org_id, name, vanity_name')
            .in('org_id', orgIds);

          if (!cacheError && cached) {
            console.log(`[get_company_engagement_timeline] Loaded ${cached.length} cached company names`);
            cached.forEach((row: { org_id: string; name: string; vanity_name: string | null }) => {
              const displayName = row.name || row.vanity_name || '';
              if (displayName) {
                companyNames.set(row.org_id, displayName);
                companyNames.set(`urn:li:organization:${row.org_id}`, displayName);
                companyNames.set(`urn:li:company:${row.org_id}`, displayName);
                companyNames.set(`urn:li:memberCompany:${row.org_id}`, displayName);
              }
            });
          } else if (cacheError) {
            console.error('[get_company_engagement_timeline] Cache lookup error:', cacheError);
          }
        } catch (e) {
          console.error('[get_company_engagement_timeline] Cache lookup error:', e);
        }

        // Step 3B: Only query LinkedIn for IDs not in cache
        const idsMissing = orgIds.filter(id => !companyNames.has(id));
        console.log(`[get_company_engagement_timeline] ${orgIds.length - idsMissing.length} from cache, ${idsMissing.length} need API lookup`);

        if (idsMissing.length > 0) {
          console.log(`[get_company_engagement_timeline] Resolving ${idsMissing.length} org names via batch lookup...`);

          const idsToResolve = idsMissing.slice(0, 500);
          let successCount = 0;
          const newlyResolved: Array<{ id: string; name: string; vanityName: string | null }> = [];

          // Batch fetch organization data (same as get_company_demographic)
          const batchSize = 50;
          for (let i = 0; i < idsToResolve.length; i += batchSize) {
            const batch = idsToResolve.slice(i, i + batchSize);
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
                  const originalUrn = orgIdToUrn.get(id);
                  const name = org?.localizedName || org?.vanityName;
                  const vanityName = org?.vanityName || null;

                  if (name) {
                    if (originalUrn) companyNames.set(originalUrn, name);
                    companyNames.set(`urn:li:organization:${id}`, name);
                    companyNames.set(`urn:li:company:${id}`, name);
                    companyNames.set(`urn:li:memberCompany:${id}`, name);
                    companyNames.set(id, name);
                    successCount++;
                    newlyResolved.push({ id, name, vanityName });
                  }
                });
              } else {
                const errorText = await orgResponse.text();
                console.log(`[get_company_engagement_timeline] Org lookup batch failed: ${orgResponse.status}`, errorText.slice(0, 200));
                if (orgResponse.status === 403) {
                  namesResolutionFailed = true;
                  namesResolutionError = errorText.slice(0, 200);
                }
              }
            } catch (e) {
              console.log('[get_company_engagement_timeline] Organization lookup failed:', e);
            }
          }

          console.log(`[get_company_engagement_timeline] Batch lookups complete: ${successCount} resolved`);
          
          // Step 3C: Upsert newly resolved names to cache
          if (newlyResolved.length > 0) {
            console.log(`[get_company_engagement_timeline] Caching ${newlyResolved.length} newly resolved names...`);
            try {
              // Create authenticated client for cache writes (RLS requires auth.uid())
              const authHeader = req.headers.get('Authorization') || '';
              const supabaseAuth = createClient(
                Deno.env.get('SUPABASE_URL')!,
                Deno.env.get('SUPABASE_ANON_KEY')!,
                { global: { headers: { Authorization: authHeader } } }
              );

              const upsertData = newlyResolved.map(r => ({
                org_id: r.id,
                name: r.name,
                vanity_name: r.vanityName,
                source: 'linkedin_org_api',
                last_seen_at: new Date().toISOString(),
              }));
              
              const { error: upsertError } = await supabaseAuth
                .from('linkedin_company_cache')
                .upsert(upsertData, { onConflict: 'org_id' });
              
              if (upsertError) {
                console.error('[get_company_engagement_timeline] Cache upsert error:', upsertError);
              } else {
                console.log(`[get_company_engagement_timeline] Cached ${newlyResolved.length} company names`);
              }
            } catch (e) {
              console.error('[get_company_engagement_timeline] Cache upsert error:', e);
            }
          }
          
          // Only mark as failed if we have NO names at all (from cache or API)
          const totalNamesResolved = companyNames.size;
          if (totalNamesResolved === 0 && namesResolutionFailed) {
            namesResolutionFailed = true;
            namesResolutionError = 'All organization lookups returned 403 Forbidden and no cached names available';
          } else if (totalNamesResolved > 0) {
            namesResolutionFailed = false;
          }
        }

        console.log(`[get_company_engagement_timeline] FINAL: Resolved ${companyNames.size} company names. Resolution failed: ${namesResolutionFailed}`);

        // Step 4: Build timeline data
        const dates = Array.from(dailyData.keys()).sort();

        // Daily aggregates (all companies combined)
        const dailyAggregates = dates.map(date => {
          const dayMap = dailyData.get(date)!;
          let totalImpressions = 0;
          let totalClicks = 0;
          let totalSpend = 0;
          let totalLeads = 0;
          let companyCount = 0;

          dayMap.forEach((metrics) => {
            totalImpressions += metrics.impressions;
            totalClicks += metrics.clicks;
            totalSpend += metrics.spend;
            totalLeads += metrics.leads;
            companyCount++;
          });

          return {
            date,
            impressions: totalImpressions,
            clicks: totalClicks,
            spend: totalSpend,
            leads: totalLeads,
            companyCount,
            ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
          };
        });

        // Top companies with their daily data
        const topCompanies = topCompanyUrns.slice(0, 20).map(urn => {
          const totals = companyTotals.get(urn)!;
          
          // Use multi-key lookup
          const { id: companyId } = normalizeCompanyUrn(urn);
          const lookupKeys = [
            urn,
            companyId ?? '',
            `urn:li:organization:${companyId}`,
            `urn:li:company:${companyId}`,
            `urn:li:memberCompany:${companyId}`,
          ].filter(Boolean);
          
          let name = lookupKeys.map(k => companyNames.get(k)).find(Boolean);
          if (!name) {
            name = companyId ? `Company ${companyId}` : 'Unknown Company';
          }

          // Get daily data for this company
          const timeline = dates.map(date => {
            const dayMap = dailyData.get(date);
            const metrics = dayMap?.get(urn) || { impressions: 0, clicks: 0, spend: 0, leads: 0 };
            return {
              date,
              ...metrics,
            };
          });

          return {
            companyUrn: urn,
            companyName: name,
            totals: {
              impressions: totals.impressions,
              clicks: totals.clicks,
              spend: totals.spend,
              leads: totals.leads,
              ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
            },
            timeline,
          };
        });

        // Summary
        const summary = {
          totalCompanies: companyTotals.size,
          totalImpressions: Array.from(companyTotals.values()).reduce((sum, c) => sum + c.impressions, 0),
          totalClicks: Array.from(companyTotals.values()).reduce((sum, c) => sum + c.clicks, 0),
          totalSpend: Array.from(companyTotals.values()).reduce((sum, c) => sum + c.spend, 0),
          totalLeads: Array.from(companyTotals.values()).reduce((sum, c) => sum + c.leads, 0),
          dateRange: { start: startDate, end: endDate },
          daysInRange: dates.length,
        };

        console.log(`[get_company_engagement_timeline] Complete. ${topCompanies.length} companies, ${dates.length} days`);

        return new Response(JSON.stringify({
          summary,
          dailyAggregates,
          topCompanies,
          metadata: {
            accountId,
            companiesResolved: companyNames.size,
            namesResolutionFailed,
            namesResolutionError,
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'get_company_engagement_report': {
        // Combined Company Engagement Report - uses EXACT same pattern as working get_company_demographic
        const { accountId, dateRange, minImpressions, campaignIds } = params || {};
        const startDate = dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const endDate = dateRange?.end || new Date().toISOString().split('T')[0];
        const impressionThreshold = minImpressions || 100;

        // Parse date strings directly (same as demographic)
        const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
        const [endYear, endMonth, endDay] = endDate.split('-').map(Number);

        console.log(`[get_company_engagement_report] Account ${accountId}, period: ${startDate} to ${endDate}`);

        // Step 1: Fetch company analytics with MEMBER_COMPANY pivot (SAME as demographic)
        let analyticsUrl = `https://api.linkedin.com/v2/adAnalyticsV2?q=analytics&` +
          `dateRange.start.day=${startDay}&` +
          `dateRange.start.month=${startMonth}&` +
          `dateRange.start.year=${startYear}&` +
          `dateRange.end.day=${endDay}&` +
          `dateRange.end.month=${endMonth}&` +
          `dateRange.end.year=${endYear}&` +
          `timeGranularity=ALL&` +
          `pivot=MEMBER_COMPANY&` +
          `accounts[0]=urn:li:sponsoredAccount:${accountId}&` +
          `fields=impressions,clicks,costInLocalCurrency,externalWebsiteConversions,oneClickLeads,oneClickLeadFormOpens,pivotValue&` +
          `count=10000`;

        // Add campaign filter if provided
        if (campaignIds && campaignIds.length > 0) {
          campaignIds.forEach((id: string, i: number) => {
            analyticsUrl += `&campaigns[${i}]=urn:li:sponsoredCampaign:${id}`;
          });
        }

        console.log('[get_company_engagement_report] Step 1: Fetching company analytics...');

        // Paginated fetch (same as demographic)
        let allElements: any[] = [];
        let startOffset = 0;
        const pageSize = 10000;
        let hasMore = true;

        while (hasMore) {
          const paginatedUrl = `${analyticsUrl}&start=${startOffset}`;

          const analyticsResponse = await fetch(paginatedUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          });

          if (!analyticsResponse.ok) {
            const errorText = await analyticsResponse.text();
            console.error('[get_company_engagement_report] Analytics error:', analyticsResponse.status, errorText);
            return new Response(JSON.stringify({
              error: 'Failed to fetch company analytics',
              details: errorText,
              companies: []
            }), {
              status: analyticsResponse.status,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          const analyticsData = await analyticsResponse.json();
          const pageElements = analyticsData.elements || [];
          allElements = allElements.concat(pageElements);

          console.log(`[get_company_engagement_report] Page at offset ${startOffset}: ${pageElements.length} records, total: ${allElements.length}`);

          // Check pagination
          const paging = analyticsData.paging;
          if (paging && paging.total && (startOffset + pageElements.length) < paging.total) {
            startOffset += pageSize;
          } else if (pageElements.length === pageSize) {
            startOffset += pageSize;
          } else {
            hasMore = false;
          }

          if (startOffset > 100000) {
            hasMore = false;
          }
        }

        console.log(`[get_company_engagement_report] Total: ${allElements.length} company records`);

        // Aggregate by company URN (same as demographic)
        const companyMap = new Map<string, {
          entityUrn: string;
          impressions: number;
          clicks: number;
          spend: number;
          leads: number;
          formOpens: number;
        }>();

        allElements.forEach((el: any) => {
          const entityUrn = el.pivotValue || '';
          if (!entityUrn) return;

          const existing = companyMap.get(entityUrn) || {
            entityUrn,
            impressions: 0,
            clicks: 0,
            spend: 0,
            leads: 0,
            formOpens: 0,
          };
          companyMap.set(entityUrn, {
            entityUrn,
            impressions: existing.impressions + (el.impressions || 0),
            clicks: existing.clicks + (el.clicks || 0),
            spend: existing.spend + parseFloat(el.costInLocalCurrency || '0'),
            leads: existing.leads + (el.oneClickLeads || 0) + (el.externalWebsiteConversions || 0),
            formOpens: existing.formOpens + (el.oneClickLeadFormOpens || 0),
          });
        });

        console.log(`[get_company_engagement_report] Aggregated ${companyMap.size} unique companies`);

        // Step 2: Resolve company names via Organization Lookup (SAME as demographic)
        const companyNames = new Map<string, string>();
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
        console.log(`[get_company_engagement_report] Step 2: Resolving ${orgIds.length} organization names...`);

        // Batch fetch organization data (SAME as demographic)
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
                });
              } else {
                console.log(`[get_company_engagement_report] Org lookup batch failed: ${orgResponse.status}`);
              }
            } catch (e) {
              console.log('[get_company_engagement_report] Organization lookup error:', e);
            }
          }
        }

        console.log(`[get_company_engagement_report] Resolved ${companyNames.size} company names`);

        // Step 3: Build final report with engagement scoring
        const companies: Array<{
          companyUrn: string;
          companyName: string;
          engagementScore: number;
          impressions: number;
          clicks: number;
          spend: number;
          leads: number;
          formOpens: number;
          ctr: number;
          cpc: number;
          cpm: number;
          cpl: number;
        }> = [];

        for (const [companyUrn, data] of companyMap.entries()) {
          // Filter by minimum impressions
          if (data.impressions < impressionThreshold) continue;

          // Calculate engagement score
          const engagementScore = (data.leads * 100) + (data.clicks * 5) + (data.impressions * 0.01);

          // Get company name - use resolved name or extract from URN
          const companyName = companyNames.get(companyUrn) || extractNameFromUrn(companyUrn);

          // Calculate metrics
          const ctr = data.impressions > 0 ? (data.clicks / data.impressions) * 100 : 0;
          const cpc = data.clicks > 0 ? data.spend / data.clicks : 0;
          const cpm = data.impressions > 0 ? (data.spend / data.impressions) * 1000 : 0;
          const cpl = data.leads > 0 ? data.spend / data.leads : 0;

          companies.push({
            companyUrn,
            companyName,
            engagementScore: Math.round(engagementScore),
            impressions: data.impressions,
            clicks: data.clicks,
            spend: data.spend,
            leads: data.leads,
            formOpens: data.formOpens,
            ctr,
            cpc,
            cpm,
            cpl,
          });
        }

        // Sort by engagement score
        companies.sort((a, b) => b.engagementScore - a.engagementScore);

        // Calculate summary metrics
        const summary = {
          totalCompanies: companies.length,
          companiesEngaged: companies.filter(c => c.clicks > 0).length,
          companiesConverted: companies.filter(c => c.leads > 0).length,
          totalImpressions: companies.reduce((sum, c) => sum + c.impressions, 0),
          totalClicks: companies.reduce((sum, c) => sum + c.clicks, 0),
          totalSpend: companies.reduce((sum, c) => sum + c.spend, 0),
          totalLeads: companies.reduce((sum, c) => sum + c.leads, 0),
          avgCtr: companies.length > 0 ? companies.reduce((sum, c) => sum + c.ctr, 0) / companies.length : 0,
          avgCpc: companies.filter(c => c.clicks > 0).length > 0
            ? companies.filter(c => c.clicks > 0).reduce((sum, c) => sum + c.cpc, 0) / companies.filter(c => c.clicks > 0).length
            : 0,
        };

        // Engagement tiers
        const sortedByScore = [...companies].sort((a, b) => b.engagementScore - a.engagementScore);
        const hotThreshold = sortedByScore[Math.floor(sortedByScore.length * 0.1)]?.engagementScore || Infinity;
        const warmThreshold = sortedByScore[Math.floor(sortedByScore.length * 0.3)]?.engagementScore || 0;

        const engagementTiers = {
          hot: companies.filter(c => c.engagementScore >= hotThreshold && c.leads > 0).length,
          warm: companies.filter(c => c.engagementScore >= warmThreshold && c.engagementScore < hotThreshold).length,
          cold: companies.filter(c => c.engagementScore < warmThreshold).length,
        };

        console.log(`[get_company_engagement_report] Complete. ${companies.length} companies, ${companyNames.size} names resolved`);

        return new Response(JSON.stringify({
          period: { start: startDate, end: endDate },
          summary,
          engagementTiers,
          companies: companies.slice(0, 500),
          metadata: {
            accountId,
            impressionThreshold,
            namesResolved: companyNames.size,
            namesUnresolved: companies.length - companyNames.size,
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'update_company_name': {
        // Manual override for company names - stores in cache with source='manual'
        const { orgId, name, source = 'manual' } = params || {};

        if (!orgId || !name) {
          return new Response(JSON.stringify({ error: 'orgId and name are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        console.log(`[update_company_name] Saving name for ${orgId}: "${name}" (source: ${source})`);

        try {
          // Create request-scoped authenticated client for RLS
          const authHeader = req.headers.get('Authorization') || '';
          const supabaseAuth = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_ANON_KEY')!,
            { global: { headers: { Authorization: authHeader } } }
          );

          const { data, error } = await supabaseAuth
            .from('linkedin_company_cache')
            .upsert({
              org_id: orgId,
              name: name.trim(),
              source,
              last_seen_at: new Date().toISOString()
            }, { onConflict: 'org_id' })
            .select()
            .single();

          if (error) throw error;

          console.log(`[update_company_name] Saved name for ${orgId}: "${name}" (source: ${source})`);

          return new Response(JSON.stringify({ success: true, data }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (e) {
          console.error('[update_company_name] Error:', e);
          return new Response(JSON.stringify({ error: 'Failed to save company name' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      case 'get_budget_pacing_summary': {
        // Lightweight multi-account budget pacing summary
        const { accountIds } = params || {};
        if (!accountIds || !Array.isArray(accountIds) || accountIds.length === 0) {
          return new Response(JSON.stringify({ error: 'accountIds array required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const daysInMonth = new Date(year, month, 0).getDate();
        const currentDay = now.getDate();
        const daysRemaining = daysInMonth - currentDay;
        const monthStr = `${year}-${String(month).padStart(2, '0')}-01`;

        console.log(`[get_budget_pacing_summary] Fetching ${accountIds.length} accounts, month ${monthStr}`);

        const results = await Promise.allSettled(accountIds.map(async (acctId: string) => {
          // Monthly spend params
          const spendParams = new URLSearchParams();
          spendParams.set('q', 'analytics');
          spendParams.set('dateRange.start.day', '1');
          spendParams.set('dateRange.start.month', String(month));
          spendParams.set('dateRange.start.year', String(year));
          spendParams.set('dateRange.end.day', String(currentDay));
          spendParams.set('dateRange.end.month', String(month));
          spendParams.set('dateRange.end.year', String(year));
          spendParams.set('timeGranularity', 'MONTHLY');
          spendParams.set('pivot', 'ACCOUNT');
          spendParams.set('accounts[0]', `urn:li:sponsoredAccount:${acctId}`);
          spendParams.set('fields', 'costInLocalCurrency');

          // Last 3 full days (excluding today) - DAILY granularity
          const threeDaysAgo = new Date(now);
          threeDaysAgo.setDate(now.getDate() - 3);
          const dailyParams = new URLSearchParams();
          dailyParams.set('q', 'analytics');
          dailyParams.set('dateRange.start.day', String(threeDaysAgo.getDate()));
          dailyParams.set('dateRange.start.month', String(threeDaysAgo.getMonth() + 1));
          dailyParams.set('dateRange.start.year', String(threeDaysAgo.getFullYear()));
          // End = yesterday
          const yesterday = new Date(now);
          yesterday.setDate(now.getDate() - 1);
          dailyParams.set('dateRange.end.day', String(yesterday.getDate()));
          dailyParams.set('dateRange.end.month', String(yesterday.getMonth() + 1));
          dailyParams.set('dateRange.end.year', String(yesterday.getFullYear()));
          dailyParams.set('timeGranularity', 'DAILY');
          dailyParams.set('pivot', 'ACCOUNT');
          dailyParams.set('accounts[0]', `urn:li:sponsoredAccount:${acctId}`);
          dailyParams.set('fields', 'costInLocalCurrency,dateRange');

          const [spendRes, dailyRes, budgetRes] = await Promise.all([
            fetch(`https://api.linkedin.com/v2/adAnalyticsV2?${spendParams.toString()}`, {
              headers: { 'Authorization': `Bearer ${accessToken}` }
            }),
            fetch(`https://api.linkedin.com/v2/adAnalyticsV2?${dailyParams.toString()}`, {
              headers: { 'Authorization': `Bearer ${accessToken}` }
            }),
            supabaseClient
              .from('account_budgets')
              .select('budget_amount, currency')
              .eq('account_id', acctId)
              .eq('month', monthStr)
              .maybeSingle()
          ]);

          let spent = 0;
          if (spendRes.ok) {
            const spendData = await spendRes.json();
            const el = spendData?.elements?.[0];
            if (el) spent = parseFloat(el.costInLocalCurrency || '0');
          }

          // Parse last 3 days daily data
          const last3Days: Array<{ date: string; spend: number }> = [];
          let last3Total = 0;
          if (dailyRes.ok) {
            const dailyData = await dailyRes.json();
            for (const el of (dailyData?.elements || [])) {
              const ds = el.dateRange?.start;
              const daySpend = parseFloat(el.costInLocalCurrency || '0');
              const dateStr = ds ? `${ds.year}-${String(ds.month).padStart(2,'0')}-${String(ds.day).padStart(2,'0')}` : '';
              last3Days.push({ date: dateStr, spend: daySpend });
              last3Total += daySpend;
            }
          }
          // Sort by date ascending
          last3Days.sort((a, b) => a.date.localeCompare(b.date));

          const budgetAmount = budgetRes.data?.budget_amount || 0;
          const currency = budgetRes.data?.currency || 'USD';

          const avgDaily = currentDay > 0 ? spent / currentDay : 0;
          const projected = avgDaily * daysInMonth;

          const daysWithData = last3Days.filter(d => d.spend > 0).length || last3Days.length;
          const avgDaily3d = daysWithData > 0 ? last3Total / daysWithData : avgDaily;
          const projected3d = avgDaily3d * daysInMonth;

          let pacingPercent = 0;
          let pacingStatus: 'on_track' | 'underspend' | 'overspend' = 'on_track';
          if (budgetAmount > 0) {
            const idealSpent = (budgetAmount / daysInMonth) * currentDay;
            pacingPercent = idealSpent > 0 ? (spent / idealSpent) * 100 : 0;
            if (pacingPercent < 85) pacingStatus = 'underspend';
            else if (pacingPercent > 115) pacingStatus = 'overspend';
          }

          return {
            accountId: acctId,
            budget: budgetAmount,
            spent,
            currency,
            pacingPercent: Math.round(pacingPercent * 10) / 10,
            pacingStatus,
            daysRemaining,
            daysInMonth,
            projected: Math.round(projected * 100) / 100,
            avgDaily: Math.round(avgDaily * 100) / 100,
            avgDaily3d: Math.round(avgDaily3d * 100) / 100,
            projected3d: Math.round(projected3d * 100) / 100,
            last3Days,
          };
        }));

        const summaries = results
          .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
          .map(r => r.value);

        const errors = results
          .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
          .map((r, i) => ({ accountId: accountIds[i], error: r.reason?.message || 'Unknown error' }));

        if (errors.length > 0) {
          console.warn(`[get_budget_pacing_summary] ${errors.length} accounts failed:`, errors);
        }

        console.log(`[get_budget_pacing_summary] Done. ${summaries.length} succeeded, ${errors.length} failed`);

        return new Response(JSON.stringify(summaries), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // ============ CUSTOM FIELDS CRUD ============

      case 'get_custom_fields': {
        // Get all custom fields for an account, optionally filtered by entity type
        const { accountId, entityType, entityId } = params || {};

        if (!accountId) {
          return new Response(JSON.stringify({ error: 'accountId is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        try {
          // Use user-scoped client for RLS
          const authHeader = req.headers.get('Authorization');
          const userClient = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_ANON_KEY')!,
            { global: { headers: { Authorization: authHeader || '' } } }
          );

          let query = userClient
            .from('custom_fields')
            .select('*')
            .eq('account_id', accountId);

          if (entityType) {
            query = query.eq('entity_type', entityType);
          }
          if (entityId) {
            query = query.eq('entity_id', entityId);
          }

          const { data, error } = await query.order('field_name');

          if (error) throw error;

          // Group by entity for easier consumption
          const grouped: Record<string, Record<string, string>> = {};
          for (const field of (data || [])) {
            const key = `${field.entity_type}:${field.entity_id}`;
            if (!grouped[key]) {
              grouped[key] = {};
            }
            grouped[key][field.field_name] = field.field_value;
          }

          return new Response(JSON.stringify({
            fields: data || [],
            grouped
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (e) {
          console.error('[get_custom_fields] Error:', e);
          return new Response(JSON.stringify({ error: 'Failed to fetch custom fields' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      case 'set_custom_field': {
        // Create or update a custom field
        const { accountId, entityType, entityId, fieldName, fieldValue } = params || {};

        if (!accountId || !entityType || !entityId || !fieldName) {
          return new Response(JSON.stringify({
            error: 'accountId, entityType, entityId, and fieldName are required'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (!['campaign', 'campaign_group'].includes(entityType)) {
          return new Response(JSON.stringify({
            error: 'entityType must be "campaign" or "campaign_group"'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        try {
          // Get user from auth header
          const authHeader = req.headers.get('Authorization');
          const userClient = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_ANON_KEY')!,
            { global: { headers: { Authorization: authHeader || '' } } }
          );
          const { data: { user }, error: userError } = await userClient.auth.getUser();
          if (userError || !user) {
            console.error('[set_custom_field] Auth error:', userError);
            return new Response(JSON.stringify({ error: 'Authentication required' }), {
              status: 401,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          console.log('[set_custom_field] User:', user.id, 'Account:', accountId, 'Entity:', entityType, entityId, 'Field:', fieldName);

          const { data, error } = await userClient
            .from('custom_fields')
            .upsert({
              account_id: accountId,
              entity_type: entityType,
              entity_id: entityId,
              field_name: fieldName,
              field_value: fieldValue || null,
              user_id: user.id
            }, {
              onConflict: 'account_id,entity_type,entity_id,field_name,user_id'
            })
            .select()
            .single();

          if (error) {
            console.error('[set_custom_field] DB error:', error);
            throw error;
          }

          console.log('[set_custom_field] Success:', data?.id);
          return new Response(JSON.stringify({ success: true, field: data }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (e) {
          console.error('[set_custom_field] Error:', e);
          return new Response(JSON.stringify({ error: 'Failed to save custom field' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      case 'delete_custom_field': {
        // Delete a custom field
        const { accountId, entityType, entityId, fieldName } = params || {};

        if (!accountId || !entityType || !entityId || !fieldName) {
          return new Response(JSON.stringify({
            error: 'accountId, entityType, entityId, and fieldName are required'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        try {
          const authHeader = req.headers.get('Authorization');
          const userClient = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_ANON_KEY')!,
            { global: { headers: { Authorization: authHeader || '' } } }
          );

          const { error } = await userClient
            .from('custom_fields')
            .delete()
            .eq('account_id', accountId)
            .eq('entity_type', entityType)
            .eq('entity_id', entityId)
            .eq('field_name', fieldName);

          if (error) throw error;

          return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (e) {
          console.error('[delete_custom_field] Error:', e);
          return new Response(JSON.stringify({ error: 'Failed to delete custom field' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      case 'bulk_set_custom_fields': {
        // Set multiple custom fields at once
        const { accountId, fields } = params || {};

        if (!accountId || !fields || !Array.isArray(fields)) {
          return new Response(JSON.stringify({
            error: 'accountId and fields array are required'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        try {
          const records = fields.map((f: any) => ({
            account_id: accountId,
            entity_type: f.entityType,
            entity_id: f.entityId,
            field_name: f.fieldName,
            field_value: f.fieldValue || null
          }));

          const { data, error } = await supabaseClient
            .from('custom_fields')
            .upsert(records, {
              onConflict: 'account_id,entity_type,entity_id,field_name'
            })
            .select();

          if (error) throw error;

          return new Response(JSON.stringify({ success: true, count: data?.length || 0 }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (e) {
          console.error('[bulk_set_custom_fields] Error:', e);
          return new Response(JSON.stringify({ error: 'Failed to save custom fields' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      case 'get_company_conversion_breakdown': {
        const { accountId, dateRange, maxConversions } = params || {};
        const startDate = dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const endDate = dateRange?.end || new Date().toISOString().split('T')[0];
        const conversionCap = Math.min(typeof maxConversions === 'number' ? maxConversions : 20, 20);

        const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
        const [endYear, endMonth, endDay] = endDate.split('-').map(Number);

        console.log(`[get_company_conversion_breakdown] Account ${accountId}, ${startDate} to ${endDate}, cap ${conversionCap}`);

        // Step 1: Fetch conversion definitions
        // URN must be URL-encoded in the query string (colons are special chars)
        const accountUrn = encodeURIComponent(`urn:li:sponsoredAccount:${accountId}`);
        const convDefsUrl = `https://api.linkedin.com/rest/conversions?q=account&account=${accountUrn}`;
        const convDefsResponse = await fetch(convDefsUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'LinkedIn-Version': '202511',
            'X-Restli-Protocol-Version': '2.0.0',
          },
        });

        if (!convDefsResponse.ok) {
          const errorText = await convDefsResponse.text();
          console.error('[get_company_conversion_breakdown] Failed to fetch conversions:', convDefsResponse.status, errorText);
          return new Response(JSON.stringify({ error: `Failed to fetch conversion definitions (HTTP ${convDefsResponse.status})`, details: errorText, conversions: [], companies: [] }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const convDefsData = await convDefsResponse.json();
        const allConvDefs: Array<{ id: string; urn: string; name: string; type: string; enabled: boolean }> =
          (convDefsData.elements || [])
            .filter((c: any) => c.enabled !== false)
            .slice(0, conversionCap)
            .map((c: any) => ({
              id: String(c.id),
              urn: c.id ? `urn:li:conversion:${c.id}` : (c.$URN || ''),
              name: c.name || `Conversion ${c.id}`,
              type: c.type || 'UNKNOWN',
              enabled: c.enabled !== false,
            }));

        console.log(`[get_company_conversion_breakdown] Found ${allConvDefs.length} enabled conversions`);

        if (allConvDefs.length === 0) {
          return new Response(JSON.stringify({ conversions: [], companies: [] }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Step 2: Parallel adAnalyticsV2 calls — one per conversion with MEMBER_COMPANY pivot
        // LinkedIn adAnalyticsV2 uses List() notation for the conversions filter
        const analyticsResults = await Promise.all(allConvDefs.map(async (conv) => {
          const analyticsUrl = `https://api.linkedin.com/v2/adAnalyticsV2?q=analytics&` +
            `dateRange.start.day=${startDay}&dateRange.start.month=${startMonth}&dateRange.start.year=${startYear}&` +
            `dateRange.end.day=${endDay}&dateRange.end.month=${endMonth}&dateRange.end.year=${endYear}&` +
            `timeGranularity=ALL&pivot=MEMBER_COMPANY&` +
            `accounts[0]=urn:li:sponsoredAccount:${accountId}&` +
            `conversions=List(${encodeURIComponent(conv.urn)})&` +
            `fields=externalWebsiteConversions,pivotValue&` +
            `count=10000`;

          try {
            const resp = await fetch(analyticsUrl, {
              headers: { 'Authorization': `Bearer ${accessToken}` },
            });
            if (!resp.ok) {
              console.warn(`[get_company_conversion_breakdown] Analytics failed for conversion ${conv.id}: ${resp.status}`);
              return { convId: conv.id, elements: [] };
            }
            const data = await resp.json();
            return { convId: conv.id, elements: data.elements || [] };
          } catch (e) {
            console.warn(`[get_company_conversion_breakdown] Error for conversion ${conv.id}:`, e);
            return { convId: conv.id, elements: [] };
          }
        }));

        // Step 3: Aggregate into { companyUrn -> { convId -> count } }
        const companyMap = new Map<string, Record<string, number>>();

        for (const { convId, elements } of analyticsResults) {
          for (const el of elements) {
            const entityUrn = el.pivotValue || '';
            if (!entityUrn) continue;
            const count = el.externalWebsiteConversions || 0;
            if (!companyMap.has(entityUrn)) companyMap.set(entityUrn, {});
            const entry = companyMap.get(entityUrn)!;
            entry[convId] = (entry[convId] || 0) + count;
          }
        }

        console.log(`[get_company_conversion_breakdown] Aggregated ${companyMap.size} companies`);

        // Step 4: Resolve company names via organizationsLookup
        const companyUrns = Array.from(companyMap.keys());
        const companyNames = new Map<string, string>();

        if (companyUrns.length > 0) {
          const orgIdToUrn = new Map<string, string>();
          companyUrns.forEach(urn => {
            const match = urn.match(/^urn:li:organization:(\d+)$/);
            if (match) orgIdToUrn.set(match[1], urn);
          });

          const orgIds = Array.from(orgIdToUrn.keys());
          const batchSize = 50;
          for (let i = 0; i < orgIds.length; i += batchSize) {
            const batch = orgIds.slice(i, i + batchSize);
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
                  const urn = orgIdToUrn.get(id);
                  if (urn && org?.localizedName) companyNames.set(urn, org.localizedName);
                });
              }
            } catch (e) {
              console.warn('[get_company_conversion_breakdown] Organization lookup failed:', e);
            }
          }
        }

        console.log(`[get_company_conversion_breakdown] Resolved ${companyNames.size} company names`);

        // Step 5: Build flat result array sorted by total conversions desc
        const companies = Array.from(companyMap.entries()).map(([entityUrn, byConversion]) => {
          const totalConversions = Object.values(byConversion).reduce((sum, v) => sum + v, 0);
          return {
            entityUrn,
            entityName: companyNames.get(entityUrn) || extractNameFromUrn(entityUrn),
            totalConversions,
            byConversion,
          };
        });
        companies.sort((a, b) => b.totalConversions - a.totalConversions);

        return new Response(JSON.stringify({
          conversions: allConvDefs,
          companies,
          metadata: {
            accountId,
            dateRange: { start: startDate, end: endDate },
            cappedAt: conversionCap,
          },
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_lead_company_journey': {
        const { accountId, orgName, submittedAtMs, lookbackDays = 90 } = params || {};

        if (!accountId || !orgName) {
          return new Response(JSON.stringify({ error: 'accountId and orgName are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        console.log(`[get_lead_company_journey] account=${accountId} org="${orgName}" submittedAt=${submittedAtMs} lookback=${lookbackDays}d`);

        // --- Step A: Resolve company name → org URN ---
        let resolvedOrgId: string | null = null;
        let resolvedOrgName: string = orgName;

        // A1: Check linkedin_company_cache by name (case-insensitive)
        try {
          const { data: cached } = await supabaseClient
            .from('linkedin_company_cache')
            .select('org_id, name')
            .ilike('name', orgName)
            .limit(1);
          if (cached && cached.length > 0) {
            resolvedOrgId = cached[0].org_id;
            resolvedOrgName = cached[0].name || orgName;
            console.log(`[get_lead_company_journey] Cache hit for "${orgName}" → org_id=${resolvedOrgId}`);
          }
        } catch (e) {
          console.error('[get_lead_company_journey] Cache lookup error:', e);
        }

        // A2: If not in cache, search LinkedIn org API
        if (!resolvedOrgId) {
          try {
            const searchUrl = `https://api.linkedin.com/v2/organizationsLookup?q=vanityName&vanityName=${encodeURIComponent(orgName.toLowerCase().replace(/\s+/g, '-'))}&projection=(results*(id,localizedName))`;
            const searchResp = await fetch(searchUrl, {
              headers: { 'Authorization': `Bearer ${accessToken}` },
            });
            if (searchResp.ok) {
              const searchData = await searchResp.json();
              const results = searchData.results || [];
              if (results.length > 0) {
                resolvedOrgId = String(results[0].id);
                resolvedOrgName = results[0].localizedName || orgName;
                console.log(`[get_lead_company_journey] vanityName search hit for "${orgName}" → ${resolvedOrgId}`);
              }
            }
          } catch (e) {
            console.error('[get_lead_company_journey] org vanityName search error:', e);
          }
        }

        // A3: Try keyword search if still not resolved
        if (!resolvedOrgId) {
          try {
            const kwUrl = `https://api.linkedin.com/rest/organizations?q=search&keywords=${encodeURIComponent(orgName)}&count=3`;
            const kwResp = await fetch(kwUrl, {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'LinkedIn-Version': '202511',
                'X-Restli-Protocol-Version': '2.0.0',
              },
            });
            if (kwResp.ok) {
              const kwData = await kwResp.json();
              const elements = kwData.elements || [];
              if (elements.length > 0) {
                const first = elements[0];
                const rawId = first.id ? String(first.id) : (first.entityUrn || '').split(':').pop();
                if (rawId) {
                  resolvedOrgId = rawId;
                  resolvedOrgName = first.localizedName || first.name || orgName;
                  console.log(`[get_lead_company_journey] keyword search hit for "${orgName}" → ${resolvedOrgId}`);
                  // Cache it
                  try {
                    await supabaseClient.from('linkedin_company_cache').upsert({
                      org_id: resolvedOrgId,
                      name: resolvedOrgName,
                      vanity_name: first.vanityName || null,
                      source: 'keyword_search',
                      last_seen_at: new Date().toISOString(),
                    }, { onConflict: 'org_id' });
                  } catch (_) {}
                }
              }
            }
          } catch (e) {
            console.error('[get_lead_company_journey] org keyword search error:', e);
          }
        }

        if (!resolvedOrgId) {
          console.log(`[get_lead_company_journey] Could not resolve org for "${orgName}"`);
          return new Response(JSON.stringify({
            orgResolved: false,
            orgName,
            window: null,
            total: { impressions: 0, clicks: 0, spend: 0 },
            campaigns: [],
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // --- Build date window ---
        const endMs = submittedAtMs ? Number(submittedAtMs) : Date.now();
        const startMs = endMs - lookbackDays * 24 * 60 * 60 * 1000;
        const toDate = (ms: number) => new Date(ms).toISOString().split('T')[0];
        const windowStart = toDate(startMs);
        const windowEnd = toDate(endMs);
        const [ws_y, ws_m, ws_d] = windowStart.split('-').map(Number);
        const [we_y, we_m, we_d] = windowEnd.split('-').map(Number);

        // --- Step B: Company-level analytics in the window ---
        let totalImpressions = 0, totalClicks = 0, totalSpend = 0;
        try {
          const companyAnalyticsUrl = `https://api.linkedin.com/v2/adAnalyticsV2?q=analytics` +
            `&pivot=MEMBER_COMPANY` +
            `&memberCompanies[0]=urn:li:organization:${resolvedOrgId}` +
            `&accounts[0]=urn:li:sponsoredAccount:${accountId}` +
            `&dateRange.start.day=${ws_d}&dateRange.start.month=${ws_m}&dateRange.start.year=${ws_y}` +
            `&dateRange.end.day=${we_d}&dateRange.end.month=${we_m}&dateRange.end.year=${we_y}` +
            `&timeGranularity=ALL` +
            `&fields=impressions,clicks,costInLocalCurrency,pivotValue`;

          const compResp = await fetch(companyAnalyticsUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          });
          if (compResp.ok) {
            const compData = await compResp.json();
            for (const el of (compData.elements || [])) {
              totalImpressions += el.impressions || 0;
              totalClicks += el.clicks || 0;
              totalSpend += parseFloat(el.costInLocalCurrency || '0');
            }
            console.log(`[get_lead_company_journey] Company totals: impr=${totalImpressions} clicks=${totalClicks} spend=${totalSpend}`);
          } else {
            const t = await compResp.text();
            console.error(`[get_lead_company_journey] Company analytics error: ${compResp.status}`, t.slice(0, 200));
          }
        } catch (e) {
          console.error('[get_lead_company_journey] Company analytics error:', e);
        }

        // --- Step C: Campaign-level analytics in the window ---
        const campaignMetrics = new Map<string, { impressions: number; clicks: number; spend: number }>();
        try {
          const campAnalyticsUrl = `https://api.linkedin.com/v2/adAnalyticsV2?q=analytics` +
            `&pivot=CAMPAIGN` +
            `&accounts[0]=urn:li:sponsoredAccount:${accountId}` +
            `&dateRange.start.day=${ws_d}&dateRange.start.month=${ws_m}&dateRange.start.year=${ws_y}` +
            `&dateRange.end.day=${we_d}&dateRange.end.month=${we_m}&dateRange.end.year=${we_y}` +
            `&timeGranularity=ALL` +
            `&fields=impressions,clicks,costInLocalCurrency,pivotValue` +
            `&count=500`;

          const campAnalyticsResp = await fetch(campAnalyticsUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          });
          if (campAnalyticsResp.ok) {
            const campData = await campAnalyticsResp.json();
            for (const el of (campData.elements || [])) {
              const impr = el.impressions || 0;
              if (impr === 0) continue;
              const campUrn = el.pivotValue || '';
              const campId = campUrn.split(':').pop() || '';
              if (campId) {
                campaignMetrics.set(campId, {
                  impressions: impr,
                  clicks: el.clicks || 0,
                  spend: parseFloat(el.costInLocalCurrency || '0'),
                });
              }
            }
            console.log(`[get_lead_company_journey] ${campaignMetrics.size} campaigns with impressions`);
          }
        } catch (e) {
          console.error('[get_lead_company_journey] Campaign analytics error:', e);
        }

        // --- Step D: Fetch campaign metadata (name + objectiveType) ---
        const campaigns: Array<{ id: string; name: string; objectiveType: string; impressions: number; clicks: number; spend: number }> = [];

        if (campaignMetrics.size > 0) {
          try {
            const campMetaResp = await fetch(
              `https://api.linkedin.com/v2/adCampaignsV2?q=search&search.account.values[0]=urn:li:sponsoredAccount:${accountId}&count=500&fields=id,name,objectiveType,status`,
              { headers: { 'Authorization': `Bearer ${accessToken}` } }
            );
            if (campMetaResp.ok) {
              const campMeta = await campMetaResp.json();
              for (const c of (campMeta.elements || [])) {
                const id = String(c.id || '');
                if (!id || !campaignMetrics.has(id)) continue;
                const m = campaignMetrics.get(id)!;
                campaigns.push({
                  id,
                  name: c.name || `Campaign ${id}`,
                  objectiveType: c.objectiveType || '',
                  impressions: m.impressions,
                  clicks: m.clicks,
                  spend: m.spend,
                });
              }
            }
          } catch (e) {
            console.error('[get_lead_company_journey] Campaign metadata error:', e);
          }
        }

        // Sort by impressions desc
        campaigns.sort((a, b) => b.impressions - a.impressions);

        console.log(`[get_lead_company_journey] Done: org=${resolvedOrgName}(${resolvedOrgId}), ${totalImpressions} impr, ${campaigns.length} campaigns`);

        return new Response(JSON.stringify({
          orgResolved: true,
          orgUrn: `urn:li:organization:${resolvedOrgId}`,
          orgName: resolvedOrgName,
          window: { start: windowStart, end: windowEnd, days: lookbackDays },
          total: { impressions: totalImpressions, clicks: totalClicks, spend: totalSpend },
          campaigns,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_lead_form_responses': {
        const { accountId, formUrn, dateRange: leadsDateRange, offset: leadsOffset = 0 } = params || {};

        if (!accountId) {
          return new Response(JSON.stringify({ error: 'accountId is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const leadsStartDate = leadsDateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const leadsEndDate = leadsDateRange?.end || new Date().toISOString().split('T')[0];

        // Convert YYYY-MM-DD to epoch ms (start of day UTC / end of day UTC)
        const leadsStartMs = new Date(leadsStartDate + 'T00:00:00Z').getTime();
        const leadsEndMs = new Date(leadsEndDate + 'T23:59:59Z').getTime();

        const accountUrn = `urn:li:sponsoredAccount:${accountId}`;
        // Per official docs, the URN inside the owner param must be percent-encoded
        // but the Rest.li object wrapper (parentheses, key:) must NOT be encoded.
        // Example from docs: owner=(sponsoredAccount:urn%3Ali%3AsponsoredAccount%3A522529623)
        const encodedAccountUrn = encodeURIComponent(accountUrn);

        let leadsUrl = `https://api.linkedin.com/rest/leadFormResponses?q=owner`
          + `&owner=(sponsoredAccount:${encodedAccountUrn})`
          + `&leadType=(leadType:SPONSORED)`
          + `&count=100`
          + `&start=${leadsOffset}`;

        if (formUrn) {
          leadsUrl += `&versionedLeadGenFormUrn=${encodeURIComponent(formUrn)}`;
        }

        console.log(`[get_lead_form_responses] Fetching leads for account ${accountId}, offset ${leadsOffset}, formUrn: ${formUrn || 'all'}`);

        const leadsResp = await fetch(leadsUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'LinkedIn-Version': '202511',
            'X-Restli-Protocol-Version': '2.0.0',
          },
        });

        if (!leadsResp.ok) {
          const errText = await leadsResp.text();
          console.error(`[get_lead_form_responses] API error: ${leadsResp.status} - ${errText.substring(0, 300)}`);
          return new Response(JSON.stringify({
            error: `LinkedIn API error: ${leadsResp.status}`,
            details: errText.substring(0, 300),
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const leadsData = await leadsResp.json();
        const leadsElements = leadsData.elements || [];
        const leadsPaging = leadsData.paging || {};
        const leadsTotal = leadsPaging.total ?? leadsElements.length;
        const leadsCount = leadsPaging.count ?? 100;
        const leadsStart = leadsPaging.start ?? 0;
        const leadsHasMore = leadsElements.length === leadsCount && (leadsStart + leadsCount) < leadsTotal;

        // Client-side date filtering
        const filteredElements = leadsElements.filter((el: any) => {
          if (!el.submittedAt) return true;
          return el.submittedAt >= leadsStartMs && el.submittedAt <= leadsEndMs;
        });

        const leads = filteredElements.map((el: any) => {
          const fieldMap: Record<string, string> = {};
          const customAnswers: Record<string, string> = {};

          // Parse answers — each answer may have predefinedField or be custom
          for (const answer of (el.formResponse?.answers || [])) {
            const value =
              answer.answerDetails?.textQuestionAnswer?.answer ||
              (answer.answerDetails?.multipleChoiceAnswer?.options || []).join(', ') ||
              '';
            if (answer.predefinedField) {
              fieldMap[answer.predefinedField] = value;
            } else {
              const label = `q${answer.questionId ?? 'unknown'}`;
              customAnswers[label] = value;
            }
          }

          // Also try leadMetadata fields as fallback
          if (!fieldMap['FIRST_NAME'] && el.leadMetadata?.firstName) fieldMap['FIRST_NAME'] = el.leadMetadata.firstName;
          if (!fieldMap['LAST_NAME'] && el.leadMetadata?.lastName) fieldMap['LAST_NAME'] = el.leadMetadata.lastName;
          if (!fieldMap['EMAIL'] && el.leadMetadata?.email) fieldMap['EMAIL'] = el.leadMetadata.email;
          if (!fieldMap['COMPANY'] && el.leadMetadata?.companyName) fieldMap['COMPANY'] = el.leadMetadata.companyName;

          return {
            leadUrn: el.id || '',
            formUrn: el.versionedLeadGenFormUrn || '',
            campaignUrn: el.associatedEntity?.associatedCreative || el.associatedEntity || '',
            firstName: fieldMap['FIRST_NAME'] || '',
            lastName: fieldMap['LAST_NAME'] || '',
            email: fieldMap['EMAIL'] || '',
            company: fieldMap['COMPANY'] || '',
            submittedAt: el.submittedAt || 0,
            testLead: el.testLead || false,
            customAnswers,
          };
        });

        console.log(`[get_lead_form_responses] Returning ${leads.length} leads (filtered from ${leadsElements.length}), total: ${leadsTotal}, hasMore: ${leadsHasMore}`);

        return new Response(JSON.stringify({ leads, total: leadsTotal, hasMore: leadsHasMore }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_weekly_report': {
        const { accountId } = params || {};
        if (!accountId) {
          return new Response(JSON.stringify({ error: 'accountId required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // ── Date ranges (last full Sun–Sat week + the week before) ────────
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0=Sun
        // Find the most recent Saturday (end of last full week)
        const daysToLastSat = dayOfWeek === 6 ? 0 : dayOfWeek + 1; // if today is Sat(6) it's 0, Sun(0)->1, Mon(1)->2 …
        const lastSaturday = new Date(now);
        lastSaturday.setDate(now.getDate() - daysToLastSat);
        lastSaturday.setHours(0, 0, 0, 0);

        // Sunday of the last full week = lastSaturday - 6
        const reportSunday = new Date(lastSaturday);
        reportSunday.setDate(lastSaturday.getDate() - 6);

        // Previous week for comparison
        const prevSaturday = new Date(reportSunday);
        prevSaturday.setDate(reportSunday.getDate() - 1);
        const prevSunday = new Date(prevSaturday);
        prevSunday.setDate(prevSaturday.getDate() - 6);

        const fmtD = (d: Date) =>
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

        const thisWeekRange = { start: fmtD(reportSunday), end: fmtD(lastSaturday) };
        const lastWeekRange = { start: fmtD(prevSunday), end: fmtD(prevSaturday) };

        console.log(`[get_weekly_report] thisWeek: ${thisWeekRange.start} → ${thisWeekRange.end}`);
        console.log(`[get_weekly_report] lastWeek: ${lastWeekRange.start} → ${lastWeekRange.end}`);

        // ── URL builder ─────────────────────────────────────────────────────
        function wrBuildUrl(start: string, end: string, pivot: string, gran: string, extraFields = '') {
          const [sy, sm, sd] = start.split('-').map(Number);
          const [ey, em, ed] = end.split('-').map(Number);
          const baseFields = 'impressions,clicks,costInLocalCurrency,oneClickLeads,externalWebsiteConversions,pivotValue';
          return `https://api.linkedin.com/v2/adAnalyticsV2?q=analytics` +
            `&dateRange.start.day=${sd}&dateRange.start.month=${sm}&dateRange.start.year=${sy}` +
            `&dateRange.end.day=${ed}&dateRange.end.month=${em}&dateRange.end.year=${ey}` +
            `&timeGranularity=${gran}&pivot=${pivot}` +
            `&accounts[0]=urn:li:sponsoredAccount:${accountId}` +
            `&fields=${baseFields}${extraFields ? ',' + extraFields : ''}&count=10000`;
        }

        const authHdr = { 'Authorization': `Bearer ${accessToken}` };

        // Build daily URL with dateRange field
        const [dsy, dsm, dsd] = thisWeekRange.start.split('-').map(Number);
        const [dey, dem, ded] = thisWeekRange.end.split('-').map(Number);
        const dailyUrl = `https://api.linkedin.com/v2/adAnalyticsV2?q=analytics` +
          `&dateRange.start.day=${dsd}&dateRange.start.month=${dsm}&dateRange.start.year=${dsy}` +
          `&dateRange.end.day=${ded}&dateRange.end.month=${dem}&dateRange.end.year=${dey}` +
          `&timeGranularity=DAILY&pivot=CREATIVE` +
          `&accounts[0]=urn:li:sponsoredAccount:${accountId}` +
          `&fields=impressions,clicks,costInLocalCurrency,oneClickLeads,externalWebsiteConversions,pivotValue,dateRange&count=10000`;

        // ── Parallel analytics + campaign fetch ──────────────────────────────
        console.log('[get_weekly_report] Fetching analytics in parallel...');
        const [
          r_creativeThis, r_creativeLast,
          r_campaignThis, r_campaignLast,
          r_dailyThis,
          r_jobTitle, r_seniority, r_industry, r_companySize,
          r_campaigns,
          r_campGroupThis, r_campGroupLast,
        ] = await Promise.allSettled([
          fetch(wrBuildUrl(thisWeekRange.start, thisWeekRange.end, 'CREATIVE', 'ALL'), { headers: authHdr }).then(r => r.json()),
          fetch(wrBuildUrl(lastWeekRange.start, lastWeekRange.end, 'CREATIVE', 'ALL'), { headers: authHdr }).then(r => r.json()),
          fetch(wrBuildUrl(thisWeekRange.start, thisWeekRange.end, 'CAMPAIGN', 'ALL'), { headers: authHdr }).then(r => r.json()),
          fetch(wrBuildUrl(lastWeekRange.start, lastWeekRange.end, 'CAMPAIGN', 'ALL'), { headers: authHdr }).then(r => r.json()),
          fetch(dailyUrl, { headers: authHdr }).then(r => r.json()),
          fetch(wrBuildUrl(thisWeekRange.start, thisWeekRange.end, 'MEMBER_JOB_TITLE', 'ALL'), { headers: authHdr }).then(r => r.json()),
          fetch(wrBuildUrl(thisWeekRange.start, thisWeekRange.end, 'MEMBER_SENIORITY', 'ALL'), { headers: authHdr }).then(r => r.json()),
          fetch(wrBuildUrl(thisWeekRange.start, thisWeekRange.end, 'MEMBER_INDUSTRY', 'ALL'), { headers: authHdr }).then(r => r.json()),
          fetch(wrBuildUrl(thisWeekRange.start, thisWeekRange.end, 'MEMBER_COMPANY_SIZE', 'ALL'), { headers: authHdr }).then(r => r.json()),
          fetch(`https://api.linkedin.com/v2/adCampaignsV2?q=search&search.account.values[0]=urn:li:sponsoredAccount:${accountId}&count=500&fields=id,name,status,objectiveType,campaignGroup,type`, { headers: authHdr }).then(r => r.json()),
          fetch(wrBuildUrl(thisWeekRange.start, thisWeekRange.end, 'CAMPAIGN_GROUP', 'ALL'), { headers: authHdr }).then(r => r.json()),
          fetch(wrBuildUrl(lastWeekRange.start, lastWeekRange.end, 'CAMPAIGN_GROUP', 'ALL'), { headers: authHdr }).then(r => r.json()),
        ]);

        function wrEls(r: PromiseSettledResult<any>): any[] {
          return r.status === 'fulfilled' ? (r.value?.elements || []) : [];
        }

        console.log(`[get_weekly_report] Creative this week: ${wrEls(r_creativeThis).length}, last week: ${wrEls(r_creativeLast).length}`);
        console.log(`[get_weekly_report] Campaign this week: ${wrEls(r_campaignThis).length}, last week: ${wrEls(r_campaignLast).length}`);

        // ── Build analytics maps first ───────────────────────────────────────
        const creativeThisMap = new Map<string, { impressions: number; clicks: number; spent: number; leads: number }>();
        const creativeLastMap = new Map<string, { impressions: number; clicks: number; spent: number; leads: number }>();

        for (const el of wrEls(r_creativeThis)) {
          const p = wrParseEl(el);
          creativeThisMap.set(p.urn, { impressions: p.impressions, clicks: p.clicks, spent: p.spent, leads: p.leads });
        }
        for (const el of wrEls(r_creativeLast)) {
          const p = wrParseEl(el);
          creativeLastMap.set(p.urn, { impressions: p.impressions, clicks: p.clicks, spent: p.spent, leads: p.leads });
        }

        // ── Creative metadata (names, images, form URNs) ─────────────────────
        const creativeMetaMap = new Map<string, { name: string; imageUrl: string; type: string; status: string; formUrn: string; campaignId: string }>();

        // Step A: Fetch individual creative details (name + image + reference) for every creative
        // that appears in the analytics — same approach as get_creative_performance_report
        const wrAllCreativeIds = new Set<string>();
        for (const urn of [...creativeThisMap.keys(), ...creativeLastMap.keys()]) {
          const id = urn.split(':').pop();
          if (id) wrAllCreativeIds.add(id);
        }
        const wrCreativeIdArr = [...wrAllCreativeIds];
        const wrRefMap = new Map<string, string>(); // creativeId → reference URN

        const wrDetailBatch = 50;
        for (let i = 0; i < wrCreativeIdArr.length; i += wrDetailBatch) {
          const batch = wrCreativeIdArr.slice(i, i + wrDetailBatch);
          await Promise.all(batch.map(async (creativeId) => {
            try {
              const urn = encodeURIComponent(`urn:li:sponsoredCreative:${creativeId}`);
              const resp = await fetch(
                `https://api.linkedin.com/rest/adAccounts/${accountId}/creatives/${urn}`,
                { headers: { ...authHdr, 'LinkedIn-Version': '202511', 'X-Restli-Protocol-Version': '2.0.0' } }
              );
              if (!resp.ok) { await resp.text(); return; }
              const d = await resp.json();
              const content = d.content || {};
              const ref = content.reference || '';
              if (ref) wrRefMap.set(creativeId, ref);
              let imageUrl = content.media?.downloadUrl || '';
              if (!imageUrl && content.landingPage?.landingPageMedia?.thumbnail) imageUrl = content.landingPage.landingPageMedia.thumbnail;
              if (!imageUrl && content.spotlight?.logo?.downloadUrl) imageUrl = content.spotlight.logo.downloadUrl;
              if (!imageUrl && content.followCompany?.logo?.downloadUrl) imageUrl = content.followCompany.logo.downloadUrl;
              if (!imageUrl && Array.isArray(content.mediaContent) && content.mediaContent[0]) {
                imageUrl = content.mediaContent[0]?.media?.downloadUrl || content.mediaContent[0]?.downloadUrl || '';
              }
              const formUrn = content.leadGenerationForm || '';
              const campId = (d.campaign || '').split(':').pop() || '';

              // Determine creative type from content structure
              let resolvedType = 'SPONSORED_CONTENT';
              if (content.spotlight) resolvedType = 'SPOTLIGHT_AD';
              else if (content.followCompany) resolvedType = 'FOLLOWER_AD';
              else if (content.jobs) resolvedType = 'JOBS_AD';
              else if (content.textAd) resolvedType = 'TEXT_AD';
              else if (Array.isArray(content.mediaContent) && content.mediaContent.length > 1) resolvedType = 'CAROUSEL';
              else if (ref && (ref.includes('video') || ref.includes('ugcVideo'))) resolvedType = 'VIDEO';
              else if (ref && ref.includes('document')) resolvedType = 'DOCUMENT_AD';
              // else stays SPONSORED_CONTENT (single image)

              creativeMetaMap.set(creativeId, {
                name: d.name || '',
                imageUrl,
                type: resolvedType,
                status: d.status || 'UNKNOWN',
                formUrn,
                campaignId: campId,
              });
            } catch (e) { /* ignore */ }
          }));
        }

        // Step B: Resolve UGC post / share text for creatives still missing a name
        const wrNeedRef = wrCreativeIdArr.filter(id => !creativeMetaMap.get(id)?.name && wrRefMap.has(id));
        const wrUniqueRefs = [...new Set(wrNeedRef.map(id => wrRefMap.get(id)!))];
        const wrRefNameCache = new Map<string, string>();
        const wrRefImageCache = new Map<string, string>();

        const wrRefBatch = 30;
        for (let i = 0; i < wrUniqueRefs.length; i += wrRefBatch) {
          await Promise.all(wrUniqueRefs.slice(i, i + wrRefBatch).map(async (reference) => {
            try {
              if (reference.includes('ugcPost')) {
                const pid = reference.split(':').pop();
                const resp = await fetch(`https://api.linkedin.com/v2/ugcPosts/${pid}`, { headers: authHdr });
                if (resp.ok) {
                  const post = await resp.json();
                  const sc = post.specificContent?.['com.linkedin.ugc.ShareContent'];
                  const txt = sc?.shareCommentary?.text || '';
                  if (txt.trim()) wrRefNameCache.set(reference, txt.replace(/\s+/g, ' ').trim().slice(0, 80));
                  const media = sc?.media?.[0];
                  const img = media?.thumbnails?.[0]?.url || media?.originalUrl || '';
                  if (img) wrRefImageCache.set(reference, img);
                } else { await resp.text(); }
              } else if (reference.includes('share')) {
                const sid = reference.split(':').pop();
                const resp = await fetch(`https://api.linkedin.com/v2/shares/${sid}`, { headers: authHdr });
                if (resp.ok) {
                  const share = await resp.json();
                  const txt = share.text?.text || '';
                  if (txt.trim()) wrRefNameCache.set(reference, txt.replace(/\s+/g, ' ').trim().slice(0, 80));
                  const ce = share.content?.contentEntities?.[0];
                  const img = ce?.thumbnails?.[0]?.resolvedUrl || ce?.thumbnails?.[0]?.url || '';
                  if (img) wrRefImageCache.set(reference, img);
                } else { await resp.text(); }
              }
            } catch (e) { /* ignore */ }
          }));
        }

        // Apply resolved names/images from share content
        for (const creativeId of wrCreativeIdArr) {
          const meta = creativeMetaMap.get(creativeId);
          const ref = wrRefMap.get(creativeId);
          if (meta && ref) {
            if (!meta.name) meta.name = wrRefNameCache.get(ref) || '';
            if (!meta.imageUrl) meta.imageUrl = wrRefImageCache.get(ref) || '';
          }
        }

        console.log(`[get_weekly_report] Creative metadata: ${creativeMetaMap.size} resolved, refs fetched: ${wrUniqueRefs.length}`);

        // ── Campaign names + objective + group ────────────────────────────
        const campaignNameMap = new Map<string, { name: string; status: string; objectiveType: string; campaignGroupId: string; type: string }>();
        for (const camp of wrEls(r_campaigns)) {
          const cgUrn = camp.campaignGroup || '';
          const cgId = cgUrn.split(':').pop() || '';
          campaignNameMap.set(camp.id?.toString() || '', {
            name: camp.name || `Campaign ${camp.id}`,
            status: camp.status || 'UNKNOWN',
            objectiveType: camp.objectiveType || 'UNKNOWN',
            campaignGroupId: cgId,
            type: camp.type || 'SPONSORED_UPDATES',
          });
        }

        // ── Lead form names ──────────────────────────────────────────────────
        const formNameMap = new Map<string, string>();
        try {
          const ownerParam = encodeURIComponent(`urn:li:sponsoredAccount:${accountId}`);
          const resp = await fetch(
            `https://api.linkedin.com/rest/leadForms?q=owner&owner=${ownerParam}&count=500`,
            { headers: { ...authHdr, 'LinkedIn-Version': '202501', 'X-Restli-Protocol-Version': '2.0.0' } }
          );
          if (resp.ok) {
            const data = await resp.json();
            for (const form of (data.elements || [])) {
              const id = (form.id || '').toString().split(':').pop() || '';
              const localized = form.name?.localized || form.name || {};
              const name = typeof localized === 'string' ? localized : ((Object.values(localized)[0] as string) || `Form ${id}`);
              if (id) formNameMap.set(id, name);
              if (form.id) formNameMap.set(form.id.toString(), name);
              if (form.leadGenerationFormUrn) formNameMap.set(form.leadGenerationFormUrn, name);
            }
          }
        } catch (err) { console.error('[get_weekly_report] Lead form names error:', err); }

        // ── Analytics parse helpers ──────────────────────────────────────────
        function wrParseEl(el: any) {
          return {
            urn: el.pivotValue || '',
            impressions: el.impressions || 0,
            clicks: el.clicks || 0,
            spent: parseFloat(el.costInLocalCurrency || '0'),
            leads: (el.oneClickLeads || 0) + (el.externalWebsiteConversions || 0),
          };
        }

        function wrPct(current: number, previous: number): number | null {
          if (previous === 0) return null;
          return ((current - previous) / previous) * 100;
        }

        function wrMetrics(m: { impressions: number; clicks: number; spent: number; leads: number }) {
          return {
            ...m,
            ctr: m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0,
            cpl: m.leads > 0 ? m.spent / m.leads : 0,
          };
        }

        // ── By creative (maps already built above) ──────────────────────────

        // Daily trend per creative
        const creativeTrendMap = new Map<string, { date: string; spent: number; clicks: number; leads: number; impressions: number }[]>();
        for (const el of wrEls(r_dailyThis)) {
          const urn = el.pivotValue || '';
          const dr = el.dateRange?.start;
          if (!dr) continue;
          const date = `${dr.year}-${String(dr.month).padStart(2, '0')}-${String(dr.day).padStart(2, '0')}`;
          if (!creativeTrendMap.has(urn)) creativeTrendMap.set(urn, []);
          creativeTrendMap.get(urn)!.push({
            date,
            spent: parseFloat(el.costInLocalCurrency || '0'),
            clicks: el.clicks || 0,
            leads: (el.oneClickLeads || 0) + (el.externalWebsiteConversions || 0),
            impressions: el.impressions || 0,
          });
        }

        // Build per-URN rows then aggregate by creative name
        const allCreativeUrns = new Set([...creativeThisMap.keys(), ...creativeLastMap.keys()]);

        type NameAgg = {
          creativeName: string; imageUrl: string; type: string; status: string; formUrn: string; campaignId: string;
          thisW: { impressions: number; clicks: number; spent: number; leads: number };
          lastW: { impressions: number; clicks: number; spent: number; leads: number };
          trendByDate: Map<string, { spent: number; clicks: number; leads: number; impressions: number }>;
        };
        const byNameAgg = new Map<string, NameAgg>();

        for (const urn of allCreativeUrns) {
          const id = urn.split(':').pop() || urn;
          const meta = creativeMetaMap.get(id) || { name: '', imageUrl: '', type: 'UNKNOWN', status: 'UNKNOWN', formUrn: '', campaignId: '' };
          const creativeName = meta.name || `Creative ${id}`;
          const thisW = creativeThisMap.get(urn) || { impressions: 0, clicks: 0, spent: 0, leads: 0 };
          const lastW = creativeLastMap.get(urn) || { impressions: 0, clicks: 0, spent: 0, leads: 0 };
          const trendPoints = (creativeTrendMap.get(urn) || []).sort((a, b) => a.date.localeCompare(b.date));

          // Refine type using campaign info
          let finalType = meta.type;
          const campInfo = campaignNameMap.get(meta.campaignId);
          if (campInfo) {
            if (campInfo.type === 'SPONSORED_INMAILS') finalType = 'MESSAGE_AD';
            else if (campInfo.type === 'TEXT_AD') finalType = 'TEXT_AD';
            else if (campInfo.type === 'DYNAMIC') {
              if (finalType === 'SPONSORED_CONTENT') finalType = 'SPOTLIGHT_AD';
            }
          }
          // Determine gated vs engagement using formUrn OR campaign objective
          const hasForm = !!(meta.formUrn);
          const isLeadGenCampaign = campInfo?.objectiveType === 'LEAD_GENERATION';
          const isGated = hasForm || isLeadGenCampaign;
          if (isGated && (finalType === 'SPONSORED_CONTENT' || finalType === 'VIDEO' || finalType === 'DOCUMENT_AD' || finalType === 'CAROUSEL')) {
            if (finalType === 'VIDEO') finalType = 'VIDEO_GATED';
            else if (finalType === 'DOCUMENT_AD') finalType = 'DOC_GATED';
            else if (finalType === 'CAROUSEL') finalType = 'CAROUSEL_GATED';
            else finalType = 'IMAGE_GATED';
          } else if (!isGated && finalType === 'SPONSORED_CONTENT') {
            finalType = 'IMAGE_ENG';
          }

          if (!byNameAgg.has(creativeName)) {
            byNameAgg.set(creativeName, {
              creativeName,
              imageUrl: meta.imageUrl || '',
              type: finalType,
              status: meta.status,
              formUrn: meta.formUrn,
              campaignId: meta.campaignId,
              thisW: { ...thisW },
              lastW: { ...lastW },
              trendByDate: new Map(trendPoints.map(t => [t.date, { spent: t.spent, clicks: t.clicks, leads: t.leads, impressions: t.impressions }])),
            });
          } else {
            const agg = byNameAgg.get(creativeName)!;
            if (!agg.imageUrl && meta.imageUrl) agg.imageUrl = meta.imageUrl;
            agg.thisW.spent += thisW.spent;
            agg.thisW.impressions += thisW.impressions;
            agg.thisW.clicks += thisW.clicks;
            agg.thisW.leads += thisW.leads;
            agg.lastW.spent += lastW.spent;
            agg.lastW.impressions += lastW.impressions;
            agg.lastW.clicks += lastW.clicks;
            agg.lastW.leads += lastW.leads;
            for (const pt of trendPoints) {
              const ex = agg.trendByDate.get(pt.date);
              if (ex) { ex.spent += pt.spent; ex.clicks += pt.clicks; ex.leads += pt.leads; ex.impressions += pt.impressions; }
              else agg.trendByDate.set(pt.date, { spent: pt.spent, clicks: pt.clicks, leads: pt.leads, impressions: pt.impressions });
            }
          }
        }

        const byCreative = [...byNameAgg.values()].map(agg => ({
          creativeName: agg.creativeName,
          imageUrl: agg.imageUrl,
          type: agg.type,
          status: agg.status,
          formUrn: agg.formUrn,
          campaignId: agg.campaignId,
          thisWeek: wrMetrics(agg.thisW),
          lastWeek: wrMetrics(agg.lastW),
          pctSpentChange: wrPct(agg.thisW.spent, agg.lastW.spent),
          pctCplChange: wrPct(
            agg.thisW.leads > 0 ? agg.thisW.spent / agg.thisW.leads : 0,
            agg.lastW.leads > 0 ? agg.lastW.spent / agg.lastW.leads : 0
          ),
          trend: [...agg.trendByDate.entries()]
            .map(([date, pt]) => ({ date, ...pt }))
            .sort((a, b) => a.date.localeCompare(b.date)),
        })).sort((a, b) => b.thisWeek.spent - a.thisWeek.spent);

        // ── By campaign ──────────────────────────────────────────────────────
        const campThisMap = new Map<string, { impressions: number; clicks: number; spent: number; leads: number }>();
        const campLastMap = new Map<string, { impressions: number; clicks: number; spent: number; leads: number }>();

        for (const el of wrEls(r_campaignThis)) {
          const p = wrParseEl(el);
          campThisMap.set(p.urn, { impressions: p.impressions, clicks: p.clicks, spent: p.spent, leads: p.leads });
        }
        for (const el of wrEls(r_campaignLast)) {
          const p = wrParseEl(el);
          campLastMap.set(p.urn, { impressions: p.impressions, clicks: p.clicks, spent: p.spent, leads: p.leads });
        }

        const allCampUrns = new Set([...campThisMap.keys(), ...campLastMap.keys()]);
        const byCampaign = [...allCampUrns].map(urn => {
          const id = urn.split(':').pop() || urn;
          const meta = campaignNameMap.get(id) || { name: `Campaign ${id}`, status: 'UNKNOWN', objectiveType: 'UNKNOWN', campaignGroupId: '' };
          const thisW = campThisMap.get(urn) || { impressions: 0, clicks: 0, spent: 0, leads: 0 };
          const lastW = campLastMap.get(urn) || { impressions: 0, clicks: 0, spent: 0, leads: 0 };
          return {
            campaignId: id,
            campaignName: meta.name,
            status: meta.status,
            objectiveType: meta.objectiveType,
            campaignGroupId: meta.campaignGroupId,
            thisWeek: wrMetrics(thisW),
            lastWeek: wrMetrics(lastW),
            pctSpentChange: wrPct(thisW.spent, lastW.spent),
            pctCplChange: wrPct(
              thisW.leads > 0 ? thisW.spent / thisW.leads : 0,
              lastW.leads > 0 ? lastW.spent / lastW.leads : 0
            ),
          };
        }).sort((a, b) => b.thisWeek.spent - a.thisWeek.spent);

        // ── By campaign group ────────────────────────────────────────────────
        const campGroupNameMap = new Map<string, string>();
        try {
          const cgResp = await fetch(
            `https://api.linkedin.com/v2/adCampaignGroupsV2?q=search&search.account.values[0]=urn:li:sponsoredAccount:${accountId}&count=500`,
            { headers: authHdr }
          );
          if (cgResp.ok) {
            const cgData = await cgResp.json();
            for (const g of (cgData.elements || [])) {
              campGroupNameMap.set(g.id?.toString() || '', g.name || `Group ${g.id}`);
            }
          }
        } catch (e) { console.error('[get_weekly_report] Campaign group names error:', e); }

        const cgThisMap = new Map<string, { impressions: number; clicks: number; spent: number; leads: number }>();
        const cgLastMap = new Map<string, { impressions: number; clicks: number; spent: number; leads: number }>();
        for (const el of wrEls(r_campGroupThis)) {
          const p = wrParseEl(el);
          cgThisMap.set(p.urn, { impressions: p.impressions, clicks: p.clicks, spent: p.spent, leads: p.leads });
        }
        for (const el of wrEls(r_campGroupLast)) {
          const p = wrParseEl(el);
          cgLastMap.set(p.urn, { impressions: p.impressions, clicks: p.clicks, spent: p.spent, leads: p.leads });
        }
        const allCgUrns = new Set([...cgThisMap.keys(), ...cgLastMap.keys()]);
        const byCampaignGroup = [...allCgUrns].map(urn => {
          const id = urn.split(':').pop() || urn;
          const groupName = campGroupNameMap.get(id) || `Group ${id}`;
          const thisW = cgThisMap.get(urn) || { impressions: 0, clicks: 0, spent: 0, leads: 0 };
          const lastW = cgLastMap.get(urn) || { impressions: 0, clicks: 0, spent: 0, leads: 0 };
          return {
            campaignGroupId: id,
            campaignGroupName: groupName,
            thisWeek: wrMetrics(thisW),
            lastWeek: wrMetrics(lastW),
            pctSpentChange: wrPct(thisW.spent, lastW.spent),
            pctCplChange: wrPct(
              thisW.leads > 0 ? thisW.spent / thisW.leads : 0,
              lastW.leads > 0 ? lastW.spent / lastW.leads : 0
            ),
          };
        }).sort((a, b) => b.thisWeek.spent - a.thisWeek.spent);

        // ── By lead form (group creative analytics by form URN) ───────────────
        const formThisMap = new Map<string, { impressions: number; clicks: number; spent: number; leads: number }>();
        const formLastMap = new Map<string, { impressions: number; clicks: number; spent: number; leads: number }>();

        for (const [urn, thisW] of creativeThisMap) {
          const id = urn.split(':').pop() || urn;
          const meta = creativeMetaMap.get(id);
          if (!meta?.formUrn) continue;
          const existing = formThisMap.get(meta.formUrn) || { impressions: 0, clicks: 0, spent: 0, leads: 0 };
          existing.impressions += thisW.impressions;
          existing.clicks += thisW.clicks;
          existing.spent += thisW.spent;
          existing.leads += thisW.leads;
          formThisMap.set(meta.formUrn, existing);
        }
        for (const [urn, lastW] of creativeLastMap) {
          const id = urn.split(':').pop() || urn;
          const meta = creativeMetaMap.get(id);
          if (!meta?.formUrn) continue;
          const existing = formLastMap.get(meta.formUrn) || { impressions: 0, clicks: 0, spent: 0, leads: 0 };
          existing.impressions += lastW.impressions;
          existing.clicks += lastW.clicks;
          existing.spent += lastW.spent;
          existing.leads += lastW.leads;
          formLastMap.set(meta.formUrn, existing);
        }

        const allFormUrns = new Set([...formThisMap.keys(), ...formLastMap.keys()]);
        const byLeadForm = [...allFormUrns].map(formUrn => {
          const id = formUrn.split(':').pop() || formUrn;
          const formName = formNameMap.get(formUrn) || formNameMap.get(id) || `Form ${id}`;
          const thisW = formThisMap.get(formUrn) || { impressions: 0, clicks: 0, spent: 0, leads: 0 };
          const lastW = formLastMap.get(formUrn) || { impressions: 0, clicks: 0, spent: 0, leads: 0 };
          return {
            formId: id,
            formName,
            thisWeek: wrMetrics(thisW),
            lastWeek: wrMetrics(lastW),
            pctSpentChange: wrPct(thisW.spent, lastW.spent),
            pctCplChange: wrPct(
              thisW.leads > 0 ? thisW.spent / thisW.leads : 0,
              lastW.leads > 0 ? lastW.spent / lastW.leads : 0
            ),
          };
        }).sort((a, b) => b.thisWeek.spent - a.thisWeek.spent);

        // ── Demographics ─────────────────────────────────────────────────────
        // Resolve job title IDs to names
        const jobTitleElements = wrEls(r_jobTitle);
        const titleIds = jobTitleElements.map(el => {
          const raw = el.pivotValue || '';
          return raw.includes(':') ? raw.split(':').pop() || raw : raw;
        }).filter(Boolean);

        const titleNameMap = new Map<string, string>();
        if (titleIds.length > 0) {
          // Try title_metadata_cache first
          try {
            const { data: cachedTitles } = await supabaseClient
              .from('title_metadata_cache')
              .select('title_id, name')
              .in('title_id', titleIds);
            for (const t of (cachedTitles || [])) {
              titleNameMap.set(t.title_id, t.name);
            }
          } catch (e) { /* ignore cache errors */ }

          // Resolve remaining via LinkedIn API
          const unresolvedIds = titleIds.filter(id => !titleNameMap.has(id));
          if (unresolvedIds.length > 0) {
            const batchSize = 20;
            for (let i = 0; i < Math.min(unresolvedIds.length, 40); i += batchSize) {
              await Promise.all(unresolvedIds.slice(i, i + batchSize).map(async (titleId) => {
                try {
                  const resp = await fetch(
                    `https://api.linkedin.com/v2/standardizedTitles/${titleId}`,
                    { headers: authHdr }
                  );
                  if (resp.ok) {
                    const d = await resp.json();
                    const name = d.name?.localized?.en_US || d.name?.preferredLocale?.language
                      ? (d.name?.localized?.[Object.keys(d.name.localized)[0]] || `Title ${titleId}`)
                      : (d.name || `Title ${titleId}`);
                    titleNameMap.set(titleId, typeof name === 'string' ? name : `Title ${titleId}`);
                  }
                } catch (e) { /* ignore */ }
              }));
            }
          }
        }

        function wrParseDemos(items: any[], pivotType: string) {
          return items.map(el => {
            const rawValue = el.pivotValue || '';
            const idPart = rawValue.includes(':') ? rawValue.split(':').pop() || rawValue : rawValue;
            let resolvedName: string;
            if (pivotType === 'MEMBER_JOB_TITLE') {
              resolvedName = titleNameMap.get(idPart) || `Title ${idPart}`;
            } else {
              resolvedName = formatPivotValue(idPart, pivotType);
            }
            return {
              name: resolvedName,
              impressions: el.impressions || 0,
              clicks: el.clicks || 0,
              spent: parseFloat(el.costInLocalCurrency || '0'),
              leads: (el.oneClickLeads || 0) + (el.externalWebsiteConversions || 0),
            };
          }).sort((a, b) => b.impressions - a.impressions).slice(0, 20);
        }

        const demographics = {
          jobTitle: wrParseDemos(jobTitleElements, 'MEMBER_JOB_TITLE'),
          seniority: wrParseDemos(wrEls(r_seniority), 'MEMBER_SENIORITY'),
          industry: wrParseDemos(wrEls(r_industry), 'MEMBER_INDUSTRY'),
          companySize: wrParseDemos(wrEls(r_companySize), 'MEMBER_COMPANY_SIZE'),
        };

        // ── Account summary ───────────────────────────────────────────────────
        const sumReduce = (arr: typeof byCreative, period: 'thisWeek' | 'lastWeek') =>
          arr.reduce((acc, c) => ({
            spent: acc.spent + c[period].spent,
            impressions: acc.impressions + c[period].impressions,
            clicks: acc.clicks + c[period].clicks,
            leads: acc.leads + c[period].leads,
          }), { spent: 0, impressions: 0, clicks: 0, leads: 0 });

        const summaryThis = sumReduce(byCreative, 'thisWeek');
        const summaryLast = sumReduce(byCreative, 'lastWeek');

        const summary = {
          thisWeek: wrMetrics(summaryThis),
          lastWeek: wrMetrics(summaryLast),
          pctSpentChange: wrPct(summaryThis.spent, summaryLast.spent),
          pctImpressionsChange: wrPct(summaryThis.impressions, summaryLast.impressions),
          pctClicksChange: wrPct(summaryThis.clicks, summaryLast.clicks),
          pctLeadsChange: wrPct(summaryThis.leads, summaryLast.leads),
          pctCtrChange: wrPct(
            summaryThis.impressions > 0 ? (summaryThis.clicks / summaryThis.impressions) * 100 : 0,
            summaryLast.impressions > 0 ? (summaryLast.clicks / summaryLast.impressions) * 100 : 0
          ),
          pctCplChange: wrPct(
            summaryThis.leads > 0 ? summaryThis.spent / summaryThis.leads : 0,
            summaryLast.leads > 0 ? summaryLast.spent / summaryLast.leads : 0
          ),
        };

        console.log(`[get_weekly_report] Done. Creatives: ${byCreative.length}, Campaigns: ${byCampaign.length}, Groups: ${byCampaignGroup.length}, Forms: ${byLeadForm.length}`);

        return new Response(JSON.stringify({
          weekRange: { thisWeek: thisWeekRange, lastWeek: lastWeekRange },
          summary,
          byCreative,
          byCampaign,
          byCampaignGroup,
          byLeadForm,
          demographics,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_lead_gen_overview': {
        const { accountId, campaignIds } = params || {};
        if (!accountId) {
          return new Response(JSON.stringify({ error: 'accountId required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const now = new Date();
        const fmt2 = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const lgEnd = fmt2(now);
        const lgS30 = fmt2(new Date(now.getTime() - 30*864e5));
        const lgS7  = fmt2(new Date(now.getTime() -  7*864e5));

        const lgDp = (s: string, e: string) => {
          const [sy,sm,sd] = s.split('-').map(Number);
          const [ey,em,ed] = e.split('-').map(Number);
          return `dateRange.start.day=${sd}&dateRange.start.month=${sm}&dateRange.start.year=${sy}&dateRange.end.day=${ed}&dateRange.end.month=${em}&dateRange.end.year=${ey}`;
        };

        const lgH = { 'Authorization': `Bearer ${accessToken}` };
        const lgRH = { ...lgH, 'X-Restli-Protocol-Version': '2.0.0', 'LinkedIn-Version': '202511' };

        // Static label maps for audience insights
        const JOB_FUNCTIONS: Record<string, string> = {
          '1':'Accounting','2':'Administrative','3':'Arts & Design','4':'Business Development',
          '5':'Community & Social Services','6':'Consulting','7':'Education','8':'Engineering',
          '9':'Entrepreneurship','10':'Finance','11':'Healthcare Services','12':'Human Resources',
          '13':'Information Technology','14':'Legal','15':'Marketing','16':'Media & Communications',
          '17':'Military & Protective Services','18':'Operations','19':'Product Management',
          '20':'Program & Project Management','21':'Purchasing','22':'Quality Assurance',
          '23':'Real Estate','24':'Research','25':'Sales','26':'Support',
        };
        const SENIORITIES: Record<string, string> = {
          '1':'Unpaid','2':'Training','3':'Entry','4':'Senior','5':'Manager',
          '6':'Director','7':'VP','8':'CXO','9':'Partner','10':'Owner',
        };

        console.log(`[get_lead_gen_overview] Starting for account ${accountId}`);

        const lgGetJson = async (r: PromiseSettledResult<Response>) => {
          if (r.status === 'rejected' || !r.value.ok) return { elements: [] };
          try { return await r.value.json(); } catch { return { elements: [] }; }
        };

        // Step 1: Fetch campaigns + creatives, then filter objective locally.
        // LinkedIn's objectiveType search filter can return empty for some accounts even when LEAD_GENERATION campaigns exist.
        const lgFetchPaged = async (baseUrl: string, label: string, count = 500, maxStart = 5000) => {
          const elements: any[] = [];
          for (let start = 0; start <= maxStart; start += count) {
            const r = await fetch(`${baseUrl}&count=${count}&start=${start}`, { headers: lgH });
            if (!r.ok) {
              console.log(`[get_lead_gen_overview] ${label} fetch failed ${r.status}`);
              break;
            }
            const d = await r.json().catch(() => ({ elements: [] }));
            const page = d.elements || [];
            elements.push(...page);
            if (page.length < count) break;
          }
          console.log(`[get_lead_gen_overview] ${label}: fetched ${elements.length}`);
          return { elements };
        };

        const [dCampAll, dCreMeta] = await Promise.all([
          lgFetchPaged(`https://api.linkedin.com/v2/adCampaignsV2?q=search&search.account.values[0]=urn:li:sponsoredAccount:${accountId}`, 'campaigns', 100),
          lgFetchPaged(`https://api.linkedin.com/v2/adCreativesV2?q=search&search.account.values[0]=urn:li:sponsoredAccount:${accountId}`, 'creatives', 500),
        ]);

        const dCamp = {
          elements: (dCampAll.elements || []).filter((c: any) => String(c.objectiveType || c.type || '').toUpperCase() === 'LEAD_GENERATION'),
        };

        // Build the set of LEAD_GENERATION campaign IDs (intersected with caller's campaignIds if provided)
        let lgCampaignIds: string[] = (dCamp.elements||[])
          .map((c: any) => c.id?.toString())
          .filter(Boolean);
        if (Array.isArray(campaignIds) && campaignIds.length > 0) {
          const allowed = new Set(campaignIds.map(String));
          lgCampaignIds = lgCampaignIds.filter(id => allowed.has(id));
        }
        console.log(`[get_lead_gen_overview] Scoping to ${lgCampaignIds.length} LEAD_GENERATION campaign(s)`);

        // Restrict creatives to ones belonging to lead-gen campaigns
        const lgCampUrnSet = new Set(lgCampaignIds.map(id => `urn:li:sponsoredCampaign:${id}`));
        const lgCreativesFiltered = (dCreMeta.elements||[]).filter((c: any) => {
          const creativeCampaign = typeof c.campaign === 'string' ? c.campaign : '';
          return creativeCampaign ? lgCampUrnSet.has(creativeCampaign) : false;
        });
        const lgAllowedCreUrns = new Set<string>(
          lgCreativesFiltered.map((c: any) => `urn:li:sponsoredCreative:${c.id}`).filter(Boolean)
        );
        console.log(`[get_lead_gen_overview] ${lgCreativesFiltered.length} creatives belong to LEAD_GENERATION campaigns`);

        // Build campaigns[] filter for analytics — chunk to avoid URI-too-long
        const lgCampF = lgCampaignIds.length > 0
          ? lgCampaignIds.map((id, i) => `&campaigns[${i}]=urn:li:sponsoredCampaign:${id}`).join('')
          : '';

        const lgAUrl = (datePart: string, pivot: string) =>
          `https://api.linkedin.com/v2/adAnalyticsV2?q=analytics&${datePart}&timeGranularity=ALL&pivot=${pivot}` +
          `&accounts[0]=urn:li:sponsoredAccount:${accountId}` +
          `&fields=pivotValue,impressions,clicks,costInLocalCurrency,oneClickLeads,oneClickLeadFormOpens,externalWebsiteConversions` +
          `&count=10000${lgCampF}`;

        // If no lead-gen campaigns exist, short-circuit with empty payload
        if (lgCampaignIds.length === 0) {
          return new Response(JSON.stringify({
            campaigns: [], forms: [], topCreativesByCpl: [],
            audienceInsights: { byJobFunction: [], bySeniority: [] },
            summary: { totalLeads:0, totalSpend:0, avgCpl:0, leads7d:0, cpl7d:0, leads30d:0, cpl30d:0, totalForms:0, totalCampaigns:0 },
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Step 2: Fetch analytics scoped to lead-gen campaigns
        // Use POST query tunneling to avoid 414 URI Too Long when many campaigns are filtered
        const lgFetchA = async (datePart: string, pivot: string): Promise<Response> => {
          const url = lgAUrl(datePart, pivot);
          if (url.length < 7000) {
            const r = await fetch(url, { headers: lgH });
            if (r.status !== 414) return r;
          }
          const qIdx = url.indexOf('?');
          const base = url.slice(0, qIdx);
          const qs = url.slice(qIdx + 1);
          return fetch(base, {
            method: 'POST',
            headers: { ...lgH, 'Content-Type': 'application/x-www-form-urlencoded', 'X-HTTP-Method-Override': 'GET' },
            body: qs,
          });
        };
        const [r30, r7, rFunc, rSen] = await Promise.allSettled([
          lgFetchA(lgDp(lgS30, lgEnd), 'CREATIVE'),
          lgFetchA(lgDp(lgS7, lgEnd), 'CREATIVE'),
          lgFetchA(lgDp(lgS30, lgEnd), 'MEMBER_JOB_FUNCTION'),
          lgFetchA(lgDp(lgS30, lgEnd), 'MEMBER_SENIORITY'),
        ]);
        const [d30, d7, dFunc, dSen] = await Promise.all([r30,r7,rFunc,rSen].map(lgGetJson));
        // Safety: also drop any creative rows not in our allowed set (defense-in-depth)
        if (lgAllowedCreUrns.size > 0) {
          d30.elements = (d30.elements||[]).filter((el: any) => !el.pivotValue || lgAllowedCreUrns.has(el.pivotValue));
          d7.elements  = (d7.elements ||[]).filter((el: any) => !el.pivotValue || lgAllowedCreUrns.has(el.pivotValue));
        }
        console.log(`[get_lead_gen_overview] Analytics30d: ${(d30.elements||[]).length}, 7d: ${(d7.elements||[]).length}, funcs: ${(dFunc.elements||[]).length}, sen: ${(dSen.elements||[]).length}`);
        // Replace dCreMeta.elements with the filtered list for downstream metadata loop
        dCreMeta.elements = lgCreativesFiltered;

        type LgAM = { impressions:number; clicks:number; spent:number; leads:number; formOpens:number };
        const lgParseA = (els: any[]): Map<string,LgAM> => {
          const m = new Map<string,LgAM>();
          for (const el of els) {
            if (!el.pivotValue) continue;
            m.set(el.pivotValue, {
              impressions: el.impressions||0,
              clicks: el.clicks||0,
              spent: parseFloat(el.costInLocalCurrency||'0'),
              // LEAD_GENERATION objective: leads = oneClickLeads only.
              // externalWebsiteConversions belong to website-conversion campaigns and would inflate leads / understate CPL.
              leads: el.oneClickLeads||0,
              formOpens: el.oneClickLeadFormOpens||0,
            });
          }
          return m;
        };

        const a30 = lgParseA(d30.elements||[]);
        const a7  = lgParseA(d7.elements||[]);

        // True totals across ALL lead-gen creatives (not just forms with leads).
        // Forms aggregate is intentionally form-scoped; summary must reflect full account spend on lead-gen.
        const lgSumAll = (m: Map<string,LgAM>) => {
          let impressions=0, clicks=0, spent=0, leads=0, formOpens=0;
          for (const v of m.values()) {
            impressions+=v.impressions; clicks+=v.clicks; spent+=v.spent; leads+=v.leads; formOpens+=v.formOpens;
          }
          return { impressions, clicks, spent, leads, formOpens };
        };
        const lgAll30 = lgSumAll(a30);
        const lgAll7  = lgSumAll(a7);

        // Creative metadata map: form URN + CTA + status
        const lgCMeta = new Map<string, { name:string; formUrn?:string; cta?:string; status?:string }>();

        const lgGetFormUrn = (c: any): string|undefined => {
          const v = c.variables?.data||{};
          const sc = v['com.linkedin.ads.SponsoredContentCreativeVariables'];
          const sv = v['com.linkedin.ads.SponsoredVideoCreativeVariables'];
          let u: string|undefined = c.leadGenFormUrn || sc?.leadGenerationContext?.leadGenFormUrn || sv?.leadGenerationContext?.leadGenFormUrn;
          if (!u) {
            const m = JSON.stringify(c).match(/urn:li:(?:adForm|leadGenForm):\(?(\d+)(?:,\d+\))?/);
            if (m) u = `urn:li:leadGenForm:${m[1]}`;
          }
          return u;
        };

        const lgGetCta = (c: any): string|undefined => {
          const v = c.variables?.data||{};
          const sc = v['com.linkedin.ads.SponsoredContentCreativeVariables'];
          return sc?.callToAction?.type || sc?.share?.content?.callToAction?.type || c.callToAction?.type;
        };

        for (const c of (dCreMeta.elements||[])) {
          const id = c.id?.toString();
          if (!id) continue;
          lgCMeta.set(`urn:li:sponsoredCreative:${id}`, {
            name: c.creativeDscName||c.name||`Creative ${id}`,
            formUrn: lgGetFormUrn(c),
            cta: lgGetCta(c),
            status: c.status||'UNKNOWN',
          });
        }

        // Discover form URNs; resolve active creatives via REST for better data
        const lgDiscoveredForms = new Set<string>();
        for (const [urn, meta] of lgCMeta) {
          if (meta.formUrn && (a30.has(urn)||a7.has(urn))) lgDiscoveredForms.add(meta.formUrn);
        }

        const lgActiveCreUrns = Array.from(a30.keys())
          .filter(u => { const m=a30.get(u)!; return m.leads>0||m.formOpens>0; })
          .slice(0, 60);

        for (let i=0; i<lgActiveCreUrns.length; i+=10) {
          await Promise.all(lgActiveCreUrns.slice(i,i+10).map(async (urn) => {
            try {
              const r = await fetch(
                `https://api.linkedin.com/rest/adAccounts/${accountId}/creatives/${encodeURIComponent(urn)}`,
                { headers: lgRH }
              );
              if (!r.ok) return;
              const cd = await r.json();
              const existing = lgCMeta.get(urn)||{name:''};
              const formUrn = lgGetFormUrn(cd);
              if (formUrn) lgDiscoveredForms.add(formUrn);
              lgCMeta.set(urn, {
                ...existing,
                name: cd.name||cd.creativeDscName||existing.name,
                formUrn: existing.formUrn||formUrn,
                cta: existing.cta||lgGetCta(cd),
              });
            } catch(_) {}
          }));
        }
        console.log(`[get_lead_gen_overview] Discovered ${lgDiscoveredForms.size} form URNs from ${lgActiveCreUrns.length} active creatives`);

        // Fetch form metadata (name, headline, description, fields)
        type LgFormMeta = { name:string; headline:string; description:string; fields:string[]; thankYouHeadline?:string };
        const lgFormMeta = new Map<string, LgFormMeta>();

        const lgExtFormId = (urn: string): string => {
          const m1 = urn.match(/(?:adForm|leadGenForm|leadForm):\((\d+),\d+\)/);
          if (m1) return m1[1];
          const m2 = urn.match(/(?:adForm|leadGenForm|leadForm):(\d+)/);
          if (m2) return m2[1];
          return urn.split(':').pop()||'';
        };

        const lgExtText = (field: any): string => {
          if (!field) return '';
          if (typeof field === 'string') return field;
          if (field.localized) {
            const pref = field.preferredLocale;
            const key = pref ? `${pref.language}_${pref.country}` : null;
            if (key && field.localized[key]) return field.localized[key];
            for (const v of Object.values(field.localized)) {
              if (typeof v === 'string') return v as string;
            }
          }
          return '';
        };

        const lgParseFields = (questions: any[]): string[] => {
          if (!Array.isArray(questions)) return [];
          return questions.map((q: any) =>
            q.questionDetails?.questionType || q.fieldType || q.type || q.questionType || ''
          ).filter(Boolean);
        };

        // Bulk fetch form metadata
        try {
          const ownerP = `(sponsoredAccount:urn%3Ali%3AsponsoredAccount%3A${accountId})`;
          const fr = await fetch(`https://api.linkedin.com/rest/leadForms?q=owner&owner=${ownerP}&count=500`, { headers: lgRH });
          if (fr.ok) {
            const fd = await fr.json();
            for (const form of (fd.elements||[])) {
              const rawId = String(form.id??'').trim();
              const vm = rawId.match(/^\((\d+),\d+\)$/);
              const formId = vm ? vm[1] : rawId;
              if (!formId) continue;
              lgFormMeta.set(formId, {
                name: lgExtText(form.name)||`Form ${formId}`,
                headline: lgExtText(form.headline)||'',
                description: lgExtText(form.description)||'',
                fields: lgParseFields(form.questions||form.fields||[]),
                thankYouHeadline: lgExtText(form.thankYouPage?.headline)||undefined,
              });
            }
            console.log(`[get_lead_gen_overview] Bulk form fetch: ${lgFormMeta.size} forms resolved`);
          }
        } catch(_) {}

        // Individual lookups for unresolved forms
        const lgUnresolved = Array.from(lgDiscoveredForms)
          .map(u => lgExtFormId(u)).filter(id => id && !lgFormMeta.has(id));
        for (let i=0; i<Math.min(lgUnresolved.length, 20); i+=5) {
          await Promise.all(lgUnresolved.slice(i,i+5).map(async (formId) => {
            try {
              const r = await fetch(`https://api.linkedin.com/rest/leadForms/${formId}`, { headers: lgRH });
              if (!r.ok) return;
              const form = await r.json();
              lgFormMeta.set(formId, {
                name: lgExtText(form.name)||`Form ${formId}`,
                headline: lgExtText(form.headline)||'',
                description: lgExtText(form.description)||'',
                fields: lgParseFields(form.questions||form.fields||[]),
                thankYouHeadline: lgExtText(form.thankYouPage?.headline)||undefined,
              });
            } catch(_) {}
          }));
        }

        // Build form aggregates
        type LgFormAgg = {
          formUrn:string; formId:string; formName:string;
          headline:string; description:string; fields:string[]; thankYouHeadline?:string;
          m30: LgAM; leads7d:number; spent7d:number;
          creatives: Array<{creativeId:string; name:string; cta:string; cpl:number; leads:number; spent:number; impressions:number; ctr:number; status:string}>;
        };
        const lgFormAgg = new Map<string, LgFormAgg>();

        for (const [creUrn, m30] of a30) {
          if (m30.leads===0 && m30.formOpens===0 && m30.impressions===0) continue;
          const meta = lgCMeta.get(creUrn);
          const formUrn = meta?.formUrn || 'unknown';
          const formId = lgExtFormId(formUrn);
          const fm = lgFormMeta.get(formId);

          if (!lgFormAgg.has(formUrn)) {
            lgFormAgg.set(formUrn, {
              formUrn, formId,
              formName: fm?.name||`Form ${formId}`,
              headline: fm?.headline||'', description: fm?.description||'',
              fields: fm?.fields||[], thankYouHeadline: fm?.thankYouHeadline,
              m30: { impressions:0, clicks:0, spent:0, leads:0, formOpens:0 },
              leads7d:0, spent7d:0,
              creatives:[],
            });
          }

          const agg = lgFormAgg.get(formUrn)!;
          agg.m30.impressions += m30.impressions;
          agg.m30.clicks      += m30.clicks;
          agg.m30.spent       += m30.spent;
          agg.m30.leads       += m30.leads;
          agg.m30.formOpens   += m30.formOpens;

          const m7 = a7.get(creUrn)||{leads:0,spent:0,impressions:0,clicks:0,formOpens:0};
          agg.leads7d += m7.leads;
          agg.spent7d += m7.spent;

          const creId = creUrn.split(':').pop()||'';
          if (m30.leads > 0 || m30.impressions > 0) {
            agg.creatives.push({
              creativeId: creId,
              name: meta?.name||`Creative ${creId}`,
              cta: meta?.cta||'',
              cpl: m30.leads>0 ? m30.spent/m30.leads : 0,
              leads: m30.leads,
              spent: m30.spent,
              impressions: m30.impressions,
              ctr: m30.impressions>0 ? (m30.clicks/m30.impressions)*100 : 0,
              status: meta?.status||'UNKNOWN',
            });
          }
        }

        const lgForms = Array.from(lgFormAgg.values())
          .filter(f => f.m30.leads>0||f.m30.formOpens>0)
          .map(f => {
            const cpl30 = f.m30.leads>0 ? f.m30.spent/f.m30.leads : 0;
            const cpl7  = f.leads7d>0 ? f.spent7d/f.leads7d : 0;
            f.creatives.sort((a,b) => a.leads>0&&b.leads>0 ? a.cpl-b.cpl : b.leads-a.leads);
            return {
              formUrn: f.formUrn,
              formName: f.formName,
              headline: f.headline,
              description: f.description,
              fields: f.fields,
              thankYouHeadline: f.thankYouHeadline,
              metrics: {
                impressions: f.m30.impressions,
                clicks: f.m30.clicks,
                spent: f.m30.spent,
                leads: f.m30.leads,
                formOpens: f.m30.formOpens,
                ctr: f.m30.impressions>0 ? (f.m30.clicks/f.m30.impressions)*100 : 0,
                cpl: cpl30,
                lgfRate: f.m30.formOpens>0 ? (f.m30.leads/f.m30.formOpens)*100 : 0,
                last7d: { leads:f.leads7d, cpl:cpl7, spent:f.spent7d },
                last30d: { leads:f.m30.leads, cpl:cpl30, spent:f.m30.spent },
              },
              creatives: f.creatives,
            };
          })
          .sort((a,b) => b.metrics.leads - a.metrics.leads);

        // Top creatives by CPL across all forms
        const lgTopCreatives = lgForms
          .flatMap(f => f.creatives.map(c => ({...c, formName:f.formName})))
          .filter(c => c.leads>0)
          .sort((a,b) => a.cpl-b.cpl)
          .slice(0, 20);

        // Audience insights
        const lgParseAudience = (els: any[], labelMap: Record<string,string>) => {
          return els
            .map((el: any) => {
              const leads = el.oneClickLeads||0;
              if (leads===0) return null;
              const spent = parseFloat(el.costInLocalCurrency||'0');
              const urnId = (el.pivotValue||'').split(':').pop()||'';
              return {
                name: labelMap[urnId]||urnId,
                leads,
                cpl: spent/leads,
                impressions: el.impressions||0,
                spent,
              };
            })
            .filter(Boolean)
            .sort((a: any, b: any) => a.cpl - b.cpl)
            .slice(0, 10);
        };

        const lgAudienceInsights = {
          byJobFunction: lgParseAudience(dFunc.elements||[], JOB_FUNCTIONS),
          bySeniority: lgParseAudience(dSen.elements||[], SENIORITIES),
        };

        // Campaigns
        const lgCampaigns = (dCamp.elements||[]).map((c: any) => ({
          id: c.id?.toString()||'',
          name: c.name||`Campaign ${c.id}`,
          status: c.status||'UNKNOWN',
          objectiveType: c.objectiveType||'LEAD_GENERATION',
          dailyBudget: c.dailyBudget ? { amount:c.dailyBudget.amount, currency:c.dailyBudget.currencyCode } : null,
          totalBudget: c.totalBudget ? { amount:c.totalBudget.amount, currency:c.totalBudget.currencyCode } : null,
        }));

        // Summary — use raw analytics totals so spend isn't lost when a creative's form can't be resolved.
        const lgTotalLeads = lgAll30.leads;
        const lgTotalSpend = lgAll30.spent;
        const lgLeads7d    = lgAll7.leads;
        const lgSpend7d    = lgAll7.spent;


        console.log(`[get_lead_gen_overview] Done. ${lgForms.length} forms, ${lgTotalLeads} total leads, ${lgCampaigns.length} lead gen campaigns`);

        return new Response(JSON.stringify({
          campaigns: lgCampaigns,
          forms: lgForms,
          topCreativesByCpl: lgTopCreatives,
          audienceInsights: lgAudienceInsights,
          summary: {
            totalLeads: lgTotalLeads,
            totalSpend: lgTotalSpend,
            avgCpl: lgTotalLeads>0 ? lgTotalSpend/lgTotalLeads : 0,
            leads7d: lgLeads7d,
            cpl7d: lgLeads7d>0 ? lgSpend7d/lgLeads7d : 0,
            leads30d: lgTotalLeads,
            cpl30d: lgTotalLeads>0 ? lgTotalSpend/lgTotalLeads : 0,
            totalForms: lgForms.length,
            totalCampaigns: lgCampaigns.length,
          },
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
