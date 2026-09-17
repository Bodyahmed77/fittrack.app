-- Production integrity hardening.
-- Keep service-role-only server functions deterministic and ensure account
-- deletion removes all current server-side records tied to a Firebase UID.

create or replace function public.get_my_entitlements(p_uid text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_keys text[];
begin
  if p_uid is null or length(trim(p_uid)) = 0 then
    raise exception 'p_uid required';
  end if;

  select coalesce(array_agg(e.product_key order by e.product_key), array[]::text[])
    into v_keys
    from public.entitlements e
    where e.uid = p_uid
      and e.purchase_state = 'active'
      and (e.expires_at is null or e.expires_at > now());

  return jsonb_build_object('keys', v_keys);
end;
$$;

revoke all on function public.get_my_entitlements(text) from public;
revoke all on function public.get_my_entitlements(text) from anon;
revoke all on function public.get_my_entitlements(text) from authenticated;
grant execute on function public.get_my_entitlements(text) to service_role;

create or replace function public.delete_user_data(p_uid text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_uid is null or length(trim(p_uid)) = 0 then
    raise exception 'p_uid required';
  end if;

  delete from public.ai_reports where uid = p_uid;
  delete from public.billing_event_log where uid = p_uid;
  delete from public.purchase_token_claims where uid = p_uid;
  delete from public.entitlements where uid = p_uid;
  delete from public.ai_usage where uid = p_uid;
  delete from public.ai_usage_legacy_backup_20260810225048 where user_id = p_uid;
end;
$$;

revoke all on function public.delete_user_data(text) from public;
revoke all on function public.delete_user_data(text) from anon;
revoke all on function public.delete_user_data(text) from authenticated;
grant execute on function public.delete_user_data(text) to service_role;
