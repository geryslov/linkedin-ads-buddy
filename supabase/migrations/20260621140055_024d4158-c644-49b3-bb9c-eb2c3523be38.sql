CREATE TABLE IF NOT EXISTS public.mcp_api_keys (
  api_key text PRIMARY KEY,
  linkedin_token text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mcp_api_keys TO authenticated;
GRANT ALL ON public.mcp_api_keys TO service_role;
GRANT SELECT ON public.mcp_api_keys TO anon;

ALTER TABLE public.mcp_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select" ON public.mcp_api_keys FOR SELECT USING (true);
CREATE POLICY "upsert" ON public.mcp_api_keys FOR ALL USING (true) WITH CHECK (true);