import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface LinkedInProfile {
  id: string;
  localizedFirstName: string;
  localizedLastName: string;
}

export function useLinkedInAuth() {
  const [accessToken, setAccessToken] = useState<string | null>(() => 
    localStorage.getItem('linkedin_access_token')
  );
  const [profile, setProfile] = useState<LinkedInProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const initiateAuth = useCallback(async () => {
    setIsLoading(true);
    try {
      const redirectUri = `${window.location.origin}/callback`;
      console.log('[OAuth Client] Initiating auth');
      console.log('[OAuth Client] Current origin:', window.location.origin);
      console.log('[OAuth Client] Redirect URI being sent:', redirectUri);
      
      const { data, error } = await supabase.functions.invoke('linkedin-api', {
        body: { action: 'get_auth_url', params: { redirectUri } }
      });

      console.log('[OAuth Client] Response from get_auth_url:', { data, error });

      if (error) throw error;
      
      console.log('[OAuth Client] Storing state:', data.state);
      console.log('[OAuth Client] Redirecting to:', data.authUrl?.substring(0, 100) + '...');
      
      localStorage.setItem('linkedin_oauth_state', data.state);
      window.location.href = data.authUrl;
    } catch (error: any) {
      console.error('[OAuth Client] Auth initiation error:', error);
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
      console.log('[OAuth Client] Exchanging token');
      console.log('[OAuth Client] Current origin:', window.location.origin);
      console.log('[OAuth Client] Redirect URI for exchange:', redirectUri);
      console.log('[OAuth Client] Code (first 10 chars):', code?.substring(0, 10) + '...');
      
      const { data, error } = await supabase.functions.invoke('linkedin-api', {
        body: { 
          action: 'exchange_token', 
          params: { code, redirectUri } 
        }
      });

      console.log('[OAuth Client] Token exchange response:', { 
        hasData: !!data, 
        hasError: !!error,
        dataError: data?.error,
        dataErrorDesc: data?.error_description
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error_description || data.error);

      const token = data.access_token;
      console.log('[OAuth Client] Token received:', !!token);
      
      setAccessToken(token);
      localStorage.setItem('linkedin_access_token', token);
      
      toast({
        title: 'Connected!',
        description: 'Successfully connected to LinkedIn Ads',
      });
      
      return token;
    } catch (error: any) {
      console.error('[OAuth Client] Token exchange error:', error);
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
    localStorage.removeItem('linkedin_access_token');
    localStorage.removeItem('linkedin_oauth_state');
    toast({
      title: 'Disconnected',
      description: 'Successfully disconnected from LinkedIn',
    });
  }, [toast]);

  useEffect(() => {
    if (accessToken) {
      fetchProfile();
    }
  }, [accessToken, fetchProfile]);

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
