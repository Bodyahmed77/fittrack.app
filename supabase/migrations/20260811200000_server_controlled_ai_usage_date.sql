-- Security hardening: AI daily quota date must be server-controlled.
--
-- The Edge Function historically accepted a client-supplied localDate and
-- passed it into reserve_ai_usage/refund_ai_usage. A malicious client could
-- submit a different date and obtain a fresh daily bucket repeatedly.
--
-- Keep the existing function signatures for compatibility, but deliberately
-- ignore the supplied date and use PostgreSQL's current UTC date instead.
-- This makes the quota boundary authoritative on the server.

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
  v_usage_date date := current_date;
begin
  if p_uid is null or length(trim(p_uid)) = 0 then
    raise exception 'p_uid required';
  end if;
  if p_limit is null or p_limit < 1 then
    raise exception 'p_limit must be >= 1';
  end if;

  insert into public.ai_usage as u (uid, usage_date, count)
  values (p_uid, v_usage_date, 1)
  on conflict (uid, usage_date)
  do update set count = u.count + 1
  where u.count < p_limit
  returning u.count into v_count;

  if v_count is null then
    select u.count into v_count
    from public.ai_usage u
    where u.uid = p_uid and u.usage_date = v_usage_date;

    return jsonb_build_object(
      'allowed', false,
      'count', coalesce(v_count, p_limit),
      'limit', p_limit,
      'remaining', 0,
      'date', v_usage_date
    );
  end if;

  return jsonb_build_object(
    'allowed', true,
    'count', v_count,
    'limit', p_limit,
    'remaining', greatest(0, p_limit - v_count),
    'date', v_usage_date
  );
end;
$$;

revoke all on function public.reserve_ai_usage(text, date, integer) from public;
grant execute on function public.reserve_ai_usage(text, date, integer) to service_role;

create or replace function public.refund_ai_usage(
  p_uid text,
  p_usage_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_usage_date date := current_date;
begin
  if p_uid is null or length(trim(p_uid)) = 0 then
    raise exception 'p_uid required';
  end if;

  update public.ai_usage as u
  set count = u.count - 1
  where u.uid = p_uid
    and u.usage_date = v_usage_date
    and u.count > 0
  returning u.count into v_count;

  return jsonb_build_object(
    'refunded', v_count is not null,
    'count', coalesce(v_count, 0),
    'date', v_usage_date
  );
end;
$$;

revoke all on function public.refund_ai_usage(text, date) from public;
grant execute on function public.refund_ai_usage(text, date) to service_role;
