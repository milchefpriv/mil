create table if not exists public.chantier_firm_profiles (
  email text primary key,
  name text not null default '',
  address text not null default '',
  contact text not null default '',
  updated_at timestamptz not null default now(),
  constraint chantier_firm_profiles_email_lowercase check (email = lower(email)),
  constraint chantier_firm_profiles_email_length check (char_length(email) between 3 and 320)
);

alter table public.chantier_firm_profiles enable row level security;

revoke all on table public.chantier_firm_profiles from anon;
grant select, insert, update on table public.chantier_firm_profiles to authenticated;

drop policy if exists "read own chantier firm profile" on public.chantier_firm_profiles;
create policy "read own chantier firm profile"
on public.chantier_firm_profiles
for select
to authenticated
using (((select auth.jwt()) ->> 'email') = email);

drop policy if exists "insert own chantier firm profile" on public.chantier_firm_profiles;
create policy "insert own chantier firm profile"
on public.chantier_firm_profiles
for insert
to authenticated
with check (((select auth.jwt()) ->> 'email') = email);

drop policy if exists "update own chantier firm profile" on public.chantier_firm_profiles;
create policy "update own chantier firm profile"
on public.chantier_firm_profiles
for update
to authenticated
using (((select auth.jwt()) ->> 'email') = email)
with check (((select auth.jwt()) ->> 'email') = email);
