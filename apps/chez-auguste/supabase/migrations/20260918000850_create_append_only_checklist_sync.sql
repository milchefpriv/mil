begin;

-- The checklist remains publicly readable/writable for the current no-login PWA,
-- but writes are now append-only mutations. Current rows are maintained only by
-- the private trigger below; clients cannot replace or delete canonical data.

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated, service_role;

create table if not exists private.auguste_checklist_legacy_backups (
  backup_id bigint generated always as identity primary key,
  source_section text not null,
  payload jsonb not null,
  source_updated_at timestamptz not null,
  source_updated_by uuid,
  payload_hash text not null,
  captured_at timestamptz not null default clock_timestamp(),
  constraint auguste_checklist_legacy_backups_section_check
    check (source_section = 'checklist'),
  constraint auguste_checklist_legacy_backups_payload_check
    check (jsonb_typeof(payload) = 'object'),
  constraint auguste_checklist_legacy_backups_hash_check
    check (char_length(payload_hash) = 64),
  constraint auguste_checklist_legacy_backups_source_hash_key
    unique (source_section, payload_hash)
);

revoke all on table private.auguste_checklist_legacy_backups
  from public, anon, authenticated, service_role;
revoke all on sequence private.auguste_checklist_legacy_backups_backup_id_seq
  from public, anon, authenticated, service_role;

create or replace function private.reject_auguste_checklist_backup_change()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  raise exception 'Checklist legacy backups are immutable'
    using errcode = '55000';
end;
$function$;

revoke execute on function private.reject_auguste_checklist_backup_change()
  from public, anon, authenticated, service_role;

drop trigger if exists reject_auguste_checklist_backup_change
  on private.auguste_checklist_legacy_backups;
create trigger reject_auguste_checklist_backup_change
before update or delete on private.auguste_checklist_legacy_backups
for each row execute function private.reject_auguste_checklist_backup_change();

drop trigger if exists reject_auguste_checklist_backup_truncate
  on private.auguste_checklist_legacy_backups;
create trigger reject_auguste_checklist_backup_truncate
before truncate on private.auguste_checklist_legacy_backups
for each statement execute function private.reject_auguste_checklist_backup_change();

-- Freeze all v1 writers for the rest of this transaction. A writer that started
-- first commits before this lock is granted and is therefore included below; a
-- later writer waits until the legacy write policy has been removed.
lock table public.auguste_shared_state in access exclusive mode;

-- Capture the exact, now-frozen legacy document before seeding or permissions.
insert into private.auguste_checklist_legacy_backups (
  source_section,
  payload,
  source_updated_at,
  source_updated_by,
  payload_hash
)
select
  state.section,
  state.payload,
  state.updated_at,
  state.updated_by,
  encode(extensions.digest(state.payload::text, 'sha256'), 'hex')
from public.auguste_shared_state as state
where state.section = 'checklist'
on conflict (source_section, payload_hash) do nothing;

do $backup_verify$
begin
  if not exists (
    select 1
    from public.auguste_shared_state as state
    where state.section = 'checklist'
  ) then
    raise exception 'Legacy checklist row is missing';
  end if;

  if not exists (
    select 1
    from public.auguste_shared_state as state
    join private.auguste_checklist_legacy_backups as backup
      on backup.source_section = state.section
      and backup.payload_hash = encode(
        extensions.digest(state.payload::text, 'sha256'),
        'hex'
      )
      and backup.payload = state.payload
      and backup.source_updated_at = state.updated_at
      and backup.source_updated_by is not distinct from state.updated_by
    where state.section = 'checklist'
  ) then
    raise exception 'Exact legacy checklist backup was not captured';
  end if;
end;
$backup_verify$;

