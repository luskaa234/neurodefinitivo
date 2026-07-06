-- Agendamento > Reunião com o profissional + migração de status pendente
-- Execute no Supabase SQL Editor.

-- 1) Novo campo para marcar um agendamento como reunião com o profissional
--    (em vez de atendimento clínico com o paciente).
alter table appointments
  add column if not exists is_professional_meeting boolean not null default false;

-- 2) Agendamentos de 2026-07-07 em diante ficam "pendente", aguardando
--    confirmação do profissional responsável. Agendamentos anteriores a essa
--    data não são alterados.
do $$
begin
  update appointments
  set status = 'pendente'
  where date >= '2026-07-07'
    and status <> 'pendente';
exception
  when check_violation then
    -- Neste banco o valor aceito pela constraint é "agendado", não "pendente".
    update appointments
    set status = 'agendado'
    where date >= '2026-07-07'
      and status <> 'agendado';
end $$;

-- 3) Agendamentos FIXOS (is_fixed = true) não têm uma linha por semana futura:
--    o app gera as ocorrências futuras no navegador copiando o status dessa
--    única linha-base, cuja "date" costuma ser antiga (quando a série
--    começou). Por isso o passo 2 sozinho não pega essas séries recorrentes.
--    Aqui forçamos a linha-base também para "pendente", o que faz todas as
--    ocorrências futuras (13/07, 20/07, ...) aparecerem como pendente.
--    Efeito colateral aceito: como só existe 1 linha por série, o status
--    exibido para semanas passadas dessa mesma série também muda para pendente.
do $$
begin
  update appointments
  set status = 'pendente'
  where is_fixed = true
    and status <> 'pendente';
exception
  when check_violation then
    update appointments
    set status = 'agendado'
    where is_fixed = true
      and status <> 'agendado';
end $$;
