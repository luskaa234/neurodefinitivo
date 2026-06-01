export type NivelAcesso = "ADMIN" | "FINANCEIRO" | "RECEPCAO" | "PROFISSIONAL";
export type UserRole = "admin" | "financeiro" | "agendamento" | "medico" | "paciente";
export type TabelaValorStatus = "ativo" | "inativo";
export type TipoCalculoTabelaValor = "fixo" | "percentual" | "variavel";

export interface User {
  id: string;
  name: string;
  email: string;
  role?: UserRole;
  nivel_acesso?: NivelAcesso;
  is_active?: boolean;
}

export interface Paciente {
  id: string;
  nome: string;
  documento?: string | null;
  status?: TabelaValorStatus;
}

export interface Convenio {
  id: string;
  nome: string;
  status: TabelaValorStatus;
}

export interface Especialidade {
  id: string;
  nome: string;
  status: TabelaValorStatus;
}

export interface TabelaValor {
  id: string;
  paciente_id?: string | null;
  paciente_nome?: string | null;
  convenio_id?: string | null;
  convenio_nome?: string | null;
  especialidade_id?: string | null;
  especialidade_nome: string;
  valor_plano: number;
  valor_profissional: number;
  percentual_clinica: number;
  percentual_profissional: number;
  tipo_calculo: TipoCalculoTabelaValor;
  valor_fixo: boolean;
  status: TabelaValorStatus;
  observacoes?: string | null;
  inconsistencias?: string[];
  origem_importacao?: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
}

export interface HistoricoTabelaValor {
  id: string;
  tabela_valor_id: string;
  campo_alterado: string;
  valor_anterior: string | null;
  valor_novo: string | null;
  motivo?: string | null;
  usuario_id?: string | null;
  usuario_nome?: string | null;
  ip?: string | null;
  created_at: string;
}

export interface LogFinanceiroAdministrativo {
  id: string;
  usuario_id?: string | null;
  usuario_nome?: string | null;
  acao: string;
  entidade: string;
  entidade_id?: string | null;
  detalhes?: Record<string, unknown> | null;
  ip?: string | null;
  created_at: string;
}

export interface CriarTabelaValorDTO {
  paciente_id?: string | null;
  paciente_nome?: string | null;
  convenio_id?: string | null;
  convenio_nome?: string | null;
  especialidade_id?: string | null;
  especialidade_nome: string;
  valor_plano: number;
  valor_profissional: number;
  percentual_clinica?: number;
  percentual_profissional?: number;
  tipo_calculo?: TipoCalculoTabelaValor;
  valor_fixo?: boolean;
  status?: TabelaValorStatus;
  observacoes?: string | null;
  origem_importacao?: string | null;
}

export interface AtualizarTabelaValorDTO extends Partial<CriarTabelaValorDTO> {
  motivo_alteracao?: string;
}

export interface FiltrosTabelaValorDTO {
  paciente?: string;
  convenio?: string;
  especialidade?: string;
  status?: "todos" | TabelaValorStatus;
  busca?: string;
}

export interface ResultadoImportacaoTabelaValores {
  total_linhas: number;
  registros_criados: CriarTabelaValorDTO[];
  repetidos: string[];
  incompletos: string[];
  inconsistencias: string[];
  especialidades: string[];
  convenios: string[];
}
