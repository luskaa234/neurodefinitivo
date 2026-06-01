import { tabelaValoresService } from "./tabela-valores.service";
import type { AtualizarTabelaValorDTO, CriarTabelaValorDTO, FiltrosTabelaValorDTO, User } from "./tabela-valores.types";

export const tabelaValoresController = {
  listarValores: (user: User, filtros?: FiltrosTabelaValorDTO) =>
    tabelaValoresService.listarValores(user, filtros),
  buscarValorPorId: (user: User, id: string) =>
    tabelaValoresService.buscarValorPorId(user, id),
  criarValor: (user: User, dto: CriarTabelaValorDTO) =>
    tabelaValoresService.criarValor(user, dto),
  editarValorCompleto: (user: User, id: string, dto: AtualizarTabelaValorDTO) =>
    tabelaValoresService.editarValorCompleto(user, id, dto),
  alterarStatus: (user: User, id: string, status: "ativo" | "inativo", motivo?: string) =>
    tabelaValoresService.alterarStatus(user, id, status, motivo),
  inativarValor: (user: User, id: string, motivo?: string) =>
    tabelaValoresService.inativarValor(user, id, motivo),
  buscarHistorico: (user: User, id: string) =>
    tabelaValoresService.buscarHistorico(user, id),
  importarValoresDoArquivo: (user: User, conteudo: string) =>
    tabelaValoresService.importarValoresDoArquivo(user, conteudo),
  exportarValores: (user: User) => tabelaValoresService.exportarValores(user),
  removerDuplicados: (user: User) => tabelaValoresService.removerDuplicados(user),
};
