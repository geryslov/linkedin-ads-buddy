import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LINKEDIN_CLIENT_ID = Deno.env.get('LINKEDIN_CLIENT_ID');
const LINKEDIN_CLIENT_SECRET = Deno.env.get('LINKEDIN_CLIENT_SECRET');

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

      case 'get_ad_analytics': {
        const { accountId, dateRange, timeGranularity } = params || {};
        const startDate = dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const endDate = dateRange?.end || new Date().toISOString().split('T')[0];
        const granularity = timeGranularity || 'DAILY';
        
        // Fetch campaigns first
        const campaignsResponse = await fetch(
          `https://api.linkedin.com/v2/adCampaignsV2?q=search&search.account.values[0]=urn:li:sponsoredAccount:${accountId}&count=100`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );
        const campaignsData = await campaignsResponse.json();
        const campaigns = (campaignsData.elements || []).map((c: any) => c.id.toString());
        console.log('Fetched campaigns for ad analytics:', campaigns.length);

        if (campaigns.length === 0) {
          return new Response(JSON.stringify({ elements: [] }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Build URL with CAMPAIGN pivot
        let url = `https://api.linkedin.com/v2/adAnalyticsV2?q=analytics&` +
          `dateRange.start.day=${new Date(startDate).getDate()}&` +
          `dateRange.start.month=${new Date(startDate).getMonth() + 1}&` +
          `dateRange.start.year=${new Date(startDate).getFullYear()}&` +
          `dateRange.end.day=${new Date(endDate).getDate()}&` +
          `dateRange.end.month=${new Date(endDate).getMonth() + 1}&` +
          `dateRange.end.year=${new Date(endDate).getFullYear()}&` +
          `timeGranularity=${granularity}&` +
          `pivot=CAMPAIGN&` +
          `accounts[0]=urn:li:sponsoredAccount:${accountId}&` +
          `fields=impressions,clicks,costInLocalCurrency,conversions,externalWebsiteConversions,oneClickLeads,dateRange,pivotValue`;

        console.log('Fetching ad analytics with CAMPAIGN pivot');
        const analyticsResponse = await fetch(url, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        const analytics = await analyticsResponse.json();
        
        // Merge campaign names
        const campaignMap = new Map((campaignsData.elements || []).map((c: any) => [c.id.toString(), c.name]));
        const enrichedElements = (analytics.elements || []).map((el: any) => {
          const campaignId = (el.pivotValue || '').split(':').pop() || '';
          return {
            ...el,
            campaignName: campaignMap.get(campaignId) || `Campaign ${campaignId}`,
          };
        });
        
        console.log('Ad analytics fetched:', enrichedElements.length);
        return new Response(JSON.stringify({ elements: enrichedElements }), {
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
