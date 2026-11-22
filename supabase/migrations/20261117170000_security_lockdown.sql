-- Security lockdown for the findings in Lovable's Security view.

-- 1. mcp_api_keys held every user's LinkedIn token behind USING (true): anyone
--    with the public anon key could list them all. Lookups now go through a
--    function that only answers for an exact key; writes go through the
--    linkedin-api edge function (sync_mcp_token, service role).
create or replace function public.lookup_mcp_token(p_api_key text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select linkedin_token from public.mcp_api_keys where api_key = p_api_key limit 1
$$;
revoke all on function public.lookup_mcp_token(text) from public;
grant execute on function public.lookup_mcp_token(text) to anon, authenticated;

drop policy if exists "api_key holder can select" on public.mcp_api_keys;
drop policy if exists "api_key holder can upsert" on public.mcp_api_keys;
drop policy if exists "select" on public.mcp_api_keys;
drop policy if exists "upsert" on public.mcp_api_keys;
revoke all on public.mcp_api_keys from anon, authenticated;

-- 2. Shared caches are read and written only by the edge function with the
--    service role (which bypasses RLS). Drop every client policy and grant.
do $$
declare p record;
begin
  for p in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('title_metadata_cache', 'title_function_map', 'linkedin_company_cache')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;
revoke all on public.title_metadata_cache, public.title_function_map, public.linkedin_company_cache from anon, authenticated;

-- 3. Trigger functions never need to be callable over /rest/v1/rpc (triggers
--    don't check EXECUTE). has_role stays callable by signed-in users because
--    RLS policies evaluate it as the querying user. get_published_report is
--    public on purpose: it serves shared report links.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.update_last_login() from public, anon, authenticated;
revoke execute on function public.update_account_budgets_updated_at() from public, anon, authenticated;
revoke execute on function public.update_naming_conventions_updated_at() from public, anon, authenticated;
revoke execute on function public.update_title_function_map_updated_at() from public, anon, authenticated;
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