create table if not exists public.auguste_checklist_mutations (
  seq bigint generated always as identity primary key,
  mutation_id uuid not null,
  workspace text not null default 'checklist',
  entity_type text not null,
  entity_id text not null,
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  device_id text not null,
  client_created_at timestamptz,
  base_revision bigint not null default 0,
  entity_revision bigint not null,
  outcome text not null,
  committed_at timestamptz not null default clock_timestamp(),
  constraint auguste_checklist_mutations_mutation_id_key unique (mutation_id),
  constraint auguste_checklist_mutations_workspace_check
    check (workspace = 'checklist'),
  constraint auguste_checklist_mutations_entity_type_check
    check (entity_type in ('task', 'template', 'occurrence', 'setting')),
  constraint auguste_checklist_mutations_entity_id_check
    check (
      octet_length(btrim(entity_id)) between 1 and 1024
    ),
  constraint auguste_checklist_mutations_action_check
    check (action in ('upsert', 'delete')),
  constraint auguste_checklist_mutations_base_revision_check
    check (base_revision >= 0),
  constraint auguste_checklist_mutations_entity_revision_check
    check (entity_revision >= 1),
  constraint auguste_checklist_mutations_outcome_check
    check (outcome in ('applied', 'conflict')),
  constraint auguste_checklist_mutations_entity_revision_key
    unique (workspace, entity_type, entity_id, entity_revision),
  constraint auguste_checklist_mutations_payload_check
    check (
      jsonb_typeof(payload) = 'object'
      and octet_length(payload::text) <= 65536
    ),
  constraint auguste_checklist_mutations_payload_identity_check
    check (
      entity_type = 'setting'
      or coalesce(payload ->> 'id', '') = entity_id
    ),
  constraint auguste_checklist_mutations_department_check
    check (
      action = 'delete'
      or entity_type not in ('task', 'template')
      or (
        entity_type = 'template'
        and coalesce(payload ->> 'department', '') in ('cuisine', 'salle')
      )
      or (
        entity_type = 'task'
        and (
          coalesce(payload ->> 'section', '') <> 'daily'
          or coalesce(payload ->> 'department', '') in ('cuisine', 'salle')
        )
      )
    ),
  constraint auguste_checklist_mutations_device_id_check
    check (char_length(btrim(device_id)) between 1 and 200)
);

create table if not exists public.auguste_checklist_items (
  workspace text not null default 'checklist',
  entity_type text not null,
  entity_id text not null,
  payload jsonb not null,
  deleted_at timestamptz,
  revision bigint not null default 1,
  mutation_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint auguste_checklist_items_pkey
    primary key (workspace, entity_type, entity_id),
  constraint auguste_checklist_items_workspace_check
    check (workspace = 'checklist'),
  constraint auguste_checklist_items_entity_type_check
    check (entity_type in ('task', 'template', 'occurrence', 'setting')),
  constraint auguste_checklist_items_entity_id_check
    check (
      octet_length(btrim(entity_id)) between 1 and 1024
    ),
  constraint auguste_checklist_items_payload_check
    check (
      jsonb_typeof(payload) = 'object'
      and octet_length(payload::text) <= 65536
    ),
  constraint auguste_checklist_items_payload_identity_check
    check (
      entity_type = 'setting'
      or coalesce(payload ->> 'id', '') = entity_id
    ),
  constraint auguste_checklist_items_department_check
    check (
      deleted_at is not null
      or entity_type not in ('task', 'template')
      or (
        entity_type = 'template'
        and coalesce(payload ->> 'department', '') in ('cuisine', 'salle')
      )
      or (
        entity_type = 'task'
        and (
          coalesce(payload ->> 'section', '') <> 'daily'
          or coalesce(payload ->> 'department', '') in ('cuisine', 'salle')
        )
      )
    ),
  constraint auguste_checklist_items_revision_check
    check (revision >= 1),
  constraint auguste_checklist_items_mutation_id_fkey
    foreign key (mutation_id)
    references public.auguste_checklist_mutations (mutation_id)
    on delete restrict
    deferrable initially deferred
);

create index if not exists auguste_checklist_mutations_workspace_seq_idx
  on public.auguste_checklist_mutations (workspace, seq);
create index if not exists auguste_checklist_mutations_entity_seq_idx
  on public.auguste_checklist_mutations (
    workspace,
    entity_type,
    entity_id,
    seq desc
  );
