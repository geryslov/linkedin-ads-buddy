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
        
        // Combine and filter for ACTIVE status
        const allAccounts = Array.from(accountsMap.values()).filter(
          (acc: any) => acc.status === 'ACTIVE'
        );
        
        console.log(`[get_ad_accounts] Total unique accounts: ${allAccounts.length}`);
        
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
        
        let url = `https://api.linkedin.com/v2/adAnalyticsV2?q=analytics&` +
          `dateRange.start.day=${new Date(startDate).getDate()}&` +
          `dateRange.start.month=${new Date(startDate).getMonth() + 1}&` +
          `dateRange.start.year=${new Date(startDate).getFullYear()}&` +
          `dateRange.end.day=${new Date(endDate).getDate()}&` +
          `dateRange.end.month=${new Date(endDate).getMonth() + 1}&` +
          `dateRange.end.year=${new Date(endDate).getFullYear()}&` +
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
        const { accountId, dateRange, timeGranularity, campaignIds } = params || {};
        const startDate = dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const endDate = dateRange?.end || new Date().toISOString().split('T')[0];
        const granularity = timeGranularity || 'ALL';
        
        // Parse date strings directly to avoid timezone issues
        const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
        const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
        
        console.log(`[get_company_demographic] Starting for account ${accountId}, date range: ${startDate} to ${endDate}, campaigns: ${campaignIds?.length || 'all'}`);
        console.log(`[get_company_demographic] Parsed dates: start=${startYear}-${startMonth}-${startDay}, end=${endYear}-${endMonth}-${endDay}`);

        // Step 1: Fetch demographic analytics with MEMBER_COMPANY pivot
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
          `fields=impressions,clicks,costInLocalCurrency,costInUsd,externalWebsiteConversions,oneClickLeads,pivotValue&` +
          `count=10000`;
        
        // Add campaign filter if provided
        if (campaignIds && campaignIds.length > 0) {
          campaignIds.forEach((id: string, i: number) => {
            analyticsUrl += `&campaigns[${i}]=urn:li:sponsoredCampaign:${id}`;
          });
          console.log(`[get_company_demographic] Filtering by ${campaignIds.length} campaigns`);
        }

        console.log('[get_company_demographic] Step 1: Fetching company demographic analytics...');
        
        // Paginated fetch to get all company demographic records
        let allElements: any[] = [];
        let startOffset = 0;
        const pageSize = 10000;
        let hasMore = true;
        
        while (hasMore) {
          const paginatedUrl = `${analyticsUrl}&start=${startOffset}`;
          console.log(`[get_company_demographic] Fetching page at offset ${startOffset}...`);
          
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
              status: analyticsResponse.status,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          
          const analyticsData = await analyticsResponse.json();
          const pageElements = analyticsData.elements || [];
          allElements = allElements.concat(pageElements);
          
          console.log(`[get_company_demographic] Page returned ${pageElements.length} records, total so far: ${allElements.length}`);
          
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
            console.log(`[get_company_demographic] Reached safety limit at offset ${startOffset}`);
            hasMore = false;
          }
        }
        
        console.log(`[get_company_demographic] Total received: ${allElements.length} company records`);

        // Aggregate by company URN
        const companyMap = new Map<string, { 
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

        // Filter out companies with all-zero metrics
        const filteredElements = reportElements.filter(r => 
          r.impressions > 0 || r.clicks > 0 || parseFloat(r.costInLocalCurrency) > 0 || r.leads > 0
        );
        
        filteredElements.sort((a, b) => b.impressions - a.impressions);
        
        const resolvedCount = filteredElements.filter(r => r.enrichmentStatus === 'resolved').length;
        const unresolvedCount = filteredElements.filter(r => r.enrichmentStatus === 'unresolved').length;
        
        console.log(`[get_company_demographic] Complete. Total: ${filteredElements.length} (filtered from ${reportElements.length}), Resolved: ${resolvedCount}, Unresolved: ${unresolvedCount}`);
        
        return new Response(JSON.stringify({ 
          elements: filteredElements,
          metadata: {
            accountId,
            dateRange: { start: startDate, end: endDate },
            timeGranularity: granularity,
            totalCompanies: filteredElements.length,
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
        }
        
        const creativeInfoMap = new Map<string, CreativeInfo>();
        const referenceNameCache = new Map<string, string>();
        
        // Fetch creatives by ID in batches (more reliable than search for specific creatives)
        const creativeIdsArray = [...creativeIdsWithData];
        console.log(`[Step 3] Fetching ${creativeIdsArray.length} creatives by ID...`);
        
        const batchSize = 50;
        for (let i = 0; i < creativeIdsArray.length; i += batchSize) {
          const batchIds = creativeIdsArray.slice(i, i + batchSize);
          
          // Build the ids parameter for batch GET: ids=List(urn:li:sponsoredCreative:123,urn:li:sponsoredCreative:456)
          const idsParam = batchIds.map(id => `urn:li:sponsoredCreative:${id}`).join(',');
          
          // Try V2 batch GET first (more reliable for specific IDs)
          const batchUrl = `https://api.linkedin.com/v2/adCreativesV2?ids=List(${idsParam})`;
          
          try {
            const batchResponse = await fetch(batchUrl, {
              headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            
            if (batchResponse.ok) {
              const batchData = await batchResponse.json();
              // V2 batch returns { results: { "urn:li:sponsoredCreative:123": {...}, ... } }
              const results = batchData.results || {};
              
              for (const [urn, creative] of Object.entries(results)) {
                const creativeObj = creative as any;
                const creativeId = urn.split(':').pop() || '';
                
                const campaignUrn = creativeObj.campaign || '';
                const campaignId = campaignUrn.split(':').pop() || '';
                
                let creativeType = 'SPONSORED_CONTENT';
                if (creativeObj.type) creativeType = creativeObj.type;
                else if (creativeObj.variables?.type) creativeType = creativeObj.variables.type;
                
                creativeInfoMap.set(creativeId, {
                  id: creativeId,
                  name: '',
                  campaignId,
                  campaignName: campaignNames.get(campaignId) || `Campaign ${campaignId}`,
                  status: creativeObj.status || 'UNKNOWN',
                  type: creativeType,
                  reference: creativeObj.reference || '',
                });
              }
              
              if (i === 0) {
                console.log(`[Step 3] First batch: fetched ${Object.keys(results).length} creatives`);
              }
            } else {
              console.log(`[Step 3] Batch GET failed: ${batchResponse.status}`);
              
              // Try individual fetches as fallback
              for (const creativeId of batchIds) {
                try {
                  const singleUrl = `https://api.linkedin.com/v2/adCreativesV2/${creativeId}`;
                  const singleResponse = await fetch(singleUrl, {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                  });
                  
                  if (singleResponse.ok) {
                    const creativeObj = await singleResponse.json();
                    const campaignUrn = creativeObj.campaign || '';
                    const campaignId = campaignUrn.split(':').pop() || '';
                    
                    creativeInfoMap.set(creativeId, {
                      id: creativeId,
                      name: '',
                      campaignId,
                      campaignName: campaignNames.get(campaignId) || `Campaign ${campaignId}`,
                      status: creativeObj.status || 'UNKNOWN',
                      type: creativeObj.type || 'SPONSORED_CONTENT',
                      reference: creativeObj.reference || '',
                    });
                  }
                } catch (err) {
                  // Skip this creative
                }
              }
            }
          } catch (err) {
            console.error(`[Step 3] Batch fetch error:`, err);
          }
        }
        
        console.log(`[Step 3] Fetched metadata for ${creativeInfoMap.size} of ${creativeIdsArray.length} creatives`);
        
        // Create placeholders for any creatives we couldn't fetch
        for (const creativeId of creativeIdsWithData) {
          if (!creativeInfoMap.has(String(creativeId))) {
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
                if (existing && creativeDetail.name) {
                  existing.name = creativeDetail.name;
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
        
        // Step 5: Resolve post text for creatives without names
        const uniqueReferences = new Set<string>();
        for (const [_, info] of creativeInfoMap) {
          if (!info.name && info.reference) {
            uniqueReferences.add(info.reference);
          }
        }
        
        console.log(`[Step 5] Resolving ${uniqueReferences.size} unique post references...`);
        
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
                const text = post.specificContent?.['com.linkedin.ugc.ShareContent']?.shareCommentary?.text || '';
                if (text.trim()) {
                  referenceNameCache.set(reference, text.replace(/\s+/g, ' ').trim().slice(0, 80));
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
              }
            }
          } catch (err) {
            // Silently ignore reference fetch errors
          }
        }
        
        // Apply cached names
        for (const [creativeId, info] of creativeInfoMap) {
          if (!info.name && info.reference) {
            const cachedName = referenceNameCache.get(info.reference);
            if (cachedName) {
              info.name = cachedName;
              creativeInfoMap.set(creativeId, info);
            }
          }
        }
        
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
          
          reportElements.push({
            creativeId,
            creativeName: info.name || 'Sponsored Image Ad',
            campaignName: info.campaignName,
            status: info.status,
            type: info.type,
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
            const leads = (row.oneClickLeads || 0) + (row.externalWebsiteConversions || 0);
            
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
          existing.leads += (row.oneClickLeads || 0) + (row.externalWebsiteConversions || 0);
          existing.lgfFormOpens += row.oneClickLeadFormOpens || 0;
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
        const creativeMetadata = new Map<string, { name: string; campaignId: string; leadFormUrn?: string }>();
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
            const formMatch = reference.match(/urn:li:leadGenForm:\d+/);
            if (formMatch) leadFormUrn = formMatch[0];
          }
          
          // Deep search fallback: search entire creative JSON for form URN pattern
          if (!leadFormUrn) {
            const creativeJson = JSON.stringify(creative);
            // Match both adForm and leadGenForm patterns
            const formMatch = creativeJson.match(/urn:li:(?:adForm|leadGenForm):(\d+)/);
            if (formMatch) {
              const formId = formMatch[1];
              // Normalize to leadGenForm URN format
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
                
                creativeMetadata.set(creativeUrn, { name: creativeName, campaignId, leadFormUrn });
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
        
        // Step 3: Resolve form names from Lead Sync API (leadGenForms)
        console.log('[Step 3] Resolving lead form names via Lead Sync API...');
        const lgfFormNames = new Map<string, string>();
        
        // Use the correct Lead Sync API endpoint: /rest/leadGenForms
        try {
          const leadGenFormsUrl = `https://api.linkedin.com/rest/leadGenForms?q=account&accounts=List(urn:li:sponsoredAccount:${accountId})&count=500`;
          console.log(`[Step 3] Calling: ${leadGenFormsUrl}`);
          
          const leadFormsResponse = await fetch(leadGenFormsUrl, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'X-Restli-Protocol-Version': '2.0.0',
              'LinkedIn-Version': '202511',
            },
          });
          
          const responseText = await leadFormsResponse.text();
          
          if (leadFormsResponse.ok) {
            let leadFormsData: any = null;
            try { leadFormsData = JSON.parse(responseText); } catch {}
            
            const forms = leadFormsData?.elements || [];
            console.log(`[Step 3] Lead Sync API returned ${forms.length} forms`);
            
            // Log first form structure for debugging
            if (forms.length > 0) {
              console.log(`[Step 3] Sample form keys:`, Object.keys(forms[0]).join(', '));
              console.log(`[Step 3] Sample form:`, JSON.stringify(forms[0], null, 2).substring(0, 1500));
            }
            
            for (const form of forms) {
              // Extract form ID from id field or entityUrn
              const formId = String(form.id ?? form.entityUrn?.split(':').pop() ?? '').trim();
              if (!formId) continue;
              
              const formUrn = `urn:li:leadGenForm:${formId}`;
              
              // Extract name with localization support
              let formName: string | null = null;
              
              // Try localized name first (LinkedIn's standard format)
              if (form.name?.localized) {
                formName = form.name.localized.en_US || 
                           form.name.localized[Object.keys(form.name.localized)[0]] || 
                           null;
              }
              // Direct name field
              if (!formName && typeof form.name === 'string') {
                formName = form.name;
              }
              // localizedName field
              if (!formName && form.localizedName) {
                formName = form.localizedName;
              }
              // headline field as fallback
              if (!formName && form.headline) {
                formName = form.headline;
              }
              
              lgfFormNames.set(formUrn, formName || `Form ${formId}`);
            }
          } else {
            console.log(`[Step 3] Lead Sync API returned ${leadFormsResponse.status}: ${responseText.substring(0, 300)}`);
            
            // Fallback: try v2/adForms endpoint
            console.log(`[Step 3] Trying fallback v2/adForms API...`);
            const fallbackUrl = `https://api.linkedin.com/v2/adForms?q=account&account=urn:li:sponsoredAccount:${accountId}&count=500`;
            const fallbackResponse = await fetch(fallbackUrl, {
              headers: { 'Authorization': `Bearer ${accessToken}` },
            });
            
            if (fallbackResponse.ok) {
              const fallbackData = await fallbackResponse.json();
              const forms = fallbackData.elements || [];
              console.log(`[Step 3] v2/adForms fallback returned ${forms.length} forms`);
              
              for (const form of forms) {
                const formId = form.id?.toString() || form.$URN?.split(':').pop();
                const formUrn = `urn:li:leadGenForm:${formId}`;
                const formName = form.name || form.headline || `Form ${formId}`;
                lgfFormNames.set(formUrn, formName);
              }
            } else {
              console.log(`[Step 3] v2/adForms fallback also failed: ${fallbackResponse.status}`);
            }
          }
        } catch (err) {
          console.log(`[Step 3] Lead Forms API error:`, err);
        }
        
        console.log(`[Step 3] Resolved ${lgfFormNames.size} form names:`, 
          Array.from(lgfFormNames.entries()).slice(0, 5).map(([urn, name]) => `${urn.split(':').pop()}=${name}`).join(', '));
        
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
          
          const formUrn = meta.leadFormUrn;
          
          if (formUrn) {
            // Add creative to its form aggregate
            let formData = formAggregates.get(formUrn);
            if (!formData) {
              formData = {
                formUrn,
                formName: lgfFormNames.get(formUrn) || `Form ${formUrn.split(':').pop()}`,
                impressions: 0,
                clicks: 0,
                spent: 0,
                leads: 0,
                formOpens: 0,
                creatives: [],
              };
              formAggregates.set(formUrn, formData);
            }
            formData.creatives.push(creativeData);
            
            // Aggregate metrics from creatives
            formData.impressions += metrics.impressions;
            formData.clicks += metrics.clicks;
            formData.spent += metrics.spent;
            formData.leads += metrics.leads;
            formData.formOpens += metrics.formOpens;
          } else if (metrics.leads > 0 || metrics.formOpens > 0) {
            // Creative has lead activity but no form association
            lgfCreativesWithoutForm.push(creativeData);
          }
        }
        
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
        
        // Parse the adTargetingEntities response - initial pass
        const parsedTitles = (searchData.elements || []).map((el: any) => {
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
          const superTitleMatch = urn.match(/urn:li:superTitle:(\d+)/);
          
          if (titleMatch) {
            id = titleMatch[1];
          } else if (superTitleMatch) {
            id = superTitleMatch[1];
          }
          
          // Check if this is a super title based on URN format
          const isSuperTitle = urn.includes(':superTitle:');
          
          return {
            id,
            urn,
            name: typeof name === 'string' ? name : JSON.stringify(name),
            targetable: true, // All returned results are targetable
            facetUrn: el.facetUrn || 'urn:li:adTargetingFacet:titles',
            isSuperTitle,
            parentSuperTitle: null as { urn: string; name: string } | null,
          };
        });
        
        // Define type for parsed titles
        type ParsedTitle = {
          id: string;
          urn: string;
          name: string;
          targetable: boolean;
          facetUrn: string;
          isSuperTitle: boolean;
          parentSuperTitle: { urn: string; name: string } | null;
        };
        
        // For standard titles, try to fetch super title metadata
        const standardTitleIds = (parsedTitles as ParsedTitle[])
          .filter((t: ParsedTitle) => !t.isSuperTitle && t.id)
          .map((t: ParsedTitle) => t.id);
        
        let superTitleMetadata: Record<string, { urn: string; name: string }> = {};
        
        if (standardTitleIds.length > 0) {
          try {
            // Batch fetch metadata from standardizedTitles API
            const batchSize = 50;
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
                
                // Debug: log sample keys from API response
                const sampleKeys = Object.keys(results).slice(0, 3);
                console.log(`[search_job_titles] API result keys sample: ${JSON.stringify(sampleKeys)}`);
                
                for (const [titleId, titleData] of Object.entries(results)) {
                  const data = titleData as any;
                  if (data.superTitle) {
                    // superTitle is a URN like "urn:li:superTitle:407"
                    const superTitleUrn = data.superTitle;
                    const superTitleIdMatch = superTitleUrn.match(/:(\d+)$/);
                    
                    if (superTitleIdMatch) {
                      // Normalize key - extract numeric ID from URN if present
                      // API might return "urn:li:title:12345" as key, but we need "12345"
                      const normalizedTitleId = titleId.replace(/^urn:li:title:/, '');
                      
                      // Store the mapping - we'll resolve names in a second pass
                      superTitleMetadata[normalizedTitleId] = {
                        urn: superTitleUrn,
                        name: '', // Will be resolved below
                      };
                      console.log(`[search_job_titles] Stored mapping: "${normalizedTitleId}" -> ${superTitleUrn}`);
                    }
                  }
                }
                
                // Debug: show what we stored vs what title.id values look like
                const storedKeys = Object.keys(superTitleMetadata).slice(0, 3);
                const titleIds = (parsedTitles as ParsedTitle[]).slice(0, 3).map((t: ParsedTitle) => t.id);
                console.log(`[search_job_titles] Stored metadata keys: ${JSON.stringify(storedKeys)}`);
                console.log(`[search_job_titles] Title IDs for lookup: ${JSON.stringify(titleIds)}`);
              } else {
                console.log(`[search_job_titles] Metadata fetch returned ${metadataResponse.status} - skipping super title detection`);
              }
            }
            
            // Comprehensive super title ID to name mapping
            // These are the parent category names for LinkedIn job titles
            const SUPER_TITLE_NAMES: Record<string, string> = {
              // Leadership & Management
              '469': 'Manager',
              '520': 'Director',
              '356': 'Executive',
              '534': 'Lead',
              '189': 'Officer',
              '512': 'President',
              '498': 'Vice President',
              '445': 'Chief',
              '401': 'Head',
              '523': 'Supervisor',
              '476': 'Partner',
              
              // Technical & Engineering
              '225': 'Engineer',
              '645': 'Developer',
              '423': 'Architect',
              '567': 'Scientist',
              '312': 'Technician',
              '634': 'Programmer',
              
              // Business & Operations
              '210': 'Analyst',
              '378': 'Consultant',
              '487': 'Specialist',
              '389': 'Strategist',
              '407': 'Coordinator',
              '265': 'Associate',
              '298': 'Representative',
              '483': 'Administrator',
              '367': 'Planner',
              '412': 'Controller',
              
              // Creative & Design
              '452': 'Designer',
              '601': 'Producer',
              '578': 'Writer',
              '623': 'Editor',
              '556': 'Artist',
              '612': 'Creator',
              
              // Sales & Marketing
              '334': 'Salesperson',
              '345': 'Marketer',
              '456': 'Account Executive',
              
              // Support & Service
              '289': 'Support',
              '301': 'Agent',
              '319': 'Assistant',
              
              // Finance & Accounting
              '234': 'Accountant',
              '256': 'Auditor',
              '278': 'Banker',
              
              // Healthcare & Medical
              '156': 'Physician',
              '167': 'Nurse',
              '178': 'Therapist',
              
              // Education & Research
              '134': 'Teacher',
              '145': 'Professor',
              '198': 'Researcher',
              '209': 'Instructor',
              
              // Legal
              '112': 'Attorney',
              '123': 'Lawyer',
              
              // Human Resources
              '201': 'Recruiter',
              '212': 'HR Specialist',
              
              // Operations & Logistics
              '323': 'Operator',
              '336': 'Logistics Specialist',
              
              // Project & Product
              '467': 'Product Manager',
              '478': 'Program Manager',
              
              // Data & Analytics
              '489': 'Data Scientist',
              '501': 'Data Analyst',
            };

            // Resolve super title names
            const uniqueSuperTitleUrns = [...new Set(Object.values(superTitleMetadata).map(s => s.urn))];
            if (uniqueSuperTitleUrns.length > 0) {
              console.log(`[search_job_titles] Need to resolve ${uniqueSuperTitleUrns.length} super title names`);
              
              for (const titleId of Object.keys(superTitleMetadata)) {
                const urn = superTitleMetadata[titleId].urn;
                const idMatch = urn.match(/:(\d+)$/);
                if (idMatch && SUPER_TITLE_NAMES[idMatch[1]]) {
                  superTitleMetadata[titleId].name = SUPER_TITLE_NAMES[idMatch[1]];
                  console.log(`[search_job_titles] Resolved super title: ${urn} = "${SUPER_TITLE_NAMES[idMatch[1]]}"`);
                } else {
                  // For unknown super titles, leave empty - UI will not display
                  superTitleMetadata[titleId].name = '';
                  console.log(`[search_job_titles] Unknown super title ID: ${urn}`);
                }
              }
            }
          } catch (metadataError) {
            console.log('[search_job_titles] Error fetching super title metadata:', metadataError);
            // Continue without super title info
          }
        }
        
        // Enhance titles with parent super title info
        const titles = (parsedTitles as ParsedTitle[]).map((title: ParsedTitle) => ({
          ...title,
          parentSuperTitle: superTitleMetadata[title.id] || null,
        }));
        
        return new Response(JSON.stringify({ 
          titles,
          source: 'adTargetingEntities',
          count: titles.length
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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
