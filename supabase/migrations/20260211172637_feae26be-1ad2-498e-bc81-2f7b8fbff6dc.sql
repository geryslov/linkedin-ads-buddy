-- NOTE: custom_fields table already created in 20260211100000_custom_fields.sql
-- This migration adds user_id column and user-scoped RLS policies.

-- Add user_id column if it doesn't exist
ALTER TABLE public.custom_fields
ADD COLUMN IF NOT EXISTS user_id UUID;

-- Add user-scoped policies (drop generic ones first if they exist)
DROP POLICY IF EXISTS "Anyone can read custom fields" ON public.custom_fields;
DROP POLICY IF EXISTS "Authenticated users can insert custom fields" ON public.custom_fields;
DROP POLICY IF EXISTS "Authenticated users can update custom fields" ON public.custom_fields;
DROP POLICY IF EXISTS "Authenticated users can delete custom fields" ON public.custom_fields;

-- Recreate as user-scoped
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own custom fields' AND tablename = 'custom_fields') THEN
    CREATE POLICY "Users can view their own custom fields"
    ON public.custom_fields FOR SELECT
    USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert their own custom fields' AND tablename = 'custom_fields') THEN
    CREATE POLICY "Users can insert their own custom fields"
    ON public.custom_fields FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own custom fields' AND tablename = 'custom_fields') THEN
    CREATE POLICY "Users can update their own custom fields"
    ON public.custom_fields FOR UPDATE
    USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete their own custom fields' AND tablename = 'custom_fields') THEN
    CREATE POLICY "Users can delete their own custom fields"
    ON public.custom_fields FOR DELETE
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- Indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_custom_fields_account_entity ON public.custom_fields (account_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_custom_fields_user ON public.custom_fields (user_id);
