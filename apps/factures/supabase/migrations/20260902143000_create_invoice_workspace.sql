create table public.invoice_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  legal_name text not null default '',
  trade_name text not null default '',
  siren text not null default '',
  siret text not null default '',
  address text not null default '',
  postcode text not null default '',
  city text not null default '',
  phone text not null default '',
  emails jsonb not null default '[]'::jsonb check (jsonb_typeof(emails) = 'array'),
  default_email text not null default '',
  iban text not null default '',
  bic text not null default '',
  payment_terms_days integer not null default 30 check (payment_terms_days between 0 and 90),
  penalty_rate numeric(6,2) not null default 12.40 check (penalty_rate >= 0),
  updated_at timestamptz not null default now()
);

create table public.invoice_clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null default 'professional' check (type in ('professional', 'individual')),
  company_name text not null default '',
  contact_name text not null default '',
  email text not null default '',
  phone text not null default '',
  address text not null default '',
  postcode text not null default '',
  city text not null default '',
  siren text not null default '',
  billing_address text not null default '',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_type text not null default 'invoice' check (document_type in ('invoice', 'credit')),
  document_code text,
  invoice_number integer,
  credit_number integer,
  status text not null default 'draft' check (status in ('draft', 'finalized', 'sent', 'paid', 'overdue', 'credited')),
  issue_date date not null,
  service_date date not null,
  due_date date not null,
  client_id uuid references public.invoice_clients(id) on delete set null,
  client_snapshot jsonb,
  issuer_snapshot jsonb,
  sender_email text not null default '',
  purchase_order text not null default '',
  lines jsonb not null default '[]'::jsonb check (jsonb_typeof(lines) = 'array'),
  notes text not null default '',
  total_cents bigint not null default 0,
  penalty_rate numeric(6,2) not null default 12.40,
  source_invoice_id uuid references public.invoices(id) on delete set null,
  finalized_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoices_document_code_unique unique (user_id, document_code),
  constraint invoices_invoice_number_unique unique (user_id, invoice_number),
  constraint invoices_credit_number_unique unique (user_id, credit_number),
  constraint invoices_sequence_shape check (
    (document_type = 'invoice' and credit_number is null)
    or (document_type = 'credit' and invoice_number is null)
  ),
  constraint invoices_dates_ordered check (due_date >= issue_date),
  constraint invoices_final_total_sign check (
    status = 'draft'
    or (document_type = 'invoice' and total_cents > 0)
    or (document_type = 'credit' and total_cents < 0)
  )
);

create table public.invoice_counters (
  user_id uuid primary key references auth.users(id) on delete cascade,
  next_invoice_number integer not null default 2701 check (next_invoice_number >= 2701),
  next_credit_number integer not null default 1 check (next_credit_number >= 1),
  updated_at timestamptz not null default now()
);

create index invoice_clients_user_active_idx on public.invoice_clients (user_id, archived, created_at desc);
create index invoices_user_created_idx on public.invoices (user_id, created_at desc);
create index invoices_user_status_due_idx on public.invoices (user_id, status, due_date);
create index invoices_client_id_idx on public.invoices (client_id);
create index invoices_source_invoice_id_idx on public.invoices (source_invoice_id);

alter table public.invoice_profiles enable row level security;
alter table public.invoice_clients enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_counters enable row level security;

create policy "invoice_profiles_select_own" on public.invoice_profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy "invoice_profiles_insert_own" on public.invoice_profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "invoice_profiles_update_own" on public.invoice_profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "invoice_clients_select_own" on public.invoice_clients for select to authenticated using ((select auth.uid()) = user_id);
create policy "invoice_clients_insert_own" on public.invoice_clients for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "invoice_clients_update_own" on public.invoice_clients for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "invoice_clients_delete_own" on public.invoice_clients for delete to authenticated using ((select auth.uid()) = user_id);

