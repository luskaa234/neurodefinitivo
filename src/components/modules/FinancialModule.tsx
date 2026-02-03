"use client";

import React, { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DollarSign,
  Plus,
  TrendingUp,
  TrendingDown,
  Calendar,
  Edit,
  Trash2,
  CheckCircle,
  Save,
  X,
  Search,
  Filter,
  CreditCard,
  Landmark,
  QrCode,
} from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { formatDateBR, formatDateTimeBR, nowLocal, toInputDate } from "@/utils/date";

/* =========================
   Tipos / Schema / Helpers
   ========================= */

const financialSchema = z.object({
  type: z.enum(["receita", "despesa"]),
  amount: z.number().min(0.01, "Valor deve ser maior que zero"),
  description: z.string().min(1, "Descrição é obrigatória"),
  category: z.string().min(1, "Categoria é obrigatória"),
  date: z.string().min(1, "Data é obrigatória"),
  status: z.enum(["pendente", "pago", "cancelado"]),
});

type FinancialFormData = z.infer<typeof financialSchema>;

type PaymentMethod = "pix" | "cartao" | "boleto";
type DiscountKind = "percent" | "valor";
type FeeKind = "percent" | "valor";

type NewFinancialRecordInput = {
  type: "receita" | "despesa";
  amount: number;
  description: string;
  category: string;
  date: string;
  status: "pendente" | "pago" | "cancelado";
  appointment_id?: string;
};

const supportsInstallments = (method: PaymentMethod) =>
  method === "cartao" || method === "boleto";

const formatCurrency = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

function computeNetAmount(
  baseAmount: number,
  discountKind: DiscountKind,
  discountValue: number,
  feeKind: FeeKind,
  feeValue: number
) {
  const safeBase = Number(baseAmount) || 0;

  // desconto
  const discount =
    discountKind === "percent"
      ? (safeBase * (Number(discountValue) || 0)) / 100
      : Number(discountValue) || 0;

  const afterDiscount = Math.max(0, safeBase - Math.max(0, discount));

  // taxa
  const fee =
    feeKind === "percent"
      ? (afterDiscount * (Number(feeValue) || 0)) / 100
      : Number(feeValue) || 0;

  const finalAmount = Math.max(0, afterDiscount + Math.max(0, fee));
  return Number(finalAmount.toFixed(2));
}

function buildDetailsTag(
  paymentMethod: PaymentMethod,
  installments: number,
  discountKind: DiscountKind,
  discountValue: number,
  feeKind: FeeKind,
  feeValue: number,
  appointmentId?: string
) {
  const tags: string[] = [];

  const pmg =
    paymentMethod === "pix"
      ? "Pgto: Pix"
      : paymentMethod === "cartao"
      ? "Pgto: Cartão"
      : "Pgto: Boleto";
  tags.push(pmg + (supportsInstallments(paymentMethod) ? ` • ${installments}x` : ""));

  if (Number(discountValue) > 0) {
    tags.push(
      `Desc: ${
        discountKind === "percent"
          ? `${Number(discountValue)}%`
          : `R$ ${(Number(discountValue) || 0).toLocaleString("pt-BR")}`
      }`
    );
  }

  if (Number(feeValue) > 0) {
    tags.push(
      `Taxa: ${
        feeKind === "percent"
          ? `${Number(feeValue)}%`
          : `R$ ${(Number(feeValue) || 0).toLocaleString("pt-BR")}`
      }`
    );
  }

  if (appointmentId) tags.push(`Agendamento: ${appointmentId}`);

  return tags.length ? `— [${tags.join(" • ")}]` : "";
}

// extrai método de pagamento do sufixo na descrição
function extractPaymentMethod(description: string): "pix" | "cartao" | "boleto" | "outro" {
  const m = /Pgto:\s*(Pix|Cartão|Boleto)/i.exec(description || "");
  const word = m?.[1]?.toLowerCase();
  if (word?.includes("pix")) return "pix";
  if (word?.includes("cart")) return "cartao";
  if (word?.includes("bole")) return "boleto";
  return "outro";
}

