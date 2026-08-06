-- Standalone MCP product — schema. Step 1 of 2.
--
-- DELIBERATELY ADDITIVE. This does not touch `mcp_api_keys`, its grants, its
-- policies, or its rows. The existing single-tenant MCP server keeps reading
-- that table through the anon key exactly as it does today. The new product
-- gets its own table so that "don't change the running system" is a structural
-- guarantee rather than a promise.
--
--   legacy   mcp_api_keys  ← src/server.ts          (untouched)
--   product  mcp_keys      ← src/server-product.ts  (this file)
--
-- Consequence worth stating plainly: the pre-existing hole on `mcp_api_keys`
-- (four migrations granted anon SELECT/INSERT/UPDATE, both RLS policies are
-- `using(true)`, so the published anon key can read every stored LinkedIn
-- token) stays open. Closing it breaks the legacy resolver, so it is a separate
-- decision to make once nothing depends on that path.

-- ── The product's key table ──────────────────────────────────────────────────

create table if not exists public.mcp_keys (
  api_key                   text primary key,
  user_id                   uuid not null references auth.users(id) on delete cascade,
  linkedin_token            text not null,
  linkedin_token_expires_at timestamptz,
  linkedin_refresh_token    text,
  refresh_token_expires_at  timestamptz,
  last_refresh_error        text,
  -- 'active' | 'revoked' | 'suspended'
  status                    text not null default 'active',
  label                     text,
  -- Writes are allowed by default: the token is the user's own, scoped to their
  -- own ad accounts, and they can already make these changes in LinkedIn's UI.
  -- The column exists so an admin can pin a specific key to read-only.
  allow_writes              boolean not null default true,
  revoked_at                timestamptz,
  last_used_at              timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  constraint mcp_keys_status_check check (status in ('active', 'revoked', 'suspended'))
);

create index if not exists mcp_keys_user_id_idx on public.mcp_keys (user_id);
-- One active key per user; revoked rows accumulate as history.
create unique index if not exists mcp_keys_one_active_per_user
  on public.mcp_keys (user_id) where status = 'active';

-- ── RLS: locked down from day one ────────────────────────────────────────────
-- No anon grants, ever. Column-level grants keep the LinkedIn token unreadable
-- from the browser even by its owner; the /setup page only needs metadata.
-- All writes go through the JWT-required edge actions.

alter table public.mcp_keys enable row level security;

revoke all on public.mcp_keys from anon, authenticated, public;

grant select (
  api_key, user_id, status, label, allow_writes, revoked_at,
  last_used_at, linkedin_token_expires_at, created_at, updated_at
) on public.mcp_keys to authenticated;

create policy "owner reads own key metadata"
  on public.mcp_keys for select
  to authenticated
  using (auth.uid() = user_id);

create policy "admins read all keys"
  on public.mcp_keys for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- Admin panel: suspend/revoke a key, or pin it to read-only. Column-level so an
-- admin can never rewrite linkedin_token itself.
grant update (status, revoked_at, allow_writes) on public.mcp_keys to authenticated;

create policy "admins manage keys"
  on public.mcp_keys for update
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

grant all on public.mcp_keys to service_role;

-- ── profiles: access gating for the product (Stripe drives this later) ───────
-- Additive columns with defaults; the existing dashboard never reads them.

alter table public.profiles
  add column if not exists access_status text not null default 'active',
  add column if not exists plan text not null default 'free',
  add column if not exists stripe_customer_id text,
  add column if not exists trial_ends_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_access_status_check;
alter table public.profiles
  add constraint profiles_access_status_check
  check (access_status in ('active', 'pending', 'suspended'));

-- The existing migration gives admins SELECT on all profiles but no UPDATE, so
-- without this the admin panel can display users and change nothing.
drop policy if exists "Admins can update profiles access" on public.profiles;
create policy "Admins can update profiles access"
  on public.profiles for update
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ── handle_new_user: survive LinkedIn OIDC signups ───────────────────────────
-- The ONE place this migration touches shared behaviour, and it is required —
-- without it, signing in with LinkedIn on the new site fails.
--
-- Two live bugs for OIDC users:
--   1. It reads raw_user_meta_data->>'first_name'; LinkedIn OIDC emits
--      given_name / family_name / name / sub.
--   2. profiles.email is NOT NULL, so an absent email claim throws, and
--      Supabase surfaces it as an opaque "Database error saving new user".
-- Both changes are strictly more permissive: existing email/password signups
-- behave identically, they just no longer explode on a duplicate or a null.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  full_name text := meta ->> 'name';
begin
  insert into public.profiles (user_id, email, first_name, last_name, linkedin_profile_id)
  values (
    new.id,
    coalesce(new.email, meta ->> 'email', new.id::text || '@no-email.local'),
    coalesce(meta ->> 'first_name', meta ->> 'given_name', split_part(full_name, ' ', 1)),
    coalesce(meta ->> 'last_name',  meta ->> 'family_name',
             nullif(substr(full_name, length(split_part(full_name, ' ', 1)) + 2), '')),
    meta ->> 'sub'
  )
  on conflict (user_id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'user')
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;
