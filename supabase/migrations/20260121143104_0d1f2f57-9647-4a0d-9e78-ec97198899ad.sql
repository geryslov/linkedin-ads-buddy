-- Create table for saved targeting audiences
CREATE TABLE public.saved_targeting_audiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id text NOT NULL,
  name text NOT NULL,
  description text,
  entities jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.saved_targeting_audiences ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own audiences
CREATE POLICY "Users can manage their own audiences" 
ON public.saved_targeting_audiences FOR ALL 
USING (auth.uid() = user_id);

-- Unique constraint: no duplicate names per user per account
CREATE UNIQUE INDEX idx_unique_audience_name 
ON public.saved_targeting_audiences (user_id, account_id, name);

-- Update timestamp trigger
CREATE TRIGGER update_saved_targeting_audiences_updated_at
BEFORE UPDATE ON public.saved_targeting_audiences
FOR EACH ROW
EXECUTE FUNCTION public.update_account_budgets_updated_at();