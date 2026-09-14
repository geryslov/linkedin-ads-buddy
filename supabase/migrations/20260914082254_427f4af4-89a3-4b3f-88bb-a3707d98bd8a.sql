ALTER TABLE public.account_budgets
  ADD COLUMN IF NOT EXISTS google_budget_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS google_spend numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS additional_budget_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS additional_spend numeric NOT NULL DEFAULT 0;