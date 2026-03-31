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

export function useActivities(selectedAccount: string | null, userId: string | null) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchActivities = useCallback(async () => {
    if (!selectedAccount || !userId) {
      setActivities([]);
      return;
    }

    setIsLoading(true);
    try {
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
  }, [selectedAccount, userId]);

  const createActivity = useCallback(async (name: string, campaignIds: string[]): Promise<boolean> => {
    if (!selectedAccount) {
      toast.error('No account selected');
      return false;
    }

    if (!userId) {
      toast.error('Please sign in to save activities');
      return false;
    }

    try {
      const { error } = await supabase.from('activities').insert({
        user_id: userId,
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
  }, [selectedAccount, userId, fetchActivities]);

  const updateActivity = useCallback(async (id: string, name: string, campaignIds: string[]): Promise<boolean> => {
    if (!userId) {
      toast.error('Please sign in to update activities');
      return false;
    }

    try {
      const { error } = await supabase
        .from('activities')
        .update({ name, campaign_ids: campaignIds as any, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;
      toast.success('Activity updated');
      await fetchActivities();
      return true;
    } catch (err: any) {
      console.error('Failed to update activity:', err);
      toast.error(`Failed to update activity: ${err.message || 'Unknown error'}`);
      return false;
    }
  }, [userId, fetchActivities]);

  const deleteActivity = useCallback(async (id: string) => {
    if (!userId) {
      toast.error('Please sign in to delete activities');
      return false;
    }

    try {
      const { error } = await supabase
        .from('activities')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;
      toast.success('Activity deleted');
      await fetchActivities();
      return true;
    } catch (err: any) {
      console.error('Failed to delete activity:', err);
      toast.error(`Failed to delete activity: ${err.message || 'Unknown error'}`);
      return false;
    }
  }, [userId, fetchActivities]);

  return { activities, isLoading, fetchActivities, createActivity, updateActivity, deleteActivity };
}
