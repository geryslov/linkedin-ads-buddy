import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface LinkedInProfile {
  id: string;
  localizedFirstName: string;
  localizedLastName: string;
}

const ACCESS_TOKEN_KEY = 'linkedin_access_token';
const OAUTH_STATE_KEY = 'linkedin_oauth_state';
const TOKEN_SCOPE_VERSION_KEY = 'linkedin_token_scope_version';
const REQUIRED_SCOPE_VERSION = '2026-03-10-leadgen-scope-v2';
const MCP_API_KEY_STORAGE = 'linkedin_mcp_api_key';

// Upsert the latest LinkedIn token so the MCP server always has a fresh copy.
async function syncMcpToken(linkedinToken: string): Promise<void> {
  try {
    let apiKey = localStorage.getItem(MCP_API_KEY_STORAGE);
    if (!apiKey) {
      apiKey = crypto.randomUUID();
      localStorage.setItem(MCP_API_KEY_STORAGE, apiKey);
    }
    const { error } = await supabase.from('mcp_api_keys').upsert(
      { api_key: apiKey, linkedin_token: linkedinToken, updated_at: new Date().toISOString() },
      { onConflict: 'api_key' }
    );
    if (error) console.error('[MCP sync] failed:', error);
  } catch (e) {
    console.error('[MCP sync] exception:', e);
  }
}

export function useLinkedInAuth() {
  const [accessToken, setAccessToken] = useState<string | null>(() => {
    const storedToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    const storedScopeVersion = localStorage.getItem(TOKEN_SCOPE_VERSION_KEY);

    if (storedScopeVersion !== REQUIRED_SCOPE_VERSION) {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      return null;
    }

    return storedToken;
  });
  const [profile, setProfile] = useState<LinkedInProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const initiateAuth = useCallback(async () => {
    setIsLoading(true);
    try {
      const redirectUri = `${window.location.origin}/callback`;
      const { data, error } = await supabase.functions.invoke('linkedin-api', {
        body: { action: 'get_auth_url', params: { redirectUri } }
      });

      if (error) throw error;
      
      localStorage.setItem(OAUTH_STATE_KEY, data.state);

      // Detect if running inside an iframe (e.g. Lovable preview) — use popup flow
      const isInIframe = window.self !== window.top;
      if (isInIframe) {
        const popup = window.open(data.authUrl, 'linkedin-oauth', 'width=600,height=700');
        if (!popup) {
          toast({
            title: 'Popup Blocked',
            description: 'Please allow popups for this site to sign in, then try again.',
            variant: 'destructive',
          });
          return;
        }
        // Listen for completion message from popup callback page
        const messageHandler = (event: MessageEvent) => {
          if (event.origin === window.location.origin && event.data?.type === 'linkedin-oauth-complete') {
            popup?.close();
            window.removeEventListener('message', messageHandler);
            const token = event.data.token;
            if (token) {
              setAccessToken(token);
              localStorage.setItem(ACCESS_TOKEN_KEY, token);
              localStorage.setItem(TOKEN_SCOPE_VERSION_KEY, REQUIRED_SCOPE_VERSION);
              syncMcpToken(token);
              toast({
                title: 'Connected!',
                description: 'Successfully connected to LinkedIn Ads',
              });
            } else {
              window.location.reload();
            }
          }
        };
        window.addEventListener('message', messageHandler);
      } else {
        window.location.href = data.authUrl;
      }
    } catch (error: any) {
      console.error('Auth initiation error:', error);
      toast({
        title: 'Authentication Error',
        description: error.message || 'Failed to start authentication',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const exchangeToken = useCallback(async (code: string) => {
    setIsLoading(true);
    try {
      const redirectUri = `${window.location.origin}/callback`;
      const { data, error } = await supabase.functions.invoke('linkedin-api', {
        body: { 
          action: 'exchange_token', 
          params: { code, redirectUri } 
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error_description || data.error);

      const token = data.access_token;
      setAccessToken(token);
      localStorage.setItem(ACCESS_TOKEN_KEY, token);
      localStorage.setItem(TOKEN_SCOPE_VERSION_KEY, REQUIRED_SCOPE_VERSION);
      syncMcpToken(token);
      
      toast({
        title: 'Connected!',
        description: 'Successfully connected to LinkedIn Ads',
      });
      
      return token;
    } catch (error: any) {
      console.error('Token exchange error:', error);
      toast({
        title: 'Authentication Failed',
        description: error.message || 'Failed to complete authentication',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const fetchProfile = useCallback(async () => {
    if (!accessToken) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('linkedin-api', {
        body: { action: 'get_profile', accessToken }
      });

      if (error) throw error;
      setProfile(data);

      // Update profile with LinkedIn ID in database
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user && data?.id) {
        await supabase
          .from('profiles')
          .update({ 
            linkedin_profile_id: data.id,
            first_name: data.localizedFirstName,
            last_name: data.localizedLastName,
            last_login_at: new Date().toISOString()
          })
          .eq('user_id', session.user.id);
      }
    } catch (error) {
      console.error('Profile fetch error:', error);
    }
  }, [accessToken]);

  const logout = useCallback(() => {
    setAccessToken(null);
    setProfile(null);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(OAUTH_STATE_KEY);
    localStorage.removeItem(TOKEN_SCOPE_VERSION_KEY);
    toast({
      title: 'Disconnected',
      description: 'Successfully disconnected from LinkedIn',
    });
  }, [toast]);

  useEffect(() => {
    if (accessToken) {
      fetchProfile();
      // Safety net: ensure the MCP row always reflects the current LinkedIn token,
      // even if it was set outside of the OAuth callback (other tab, manual set, etc.)
      syncMcpToken(accessToken);
    }
  }, [accessToken, fetchProfile]);

  // Cross-tab sync: if another tab updates the LinkedIn token, pick it up here
  // and push it to the MCP row so rotations propagate everywhere.
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === ACCESS_TOKEN_KEY && e.newValue && e.newValue !== accessToken) {
        setAccessToken(e.newValue);
        syncMcpToken(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [accessToken]);

  return {
    accessToken,
    profile,
    isLoading,
    isAuthenticated: !!accessToken,
    initiateAuth,
    exchangeToken,
    logout,
  };
}

