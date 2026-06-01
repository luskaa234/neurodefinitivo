import type { User } from "@/modules/admin-financeiro/tabela-valores/tabela-valores.types";

export function getNivelAcesso(user?: User | null) {
  if (!user) return null;
  if (user.nivel_acesso) return user.nivel_acesso;
  if (user.role === "admin") return "ADMIN";
  if (user.role === "financeiro") return "FINANCEIRO";
  if (user.role === "agendamento") return "RECEPCAO";
  if (user.role === "medico") return "PROFISSIONAL";
  return null;
}

export function authMiddleware(user?: User | null): asserts user is User {
  if (!user?.id) {
    throw new Error("Usuário não autenticado.");
  }
}

export function bloquearFinanceiroOperacional(user?: User | null) {
  const nivel = getNivelAcesso(user);
  if (nivel === "FINANCEIRO" || user?.role === "financeiro") {
    throw new Error("Financeiro operacional não pode acessar a Tabela de Valores Fixos.");
  }
}

export function requireAdmin(user?: User | null): asserts user is User {
  authMiddleware(user);
  bloquearFinanceiroOperacional(user);
  const nivel = getNivelAcesso(user);
  if (nivel !== "ADMIN") {
    throw new Error("Acesso negado. Área exclusiva para ADMIN.");
  }
}

export function canAccessTabelaValores(user?: User | null) {
  try {
    requireAdmin(user);
    return true;
  } catch {
    return false;
  }
}
