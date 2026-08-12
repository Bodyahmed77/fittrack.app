-- Extend account deletion so AI Coach reports are removed with the user's
-- other server-side data. The runtime slot table is shared infrastructure and
-- is intentionally not user-owned data.

create or replace function public.delete_user_data(p_uid text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.ai_reports where uid = p_uid;
  delete from public.purchase_token_claims where uid = p_uid;
  delete from public.entitlements where uid = p_uid;
  delete from public.ai_usage where uid = p_uid;
end;
$$;

revoke all on function public.delete_user_data(text) from public;
revoke all on function public.delete_user_data(text) from anon;
revoke all on function public.delete_user_data(text) from authenticated;
grant execute on function public.delete_user_data(text) to service_role;
