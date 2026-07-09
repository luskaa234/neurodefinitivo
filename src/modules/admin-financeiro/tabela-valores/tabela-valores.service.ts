import { supabase } from "@/lib/supabase";
import { requireAdmin } from "@/middlewares/requireAdmin";
import type {
  AtualizarTabelaValorDTO,
  CriarTabelaValorDTO,
  FiltrosTabelaValorDTO,
  HistoricoTabelaValor,
  ResultadoImportacaoTabelaValores,
  TabelaValor,
  User,
} from "./tabela-valores.types";

const STORAGE_KEY = "admin-financeiro-tabela-valores-v1";
const HISTORY_KEY = "admin-financeiro-tabela-valores-historico-v1";
const LOG_KEY = "admin-financeiro-tabela-valores-logs-v1";

const ESPECIALIDADES = [
  "FONO",
  "FISIO",
  "T.O",
  "PSICOLOGIA",
  "PSICOPEDAGOGIA",
  "MUSICA",
  "NEUROPSICOLOGA",
];

const CONVENIOS = [
  "UNIMED TERESINA",
  "UNIMED SEGUROS",
  "UNIMED MARANHAO",
  "UNIMED SAO PAULO",
  "UNIMED FORTALEZA",
  "SULA AMERICA",
  "HUMANA SAUDE",
  "FINAL DE MES",
];

const nowIso = () => new Date().toISOString();

// Postgrest errors that make it to the server (RLS rejection, check constraint,
// unique index, etc.) carry a `code`/`details`/`hint`. Only bare network failures
// (no such fields) should fall back to the local cache — otherwise a rejected
// write gets swallowed, the UI reports "saved", and the next reload silently
// overwrites the local fallback with the untouched remote row.
const isOfflineError = (error: any) => {
  if (!error) return false;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  if (error.code || error.details || error.hint) return false;
  return error instanceof TypeError || /failed to fetch|networkerror/i.test(String(error?.message || ""));
};

const normalizeText = (value?: string | null) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

const duplicateKeyForTabelaValor = (item: Partial<TabelaValor>) =>
  [
    normalizeText(item.paciente_id || item.paciente_nome || ""),
    normalizeText(item.convenio_id || item.convenio_nome || ""),
    normalizeText(item.especialidade_id || item.especialidade_nome || ""),
    Number(item.valor_plano || 0).toFixed(2),
    Number(item.valor_profissional || 0).toFixed(2),
  ].join("|");

const sortCanonicalFirst = (a: TabelaValor, b: TabelaValor) => {
  if (a.status === "ativo" && b.status !== "ativo") return -1;
  if (a.status !== "ativo" && b.status === "ativo") return 1;
  return new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime();
};

const parseMoney = (value: unknown) => {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  const normalized = raw
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseExpressionAmount = (value: string) => {
  const raw = String(value || "").trim();
  const expression = raw.includes("=") ? raw.split("=").pop() || "" : raw;
  if (expression.includes("+")) {
    return expression
      .split("+")
      .map((part) => parseMoney(part))
      .reduce((sum, item) => sum + item, 0);
  }
  return parseMoney(expression);
};

const calcularPercentuaisPorValores = (valorPlano: number, valorProfissional: number) => {
  const valorClinica = Number(Math.max(0, valorPlano - valorProfissional).toFixed(2));
  return {
    percentual_clinica: valorPlano > 0 ? Number(((valorClinica / valorPlano) * 100).toFixed(2)) : 0,
    percentual_profissional: valorPlano > 0 ? Number(((valorProfissional / valorPlano) * 100).toFixed(2)) : 0,
  };
};

const normalizarPercentuais = <T extends Partial<TabelaValor | CriarTabelaValorDTO>>(item: T): T => {
  const valorPlano = Number(item.valor_plano) || 0;
  const valorProfissional = Number(item.valor_profissional) || 0;
  return {
    ...item,
    ...calcularPercentuaisPorValores(valorPlano, valorProfissional),
  };
};

const safeJsonRead = <T>(key: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const safeJsonWrite = (key: string, value: unknown) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
};

const toTabelaValorDbPayload = (item: Partial<TabelaValor | CriarTabelaValorDTO>, user?: User) => ({
  id: (item as Partial<TabelaValor>).id,
  paciente_id: item.paciente_id ?? null,
  paciente_nome: item.paciente_nome ?? null,
  convenio_id: item.convenio_id ?? null,
  convenio_nome: item.convenio_nome ?? null,
  especialidade_id: item.especialidade_id ?? null,
  especialidade_nome: item.especialidade_nome || "",
  valor_plano: Number(item.valor_plano) || 0,
  valor_profissional: Number(item.valor_profissional) || 0,
  percentual_clinica: Number(item.percentual_clinica) || 0,
  percentual_profissional: Number(item.percentual_profissional) || 0,
  tipo_calculo: item.tipo_calculo || "fixo",
  valor_fixo: item.valor_fixo !== false,
  status: item.status || "ativo",
  observacoes: item.observacoes ?? null,
  inconsistencias: (item as Partial<TabelaValor>).inconsistencias || [],
  origem_importacao: item.origem_importacao ?? null,
  created_by: (item as Partial<TabelaValor>).created_by || user?.id || null,
  updated_by: user?.id || (item as Partial<TabelaValor>).updated_by || null,
});

const removeUndefined = <T extends Record<string, unknown>>(payload: T) =>
  Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined)) as T;