create index if not exists auguste_checklist_items_active_idx
  on public.auguste_checklist_items (
    workspace,
    entity_type,
    updated_at desc
  )
  where deleted_at is null;
create index if not exists auguste_checklist_items_mutation_id_idx
  on public.auguste_checklist_items (mutation_id);

comment on table public.auguste_checklist_mutations is
  'Append-only source of truth for checklist changes. Rows must never be updated or deleted.';
comment on table public.auguste_checklist_items is
  'Materialized current checklist state. Only the private mutation trigger writes this table.';
comment on column public.auguste_checklist_mutations.client_created_at is
  'Informational client clock only; it is never used to resolve concurrent writes.';
comment on column public.auguste_checklist_mutations.base_revision is
  'Applied-state revision expected by the client; 0 denotes no prior applied state.';
comment on column public.auguste_checklist_mutations.entity_revision is
  'Server-assigned log ordinal for this entity; conflicts consume ordinals.';
comment on column public.auguste_checklist_mutations.outcome is
  'Applied when base_revision matched current state; conflict otherwise. Conflicts stay journaled.';
comment on column public.auguste_checklist_items.deleted_at is
  'Soft-delete tombstone. The payload remains available for recovery.';
comment on column public.auguste_checklist_items.revision is
  'Applied-state revision. It increments by one only for outcome=applied.';

alter table public.auguste_checklist_mutations enable row level security;
alter table public.auguste_checklist_items enable row level security;

drop policy if exists "Checklist mutations can be read" on public.auguste_checklist_mutations;
create policy "Checklist mutations can be read"
on public.auguste_checklist_mutations
for select
to anon, authenticated
using (workspace = 'checklist');

drop policy if exists "Checklist mutations can be appended" on public.auguste_checklist_mutations;
create policy "Checklist mutations can be appended"
on public.auguste_checklist_mutations
for insert
to anon, authenticated
with check (
  workspace = 'checklist'
  and entity_type in ('task', 'template', 'occurrence', 'setting')
  and action in ('upsert', 'delete')
  and octet_length(btrim(entity_id)) between 1 and 1024
  and char_length(btrim(device_id)) between 1 and 200
  and base_revision >= 0
  and jsonb_typeof(payload) = 'object'
  and octet_length(payload::text) <= 65536
);

drop policy if exists "Checklist items can be read" on public.auguste_checklist_items;
create policy "Checklist items can be read"
on public.auguste_checklist_items
for select
to anon, authenticated
using (workspace = 'checklist');

-- Remove any automatic Data API grants, then add the exact client surface.
revoke all on table public.auguste_checklist_mutations
  from public, anon, authenticated, service_role;
revoke all on table public.auguste_checklist_items
  from public, anon, authenticated, service_role;
revoke all on sequence public.auguste_checklist_mutations_seq_seq
  from public, anon, authenticated, service_role;

grant select on table public.auguste_checklist_mutations
  to anon, authenticated;
grant insert (
  mutation_id,
  workspace,
  entity_type,
  entity_id,
  action,
  payload,
  device_id,
  client_created_at,
  base_revision
) on table public.auguste_checklist_mutations
  to anon, authenticated;
grant usage on sequence public.auguste_checklist_mutations_seq_seq
  to anon, authenticated;
grant select on table public.auguste_checklist_items
  to anon, authenticated;

-- Backend integrations get the same append/read surface, never direct mutation
-- or projection writes. The database owner remains the explicit break-glass path.
grant select on table public.auguste_checklist_mutations to service_role;
grant insert (
  mutation_id,
  workspace,
  entity_type,
  entity_id,
  action,
  payload,
  device_id,
  client_created_at,
  base_revision
) on table public.auguste_checklist_mutations to service_role;
grant usage on sequence public.auguste_checklist_mutations_seq_seq to service_role;
grant select on table public.auguste_checklist_items to service_role;

