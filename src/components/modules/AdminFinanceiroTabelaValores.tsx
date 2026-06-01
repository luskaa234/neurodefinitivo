"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Download, Edit, FileClock, FileUp, Lock, Plus, Search, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { canAccessTabelaValores } from "@/middlewares/requireAdmin";
import { analisarTextoTabelaValores, tabelaValoresService } from "@/modules/admin-financeiro/tabela-valores/tabela-valores.service";
import type { CriarTabelaValorDTO, HistoricoTabelaValor, TabelaValor } from "@/modules/admin-financeiro/tabela-valores/tabela-valores.types";
import { formatDateTimeBR } from "@/utils/date";

const emptyForm: CriarTabelaValorDTO = {
  paciente_nome: "",
  convenio_nome: "",
  especialidade_nome: "",
  valor_plano: 0,
  valor_profissional: 0,
  percentual_clinica: 0,
  percentual_profissional: 0,
  tipo_calculo: "fixo",
  valor_fixo: true,
  status: "ativo",
  observacoes: "",
};

const moeda = (value: number) =>
  Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const normalizeText = (value?: string | null) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

const escapePdfText = (value?: string | number | null) =>
  String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

const wrapPdfText = (value: string, maxChars: number) => {
  const words = String(value || "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });
  if (line) lines.push(line);
  return lines.length ? lines : [""];
};

const duplicateKeyForTabelaValor = (item: TabelaValor) =>
  [
    normalizeText(item.paciente_id || item.paciente_nome || ""),
    normalizeText(item.convenio_id || item.convenio_nome || ""),
    normalizeText(item.especialidade_id || item.especialidade_nome || ""),
    Number(item.valor_plano || 0).toFixed(2),
    Number(item.valor_profissional || 0).toFixed(2),
  ].join("|");

const compareTabelaValorAlphabetically = (a: TabelaValor, b: TabelaValor) => {
  const pacienteCmp = String(a.paciente_nome || "Padrão").localeCompare(String(b.paciente_nome || "Padrão"), "pt-BR", {
    sensitivity: "base",
  });
  if (pacienteCmp !== 0) return pacienteCmp;

  const convenioCmp = String(a.convenio_nome || "Sem convênio").localeCompare(String(b.convenio_nome || "Sem convênio"), "pt-BR", {
    sensitivity: "base",
  });
  if (convenioCmp !== 0) return convenioCmp;

  return String(a.especialidade_nome || "").localeCompare(String(b.especialidade_nome || ""), "pt-BR", {
    sensitivity: "base",
  });
};

function calcularPercentuais(valorPlano: number, valorProfissional: number) {
  if (!valorPlano) return { percentual_clinica: 0, percentual_profissional: 0 };
  return {
    percentual_clinica: Number((((valorPlano - valorProfissional) / valorPlano) * 100).toFixed(2)),
    percentual_profissional: Number(((valorProfissional / valorPlano) * 100).toFixed(2)),
  };
}

function parseFlexibleNumber(value: string) {
  const raw = String(value || "").trim();
  const expression = raw.includes("=") ? raw.split("=").pop() || "" : raw;
  const normalized = expression.replace(/[^\d,+.-]/g, "").replace(/,/g, ".");
  if (normalized.includes("+")) {
    return normalized
      .split("+")
      .map((part) => Number(part.trim()))
      .filter(Number.isFinite)
      .reduce((sum, item) => sum + item, 0);
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parsePercentualSplit(value: string) {
  const lines = String(value || "")
    .split(/\r?\n|;/)
    .map((line) => line.trim())
    .filter(Boolean);

  const parsed = lines
    .map((line) => {
      const percentMatch = line.match(/(\d+(?:[,.]\d+)?)\s*%/);
      const afterColon = line.includes(":") ? line.split(":").slice(1).join(":") : line;
      return {
        percent: percentMatch ? Number(percentMatch[1].replace(",", ".")) : 0,
        amount: parseFlexibleNumber(afterColon),
      };
    })
    .filter((item) => item.amount > 0);

  if (!parsed.length) return null;

  const professional = parsed[0]?.amount || 0;
  const clinic = parsed[1]?.amount || 0;
  const total = professional + clinic;
  if (!total) return null;

  return {
    valor_plano: total,
    valor_profissional: professional,
    percentual_profissional: Number(((professional / total) * 100).toFixed(2)),
    percentual_clinica: Number(((clinic / total) * 100).toFixed(2)),
  };
}

function buildTabelaValoresPdf(params: {
  rows: TabelaValor[];
  resumo: { total: number; ativos: number; inativos: number; duplicados: number };
  generatedAt: string;
  filters: string[];
}) {
  const pageWidth = 842;
  const pageHeight = 595;
  const margin = 24;
  const bottom = 32;
  const purple = "0.545 0.102 0.576";
  const lightPurple = "0.984 0.969 0.988";
  const lineColor = "0.878 0.800 0.902";

  const pages: string[] = [];
  let ops: string[] = [];
  let y = pageHeight - margin;
  let pageNumber = 0;

  const text = (x: number, yy: number, value: string, size = 8, color = "0 0 0", bold = false) => {
    ops.push(`BT ${color} rg /${bold ? "F2" : "F1"} ${size} Tf ${x.toFixed(2)} ${yy.toFixed(2)} Td (${escapePdfText(value)}) Tj ET`);
  };
  const rect = (x: number, yy: number, width: number, height: number, color: string, fill = false) => {
    ops.push(`${color} ${fill ? "rg" : "RG"} ${x.toFixed(2)} ${yy.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re ${fill ? "f" : "S"}`);
  };
  const line = (x1: number, y1: number, x2: number, y2: number, color = lineColor) => {
    ops.push(`${color} RG ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
  };

  const finishPage = () => {
    text(pageWidth - 86, 14, `Pagina ${pageNumber}`, 7, "0.45 0.35 0.47");
    pages.push(ops.join("\n"));
  };

  const startPage = () => {
    if (ops.length) finishPage();
    pageNumber += 1;
    ops = [];
    y = pageHeight - margin;

    if (pageNumber === 1) {
      rect(margin, y - 62, pageWidth - margin * 2, 62, lightPurple, true);
      rect(margin, y - 62, pageWidth - margin * 2, 62, purple, false);
      rect(margin, y - 62, 7, 62, purple, true);
      text(margin + 18, y - 22, "Neuro Integrar", 20, purple, true);
      text(margin + 18, y - 42, "Tabela de Valores Fixos - Financeiro Administrativo", 10, "0.28 0.20 0.30", true);
      text(margin + 18, y - 56, `Relatorio premium para conferencia e auditoria | Gerado em ${params.generatedAt}`, 8, "0.45 0.35 0.47");
      y -= 78;

      const summaryCardWidth = (pageWidth - margin * 2 - 18) / 4;
      [
        ["Total", params.resumo.total],
        ["Ativos", params.resumo.ativos],
        ["Inativos", params.resumo.inativos],
        ["Duplicados", params.resumo.duplicados],
      ].forEach(([label, value], index) => {
        const x = margin + index * (summaryCardWidth + 6);
        rect(x, y - 30, summaryCardWidth, 30, lightPurple, true);
        rect(x, y - 30, summaryCardWidth, 30, lineColor, false);
        text(x + 8, y - 12, String(label), 7, "0.32 0.25 0.34");
        text(x + 8, y - 24, String(value), 12, "0 0 0", true);
      });
      y -= 48;

      rect(margin, y - 14, pageWidth - margin * 2, 18, "0.965 0.945 0.972", true);
      rect(margin, y - 14, pageWidth - margin * 2, 18, lineColor, false);
      text(margin + 8, y - 8, params.filters.length ? params.filters.join(" | ") : "Sem filtros aplicados. Ordem alfabetica por paciente.", 8, "0.36 0.28 0.38");
      y -= 28;
    } else {
      text(margin, y - 10, "Tabela de Valores Fixos - Neuro Integrar", 9, purple, true);
      line(margin, y - 16, pageWidth - margin, y - 16, lineColor);
      y -= 26;
    }

    rect(margin, y - 18, pageWidth - margin * 2, 18, purple, true);
    text(margin + 10, y - 12, "Lista de valores por paciente", 8, "1 1 1", true);
    y -= 26;
  };

  startPage();

  if (!params.rows.length) {
    text(margin + 250, y - 28, "Nenhum registro encontrado para exportacao.", 10, "0.45 0.35 0.47");
  }

  const cardGap = 8;
  const cardWidth = (pageWidth - margin * 2 - cardGap) / 2;
  const cardHeight = 54;

  params.rows.forEach((item, rowIndex) => {
    const column = rowIndex % 2;
    if (column === 0 && y - cardHeight < bottom) startPage();

    const cardX = margin + column * (cardWidth + cardGap);
    const cardTop = y;
    const cardBottom = y - cardHeight;
    const patientLines = wrapPdfText(item.paciente_nome || "Padrao", 40).slice(0, 1);

    rect(cardX, cardBottom, cardWidth, cardHeight, rowIndex % 4 < 2 ? lightPurple : "1 1 1", true);
    rect(cardX, cardBottom, cardWidth, cardHeight, lineColor, false);
    rect(cardX, cardBottom, 4, cardHeight, item.status === "ativo" ? purple : "0.55 0.55 0.55", true);

    text(cardX + 12, cardTop - 12, patientLines[0], 8, "0.08 0.06 0.09", true);
    text(cardX + cardWidth - 42, cardTop - 12, item.status === "ativo" ? "ATIVO" : "INAT.", 6, item.status === "ativo" ? purple : "0.45 0.45 0.45", true);

    text(cardX + 12, cardTop - 25, `${item.convenio_nome || "Sem convenio"} | ${item.especialidade_nome || ""}`, 7, "0.18 0.14 0.19");
    text(cardX + 12, cardTop - 38, `Plano ${moeda(item.valor_plano)}  Prof. ${moeda(item.valor_profissional)}`, 7, "0.08 0.06 0.09", true);
    text(cardX + 220, cardTop - 38, `Clinica ${item.percentual_clinica}% | Prof. ${item.percentual_profissional}%`, 7, "0.36 0.28 0.38");
    if (item.observacoes) text(cardX + 12, cardTop - 49, wrapPdfText(item.observacoes, 62)[0], 6, "0.45 0.35 0.47");

    if (column === 1 || rowIndex === params.rows.length - 1) y -= cardHeight + cardGap;
  });

  finishPage();

  const encoder = new TextEncoder();
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pages.map((_, index) => `${3 + index * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`,
  ];
  pages.forEach((content, index) => {
    const pageObj = 3 + index * 2;
    const contentObj = pageObj + 1;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> >> >> /Contents ${contentObj} 0 R >>`);
    objects.push(`<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream`);
  });

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(encoder.encode(pdf).length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = encoder.encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return new Blob([pdf], { type: "application/pdf" });
}

export function AdminFinanceiroTabelaValores() {
  const { user } = useAuth();
  const { patients } = useApp();
  const [rows, setRows] = useState<TabelaValor[]>([]);
  const [search, setSearch] = useState("");
  const [paciente, setPaciente] = useState("");
  const [convenio, setConvenio] = useState("");
  const [especialidade, setEspecialidade] = useState("");
  const [status, setStatus] = useState<"todos" | "ativo" | "inativo">("todos");
  const [form, setForm] = useState<CriarTabelaValorDTO>(emptyForm);
  const [editing, setEditing] = useState<TabelaValor | null>(null);
  const [historyTarget, setHistoryTarget] = useState<TabelaValor | null>(null);
  const [history, setHistory] = useState<HistoricoTabelaValor[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<TabelaValor | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [motivo, setMotivo] = useState("");

  const canAccess = canAccessTabelaValores(user as any);
  const registeredPatients = useMemo(
    () =>
      patients
        .filter((patient) => patient.is_active !== false)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })),
    [patients]
  );

  const loadRows = async () => {
    if (!canAccess || !user) return;
    const data = await tabelaValoresService.listarValores(user as any, {
      busca: search,
      paciente,
      convenio,
      especialidade,
      status,
    });
    setRows(data.slice().sort(compareTabelaValorAlphabetically));
  };

  useEffect(() => {
    loadRows();
  }, [canAccess, user?.id, search, paciente, convenio, especialidade, status]);

  const resumo = useMemo(() => {
    const total = rows.length;
    const ativos = rows.filter((item) => item.status === "ativo").length;
    const inativos = rows.filter((item) => item.status === "inativo").length;
    const seen = new Set<string>();
    let duplicados = 0;
    rows.forEach((item) => {
      const key = duplicateKeyForTabelaValor(item);
      if (seen.has(key)) duplicados += 1;
      seen.add(key);
    });
    const inconsistentes = rows.filter(
      (item) =>
        item.valor_plano < 0 ||
        item.valor_profissional < 0 ||
        item.percentual_clinica < 0 ||
        item.percentual_profissional < 0 ||
        !item.especialidade_nome ||
        !item.paciente_nome
    ).length;
    return { total, ativos, inativos, inconsistentes, duplicados };
  }, [rows]);

  if (!canAccess) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-800">
            <Lock className="h-5 w-5" />
            Acesso negado
          </CardTitle>
          <CardDescription className="text-red-700">
            A Tabela de Valores Fixos pertence ao Financeiro Administrativo e é exclusiva para ADMIN.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const updateForm = (patch: Partial<CriarTabelaValorDTO>) => {
    const next = { ...form, ...patch };
    if (patch.valor_plano !== undefined || patch.valor_profissional !== undefined) {
      Object.assign(next, calcularPercentuais(Number(next.valor_plano), Number(next.valor_profissional)));
    }
    setForm(next);
  };

  const resetDialogs = () => {
    setForm(emptyForm);
    setEditing(null);
    setMotivo("");
    setIsCreateOpen(false);
  };

  const save = async () => {
    try {
      if (!user) return;
      if (editing) {
        await tabelaValoresService.editarValorCompleto(user as any, editing.id, { ...form, motivo_alteracao: motivo });
        toast.success("Valor atualizado com histórico.");
      } else {
        await tabelaValoresService.criarValor(user as any, form);
        toast.success("Valor criado.");
      }
      resetDialogs();
      await loadRows();
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível salvar.");
    }
  };

  const openEdit = (item: TabelaValor) => {
    setEditing(item);
    setForm({
      paciente_id: item.paciente_id,
      paciente_nome: item.paciente_nome || "",
      convenio_id: item.convenio_id,
      convenio_nome: item.convenio_nome || "",
      especialidade_id: item.especialidade_id,
      especialidade_nome: item.especialidade_nome,
      valor_plano: item.valor_plano,
      valor_profissional: item.valor_profissional,
      percentual_clinica: item.percentual_clinica,
      percentual_profissional: item.percentual_profissional,
      tipo_calculo: item.tipo_calculo,
      valor_fixo: item.valor_fixo,
      status: item.status,
      observacoes: item.observacoes || "",
    });
    setIsCreateOpen(true);
  };

  const openHistory = async (item: TabelaValor) => {
    if (!user) return;
    setHistoryTarget(item);
    setHistory(await tabelaValoresService.buscarHistorico(user as any, item.id));
  };

  const confirmInactivate = async () => {
    try {
      if (!user || !deleteTarget) return;
      await tabelaValoresService.inativarValor(user as any, deleteTarget.id, motivo || "Inativação administrativa");
      toast.success("Registro inativado com segurança.");
      setDeleteTarget(null);
      setMotivo("");
      await loadRows();
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível inativar.");
    }
  };

  const importValues = async () => {
    try {
      if (!user) return;
      const preview = analisarTextoTabelaValores(importText);
      await tabelaValoresService.importarValoresDoArquivo(user as any, importText);
      toast.success(`${preview.registros_criados.length} registros importados. Revise inconsistências antes de usar em lançamentos.`);
      setIsImportOpen(false);
      setImportText("");
      await loadRows();
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível importar.");
    }
  };

  const exportValues = async () => {
    if (!user) return;
    const csv = await tabelaValoresService.exportarValores(user as any);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tabela-valores-fixos.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const removeDuplicates = async () => {
    if (!user) return;
    try {
      const result = await tabelaValoresService.removerDuplicados(user as any);
      toast.success(
        result.totalRemoved > 0
          ? `${result.totalRemoved} registro(s) duplicado(s) removido(s).`
          : "Nenhum duplicado encontrado."
      );
      await loadRows();
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível remover duplicados.");
    }
  };

  const exportPdfValues = () => {
    const rowsToExport = rows.slice().sort(compareTabelaValorAlphabetically);
    const filterSummary = [
      search ? `Busca: ${search}` : "",
      paciente ? `Paciente: ${paciente}` : "",
      convenio ? `Convênio: ${convenio}` : "",
      especialidade ? `Especialidade: ${especialidade}` : "",
      status !== "todos" ? `Status: ${status}` : "",
    ].filter(Boolean);
    const pdf = buildTabelaValoresPdf({
      rows: rowsToExport,
      resumo,
      generatedAt: formatDateTimeBR(new Date()),
      filters: filterSummary,
    });
    const url = URL.createObjectURL(pdf);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tabela-valores-fixos-${new Date().toISOString().slice(0, 10)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("PDF da tabela de valores exportado.");
  };

  return (
    <div className="space-y-6 px-2 sm:px-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Tabela de Valores Fixos</h1>
          <p className="mt-1 text-sm text-slate-600">
            Administrativo &gt; Financeiro. Área exclusiva para ADMIN.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setIsImportOpen(true)}>
            <FileUp className="mr-2 h-4 w-4" />
            Importar Arquivo
          </Button>
          <Button variant="outline" onClick={removeDuplicates}>
            <Sparkles className="mr-2 h-4 w-4" />
            Remover Duplicados
          </Button>
          <Button variant="outline" onClick={exportPdfValues}>
            <Download className="mr-2 h-4 w-4" />
            Exportar PDF
          </Button>
          <Button variant="outline" onClick={exportValues}>
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Valor
          </Button>
        </div>
      </div>

      <CardResumoFinanceiroAdministrativo resumo={resumo} />

      <FiltrosTabelaValores
        search={search}
        setSearch={setSearch}
        paciente={paciente}
        setPaciente={setPaciente}
        convenio={convenio}
        setConvenio={setConvenio}
        especialidade={especialidade}
        setEspecialidade={setEspecialidade}
        status={status}
        setStatus={setStatus}
      />

      <TabelaValores rows={rows} onEdit={openEdit} onHistory={openHistory} onInactivate={setDeleteTarget} />

      <ModalCriarValor
        open={isCreateOpen}
        title={editing ? "Editar Valor Fixo" : "Novo Valor Fixo"}
        form={form}
        patients={registeredPatients}
        motivo={motivo}
        isEditing={Boolean(editing)}
        onMotivoChange={setMotivo}
        onChange={updateForm}
        onClose={resetDialogs}
        onSave={save}
      />

      <ModalHistoricoValor target={historyTarget} history={history} onClose={() => setHistoryTarget(null)} />

      <ModalConfirmarInativacao
        target={deleteTarget}
        motivo={motivo}
        onMotivoChange={setMotivo}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmInactivate}
      />

      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Importar tabela de valores</DialogTitle>
            <DialogDescription>
              Cole o texto extraído do DOCX, CSV ou JSON. O importador identifica pacientes, convênios, especialidades, valores, 70%/30% e registros incompletos.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            className="min-h-[280px]"
            placeholder="Cole aqui a lista de pacientes e valores..."
          />
          {importText.trim() && <ImportPreview text={importText} />}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsImportOpen(false)}>Cancelar</Button>
            <Button onClick={importValues} disabled={!importText.trim()}>Importar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CardResumoFinanceiroAdministrativo({ resumo }: { resumo: { total: number; ativos: number; inativos: number; inconsistentes: number; duplicados: number } }) {
  const cards = [
    ["Total de registros", resumo.total, "border-blue-200 bg-blue-50 text-blue-700"],
    ["Ativos", resumo.ativos, "border-emerald-200 bg-emerald-50 text-emerald-700"],
    ["Inativos", resumo.inativos, "border-slate-200 bg-slate-50 text-slate-700"],
    ["Duplicados", resumo.duplicados, "border-rose-200 bg-rose-50 text-rose-700"],
    ["Inconsistentes", resumo.inconsistentes, "border-amber-200 bg-amber-50 text-amber-700"],
  ] as const;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map(([label, value, className]) => (
        <Card key={label} className={`border-2 ${className}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{label}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{value}</CardContent>
        </Card>
      ))}
    </div>
  );
}

function FiltrosTabelaValores(props: any) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Search className="h-4 w-4" />
          Filtros
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-5">
        <Input placeholder="Buscar paciente" value={props.search} onChange={(e) => props.setSearch(e.target.value)} />
        <Input placeholder="Paciente" value={props.paciente} onChange={(e) => props.setPaciente(e.target.value)} />
        <Input placeholder="Convênio" value={props.convenio} onChange={(e) => props.setConvenio(e.target.value)} />
        <Input placeholder="Especialidade" value={props.especialidade} onChange={(e) => props.setEspecialidade(e.target.value)} />
        <Select value={props.status} onValueChange={props.setStatus}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="ativo">Ativos</SelectItem>
            <SelectItem value="inativo">Inativos</SelectItem>
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}

function TabelaValores({
  rows,
  onEdit,
  onHistory,
  onInactivate,
}: {
  rows: TabelaValor[];
  onEdit: (item: TabelaValor) => void;
  onHistory: (item: TabelaValor) => void;
  onInactivate: (item: TabelaValor) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Valores cadastrados</CardTitle>
        <CardDescription>{rows.length} registro(s) encontrados</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[1120px]">
            <TableHeader>
              <TableRow>
                <TableHead>Paciente</TableHead>
                <TableHead>Convênio</TableHead>
                <TableHead>Especialidade</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Profissional</TableHead>
                <TableHead>Clínica</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.paciente_nome || "Padrão"}</TableCell>
                  <TableCell>{item.convenio_nome || "Sem convênio"}</TableCell>
                  <TableCell>{item.especialidade_nome}</TableCell>
                  <TableCell>{moeda(item.valor_plano)}</TableCell>
                  <TableCell>{moeda(item.valor_profissional)}</TableCell>
                  <TableCell>{item.percentual_clinica}%</TableCell>
                  <TableCell>
                    <Badge variant={item.status === "ativo" ? "default" : "secondary"}>{item.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => onHistory(item)}><FileClock className="h-4 w-4" /></Button>
                      <Button variant="outline" size="sm" onClick={() => onEdit(item)}><Edit className="h-4 w-4" /></Button>
                      <Button variant="outline" size="sm" onClick={() => onInactivate(item)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!rows.length && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-slate-500">
                    Nenhum valor cadastrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function ModalCriarValor(props: {
  open: boolean;
  title: string;
  form: CriarTabelaValorDTO;
  patients: Array<{ id: string; name: string; phone?: string }>;
  motivo: string;
  isEditing: boolean;
  onMotivoChange: (value: string) => void;
  onChange: (patch: Partial<CriarTabelaValorDTO>) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const [patientSearch, setPatientSearch] = useState(props.form.paciente_nome || "");
  const [isPatientListOpen, setIsPatientListOpen] = useState(false);
  const [percentualSplit, setPercentualSplit] = useState("");

  useEffect(() => {
    setPatientSearch(props.form.paciente_nome || "");
  }, [props.form.paciente_nome, props.open]);

  const filteredPatients = props.patients
    .filter((patient) => normalizeText(patient.name).includes(normalizeText(patientSearch)))
    .slice(0, 8);

  const handlePatientChange = (value: string) => {
    setPatientSearch(value);
    const selected = props.patients.find((patient) => normalizeText(patient.name) === normalizeText(value));
    props.onChange({
      paciente_id: selected?.id || null,
      paciente_nome: value,
    });
  };

  const selectPatient = (patient: { id: string; name: string; phone?: string }) => {
    setPatientSearch(patient.name);
    setIsPatientListOpen(false);
    props.onChange({
      paciente_id: patient.id,
      paciente_nome: patient.name,
    });
  };

  const applyPercentualSplit = () => {
    const parsed = parsePercentualSplit(percentualSplit);
    if (!parsed) {
      toast.error("Informe a divisão no formato 70%: 105 e 30%: 45+10=55.");
      return;
    }
    props.onChange({
      ...parsed,
      tipo_calculo: "percentual",
      observacoes: [props.form.observacoes, `Divisão percentual: ${percentualSplit.replace(/\r?\n/g, " | ")}`]
        .filter(Boolean)
        .join("\n"),
    });
    toast.success("Percentual calculado e aplicado.");
  };

  return (
    <Dialog open={props.open} onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{props.title}</DialogTitle>
          <DialogDescription>Controle completo do valor fixo administrativo.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Paciente</Label>
            <div className="relative">
              <Input
                value={patientSearch}
                onChange={(event) => {
                  handlePatientChange(event.target.value);
                  setIsPatientListOpen(true);
                }}
                onFocus={() => setIsPatientListOpen(true)}
                onBlur={() => setTimeout(() => setIsPatientListOpen(false), 150)}
                placeholder="Buscar paciente cadastrado"
              />
              {isPatientListOpen && (
                <div className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border border-purple-100 bg-white p-1 shadow-lg">
                  {filteredPatients.length ? (
                    filteredPatients.map((patient) => (
                      <button
                        key={patient.id}
                        type="button"
                        className="block w-full rounded px-3 py-2 text-left hover:bg-purple-50 focus:bg-purple-50"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectPatient(patient)}
                      >
                        <span className="block text-sm font-medium text-slate-900">{patient.name}</span>
                        {patient.phone && <span className="block text-xs text-slate-500">{patient.phone}</span>}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-slate-500">Nenhum paciente encontrado. O nome digitado será salvo manualmente.</div>
                  )}
                </div>
              )}
            </div>
            {props.form.paciente_id ? (
              <p className="text-xs text-emerald-700">Paciente vinculado ao cadastro.</p>
            ) : (
              <p className="text-xs text-slate-500">Digite para buscar na lista ou informe manualmente.</p>
            )}
          </div>
          <Field label="Convênio" value={props.form.convenio_nome || ""} onChange={(v) => props.onChange({ convenio_nome: v })} />
          <Field label="Especialidade" value={props.form.especialidade_nome || ""} onChange={(v) => props.onChange({ especialidade_nome: v })} />
          <div className="space-y-2">
            <Label>Tipo de cálculo</Label>
            <Select value={props.form.tipo_calculo || "fixo"} onValueChange={(v) => props.onChange({ tipo_calculo: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fixo">Fixo</SelectItem>
                <SelectItem value="percentual">Percentual</SelectItem>
                <SelectItem value="variavel">Variável</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {props.form.tipo_calculo === "percentual" && (
            <div className="space-y-2 md:col-span-2">
              <Label>Divisão percentual</Label>
              <Textarea
                value={percentualSplit}
                onChange={(event) => setPercentualSplit(event.target.value)}
                placeholder={"70%: 105\n30%: 45+10=55"}
                className="min-h-[88px]"
              />
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-slate-500">O sistema soma os valores, calcula o total e atualiza os percentuais reais.</p>
                <Button type="button" variant="outline" size="sm" onClick={applyPercentualSplit}>Aplicar divisão</Button>
              </div>
            </div>
          )}
          <Field label="Valor do plano" value={String(props.form.valor_plano)} onChange={(v) => props.onChange({ valor_plano: parseFlexibleNumber(v) })} />
          <Field label="Valor do profissional" value={String(props.form.valor_profissional)} onChange={(v) => props.onChange({ valor_profissional: parseFlexibleNumber(v) })} />
          <Field label="% Clínica" value={String(props.form.percentual_clinica)} onChange={(v) => props.onChange({ percentual_clinica: parseFlexibleNumber(v) })} />
          <Field label="% Profissional" value={String(props.form.percentual_profissional)} onChange={(v) => props.onChange({ percentual_profissional: parseFlexibleNumber(v) })} />
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={props.form.status || "ativo"} onValueChange={(v) => props.onChange({ status: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {props.isEditing && <Field label="Motivo da alteração" value={props.motivo} onChange={props.onMotivoChange} />}
        </div>
        <div className="space-y-2">
          <Label>Observações</Label>
          <Textarea value={props.form.observacoes || ""} onChange={(e) => props.onChange({ observacoes: e.target.value })} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={props.onClose}>Cancelar</Button>
          <Button onClick={props.onSave}>Salvar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} step={type === "number" ? "0.01" : undefined} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function ModalHistoricoValor({ target, history, onClose }: { target: TabelaValor | null; history: HistoricoTabelaValor[]; onClose: () => void }) {
  return (
    <Dialog open={Boolean(target)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Histórico de alterações</DialogTitle>
          <DialogDescription>{target?.paciente_nome} - {target?.especialidade_nome}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[420px] overflow-y-auto space-y-3">
          {history.map((item) => (
            <div key={item.id} className="rounded-md border p-3 text-sm">
              <div className="flex justify-between gap-3">
                <strong>{item.campo_alterado}</strong>
                <span className="text-slate-500">{formatDateTimeBR(item.created_at)}</span>
              </div>
              <p className="mt-1 text-slate-600">De {item.valor_anterior || "vazio"} para {item.valor_novo || "vazio"}</p>
              {item.motivo && <p className="mt-1 text-slate-500">Motivo: {item.motivo}</p>}
            </div>
          ))}
          {!history.length && <p className="py-8 text-center text-slate-500">Nenhuma alteração registrada ainda.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ModalConfirmarInativacao(props: {
  target: TabelaValor | null;
  motivo: string;
  onMotivoChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={Boolean(props.target)} onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
            Inativação segura
          </DialogTitle>
          <DialogDescription>
            Se já houver uso em atendimentos, o registro não deve ser excluído definitivamente. Ele será apenas inativado.
          </DialogDescription>
        </DialogHeader>
        <Field label="Motivo" value={props.motivo} onChange={props.onMotivoChange} />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={props.onClose}>Cancelar</Button>
          <Button onClick={props.onConfirm}>Inativar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ImportPreview({ text }: { text: string }) {
  const preview = analisarTextoTabelaValores(text);
  return (
    <div className="rounded-md border bg-slate-50 p-3 text-sm">
      <div className="grid gap-2 sm:grid-cols-4">
        <span>Linhas: <strong>{preview.total_linhas}</strong></span>
        <span>Registros: <strong>{preview.registros_criados.length}</strong></span>
        <span>Repetidos: <strong>{preview.repetidos.length}</strong></span>
        <span>Incompletos: <strong>{preview.incompletos.length}</strong></span>
      </div>
      {!!preview.inconsistencias.length && (
        <p className="mt-2 flex items-center gap-2 text-amber-700">
          <ShieldCheck className="h-4 w-4" />
          {preview.inconsistencias.length} regra(s) de divisão ou inconsistência para revisão.
        </p>
      )}
    </div>
  );
}

export default AdminFinanceiroTabelaValores;
