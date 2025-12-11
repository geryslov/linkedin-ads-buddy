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
      const { data, error } = await supabase.functions.invoke('linkedin-api', {
        body: { action: 'get_auth_url', params: { redirectUri } }
      });

      if (error) throw error;
      
      localStorage.setItem('linkedin_oauth_state', data.state);
      window.location.href = data.authUrl;
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
      localStorage.setItem('linkedin_access_token', token);
      
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
