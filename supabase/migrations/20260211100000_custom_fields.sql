-- Create custom_fields table for storing user-defined fields on campaigns and campaign groups
CREATE TABLE custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('campaign', 'campaign_group')),
  entity_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  field_value TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),

  -- Unique constraint: one field name per entity
  UNIQUE(account_id, entity_type, entity_id, field_name)
);

-- Indexes for fast lookups
CREATE INDEX idx_custom_fields_account ON custom_fields(account_id);
CREATE INDEX idx_custom_fields_entity ON custom_fields(account_id, entity_type, entity_id);

-- Enable Row Level Security
ALTER TABLE custom_fields ENABLE ROW LEVEL SECURITY;

-- Anyone can read custom fields
CREATE POLICY "Anyone can read custom fields"
  ON custom_fields FOR SELECT
  USING (true);

-- Authenticated users can insert custom fields
CREATE POLICY "Authenticated users can insert custom fields"
  ON custom_fields FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Authenticated users can update custom fields
CREATE POLICY "Authenticated users can update custom fields"
  ON custom_fields FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Authenticated users can delete custom fields
CREATE POLICY "Authenticated users can delete custom fields"
  ON custom_fields FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_custom_fields_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER custom_fields_updated_at
  BEFORE UPDATE ON custom_fields
  FOR EACH ROW
  EXECUTE FUNCTION update_custom_fields_updated_at();
