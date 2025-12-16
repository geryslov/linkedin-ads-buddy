import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  linkedin_profile_id: string | null;
  created_at: string;
  last_login_at: string | null;
}

interface LinkedAccount {
  id: string;
  user_id: string;
  account_id: string;
  account_name: string | null;
  linked_at: string;
  last_accessed_at: string | null;
}

export function useAdminData() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [profilesRes, accountsRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('user_linked_accounts').select('*').order('linked_at', { ascending: false }),
      ]);

      if (profilesRes.data) {
        setUsers(profilesRes.data as Profile[]);
      }
      if (accountsRes.data) {
        setLinkedAccounts(accountsRes.data as LinkedAccount[]);
      }
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    users,
    linkedAccounts,
    isLoading,
    refetch: fetchData,
  };
}
