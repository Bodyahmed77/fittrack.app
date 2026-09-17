-- AI Coach compatibility bridge.
-- The deployed edge function used p_date while the canonical usage RPCs use
-- p_usage_date. Keep canonical functions intact and provide service-role-only
-- named-argument wrappers for compatibility during rollout.

create or replace function public.reserve_ai_usage(
  p_uid text,
  p_date date,
  p_limit integer,
  p_usage_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
begin
  return public.reserve_ai_usage(
    p_uid => p_uid,
    p_usage_date => coalesce(p_usage_date, p_date),
    p_limit => p_limit
  );
end;
$function$;

create or replace function public.refund_ai_usage(
  p_uid text,
  p_date date,
  p_usage_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
begin
  return public.refund_ai_usage(
    p_uid => p_uid,
    p_usage_date => coalesce(p_usage_date, p_date)
  );
end;
$function$;

revoke execute on function public.reserve_ai_usage(text, date, integer, date) from public, anon, authenticated;
revoke execute on function public.refund_ai_usage(text, date, date) from public, anon, authenticated;
grant execute on function public.reserve_ai_usage(text, date, integer, date) to service_role;
grant execute on function public.refund_ai_usage(text, date, date) to service_role;
