import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TitleTestResult {
  status: 'WORKING' | 'AUTH_ERROR' | 'ACCESS_DENIED' | 'ENDPOINT_ERROR' | 'NO_DATA' | 'REQUEST_ERROR';
  reason?: string;
  hint?: string;
  sampleCount?: number;
  sampleTitles?: Array<{
    id: number;
    name_en: string;
    functionUrn?: string;
    superTitleUrn?: string;
  }>;
  httpStatus?: number;
  rawError?: unknown;
  requestUrl?: string;
}

async function testStandardizedTitlesAccess(accessToken: string): Promise<TitleTestResult> {
  // Build the request URL with minimal query params
  const baseUrl = 'https://api.linkedin.com/v2/titles';
  const params = new URLSearchParams({
    'q': 'criteria',
    'name': 'Manager',
    'count': '5'
  });
  const requestUrl = `${baseUrl}?${params.toString()}`;
  
  console.log('[test-titles-api] Request URL:', requestUrl);
  console.log('[test-titles-api] Making API call...');

  try {
    const response = await fetch(requestUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
        'LinkedIn-Version': '202401',
      },
    });

    const httpStatus = response.status;
    console.log('[test-titles-api] Response status:', httpStatus);

    // Handle specific HTTP status codes
    if (httpStatus === 401) {
      const errorBody = await response.text();
      console.log('[test-titles-api] 401 Error body:', errorBody);
      return {
        status: 'AUTH_ERROR',
        reason: 'Invalid or expired token',
        httpStatus,
        rawError: errorBody,
        requestUrl,
      };
    }

    if (httpStatus === 403) {
      const errorBody = await response.text();
      console.log('[test-titles-api] 403 Error body:', errorBody);
      return {
        status: 'ACCESS_DENIED',
        reason: 'Standardized Titles API not enabled for this app',
        hint: 'This API requires special approval; not part of Ads scopes. Contact LinkedIn support for access.',
        httpStatus,
        rawError: errorBody,
        requestUrl,
      };
    }

    if (httpStatus === 404) {
      const errorBody = await response.text();
      console.log('[test-titles-api] 404 Error body:', errorBody);
      return {
        status: 'ENDPOINT_ERROR',
        reason: 'Titles endpoint not found (wrong API version or path)',
        httpStatus,
        rawError: errorBody,
        requestUrl,
      };
    }

    if (!response.ok) {
      const errorBody = await response.text();
      console.log('[test-titles-api] Non-200 Error body:', errorBody);
      return {
        status: 'REQUEST_ERROR',
        reason: `Unexpected HTTP status: ${httpStatus}`,
        httpStatus,
        rawError: errorBody,
        requestUrl,
      };
    }

    // Parse successful response
    const data = await response.json();
    console.log('[test-titles-api] Response data:', JSON.stringify(data, null, 2));

    const elements = data.elements || [];
    
    if (elements.length === 0) {
      return {
        status: 'NO_DATA',
        reason: 'Endpoint reachable but no titles returned (unexpected for "Manager" query)',
        httpStatus,
        requestUrl,
      };
    }

    // Extract sample titles
    const sampleTitles = elements.map((el: any) => ({
      id: el.id,
      name_en: el.name?.localized?.en_US || el.name?.preferredLocale?.language || 'Unknown',
      functionUrn: el.function || undefined,
      superTitleUrn: el.superTitle || undefined,
    }));

    return {
      status: 'WORKING',
      sampleCount: elements.length,
      sampleTitles,
      httpStatus,
      requestUrl,
    };

  } catch (error: any) {
    console.error('[test-titles-api] Fetch error:', error);
    return {
      status: 'REQUEST_ERROR',
      reason: `Network or fetch error: ${error.message}`,
      rawError: error.toString(),
      requestUrl,
    };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { accessToken } = await req.json();

    if (!accessToken) {
      return new Response(
        JSON.stringify({ 
          status: 'REQUEST_ERROR', 
          reason: 'Missing accessToken in request body' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('[test-titles-api] Starting Standardized Titles API test...');
    
    const result = await testStandardizedTitlesAccess(accessToken);
    
    console.log('[test-titles-api] Test result:', JSON.stringify(result, null, 2));

    return new Response(
      JSON.stringify(result, null, 2),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('[test-titles-api] Handler error:', error);
    return new Response(
      JSON.stringify({ 
        status: 'REQUEST_ERROR', 
        reason: `Handler error: ${error.message}`,
        rawError: error.toString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
