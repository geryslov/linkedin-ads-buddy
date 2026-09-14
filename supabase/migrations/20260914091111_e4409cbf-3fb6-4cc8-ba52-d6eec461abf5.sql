CREATE TABLE public.account_google_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id text NOT NULL,
  google_customer_id text NOT NULL,
  google_customer_name text,
  login_customer_id text,
  currency_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, account_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_google_links TO authenticated;
GRANT ALL ON public.account_google_links TO service_role;

ALTER TABLE public.account_google_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own google links"
ON public.account_google_links
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_account_google_links_updated_at
BEFORE UPDATE ON public.account_google_links
FOR EACH ROW EXECUTE FUNCTION public.update_account_budgets_updated_at();