
CREATE TABLE public.custom_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('campaign', 'campaign_group')),
  entity_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  field_value TEXT,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (account_id, entity_type, entity_id, field_name)
);

-- Enable RLS
ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;

-- Users can view custom fields for their accounts
CREATE POLICY "Users can view their own custom fields"
ON public.custom_fields
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own custom fields
CREATE POLICY "Users can insert their own custom fields"
ON public.custom_fields
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own custom fields
CREATE POLICY "Users can update their own custom fields"
ON public.custom_fields
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own custom fields
CREATE POLICY "Users can delete their own custom fields"
ON public.custom_fields
FOR DELETE
USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX idx_custom_fields_account_entity ON public.custom_fields (account_id, entity_type);
CREATE INDEX idx_custom_fields_user ON public.custom_fields (user_id);

-- Trigger for updated_at
CREATE TRIGGER update_custom_fields_updated_at
BEFORE UPDATE ON public.custom_fields
FOR EACH ROW
EXECUTE FUNCTION public.update_account_budgets_updated_at();