create or replace function private.prepare_auguste_checklist_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  existing_mutation public.auguste_checklist_mutations%rowtype;
  existing_payload jsonb;
  existing_revision bigint;
  latest_entity_revision bigint;
  has_existing_item boolean := false;
begin
  -- Serialize retries of one mutation ID. A duplicate returns before the AFTER
  -- trigger, so INSERT ... ON CONFLICT retries cannot increment the projection.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'auguste-checklist-mutation:' || new.mutation_id::text,
      0
    )
  );

  select mutation.*
  into existing_mutation
  from public.auguste_checklist_mutations as mutation
  where mutation.mutation_id = new.mutation_id;

  if found then
    if existing_mutation.workspace = new.workspace
      and existing_mutation.entity_type = new.entity_type
      and existing_mutation.entity_id = new.entity_id
      and existing_mutation.action = new.action
      and existing_mutation.device_id = new.device_id
      and existing_mutation.base_revision = new.base_revision
      and (
        new.action = 'delete'
        or existing_mutation.payload = new.payload
      )
    then
      return null;
    end if;

    raise exception 'mutation_id % is already attached to another checklist change',
      new.mutation_id
      using errcode = '23505';
  end if;

  -- Serialize all changes for one entity, including its first insert. This
  -- makes revision increments and delete/upsert ordering deterministic.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'auguste-checklist-entity:'
        || new.workspace || ':'
        || new.entity_type || ':'
        || new.entity_id,
      0
    )
  );

  new.committed_at := pg_catalog.clock_timestamp();

  select item.payload, item.revision
  into existing_payload, existing_revision
  from public.auguste_checklist_items as item
  where item.workspace = new.workspace
    and item.entity_type = new.entity_type
    and item.entity_id = new.entity_id
  for update;
  has_existing_item := found;

  select coalesce(max(mutation.entity_revision), 0)
  into latest_entity_revision
  from public.auguste_checklist_mutations as mutation
  where mutation.workspace = new.workspace
    and mutation.entity_type = new.entity_type
    and mutation.entity_id = new.entity_id;

  new.entity_revision := latest_entity_revision + 1;
  new.outcome := case
    when new.base_revision = coalesce(existing_revision, 0) then 'applied'
    else 'conflict'
  end;

  if new.action = 'delete' then
    -- Keep the last complete object for an applied delete. For a missing entity
    -- or stale delete, at minimum retain the canonical identity and the intent.
    if new.outcome = 'applied' and has_existing_item then
      new.payload := existing_payload;
    elsif new.entity_type <> 'setting' then
      new.payload := new.payload
        || pg_catalog.jsonb_build_object('id', new.entity_id);
    end if;
  end if;

  return new;
end;
$function$;

revoke execute on function private.prepare_auguste_checklist_mutation()
  from public, anon, authenticated, service_role;

create or replace function private.materialize_auguste_checklist_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  projected_rows bigint;
begin
  -- Persist stale edits as conflicts without replacing the visible state.
  if new.outcome = 'conflict' then
    return new;
  end if;

  if new.action = 'delete' then

    insert into public.auguste_checklist_items as current_item (
      workspace,
      entity_type,
      entity_id,
      payload,
      deleted_at,
      revision,
      mutation_id,
      created_at,
      updated_at
    )
    values (
      new.workspace,
      new.entity_type,
      new.entity_id,
      new.payload,
      new.committed_at,
      new.base_revision + 1,
      new.mutation_id,
      new.committed_at,
      new.committed_at
    )
    on conflict (workspace, entity_type, entity_id) do update
    set
      payload = current_item.payload,
      deleted_at = excluded.deleted_at,
      revision = excluded.revision,
      mutation_id = excluded.mutation_id,
      updated_at = excluded.updated_at
    where current_item.revision = new.base_revision;
  else
    insert into public.auguste_checklist_items as current_item (
      workspace,
      entity_type,
      entity_id,
      payload,
      deleted_at,
      revision,
      mutation_id,
      created_at,
      updated_at
    )
    values (
      new.workspace,
      new.entity_type,
      new.entity_id,
      new.payload,
      null,
      new.base_revision + 1,
      new.mutation_id,
      new.committed_at,
      new.committed_at
    )
    on conflict (workspace, entity_type, entity_id) do update
    set
      payload = excluded.payload,
      deleted_at = null,
      revision = excluded.revision,
      mutation_id = excluded.mutation_id,
      updated_at = excluded.updated_at
    where current_item.revision = new.base_revision;
  end if;

  get diagnostics projected_rows = row_count;
  if projected_rows <> 1 then
    raise exception 'Checklist projection changed while mutation % was applied',
      new.mutation_id
      using errcode = '40001';
  end if;

  return new;
