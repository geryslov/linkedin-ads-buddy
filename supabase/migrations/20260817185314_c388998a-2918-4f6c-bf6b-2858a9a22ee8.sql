ALTER TABLE public.saved_targeting_audiences
  ADD COLUMN IF NOT EXISTS exclude_entities jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS public.audience_campaign_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  audience_id uuid NOT NULL REFERENCES public.saved_targeting_audiences(id) ON DELETE CASCADE,
  account_id text NOT NULL,
  campaign_id text NOT NULL,
  campaign_name text,
  last_synced_at timestamp with time zone,
  last_sync_status text,
  last_sync_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (audience_id, campaign_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.audience_campaign_assignments TO authenticated;
GRANT ALL ON public.audience_campaign_assignments TO service_role;

ALTER TABLE public.audience_campaign_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own audience assignments"
ON public.audience_campaign_assignments
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_audience_campaign_assignments_updated_at
BEFORE UPDATE ON public.audience_campaign_assignments
FOR EACH ROW EXECUTE FUNCTION public.update_account_budgets_updated_at();