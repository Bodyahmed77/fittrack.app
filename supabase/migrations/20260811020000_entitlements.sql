-- ============================================================
-- Server-controlled paid entitlements (AI Coach / Training /
-- Nutrition). This is the ONLY authoritative source of paid
-- access for the ai-coach Edge Function quota decision.
--
-- Design (low cost, no new infrastructure):
--  - Written by: the ai-coach Edge Function (via an admin-style
--    write endpoint) AND the app owner manually (SQL console /
--    grant tooling). Never written by a client app request.
--  - Read by: the ai-coach Edge Function (service role) to
--    decide the daily quota tier, and by the client through a
--    read-only RPC for UI hints (the UI must still verify via
--    the Edge Function response where it matters).
--  - One row per (uid, product_key). expires_at NULL = active
--    until cancelled; set it when Google Play cancels/expired.
--  - Independent products: ai_coach_pro / training_pro /
--    nutrition_pro can each be active or not. "both" grants are
--    stored as TWO rows (training_pro + nutrition_pro) so state
--    stays simple and never ambiguous.
-- ============================================================

create table if not exists public.entitlements (
  uid text not null,
  product_key text not null
    check (product_key in ('ai_coach_pro', 'training_pro', 'nutrition_pro')),
  purchase_token text,
  purchase_state text not null default 'active',
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (uid, product_key)
);

-- RLS: no anonymous or authenticated client can read or write.
-- Only service-role consumers (Edge Functions) touch this table.
alter table public.entitlements enable row level security;

-- Read RPC for the ai-coach Edge Function: returns the active
-- ai_coach_pro entitlement for a given uid.
create or replace function public.get_ai_entitlement(p_uid text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
begin
  if p_uid is null or length(trim(p_uid)) = 0 then
    raise exception 'p_uid required';
  end if;

  select e.*
    into v_row
    from public.entitlements e
    where e.uid = p_uid
      and e.product_key = 'ai_coach_pro'
      and e.purchase_state = 'active'
      and (e.expires_at is null or e.expires_at > now());

  if v_row is null then
    return jsonb_build_object('has_ai_pro', false);
  end if;
  return jsonb_build_object(
    'has_ai_pro', true,
    'purchase_state', v_row.purchase_state,
    'expires_at', v_row.expires_at
  );
end;
$$;

-- Read RPC for the client UI (paywall / restore UX hint):
-- returns ALL active entitlement keys for the requesting uid.
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
  if p_uid <> p_uid then
    raise exception 'invalid uid';
  end if;

  select coalesce(array_agg(e.product_key), array[]::text[])
    into v_keys
    from public.entitlements e
    where e.uid = p_uid
      and e.purchase_state = 'active'
      and (e.expires_at is null or e.expires_at > now());

  return jsonb_build_object('keys', v_keys);
end;
$$;

-- Write RPC used by the Edge Function "verify" endpoint:
-- activates (or deactivates) a product for a uid. Refuses to
-- activate anything except the three known product keys and
-- deactivates only when explicitly requested.
create or replace function public.set_entitlement(
  p_uid text,
  p_product_key text,
  p_activate boolean,
  p_purchase_token text default null,
  p_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_uid is null or length(trim(p_uid)) = 0 then
    raise exception 'p_uid required';
  end if;
  if p_product_key <> 'ai_coach_pro'
     and p_product_key <> 'training_pro'
     and p_product_key <> 'nutrition_pro' then
    raise exception 'unknown product_key';
  end if;

  if p_activate then
    insert into public.entitlements as e
      (uid, product_key, purchase_token, purchase_state, expires_at, updated_at)
    values (p_uid, p_product_key, p_purchase_token, 'active', p_expires_at, now())
    on conflict (uid, product_key)
    do update set
      purchase_state = 'active',
      purchase_token = coalesce(p_purchase_token, e.purchase_token),
      expires_at = coalesce(p_expires_at, e.expires_at),
      updated_at = now();
  else
    update public.entitlements
      set purchase_state = 'cancelled', updated_at = now()
      where uid = p_uid and product_key = p_product_key;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- Nobody (including anonymous/authenticated clients) can execute
-- these RPCs from the client SDK. Only service role (Edge
-- Functions) may call them.
revoke all on table public.entitlements from public;
revoke all on function public.get_ai_entitlement(text) from public;
revoke all on function public.get_my_entitlements(text) from public;
revoke all on function public.set_entitlement(text, text, boolean, text, timestamptz) from public;
grant execute on function public.get_ai_entitlement(text) to service_role;
grant execute on function public.get_my_entitlements(text) to service_role;
grant execute on function public.set_entitlement(text, text, boolean, text, timestamptz) to service_role;
