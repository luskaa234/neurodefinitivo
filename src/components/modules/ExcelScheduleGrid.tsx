"use client";

import React, { useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import ptBr from "@fullcalendar/core/locales/pt-br";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Command, CommandList, CommandGroup, CommandItem } from "@/components/ui/command";

import { toast } from "sonner";
import { Plus, X, ChevronsUpDown, Check, Trash2, Pencil } from "lucide-react";

import { useApp } from "@/contexts/AppContext";

/* ======================================================
   STATUS
====================================================== */
type UIStatus = "agendado" | "confirmado" | "realizado" | "cancelado";
type DBStatus = "pendente" | "confirmado" | "realizado" | "cancelado";

const toDbStatus = (s: UIStatus): DBStatus => (s === "agendado" ? "pendente" : s);
const toUiStatus = (s: DBStatus | string): UIStatus => (s === "pendente" ? "agendado" : (s as UIStatus));

const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/* ======================================================
   TIPOS AUX (flexível com seu BD)
====================================================== */
type AptLike = {
  id: string;
  patient_id: string;
  doctor_id: string;
  date: string;
  time: string;
  type: string;
  price: number;
  status: DBStatus | string;
  notes?: string;

  // no seu Contexto final você usa doctor_ids (múltiplos)
  doctor_ids?: string[];
  // compat caso em algum lugar venha doctors
  doctors?: string[];
};

