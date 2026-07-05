create table if not exists public.published_reports (
  id                 uuid primary key default gen_random_uuid(),
  share_token        text unique not null,
  user_id            uuid not null references auth.users(id) on delete cascade,
  account_id         text not null,
  client_name        text not null,
  week_start         date not null,
  week_end           date not null,
  narrative_markdown text not null,
  kpi_snapshot       jsonb not null,
  raw_data           jsonb,
  published_at       timestamptz not null default now(),
  revoked_at         timestamptz
);

grant select, insert, update, delete on public.published_reports to authenticated;
grant all on public.published_reports to service_role;

create index if not exists published_reports_share_token_idx
  on public.published_reports(share_token);

create index if not exists published_reports_user_account_idx
  on public.published_reports(user_id, account_id);

alter table public.published_reports enable row level security;

create policy "Owners manage own reports"
  on public.published_reports
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.get_published_report(token text)
returns setof public.published_reports
language sql
security definer
set search_path = public
as $$
  select *
  from public.published_reports
  where share_token = token
    and revoked_at is null
  limit 1;
$$;

revoke all on function public.get_published_report(text) from public;
grant execute on function public.get_published_report(text) to anon, authenticated;