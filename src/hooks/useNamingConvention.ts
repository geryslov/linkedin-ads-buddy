import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface NamingConvention {
  id: string;
  user_id: string;
  account_id: string;
  entity_type: string;
  separator: string;
  segments: string[];
  created_at: string;
  updated_at: string;
}

export interface ParsedCampaignName {
  original: string;
  segments: Record<string, string>;
  isFullMatch: boolean;
}

/**
 * Pure utility: split a campaign name by separator and map to segment labels.
 * If the name has fewer parts than segments, missing ones are empty strings.
 */
export function parseName(
  name: string,
  separator: string,
  segments: string[]
): ParsedCampaignName {
  const parts = name.split(separator);
  const result: Record<string, string> = {};
  segments.forEach((seg, i) => {
    result[seg] = parts[i] ?? '';
  });
  return {
    original: name,
    segments: result,
    isFullMatch: parts.length >= segments.length,
  };
}

export function useNamingConvention() {
  const [convention, setConvention] = useState<NamingConvention | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchConvention = useCallback(async (accountId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setError('Not authenticated');
        return;
      }

      const { data, error: dbError } = await (supabase as any)
        .from('naming_conventions')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('account_id', accountId)
        .eq('entity_type', 'campaign')
        .maybeSingle();

      if (dbError) throw dbError;
      setConvention(data ? { ...data, segments: data.segments as string[] } as NamingConvention : null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch naming convention');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveConvention = useCallback(async (
    accountId: string,
    separator: string,
    segments: string[]
  ): Promise<boolean> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return false;

      const { data, error: dbError } = await (supabase as any)
        .from('naming_conventions')
        .upsert(
          {
            user_id: session.user.id,
            account_id: accountId,
            entity_type: 'campaign',
            separator,
            segments,
          },
          { onConflict: 'user_id,account_id,entity_type' }
        )
        .select()
        .single();

      if (dbError) throw dbError;
      setConvention(data ? { ...data, segments: data.segments as string[] } as NamingConvention : null);
      toast({ title: 'Naming convention saved' });
      return true;
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to save naming convention',
        variant: 'destructive',
      });
      return false;
    }
  }, [toast]);

  const deleteConvention = useCallback(async (accountId: string): Promise<boolean> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return false;

      const { error: dbError } = await (supabase as any)
        .from('naming_conventions')
        .delete()
        .eq('user_id', session.user.id)
        .eq('account_id', accountId)
        .eq('entity_type', 'campaign');

      if (dbError) throw dbError;
      setConvention(null);
      toast({ title: 'Naming convention deleted' });
      return true;
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to delete naming convention',
        variant: 'destructive',
      });
      return false;
    }
  }, [toast]);

  return {
    convention,
    isLoading,
    error,
    fetchConvention,
    saveConvention,
    deleteConvention,
  };
}
