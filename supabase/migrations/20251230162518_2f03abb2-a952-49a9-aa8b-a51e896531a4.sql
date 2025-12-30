-- Create table for caching title-to-function mappings
CREATE TABLE public.title_function_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_title text NOT NULL UNIQUE,
  original_title text NOT NULL,
  job_function_id text NOT NULL,
  job_function_label text NOT NULL,
  confidence numeric(4,2) NOT NULL DEFAULT 0.5,
  method text NOT NULL DEFAULT 'rules',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  overridden_by uuid REFERENCES auth.users(id),
  override_reason text
);

-- Indexes for fast lookups
CREATE INDEX idx_title_function_map_normalized ON public.title_function_map(normalized_title);
CREATE INDEX idx_title_function_map_function ON public.title_function_map(job_function_id);

-- Enable RLS
ALTER TABLE public.title_function_map ENABLE ROW LEVEL SECURITY;

-- Anyone can read mappings (needed for frontend filtering)
CREATE POLICY "Anyone can read mappings" ON public.title_function_map
  FOR SELECT USING (true);

-- Authenticated users can insert new mappings (from edge function with service role, or user overrides)
CREATE POLICY "Authenticated users can insert mappings" ON public.title_function_map
  FOR INSERT WITH CHECK (true);

-- Authenticated users can update mappings (for overrides)
CREATE POLICY "Authenticated users can update mappings" ON public.title_function_map
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_title_function_map_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_title_function_map_timestamp
  BEFORE UPDATE ON public.title_function_map
  FOR EACH ROW
  EXECUTE FUNCTION public.update_title_function_map_updated_at();