end;
$function$;

revoke execute on function private.materialize_auguste_checklist_mutation()
  from public, anon, authenticated, service_role;

drop trigger if exists prepare_auguste_checklist_mutation
  on public.auguste_checklist_mutations;
create trigger prepare_auguste_checklist_mutation
before insert on public.auguste_checklist_mutations
for each row execute function private.prepare_auguste_checklist_mutation();

drop trigger if exists materialize_auguste_checklist_mutation
  on public.auguste_checklist_mutations;
create trigger materialize_auguste_checklist_mutation
after insert on public.auguste_checklist_mutations
for each row execute function private.materialize_auguste_checklist_mutation();

create or replace function private.reject_auguste_checklist_mutation_change()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  raise exception 'Checklist mutations are append-only'
    using errcode = '55000';
end;
$function$;

revoke execute on function private.reject_auguste_checklist_mutation_change()
  from public, anon, authenticated, service_role;

drop trigger if exists reject_auguste_checklist_mutation_change
  on public.auguste_checklist_mutations;
create trigger reject_auguste_checklist_mutation_change
before update or delete on public.auguste_checklist_mutations
for each row execute function private.reject_auguste_checklist_mutation_change();

drop trigger if exists reject_auguste_checklist_mutation_truncate
  on public.auguste_checklist_mutations;
create trigger reject_auguste_checklist_mutation_truncate
before truncate on public.auguste_checklist_mutations
for each statement execute function private.reject_auguste_checklist_mutation_change();

create or replace function private.reject_auguste_checklist_items_truncate()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  raise exception 'Checklist projection cannot be truncated'
    using errcode = '55000';
end;
$function$;

revoke execute on function private.reject_auguste_checklist_items_truncate()
  from public, anon, authenticated, service_role;

drop trigger if exists reject_auguste_checklist_items_truncate
  on public.auguste_checklist_items;
create trigger reject_auguste_checklist_items_truncate
before truncate on public.auguste_checklist_items
for each statement execute function private.reject_auguste_checklist_items_truncate();

-- Fail instead of silently skipping malformed legacy records.
do $preflight$
declare
  legacy_payload jsonb;
  collection_name text;
begin
  select state.payload
  into legacy_payload
  from public.auguste_shared_state as state
  where state.section = 'checklist';

  if found then
    if jsonb_typeof(legacy_payload) <> 'object' then
      raise exception 'Legacy checklist payload is not an object';
    end if;

    foreach collection_name in array array['tasks', 'templates', 'occurrences']
    loop
      if legacy_payload ? collection_name
        and jsonb_typeof(legacy_payload -> collection_name) <> 'array'
      then
        raise exception 'Legacy checklist %.% is not an array',
          'payload', collection_name;
      end if;

      if exists (
        select 1
        from jsonb_array_elements(
          case
            when jsonb_typeof(legacy_payload -> collection_name) = 'array'
              then legacy_payload -> collection_name
            else '[]'::jsonb
          end
        ) as entry(value)
        where jsonb_typeof(entry.value) <> 'object'
          or nullif(btrim(entry.value ->> 'id'), '') is null
          or octet_length(entry.value ->> 'id') > 1024
          or octet_length(entry.value::text) > 65000
      ) then
        raise exception 'Legacy checklist % contains an invalid record',
          collection_name;
      end if;

      if exists (
        select 1
        from jsonb_array_elements(
          case
            when jsonb_typeof(legacy_payload -> collection_name) = 'array'
              then legacy_payload -> collection_name
            else '[]'::jsonb
          end
        ) as entry(value)
        group by entry.value ->> 'id'
        having count(*) > 1
      ) then
        raise exception 'Legacy checklist % contains duplicate ids',
          collection_name;
      end if;
    end loop;

    if legacy_payload ? 'settings'
      and jsonb_typeof(legacy_payload -> 'settings') <> 'object'
    then
      raise exception 'Legacy checklist payload.settings is not an object';
    end if;
  end if;
