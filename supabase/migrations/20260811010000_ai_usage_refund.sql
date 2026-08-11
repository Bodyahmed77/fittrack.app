-- Atomic refund: decrement usage by 1 after failed Gemini (never below 0).
-- Cannot inflate quota; only undoes a prior reserve when generation fails.

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
begin
  if p_uid is null or length(trim(p_uid)) = 0 then
    raise exception 'p_uid required';
  end if;
  if p_usage_date is null then
    raise exception 'p_usage_date required';
  end if;

  update public.ai_usage as u
  set count = u.count - 1
  where u.uid = p_uid
    and u.usage_date = p_usage_date
    and u.count > 0
  returning u.count into v_count;

  return jsonb_build_object(
    'refunded', v_count is not null,
    'count', coalesce(v_count, 0)
  );
end;
$$;

revoke all on function public.refund_ai_usage(text, date) from public;
grant execute on function public.refund_ai_usage(text, date) to service_role;
