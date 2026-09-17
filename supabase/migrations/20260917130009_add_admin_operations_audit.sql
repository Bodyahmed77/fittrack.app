create table if not exists public.admin_audit_log (
  id bigserial primary key,
  admin_uid text not null,
  action text not null,
  target_type text not null,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_at_idx
  on public.admin_audit_log (created_at desc);
create index if not exists admin_audit_log_admin_uid_idx
  on public.admin_audit_log (admin_uid, created_at desc);
create index if not exists admin_audit_log_target_idx
  on public.admin_audit_log (target_type, target_id, created_at desc);

alter table public.admin_audit_log enable row level security;

revoke all on table public.admin_audit_log from public, anon, authenticated;
revoke all on sequence public.admin_audit_log_id_seq from public, anon, authenticated;
grant all on table public.admin_audit_log to service_role;
grant all on sequence public.admin_audit_log_id_seq to service_role;