const syncLocalTabelaValoresToSupabase = async (user: User) => {
  const localRows = safeJsonRead<TabelaValor[]>(STORAGE_KEY, []);
  if (!localRows.length) return;
  const payload = localRows.map((item) => removeUndefined(toTabelaValorDbPayload(item, user)));
  const { error } = await supabase.from("tabela_valores").upsert(payload, { onConflict: "id" });
  if (!error) return;
  throw error;
};

export function validarTabelaValor(
  data: CriarTabelaValorDTO | AtualizarTabelaValorDTO,
  existing: TabelaValor[] = [],
  editingId?: string
) {
  const errors: string[] = [];
  const valorPlano = Number(data.valor_plano ?? 0);
  const valorProfissional = Number(data.valor_profissional ?? 0);
  const percentualClinica = Number(data.percentual_clinica ?? 0);
  const percentualProfissional = Number(data.percentual_profissional ?? 0);

  if (valorPlano < 0) errors.push("valor_plano não pode ser negativo.");
  if (valorProfissional < 0) errors.push("valor_profissional não pode ser negativo.");
  if (percentualClinica < 0 || percentualClinica > 100) {
    errors.push("percentual_clinica deve estar entre 0 e 100.");
  }
  if (percentualProfissional < 0 || percentualProfissional > 100) {
    errors.push("percentual_profissional deve estar entre 0 e 100.");
  }
  if (data.valor_fixo && !data.paciente_id && !data.paciente_nome) {
    errors.push("paciente é obrigatório quando o valor for específico.");
  }
  if (!data.especialidade_id && !data.especialidade_nome) {
    errors.push("especialidade é obrigatória.");
  }

  const pacienteKey = normalizeText(data.paciente_id || data.paciente_nome || "");
  const convenioKey = normalizeText(data.convenio_id || data.convenio_nome || "");
  const especialidadeKey = normalizeText(data.especialidade_id || data.especialidade_nome || "");
  const duplicated = existing.some((item) => {
    if (item.id === editingId || item.status !== "ativo") return false;
    return (
      normalizeText(item.paciente_id || item.paciente_nome || "") === pacienteKey &&
      normalizeText(item.convenio_id || item.convenio_nome || "") === convenioKey &&
      normalizeText(item.especialidade_id || item.especialidade_nome || "") === especialidadeKey
    );
  });
  if (duplicated) {
    errors.push("Já existe valor ativo para o mesmo paciente + convênio + especialidade.");
  }

  return errors;
}

