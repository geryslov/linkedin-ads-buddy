-- Close the anon-read hole on mcp_api_keys.
--
-- WHY THIS IS URGENT: `geryslov/linkedin-ads-buddy` is a PUBLIC repo, and the
-- Supabase anon key is committed in `.env` and hardcoded in
-- `mcp-server/src/tools.ts`. Four migrations (20260621140055, 20260622084642,
-- 20260622093855, 20260622111316) granted `anon` SELECT/INSERT/UPDATE, and both
-- RLS policies are `using(true)`. Verified 2026-08-05 — this returns real
-- LinkedIn access tokens to anyone holding the published anon key:
--
--   curl "$SUPABASE_URL/rest/v1/mcp_api_keys?select=*" -H "apikey: $ANON_KEY"
--
-- Each token can read AND write live ad campaigns (the scope set includes
-- rw_ads).
--
-- ⚠️  READ BEFORE RUNNING — THIS BREAKS THE LEGACY MCP SERVER.
--
-- `mcp-server/src/server.ts` resolves keys with a direct PostgREST select using
-- the anon key. That select is exactly what this migration revokes, so after
-- running it the legacy server returns 401 for every request.
--
-- There is no way to keep that path working AND close the hole: an anon-readable
-- table is the mechanism. Pick one:
--
--   (a) Run this, and move your own Claude integration to the product MCP
--       service (src/server-product.ts), which resolves via resolve_mcp_key()
--       and never needs anon table access. Recommended — there were only 2 rows.
--
--   (b) Wait until you have migrated, then run it. The hole stays open until
--       you do.
--
-- Either way this is a decision, not a routine migration. It is deliberately
-- NOT part of the standalone-product rollout, which was built to avoid touching
-- the legacy system at all.

-- ── Drop the permissive policies ─────────────────────────────────────────────
-- Named across two duplicate table definitions (20260621000000 and 20260621140055).

drop policy if exists "api_key holder can select" on public.mcp_api_keys;
drop policy if exists "api_key holder can upsert" on public.mcp_api_keys;
drop policy if exists "select" on public.mcp_api_keys;
drop policy if exists "upsert" on public.mcp_api_keys;

-- ── Revoke the accumulated grants ────────────────────────────────────────────

revoke all on public.mcp_api_keys from anon;
revoke all on public.mcp_api_keys from authenticated;

alter table public.mcp_api_keys enable row level security;

-- service_role (the edge function, and therefore sync_mcp_token) keeps working.
grant all on public.mcp_api_keys to service_role;

-- ── Verify ───────────────────────────────────────────────────────────────────
-- After running, this must return zero rows or 401:
--   curl "$SUPABASE_URL/rest/v1/mcp_api_keys?select=*" -H "apikey: $ANON_KEY"
