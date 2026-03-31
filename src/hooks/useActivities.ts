import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Activity {
  id: string;
  name: string;
  account_id: string;
  campaign_ids: string[];
  created_at: string;
  updated_at: string;
}

export function useActivities(selectedAccount: string | null) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const getUserId = useCallback(async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) return session.user.id;
    // Fallback: wait briefly for session restoration
    await new Promise(resolve => setTimeout(resolve, 500));
    const { data: { session: retrySession } } = await supabase.auth.getSession();
    return retrySession?.user?.id ?? null;
  }, []);

  const fetchActivities = useCallback(async () => {
    if (!selectedAccount) return;
    setIsLoading(true);
    try {
      const userId = await getUserId();
      if (!userId) return;

      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('account_id', selectedAccount)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setActivities((data || []).map((d: any) => ({
        ...d,
        campaign_ids: Array.isArray(d.campaign_ids) ? d.campaign_ids : [],
      })));
    } catch (err) {
      console.error('Failed to fetch activities:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedAccount, getUserId]);

  const createActivity = useCallback(async (name: string, campaignIds: string[]): Promise<boolean> => {
    if (!selectedAccount) {
      toast.error('No account selected');
      return false;
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error('You must be logged in to create an activity');
        return false;
      }

      const { error } = await supabase.from('activities').insert({
        user_id: session.user.id,
        account_id: selectedAccount,
        name,
        campaign_ids: campaignIds as any,
      });

      if (error) throw error;
      toast.success('Activity created');
      await fetchActivities();
      return true;
    } catch (err: any) {
      console.error('Failed to create activity:', err);
      toast.error(`Failed to create activity: ${err.message || 'Unknown error'}`);
      return false;
    }
  }, [selectedAccount, fetchActivities]);

  const updateActivity = useCallback(async (id: string, name: string, campaignIds: string[]) => {
    try {
      const { error } = await supabase
        .from('activities')
        .update({ name, campaign_ids: campaignIds as any, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      toast.success('Activity updated');
      await fetchActivities();
    } catch (err) {
      console.error('Failed to update activity:', err);
      toast.error('Failed to update activity');
    }
  }, [fetchActivities]);

  const deleteActivity = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('activities').delete().eq('id', id);
      if (error) throw error;
      toast.success('Activity deleted');
      await fetchActivities();
    } catch (err) {
      console.error('Failed to delete activity:', err);
      toast.error('Failed to delete activity');
    }
  }, [fetchActivities]);

  return { activities, isLoading, fetchActivities, createActivity, updateActivity, deleteActivity };
}
