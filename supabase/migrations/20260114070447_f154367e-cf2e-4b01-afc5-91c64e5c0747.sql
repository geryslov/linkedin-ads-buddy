-- Fix UPDATE RLS policy to include WITH CHECK for UPSERT operations
DROP POLICY IF EXISTS "Users can update their own budgets" ON public.account_budgets;

CREATE POLICY "Users can update their own budgets"
  ON public.account_budgets
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create a dedicated trigger function for account_budgets updated_at
CREATE OR REPLACE FUNCTION public.update_account_budgets_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Drop existing trigger if any and recreate
DROP TRIGGER IF EXISTS update_account_budgets_updated_at ON public.account_budgets;

CREATE TRIGGER update_account_budgets_updated_at
  BEFORE UPDATE ON public.account_budgets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_account_budgets_updated_at();