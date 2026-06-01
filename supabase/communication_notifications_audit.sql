-- Comunicação, notificações internas e auditoria
-- Execute no Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references users(id) on delete set null,
  patient_name text not null,
  responsible_name text,
  phone text not null,
  message text not null,
  message_type text not null check (
    message_type in (
      'appointment.created',
      'appointment.cancelled',
      'appointment.rescheduled',
      'appointment.reminder',
      'appointment.confirmation',
      'patient.absent',
      'payment.pending',
      'payment.confirmed',
      'manual'
    )
  ),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'cancelled', 'deleted', 'restored')),
  api_response jsonb,
  attempts integer not null default 0 check (attempts >= 0),
  user_id uuid references users(id) on delete set null,
  user_name text,
  appointment_id uuid references appointments(id) on delete set null,
  financial_record_id uuid references financial_records(id) on delete set null,
  deleted_at timestamptz,
  restored_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists whatsapp_messages_patient_idx on whatsapp_messages(patient_id, created_at desc);
create index if not exists whatsapp_messages_phone_idx on whatsapp_messages(phone);
create index if not exists whatsapp_messages_status_idx on whatsapp_messages(status);
create index if not exists whatsapp_messages_type_idx on whatsapp_messages(message_type);
create index if not exists whatsapp_messages_created_idx on whatsapp_messages(created_at desc);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  user_name text,
  action text not null,
  entity text not null,
  entity_id text,
  old_value jsonb,
  new_value jsonb,
  ip inet,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_entity_idx on audit_logs(entity, entity_id, created_at desc);
create index if not exists audit_logs_user_idx on audit_logs(user_id, created_at desc);

create table if not exists internal_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null,
  entity text,
  entity_id text,
  read_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists internal_notifications_user_idx
  on internal_notifications(user_id, read_at, created_at desc)
  where deleted_at is null;

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_whatsapp_messages_updated_at on whatsapp_messages;
create trigger set_whatsapp_messages_updated_at
before update on whatsapp_messages
for each row execute function set_updated_at();

alter table whatsapp_messages enable row level security;
alter table audit_logs enable row level security;
alter table internal_notifications enable row level security;

drop policy if exists "allow_whatsapp_messages_all" on whatsapp_messages;
create policy "allow_whatsapp_messages_all" on whatsapp_messages
for all using (true) with check (true);

drop policy if exists "allow_audit_logs_all" on audit_logs;
create policy "allow_audit_logs_all" on audit_logs
for all using (true) with check (true);

drop policy if exists "allow_internal_notifications_all" on internal_notifications;
create policy "allow_internal_notifications_all" on internal_notifications
for all using (true) with check (true);
