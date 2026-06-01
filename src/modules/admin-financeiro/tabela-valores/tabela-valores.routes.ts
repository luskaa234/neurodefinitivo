import { tabelaValoresController } from "./tabela-valores.controller";

export const tabelaValoresRoutes = {
  basePath: "/admin/financeiro/tabela-valores",
  routes: [
    "GET /admin/financeiro/tabela-valores",
    "GET /admin/financeiro/tabela-valores/:id",
    "POST /admin/financeiro/tabela-valores",
    "PUT /admin/financeiro/tabela-valores/:id",
    "PATCH /admin/financeiro/tabela-valores/:id/status",
    "DELETE /admin/financeiro/tabela-valores/:id",
    "GET /admin/financeiro/tabela-valores/:id/historico",
    "POST /admin/financeiro/tabela-valores/importar",
    "GET /admin/financeiro/tabela-valores/exportar",
  ],
  controller: tabelaValoresController,
  requiredRole: "ADMIN",
};
