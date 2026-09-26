-- Mirrors the production migration 20260926225741_create_auguste_daily_z_reports.
create table if not exists public.auguste_daily_z_reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.auguste_workspaces(id) on delete cascade,
  report_date date not null,
  gmail_message_id text not null unique,
  source_subject text not null default '',
  revenue_ttc numeric(12,2) not null default 0 check (revenue_ttc >= 0),
  revenue_ht numeric(12,2) not null default 0 check (revenue_ht >= 0),
  discounts_ttc numeric(12,2) not null default 0 check (discounts_ttc >= 0),
  offered_ttc numeric(12,2) not null default 0 check (offered_ttc >= 0),
  covers numeric(12,2) not null default 0 check (covers >= 0),
  avg_basket_ttc numeric(12,2),
  avg_ticket_ttc numeric(12,2),
  corrections_before_kitchen_ttc numeric(12,2) not null default 0,
  corrections_after_kitchen_ttc numeric(12,2) not null default 0,
  kitchen_cancellations_ttc numeric(12,2) not null default 0,
  sales_lines jsonb not null default '[]'::jsonb check (jsonb_typeof(sales_lines) = 'array'),
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint auguste_daily_z_reports_report_date_unique unique (report_date)
);

create index if not exists auguste_daily_z_reports_workspace_date_idx
  on public.auguste_daily_z_reports (workspace_id, report_date desc);

alter table public.auguste_daily_z_reports enable row level security;

drop policy if exists auguste_daily_z_reports_member_select on public.auguste_daily_z_reports;
create policy auguste_daily_z_reports_member_select
  on public.auguste_daily_z_reports for select to authenticated
  using (exists (
    select 1 from public.auguste_workspace_members member
    where member.workspace_id = auguste_daily_z_reports.workspace_id
      and member.user_id = (select auth.uid())
  ));

grant select on public.auguste_daily_z_reports to authenticated;
