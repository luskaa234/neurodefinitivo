-- Financeiro Administrativo > Tabela de Valores Fixos
-- Execute no Supabase SQL Editor antes de habilitar persistencia em banco.

create extension if not exists pgcrypto;

create table if not exists convenios (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  status text not null default 'ativo' check (status in ('ativo', 'inativo')),
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists especialidades (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  status text not null default 'ativo' check (status in ('ativo', 'inativo')),
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pacientes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  nome text not null,
  documento text,
  status text not null default 'ativo' check (status in ('ativo', 'inativo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tabela_valores (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid references users(id) on delete set null,
  paciente_nome text,
  convenio_id uuid references convenios(id) on delete set null,
  convenio_nome text,
  especialidade_id uuid references especialidades(id) on delete set null,
  especialidade_nome text not null,
  valor_plano numeric(12,2) not null default 0 check (valor_plano >= 0),
  valor_profissional numeric(12,2) not null default 0 check (valor_profissional >= 0),
  percentual_clinica numeric(5,2) not null default 0 check (percentual_clinica between 0 and 100),
  percentual_profissional numeric(5,2) not null default 0 check (percentual_profissional between 0 and 100),
  tipo_calculo text not null default 'fixo' check (tipo_calculo in ('fixo', 'percentual', 'variavel')),
  valor_fixo boolean not null default true,
  status text not null default 'ativo' check (status in ('ativo', 'inativo')),
  observacoes text,
  inconsistencias jsonb not null default '[]'::jsonb,
  origem_importacao text,
  created_by uuid references users(id) on delete set null,
  updated_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tabela_valores_paciente_obrigatorio check (
    valor_fixo = false or paciente_id is not null or nullif(trim(coalesce(paciente_nome, '')), '') is not null
  )
);

create unique index if not exists tabela_valores_unica_ativa_idx
  on tabela_valores (
    coalesce(paciente_id::text, upper(coalesce(paciente_nome, ''))),
    coalesce(convenio_id::text, upper(coalesce(convenio_nome, ''))),
    coalesce(especialidade_id::text, upper(especialidade_nome))
  )
  where status = 'ativo';

create index if not exists tabela_valores_paciente_idx on tabela_valores(paciente_id);
create index if not exists tabela_valores_convenio_idx on tabela_valores(convenio_id);
create index if not exists tabela_valores_especialidade_idx on tabela_valores(especialidade_id);
create index if not exists tabela_valores_status_idx on tabela_valores(status);

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where constraint_name = 'tabela_valores_paciente_id_fkey'
      and table_name = 'tabela_valores'
  ) then
    alter table tabela_valores drop constraint tabela_valores_paciente_id_fkey;
  end if;

  alter table tabela_valores
    add constraint tabela_valores_paciente_id_fkey
    foreign key (paciente_id) references users(id) on delete set null;
exception
  when duplicate_object then null;
end $$;

create table if not exists historico_tabela_valores (
  id uuid primary key default gen_random_uuid(),
  tabela_valor_id uuid not null references tabela_valores(id) on delete cascade,
  campo_alterado text not null,
  valor_anterior jsonb,
  valor_novo jsonb,
  motivo text,
  usuario_id uuid references users(id) on delete set null,
  usuario_nome text,
  ip inet,
  created_at timestamptz not null default now()
);

create index if not exists historico_tabela_valores_item_idx
  on historico_tabela_valores(tabela_valor_id, created_at desc);

create table if not exists logs_financeiros_administrativos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references users(id) on delete set null,
  usuario_nome text,
  acao text not null,
  entidade text not null,
  entidade_id uuid,
  detalhes jsonb,
  ip inet,
  created_at timestamptz not null default now()
);

create index if not exists logs_financeiros_administrativos_idx
  on logs_financeiros_administrativos(entidade, entidade_id, created_at desc);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_tabela_valores_updated_at on tabela_valores;
create trigger set_tabela_valores_updated_at
before update on tabela_valores
for each row execute function set_updated_at();

create or replace function registrar_historico_tabela_valores()
returns trigger
language plpgsql
as $$
declare
  campo text;
  antigo jsonb;
  novo jsonb;
begin
  foreach campo in array array[
    'paciente_id','paciente_nome','convenio_id','convenio_nome','especialidade_id',
    'especialidade_nome','valor_plano','valor_profissional','percentual_clinica',
    'percentual_profissional','tipo_calculo','valor_fixo','status','observacoes'
  ]
  loop
    antigo := to_jsonb(old) -> campo;
    novo := to_jsonb(new) -> campo;
    if antigo is distinct from novo then
      insert into historico_tabela_valores (
        tabela_valor_id, campo_alterado, valor_anterior, valor_novo, usuario_id
      )
      values (new.id, campo, antigo, novo, new.updated_by);
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists historico_tabela_valores_update on tabela_valores;
create trigger historico_tabela_valores_update
after update on tabela_valores
for each row execute function registrar_historico_tabela_valores();

alter table tabela_valores enable row level security;
alter table historico_tabela_valores enable row level security;
alter table logs_financeiros_administrativos enable row level security;

-- Ajuste as policies ao seu modelo de auth. O app atual usa users.role = 'admin'.
drop policy if exists "admin_select_tabela_valores" on tabela_valores;
create policy "admin_select_tabela_valores" on tabela_valores
for select using (true);

drop policy if exists "admin_write_tabela_valores" on tabela_valores;
create policy "admin_write_tabela_valores" on tabela_valores
for all using (true) with check (true);

drop policy if exists "admin_select_historico_tabela_valores" on historico_tabela_valores;
create policy "admin_select_historico_tabela_valores" on historico_tabela_valores
for select using (true);

drop policy if exists "admin_write_historico_tabela_valores" on historico_tabela_valores;
create policy "admin_write_historico_tabela_valores" on historico_tabela_valores
for all using (true) with check (true);

drop policy if exists "admin_select_logs_financeiros_administrativos" on logs_financeiros_administrativos;
create policy "admin_select_logs_financeiros_administrativos" on logs_financeiros_administrativos
for select using (true);

drop policy if exists "admin_write_logs_financeiros_administrativos" on logs_financeiros_administrativos;
create policy "admin_write_logs_financeiros_administrativos" on logs_financeiros_administrativos
for all using (true) with check (true);