end;
$preflight$;

-- Seed one deterministic mutation per legacy entity. Existing daily tasks and
-- all existing routine templates belong to Cuisine by explicit product choice.
with legacy as (
  select
    state.payload as legacy_payload,
    state.updated_at as source_updated_at
  from public.auguste_shared_state as state
  where state.section = 'checklist'
),
entities as (
  select
    'task'::text as entity_type,
    task.value ->> 'id' as entity_id,
    case
      when task.value ->> 'section' = 'daily'
        then (task.value - 'department')
          || jsonb_build_object('department', 'cuisine')
      else task.value
    end as entity_payload,
    legacy.source_updated_at
  from legacy
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(legacy.legacy_payload -> 'tasks') = 'array'
        then legacy.legacy_payload -> 'tasks'
      else '[]'::jsonb
    end
  ) as task(value)

  union all

  select
    'template'::text,
    template.value ->> 'id',
    (template.value - 'department')
      || jsonb_build_object('department', 'cuisine'),
    legacy.source_updated_at
  from legacy
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(legacy.legacy_payload -> 'templates') = 'array'
        then legacy.legacy_payload -> 'templates'
      else '[]'::jsonb
    end
  ) as template(value)

  union all

  select
    'occurrence'::text,
    occurrence.value ->> 'id',
    occurrence.value,
    legacy.source_updated_at
  from legacy
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(legacy.legacy_payload -> 'occurrences') = 'array'
        then legacy.legacy_payload -> 'occurrences'
      else '[]'::jsonb
    end
  ) as occurrence(value)

  union all

  select
    'setting'::text,
    'preferences'::text,
    legacy.legacy_payload -> 'settings',
    legacy.source_updated_at
  from legacy
  where jsonb_typeof(legacy.legacy_payload -> 'settings') = 'object'
),
seed_rows as (
  select
    entities.*,
    md5(
      'auguste-checklist-v2:'
        || entities.entity_type || ':'
        || entities.entity_id
    ) as mutation_hash
  from entities
)
insert into public.auguste_checklist_mutations (
  mutation_id,
  workspace,
  entity_type,
  entity_id,
  action,
  payload,
  device_id,
  client_created_at,
  base_revision
)
select
  (
    substr(seed_rows.mutation_hash, 1, 8) || '-'
      || substr(seed_rows.mutation_hash, 9, 4) || '-'
      || substr(seed_rows.mutation_hash, 13, 4) || '-'
      || substr(seed_rows.mutation_hash, 17, 4) || '-'
      || substr(seed_rows.mutation_hash, 21, 12)
  )::uuid,
  'checklist',
  seed_rows.entity_type,
  seed_rows.entity_id,
  'upsert',
  seed_rows.entity_payload,
  'migration-v1',
  seed_rows.source_updated_at,
  0
from seed_rows
on conflict (mutation_id) do nothing;

-- Verify every valid legacy entity is now materialized before disabling v1 writes.
do $verify_seed$
declare
  legacy_payload jsonb;
  missing_count bigint;
