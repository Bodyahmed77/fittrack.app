create table if not exists public.ai_runtime_slots (
  slot_id smallint primary key,
  lease_until timestamptz not null default to_timestamp(0)
);

insert into public.ai_runtime_slots (slot_id)
select gs from generate_series(1, 4) as gs
on conflict (slot_id) do nothing;

alter table public.ai_runtime_slots enable row level security;
revoke all on public.ai_runtime_slots from public, anon, authenticated;

create or replace function public.try_acquire_ai_slot(p_lease_seconds integer default 45)
returns smallint language plpgsql security definer set search_path = public
as $$
declare
  v_slot smallint;
  v_lease integer := greatest(15, least(coalesce(p_lease_seconds, 45), 90));
begin
  select slot_id into v_slot from public.ai_runtime_slots
  where lease_until <= now() order by slot_id for update skip locked limit 1;
  if v_slot is null then return 0; end if;
  update public.ai_runtime_slots set lease_until = now() + make_interval(secs => v_lease) where slot_id = v_slot;
  return v_slot;
end;
$$;

create or replace function public.release_ai_slot(p_slot_id smallint)
returns boolean language plpgsql security definer set search_path = public
as $$
begin
  update public.ai_runtime_slots set lease_until = to_timestamp(0) where slot_id = p_slot_id;
  return found;
end;
$$;

revoke all on function public.try_acquire_ai_slot(integer) from public, anon, authenticated;
revoke all on function public.release_ai_slot(smallint) from public, anon, authenticated;
grant execute on function public.try_acquire_ai_slot(integer) to service_role;
grant execute on function public.release_ai_slot(smallint) to service_role;

create table if not exists public.ai_reports (
  id uuid primary key default gen_random_uuid(),
  uid text not null,
  response_text text not null check (char_length(response_text) between 1 and 2000),
  reason text not null check (char_length(reason) between 1 and 500),
  lang text not null default 'en' check (lang in ('ar', 'en')),
  created_at timestamptz not null default now()
);
create index if not exists ai_reports_created_at_idx on public.ai_reports (created_at desc);
create index if not exists ai_reports_uid_idx on public.ai_reports (uid);
alter table public.ai_reports enable row level security;
revoke all on public.ai_reports from public, anon, authenticated;
