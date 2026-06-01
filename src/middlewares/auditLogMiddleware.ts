import type { LogFinanceiroAdministrativo, User } from "@/modules/admin-financeiro/tabela-valores/tabela-valores.types";

export type AuditSink = (log: Omit<LogFinanceiroAdministrativo, "id" | "created_at">) => Promise<void> | void;

export function getClientIp(headers?: Headers | Record<string, string | undefined>) {
  if (!headers) return null;
  const read = (key: string) =>
    headers instanceof Headers ? headers.get(key) : headers[key] || headers[key.toLowerCase()];
  return (
    read("x-forwarded-for")?.split(",")[0]?.trim() ||
    read("x-real-ip") ||
    null
  );
}

export function createAuditLogMiddleware(writeLog: AuditSink) {
  return async function auditLogMiddleware(params: {
    user?: User | null;
    acao: string;
    entidade: string;
    entidade_id?: string | null;
    detalhes?: Record<string, unknown> | null;
    ip?: string | null;
  }) {
    await writeLog({
      usuario_id: params.user?.id ?? null,
      usuario_nome: params.user?.name ?? null,
      acao: params.acao,
      entidade: params.entidade,
      entidade_id: params.entidade_id ?? null,
      detalhes: params.detalhes ?? null,
      ip: params.ip ?? null,
    });
  };
}