begin
  select state.payload
  into legacy_payload
  from public.auguste_shared_state as state
  where state.section = 'checklist';

  if found then
    select count(*)
    into missing_count
    from jsonb_array_elements(
      case
        when jsonb_typeof(legacy_payload -> 'tasks') = 'array'
          then legacy_payload -> 'tasks'
        else '[]'::jsonb
      end
    ) as task(value)
    where not exists (
      select 1
      from public.auguste_checklist_items as item
      where item.workspace = 'checklist'
        and item.entity_type = 'task'
        and item.entity_id = task.value ->> 'id'
        and item.deleted_at is null
        and item.payload = case
          when task.value ->> 'section' = 'daily'
            then (task.value - 'department')
              || jsonb_build_object('department', 'cuisine')
          else task.value
        end
    );

    if missing_count > 0 then
      raise exception 'Checklist migration missed % legacy task(s)', missing_count;
    end if;

    select count(*)
    into missing_count
    from jsonb_array_elements(
      case
        when jsonb_typeof(legacy_payload -> 'templates') = 'array'
          then legacy_payload -> 'templates'
        else '[]'::jsonb
      end
    ) as template(value)
    where not exists (
      select 1
      from public.auguste_checklist_items as item
      where item.workspace = 'checklist'
        and item.entity_type = 'template'
        and item.entity_id = template.value ->> 'id'
        and item.deleted_at is null
        and item.payload = (template.value - 'department')
          || jsonb_build_object('department', 'cuisine')
    );

    if missing_count > 0 then
      raise exception 'Checklist migration missed % legacy template(s)', missing_count;
    end if;

    select count(*)
    into missing_count
    from jsonb_array_elements(
      case
        when jsonb_typeof(legacy_payload -> 'occurrences') = 'array'
          then legacy_payload -> 'occurrences'
        else '[]'::jsonb
      end
    ) as occurrence(value)
    where not exists (
      select 1
      from public.auguste_checklist_items as item
      where item.workspace = 'checklist'
        and item.entity_type = 'occurrence'
        and item.entity_id = occurrence.value ->> 'id'
        and item.deleted_at is null
        and item.payload = occurrence.value
    );

    if missing_count > 0 then
      raise exception 'Checklist migration missed % legacy occurrence(s)', missing_count;
    end if;

    if jsonb_typeof(legacy_payload -> 'settings') = 'object'
      and not exists (
        select 1
        from public.auguste_checklist_items as item
        where item.workspace = 'checklist'
          and item.entity_type = 'setting'
          and item.entity_id = 'preferences'
          and item.deleted_at is null
          and item.payload = legacy_payload -> 'settings'
      )
    then
      raise exception 'Checklist migration missed legacy settings';
    end if;
  end if;
end;
$verify_seed$;

-- The public write contract is deliberately one mutation per INSERT statement.
-- This keeps entity locks ordered and makes every response map to one outcome.
create or replace function private.reject_multirow_auguste_checklist_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  inserted_count bigint;
begin
  select count(*)
  into inserted_count
  from inserted_mutations;

  if inserted_count > 1 then
    raise exception 'Insert checklist mutations one row at a time'
      using errcode = '21000';
  end if;

  return null;
end;
$function$;

revoke execute on function private.reject_multirow_auguste_checklist_insert()
  from public, anon, authenticated, service_role;

drop trigger if exists reject_multirow_auguste_checklist_insert
  on public.auguste_checklist_mutations;
create trigger reject_multirow_auguste_checklist_insert
after insert on public.auguste_checklist_mutations
referencing new table as inserted_mutations
for each statement execute function private.reject_multirow_auguste_checklist_insert();

