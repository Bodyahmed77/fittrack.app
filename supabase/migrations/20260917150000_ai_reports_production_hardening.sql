-- AI report operational hardening.
-- Keep user-submitted reports service-role only while giving the admin side
-- enough metadata to triage, review, and audit reports safely.

alter table public.ai_reports
  add column if not exists status text not null default 'open',
  add column if not exists model text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by text;

alter table public.ai_reports
  drop constraint if exists ai_reports_status_check;

alter table public.ai_reports
  add constraint ai_reports_status_check
  check (status = any (array['open'::text, 'reviewed'::text, 'dismissed'::text]));

create index if not exists ai_reports_status_created_at_idx
  on public.ai_reports (status, created_at desc);

create index if not exists ai_reports_uid_created_at_idx
  on public.ai_reports (uid, created_at desc);

revoke all on public.ai_reports from public, anon, authenticated;
