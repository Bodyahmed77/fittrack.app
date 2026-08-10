-- AI Coach daily usage table
-- Intended schema (from AI_COACH_SETUP.md): Firebase UID + local date + count
-- Live error was: column ai_usage.uid does not exist (Postgres 42703)
--
-- Strategy:
-- 1) If a broken/legacy ai_usage exists without the required columns, rename it
--    to a backup (data was unusable for the Edge Function anyway).
-- 2) Create the correct table with primary key (uid, usage_date).
-- 3) Provide atomic increment RPC to avoid read-check-write race on limits.

do $$
declare
  has_table boolean;
  has_uid boolean;
  has_usage_date boolean;
  has_count boolean;
begin
  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'ai_usage'
  ) into has_table;

  if has_table then
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'ai_usage' and column_name = 'uid'
    ) into has_uid;
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'ai_usage' and column_name = 'usage_date'
    ) into has_usage_date;
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'ai_usage' and column_name = 'count'
    ) into has_count;

    -- Broken/partial table (matches production 42703) → back up and recreate
    if not (has_uid and has_usage_date and has_count) then
      execute 'alter table public.ai_usage rename to ai_usage_legacy_backup_'
        || to_char(timezone('utc', now()), 'YYYYMMDDHH24MISS');
    end if;
  end if;
end $$;

create table if not exists public.ai_usage (
  uid text not null,
  usage_date date not null,
  count integer not null default 0,
  primary key (uid, usage_date)
);

alter table public.ai_usage enable row level security;

-- Atomic reserve/increment: returns allowed + new count.
-- If already at/over limit, allowed=false and count is unchanged.
create or replace function public.reserve_ai_usage(
  p_uid text,
  p_usage_date date,
  p_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if p_uid is null or length(trim(p_uid)) = 0 then
    raise exception 'p_uid required';
  end if;
  if p_usage_date is null then
    raise exception 'p_usage_date required';
  end if;
  if p_limit is null or p_limit < 1 then
    raise exception 'p_limit must be >= 1';
  end if;

  insert into public.ai_usage as u (uid, usage_date, count)
  values (p_uid, p_usage_date, 1)
  on conflict (uid, usage_date)
  do update set count = u.count + 1
  where u.count < p_limit
  returning u.count into v_count;

  if v_count is null then
    select u.count into v_count
    from public.ai_usage u
    where u.uid = p_uid and u.usage_date = p_usage_date;

    return jsonb_build_object(
      'allowed', false,
      'count', coalesce(v_count, p_limit),
      'limit', p_limit,
      'remaining', 0
    );
  end if;

  return jsonb_build_object(
    'allowed', true,
    'count', v_count,
    'limit', p_limit,
    'remaining', greatest(0, p_limit - v_count)
  );
end;
$$;

revoke all on function public.reserve_ai_usage(text, date, integer) from public;
grant execute on function public.reserve_ai_usage(text, date, integer) to service_role;