-- Canonical v2 tables participate in Realtime. Realtime remains only a refresh
-- signal: clients must reconcile the materialized items after reconnecting and
-- retain an outbox entry until its mutation is read back. Applied entries may
-- leave the outbox; conflicts must remain visible until explicitly resolved.
do $publication$
begin
  if not exists (
    select 1
    from pg_catalog.pg_publication
    where pubname = 'supabase_realtime'
  ) then
    execute 'create publication supabase_realtime';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_publication
    where pubname = 'supabase_realtime'
      and (not pubinsert or not pubupdate)
  ) then
    raise exception 'supabase_realtime must publish inserts and updates';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'auguste_checklist_mutations'
  ) then
    execute 'alter publication supabase_realtime add table public.auguste_checklist_mutations';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'auguste_checklist_items'
  ) then
    execute 'alter publication supabase_realtime add table public.auguste_checklist_items';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_publication_tables as published
    where published.pubname = 'supabase_realtime'
      and published.schemaname = 'public'
      and published.tablename in (
        'auguste_checklist_mutations',
        'auguste_checklist_items'
      )
      and (
        published.rowfilter is not null
        or coalesce(pg_catalog.cardinality(published.attnames), -1) <> (
          select count(*)
          from pg_catalog.pg_attribute as attribute
          where attribute.attrelid = pg_catalog.to_regclass(
            'public.' || published.tablename
          )
            and attribute.attnum > 0
            and not attribute.attisdropped
        )
      )
  ) then
    raise exception 'Checklist Realtime tables must be unfiltered and publish all columns';
  end if;
end;
$publication$;

-- Freeze the legacy checklist document. Keep anonymous SELECT so cached v1
-- clients can read the final snapshot, but they can no longer overwrite it.
create or replace function private.reject_auguste_legacy_checklist_write()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if tg_op = 'DELETE' then
    if old.section = 'checklist' then
      raise exception 'The legacy checklist is read-only; use checklist mutations'
        using errcode = '55000';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.section = 'checklist' then
    raise exception 'The legacy checklist is read-only; use checklist mutations'
      using errcode = '55000';
  end if;

  if new.section = 'checklist' then
    raise exception 'The legacy checklist is read-only; use checklist mutations'
      using errcode = '55000';
  end if;

  return new;
end;
$function$;

revoke execute on function private.reject_auguste_legacy_checklist_write()
  from public, anon, authenticated, service_role;

drop trigger if exists reject_auguste_legacy_checklist_write
  on public.auguste_shared_state;
create trigger reject_auguste_legacy_checklist_write
before insert or update or delete on public.auguste_shared_state
for each row execute function private.reject_auguste_legacy_checklist_write();

drop policy if exists "Chez Auguste public checklist insert"
  on public.auguste_shared_state;
drop policy if exists "Chez Auguste public checklist update"
  on public.auguste_shared_state;
revoke insert, update, delete on table public.auguste_shared_state from anon;
revoke truncate on table public.auguste_shared_state
  from public, anon, authenticated, service_role;

drop policy if exists "Chez Auguste public checklist read"
  on public.auguste_shared_state;
create policy "Chez Auguste public checklist read"
on public.auguste_shared_state
for select
to anon
using (section = 'checklist');

-- Existing authenticated Chez Auguste data remains available for Cuisine and
-- Bar, while checklist writes are accepted only through the v2 mutation log.
drop policy if exists "Chez Auguste collaborators read"
  on public.auguste_shared_state;
create policy "Chez Auguste collaborators read"
on public.auguste_shared_state
for select
to authenticated
using (
  section in ('cuisine', 'bar')
  and lower(coalesce((select auth.jwt() ->> 'email'), ''))
    = 'chez-auguste@access.invalid'
);

drop policy if exists "Chez Auguste collaborators insert"
  on public.auguste_shared_state;
create policy "Chez Auguste collaborators insert"
on public.auguste_shared_state
for insert
to authenticated
with check (
  section in ('cuisine', 'bar')
  and lower(coalesce((select auth.jwt() ->> 'email'), ''))
    = 'chez-auguste@access.invalid'
  and updated_by = (select auth.uid())
);

drop policy if exists "Chez Auguste collaborators update"
  on public.auguste_shared_state;
create policy "Chez Auguste collaborators update"
on public.auguste_shared_state
for update
to authenticated
using (
  section in ('cuisine', 'bar')
  and lower(coalesce((select auth.jwt() ->> 'email'), ''))
    = 'chez-auguste@access.invalid'
)
with check (
  section in ('cuisine', 'bar')
  and lower(coalesce((select auth.jwt() ->> 'email'), ''))
    = 'chez-auguste@access.invalid'
  and updated_by = (select auth.uid())
);

commit;
