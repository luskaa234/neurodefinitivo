"use client";

import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Search, X, ChevronsUpDown, Check } from "lucide-react";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import ptBr from "@fullcalendar/core/locales/pt-br";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";

import { useApp } from "@/contexts/AppContext";
import { supabase } from "@/lib/supabase";

// UI usa "agendado", BD usa "pendente"
type UIStatus = "agendado" | "confirmado" | "realizado" | "cancelado";
type DBStatus = "pendente" | "confirmado" | "realizado" | "cancelado";

const toDbStatus = (s: UIStatus): DBStatus => (s === "agendado" ? "pendente" : s);
const toUiStatus = (s: DBStatus | UIStatus | string): UIStatus =>
  s === "pendente" ? "agendado" : (s as UIStatus);

// utilzinho p/ classes condicionais
const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

// ===== Componente =====
export default function AgendaCalendario() {
  const {
    appointments,
    patients,
    doctors,
    services,
    addAppointment,
    updateAppointment,
    deleteAppointment,
  } = useApp();

  // ----------------- estado UI -----------------
  const [busca, setBusca] = useState("");
  const [filtroMedico, setFiltroMedico] = useState<string>("all");
  const [filtroStatus, setFiltroStatus] = useState<UIStatus | "all">("all");
  const [filtroData, setFiltroData] = useState("");
  const [eventoSelecionado, setEventoSelecionado] = useState<any>(null);
  const [adicionando, setAdicionando] = useState(false);
  const [editando, setEditando] = useState(false);

  // ----------------- pacientes extras (criadas “na hora”) -----------------
  const [extraPatients, setExtraPatients] = useState<Array<{ id: string; name: string; email?: string; phone?: string }>>([]);

  const allPatients = useMemo(
    () => {
      const map = new Map<string, { id: string; name: string; email?: string; phone?: string }>();
      patients.forEach(p => map.set(p.id, p));
      extraPatients.forEach(p => map.set(p.id, p));
      return Array.from(map.values());
    },
    [patients, extraPatients]
  );

  // ----------------- novo agendamento -----------------
  const [novoAgendamento, setNovoAgendamento] = useState<{
    date: string;
    time: string;
    patient_id: string;
    doctor_id: string;
    type: string;
    price: string;
    status: UIStatus;
    notes?: string;
    service_id?: string;
  }>({
    date: "",
    time: "",
    patient_id: "",
    doctor_id: "",
    type: "",
    price: "",
    status: "agendado",
    notes: "",
    service_id: undefined,
  });

  // ----------------- edição rápida -----------------
  const [editForm, setEditForm] = useState<{
    date: string;
    time: string;
    patient_id: string;
    doctor_id: string;
    type: string;
    price: string;
    status: UIStatus;
    notes?: string;
    service_id?: string;
  }>({
    date: "",
    time: "",
    patient_id: "",
    doctor_id: "",
    type: "",
    price: "",
    status: "agendado",
    notes: "",
    service_id: undefined,
  });

  // ----------------- Combobox states -----------------
  const [openPatientBox, setOpenPatientBox] = useState(false);
  const [openDoctorBox, setOpenDoctorBox] = useState(false);
  const [patientQuery, setPatientQuery] = useState("");
  const [doctorQuery, setDoctorQuery] = useState("");

  const [openPatientBoxEdit, setOpenPatientBoxEdit] = useState(false);
  const [openDoctorBoxEdit, setOpenDoctorBoxEdit] = useState(false);
  const [patientQueryEdit, setPatientQueryEdit] = useState("");
  const [doctorQueryEdit, setDoctorQueryEdit] = useState("");

  // ----------------- Quick Create Patient -----------------
  const [qcOpen, setQcOpen] = useState(false);
  const [qcName, setQcName] = useState("");
  const [qcEmail, setQcEmail] = useState("");
  const [qcPhone, setQcPhone] = useState("");

  // helpers de nomes
  const getNomePaciente = (id: string) =>
    allPatients.find((p) => p.id === id)?.name || "Paciente";
  const getNomeMedico = (id: string) =>
    doctors.find((d) => d.id === id)?.name || "Médico";

  // ----------------- helpers de data/tempo -----------------
  const pad = (n: number) => String(n).padStart(2, "0");

  const hhmmToHHmmss = (t: string) =>
    t && t.length === 5 ? `${t}:00` : t || "00:00:00";

  const toLocalDate = (dateStr: string, timeStr: string) => {
    const [H, M, S] = hhmmToHHmmss(timeStr)
      .split(":")
      .map((x) => parseInt(x || "0", 10));
    return new Date(`${dateStr}T${pad(H)}:${pad(M)}:${pad(S)}`);
  };

  const addMinutesLocal = (dateStr: string, timeStr: string, minutes = 60) => {
    const d = toLocalDate(dateStr, timeStr);
    d.setMinutes(d.getMinutes() + minutes);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
      d.getDate()
    )}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  const formatStartISO = (dateStr: string, timeStr: string) =>
    `${dateStr}T${hhmmToHHmmss(timeStr)}`;

  const serviceDurationByName = (name: string) =>
    services.find((s) => s.name === name)?.duration ?? 60;

  const serviceDurationById = (id?: string) =>
    id ? services.find((s) => s.id === id)?.duration ?? 60 : 60;

  // ----------------- filtros -----------------
  const baseFiltrada = useMemo(() => {
    return appointments.filter((apt) => {
      const paciente = getNomePaciente(apt.patient_id).toLowerCase();
      const medico = getNomeMedico(apt.doctor_id).toLowerCase();

      const statusUI = toUiStatus(apt.status);

      const buscaOk =
        !busca ||
        paciente.includes(busca.toLowerCase()) ||
        medico.includes(busca.toLowerCase()) ||
        apt.type.toLowerCase().includes(busca.toLowerCase());
      const medicoOk =
        filtroMedico === "all" ? true : apt.doctor_id === filtroMedico;
      const statusOk =
        filtroStatus === "all" ? true : statusUI === filtroStatus;
      const dataOk = !filtroData || apt.date === filtroData;
      return buscaOk && medicoOk && statusOk && dataOk;
    });
  }, [appointments, busca, filtroMedico, filtroStatus, filtroData]);

  const contagem = useMemo(() => {
    const init: Record<UIStatus, number> = {
      agendado: 0,
      confirmado: 0,
      realizado: 0,
      cancelado: 0,
    };
    return baseFiltrada.reduce((acc, a) => {
      const statusUI = toUiStatus(a.status);
      acc[statusUI] += 1;
      return acc;
    }, init);
  }, [baseFiltrada]);

  // ----------------- eventos p/ FullCalendar -----------------
  const eventos = useMemo(() => {
    return baseFiltrada.map((apt) => {
      const start = formatStartISO(apt.date, apt.time);
      const durMin = serviceDurationByName(apt.type);
      const end = addMinutesLocal(apt.date, apt.time, durMin);
      const statusUI = toUiStatus(apt.status);

      return {
        id: apt.id,
        title: `${getNomePaciente(apt.patient_id)} • ${apt.type}`,
        start,
        end,
        allDay: false,
        extendedProps: { ...apt, status: statusUI },
        backgroundColor:
          statusUI === "confirmado"
            ? "#A78BFA"
            : statusUI === "realizado"
            ? "#34D399"
            : statusUI === "cancelado"
            ? "#F87171"
            : "#FBBF24",
        borderColor: "transparent",
        textColor: "#1F2937",
        classNames: ["rounded-md", "shadow-sm", "text-sm", "font-medium"],
      };
    });
  }, [baseFiltrada, allPatients, services]);

  // ----------------- conflito médico/horário -----------------
  const temConflito = (
    doctor_id: string,
    date: string,
    time: string,
    durationMin: number,
    ignoreId?: string
  ) => {
    const novoStart = toLocalDate(date, time);
    const novoEnd = toLocalDate(date, time);
    novoEnd.setMinutes(novoEnd.getMinutes() + durationMin);

    const overlap = (a1: Date, a2: Date, b1: Date, b2: Date) =>
      a1 < b2 && a2 > b1;

    return appointments.some((apt) => {
      if (ignoreId && apt.id === ignoreId) return false;
      if (apt.doctor_id !== doctor_id || apt.date !== date) return false;
      const dur = serviceDurationByName(apt.type);
      const exStart = toLocalDate(apt.date, apt.time);
      const exEnd = toLocalDate(apt.date, apt.time);
      exEnd.setMinutes(exEnd.getMinutes() + dur);
      return overlap(novoStart, novoEnd, exStart, exEnd);
    });
  };

  // ----------------- salvar novo agendamento -----------------
  const salvarNovo = async () => {
    const {
      date, time, patient_id, doctor_id, type, price, status, notes, service_id,
    } = novoAgendamento;

    if (!date || !time || !patient_id || !doctor_id || !type) {
      toast.error("❌ Preencha todos os campos obrigatórios.");
      return;
    }

    const duration = service_id
      ? serviceDurationById(service_id)
      : serviceDurationByName(type);

    if (temConflito(doctor_id, date, time, duration)) {
      toast.error("⚠️ Conflito: já existe um agendamento para este médico neste horário.");
      return;
    }

    const ok = await addAppointment({
      date,
      time,
      patient_id,
      doctor_id,
      type,
      price: parseFloat(price) || 0,
      status: toDbStatus(status),
      notes,
    } as any);

    if (ok) {
      toast.success("✅ Novo agendamento criado!");
      setNovoAgendamento({
        date: "",
        time: "",
        patient_id: "",
        doctor_id: "",
        type: "",
        price: "",
        status: "agendado",
        notes: "",
        service_id: undefined,
      });
      setAdicionando(false);
    } else {
      toast.error("❌ Erro ao criar agendamento.");
    }
  };

  // ----------------- salvar edição rápida -----------------
  const salvarEdicao = async () => {
    if (!eventoSelecionado) return;

    const {
      date, time, patient_id, doctor_id, type, price, status, notes, service_id,
    } = editForm;

    if (!date || !time || !patient_id || !doctor_id || !type) {
      toast.error("❌ Preencha todos os campos obrigatórios.");
      return;
    }

    const duration = service_id
      ? serviceDurationById(service_id)
      : serviceDurationByName(type);

    if (temConflito(doctor_id, date, time, duration, eventoSelecionado.id)) {
      toast.error("⚠️ Conflito: já existe um agendamento para este médico neste horário.");
      return;
    }

    const statusDb: DBStatus = toDbStatus(status);

    const success = await updateAppointment(String(eventoSelecionado.id), {
      date,
      time,
      patient_id,
      doctor_id,
      type,
      price: parseFloat(price) || 0,
      status: statusDb,
      notes,
    });

    if (success) {
      toast.success("✅ Agendamento atualizado!");
      setEditando(false);
      const statusUi = toUiStatus(statusDb);
      setEventoSelecionado((old: any) => ({
        ...(old ?? {}),
        date, time, patient_id, doctor_id, type,
        price: parseFloat(price) || 0,
        status: statusUi,
        notes,
      }));
    } else {
      toast.error("❌ Erro ao atualizar agendamento.");
    }
  };

  // ----------------- Quick Create Patient helpers -----------------
  const normalize = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const genEmailFromName = (name: string) => {
    const parts = normalize(name).trim().split(/\s+/);
    const first = (parts[0] || "usuario").replace(/[^a-z0-9]/g, "");
    const second = (parts[1] || "").replace(/[^a-z0-9]/g, "");
    const base = `${first}${second}` || "usuario";
    const rand = Math.floor(100 + Math.random() * 900);
    return `${base}${rand}@neurointegrar.com`;
  };

  const quickCreatePatient = async (prefillName?: string) => {
    const name = (qcName || prefillName || "").trim();
    if (!name) {
      toast.error("Informe ao menos o nome.");
      return;
    }

    const email = (qcEmail || genEmailFromName(name)).toLowerCase();
    const phone = qcPhone || "";

    // 1) cria usuário (paciente)
    const { data: userData, error: userError } = await supabase
      .from("users")
      .insert([{ name, email, phone, role: "paciente", is_active: true }])
      .select()
      .single();

    if (userError || !userData) {
      toast.error(`Erro ao cadastrar usuário: ${userError?.message || ""}`);
      return;
    }

    // 2) cria ficha patients (vazia)
    const { data: patData, error: patError } = await supabase
      .from("patients")
      .insert([{ user_id: userData.id }])
      .select()
      .single();

    if (patError || !patData) {
      toast.error(`Erro ao criar ficha do paciente: ${patError?.message || ""}`);
      return;
    }

    // 3) já coloca na lista local para usar na hora
    setExtraPatients((prev) => [
      ...prev,
      { id: userData.id, name: userData.name, email: userData.email, phone: userData.phone },
    ]);

    // se estamos no modo de criação, seta o patient_id atual
    if (adicionando) {
      setNovoAgendamento((s) => ({ ...s, patient_id: userData.id }));
    }
    if (editando) {
      setEditForm((s) => ({ ...s, patient_id: userData.id }));
    }

    setQcOpen(false);
    setQcName("");
    setQcEmail("");
    setQcPhone("");
    toast.success("✅ Paciente cadastrado!");
  };

  // ----------------- UI -----------------
  const statusChips: { key: UIStatus; label: string; dot: string }[] = [
    { key: "agendado", label: "Agendado", dot: "🟡" },
    { key: "confirmado", label: "Confirmado", dot: "💜" },
    { key: "realizado", label: "Realizado", dot: "💚" },
    { key: "cancelado", label: "Cancelado", dot: "❤️" },
  ];

  // Filtrar itens do combobox
  const filteredPatientsForBox = useMemo(() => {
    const q = patientQuery.trim().toLowerCase();
    if (!q) return allPatients;
    return allPatients.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.email || "").toLowerCase().includes(q) ||
      (p.phone || "").toLowerCase().includes(q)
    );
  }, [allPatients, patientQuery]);

  const filteredDoctorsForBox = useMemo(() => {
    const q = doctorQuery.trim().toLowerCase();
    if (!q) return doctors;
    return doctors.filter(d =>
      d.name.toLowerCase().includes(q)
    );
  }, [doctors, doctorQuery]);

  const filteredPatientsForBoxEdit = useMemo(() => {
    const q = patientQueryEdit.trim().toLowerCase();
    if (!q) return allPatients;
    return allPatients.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.email || "").toLowerCase().includes(q) ||
      (p.phone || "").toLowerCase().includes(q)
    );
  }, [allPatients, patientQueryEdit]);

  const filteredDoctorsForBoxEdit = useMemo(() => {
    const q = doctorQueryEdit.trim().toLowerCase();
    if (!q) return doctors;
    return doctors.filter(d =>
      d.name.toLowerCase().includes(q)
    );
  }, [doctors, doctorQueryEdit]);

  return (
    <div className="flex h-[85vh] bg-gradient-to-r from-purple-50 to-purple-100 border rounded-xl overflow-hidden shadow-md">
      {/* Coluna esquerda - Filtros */}
      <aside className="w-80 bg-white border-r border-gray-200 p-5 space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-purple-700">🔎 Filtros</h2>
          <p className="text-xs text-gray-500">Refine a visualização dos agendamentos</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar paciente, médico ou tipo..."
            className="pl-9 border-purple-300 focus:ring-purple-500"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        {/* Médico */}
        <div className="space-y-1">
          <label className="text-xs text-gray-500">Médico</label>
          <Select
            value={filtroMedico}
            onValueChange={(val) => setFiltroMedico(val)}
          >
            <SelectTrigger className="border-purple-300 focus:ring-purple-500">
              <SelectValue placeholder="Selecione o médico" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {doctors.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status */}
        <div className="space-y-2">
          <label className="text-xs text-gray-500">Status</label>
          <div className="grid grid-cols-2 gap-2">
            {statusChips.map(({ key, label, dot }) => (
              <button
                key={key}
                onClick={() =>
                  setFiltroStatus((prev) => (prev === key ? "all" : key))
                }
                className={cn(
                  "rounded-lg border px-3 py-2 text-left transition",
                  filtroStatus === key
                    ? "border-purple-600 bg-purple-50 text-purple-700"
                    : "border-gray-200 hover:bg-gray-50"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm">{dot} {label}</span>
                  <span className="text-xs font-semibold text-gray-500">
                    {key === "agendado" ? contagem.agendado :
                     key === "confirmado" ? contagem.confirmado :
                     key === "realizado" ? contagem.realizado :
                     contagem.cancelado}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Data */}
        <div className="space-y-1">
          <label className="text-xs text-gray-500">Data</label>
          <Input
            type="date"
            value={filtroData}
            onChange={(e) => setFiltroData(e.target.value)}
            className="border-purple-300 focus:ring-purple-500"
          />
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => setAdicionando(true)}
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white shadow-md"
          >
            <Plus className="h-4 w-4 mr-1" /> Novo Agendamento
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setBusca("");
              setFiltroMedico("all");
              setFiltroStatus("all");
              setFiltroData("");
            }}
          >
            Limpar
          </Button>
        </div>
      </aside>

      {/* Coluna central - Calendário */}
      <main className="flex-1 p-4 bg-white">
        <FullCalendar
          key={`${appointments.length}-${filtroMedico}-${filtroStatus}-${filtroData}-${busca}`}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay",
          }}
          locales={[ptBr]}
          locale="pt-br"
          events={eventos}
          height="100%"
          nowIndicator
          dayMaxEventRows={3}
          firstDay={1}
          eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
          slotMinTime="07:00:00"
          slotMaxTime="22:00:00"
          eventClick={(info) => setEventoSelecionado(info.event.extendedProps)}
          eventClassNames={() => ["rounded-md", "shadow-sm"]}
        />
      </main>

      {/* Coluna direita - Detalhes / Formulário */}
      {(eventoSelecionado || adicionando) && (
        <aside className="w-[400px] bg-white border-l border-gray-200 p-5 flex flex-col shadow-inner overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-lg font-semibold text-purple-700">
                {adicionando
                  ? "➕ Novo Agendamento"
                  : editando
                  ? "✏️ Edição Rápida"
                  : "📋 Detalhes"}
              </h2>
              <p className="text-xs text-gray-500">
                {adicionando
                  ? "Preencha os campos e salve para criar."
                  : editando
                  ? "Ajuste os dados e salve as alterações."
                  : "Informações completas do compromisso."}
              </p>
            </div>
            <button
              onClick={() => {
                setEventoSelecionado(null);
                setAdicionando(false);
                setEditando(false);
              }}
            >
              <X className="h-5 w-5 text-gray-500 hover:text-gray-700" />
            </button>
          </div>

          {adicionando ? (
            // ================== FORM NOVO ==================
            <div className="space-y-3">
              {/* Paciente (combobox) */}
              <div className="space-y-1">
                <label className="text-xs text-gray-500">Paciente*</label>
                <Popover open={openPatientBox} onOpenChange={setOpenPatientBox}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                    >
                      {novoAgendamento.patient_id
                        ? getNomePaciente(novoAgendamento.patient_id)
                        : "Selecione o paciente"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[360px] p-0">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Buscar por nome, email, telefone..."
                        value={patientQuery}
                        onValueChange={setPatientQuery}
                      />
                      <CommandList>
                        <CommandEmpty>
                          <div className="p-3 text-sm">
                            Nenhum paciente encontrado.
                            <div className="mt-2">
                              <Button
                                size="sm"
                                className="w-full"
                                onClick={() => {
                                  setQcName(patientQuery);
                                  setQcOpen(true);
                                }}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Cadastrar “{patientQuery || "novo"}”
                              </Button>
                            </div>
                          </div>
                        </CommandEmpty>
                        <CommandGroup heading="Pacientes">
                          {filteredPatientsForBox.map((p) => (
                            <CommandItem
                              key={p.id}
                              value={p.id}
                              onSelect={() => {
                                setNovoAgendamento((s) => ({ ...s, patient_id: p.id }));
                                setOpenPatientBox(false);
                              }}
                              className="flex items-center gap-2"
                            >
                              <Check
                                className={cn(
                                  "h-4 w-4",
                                  novoAgendamento.patient_id === p.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col">
                                <span className="text-sm">{p.name}</span>
                                <span className="text-xs text-gray-500">{p.email || p.phone || "-"}</span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                        <div className="p-2 border-t">
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => {
                              setQcName(patientQuery);
                              setQcOpen(true);
                            }}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Cadastrar novo paciente
                          </Button>
                        </div>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Médico (combobox) */}
              <div className="space-y-1">
                <label className="text-xs text-gray-500">Médico*</label>
                <Popover open={openDoctorBox} onOpenChange={setOpenDoctorBox}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between">
                      {novoAgendamento.doctor_id
                        ? getNomeMedico(novoAgendamento.doctor_id)
                        : "Selecione o médico"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[360px] p-0">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Buscar médico..."
                        value={doctorQuery}
                        onValueChange={setDoctorQuery}
                      />
                      <CommandList>
                        <CommandEmpty>Nenhum médico encontrado.</CommandEmpty>
                        <CommandGroup heading="Médicos">
                          {filteredDoctorsForBox.map((d) => (
                            <CommandItem
                              key={d.id}
                              value={d.id}
                              onSelect={() => {
                                setNovoAgendamento((s) => ({ ...s, doctor_id: d.id }));
                                setOpenDoctorBox(false);
                              }}
                              className="flex items-center gap-2"
                            >
                              <Check
                                className={cn(
                                  "h-4 w-4",
                                  novoAgendamento.doctor_id === d.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <span className="text-sm">{d.name}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Serviço / Tipo */}
              <div className="space-y-1">
                <label className="text-xs text-gray-500">Serviço</label>
                <Select
                  value={novoAgendamento.service_id || "none"}
                  onValueChange={(val) => {
                    if (val === "none") {
                      setNovoAgendamento((s) => ({ ...s, service_id: undefined, type: "", price: "" }));
                      return;
                    }
                    const svc = services.find((s) => s.id === val);
                    setNovoAgendamento((s) => ({
                      ...s,
                      service_id: val,
                      type: svc?.name || "",
                      price: svc?.price !== undefined ? String(svc.price) : s.price,
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o serviço (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {services.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} • {s.duration}min • R$ {s.price}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Input
                type="text"
                placeholder="Tipo de consulta*"
                value={novoAgendamento.type}
                onChange={(e) => setNovoAgendamento((s) => ({ ...s, type: e.target.value }))}
              />

              {/* Data e hora */}
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="date"
                  value={novoAgendamento.date}
                  onChange={(e) => setNovoAgendamento((s) => ({ ...s, date: e.target.value }))}
                />
                <Input
                  type="time"
                  value={novoAgendamento.time}
                  onChange={(e) => setNovoAgendamento((s) => ({ ...s, time: e.target.value }))}
                />
              </div>

              {/* Status */}
              <div className="space-y-2">
                <label className="text-xs text-gray-500">Status do agendamento</label>
                <div className="grid grid-cols-2 gap-2">
                  {statusChips.map(({ key, label, dot }) => (
                    <button
                      type="button"
                      key={key}
                      onClick={() => setNovoAgendamento((s) => ({ ...s, status: key }))}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-left transition",
                        novoAgendamento.status === key
                          ? "border-purple-600 bg-purple-50 text-purple-700"
                          : "border-gray-200 hover:bg-gray-50"
                      )}
                    >
                      {dot} {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Valor */}
              <Input
                type="number"
                placeholder="Valor (R$)"
                value={novoAgendamento.price}
                onChange={(e) => setNovoAgendamento((s) => ({ ...s, price: e.target.value }))}
              />

              {/* Observações */}
              <Textarea
                placeholder="Observações (opcional)"
                value={novoAgendamento.notes}
                onChange={(e) => setNovoAgendamento((s) => ({ ...s, notes: e.target.value }))}
              />

              <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white" onClick={salvarNovo}>
                Salvar
              </Button>
            </div>
          ) : editando ? (
            // ================== FORM EDIÇÃO RÁPIDA ==================
            <div className="space-y-3">
              {/* Paciente (combobox) */}
              <div className="space-y-1">
                <label className="text-xs text-gray-500">Paciente*</label>
                <Popover open={openPatientBoxEdit} onOpenChange={setOpenPatientBoxEdit}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between">
                      {editForm.patient_id ? getNomePaciente(editForm.patient_id) : "Selecione o paciente"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[360px] p-0">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Buscar por nome, email, telefone..."
                        value={patientQueryEdit}
                        onValueChange={setPatientQueryEdit}
                      />
                      <CommandList>
                        <CommandEmpty>
                          <div className="p-3 text-sm">
                            Nenhum paciente encontrado.
                            <div className="mt-2">
                              <Button
                                size="sm"
                                className="w-full"
                                onClick={() => {
                                  setQcName(patientQueryEdit);
                                  setQcOpen(true);
                                }}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Cadastrar “{patientQueryEdit || "novo"}”
                              </Button>
                            </div>
                          </div>
                        </CommandEmpty>
                        <CommandGroup heading="Pacientes">
                          {filteredPatientsForBoxEdit.map((p) => (
                            <CommandItem
                              key={p.id}
                              value={p.id}
                              onSelect={() => {
                                setEditForm((s) => ({ ...s, patient_id: p.id }));
                                setOpenPatientBoxEdit(false);
                              }}
                              className="flex items-center gap-2"
                            >
                              <Check
                                className={cn(
                                  "h-4 w-4",
                                  editForm.patient_id === p.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col">
                                <span className="text-sm">{p.name}</span>
                                <span className="text-xs text-gray-500">{p.email || p.phone || "-"}</span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                        <div className="p-2 border-t">
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => {
                              setQcName(patientQueryEdit);
                              setQcOpen(true);
                            }}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Cadastrar novo paciente
                          </Button>
                        </div>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Médico (combobox) */}
              <div className="space-y-1">
                <label className="text-xs text-gray-500">Médico*</label>
                <Popover open={openDoctorBoxEdit} onOpenChange={setOpenDoctorBoxEdit}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between">
                      {editForm.doctor_id ? getNomeMedico(editForm.doctor_id) : "Selecione o médico"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[360px] p-0">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Buscar médico..."
                        value={doctorQueryEdit}
                        onValueChange={setDoctorQueryEdit}
                      />
                      <CommandList>
                        <CommandEmpty>Nenhum médico encontrado.</CommandEmpty>
                        <CommandGroup heading="Médicos">
                          {filteredDoctorsForBoxEdit.map((d) => (
                            <CommandItem
                              key={d.id}
                              value={d.id}
                              onSelect={() => {
                                setEditForm((s) => ({ ...s, doctor_id: d.id }));
                                setOpenDoctorBoxEdit(false);
                              }}
                              className="flex items-center gap-2"
                            >
                              <Check
                                className={cn(
                                  "h-4 w-4",
                                  editForm.doctor_id === d.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <span className="text-sm">{d.name}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Serviço / Tipo */}
              <div className="space-y-1">
                <label className="text-xs text-gray-500">Serviço</label>
                <Select
                  value={editForm.service_id || "none"}
                  onValueChange={(val) => {
                    if (val === "none") {
                      setEditForm((s) => ({ ...s, service_id: undefined }));
                      return;
                    }
                    const svc = services.find((s) => s.id === val);
                    setEditForm((s) => ({
                      ...s,
                      service_id: val,
                      type: svc?.name || s.type,
                      price: svc?.price !== undefined ? String(svc.price) : s.price,
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o serviço (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {services.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} • {s.duration}min • R$ {s.price}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Input
                type="text"
                placeholder="Tipo de consulta*"
                value={editForm.type}
                onChange={(e) => setEditForm((s) => ({ ...s, type: e.target.value }))}
              />

              {/* Data e hora */}
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="date"
                  value={editForm.date}
                  onChange={(e) => setEditForm((s) => ({ ...s, date: e.target.value }))}
                />
                <Input
                  type="time"
                  value={editForm.time}
                  onChange={(e) => setEditForm((s) => ({ ...s, time: e.target.value }))}
                />
              </div>

              {/* Status */}
              <div className="space-y-2">
                <label className="text-xs text-gray-500">Status do agendamento</label>
                <div className="grid grid-cols-2 gap-2">
                  {statusChips.map(({ key, label, dot }) => (
                    <button
                      type="button"
                      key={key}
                      onClick={() => setEditForm((s) => ({ ...s, status: key }))}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-left transition",
                        editForm.status === key
                          ? "border-purple-600 bg-purple-50 text-purple-700"
                          : "border-gray-200 hover:bg-gray-50"
                      )}
                    >
                      {dot} {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Valor */}
              <Input
                type="number"
                placeholder="Valor (R$)"
                value={editForm.price}
                onChange={(e) => setEditForm((s) => ({ ...s, price: e.target.value }))}
              />

              {/* Observações */}
              <Textarea
                placeholder="Observações (opcional)"
                value={editForm.notes}
                onChange={(e) => setEditForm((s) => ({ ...s, notes: e.target.value }))}
              />

              <div className="flex gap-2">
                <Button className="flex-1 bg-purple-600 hover:bg-purple-700 text-white" onClick={salvarEdicao}>
                  Salvar alterações
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => setEditando(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            // ================== DETALHES ==================
            <>
              <div className="space-y-1 text-sm">
                <p><strong>Paciente:</strong> {getNomePaciente(eventoSelecionado.patient_id)}</p>
                <p><strong>Médico:</strong> {getNomeMedico(eventoSelecionado.doctor_id)}</p>
                <p><strong>Data:</strong> {eventoSelecionado.date}</p>
                <p><strong>Hora:</strong> {eventoSelecionado.time}</p>
                <p><strong>Tipo:</strong> {eventoSelecionado.type}</p>
                <p><strong>Status:</strong> {toUiStatus(eventoSelecionado.status)}</p>
                <p><strong>Valor:</strong> R$ {eventoSelecionado.price}</p>
                {eventoSelecionado.notes ? (
                  <p className="mt-2"><strong>Obs.:</strong> {eventoSelecionado.notes}</p>
                ) : null}
              </div>

              <div className="mt-6 flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 border-purple-600 text-purple-700 hover:bg-purple-50"
                  onClick={() => {
                    const e = eventoSelecionado;
                    setEditForm({
                      date: e.date || "",
                      time: e.time || "",
                      patient_id: e.patient_id || "",
                      doctor_id: e.doctor_id || "",
                      type: e.type || "",
                      price: e.price !== undefined && e.price !== null ? String(e.price) : "",
                      status: toUiStatus(e.status),
                      notes: e.notes || "",
                      service_id: undefined,
                    });
                    setEditando(true);
                  }}
                >
                  Editar
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={async () => {
                    if (confirm("Excluir este agendamento?")) {
                      const ok = await deleteAppointment(eventoSelecionado.id);
                      if (ok) {
                        toast.success("Agendamento excluído.");
                        setEventoSelecionado(null);
                      } else {
                        toast.error("Erro ao excluir agendamento.");
                      }
                    }
                  }}
                >
                  Excluir
                </Button>
              </div>
            </>
          )}
        </aside>
      )}

      {/* Dialog: Quick Create Paciente */}
      <Dialog open={qcOpen} onOpenChange={setQcOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cadastrar Paciente</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Nome completo *" value={qcName} onChange={(e) => setQcName(e.target.value)} />
            <Input placeholder="Email (opcional)" value={qcEmail} onChange={(e) => setQcEmail(e.target.value)} />
            <Input placeholder="Telefone (opcional)" value={qcPhone} onChange={(e) => setQcPhone(e.target.value)} />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setQcOpen(false)}>Cancelar</Button>
              <Button className="bg-purple-600 hover:bg-purple-700 text-white" onClick={() => quickCreatePatient()}>
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
