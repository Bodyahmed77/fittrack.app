-- Harden exposed SECURITY DEFINER RPCs.
-- These functions are server-side primitives used by Edge Functions only.
-- They must never be callable directly by anon/authenticated clients.

revoke all on function public.claim_and_grant_entitlements(text, text, text[], timestamptz) from public;
revoke all on function public.claim_and_grant_entitlements(text, text, text[], timestamptz) from anon;
revoke all on function public.claim_and_grant_entitlements(text, text, text[], timestamptz) from authenticated;
grant execute on function public.claim_and_grant_entitlements(text, text, text[], timestamptz) to service_role;

revoke all on function public.claim_purchase_token(text, text) from public;
revoke all on function public.claim_purchase_token(text, text) from anon;
revoke all on function public.claim_purchase_token(text, text) from authenticated;
grant execute on function public.claim_purchase_token(text, text) to service_role;

revoke all on function public.consume_ai_message(text, date, integer) from public;
revoke all on function public.consume_ai_message(text, date, integer) from anon;
revoke all on function public.consume_ai_message(text, date, integer) from authenticated;
grant execute on function public.consume_ai_message(text, date, integer) to service_role;

revoke all on function public.get_ai_entitlement(text) from public;
revoke all on function public.get_ai_entitlement(text) from anon;
revoke all on function public.get_ai_entitlement(text) from authenticated;
grant execute on function public.get_ai_entitlement(text) to service_role;

revoke all on function public.get_my_entitlements(text) from public;
revoke all on function public.get_my_entitlements(text) from anon;
revoke all on function public.get_my_entitlements(text) from authenticated;
grant execute on function public.get_my_entitlements(text) to service_role;

revoke all on function public.refund_ai_usage(text, date) from public;
revoke all on function public.refund_ai_usage(text, date) from anon;
revoke all on function public.refund_ai_usage(text, date) from authenticated;
grant execute on function public.refund_ai_usage(text, date) to service_role;

revoke all on function public.reserve_ai_usage(text, date, integer) from public;
revoke all on function public.reserve_ai_usage(text, date, integer) from anon;
revoke all on function public.reserve_ai_usage(text, date, integer) from authenticated;
grant execute on function public.reserve_ai_usage(text, date, integer) to service_role;

revoke all on function public.set_entitlement(text, text, boolean, text, timestamptz) from public;
revoke all on function public.set_entitlement(text, text, boolean, text, timestamptz) from anon;
revoke all on function public.set_entitlement(text, text, boolean, text, timestamptz) from authenticated;
grant execute on function public.set_entitlement(text, text, boolean, text, timestamptz) to service_role;
