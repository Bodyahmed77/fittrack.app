-- ============================================================
-- Atomic claim + entitlement grant
-- ============================================================
-- Problem this closes:
--   verify-purchase previously called claim_purchase_token and then
--   set_entitlement in separate RPC round-trips. If claim succeeded and
--   set_entitlement failed (or only the first of a both_pro pair
--   succeeded), the purchase token could remain claimed while the
--   entitlement row(s) were missing or partial.
--
-- Fix:
--   One security-definer function runs claim + all entitlement upserts
--   inside a single Postgres transaction. Any failure rolls back the
--   claim insert and every entitlement write.
--
-- Behavior preserved:
--   - First uid to successfully claim a token owns it (unique PK).
--   - Same uid re-claim (restore / retry) is allowed and re-upserts.
--   - Different uid presenting the same token is rejected (no grant).
--   - service_role only.
--   - Does not modify reserve_ai_usage / refund_ai_usage.
-- ============================================================

create or replace function public.claim_and_grant_entitlements(
  p_uid text,
  p_purchase_token text,
  p_product_keys text[],
  p_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_uid text;
  v_key text;
  v_activated text[] := array[]::text[];
begin
  if p_uid is null or length(trim(p_uid)) = 0 then
    raise exception 'p_uid required';
  end if;
  if p_purchase_token is null or length(trim(p_purchase_token)) = 0 then
    raise exception 'p_purchase_token required';
  end if;
  if p_product_keys is null or coalesce(array_length(p_product_keys, 1), 0) = 0 then
    raise exception 'p_product_keys required';
  end if;

  -- Validate keys before any write so a bad key never leaves a claim.
  foreach v_key in array p_product_keys loop
    if v_key is null
       or (v_key <> 'ai_coach_pro'
           and v_key <> 'training_pro'
           and v_key <> 'nutrition_pro') then
      raise exception 'unknown product_key: %', v_key;
    end if;
  end loop;

  -- Claim token (first-writer wins). Same-uid re-claim is fine.
  insert into public.purchase_token_claims (purchase_token, uid)
  values (p_purchase_token, p_uid)
  on conflict (purchase_token) do nothing;

  select uid into v_existing_uid
    from public.purchase_token_claims
    where purchase_token = p_purchase_token;

  if v_existing_uid is distinct from p_uid then
    -- Owned by someone else — do not grant. No writes to entitlements.
    return jsonb_build_object(
      'ok', false,
      'claimed', false,
      'error', 'purchase_already_claimed'
    );
  end if;

  -- Grant every product key. Any exception rolls back the claim too.
  foreach v_key in array p_product_keys loop
    insert into public.entitlements as e
      (uid, product_key, purchase_token, purchase_state, expires_at, updated_at)
    values
      (p_uid, v_key, p_purchase_token, 'active', p_expires_at, now())
    on conflict (uid, product_key)
    do update set
      purchase_state = 'active',
      purchase_token = coalesce(excluded.purchase_token, e.purchase_token),
      expires_at = coalesce(excluded.expires_at, e.expires_at),
      updated_at = now();
    v_activated := array_append(v_activated, v_key);
  end loop;

  return jsonb_build_object(
    'ok', true,
    'claimed', true,
    'activated', to_jsonb(v_activated)
  );
end;
$$;

revoke all on function public.claim_and_grant_entitlements(text, text, text[], timestamptz) from public;
grant execute on function public.claim_and_grant_entitlements(text, text, text[], timestamptz) to service_role;

-- Keep claim_purchase_token and set_entitlement available for any legacy
-- callers / admin tooling, but verify-purchase must use the atomic path.
