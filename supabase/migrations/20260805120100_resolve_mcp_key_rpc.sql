-- Standalone MCP product — resolver. Step 2 of 2.
--
-- Reads `mcp_keys` ONLY. It never touches `mcp_api_keys`, so the legacy MCP
-- server's PostgREST lookup is unaffected and the two systems cannot interfere.

-- ── Dedicated least-privilege role ───────────────────────────────────────────
-- NOT granted to anon. Granting this function to anon would replace a readable
-- table with a public token-exchange oracle callable by anyone holding the
-- published anon key — not an improvement.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'mcp_server') then
    create role mcp_server nologin noinherit;
  end if;
end
$$;

-- PostgREST's `authenticator` must be able to SET ROLE to it, or a JWT carrying
-- {"role":"mcp_server"} is rejected with "role mcp_server does not exist".
grant mcp_server to authenticator;
grant usage on schema public to mcp_server;

-- ── The resolver ─────────────────────────────────────────────────────────────
-- Returns a *status* alongside the token. "Expired, go reconnect" and "no such
-- key" are different problems and the server has to tell them apart to give the
-- user an actionable message instead of a generic 401.

create or replace function public.resolve_mcp_key(p_key text)
returns table (
  linkedin_token text,
  key_status     text,
  owner_id       uuid,
  expires_at     timestamptz,
  allow_writes   boolean
)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  k            record;
  owner_access text;
begin
  select * into k from public.mcp_keys where api_key = p_key limit 1;

  if not found then
    return query select null::text, 'not_found'::text, null::uuid, null::timestamptz, false;
    return;
  end if;

  if k.status <> 'active' then
    return query select null::text, k.status, k.user_id, k.linkedin_token_expires_at, false;
    return;
  end if;

  select p.access_status into owner_access
    from public.profiles p where p.user_id = k.user_id;

  if owner_access is distinct from 'active' then
    return query select null::text, 'access_denied'::text, k.user_id,
                        k.linkedin_token_expires_at, false;
    return;
  end if;

  -- LinkedIn access tokens last ~60 days and cannot be refreshed without
  -- Marketing Developer Platform approval.
  if k.linkedin_token_expires_at is not null and k.linkedin_token_expires_at <= now() then
    return query select null::text, 'expired'::text, k.user_id,
                        k.linkedin_token_expires_at, false;
    return;
  end if;

  -- Throttled so a busy session doesn't write a row per tool call.
  if k.last_used_at is null or k.last_used_at < now() - interval '1 minute' then
    update public.mcp_keys set last_used_at = now() where api_key = p_key;
  end if;

  return query select k.linkedin_token, 'active'::text, k.user_id,
                      k.linkedin_token_expires_at, k.allow_writes;
end;
$$;

-- EXECUTE on functions is granted to PUBLIC by default — revoke before granting.
revoke all on function public.resolve_mcp_key(text) from public, anon, authenticated;
grant execute on function public.resolve_mcp_key(text) to mcp_server;