export function analisarTextoTabelaValores(texto: string): ResultadoImportacaoTabelaValores {
  const linhas = texto
    .split(/\r?\n|`n/g)
    .map((line) => line.trim())
    .filter(Boolean);
  const registros: CriarTabelaValorDTO[] = [];
  const repetidos: string[] = [];
  const incompletos: string[] = [];
  const inconsistencias: string[] = [];
  const vistos = new Set<string>();
  let pacienteAtual = "";
  let convenioAtual = "";
  let especialidadeAtual = "";
  let ultimoValorPlano = 0;
  let totalPendente: number | null = null;
  let profissionalPendente: number | null = null;

  for (const linha of linhas) {
    const normal = normalizeText(linha);
    const isConvenio = CONVENIOS.some((item) => normal.includes(item));
    const isEspecialidade = ESPECIALIDADES.includes(normal) || normal.includes("PSICOPEGAGOGIA");
    const moneyMatches = linha.match(/\d{2,3}(?:[,.]\d{1,3})?/g) || [];
    const afterColon = linha.includes(":") ? linha.split(":").slice(1).join(":") : linha;

    if (isConvenio) {
      convenioAtual = linha.replace(/\(.*?\)/g, "").replace(/-+/g, " ").trim();
      continue;
    }

    if (isEspecialidade) {
      especialidadeAtual = normal.replace("PSICOPEGAGOGIA", "PSICOPEDAGOGIA");
      continue;
    }

    if (normal.includes("TOTAL") && moneyMatches.length) {
      totalPendente = parseMoney(linha);
      continue;
    }

    if (normal.includes("70%")) {
      profissionalPendente = parseExpressionAmount(afterColon);
      continue;
    }

    if (normal.includes("30%")) {
      const valorClinica = parseExpressionAmount(afterColon);
      if (profissionalPendente != null && pacienteAtual && especialidadeAtual) {
        const total = totalPendente ?? Number((profissionalPendente + valorClinica).toFixed(2));
        if (totalPendente != null && Math.abs(totalPendente - (profissionalPendente + valorClinica)) > 0.01) {
          inconsistencias.push(
            `Divisão não fecha com o total para ${pacienteAtual}: total ${totalPendente}, profissional ${profissionalPendente}, clínica ${valorClinica}.`
          );
        }
        const key = `${normalizeText(pacienteAtual)}|${normalizeText(convenioAtual)}|${especialidadeAtual}|${total}`;
        if (vistos.has(key)) {
          repetidos.push(`${pacienteAtual} - ${especialidadeAtual} - ${total}`);
        } else {
          vistos.add(key);
          ultimoValorPlano = total;
          registros.push({
            paciente_nome: pacienteAtual,
            convenio_nome: convenioAtual || "Particular/Plano não informado",
            especialidade_nome: especialidadeAtual,
            valor_plano: total,
            valor_profissional: profissionalPendente,
            ...calcularPercentuaisPorValores(total, profissionalPendente),
            tipo_calculo: "fixo",
            valor_fixo: true,
            status: "ativo",
            observacoes: "Importado do arquivo LISTA DE PACIENTES E VALORES.docx. Valores conforme documento original (plano/profissional/clínica).",
            origem_importacao: "docx_lista_pacientes_valores",
          });
        }
      } else {
        inconsistencias.push(`Divisão 30% encontrada sem paciente/especialidade ou valor profissional correspondente: ${linha}`);
      }
      totalPendente = null;
      profissionalPendente = null;
      continue;
    }

    if (moneyMatches.length) {
      const valores = moneyMatches.map(parseMoney).filter((value) => value > 0);
      valores.forEach((valor, index) => {
        if (!pacienteAtual || !especialidadeAtual) {
          incompletos.push(`${linha} sem paciente ou especialidade vinculada.`);
          return;
        }
        const key = `${normalizeText(pacienteAtual)}|${normalizeText(convenioAtual)}|${especialidadeAtual}|${valor}|${index}`;
        if (vistos.has(key)) {
          repetidos.push(`${pacienteAtual} - ${especialidadeAtual} - ${valor}`);
          return;
        }
        vistos.add(key);
        ultimoValorPlano = valor;
        registros.push({
          paciente_nome: pacienteAtual,
          convenio_nome: convenioAtual || "Particular/Plano não informado",
          especialidade_nome: especialidadeAtual,
          valor_plano: valor,
          valor_profissional: valor,
          percentual_clinica: 0,
          percentual_profissional: 100,
          tipo_calculo: "fixo",
          valor_fixo: true,
          status: "ativo",
          observacoes: "Importado do arquivo LISTA DE PACIENTES E VALORES.docx. Defina o valor da clínica manualmente. Conferir registros com valores repetidos ou sem convênio.",
          origem_importacao: "docx_lista_pacientes_valores",
        });
      });
      continue;
    }

    if (!normal.includes("NOME DO PACIENTE") && !normal.includes("PLANO") && normal.length > 2) {
      pacienteAtual = linha;
    }
  }

  return {
    total_linhas: linhas.length,
    registros_criados: registros,
    repetidos,
    incompletos,
    inconsistencias,
    especialidades: Array.from(new Set(registros.map((item) => item.especialidade_nome))).sort(),
    convenios: Array.from(new Set(registros.map((item) => item.convenio_nome || ""))).filter(Boolean).sort(),
  };
}

export const tabelaValoresService = {
  async listarValores(user: User, filtros: FiltrosTabelaValorDTO = {}): Promise<TabelaValor[]> {
    requireAdmin(user);
    let rows: TabelaValor[] = [];
    try {
      await syncLocalTabelaValoresToSupabase(user).catch(() => undefined);
      const { data, error } = await supabase.from("tabela_valores").select("*").order("updated_at", { ascending: false });
      if (!error && data) {
        rows = data as TabelaValor[];
        safeJsonWrite(STORAGE_KEY, rows);
      }
    } catch {
      rows = safeJsonRead<TabelaValor[]>(STORAGE_KEY, []);
    }
    if (!rows.length) rows = safeJsonRead<TabelaValor[]>(STORAGE_KEY, []);
    return rows.filter((item) => {
      const busca = normalizeText(filtros.busca);
      const matchesBusca = !busca || normalizeText(`${item.paciente_nome} ${item.convenio_nome} ${item.especialidade_nome}`).includes(busca);
      const matchesPaciente = !filtros.paciente || normalizeText(item.paciente_nome).includes(normalizeText(filtros.paciente));
      const matchesConvenio = !filtros.convenio || normalizeText(item.convenio_nome).includes(normalizeText(filtros.convenio));
      const matchesEspecialidade = !filtros.especialidade || normalizeText(item.especialidade_nome).includes(normalizeText(filtros.especialidade));
      const matchesStatus = !filtros.status || filtros.status === "todos" || item.status === filtros.status;
      return matchesBusca && matchesPaciente && matchesConvenio && matchesEspecialidade && matchesStatus;
    });
  },

  async buscarValorPorId(user: User, id: string) {
    const rows = await this.listarValores(user);
    return rows.find((item) => item.id === id) || null;
  },

  async criarValor(user: User, dto: CriarTabelaValorDTO): Promise<TabelaValor> {
    requireAdmin(user);
    const rows = await this.listarValores(user);
    const normalizedDto = normalizarPercentuais(dto);
    const errors = validarTabelaValor(normalizedDto, rows);
    if (errors.length) throw new Error(errors.join(" "));
    const item: TabelaValor = {
      id: crypto.randomUUID(),
      paciente_id: normalizedDto.paciente_id ?? null,
      paciente_nome: normalizedDto.paciente_nome ?? null,
      convenio_id: normalizedDto.convenio_id ?? null,
      convenio_nome: normalizedDto.convenio_nome ?? null,
      especialidade_id: normalizedDto.especialidade_id ?? null,
      especialidade_nome: normalizedDto.especialidade_nome,
      valor_plano: Number(normalizedDto.valor_plano) || 0,
      valor_profissional: Number(normalizedDto.valor_profissional) || 0,
      percentual_clinica: Number(normalizedDto.percentual_clinica) || 0,
      percentual_profissional: Number(normalizedDto.percentual_profissional) || 0,
      tipo_calculo: normalizedDto.tipo_calculo || "fixo",
      valor_fixo: normalizedDto.valor_fixo !== false,
      status: normalizedDto.status || "ativo",
      observacoes: normalizedDto.observacoes ?? null,
      inconsistencias: [],
      origem_importacao: normalizedDto.origem_importacao ?? null,
      created_at: nowIso(),
      updated_at: nowIso(),
      created_by: user.id,
      updated_by: user.id,
    };
    try {
      const { data, error } = await supabase
        .from("tabela_valores")
        .insert(removeUndefined(toTabelaValorDbPayload(item, user)))
        .select("*")
        .single();
      if (error) throw error;
      const saved = data as TabelaValor;
      safeJsonWrite(STORAGE_KEY, [saved, ...rows.filter((row) => row.id !== saved.id)]);
      return saved;
    } catch (error: any) {
      if (!isOfflineError(error)) throw error;
      console.warn("Falha ao salvar tabela_valores no Supabase, usando fallback local:", error?.message || error);
    }
    safeJsonWrite(STORAGE_KEY, [item, ...rows]);
    return item;
  },

  async editarValorCompleto(user: User, id: string, dto: AtualizarTabelaValorDTO): Promise<TabelaValor> {
    requireAdmin(user);
    const rows = await this.listarValores(user);
    const current = rows.find((item) => item.id === id);
    if (!current) throw new Error("Valor não encontrado.");
    const { motivo_alteracao: _motivo, ...patch } = dto;
    const normalizedPatch = normalizarPercentuais({ ...current, ...patch });
    const next = { ...current, ...normalizedPatch, updated_at: nowIso(), updated_by: user.id } as TabelaValor;
    const errors = validarTabelaValor(next, rows, id);
    if (errors.length) throw new Error(errors.join(" "));
    const history = safeJsonRead<HistoricoTabelaValor[]>(HISTORY_KEY, []);
    const changes = Object.entries(dto)
      .filter(([key]) => key !== "motivo_alteracao")
      .filter(([key, value]) => JSON.stringify((current as any)[key]) !== JSON.stringify(value))
      .map(([key, value]) => ({
        id: crypto.randomUUID(),
        tabela_valor_id: id,
        campo_alterado: key,
        valor_anterior: JSON.stringify((current as any)[key] ?? null),
        valor_novo: JSON.stringify(value ?? null),
        motivo: dto.motivo_alteracao || null,
        usuario_id: user.id,
        usuario_nome: user.name,
        ip: null,
        created_at: nowIso(),
      }));
    safeJsonWrite(HISTORY_KEY, [...changes, ...history]);
    try {
      const { data, error } = await supabase
        .from("tabela_valores")
        .update(removeUndefined(toTabelaValorDbPayload(next, user)))
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      const saved = data as TabelaValor;
      safeJsonWrite(STORAGE_KEY, rows.map((item) => (item.id === id ? saved : item)));
      if (changes.length) {
        try {
          await supabase.from("historico_tabela_valores").insert(
            changes.map((change) => ({
              tabela_valor_id: id,
              campo_alterado: change.campo_alterado,
              valor_anterior: change.valor_anterior ? JSON.parse(change.valor_anterior) : null,
              valor_novo: change.valor_novo ? JSON.parse(change.valor_novo) : null,
              motivo: change.motivo,
              usuario_id: user.id,
              usuario_nome: user.name,
            }))
          );
        } catch {
          // O histórico local já foi gravado; falha remota não deve impedir o salvamento principal.
        }
      }
      return saved;
    } catch (error: any) {
      if (!isOfflineError(error)) throw error;
      console.warn("Falha ao atualizar tabela_valores no Supabase, usando fallback local:", error?.message || error);
    }
    safeJsonWrite(STORAGE_KEY, rows.map((item) => (item.id === id ? next : item)));
    return next;
  },

  async alterarStatus(user: User, id: string, status: "ativo" | "inativo", motivo?: string) {
    return this.editarValorCompleto(user, id, { status, motivo_alteracao: motivo || "Alteração de status" });
  },

  async inativarValor(user: User, id: string, motivo?: string) {
    return this.alterarStatus(user, id, "inativo", motivo || "Inativação segura");
  },

  async buscarHistorico(user: User, id: string): Promise<HistoricoTabelaValor[]> {
    requireAdmin(user);
    try {
      const { data, error } = await supabase
        .from("historico_tabela_valores")
        .select("*")
        .eq("tabela_valor_id", id)
        .order("created_at", { ascending: false });
      if (!error && data) {
        return (data as any[]).map((item) => ({
          ...item,
          valor_anterior: item.valor_anterior == null ? null : JSON.stringify(item.valor_anterior),
          valor_novo: item.valor_novo == null ? null : JSON.stringify(item.valor_novo),
        })) as HistoricoTabelaValor[];
      }
    } catch {
      // fallback below
    }
    return safeJsonRead<HistoricoTabelaValor[]>(HISTORY_KEY, []).filter((item) => item.tabela_valor_id === id);
  },

  async importarValoresDoArquivo(user: User, conteudo: string) {
    requireAdmin(user);
    const resultado = analisarTextoTabelaValores(conteudo);
    const rows = await this.listarValores(user);
    const created = resultado.registros_criados.map((dto) => {
      const normalizedDto = normalizarPercentuais(dto);
      return {
        id: crypto.randomUUID(),
        ...normalizedDto,
        paciente_id: normalizedDto.paciente_id ?? null,
        convenio_id: normalizedDto.convenio_id ?? null,
        especialidade_id: normalizedDto.especialidade_id ?? null,
        status: normalizedDto.status || "ativo",
        inconsistencias: [],
        created_at: nowIso(),
        updated_at: nowIso(),
        created_by: user.id,
        updated_by: user.id,
      };
    }) as TabelaValor[];
    if (created.length) {
      try {
        const { data, error } = await supabase
          .from("tabela_valores")
          .upsert(created.map((item) => removeUndefined(toTabelaValorDbPayload(item, user))), { onConflict: "id" })
          .select("*");
        if (error) throw error;
        const saved = (data || []) as TabelaValor[];
        safeJsonWrite(STORAGE_KEY, [...saved, ...rows.filter((row) => !saved.some((item) => item.id === row.id))]);
        return resultado;
      } catch (error: any) {
        console.warn("Falha ao importar tabela_valores no Supabase, usando fallback local:", error?.message || error);
      }
    }
    safeJsonWrite(STORAGE_KEY, [...created, ...rows]);
    return resultado;
  },

  async exportarValores(user: User) {
    const rows = await this.listarValores(user);
    const header = ["paciente", "convenio", "especialidade", "valor_plano", "valor_profissional", "percentual_clinica", "percentual_profissional", "status"];
    const body = rows.map((item) =>
      [item.paciente_nome, item.convenio_nome, item.especialidade_nome, item.valor_plano, item.valor_profissional, item.percentual_clinica, item.percentual_profissional, item.status]
        .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
        .join(",")
    );
    return [header.join(","), ...body].join("\n");
  },

  async removerDuplicados(user: User) {
    requireAdmin(user);
    const localRows = safeJsonRead<TabelaValor[]>(STORAGE_KEY, []);
    const localGroups = new Map<string, TabelaValor[]>();
    localRows.forEach((item) => {
      const key = duplicateKeyForTabelaValor(item);
      const list = localGroups.get(key) || [];
      list.push(item);
      localGroups.set(key, list);
    });

    const localDuplicatedIds = new Set<string>();
    const localCleanRows: TabelaValor[] = [];
    localGroups.forEach((list) => {
      const sorted = list.slice().sort(sortCanonicalFirst);
      localCleanRows.push(sorted[0]);
      sorted.slice(1).forEach((item) => localDuplicatedIds.add(item.id));
    });
    if (localRows.length) {
      safeJsonWrite(
        STORAGE_KEY,
        localCleanRows.sort(sortCanonicalFirst)
      );
    }

    let remoteRemoved = 0;
    try {
      const { data, error } = await supabase.from("tabela_valores").select("*");
      if (error) throw error;
      const remoteRows = (data || []) as TabelaValor[];
      const remoteGroups = new Map<string, TabelaValor[]>();
      remoteRows.forEach((item) => {
        const key = duplicateKeyForTabelaValor(item);
        const list = remoteGroups.get(key) || [];
        list.push(item);
        remoteGroups.set(key, list);
      });
      const remoteDuplicateIds: string[] = [];
      remoteGroups.forEach((list) => {
        const sorted = list.slice().sort(sortCanonicalFirst);
        remoteDuplicateIds.push(...sorted.slice(1).map((item) => item.id));
      });
      if (remoteDuplicateIds.length) {
        const { error: deleteError } = await supabase
          .from("tabela_valores")
          .delete()
          .in("id", remoteDuplicateIds);
        if (deleteError) throw deleteError;
        remoteRemoved = remoteDuplicateIds.length;
      }
    } catch {
      // The local cleanup still keeps the interface organized when the migration
      // has not been applied or Supabase rejects direct deletes.
    }

    return {
      localRemoved: localDuplicatedIds.size,
      remoteRemoved,
      totalRemoved: localDuplicatedIds.size + remoteRemoved,
    };
  },
};
