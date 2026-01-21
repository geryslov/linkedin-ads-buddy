import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface SavedAudience {
  id: string;
  name: string;
  description: string | null;
  entities: TargetingEntity[];
  created_at: string;
}

export interface TargetingEntity {
  id: string;
  urn: string;
  name: string;
  type: 'title' | 'skill';
  targetable: boolean;
}

export function useSavedAudiences(accountId: string | null) {
  const { toast } = useToast();
  const [audiences, setAudiences] = useState<SavedAudience[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchAudiences = useCallback(async () => {
    if (!accountId) return;
    
    setIsLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.user) return;

      const { data, error } = await supabase
        .from('saved_targeting_audiences')
        .select('*')
        .eq('account_id', accountId)
        .eq('user_id', session.session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setAudiences((data || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        entities: row.entities as TargetingEntity[],
        created_at: row.created_at,
      })));
    } catch (err) {
      console.error('Error fetching saved audiences:', err);
    } finally {
      setIsLoading(false);
    }
  }, [accountId]);

  const saveAudience = useCallback(async (
    name: string,
    description: string,
    entities: TargetingEntity[]
  ): Promise<boolean> => {
    if (!accountId) return false;

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.user) {
        toast({ title: 'Not authenticated', variant: 'destructive' });
        return false;
      }

      const { error } = await supabase
        .from('saved_targeting_audiences')
        .insert({
          user_id: session.session.user.id,
          account_id: accountId,
          name,
          description: description || null,
          entities: entities as any,
        });

      if (error) {
        if (error.code === '23505') {
          toast({ 
            title: 'Name already exists', 
            description: 'Choose a different name for this audience.',
            variant: 'destructive' 
          });
        } else {
          throw error;
        }
        return false;
      }

      toast({ title: 'Audience saved', description: `"${name}" saved successfully.` });
      await fetchAudiences();
      return true;
    } catch (err) {
      console.error('Error saving audience:', err);
      toast({ title: 'Save failed', variant: 'destructive' });
      return false;
    }
  }, [accountId, fetchAudiences, toast]);

  const deleteAudience = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('saved_targeting_audiences')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({ title: 'Audience deleted' });
      setAudiences(prev => prev.filter(a => a.id !== id));
      return true;
    } catch (err) {
      console.error('Error deleting audience:', err);
      toast({ title: 'Delete failed', variant: 'destructive' });
      return false;
    }
  }, [toast]);

  return {
    audiences,
    isLoading,
    fetchAudiences,
    saveAudience,
    deleteAudience,
  };
}