function paymentBadge(method: "pix" | "cartao" | "boleto" | "outro") {
  switch (method) {
    case "pix":
      return (
        <Badge variant="secondary" className="gap-1">
          <QrCode className="h-3.5 w-3.5" />
          Pix
        </Badge>
      );
    case "cartao":
      return (
        <Badge variant="secondary" className="gap-1">
          <CreditCard className="h-3.5 w-3.5" />
          Cartão
        </Badge>
      );
    case "boleto":
      return (
        <Badge variant="secondary" className="gap-1">
          <Landmark className="h-3.5 w-3.5" />
          Boleto
        </Badge>
      );
    default:
      return <Badge variant="outline">Outro</Badge>;
  }
}

/* =========================
   Componente
   ========================= */

export function FinancialModule() {
  const {
    financialRecords,
    addFinancialRecord,
    updateFinancialRecord,
    deleteFinancialRecord,
    appointments,
    patients,
    doctors,
  } = useApp();

  /* ---------- dialogs / edição ---------- */
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);

  /* ---------- form CREATE ---------- */
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FinancialFormData>({
    resolver: zodResolver(financialSchema),
    defaultValues: {
      date: toInputDate(nowLocal()),
    },
  });

  const [createPaymentMethod, setCreatePaymentMethod] =
    useState<PaymentMethod>("pix");
  const [createInstallments, setCreateInstallments] = useState<number>(1);
  const [createDiscountKind, setCreateDiscountKind] =
    useState<DiscountKind>("percent");
  const [createDiscountValue, setCreateDiscountValue] = useState<number>(0);
  const [createFeeKind, setCreateFeeKind] = useState<FeeKind>("valor");
  const [createFeeValue, setCreateFeeValue] = useState<number>(0);
  const [linkAppointmentId, setLinkAppointmentId] = useState<string>("none");

  const watchType = watch("type");
  const watchAmount = watch("amount");

  const finalAmountPreview = useMemo(() => {
    return computeNetAmount(
      Number(watchAmount || 0),
      createDiscountKind,
      Number(createDiscountValue || 0),
      createFeeKind,
      Number(createFeeValue || 0)
    );
  }, [
    watchAmount,
    createDiscountKind,
    createDiscountValue,
    createFeeKind,
    createFeeValue,
  ]);

  const perInstallment =
    supportsInstallments(createPaymentMethod) && Number(createInstallments) > 1
      ? finalAmountPreview / Math.max(1, Number(createInstallments))
      : 0;

  /* ---------- form EDIT ---------- */
  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    reset: resetEdit,
    setValue: setValueEdit,
    watch: watchEdit,
    formState: { errors: errorsEdit, isSubmitting: isSubmittingEdit },
  } = useForm<FinancialFormData>({
    resolver: zodResolver(financialSchema),
  });

  const watchEditType = watchEdit("type");

  /* ---------- filtros UI ---------- */
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "receita" | "despesa">(
    "all"
  );
  const [filterStatus, setFilterStatus] = useState<
    "all" | "pendente" | "pago" | "cancelado"
  >("all");
  const [filterPayment, setFilterPayment] = useState<
    "all" | "pix" | "cartao" | "boleto" | "outro"
  >("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const getNomePaciente = (id: string) =>
    patients.find((p) => p.id === id)?.name || "Paciente";
  const getNomeMedico = (id: string) =>
    doctors.find((d) => d.id === id)?.name || "Médico";

  const appointmentOptions = useMemo(
    () =>
      appointments
        .slice()
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
        .map((a) => ({
          value: a.id,
          label: `${formatDateTimeBR(`${a.date}T${a.time}`)} — ${getNomePaciente(a.patient_id)} • ${getNomeMedico(
            a.doctor_id
          )} • ${a.type}`,
        })),
    [appointments, patients, doctors]
  );

  /* ---------- records filtrados / métricas ---------- */
  const filtered = useMemo(() => {
    return financialRecords.filter((r) => {
      const pm = extractPaymentMethod(r.description || "");

      const matchesType = filterType === "all" ? true : r.type === filterType;
      const matchesStatus =
        filterStatus === "all" ? true : r.status === filterStatus;
      const matchesPayment = filterPayment === "all" ? true : pm === filterPayment;

      const matchesSearch =
        !search ||
        r.description.toLowerCase().includes(search.toLowerCase()) ||
        r.category.toLowerCase().includes(search.toLowerCase());

      const d = new Date(r.date);
      const afterFrom = dateFrom ? d >= new Date(dateFrom) : true;
      const beforeTo = dateTo ? d <= new Date(dateTo + "T23:59:59") : true;

      return (
        matchesType && matchesStatus && matchesPayment && matchesSearch && afterFrom && beforeTo
      );
    });
  }, [financialRecords, filterType, filterStatus, filterPayment, search, dateFrom, dateTo]);

  const contagemStatus = useMemo(() => {
    return filtered.reduce(
      (acc, r) => {
        acc.total++;
        if (r.status === "pendente") acc.pendente++;
        if (r.status === "pago") acc.pago++;
        if (r.status === "cancelado") acc.cancelado++;
        return acc;
      },
      { total: 0, pendente: 0, pago: 0, cancelado: 0 }
    );
  }, [filtered]);

  const totalReceitaFiltrado = filtered
    .filter((r) => r.type === "receita" && r.status === "pago")
    .reduce((sum, r) => sum + (r.amount || 0), 0);
  const totalDespesaFiltrado = filtered
    .filter((r) => r.type === "despesa" && r.status === "pago")
    .reduce((sum, r) => sum + (r.amount || 0), 0);
  const totalLiquidoFiltrado = totalReceitaFiltrado - totalDespesaFiltrado;

  // métricas do mês atual
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const thisMonthRecords = useMemo(
    () =>
      financialRecords.filter((r) => {
        const d = new Date(r.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      }),
    [financialRecords, currentMonth, currentYear]
  );
  const totalRevenue = thisMonthRecords
    .filter((r) => r.type === "receita" && r.status === "pago")
    .reduce((sum, r) => sum + (r.amount || 0), 0);
  const totalExpenses = thisMonthRecords
    .filter((r) => r.type === "despesa" && r.status === "pago")
    .reduce((sum, r) => sum + (r.amount || 0), 0);
  const pendingRevenue = thisMonthRecords
    .filter((r) => r.type === "receita" && r.status === "pendente")
    .reduce((sum, r) => sum + (r.amount || 0), 0);
  const netProfit = totalRevenue - totalExpenses;

  /* ---------- paginação simples ---------- */
  const [page, setPage] = useState(1);
  const pageSize = 12;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered
      .slice()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(start, start + pageSize);
  }, [filtered, page]);

  /* =========================
     Submit: CREATE
     ========================= */
  const onSubmit = async (data: FinancialFormData) => {
    try {
      const baseAmount = Number.isFinite(data.amount) ? Number(data.amount) : 0;
      const computedFinal = computeNetAmount(
        baseAmount,
        createDiscountKind,
        Number(createDiscountValue || 0),
        createFeeKind,
        Number(createFeeValue || 0)
      );
      const finalAmount = Math.max(0, Number(computedFinal.toFixed(2)));

      const parcelas = supportsInstallments(createPaymentMethod)
        ? Math.max(1, Math.min(24, Number(createInstallments || 1)))
        : 1;

      const details = buildDetailsTag(
        createPaymentMethod,
        parcelas,
        createDiscountKind,
        Number(createDiscountValue || 0),
        createFeeKind,
        Number(createFeeValue || 0),
        linkAppointmentId !== "none" ? linkAppointmentId : undefined
      );

      const baseDesc = (data.description ?? "").trim();
const description = details ? `${baseDesc} ${details}`.trim() : baseDesc;

const payload: NewFinancialRecordInput = {
  type: data.type,         // obrigatórios
  status: data.status,
  date: data.date,
  category: data.category,
  amount: finalAmount,     // calculado
  description,             // tratado acima
  ...(linkAppointmentId !== "none" ? { appointment_id: linkAppointmentId } : {}),
};

const success = await addFinancialRecord(payload);

      if (success) {
        reset();
        // reset extras
        setCreatePaymentMethod("pix");
        setCreateInstallments(1);
        setCreateDiscountKind("percent");
        setCreateDiscountValue(0);
        setCreateFeeKind("valor");
        setCreateFeeValue(0);
        setLinkAppointmentId("none");
        setIsDialogOpen(false);
        toast.success("✅ Registro financeiro criado com sucesso!");
      } else {
        toast.error("❌ Erro ao criar registro financeiro");
      }
    } catch (error) {
      console.error("❌ Erro ao criar registro:", error);
      toast.error("❌ Erro ao criar registro financeiro");
    }
  };

  /* =========================
     Submit: EDIT
     ========================= */
  const onSubmitEdit = async (data: FinancialFormData) => {
    if (!editingRecord) return;

    try {
      const success = await updateFinancialRecord(editingRecord.id, data);
      if (success) {
        resetEdit();
        setIsEditDialogOpen(false);
        setEditingRecord(null);
        toast.success("✅ Registro atualizado com sucesso!");
      } else {
        toast.error("❌ Erro ao atualizar registro");
      }
    } catch (error) {
      console.error("❌ Erro ao editar registro:", error);
      toast.error("❌ Erro ao editar registro");
    }
  };

  const handleEdit = (record: any) => {
    setEditingRecord(record);
    setValueEdit("type", record.type);
    setValueEdit("amount", record.amount);
    setValueEdit("description", record.description);
    setValueEdit("category", record.category);
    setValueEdit("date", record.date);
    setValueEdit("status", record.status);
    setIsEditDialogOpen(true);
  };

  const handleDelete = async (record: any) => {
    const confirmMessage = `Tem certeza que deseja EXCLUIR PERMANENTEMENTE este registro?

📋 Detalhes:
• Tipo: ${record.type === "receita" ? "💰 Receita" : "💸 Despesa"}
• Valor: ${formatCurrency(record.amount)}
• Descrição: ${record.description}
• Data: ${formatDateBR(record.date)}

⚠️ ESTA AÇÃO NÃO PODE SER DESFEITA!`;

    if (window.confirm(confirmMessage)) {
      try {
        const success = await deleteFinancialRecord(record.id);
        if (success) {
          toast.success("🗑️ Registro EXCLUÍDO PERMANENTEMENTE do banco de dados!");
        } else {
          toast.error("❌ Erro ao excluir registro");
        }
      } catch (error) {
        console.error("❌ Erro ao excluir registro:", error);
        toast.error("❌ Erro ao excluir registro");
      }
    }
  };

  /* =========================
     UI
     ========================= */
  return (
    <div className="space-y-6 px-2 sm:px-4">
      {/* HEADER + AÇÕES */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">💰 Financeiro</h1>
          <p className="text-sm text-gray-600 sm:text-base">
            Visão geral, filtros avançados e gestão de transações.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => {
            setSearch(""); setFilterType("all"); setFilterStatus("all"); setFilterPayment("all"); setDateFrom(""); setDateTo(""); setPage(1);
          }}>
            Limpar Filtros
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-purple-600 hover:bg-purple-700 text-white">
                <Plus className="mr-2 h-4 w-4" />
                Nova Transação
              </Button>
            </DialogTrigger>

            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Nova Transação Financeira</DialogTitle>
                <DialogDescription>
                  Adicione receita ou despesa com detalhes de pagamento
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                {/* Tipo + Valor */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select onValueChange={(v) => setValue("type", v as any)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="receita">💰 Receita</SelectItem>
                        <SelectItem value="despesa">💸 Despesa</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.type && (
                      <p className="text-sm text-red-600">
                        {errors.type.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="amount">Valor base (R$)</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      placeholder="0,00"
                      {...register("amount", { valueAsNumber: true })}
                    />
                    {errors.amount && (
                      <p className="text-sm text-red-600">
                        {errors.amount.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Descrição */}
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Input
                    id="description"
                    placeholder="Ex: Consulta Neurológica - Paciente João"
                    {...register("description")}
                  />
                  {errors.description && (
                    <p className="text-sm text-red-600">
                      {errors.description.message}
                    </p>
                  )}
                </div>

                {/* Categoria / Data / Status */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select onValueChange={(v) => setValue("category", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {watchType === "receita" ? (
                          <>
                            <SelectItem value="Consulta">Consulta</SelectItem>
                            <SelectItem value="Avaliação">Avaliação</SelectItem>
                            <SelectItem value="Terapia">Terapia</SelectItem>
                            <SelectItem value="Convênio">Convênio</SelectItem>
                            <SelectItem value="Particular">Particular</SelectItem>
                            <SelectItem value="Outros">Outros</SelectItem>
                          </>
                        ) : (
                          <>
                            <SelectItem value="Aluguel">Aluguel</SelectItem>
                            <SelectItem value="Salários">Salários</SelectItem>
                            <SelectItem value="Equipamentos">Equipamentos</SelectItem>
                            <SelectItem value="Material">Material</SelectItem>
                            <SelectItem value="Marketing">Marketing</SelectItem>
                            <SelectItem value="Impostos">Impostos</SelectItem>
                            <SelectItem value="Outros">Outros</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                    {errors.category && (
                      <p className="text-sm text-red-600">
                        {errors.category.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="date">Data</Label>
                    <Input
                      id="date"
                      type="date"
                      defaultValue={toInputDate(nowLocal())}
                      {...register("date")}
                    />
                    {errors.date && (
                      <p className="text-sm text-red-600">
                        {errors.date.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select onValueChange={(v) => setValue("status", v as any)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pago">✅ Pago</SelectItem>
                        <SelectItem value="pendente">⏳ Pendente</SelectItem>
                        <SelectItem value="cancelado">❌ Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.status && (
                      <p className="text-sm text-red-600">
                        {errors.status.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Pagamento / Parcela / Desconto / Taxa */}
                <div className="rounded-lg border p-3">
                  <p className="text-sm font-medium mb-3">Pagamento</p>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label>Método</Label>
                      <Select
                        value={createPaymentMethod}
                        onValueChange={(v) =>
                          setCreatePaymentMethod(v as PaymentMethod)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pix">Pix</SelectItem>
                          <SelectItem value="cartao">Cartão</SelectItem>
                          <SelectItem value="boleto">Boleto</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Parcelas</Label>
                      <Input
                        type="number"
                        min={1}
                        max={24}
                        disabled={!supportsInstallments(createPaymentMethod)}
                        value={createInstallments}
                        onChange={(e) =>
                          setCreateInstallments(
                            Math.max(1, Math.min(24, Number(e.target.value || 1)))
                          )
                        }
                      />
                      {supportsInstallments(createPaymentMethod) &&
                        Number(createInstallments) > 1 && (
                          <p className="text-xs text-gray-500">
                            {createInstallments}x de{" "}
                            <strong>{formatCurrency(perInstallment)}</strong>
                          </p>
                        )}
                    </div>

                    <div className="space-y-2">
                      <Label>Desconto</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Select
                          value={createDiscountKind}
                          onValueChange={(v) =>
                            setCreateDiscountKind(v as DiscountKind)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percent">% (percentual)</SelectItem>
                            <SelectItem value="valor">R$ (valor)</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          value={createDiscountValue}
                          onChange={(e) =>
                            setCreateDiscountValue(Number(e.target.value || 0))
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Taxa</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Select
                          value={createFeeKind}
                          onValueChange={(v) => setCreateFeeKind(v as FeeKind)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percent">% (percentual)</SelectItem>
                            <SelectItem value="valor">R$ (valor)</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          value={createFeeValue}
                          onChange={(e) =>
                            setCreateFeeValue(Number(e.target.value || 0))
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {/* Vincular Agendamento */}
                  <div className="mt-4 space-y-2">
                    <Label>Vincular a um agendamento (opcional)</Label>
                    <Select
                      value={linkAppointmentId}
                      onValueChange={(v) => setLinkAppointmentId(v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {appointmentOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Preview do valor final */}
                  <div className="mt-4 rounded-md bg-purple-50 border border-purple-200 p-3">
                    <p className="text-sm text-purple-700">
                      Valor final (após desconto/taxa):
                    </p>
                    <p className="text-2xl font-bold text-purple-800">
                      {formatCurrency(finalAmountPreview)}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* MÉTRICAS DO MÊS */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-emerald-50 to-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita do Mês</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700">
              {formatCurrency(totalRevenue)}
            </div>
            <p className="text-xs text-muted-foreground">Valores recebidos</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-rose-50 to-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Despesas do Mês</CardTitle>
            <TrendingDown className="h-4 w-4 text-rose-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-700">
              {formatCurrency(totalExpenses)}
            </div>
            <p className="text-xs text-muted-foreground">Valores pagos</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-indigo-50 to-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lucro Líquido</CardTitle>
            <DollarSign className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                netProfit >= 0 ? "text-emerald-700" : "text-rose-700"
              }`}
            >
              {formatCurrency(netProfit)}
            </div>
            <p className="text-xs text-muted-foreground">Receita - Despesas</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">A Receber</CardTitle>
            <Calendar className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700">
              {formatCurrency(pendingRevenue)}
            </div>
            <p className="text-xs text-muted-foreground">Valores pendentes</p>
          </CardContent>
        </Card>
      </div>

      {/* FILTROS */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <CardTitle>Filtros</CardTitle>
          </div>
          <CardDescription>Refine a lista de transações exibidas</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-12">
          <div className="md:col-span-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por descrição ou categoria..."
                className="pl-9"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
          <div className="md:col-span-2">
            <Select
              value={filterType}
              onValueChange={(v) => {
                setFilterType(v as any);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tipo: Todos</SelectItem>
                <SelectItem value="receita">Receita</SelectItem>
                <SelectItem value="despesa">Despesa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Select
              value={filterStatus}
              onValueChange={(v) => {
                setFilterStatus(v as any);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Status: Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Select
              value={filterPayment}
              onValueChange={(v) => {
                setFilterPayment(v as any);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pagamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Pagamento: Todos</SelectItem>
                <SelectItem value="pix">Pix</SelectItem>
                <SelectItem value="cartao">Cartão</SelectItem>
                <SelectItem value="boleto">Boleto</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-1">
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="md:col-span-1">
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {/* chips de status com contagem */}
          <div className="md:col-span-12">
            <div className="flex flex-wrap gap-2">
              {[
                { key: "pendente", label: "⏳ Pendente", count: contagemStatus.pendente },
                { key: "pago", label: "✅ Pago", count: contagemStatus.pago },
                { key: "cancelado", label: "❌ Cancelado", count: contagemStatus.cancelado },
              ].map((c) => (
                <button
                  key={c.key}
                  onClick={() =>
                    setFilterStatus((prev) =>
                      prev === (c.key as any) ? "all" : (c.key as any)
                    )
                  }
                  className={[
                    "rounded-full border px-3 py-1 text-sm transition",
                    filterStatus === (c.key as any)
                      ? "border-purple-600 bg-purple-50 text-purple-700"
                      : "border-gray-200 hover:bg-gray-50",
                  ].join(" ")}
                >
                  {c.label} • {c.count}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* MÉTRICAS DO RESULTADO FILTRADO */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Receitas (filtrado)</CardTitle>
          </CardHeader>
          <CardContent className="text-emerald-700 text-2xl font-bold">
            {formatCurrency(totalReceitaFiltrado)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Despesas (filtrado)</CardTitle>
          </CardHeader>
          <CardContent className="text-rose-700 text-2xl font-bold">
            {formatCurrency(totalDespesaFiltrado)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Líquido (filtrado)</CardTitle>
          </CardHeader>
          <CardContent
            className={`text-2xl font-bold ${
              totalLiquidoFiltrado >= 0 ? "text-emerald-700" : "text-rose-700"
            }`}
          >
            {formatCurrency(totalLiquidoFiltrado)}
          </CardContent>
        </Card>
      </div>

      {/* TABELA */}
      <Card>
        <CardHeader>
          <CardTitle>🗂️ Transações</CardTitle>
          <CardDescription>
            {filtered.length} registro(s) • página {page} de {totalPages}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto">
          <div className="w-full overflow-x-auto">
            <Table className="min-w-[980px]">
              <TableHeader className="sticky top-0 bg-white z-10">
                <TableRow>
                  <TableHead className="min-w-[110px]">Data</TableHead>
                  <TableHead className="min-w-[110px]">Tipo</TableHead>
                  <TableHead className="min-w-[280px]">Descrição</TableHead>
                  <TableHead className="min-w-[140px]">Categoria</TableHead>
                  <TableHead className="min-w-[140px]">Pagamento</TableHead>
                  <TableHead className="min-w-[140px]">Valor</TableHead>
                  <TableHead className="min-w-[120px]">Status</TableHead>
                  <TableHead className="min-w-[120px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageData.map((record) => {
                  const pm = extractPaymentMethod(record.description || "");
                  return (
                    <TableRow
                      key={record.id}
                      className="hover:bg-gray-50/80 transition-colors"
                    >
                      <TableCell>{formatDateBR(record.date)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            record.type === "receita" ? "default" : "destructive"
                          }
                        >
                          {record.type === "receita" ? "💰 Receita" : "💸 Despesa"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{record.description}</TableCell>
                      <TableCell>{record.category}</TableCell>
                      <TableCell>{paymentBadge(pm)}</TableCell>
                      <TableCell
                        className={[
                          "font-semibold",
                          record.type === "receita"
                            ? "text-emerald-700"
                            : "text-rose-700",
                        ].join(" ")}
                      >
                        {record.type === "receita" ? "+" : "-"}{" "}
                        {formatCurrency(record.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            record.status === "pago"
                              ? "default"
                              : record.status === "pendente"
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {record.status === "pago"
                            ? "✅ Pago"
                            : record.status === "pendente"
                            ? "⏳ Pendente"
                            : "❌ Cancelado"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(record)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(record)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {pageData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <div className="py-10 text-center text-gray-500">
                        Nenhum registro encontrado com os filtros atuais.
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          </div>

          {/* paginação + totais do recorte atual */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4">
            <div className="text-sm text-gray-600">
              Mostrando{" "}
              <strong>
                {(page - 1) * pageSize + 1}-
                {Math.min(page * pageSize, filtered.length)}
              </strong>{" "}
              de <strong>{filtered.length}</strong>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <span className="text-sm">
                Página <strong>{page}</strong> / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Próxima
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* TABS rápidas (atalhos) */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">Todas</TabsTrigger>
          <TabsTrigger value="receita">Receitas</TabsTrigger>
          <TabsTrigger value="despesa">Despesas</TabsTrigger>
          <TabsTrigger value="pendente">Pendentes</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          {/* já coberto pela tabela principal acima */}
        </TabsContent>

        <TabsContent value="receita">
          <div className="text-sm text-gray-600">
            Dica: use o filtro “Tipo: Receita” para a mesma visualização na tabela
            principal.
          </div>
        </TabsContent>

        <TabsContent value="despesa">
          <div className="text-sm text-gray-600">
            Dica: use o filtro “Tipo: Despesa” para a mesma visualização na tabela
            principal.
          </div>
        </TabsContent>

        <TabsContent value="pendente">
          <Card>
            <CardHeader>
              <CardTitle>⏳ Transações Pendentes</CardTitle>
              <CardDescription>Marque como pago quando receber</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="w-full overflow-x-auto">
                <Table className="min-w-[720px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {financialRecords
                    .filter((r) => r.status === "pendente")
                    .sort(
                      (a, b) =>
                        new Date(b.date).getTime() - new Date(a.date).getTime()
                    )
                    .map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>
                          {formatDateBR(record.date)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              record.type === "receita" ? "default" : "destructive"
                            }
                          >
                            {record.type === "receita" ? "💰 Receita" : "💸 Despesa"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {record.description}
                        </TableCell>
                        <TableCell>{record.category}</TableCell>
                        <TableCell
                          className={
                            record.type === "receita"
                              ? "text-emerald-700 font-semibold"
                              : "text-rose-700 font-semibold"
                          }
                        >
                          {record.type === "receita" ? "+" : "-"}{" "}
                          {formatCurrency(record.amount)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                const ok = await updateFinancialRecord(record.id, {
                                  status: "pago",
                                } as any);
                                if (ok) toast.success("✅ Status atualizado para PAGO!");
                              }}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Marcar como Pago
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(record)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDelete(record)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  {financialRecords.filter((r) => r.status === "pendente").length ===
                    0 && (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <div className="py-8 text-center text-gray-500">
                          Nenhuma transação pendente.
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ALERTA */}
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="text-red-800">
            🗑️ Aviso sobre Exclusões
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-700 space-y-2">
            <p>
              <strong>⚠️ ATENÇÃO:</strong> Botões vermelhos de “Excluir” fazem{" "}
              <strong>exclusão permanente</strong> no banco.
            </p>
            <p>
              <strong>❌ Não há recuperação</strong> após confirmar a exclusão.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* DIALOG DE EDIÇÃO */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Transação</DialogTitle>
            <DialogDescription>Atualize os dados do registro</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitEdit(onSubmitEdit)} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select onValueChange={(v) => setValueEdit("type", v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="receita">💰 Receita</SelectItem>
                    <SelectItem value="despesa">💸 Despesa</SelectItem>
                  </SelectContent>
                </Select>
                {errorsEdit.type && (
                  <p className="text-sm text-red-600">
                    {errorsEdit.type.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-amount">Valor (R$)</Label>
                <Input
                  id="edit-amount"
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  {...registerEdit("amount", { valueAsNumber: true })}
                />
                {errorsEdit.amount && (
                  <p className="text-sm text-red-600">
                    {errorsEdit.amount.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Descrição</Label>
              <Input
                id="edit-description"
                placeholder="Descrição da transação"
                {...registerEdit("description")}
              />
              {errorsEdit.description && (
                <p className="text-sm text-red-600">
                  {errorsEdit.description.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select onValueChange={(v) => setValueEdit("category", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {watchEditType === "receita" ? (
                      <>
                        <SelectItem value="Consulta">Consulta</SelectItem>
                        <SelectItem value="Avaliação">Avaliação</SelectItem>
                        <SelectItem value="Terapia">Terapia</SelectItem>
                        <SelectItem value="Convênio">Convênio</SelectItem>
                        <SelectItem value="Particular">Particular</SelectItem>
                        <SelectItem value="Outros">Outros</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="Aluguel">Aluguel</SelectItem>
                        <SelectItem value="Salários">Salários</SelectItem>
                        <SelectItem value="Equipamentos">Equipamentos</SelectItem>
                        <SelectItem value="Material">Material</SelectItem>
                        <SelectItem value="Marketing">Marketing</SelectItem>
                        <SelectItem value="Impostos">Impostos</SelectItem>
                        <SelectItem value="Outros">Outros</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
                {errorsEdit.category && (
                  <p className="text-sm text-red-600">
                    {errorsEdit.category.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-date">Data</Label>
                <Input id="edit-date" type="date" {...registerEdit("date")} />
                {errorsEdit.date && (
                  <p className="text-sm text-red-600">
                    {errorsEdit.date.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select onValueChange={(v) => setValueEdit("status", v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pago">✅ Pago</SelectItem>
                    <SelectItem value="pendente">⏳ Pendente</SelectItem>
                    <SelectItem value="cancelado">❌ Cancelado</SelectItem>
                  </SelectContent>
                </Select>
                {errorsEdit.status && (
                  <p className="text-sm text-red-600">
                    {errorsEdit.status.message}
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
              >
                <X className="mr-2 h-4 w-4" />
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmittingEdit}>
                <Save className="mr-2 h-4 w-4" />
                {isSubmittingEdit ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default FinancialModule;
