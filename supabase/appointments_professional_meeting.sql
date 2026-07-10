-- Agendamento > reuniao com o profissional + status pendente a partir de 10/07/2026
-- Execute no Supabase SQL Editor.

-- 1) Novo campo para marcar um agendamento como reuniao com o profissional
--    (em vez de atendimento clinico com o paciente).
alter table appointments
  add column if not exists is_professional_meeting boolean not null default false;

-- 2) Somente agendamentos de 2026-07-10 em diante ficam "pendente".
--    Agendamentos anteriores a 2026-07-10 nao sao alterados.
do $$
begin
  update appointments
  set status = 'pendente'
  where date >= '2026-07-10'
    and status <> 'pendente';
exception
  when check_violation then
    -- Alguns bancos antigos aceitavam "agendado" no lugar de "pendente".
    update appointments
    set status = 'agendado'
    where date >= '2026-07-10'
      and status <> 'agendado';
end $$;

-- Observacao sobre agendamentos fixos:
-- series fixas geralmente possuem uma unica linha-base antiga e o app gera
-- as ocorrencias futuras no navegador. Para preservar datas anteriores, a
-- linha-base antiga nao deve ser alterada aqui. O app exibe as ocorrencias
-- virtuais de 2026-07-10 em diante como pendentes sem mudar o historico.
