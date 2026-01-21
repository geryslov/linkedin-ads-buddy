-- Create linkedin_ad_accounts table to cache all discovered accounts
CREATE TABLE public.linkedin_ad_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id text NOT NULL,
  account_urn text NOT NULL,
  name text,
  status text,
  type text,
  currency text,
  user_role text,
  can_write boolean DEFAULT false,
  last_synced_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT unique_user_linkedin_account UNIQUE (user_id, account_id)
);

-- Enable Row Level Security
ALTER TABLE public.linkedin_ad_accounts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage their own accounts
CREATE POLICY "Users can manage their own linkedin accounts"
ON public.linkedin_ad_accounts FOR ALL
USING (auth.uid() = user_id);

-- Policy: Admins can view all accounts
CREATE POLICY "Admins can view all linkedin accounts"
ON public.linkedin_ad_accounts FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Index for faster lookups
CREATE INDEX idx_linkedin_accounts_user ON public.linkedin_ad_accounts(user_id);
CREATE INDEX idx_linkedin_accounts_account ON public.linkedin_ad_accounts(account_id);