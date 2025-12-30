-- Create cache table for resolved title metadata
CREATE TABLE public.title_metadata_cache (
  title_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  function_urn TEXT,
  super_title_urn TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.title_metadata_cache ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read cached metadata
CREATE POLICY "Anyone can read title metadata cache"
ON public.title_metadata_cache
FOR SELECT
USING (true);

-- Allow authenticated users to insert/update cache
CREATE POLICY "Authenticated users can insert title metadata"
ON public.title_metadata_cache
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Authenticated users can update title metadata"
ON public.title_metadata_cache
FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- Add trigger for updated_at
CREATE TRIGGER update_title_metadata_cache_updated_at
BEFORE UPDATE ON public.title_metadata_cache
FOR EACH ROW
EXECUTE FUNCTION public.update_title_function_map_updated_at();

-- Create index for TTL cleanup queries
CREATE INDEX idx_title_metadata_cache_updated_at ON public.title_metadata_cache(updated_at);