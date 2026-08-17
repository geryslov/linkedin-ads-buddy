import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { TargetingEntity } from '@/hooks/useSavedAudiences';

export interface AudienceTemplate {
  id: string;
  name: string;
  description: string | null;
  entities: TargetingEntity[];
  exclude_entities: TargetingEntity[];
  created_at: string;
}

export interface AudienceAssignment {
  id: string;
  audience_id: string;
  campaign_id: string;
  campaign_name: string | null;
  last_synced_at: string | null;
  last_sync_status: string | null;
  last_sync_message: string | null;
}

export interface SyncResult {
  campaignId: string;
  success: boolean;
  message: string;
}

/** Legacy short kinds → full LinkedIn facet URNs (older templates have no `facet` field). */
export const FACET_BY_LEGACY_KIND: Record<string, string> = {
  title: 'urn:li:adTargetingFacet:titles',
  skill: 'urn:li:adTargetingFacet:skills',
  company: 'urn:li:adTargetingFacet:employers',
  industry: 'urn:li:adTargetingFacet:industries',
};

export const facetOf = (e: TargetingEntity) =>
  e.facet || FACET_BY_LEGACY_KIND[e.type] || `urn:li:adTargetingFacet:${e.type}`;

/** Group entities into { facetUrn: [urn, ...] } for the edge function. */
const facetMap = (entities: TargetingEntity[]) => {
  const out: Record<string, string[]> = {};
  for (const e of entities) {
    const f = facetOf(e);
    if (!out[f]) out[f] = [];
    if (!out[f].includes(e.urn)) out[f].push(e.urn);
  }
  return out;
};


