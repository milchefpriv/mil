create table if not exists public.chantier_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{"version":2,"projects":[],"reports":[]}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint chantier_workspaces_data_object check (jsonb_typeof(data) = 'object')
);

alter table public.chantier_workspaces enable row level security;

revoke all on table public.chantier_workspaces from anon;
grant select, insert, update on table public.chantier_workspaces to authenticated;

drop policy if exists "chantier_select_own" on public.chantier_workspaces;
create policy "chantier_select_own"
on public.chantier_workspaces
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "chantier_insert_own" on public.chantier_workspaces;
create policy "chantier_insert_own"
on public.chantier_workspaces
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "chantier_update_own" on public.chantier_workspaces;
create policy "chantier_update_own"
on public.chantier_workspaces
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
