-- Create naming_conventions table for storing per-account campaign naming patterns
CREATE TABLE naming_conventions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  account_id text NOT NULL,
  entity_type text NOT NULL DEFAULT 'campaign',
  separator text NOT NULL DEFAULT '_',
  segments jsonb NOT NULL,  -- e.g. ["brand","targeting","geo"]
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, account_id, entity_type)
);

-- Enable Row Level Security
ALTER TABLE naming_conventions ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own naming conventions
CREATE POLICY "Users manage own naming conventions" ON naming_conventions
  FOR ALL USING (auth.uid() = user_id);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_naming_conventions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER naming_conventions_updated_at
  BEFORE UPDATE ON naming_conventions
  FOR EACH ROW
  EXECUTE FUNCTION update_naming_conventions_updated_at();