/* ======================================================
   COMPONENTE
====================================================== */
export default function AgendaCalendario() {
  const { appointments, patients, doctors, services, addAppointment, updateAppointment, deleteAppointment } = useApp();

  /* ======================================================
     ESTADOS UI
  ====================================================== */
  const [adicionando, setAdicionando] = useState(false);
  const [editando, setEditando] = useState(false);
  const [eventoSelecionado, setEventoSelecionado] = useState<AptLike | null>(null);

  const [filtroMedico, setFiltroMedico] = useState<string>("all");
  const [filtroStatus, setFiltroStatus] = useState<UIStatus | "all">("all");
  const [filtroData, setFiltroData] = useState<string>("");
  const [busca, setBusca] = useState<string>("");

  const [form, setForm] = useState({
    patient_id: "",
    doctor_ids: [] as string[],
    date: "",
    time: "",
    type: "",
    price: "",
    notes: "",
    status: "agendado" as UIStatus,
  });

  /* ======================================================
     HELPERS
  ====================================================== */
  const getPaciente = (id: string) => patients.find((p) => p.id === id)?.name || "Paciente";
  const getMedico = (id: string) => doctors.find((d) => d.id === id)?.name || "Médico";

  const duracaoServico = (type: string) => services.find((s) => s.name === type)?.duration ?? 60;

  const toISO = (date: string, time: string) => `${date}T${time.length === 5 ? `${time}:00` : time}`;

 const getAllDoctors = (apt: AptLike) => {
  const ids = new Set<string>();

  if (apt.doctor_id) {
    ids.add(apt.doctor_id);
  }

  const extras = apt.doctor_ids ?? apt.doctors ?? [];
  extras.forEach((id) => {
    if (id) ids.add(id);
  });

  return Array.from(ids);
};


  /* ======================================================
     CONFLITO REAL (multimédicos)
  ====================================================== */
  const temConflito = (doctorIds: string[], date: string, time: string, durationMin: number, ignoreId?: string) => {
    if (!doctorIds.length) return false;

    const inicio = new Date(`${date}T${time}`);
    const fim = new Date(inicio);
    fim.setMinutes(fim.getMinutes() + durationMin);

    const overlap = (a1: Date, a2: Date, b1: Date, b2: Date) => a1 < b2 && a2 > b1;

    return (appointments as unknown as AptLike[]).some((apt) => {
      if (ignoreId && apt.id === ignoreId) return false;
      if (apt.date !== date) return false;

      const aptDoctors = getAllDoctors(apt);
      const medicoEmComum = aptDoctors.some((d) => doctorIds.includes(d));
      if (!medicoEmComum) return false;

      const i = new Date(`${apt.date}T${apt.time}`);
      const f = new Date(i);
      f.setMinutes(f.getMinutes() + duracaoServico(apt.type));

      return overlap(inicio, fim, i, f);
    });
  };

  /* ======================================================
     FILTROS
  ====================================================== */
  const baseFiltrada = useMemo(() => {
    return (appointments as unknown as AptLike[]).filter((apt) => {
      const paciente = getPaciente(apt.patient_id).toLowerCase();
      const medicosTxt = getAllDoctors(apt).map(getMedico).join(" ").toLowerCase();
      const typeTxt = (apt.type || "").toLowerCase();

      const statusUI = toUiStatus(apt.status);

      const buscaOk =
        !busca ||
        paciente.includes(busca.toLowerCase()) ||
        medicosTxt.includes(busca.toLowerCase()) ||
        typeTxt.includes(busca.toLowerCase());

      const medicoOk = filtroMedico === "all" ? true : getAllDoctors(apt).includes(filtroMedico);
      const statusOk = filtroStatus === "all" ? true : statusUI === filtroStatus;
      const dataOk = !filtroData || apt.date === filtroData;

      return buscaOk && medicoOk && statusOk && dataOk;
    });
  }, [appointments, busca, filtroMedico, filtroStatus, filtroData]);

  /* ======================================================
     EVENTOS CALENDÁRIO (estilo Excel)
  ====================================================== */
  const eventos = useMemo(() => {
    return baseFiltrada.map((apt) => {
      const duration = duracaoServico(apt.type);
      const conflito = temConflito(getAllDoctors(apt), apt.date, apt.time, duration, apt.id);
      const statusUI = toUiStatus(apt.status);

      // cores discretas (parecido com planilha, sem “neon”)
      const cor =
        conflito
          ? "#B91C1C" // vermelho discreto
          : statusUI === "confirmado"
          ? "#4C1D95" // roxo escuro
          : statusUI === "realizado"
          ? "#065F46" // verde escuro
          : statusUI === "cancelado"
          ? "#374151" // cinza escuro
          : "#92400E"; // amarelo/âmbar escuro

      return {
        id: apt.id,
        title: `${getPaciente(apt.patient_id)} • ${apt.type}`,
        start: toISO(apt.date, apt.time),
        end: new Date(new Date(`${apt.date}T${apt.time}`).getTime() + duration * 60000).toISOString(),
        extendedProps: { ...apt, _conflito: conflito, _statusUI: statusUI },
        backgroundColor: cor,
        borderColor: cor,
        textColor: "#FFFFFF",
        classNames: ["excel-event"],
      };
    });
  }, [baseFiltrada, services, appointments]);

  /* ======================================================
     AÇÕES
  ====================================================== */
  const abrirNovo = () => {
    setEventoSelecionado(null);
    setEditando(false);
    setAdicionando(true);
    setForm({
      patient_id: "",
      doctor_ids: [],
      date: "",
      time: "",
      type: "",
      price: "",
      notes: "",
      status: "agendado",
    });
  };

  const abrirDetalhes = (apt: AptLike) => {
    setAdicionando(false);
    setEditando(false);
    setEventoSelecionado(apt);
  };

  const abrirEditar = (apt: AptLike) => {
    setAdicionando(false);
    setEditando(true);
    setEventoSelecionado(apt);

    // mantém a regra: 1º médico = principal
    const all = getAllDoctors(apt);
    setForm({
      patient_id: apt.patient_id || "",
      doctor_ids: all,
      date: apt.date || "",
      time: apt.time || "",
      type: apt.type || "",
      price: apt.price !== undefined && apt.price !== null ? String(apt.price) : "",
      notes: apt.notes || "",
      status: toUiStatus(apt.status),
    });
  };

  const fecharPainel = () => {
    setEventoSelecionado(null);
    setAdicionando(false);
    setEditando(false);
  };

  async function salvarNovo() {
    if (!form.patient_id || !form.date || !form.time || !form.type || form.doctor_ids.length === 0) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    const duration = duracaoServico(form.type);
    if (temConflito(form.doctor_ids, form.date, form.time, duration)) {
      toast.error("Conflito de horário entre médicos");
      return;
    }

    // ✅ IMPORTANTE: seu BD exige doctor_id NOT NULL
    const doctor_id = form.doctor_ids[0];
    if (!doctor_id) {
      toast.error("Selecione ao menos 1 médico (principal).");
      return;
    }

    const ok = await addAppointment({
      patient_id: form.patient_id,
      doctor_id, // obrigatório no appointments
      doctor_ids: form.doctor_ids, // relação na appointment_doctors (contexto)
      date: form.date,
      time: form.time,
      type: form.type,
      price: Number(form.price) || 0,
      notes: form.notes,
      status: toDbStatus(form.status),
    } as any);

    if (ok) {
      toast.success("Agendamento criado");
      fecharPainel();
    } else {
      toast.error("Erro ao criar agendamento");
    }
  }

  async function salvarEdicao() {
    if (!eventoSelecionado) return;

    if (!form.patient_id || !form.date || !form.time || !form.type || form.doctor_ids.length === 0) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    const duration = duracaoServico(form.type);
    if (temConflito(form.doctor_ids, form.date, form.time, duration, eventoSelecionado.id)) {
      toast.error("Conflito de horário entre médicos");
      return;
    }

    const doctor_id = form.doctor_ids[0];
    if (!doctor_id) {
      toast.error("Selecione ao menos 1 médico (principal).");
      return;
    }

    const ok = await updateAppointment(eventoSelecionado.id, {
      patient_id: form.patient_id,
      doctor_id,
      doctor_ids: form.doctor_ids,
      date: form.date,
      time: form.time,
      type: form.type,
      price: Number(form.price) || 0,
      notes: form.notes,
      status: toDbStatus(form.status),
    } as any);

    if (ok) {
      toast.success("Agendamento atualizado");
      setEventoSelecionado((old) =>
        old
          ? ({
              ...old,
              patient_id: form.patient_id,
              doctor_id,
              doctor_ids: form.doctor_ids,
              date: form.date,
              time: form.time,
              type: form.type,
              price: Number(form.price) || 0,
              notes: form.notes,
              status: toDbStatus(form.status),
            } as AptLike)
          : old
      );
      setEditando(false);
    } else {
      toast.error("Erro ao atualizar agendamento");
    }
  }

  async function excluirSelecionado() {
    if (!eventoSelecionado) return;
    if (!confirm("Excluir este agendamento?")) return;

    const ok = await deleteAppointment(eventoSelecionado.id);
    if (ok) {
      toast.success("Agendamento excluído");
      fecharPainel();
    } else {
      toast.error("Erro ao excluir");
    }
  }

  /* ======================================================
     CONFLITO DO FORM (real-time)
  ====================================================== */
  const conflitoForm = useMemo(() => {
    if (!form.date || !form.time || !form.type || form.doctor_ids.length === 0) return false;
    const duration = duracaoServico(form.type);

    if (editando && eventoSelecionado?.id) {
      return temConflito(form.doctor_ids, form.date, form.time, duration, eventoSelecionado.id);
    }
    return temConflito(form.doctor_ids, form.date, form.time, duration);
  }, [form, editando, eventoSelecionado, services, appointments]);

  /* ======================================================
     UI (filtros/status)
  ====================================================== */
  const statusOptions: { key: UIStatus; label: string }[] = [
    { key: "agendado", label: "Agendado" },
    { key: "confirmado", label: "Confirmado" },
    { key: "realizado", label: "Realizado" },
    { key: "cancelado", label: "Cancelado" },
  ];

  const limparFiltros = () => {
    setBusca("");
    setFiltroMedico("all");
    setFiltroStatus("all");
    setFiltroData("");
  };

  return (
    <div className="flex h-[90vh] bg-white border border-gray-200 rounded-md overflow-hidden">
      {/* ===================== ESQUERDA (Excel-like) ===================== */}
      <aside className="w-[320px] bg-gray-50 border-r border-gray-200 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Agendamentos</h2>
            <p className="text-[11px] text-gray-500">Layout estilo planilha</p>
          </div>
          <Button size="sm" className="h-8 px-3 bg-gray-900 hover:bg-gray-800 text-white" onClick={abrirNovo}>
            <Plus className="w-4 h-4 mr-1" /> Novo
          </Button>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] text-gray-600">Buscar</label>
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Paciente, médico, tipo..."
            className="h-9 bg-white border-gray-300 focus:border-gray-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[11px] text-gray-600">Médico</label>
            <Select value={filtroMedico} onValueChange={setFiltroMedico}>
              <SelectTrigger className="h-9 bg-white border-gray-300">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {doctors.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-gray-600">Status</label>
            <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as any)}>
              <SelectTrigger className="h-9 bg-white border-gray-300">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {statusOptions.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] text-gray-600">Data</label>
          <Input
            type="date"
            value={filtroData}
            onChange={(e) => setFiltroData(e.target.value)}
            className="h-9 bg-white border-gray-300"
          />
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="h-9 flex-1 border-gray-300" onClick={limparFiltros}>
            Limpar
          </Button>
          <Button
            variant="outline"
            className="h-9 w-[120px] border-gray-300"
            onClick={() => {
              // atalho rápido: hoje
              const today = new Date();
              const yyyy = today.getFullYear();
              const mm = String(today.getMonth() + 1).padStart(2, "0");
              const dd = String(today.getDate()).padStart(2, "0");
              setFiltroData(`${yyyy}-${mm}-${dd}`);
            }}
          >
            Hoje
          </Button>
        </div>

        <div className="rounded-md border border-gray-200 bg-white p-2">
          <div className="text-[11px] text-gray-600 font-medium mb-1">Legenda</div>
          <div className="grid grid-cols-2 gap-1 text-[11px] text-gray-600">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#92400E]" />
              Agendado
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#4C1D95]" />
              Confirmado
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#065F46]" />
              Realizado
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#374151]" />
              Cancelado
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#B91C1C]" />
              Conflito
            </div>
          </div>
        </div>
      </aside>

      {/* ===================== CALENDÁRIO (Excel-like grid) ===================== */}
      <main className="flex-1 bg-white p-2">
        <style jsx global>{`
          /* ======== Excel-like FullCalendar ======== */
          .fc {
            font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, "Noto Sans", "Liberation Sans",
              sans-serif;
            font-size: 12px;
          }
          .fc .fc-toolbar-title {
            font-size: 14px;
            font-weight: 600;
            color: #111827;
          }
          .fc .fc-button {
            border-radius: 4px !important;
            border: 1px solid #d1d5db !important;
            background: #ffffff !important;
            color: #111827 !important;
            box-shadow: none !important;
            padding: 4px 8px !important;
            font-size: 12px !important;
          }
          .fc .fc-button:hover {
            background: #f3f4f6 !important;
          }
          .fc .fc-button-primary:not(:disabled).fc-button-active,
          .fc .fc-button-primary:not(:disabled):active {
            background: #111827 !important;
            color: #fff !important;
            border-color: #111827 !important;
          }
          .fc .fc-scrollgrid,
          .fc .fc-scrollgrid-section > * {
            border-color: #e5e7eb !important;
          }
          .fc .fc-col-header-cell {
            background: #f9fafb !important;
          }
          .fc .fc-col-header-cell-cushion {
            padding: 6px 0;
            font-weight: 600;
            color: #374151;
          }
          .fc .fc-daygrid-day-number {
            color: #374151;
            font-size: 12px;
          }
          .fc .fc-timegrid-slot-label,
          .fc .fc-timegrid-axis-cushion {
            color: #374151;
            font-size: 11px;
          }
          .fc .fc-timegrid-slot {
            height: 26px;
          }
          .fc .fc-event {
            border-radius: 2px !important;
            border-width: 1px !important;
          }
          .fc .excel-event .fc-event-main {
            padding: 2px 4px;
          }
        `}</style>

        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridDay"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "timeGridDay,timeGridWeek,dayGridMonth",
          }}
          locale="pt-br"
          locales={[ptBr]}
          events={eventos}
          editable
          nowIndicator
          allDaySlot={false}
          height="100%"
          slotMinTime="07:00:00"
          slotMaxTime="22:00:00"
          eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
          // “cara de planilha”: mais linhas visíveis no mês
          dayMaxEventRows={4}
          // click
          eventClick={(info) => abrirDetalhes(info.event.extendedProps as AptLike)}
          // drag/drop com bloqueio
          eventDrop={async (info) => {
            const apt = info.event.extendedProps as AptLike;
            const start = info.event.start;
            if (!start) return;

            const date = start.toISOString().slice(0, 10);
            const time = start.toTimeString().slice(0, 5);

            const duration = duracaoServico(apt.type);
            const doctorsAll = getAllDoctors(apt);

            if (temConflito(doctorsAll, date, time, duration, apt.id)) {
              info.revert();
              toast.error("Conflito: horário já ocupado");
              return;
            }

            const ok = await updateAppointment(apt.id, { date, time } as any);
            if (ok) toast.success("Horário atualizado");
            else {
              info.revert();
              toast.error("Erro ao atualizar");
            }
          }}
          // evento “estilo Excel”: texto compacto e objetivo
          eventContent={(arg) => {
            const ext = arg.event.extendedProps as any;
            const statusUI: UIStatus = ext?._statusUI || toUiStatus(ext?.status || "pendente");
            const conflito = !!ext?._conflito;

            const timeText = arg.timeText ? `${arg.timeText} ` : "";
            const title = arg.event.title;

            return (
              <div className="w-full">
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate font-medium">
                    {timeText}
                    {title}
                  </div>
                  {conflito ? (
                    <span className="ml-2 text-[10px] font-bold">⚠</span>
                  ) : (
                    <span className="ml-2 text-[10px] opacity-90">
                      {statusUI === "agendado"
                        ? "A"
                        : statusUI === "confirmado"
                        ? "C"
                        : statusUI === "realizado"
                        ? "R"
                        : "X"}
                    </span>
                  )}
                </div>
              </div>
            );
          }}
        />
      </main>

      {/* ===================== PAINEL DIREITO (compact) ===================== */}
      {(adicionando || eventoSelecionado) && (
        <aside className="w-[420px] bg-white border-l border-gray-200 p-3 overflow-y-auto">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                {adicionando ? "Novo Agendamento" : editando ? "Editar Agendamento" : "Detalhes"}
              </h2>
              <p className={cn("text-[11px]", conflitoForm ? "text-red-600" : "text-gray-500")}>
                {conflitoForm ? "⚠ Conflito detectado: ajuste data/hora/médicos." : "Preencha e salve."}
              </p>
            </div>
            <button onClick={fecharPainel} className="p-1 hover:bg-gray-100 rounded">
              <X className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          {/* ========= FORM (novo/editar) ========= */}
          {(adicionando || editando) && (
            <div className="space-y-3">
              <div className={cn("rounded-md border p-2", conflitoForm ? "border-red-200 bg-red-50" : "border-gray-200 bg-gray-50")}>
                <p className="text-[11px] text-gray-700">
                  Médicos:{" "}
                  <span className="font-semibold">
                    {form.doctor_ids.length ? form.doctor_ids.map(getMedico).join(", ") : "Nenhum"}
                  </span>
                </p>
                <p className="text-[10px] text-gray-500">
                  O <b>1º</b> médico vira o <b>principal</b> (campo obrigatório no banco).
                </p>
              </div>

              {/* PACIENTE */}
              <div className="space-y-1">
                <label className="text-[11px] text-gray-600">Paciente*</label>
                <Select value={form.patient_id} onValueChange={(v) => setForm((s) => ({ ...s, patient_id: v }))}>
                  <SelectTrigger className="h-9 border-gray-300">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {patients.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* MÉDICOS MULTI */}
              <div className="space-y-1">
                <label className="text-[11px] text-gray-600">Médicos*</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-9 w-full justify-between border-gray-300">
                      {form.doctor_ids.length ? `${form.doctor_ids.length} selecionado(s)` : "Selecionar médicos"}
                      <ChevronsUpDown className="w-4 h-4 opacity-60" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[360px] p-0">
                    <Command shouldFilter={false}>
                      <CommandList>
                        <CommandGroup heading="Médicos">
                          {doctors.map((d) => {
                            const checked = form.doctor_ids.includes(d.id);
                            return (
                              <CommandItem
                                key={d.id}
                                onSelect={() => {
                                  setForm((s) => ({
                                    ...s,
                                    doctor_ids: checked ? s.doctor_ids.filter((x) => x !== d.id) : [...s.doctor_ids, d.id],
                                  }));
                                }}
                                className="flex items-center gap-2"
                              >
                                <Check className={cn("w-4 h-4", checked ? "opacity-100" : "opacity-0")} />
                                <span className="text-sm">{d.name}</span>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* DATA/HORA */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[11px] text-gray-600">Data*</label>
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((s) => ({ ...s, date: e.target.value }))}
                    className="h-9 border-gray-300"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-gray-600">Hora*</label>
                  <Input
                    type="time"
                    value={form.time}
                    onChange={(e) => setForm((s) => ({ ...s, time: e.target.value }))}
                    className="h-9 border-gray-300"
                  />
                </div>
              </div>

              {/* TIPO */}
              <div className="space-y-1">
                <label className="text-[11px] text-gray-600">Tipo*</label>
                <Input
                  value={form.type}
                  onChange={(e) => setForm((s) => ({ ...s, type: e.target.value }))}
                  placeholder="Ex: Consulta, Avaliação..."
                  className="h-9 border-gray-300"
                />
                <p className="text-[10px] text-gray-500">
                  Duração usada p/ conflito: <b>{duracaoServico(form.type)} min</b>
                </p>
              </div>

              {/* STATUS */}
              <div className="space-y-1">
                <label className="text-[11px] text-gray-600">Status</label>
                <Select value={form.status} onValueChange={(v) => setForm((s) => ({ ...s, status: v as UIStatus }))}>
                  <SelectTrigger className="h-9 border-gray-300">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((s) => (
                      <SelectItem key={s.key} value={s.key}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* VALOR */}
              <div className="space-y-1">
                <label className="text-[11px] text-gray-600">Valor (R$)</label>
                <Input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm((s) => ({ ...s, price: e.target.value }))}
                  placeholder="0,00"
                  className="h-9 border-gray-300"
                />
              </div>

              {/* OBS */}
              <div className="space-y-1">
                <label className="text-[11px] text-gray-600">Observações</label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
                  placeholder="Opcional..."
                  className="min-h-[90px] border-gray-300"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  className="flex-1 h-9 bg-gray-900 hover:bg-gray-800 text-white"
                  onClick={adicionando ? salvarNovo : salvarEdicao}
                  disabled={conflitoForm}
                >
                  {adicionando ? "Salvar" : "Salvar alterações"}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 h-9 border-gray-300"
                  onClick={() => (adicionando ? fecharPainel() : setEditando(false))}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* ========= DETALHES ========= */}
          {!adicionando && !editando && eventoSelecionado && (
            <div className="space-y-3">
              <div className="rounded-md border border-gray-200 p-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="col-span-2">
                    <div className="text-[11px] text-gray-500">Paciente</div>
                    <div className="font-medium text-gray-900">{getPaciente(eventoSelecionado.patient_id)}</div>
                  </div>

                  <div className="col-span-2">
                    <div className="text-[11px] text-gray-500">Médicos</div>
                    <div className="font-medium text-gray-900">
                      {getAllDoctors(eventoSelecionado).map(getMedico).join(", ")}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] text-gray-500">Data</div>
                    <div className="font-medium text-gray-900">{eventoSelecionado.date}</div>
                  </div>

                  <div>
                    <div className="text-[11px] text-gray-500">Hora</div>
                    <div className="font-medium text-gray-900">{eventoSelecionado.time}</div>
                  </div>

                  <div className="col-span-2">
                    <div className="text-[11px] text-gray-500">Tipo</div>
                    <div className="font-medium text-gray-900">{eventoSelecionado.type}</div>
                  </div>

                  <div>
                    <div className="text-[11px] text-gray-500">Status</div>
                    <div className="font-medium text-gray-900">{toUiStatus(eventoSelecionado.status)}</div>
                  </div>

                  <div>
                    <div className="text-[11px] text-gray-500">Valor</div>
                    <div className="font-medium text-gray-900">
                      R$ {Number(eventoSelecionado.price || 0).toFixed(2)}
                    </div>
                  </div>
                </div>

                {!!(eventoSelecionado as any)._conflito && (
                  <div className="mt-3 text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
                    ⚠️ CONFLITO DETECTADO
                  </div>
                )}

                {eventoSelecionado.notes ? (
                  <div className="mt-3">
                    <div className="text-[11px] text-gray-500">Observações</div>
                    <div className="text-sm text-gray-900 whitespace-pre-wrap">{eventoSelecionado.notes}</div>
                  </div>
                ) : null}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 h-9 border-gray-300"
                  onClick={() => abrirEditar(eventoSelecionado)}
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Editar
                </Button>

                <Button variant="destructive" className="flex-1 h-9" onClick={excluirSelecionado}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir
                </Button>
              </div>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}
