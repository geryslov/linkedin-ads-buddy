-- Create linkedin_company_cache table for persistent company name storage
CREATE TABLE linkedin_company_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  vanity_name TEXT,
  source TEXT NOT NULL DEFAULT 'linkedin_org_api',
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookups by org_id
CREATE INDEX idx_linkedin_company_cache_org_id ON linkedin_company_cache(org_id);

-- Enable Row Level Security
ALTER TABLE linkedin_company_cache ENABLE ROW LEVEL SECURITY;

-- Anyone can read cached company names
CREATE POLICY "Anyone can read company cache"
  ON linkedin_company_cache FOR SELECT
  USING (true);

-- Authenticated users can insert new company names
CREATE POLICY "Authenticated users can insert company cache"
  ON linkedin_company_cache FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Authenticated users can update company names
CREATE POLICY "Authenticated users can update company cache"
  ON linkedin_company_cache FOR UPDATE
  USING (auth.uid() IS NOT NULL);