-- MCP API keys: stable key per user that maps to their current LinkedIn token.
-- The app upserts on every token refresh so the MCP always has the latest token.

create table if not exists mcp_api_keys (
  api_key  text primary key,
  linkedin_token text not null,
  updated_at timestamptz not null default now()
);

-- Anyone who knows the api_key can read or upsert their own row.
-- The api_key (UUID) is the secret — possessing it is the auth.
alter table mcp_api_keys enable row level security;

create policy "api_key holder can select" on mcp_api_keys
  for select using (true);

create policy "api_key holder can upsert" on mcp_api_keys
  for all using (true) with check (true);