export function useAudienceTemplates(accountId: string | null) {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<AudienceTemplate[]>([]);
  const [assignments, setAssignments] = useState<AudienceAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!accountId) return;
    setIsLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user?.id;
      if (!userId) return;

      const [{ data: aud, error: audErr }, { data: asg, error: asgErr }] = await Promise.all([
        supabase
          .from('saved_targeting_audiences')
          .select('*')
          .eq('account_id', accountId)
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
        supabase
          .from('audience_campaign_assignments')
          .select('*')
          .eq('account_id', accountId)
          .eq('user_id', userId),
      ]);

      if (audErr) throw audErr;
      if (asgErr) throw asgErr;

      setTemplates(
        (aud || []).map((row: any) => ({
          id: row.id,
          name: row.name,
          description: row.description,
          entities: (row.entities || []) as TargetingEntity[],
          exclude_entities: (row.exclude_entities || []) as TargetingEntity[],
          created_at: row.created_at,
        })),
      );
      setAssignments((asg || []) as unknown as AudienceAssignment[]);
    } catch (err) {
      console.error('Error loading audience templates:', err);
      toast({ title: 'Failed to load audiences', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [accountId, toast]);

  const saveTemplate = useCallback(
    async (
      input: { id?: string; name: string; description?: string; entities: TargetingEntity[]; exclude_entities: TargetingEntity[] },
    ): Promise<boolean> => {
      if (!accountId) return false;
      try {
        const { data: session } = await supabase.auth.getSession();
        const userId = session.session?.user?.id;
        if (!userId) {
          toast({ title: 'Not authenticated', variant: 'destructive' });
          return false;
        }

        const payload = {
          user_id: userId,
          account_id: accountId,
          name: input.name,
          description: input.description || null,
          entities: input.entities as any,
          exclude_entities: input.exclude_entities as any,
        };

        const { error } = input.id
          ? await supabase.from('saved_targeting_audiences').update(payload).eq('id', input.id)
          : await supabase.from('saved_targeting_audiences').insert(payload);

        if (error) throw error;
        toast({ title: input.id ? 'Audience updated' : 'Audience created', description: input.name });
        await fetchAll();
        return true;
      } catch (err: any) {
        console.error('Error saving audience template:', err);
        toast({
          title: 'Save failed',
          description: err?.code === '23505' ? 'An audience with that name already exists.' : err?.message,
          variant: 'destructive',
        });
        return false;
      }
    },
    [accountId, fetchAll, toast],
  );

  const deleteTemplate = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('saved_targeting_audiences').delete().eq('id', id);
      if (error) {
        toast({ title: 'Delete failed', variant: 'destructive' });
        return false;
      }
      toast({ title: 'Audience deleted' });
      await fetchAll();
      return true;
    },
    [fetchAll, toast],
  );

  const setAssignedCampaigns = useCallback(
    async (audienceId: string, campaigns: { id: string; name: string }[]) => {
      if (!accountId) return;
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user?.id;
      if (!userId) return;

      const keep = campaigns.map((c) => c.id);
      await supabase
        .from('audience_campaign_assignments')
        .delete()
        .eq('audience_id', audienceId)
        .eq('user_id', userId)
        .not('campaign_id', 'in', `(${keep.length ? keep.map((k) => `"${k}"`).join(',') : '"__none__"'})`);

      if (campaigns.length) {
        await supabase.from('audience_campaign_assignments').upsert(
          campaigns.map((c) => ({
            user_id: userId,
            audience_id: audienceId,
            account_id: accountId,
            campaign_id: c.id,
            campaign_name: c.name,
          })),
          { onConflict: 'audience_id,campaign_id' },
        );
      }
      await fetchAll();
    },
    [accountId, fetchAll],
  );

  /**
   * Push an audience onto its campaigns: REPLACE the include facets, then apply
   * the template's exclusions on top (LinkedIn keeps include/exclude separate).
   */
  const syncAudience = useCallback(
    async (
      accessToken: string,
      template: AudienceTemplate,
      campaigns: { id: string; name: string }[],
    ): Promise<SyncResult[]> => {
      if (!accountId || !campaigns.length) return [];
      setIsSyncing(true);
      try {
        const campaignIds = campaigns.map((c) => c.id);

        const call = async (mode: 'replace' | 'exclude', entities: TargetingEntity[]) => {
          const body = {
            action: 'update_campaign_targeting',
            accessToken,
            params: {
              campaignIds,
              mode,
              facets: facetMap(entities),

            },
          };
          const { data, error } = await supabase.functions.invoke('linkedin-api', { body });
          if (error) throw error;
          return (data?.results || []) as SyncResult[];
        };

        let results: SyncResult[] = [];
        if (template.entities.length) results = await call('replace', template.entities);
        if (template.exclude_entities.length) {
          const excl = await call('exclude', template.exclude_entities);
          const byId = new Map(results.map((r) => [r.campaignId, r]));
          excl.forEach((r) => {
            const prev = byId.get(r.campaignId);
            byId.set(r.campaignId, {
              campaignId: r.campaignId,
              success: (prev?.success ?? true) && r.success,
              message: [prev?.message, r.message].filter(Boolean).join(' · '),
            });
          });
          results = Array.from(byId.values());
        }

        const { data: session } = await supabase.auth.getSession();
        const userId = session.session?.user?.id;
        if (userId) {
          await supabase.from('audience_campaign_assignments').upsert(
            campaigns.map((c) => {
              const r = results.find((x) => x.campaignId === c.id);
              return {
                user_id: userId,
                audience_id: template.id,
                account_id: accountId,
                campaign_id: c.id,
                campaign_name: c.name,
                last_synced_at: new Date().toISOString(),
                last_sync_status: r ? (r.success ? 'success' : 'failed') : 'unknown',
                last_sync_message: r?.message ?? null,
              };
            }),
            { onConflict: 'audience_id,campaign_id' },
          );
        }

        await fetchAll();
        return results;
      } catch (err: any) {
        console.error('Audience sync failed:', err);
        toast({ title: 'Sync failed', description: err?.message, variant: 'destructive' });
        return [];
      } finally {
        setIsSyncing(false);
      }
    },
    [accountId, fetchAll, toast],
  );

  return {
    templates,
    assignments,
    isLoading,
    isSyncing,
    fetchAll,
    saveTemplate,
    deleteTemplate,
    setAssignedCampaigns,
    syncAudience,
  };
}
