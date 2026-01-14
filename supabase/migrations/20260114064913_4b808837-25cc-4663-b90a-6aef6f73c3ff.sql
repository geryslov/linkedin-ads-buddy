-- Create account_budgets table for monthly budget tracking per account
CREATE TABLE public.account_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  account_id TEXT NOT NULL,
  month DATE NOT NULL, -- First day of the month (e.g., 2025-01-01)
  budget_amount DECIMAL(12,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, account_id, month)
);

-- Enable Row Level Security
ALTER TABLE public.account_budgets ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can manage their own budgets
CREATE POLICY "Users can view their own budgets"
  ON public.account_budgets
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own budgets"
  ON public.account_budgets
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own budgets"
  ON public.account_budgets
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own budgets"
  ON public.account_budgets
  FOR DELETE
  USING (auth.uid() = user_id);

-- Admins can view all budgets
CREATE POLICY "Admins can view all budgets"
  ON public.account_budgets
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_account_budgets_updated_at
  BEFORE UPDATE ON public.account_budgets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_title_function_map_updated_at();