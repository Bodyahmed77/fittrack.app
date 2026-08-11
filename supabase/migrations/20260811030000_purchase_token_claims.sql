-- ============================================================
-- Purchase token -> uid binding (one-uid-per-token, first claim wins).
--
-- Why this exists: Google Play's Developer API can prove a purchase
-- token is real, unconsumed by a different grant, and for a specific
-- product — but it does NOT by itself say which of our app's users
-- purchased it, unless the client attached an obfuscated account id at
-- purchase time (Play Billing's setObfuscatedAccountId). The currently
-- pinned client billing plugin (capacitor-billing@6.0.2) does not expose
-- that parameter, so we cannot bind a token to a uid on Google's side yet.
--
-- This table is the interim mitigation: the FIRST uid to successfully
-- verify a given purchase token with Google Play owns that token forever.
-- Any other uid presenting the same real token afterward is rejected,
-- not granted. This stops casual token replay/sharing between accounts.
-- It does not stop determined collusion (both accounts controlled by the
-- same person coordinating in real time) — closing that fully requires
-- the plugin upgrade + setObfuscatedAccountId, tracked as a follow-up.
-- ============================================================

create table if not exists public.purchase_token_claims (
  purchase_token text primary key,
  uid text not null,
  claimed_at timestamptz not null default now()
);

alter table public.purchase_token_claims enable row level security;

-- Atomically claims a purchase token for a uid. Returns claimed=true if
-- this call performed the claim (token was unclaimed, or already claimed
-- by the SAME uid — re-verifying your own renewal/restore is fine).
-- Returns claimed=false if the token is already claimed by a DIFFERENT
-- uid — the caller must NOT grant an entitlement in that case.
create or replace function public.claim_purchase_token(
  p_uid text,
  p_purchase_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_uid text;
begin
  if p_uid is null or length(trim(p_uid)) = 0 then
    raise exception 'p_uid required';
  end if;
  if p_purchase_token is null or length(trim(p_purchase_token)) = 0 then
    raise exception 'p_purchase_token required';
  end if;

  insert into public.purchase_token_claims (purchase_token, uid)
  values (p_purchase_token, p_uid)
  on conflict (purchase_token) do nothing;

  select uid into v_existing_uid
    from public.purchase_token_claims
    where purchase_token = p_purchase_token;

  if v_existing_uid = p_uid then
    return jsonb_build_object('claimed', true);
  end if;

  return jsonb_build_object('claimed', false, 'owner_differs', true);
end;
$$;

revoke all on table public.purchase_token_claims from public;
revoke all on function public.claim_purchase_token(text, text) from public;
grant execute on function public.claim_purchase_token(text, text) to service_role;
