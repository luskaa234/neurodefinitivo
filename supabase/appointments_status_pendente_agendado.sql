-- Permite que agendamentos sejam mantidos como pendente por padrao,
-- mas tambem possam ser alterados manualmente para agendado/cancelado.
-- Execute no Supabase SQL Editor.

alter table appointments
  drop constraint if exists appointments_status_check;

alter table appointments
  add constraint appointments_status_check
  check (status in ('pendente', 'agendado', 'confirmado', 'cancelado', 'realizado'));

alter table appointments
  alter column status set default 'pendente';