create policy "invoices_select_own" on public.invoices for select to authenticated using ((select auth.uid()) = user_id);
create policy "invoices_insert_own" on public.invoices for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "invoices_update_own" on public.invoices for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "invoices_delete_own" on public.invoices for delete to authenticated using ((select auth.uid()) = user_id);

create policy "invoice_counters_select_own" on public.invoice_counters for select to authenticated using ((select auth.uid()) = user_id);
create policy "invoice_counters_insert_own" on public.invoice_counters for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "invoice_counters_update_own" on public.invoice_counters for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create or replace function public.protect_finalized_invoice()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'A finalized document cannot be deleted';
    end if;
    return old;
  end if;

  if old.status <> 'draft' and (
    (to_jsonb(new) - array['status', 'paid_at', 'updated_at'])
    is distinct from
    (to_jsonb(old) - array['status', 'paid_at', 'updated_at'])
  ) then
    raise exception 'A finalized document is immutable';
  end if;
  return new;
end;
$$;

create trigger protect_finalized_invoice_update
before update on public.invoices
for each row execute function public.protect_finalized_invoice();

create trigger protect_finalized_invoice_delete
before delete on public.invoices
for each row execute function public.protect_finalized_invoice();

create or replace function public.finalize_invoice_document(p_invoice_id uuid)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_invoice public.invoices%rowtype;
  v_next integer;
  v_code text;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select * into v_invoice
  from public.invoices
  where id = p_invoice_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Invoice not found';
  end if;

  if v_invoice.document_code is not null then
    return v_invoice.document_code;
  end if;

  if v_invoice.status <> 'draft' then
    raise exception 'Only a draft can be finalized';
  end if;

  if v_invoice.client_snapshot is null or jsonb_array_length(v_invoice.lines) = 0 then
    raise exception 'Incomplete invoice';
  end if;

  if v_invoice.document_type = 'invoice' and exists (
    select 1 from public.invoices
    where user_id = v_user_id
      and document_type = 'invoice'
      and invoice_number is not null
      and issue_date > v_invoice.issue_date
  ) then
    raise exception 'The invoice date breaks chronological numbering';
  end if;

  insert into public.invoice_counters (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  if v_invoice.document_type = 'credit' then
    select next_credit_number into v_next
    from public.invoice_counters
    where user_id = v_user_id
    for update;
    v_code := 'AV-' || lpad(v_next::text, 4, '0');
    update public.invoice_counters
      set next_credit_number = v_next + 1, updated_at = now()
      where user_id = v_user_id;
    update public.invoices
      set document_code = v_code,
          credit_number = v_next,
          status = 'finalized',
          finalized_at = now(),
          updated_at = now()
      where id = p_invoice_id and user_id = v_user_id;

    if v_invoice.source_invoice_id is not null then
      update public.invoices
        set status = 'credited', updated_at = now()
        where id = v_invoice.source_invoice_id and user_id = v_user_id and document_type = 'invoice';
    end if;
  else
    select next_invoice_number into v_next
    from public.invoice_counters
    where user_id = v_user_id
    for update;
    v_code := v_next::text;
    update public.invoice_counters
      set next_invoice_number = v_next + 1, updated_at = now()
      where user_id = v_user_id;
    update public.invoices
      set document_code = v_code,
          invoice_number = v_next,
          status = 'finalized',
          finalized_at = now(),
          updated_at = now()
      where id = p_invoice_id and user_id = v_user_id;
  end if;

  return v_code;
end;
$$;

revoke all on public.invoice_profiles, public.invoice_clients, public.invoices, public.invoice_counters from public, anon;
grant usage on schema public to authenticated;
grant select, insert, update on public.invoice_profiles, public.invoice_counters to authenticated;
grant select, insert, update, delete on public.invoice_clients, public.invoices to authenticated;

revoke execute on function public.protect_finalized_invoice() from public, anon, authenticated;
revoke execute on function public.finalize_invoice_document(uuid) from public, anon;
grant execute on function public.finalize_invoice_document(uuid) to authenticated;
