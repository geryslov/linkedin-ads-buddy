-- Fix Migration Integrity
-- Resolves: duplicate custom_fields/naming_conventions tables,
-- missing account_budgets table, missing update_account_budgets_updated_at function,
-- and broken trigger references.

-- ============================================================
-- 1. Create the missing account_budgets table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.account_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,
  month DATE NOT NULL,
  budget_amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'USD',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, account_id, month)
);

ALTER TABLE public.account_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own budgets"
ON public.account_budgets FOR ALL
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_account_budgets_user_account
ON public.account_budgets(user_id, account_id);

-- ============================================================
-- 2. Create the missing update_account_budgets_updated_at function
--    (referenced by saved_targeting_audiences and custom_fields triggers)
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_account_budgets_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Add the trigger on account_budgets itself
CREATE TRIGGER update_account_budgets_updated_at
BEFORE UPDATE ON public.account_budgets
FOR EACH ROW
EXECUTE FUNCTION public.update_account_budgets_updated_at();

-- ============================================================
-- 3. Fix custom_fields: drop the broken trigger from the duplicate
--    migration and recreate it properly
-- ============================================================

-- Drop the trigger that references the (previously missing) function
DROP TRIGGER IF EXISTS update_custom_fields_updated_at ON public.custom_fields;

-- Recreate with the correct function
CREATE TRIGGER update_custom_fields_updated_at
BEFORE UPDATE ON public.custom_fields
FOR EACH ROW
EXECUTE FUNCTION public.update_account_budgets_updated_at();

-- Ensure user_id column exists (the duplicate migration added it)
ALTER TABLE public.custom_fields
ADD COLUMN IF NOT EXISTS user_id UUID;

-- ============================================================
-- 4. Add missing logo_url column to linkedin_company_cache
-- ============================================================
ALTER TABLE public.linkedin_company_cache
ADD COLUMN IF NOT EXISTS logo_url TEXT;
