"use client";

import React, { useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin, { DateClickArg } from "@fullcalendar/interaction";
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
import {
  Command,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandEmpty,
} from "@/components/ui/command";

import { toast } from "sonner";
import {
  Plus,
  X,
  ChevronsUpDown,
  Check,
  Trash2,
  Pencil,
  CalendarDays,
  RefreshCw,
} from "lucide-react";

import { useApp } from "@/contexts/AppContext";

/* ======================================================
   TIPOS
====================================================== */
type UIStatus = "agendado" | "confirmado" | "realizado" | "cancelado";
type DBStatus = "pendente" | "confirmado" | "realizado" | "cancelado";

const toDbStatus = (s: UIStatus): DBStatus => (s === "agendado" ? "pendente" : s);
const toUiStatus = (s: DBStatus | string): UIStatus => (s === "pendente" ? "agendado" : (s as UIStatus));

type AptLike = {
  id: string;
  patient_id: string;
  patient_ids?: string[];
  doctor_id: string;
  doctor_ids?: string[];
  date: string;  // YYYY-MM-DD
  time: string;  // HH:mm
  type: string;
  price: number;
  status: DBStatus | string;
  notes?: string;
  is_fixed?: boolean;

};

type FormState = {
  patient_ids: string[];
  doctor_ids: string[];
  date: string;
  time: string;
  type: string;
  price: string;
  notes: string;
  status: UIStatus;
};

const normalizeTime = (time?: string) => {
  if (!time) return "";

  // pega apenas HH:mm independente do formato
  const match = time.match(/(\d{2}):(\d{2})/);
  if (!match) return "";

  return `${match[1]}:${match[2]}`;
};

/* ======================================================
   UTILS
====================================================== */
const cn = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(" ");

const pad2 = (n: number) => String(n).padStart(2, "0");

const toDateStr = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const toTimeStr = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

const uniq = (arr: string[]) => Array.from(new Set(arr.filter(Boolean)));

const hashColor = (id: string) => {
  // cor determinística por id (médico principal)
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 70% 45%)`;
};

const statusColor = (statusUI: UIStatus) => {
  if (statusUI === "confirmado") return "#7C3AED";
  if (statusUI === "realizado") return "#059669";
  if (statusUI === "cancelado") return "#374151";
  return "#D97706"; // agendado
};



function addMinutes(date: Date, minutes: number) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && aEnd > bStart;
}

/* ======================================================
   COMPONENTE
====================================================== */
export default function ExcelScheduleGrid() {
  const {
    appointments,
    patients,
    doctors,
    services,
    addAppointment,
    updateAppointment,
    deleteAppointment,
  } = useApp();

  /* ======================================================
     ESTADOS
  ====================================================== */
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<AptLike | null>(null);

  // filtros
  const [search, setSearch] = useState("");
  const [filterPatient, setFilterPatient] = useState("all");
  const [filterDoctor, setFilterDoctor] = useState("all");
  const [filterStatus, setFilterStatus] = useState<UIStatus | "all">("all");
  const [filterDate, setFilterDate] = useState("");

  // form
  const [form, setForm] = useState<FormState>({
    patient_ids: [],
    doctor_ids: [],
    date: "",
    time: "",
    type: "",
    price: "",
    notes: "",
    status: "agendado",
  });

  /* ======================================================
     HELPERS (dados)
  ====================================================== */
  const getPaciente = (id: string) => patients.find((p) => p.id === id)?.name || "Paciente";
  const getMedico = (id: string) => doctors.find((d) => d.id === id)?.name || "Médico";

  const getAllPatients = (apt: AptLike) => (apt.patient_ids?.length ? apt.patient_ids : uniq([apt.patient_id]));
  const getAllDoctors = (apt: AptLike) => (apt.doctor_ids?.length ? apt.doctor_ids : uniq([apt.doctor_id]));

  const duracaoServico = (type: string) => services.find((s) => s.name === type)?.duration ?? 60;

  const formDuration = useMemo(() => duracaoServico(form.type), [form.type, services]);

  /* ======================================================
     CONFLITO REAL (multi médicos)
  ====================================================== */
  const hasConflict = (doctorIds: string[], date: string, time: string, durationMin: number, ignoreId?: string) => {
    if (!doctorIds.length || !date || !time) return false;

    const start = new Date(`${date}T${time}:00`);
    const end = addMinutes(start, durationMin);

    return (appointments as unknown as AptLike[]).some((apt) => {
      if (ignoreId && apt.id === ignoreId) return false;
      if (apt.date !== date) return false;

      const aptDoctors = getAllDoctors(apt);
      const shareDoctor = aptDoctors.some((d) => doctorIds.includes(d));
      if (!shareDoctor) return false;

      const aStart = new Date(`${apt.date}T${apt.time}:00`);
      const aEnd = addMinutes(aStart, duracaoServico(apt.type));
      return overlaps(start, end, aStart, aEnd);
    });
  };

  const conflictForm = useMemo(() => {
    if (!form.date || !form.time || !form.type || form.doctor_ids.length === 0) return false;
    const ignore = editing && selected?.id ? selected.id : undefined;
    return hasConflict(form.doctor_ids, form.date, form.time, duracaoServico(form.type), ignore);
  }, [form, editing, selected, appointments, services]);

  /* ======================================================
     FILTROS (lista do calendário)
  ====================================================== */
  const filtered = useMemo(() => {
    return (appointments as unknown as AptLike[]).filter((apt) => {
      const pacientesTxt = getAllPatients(apt).map(getPaciente).join(" ").toLowerCase();
      const medicosTxt = getAllDoctors(apt).map(getMedico).join(" ").toLowerCase();
      const typeTxt = (apt.type || "").toLowerCase();
      const statusUI = toUiStatus(apt.status);

      if (search) {
        const q = search.toLowerCase();
        if (!pacientesTxt.includes(q) && !medicosTxt.includes(q) && !typeTxt.includes(q)) return false;
      }

      if (filterPatient !== "all" && !getAllPatients(apt).includes(filterPatient)) return false;
      if (filterDoctor !== "all" && !getAllDoctors(apt).includes(filterDoctor)) return false;
      if (filterStatus !== "all" && statusUI !== filterStatus) return false;
      if (filterDate && apt.date !== filterDate) return false;

      return true;
    });
  }, [appointments, search, filterPatient, filterDoctor, filterStatus, filterDate]);

  /* ======================================================
     EVENTOS
  ====================================================== */
  const events = useMemo(() => {
  return filtered
    .map((apt) => {
      // 🔒 PROTEÇÕES ABSOLUTAS
      if (!apt.date || !apt.time) return null;

      const safeTime = normalizeTime(apt.time);
      if (!safeTime) return null;

      const startDate = new Date(`${apt.date}T${safeTime}:00`);
      if (isNaN(startDate.getTime())) return null;

      const duration = duracaoServico(apt.type);
      const endDate = addMinutes(startDate, duration);

      const statusUI = toUiStatus(apt.status);
      const baseColor = statusColor(statusUI);

      const doctorsAll = getAllDoctors(apt);
      const doctorPrimary = doctorsAll[0] || apt.doctor_id;
      const doctorAccent = doctorPrimary
        ? hashColor(doctorPrimary)
        : baseColor;

      return {
        id: apt.id,
        title: `${getAllPatients(apt)
          .map(getPaciente)
          .join(", ")} • ${apt.type}`,

        start: startDate.toISOString(),
        end: endDate.toISOString(),

        backgroundColor: baseColor,
        borderColor: doctorAccent,
        textColor: "#FFFFFF",
        classNames: ["excel-event"],

        extendedProps: {
          ...apt,
          _statusUI: statusUI,
          _doctorAccent: doctorAccent,
        },
      };
    })
    // ✅ OBRIGATÓRIO
    .filter(Boolean);
}, [filtered]);

  /* ======================================================
     AÇÕES
  ====================================================== */
  const closePanel = () => {
    setPanelOpen(false);
    setEditing(false);
    setSelected(null);
  };

  const openNew = (prefill?: Partial<FormState>) => {
    setEditing(false);
    setSelected(null);
    setForm({
      patient_ids: [],
      doctor_ids: [],
      date: "",
      time: "",
      type: "",
      price: "",
      notes: "",
      status: "agendado",
      ...prefill,
    });
    setPanelOpen(true);
  };

  const openEdit = (apt: AptLike) => {
    setEditing(true);
    setSelected(apt);
    setForm({
      patient_ids: getAllPatients(apt),
      doctor_ids: getAllDoctors(apt),
      date: apt.date || "",
      time: apt.time || "",
      type: apt.type || "",
      price: String(apt.price ?? ""),
      notes: apt.notes || "",
      status: toUiStatus(apt.status),
    });
    setPanelOpen(true);
  };

  const validate = () => {
  if (form.patient_ids.length === 0) return "Selecione ao menos 1 paciente";
  if (form.doctor_ids.length === 0) return "Selecione ao menos 1 médico";
  if (!form.date) return "Selecione a data";
  if (!normalizeTime(form.time)) return "Selecione a hora";
  return null;
};

  const save = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }

    // PRINCIPAL = primeiro selecionado (obrigatório no banco)
    const payload = {
      patient_id: form.patient_ids[0],
      patient_ids: uniq(form.patient_ids),
      doctor_id: form.doctor_ids[0],
      doctor_ids: uniq(form.doctor_ids),
      date: form.date,
      time: form.time,
      type: form.type.trim(),
      price: Number(form.price) || 0,
      notes: form.notes,
      status: toDbStatus(form.status),
    };

    const ok =
      editing && selected
        ? await updateAppointment(selected.id, payload as any)
        : await addAppointment(payload as any);

    if (ok) {
      toast.success(editing ? "Agendamento atualizado" : "Agendamento criado");
      closePanel();
    } else {
      toast.error("Erro ao salvar");
    }
  };

  const removeSelected = async () => {
    if (!selected) return;
    if (!confirm("Excluir este agendamento?")) return;

    const ok = await deleteAppointment(selected.id);
    if (ok) {
      toast.success("Agendamento excluído");
      closePanel();
    } else {
      toast.error("Erro ao excluir");
    }
  };

  const clearFilters = () => {
    setSearch("");
    setFilterPatient("all");
    setFilterDoctor("all");
    setFilterStatus("all");
    setFilterDate("");
  };

  const setToday = () => {
    const today = new Date();
    setFilterDate(toDateStr(today));
  };

  const safeISO = (date?: string, time?: string) => {
  if (!date || !time) return null;

  const t = time.length === 5 ? `${time}:00` : time;
  const d = new Date(`${date}T${t}`);

  return isNaN(d.getTime()) ? null : d.toISOString();
};

  /* ======================================================
     AÇÕES DO CALENDÁRIO
  ====================================================== */
  const onDateClick = (arg: DateClickArg) => {
  const d = arg.date;

  openNew({
    date: toDateStr(d),
    time: normalizeTime(toTimeStr(d)), // ✅ ESSENCIAL
  });
};

  const onEventDrop = async (info: any) => {
  const apt = info.event.extendedProps as AptLike;

  const start = info.event.start;
  if (!start) {
    info.revert();
    return;
  }

  // 🔒 NORMALIZAÇÃO ABSOLUTA
  const date = toDateStr(start);
  const time = normalizeTime(toTimeStr(start));

  if (!date || !time) {
    info.revert();
    toast.error("Data ou hora inválida");
    return;
  }

  const duration = duracaoServico(apt.type);
  const doctorsAll = getAllDoctors(apt);

  // 🚫 BLOQUEIO REAL DE CONFLITO
  if (hasConflict(doctorsAll, date, time, duration, apt.id)) {
    info.revert();
    toast.error("Conflito: horário já ocupado");
    return;
  }

  // 💾 SALVA
  const ok = await updateAppointment(apt.id, {
    date,
    time,
  } as any);

  if (ok) {
    toast.success("Horário atualizado");
  } else {
    info.revert();
    toast.error("Erro ao atualizar horário");
  }
};

  /* ======================================================
     UI
  ====================================================== */
  const statusOptions: Array<{ value: UIStatus; label: string }> = [
    { value: "agendado", label: "Agendado" },
    { value: "confirmado", label: "Confirmado" },
    { value: "realizado", label: "Realizado" },
    { value: "cancelado", label: "Cancelado" },
  ];

  return (
    <div className="flex h-[90vh] bg-white border rounded-xl overflow-hidden shadow-sm">
      {/* ================== SIDEBAR FILTROS ================== */}
      <aside className="w-[310px] border-r bg-gray-50 p-3">
        <div className="flex items-center justify-between gap-2">
          <Button className="flex-1 bg-purple-600 hover:bg-purple-700" onClick={() => openNew()}>
            <Plus className="w-4 h-4 mr-1" /> Novo
          </Button>
          <Button variant="outline" className="h-9 px-2" onClick={clearFilters} title="Limpar filtros">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button variant="outline" className="h-9 px-2" onClick={setToday} title="Hoje">
            <CalendarDays className="w-4 h-4" />
          </Button>
        </div>

        <div className="mt-3 space-y-2">
          <div className="space-y-1">
            <label className="text-[11px] text-gray-600">Buscar</label>
            <Input
              placeholder="Paciente, médico, tipo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9"
            />
          </div>

          <div className="grid grid-cols-1 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] text-gray-600">Paciente</label>
              <Select value={filterPatient} onValueChange={setFilterPatient}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {patients.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* SERVIÇO */}
<div className="space-y-1">
  <label className="text-[11px] text-gray-600">Serviço*</label>

  <Select
    value={form.type}
    onValueChange={(value) => {
      const service = services.find((s) => s.name === value);

      setForm((s) => ({
        ...s,
        type: value,
        price: service ? String(service.price ?? "") : s.price,
      }));
    }}
  >
    <SelectTrigger className="h-10">
      <SelectValue placeholder="Selecione o serviço" />
    </SelectTrigger>

    <SelectContent>
      {services.map((s) => (
        <SelectItem key={s.id} value={s.name}>
          {s.name} • {s.duration} min
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>

            <div className="space-y-1">
              <label className="text-[11px] text-gray-600">Médico</label>
              <Select value={filterDoctor} onValueChange={setFilterDoctor}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {doctors.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-gray-600">Status</label>
              <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {statusOptions.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-gray-600">Data</label>
              <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="h-9" />
            </div>
          </div>

          <div className="mt-2 rounded-lg border bg-white p-2">
            <div className="text-[11px] font-medium text-gray-700">Dica</div>
            <div className="text-[11px] text-gray-500">
              Clique em um horário vazio no calendário para abrir o novo agendamento já preenchido.
            </div>
          </div>
        </div>
      </aside>

      {/* ================== CALENDÁRIO ================== */}
      <main className="flex-1 p-2 bg-white">
        <style jsx global>{`
          .fc {
            font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
            font-size: 12px;
          }
          .fc .fc-toolbar-title {
            font-size: 16px;
            font-weight: 700;
            color: #111827;
          }
          .fc .fc-button {
            border-radius: 10px !important;
            border: 1px solid #e5e7eb !important;
            background: #ffffff !important;
            color: #111827 !important;
            box-shadow: none !important;
            padding: 6px 10px !important;
            font-size: 12px !important;
          }
          .fc .fc-button:hover {
            background: #f9fafb !important;
          }
          .fc .fc-button-primary:not(:disabled).fc-button-active,
          .fc .fc-button-primary:not(:disabled):active {
            background: #111827 !important;
            color: #fff !important;
            border-color: #111827 !important;
          }
          .fc .fc-scrollgrid,
          .fc .fc-scrollgrid-section > * {
            border-color: #eef2f7 !important;
          }
          .fc .fc-col-header-cell {
            background: #f8fafc !important;
          }
          .fc .fc-timegrid-slot {
            height: 28px;
          }
          .fc .excel-event {
            border-radius: 8px !important;
            border-width: 2px !important;
            overflow: hidden;
          }
        `}</style>

        <FullCalendar
  plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
  initialView="timeGridWeek"
  headerToolbar={{
    left: "prev,next today",
    center: "title",
    right: "timeGridDay,timeGridWeek,dayGridMonth",
  }}
  locale="pt-br"
  locales={[ptBr]}
  events={events}
  height="100%"

  /* =========================
     CONTROLE DE EDIÇÃO
  ========================= */
  editable={true}

  // 🚫 BLOQUEIA ARRASTE DE AGENDAMENTO FIXO
  eventAllow={(dropInfo, draggedEvent) => {
    const apt = draggedEvent.extendedProps as AptLike;

    if (apt?.is_fixed) {
      toast.error("Este agendamento é fixo e não pode ser movido");
      return false;
    }

    return true;
  }}

  nowIndicator
  allDaySlot={false}
  slotMinTime="07:00:00"
  slotMaxTime="22:00:00"

  dateClick={onDateClick}

  eventClick={(info) =>
    openEdit(info.event.extendedProps as AptLike)
  }

  eventDrop={onEventDrop}

  eventContent={(arg) => {
    const ext: any = arg.event.extendedProps || {};
    const statusUI: UIStatus =
      ext._statusUI || toUiStatus(ext.status || "pendente");

    const timeText = arg.timeText ? `${arg.timeText} ` : "";

    return (
      <div className="w-full px-2 py-1">
        <div className="flex items-center justify-between gap-2">
          <div className="truncate font-semibold">
            {timeText}
            {arg.event.title}

            {/* 📌 INDICADOR DE FIXO */}
            {ext.is_fixed && (
              <span className="ml-1" title="Agendamento fixo">
                📌
              </span>
            )}
          </div>

          <span className="text-[10px] font-bold opacity-90">
            {statusUI === "agendado"
              ? "A"
              : statusUI === "confirmado"
              ? "C"
              : statusUI === "realizado"
              ? "R"
              : "X"}
          </span>
        </div>
      </div>
    );
  }}
/>
      </main>

      {/* ================== PAINEL (FORM) ================== */}
      {panelOpen && (
        <aside className="w-[440px] border-l bg-white p-4 overflow-y-auto">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-gray-900">
                {editing ? "Editar Agendamento" : "Novo Agendamento"}
              </h2>
              <p className={cn("text-[11px] mt-1", conflictForm ? "text-red-600" : "text-gray-500")}>
                {conflictForm
                  ? "⚠ Conflito detectado: ajuste médicos/data/hora."
                  : "Selecione pacientes e médicos, preencha data/hora e salve."}
              </p>
            </div>
            <button onClick={closePanel} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* resumo */}
          <div className={cn("mt-3 rounded-xl border p-3", conflictForm ? "border-red-200 bg-red-50" : "border-gray-200 bg-gray-50")}>
            <div className="text-[11px] text-gray-700">
              <b>Principal:</b>{" "}
              {form.doctor_ids[0] ? (
                <span className="font-semibold">{getMedico(form.doctor_ids[0])}</span>
              ) : (
                <span className="text-gray-500">nenhum</span>
              )}
            </div>
            <div className="text-[11px] text-gray-700 mt-1">
              <b>Duração:</b> <span className="font-semibold">{formDuration} min</span>
            </div>
            <div className="text-[10px] text-gray-500 mt-1">
              O 1º médico e o 1º paciente viram os campos <b>principais</b> do banco.
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {/* PACIENTES (multi + busca + chips) */}
            <div className="space-y-1">
              <label className="text-[11px] text-gray-600">Pacientes*</label>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-10 w-full justify-between">
                    {form.patient_ids.length ? (
                      <span className="text-sm">{form.patient_ids.length} selecionado(s)</span>
                    ) : (
                      <span className="text-sm text-gray-500">Selecionar pacientes</span>
                    )}
                    <ChevronsUpDown className="w-4 h-4 opacity-60" />
                  </Button>
                </PopoverTrigger>

                <PopoverContent className="p-0 w-[380px]">
                  <Command>
                    <CommandInput placeholder="Buscar paciente..." />
                    <CommandList>
                      <CommandEmpty>Nenhum paciente encontrado.</CommandEmpty>
                      <CommandGroup heading="Pacientes">
                        {patients.map((p) => {
                          const checked = form.patient_ids.includes(p.id);
                          return (
                            <CommandItem
                              key={p.id}
                              onSelect={() => {
                                setForm((s) => {
                                  const next = checked
                                    ? s.patient_ids.filter((id) => id !== p.id)
                                    : [...s.patient_ids, p.id];
                                  return { ...s, patient_ids: next };
                                });
                              }}
                              className="flex items-center gap-2"
                            >
                              <Check className={cn("w-4 h-4", checked ? "opacity-100" : "opacity-0")} />
                              <span className="text-sm">{p.name}</span>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {/* chips */}
              {form.patient_ids.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {form.patient_ids.map((id) => (
                    <span
                      key={id}
                      className="inline-flex items-center gap-2 rounded-full bg-gray-100 border px-3 py-1 text-[12px]"
                    >
                      {getPaciente(id)}
                      <button
                        className="hover:text-red-600"
                        onClick={() =>
                          setForm((s) => ({ ...s, patient_ids: s.patient_ids.filter((x) => x !== id) }))
                        }
                        title="Remover"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* MÉDICOS (multi + busca + chips) */}
            <div className="space-y-1">
              <label className="text-[11px] text-gray-600">Médicos*</label>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-10 w-full justify-between">
                    {form.doctor_ids.length ? (
                      <span className="text-sm">{form.doctor_ids.length} selecionado(s)</span>
                    ) : (
                      <span className="text-sm text-gray-500">Selecionar médicos</span>
                    )}
                    <ChevronsUpDown className="w-4 h-4 opacity-60" />
                  </Button>
                </PopoverTrigger>

                <PopoverContent className="p-0 w-[380px]">
                  <Command>
                    <CommandInput placeholder="Buscar médico..." />
                    <CommandList>
                      <CommandEmpty>Nenhum médico encontrado.</CommandEmpty>
                      <CommandGroup heading="Médicos">
                        {doctors.map((d) => {
                          const checked = form.doctor_ids.includes(d.id);
                          return (
                            <CommandItem
                              key={d.id}
                              onSelect={() => {
                                setForm((s) => {
                                  const next = checked
                                    ? s.doctor_ids.filter((id) => id !== d.id)
                                    : [...s.doctor_ids, d.id];
                                  return { ...s, doctor_ids: next };
                                });
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

              {/* chips */}
              {form.doctor_ids.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {form.doctor_ids.map((id, idx) => (
                    <span
                      key={id}
                      className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[12px]"
                      style={{ background: "#f8fafc", borderColor: hashColor(id) }}
                      title={idx === 0 ? "Médico principal" : "Médico"}
                    >
                      <span className="inline-block w-2 h-2 rounded-full" style={{ background: hashColor(id) }} />
                      {getMedico(id)}
                      <button
                        className="hover:text-red-600"
                        onClick={() =>
                          setForm((s) => ({ ...s, doctor_ids: s.doctor_ids.filter((x) => x !== id) }))
                        }
                        title="Remover"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="text-[10px] text-gray-500">
                O <b>1º médico</b> na lista vira o <b>principal</b>.
              </div>
            </div>

           {/* DATA / HORA */}
<div className="grid grid-cols-2 gap-2">
  {/* DATA */}
  <div className="space-y-1">
    <label className="text-[11px] text-gray-600">Data*</label>
    <Input
      type="date"
      className="h-10"
      value={form.date}
      onChange={(e) =>
        setForm((s) => ({
          ...s,
          date: e.target.value,
        }))
      }
    />
  </div>

  {/* HORA */}
  <div className="space-y-1">
    <label className="text-[11px] text-gray-600">Hora*</label>
    <Input
      type="time"
      className="h-10"
      value={normalizeTime(form.time)}
      onChange={(e) =>
        setForm((s) => ({
          ...s,
          time: normalizeTime(e.target.value),
        }))
      }
    />
  </div>
</div>

            {/* STATUS */}
            <div className="space-y-1">
              <label className="text-[11px] text-gray-600">Status</label>
              <Select value={form.status} onValueChange={(v) => setForm((s) => ({ ...s, status: v as UIStatus }))}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {statusOptions.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* VALOR */}
            <div className="space-y-1">
              <label className="text-[11px] text-gray-600">Valor (R$)</label>
              <Input
                type="number"
                className="h-10"
                placeholder="0,00"
                value={form.price}
                onChange={(e) => setForm((s) => ({ ...s, price: e.target.value }))}
              />
            </div>

            {/* OBS */}
            <div className="space-y-1">
              <label className="text-[11px] text-gray-600">Observações</label>
              <Textarea
                className="min-h-[100px]"
                placeholder="Opcional..."
                value={form.notes}
                onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
              />
            </div>

            {/* AÇÕES */}
            <div className="flex gap-2 pt-1">
              <Button
                className="flex-1 h-10 bg-purple-600 hover:bg-purple-700"
                onClick={save}
                disabled={conflictForm}
              >
                {editing ? "Salvar alterações" : "Salvar"}
              </Button>
              <Button variant="outline" className="flex-1 h-10" onClick={closePanel}>
                Cancelar
              </Button>
            </div>

            {/* AÇÕES EXTRA (editar/excluir) */}
            {editing && selected && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button
                  variant="outline"
                  className="h-10"
                  onClick={() => toast.message("Dica: arraste o evento no calendário para mudar horário rapidamente.")}
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Dica
                </Button>
                <Button variant="destructive" className="h-10" onClick={removeSelected}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir
                </Button>
              </div>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}