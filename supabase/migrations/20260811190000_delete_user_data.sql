-- Account deletion cleanup for all server-side FitTrack user data.
-- Firebase Auth + Firestore are deleted by the authenticated client flow.
-- This function atomically removes the user's Supabase-side records.

create or replace function public.delete_user_data(p_uid text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.purchase_token_claims where uid = p_uid;
  delete from public.entitlements where uid = p_uid;
  delete from public.ai_usage where uid = p_uid;
end;
$$;

revoke all on function public.delete_user_data(text) from public;
revoke all on function public.delete_user_data(text) from anon;
revoke all on function public.delete_user_data(text) from authenticated;
grant execute on function public.delete_user_data(text) to service_role;
