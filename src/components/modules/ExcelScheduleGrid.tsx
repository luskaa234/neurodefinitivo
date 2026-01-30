"use client";

import React, { useEffect, useMemo, useState } from "react";

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
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { useApp } from "@/contexts/AppContext";
import { supabase } from "@/lib/supabase";
import { loadStoredSettings } from "@/lib/appSettings";

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

type MedicoHorario = {
  day_of_week: number | string;
  start_time: string;
  end_time: string;
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
  is_fixed: boolean;
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
const toShortDate = (d: Date) =>
  `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}`;

const uniq = (arr: string[]) => Array.from(new Set(arr.filter(Boolean)));

const isMedicoHorario = (value: any): value is MedicoHorario =>
  value &&
  typeof value === "object" &&
  "day_of_week" in value &&
  "start_time" in value &&
  "end_time" in value;

const parseMedicoHorarios = (value: unknown): MedicoHorario[] => {
  if (Array.isArray(value)) {
    return value.filter(isMedicoHorario);
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter(isMedicoHorario) : [];
    } catch {
      return [];
    }
  }
  return [];
};

const hashColor = (id: string) => {
  // cor determinística por id (médico principal)
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 70% 45%)`;
};

function addMinutes(date: Date, minutes: number) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && aEnd > bStart;
}

const getAllowedTimeSlots = (dateStr?: string) => {
  if (!dateStr) return [];
  const date = new Date(`${dateStr}T00:00:00`);
  const day = date.getDay(); // 0=Dom ... 6=Sab

  if (day === 0) return [];

  const ranges: Array<[number, number]> =
    day === 6 ? [[8, 12]] : [[8, 12], [13, 21]];

  const slots: string[] = [];
  ranges.forEach(([start, end]) => {
    for (let h = start; h <= end; h++) {
      slots.push(`${pad2(h)}:00`);
    }
  });
  return slots;
};

const getDefaultTimeSlots = () =>
  getAllowedTimeSlots("2026-01-02");

const normalizePhone = (value?: string | null) => {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
};

const formatDateTime = (date?: string, time?: string) => {
  if (!date || !time) return "";
  const [y, m, d] = date.split("-");
  const t = normalizeTime(time);
  return `${d}/${m}/${y} ${t}`;
};

const formatDateOnly = (date?: string) => {
  if (!date) return "";
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
};

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function getWeekStart(date: Date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Dom
  const diff = day === 0 ? -6 : 1 - day; // Segunda como início
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function weekOfMonth(date: Date) {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const firstDayWeek = firstDay.getDay() === 0 ? 7 : firstDay.getDay();
  const adjusted = date.getDate() + (firstDayWeek - 1);
  return Math.ceil(adjusted / 7);
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
    reloadAll,
  } = useApp();

  /* ======================================================
     ESTADOS
  ====================================================== */
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<AptLike | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => getWeekStart(new Date()));
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("all");
  const [doctorSchedule, setDoctorSchedule] = useState<MedicoHorario[]>([]);
  const [quickDoctorName, setQuickDoctorName] = useState("");
  const [isCreatingDoctor, setIsCreatingDoctor] = useState(false);
  const [quickPatientName, setQuickPatientName] = useState("");
  const [isCreatingPatient, setIsCreatingPatient] = useState(false);
  const [autoWhatsApp, setAutoWhatsApp] = useState(false);
  const [schedulerNotifications, setSchedulerNotifications] = useState<any[]>([]);
  const [workingHours, setWorkingHours] = useState<{ start: string; end: string }>({
    start: "08:00",
    end: "21:00",
  });

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
    is_fixed: false,
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

  const isReschedule = useMemo(() => {
    if (!editing || !selected) return false;
    const prevTime = normalizeTime(selected.time);
    const nextTime = normalizeTime(form.time);
    return selected.date !== form.date || prevTime !== nextTime;
  }, [editing, selected, form.date, form.time]);

  const allowedTimeSlots = useMemo(() => getAllowedTimeSlots(form.date), [form.date]);

  useEffect(() => {
    if (!form.date || !form.time) return;
    const normalized = normalizeTime(form.time);
    if (normalized && !allowedTimeSlots.includes(normalized)) {
      setForm((s) => ({ ...s, time: "" }));
    }
  }, [form.date, form.time, allowedTimeSlots]);

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

  const summaryDate = filterDate || toDateStr(currentWeekStart);

  const daySummary = useMemo(() => {
    const todayList = filtered.filter((apt) => apt.date === summaryDate);
    const counts = {
      total: todayList.length,
      agendado: 0,
      confirmado: 0,
      realizado: 0,
      cancelado: 0,
    } as Record<UIStatus | "total", number>;

    todayList.forEach((apt) => {
      const statusUI = toUiStatus(apt.status);
      counts[statusUI] += 1;
    });

    return counts;
  }, [filtered, summaryDate]);

  /* ======================================================
     EVENTOS
  ====================================================== */
  const weekDates = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart]);

  const timeSlots = useMemo(() => getDefaultTimeSlots(), []);

  const isSlotAvailable = (dayIndex: number, time: string) => {
    if (selectedDoctorId === "all") return true;
    if (!doctorSchedule.length) return true;
    const schedule = doctorSchedule.filter(
      (s) => Number(s.day_of_week) === (dayIndex % 7)
    );
    if (!schedule.length) return false;
    const timeValue = time;
    return schedule.some((s) => timeValue >= s.start_time && timeValue <= s.end_time);
  };

  const doctorWeekAppointments = useMemo(() => {
    if (!selectedDoctorId) return [];
    const weekStartStr = toDateStr(currentWeekStart);
    const weekEndStr = toDateStr(addDays(currentWeekStart, 6));

    return filtered.filter((apt) => {
      if (selectedDoctorId !== "all" && !getAllDoctors(apt).includes(selectedDoctorId)) return false;
      return apt.date >= weekStartStr && apt.date <= weekEndStr;
    });
  }, [filtered, selectedDoctorId, currentWeekStart]);

  const appointmentsBySlot = useMemo(() => {
    const map = new Map<string, AptLike[]>();
    doctorWeekAppointments.forEach((apt) => {
      const key = `${apt.date}__${normalizeTime(apt.time)}`;
      const arr = map.get(key) || [];
      arr.push(apt);
      map.set(key, arr);
    });
    return map;
  }, [doctorWeekAppointments]);

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
      is_fixed: false,
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
      is_fixed: Boolean(apt.is_fixed),
    });
    setPanelOpen(true);
  };

  const openEditById = (appointmentId?: string) => {
    if (!appointmentId) return;
    const apt = (appointments as unknown as AptLike[]).find((a) => a.id === appointmentId);
    if (apt) {
      openEdit(apt);
    }
  };

  const resolveSchedulerNotification = (appointmentId?: string) => {
    if (!appointmentId || typeof window === "undefined") return;
    const raw = localStorage.getItem("scheduler-notifications");
    const list = raw ? JSON.parse(raw) : [];
    const next = Array.isArray(list)
      ? list.filter((n: any) => n.appointment_id !== appointmentId)
      : [];
    localStorage.setItem("scheduler-notifications", JSON.stringify(next));
    setSchedulerNotifications(next);
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

    const nextStatus = isReschedule ? "agendado" : form.status;

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
      status: toDbStatus(nextStatus),
      is_fixed: form.is_fixed,
    };

    const ok =
      editing && selected
        ? await updateAppointment(selected.id, payload as any)
        : await addAppointment(payload as any);

    if (ok) {
      if (isReschedule && selected?.id) {
        resolveSchedulerNotification(selected.id);
      }
      toast.success(editing ? "Agendamento atualizado" : "Agendamento criado");
      closePanel();
    } else {
      toast.error("Erro ao salvar");
    }
  };

  const buildWhatsAppMessage = (target: "patient" | "doctor", patientId?: string) => {
    const patientNames = form.patient_ids.map(getPaciente).join(", ");
    const doctorNames = form.doctor_ids.map(getMedico).join(", ");
    const dateTime = formatDateTime(form.date, form.time);
    const statusLabel = isReschedule
      ? "reagendado"
      : form.status === "agendado"
        ? "pendente"
        : form.status;

    if (target === "patient") {
      const id = patientId || form.patient_ids[0];
      const dayAppointments = (appointments as unknown as AptLike[])
        .filter((apt) => {
          const patients = getAllPatients(apt);
          return apt.date === form.date && patients.includes(id);
        })
        .map((apt) => ({
          id: apt.id,
          time: normalizeTime(apt.time),
          doctorNames: getAllDoctors(apt).map(getMedico).join(", "),
          type: apt.type,
        }));

      const includeCurrent =
        !dayAppointments.some((a) => a.id === selected?.id) && form.date && form.time
          ? [
              ...dayAppointments,
              {
                id: selected?.id || "new",
                time: normalizeTime(form.time),
                doctorNames,
                type: form.type,
              },
            ]
          : dayAppointments;

      const sorted = includeCurrent.sort((a, b) => a.time.localeCompare(b.time));

      if (sorted.length > 1) {
        const list = sorted
          .map((a) => `${a.time} com ${a.doctorNames}${a.type ? ` - ${a.type}` : ""}`)
          .join("; ");
        return `Olá ${getPaciente(id)}, você terá consulta em ${formatDateOnly(form.date)}: ${list}.`;
      }

      return `Olá ${patientNames}, seu agendamento com ${doctorNames} está ${statusLabel}. Data/Hora: ${dateTime}.`;
    }
    return `Olá ${doctorNames}, agendamento com ${patientNames} está ${statusLabel}. Data/Hora: ${dateTime}.`;
  };

  const sendWhatsApp = (target: "patient" | "doctor" | "all") => {
    if (!form.date || !form.time || !form.patient_ids.length || !form.doctor_ids.length) {
      toast.error("Preencha pacientes, médicos, data e hora antes de enviar WhatsApp.");
      return;
    }

    const missing: string[] = [];
    const messagePatient = buildWhatsAppMessage("patient");
    const messageDoctor = buildWhatsAppMessage("doctor");

    const logDoctorNotification = (doctorId: string, message: string) => {
      if (typeof window === "undefined") return;
      const payload = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        doctor_id: doctorId,
        appointment_id: selected?.id || null,
        type: isReschedule
          ? "reschedule"
          : form.status === "cancelado"
            ? "cancel"
            : editing
              ? "update"
              : "create",
        message,
        created_at: new Date().toISOString(),
      };
      const raw = localStorage.getItem("whatsapp-notifications");
      const list = raw ? JSON.parse(raw) : [];
      list.unshift(payload);
      localStorage.setItem("whatsapp-notifications", JSON.stringify(list));
    };

    if (target === "patient" || target === "all") {
      form.patient_ids.forEach((id) => {
        const phone = normalizePhone(patients.find((p) => p.id === id)?.phone);
        if (!phone) {
          missing.push(`Paciente: ${getPaciente(id)}`);
          return;
        }
        window.open(
          `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(buildWhatsAppMessage("patient", id))}`,
          "_blank"
        );
      });
    }

    if (target === "doctor" || target === "all") {
      form.doctor_ids.forEach((id) => {
        const phone = normalizePhone(doctors.find((d) => d.id === id)?.phone);
        if (!phone) {
          missing.push(`Médico: ${getMedico(id)}`);
          return;
        }
        window.open(
          `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(messageDoctor)}`,
          "_blank"
        );
        logDoctorNotification(id, messageDoctor);
      });
    }

    if (missing.length) {
      toast.error(`WhatsApp não enviado (sem telefone): ${missing.join(", ")}`);
    } else {
      toast.success("WhatsApp aberto para envio.");
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

  const createPendingDoctor = async () => {
    const name = quickDoctorName.trim();
    if (!name) {
      toast.error("Digite o nome do médico");
      return;
    }

    try {
      setIsCreatingDoctor(true);
      const pendingEmail = `pendente.${Date.now()}@sistema.com`;

      const { data: userData, error: userError } = await supabase
        .from("users")
        .insert([
          {
            name,
            email: pendingEmail,
            role: "medico",
            is_active: false,
          },
        ])
        .select()
        .single();

      if (userError || !userData) {
        throw userError;
      }

      const { data: existingMedico } = await supabase
        .from("medicos")
        .select("user_id")
        .eq("user_id", userData.id)
        .maybeSingle();

      const { error: medicoError } = existingMedico
        ? await supabase
            .from("medicos")
            .update({
              crm: "",
              specialty: "",
              horarios: JSON.stringify([]),
            })
            .eq("user_id", userData.id)
        : await supabase.from("medicos").insert([
            {
              user_id: userData.id,
              crm: "",
              specialty: "",
              horarios: JSON.stringify([]),
            },
          ]);

      if (medicoError) {
        throw medicoError;
      }

      await reloadAll();
      setForm((s) => ({
        ...s,
        doctor_ids: uniq([...s.doctor_ids, userData.id]),
      }));
      setQuickDoctorName("");
      toast.success("Médico pendente criado. Complete o cadastro em Médicos.");
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "Erro ao criar médico pendente");
    } finally {
      setIsCreatingDoctor(false);
    }
  };

  const createPendingPatient = async () => {
    const name = quickPatientName.trim();
    if (!name) {
      toast.error("Digite o nome do paciente");
      return;
    }

    try {
      setIsCreatingPatient(true);
      const pendingEmail = `pendente.${Date.now()}@sistema.com`;

      const { data: userData, error: userError } = await supabase
        .from("users")
        .insert([
          {
            name,
            email: pendingEmail,
            phone: "",
            role: "paciente",
            is_active: false,
          },
        ])
        .select()
        .single();

      if (userError || !userData) {
        throw userError;
      }

      const { data: patientData, error: patientError } = await supabase
        .from("patients")
        .insert([
          {
            user_id: userData.id,
            cpf: "",
            birth_date: null,
            address: "",
            responsavel: "",
            tipo_atendimento: "",
            valor_mensal: null,
          },
        ])
        .select()
        .single();

      if (patientError || !patientData) {
        throw patientError;
      }

      await reloadAll();
      setForm((s) => ({
        ...s,
        patient_ids: uniq([...s.patient_ids, userData.id]),
      }));
      setQuickPatientName("");
      toast.success("Paciente pendente criado. Complete o cadastro em Pacientes.");
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "Erro ao criar paciente pendente");
    } finally {
      setIsCreatingPatient(false);
    }
  };

  const goToToday = () => setCurrentWeekStart(getWeekStart(new Date()));
  const nextWeek = () => setCurrentWeekStart((d) => addDays(d, 7));
  const prevWeek = () => setCurrentWeekStart((d) => addDays(d, -7));

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      setFiltersOpen(!mobile);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("whatsapp-auto");
    setAutoWhatsApp(saved === "1");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("whatsapp-auto", autoWhatsApp ? "1" : "0");
  }, [autoWhatsApp]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const loadNotifications = () => {
      const raw = localStorage.getItem("scheduler-notifications");
      let base: any[] = [];
      try {
        base = raw ? JSON.parse(raw) : [];
      } catch {
        base = [];
      }
      setSchedulerNotifications(Array.isArray(base) ? base : []);
    };
    loadNotifications();
    window.addEventListener("storage", loadNotifications);
    return () => window.removeEventListener("storage", loadNotifications);
  }, []);

  useEffect(() => {
    const settings = loadStoredSettings();
    if (settings?.working_hours?.start && settings?.working_hours?.end) {
      setWorkingHours({
        start: settings.working_hours.start,
        end: settings.working_hours.end,
      });
    }
  }, []);

  useEffect(() => {
    const updateFromSettings = () => {
      const settings = loadStoredSettings();
      if (settings?.working_hours?.start && settings?.working_hours?.end) {
        setWorkingHours({
          start: settings.working_hours.start,
          end: settings.working_hours.end,
        });
      }
    };
    window.addEventListener("app-settings-updated", updateFromSettings);
    window.addEventListener("storage", updateFromSettings);
    return () => {
      window.removeEventListener("app-settings-updated", updateFromSettings);
      window.removeEventListener("storage", updateFromSettings);
    };
  }, []);

  useEffect(() => {
    const loadSchedule = async () => {
      if (!selectedDoctorId || selectedDoctorId === "all") {
        setDoctorSchedule([]);
        return;
      }
      const { data, error } = await supabase
        .from("medicos")
        .select("horarios")
        .eq("user_id", selectedDoctorId)
        .maybeSingle();
      if (error) {
        setDoctorSchedule([]);
        return;
      }
      setDoctorSchedule(parseMedicoHorarios(data?.horarios));
    };
    loadSchedule();
  }, [selectedDoctorId]);


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
    <div className="flex h-auto min-h-[80vh] flex-col bg-white border rounded-xl overflow-hidden shadow-sm lg:h-[90vh] lg:flex-row">
      {/* ================== SIDEBAR FILTROS ================== */}
      <aside className="w-full border-b bg-gray-50 p-2 lg:w-[260px] lg:border-b-0 lg:border-r">
        {schedulerNotifications.length > 0 && (
          <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900">
            <div className="font-semibold">Reagendar agora</div>
            <div className="mt-1 space-y-2">
              {schedulerNotifications.slice(0, 3).map((n) => (
                <div key={n.id} className="rounded-md border border-amber-200 bg-white p-2">
                  <div className="font-medium">{n.patient_name} × {n.doctor_name}</div>
                  <div className="text-[10px] text-amber-800">
                    {n.date} {n.time} — {n.reason || "Falta justificada"}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => openEditById(n.appointment_id)}
                    >
                      Reagendar agora
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 px-2"
                      onClick={() => resolveSchedulerNotification(n.appointment_id)}
                    >
                      Resolver
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button className="h-8 flex-1 bg-purple-600 hover:bg-purple-700" onClick={() => openNew()}>
            <Plus className="w-4 h-4 mr-1" /> Novo
          </Button>
          <Button variant="outline" className="h-8 px-2" onClick={setToday} title="Hoje">
            <CalendarDays className="w-4 h-4 mr-1" />
            Hoje
          </Button>
          <Button variant="outline" className="h-8 px-2" onClick={clearFilters} title="Limpar filtros">
            <RefreshCw className="w-4 h-4 mr-1" />
            Limpar
          </Button>
          <Button
            variant="outline"
            className="h-8 px-2 lg:hidden"
            onClick={() => setFiltersOpen((s) => !s)}
          >
            {filtersOpen ? "Ocultar filtros" : "Mostrar filtros"}
          </Button>
        </div>

        <div className={cn("mt-2 space-y-2", !filtersOpen && "hidden lg:block")}>
          <div className="space-y-1">
            <label className="text-[11px] text-gray-600">Buscar</label>
            <Input
              placeholder="Paciente, médico, tipo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8"
            />
          </div>

          <div className="grid grid-cols-1 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] text-gray-600">Paciente</label>
              <Select value={filterPatient} onValueChange={setFilterPatient}>
                <SelectTrigger className="h-8"><SelectValue placeholder="Todos" /></SelectTrigger>
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
                <SelectTrigger className="h-8"><SelectValue placeholder="Todos" /></SelectTrigger>
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
                <SelectTrigger className="h-8"><SelectValue placeholder="Todos" /></SelectTrigger>
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
              <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="h-8" />
            </div>
          </div>

          <div className="mt-2 rounded-lg border bg-white p-2">
            <div className="text-[11px] font-medium text-gray-700">Dica</div>
            <div className="text-[10px] text-gray-500">
              Clique em um horário vazio no calendário para abrir o novo agendamento já preenchido.
            </div>
          </div>
        </div>
      </aside>

      {/* ================== AGENDA SEMANAL ================== */}
      <main className="flex-1 p-2 bg-white min-h-[60vh] lg:overflow-hidden">
        <div className="mb-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-white p-3 shadow-sm">
            <div className="flex flex-col">
              <span className="text-xs text-gray-500">Resumo do dia</span>
              <span className="text-sm font-semibold text-gray-900">
                {new Date(`${summaryDate}T00:00:00`).toLocaleDateString("pt-BR", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                })}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700">Total: {daySummary.total}</span>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">Agendado: {daySummary.agendado}</span>
              <span className="rounded-full bg-purple-100 px-3 py-1 text-purple-700">Confirmado: {daySummary.confirmado}</span>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">Realizado: {daySummary.realizado}</span>
              <span className="rounded-full bg-slate-200 px-3 py-1 text-slate-700">Cancelado: {daySummary.cancelado}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-white p-3 shadow-sm">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={prevWeek}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToToday}>
                Hoje
              </Button>
              <Button variant="outline" size="sm" onClick={nextWeek}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-sm font-semibold text-gray-800">
              {`${pad2(weekOfMonth(currentWeekStart))}-SEMANA DE ${new Date(
                currentWeekStart
              )
                .toLocaleDateString("pt-BR", { month: "long" })
                .toUpperCase()} DE ${currentWeekStart.getFullYear()}`}
            </div>
            <div className="min-w-[220px]">
              <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione o médico" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Ver todos agendamentos</SelectItem>
                  {doctors.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="h-full overflow-x-auto lg:overflow-x-visible lg:max-h-[78vh] lg:overflow-y-auto lg:pr-2">
          <div className="w-full">
            <table className="min-w-[720px] w-full table-fixed border-collapse text-[10px] sm:text-[11px]">
              <thead>
                <tr className="bg-purple-200 text-gray-900">
                  <th className="sticky left-0 z-10 w-14 border border-purple-300 bg-purple-200 px-1 py-1 text-left">
                    Hora
                  </th>
                  {weekDates.map((d, idx) => {
                    const dayLabel = ["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA"][idx] || "";
                    return (
                      <th
                        key={toDateStr(d)}
                        className="border border-purple-300 px-1 py-1 text-center"
                      >
                        <div className="text-[10px] font-semibold">{dayLabel}</div>
                        <div className="text-[11px] font-bold">{toShortDate(d)}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {timeSlots.map((time) => (
                  <tr key={time}>
                    <td className="sticky left-0 z-10 border border-purple-300 bg-purple-100 px-1 py-1 font-semibold text-gray-800">
                      {time}
                    </td>
                    {weekDates.map((d) => {
                      const dateStr = toDateStr(d);
                      const key = `${dateStr}__${time}`;
                      const items = appointmentsBySlot.get(key) || [];
                      const available = isSlotAvailable(d.getDay(), time);

                      return (
                        <td
                          key={key}
                          className={cn(
                            "border border-purple-200 px-1 py-1 align-top",
                            available ? "bg-white" : "bg-gray-100 text-gray-400"
                          )}
                          onClick={() => {
                            if (!available) return;
                            openNew({
                              date: dateStr,
                              time,
                              doctor_ids: selectedDoctorId !== "all" ? [selectedDoctorId] : [],
                            });
                          }}
                        >
                          {items.length > 0 ? (
                            <div className="space-y-2">
                              {items.map((apt) => {
                                const patientNames = getAllPatients(apt)
                                  .map(getPaciente)
                                  .join(", ");
                                const colorKey = getAllPatients(apt)[0] || apt.patient_id;
                                const bg = hashColor(colorKey);
                                return (
                                  <div
                                    key={apt.id}
                                    className="rounded-md px-1 py-1 text-white shadow-sm"
                                    style={{ backgroundColor: bg }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openEdit(apt);
                                    }}
                                  >
                                    <div className="text-[10px] font-semibold leading-tight break-words">
                                      {patientNames}
                                      {apt.is_fixed && <span className="ml-1">📌</span>}
                                    </div>
                                    {selectedDoctorId === "all" && (
                                      <div className="text-[9px] opacity-90 break-words">
                                        {getAllDoctors(apt).map(getMedico).join(", ")}
                                      </div>
                                    )}
                                    <div className="text-[9px] opacity-90 break-words">{apt.type}</div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : available ? (
                            <span className="text-xs font-semibold text-purple-600">VAGO</span>
                          ) : (
                            <span className="text-xs font-semibold text-gray-400">X</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* ================== PAINEL (FORM) ================== */}
      {panelOpen && !isMobile && (
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
                  <div className="border-t bg-slate-50 p-3">
                    <div className="text-[11px] font-semibold text-slate-600">
                      Adicionar paciente pendente
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Input
                        placeholder="Nome do paciente"
                        value={quickPatientName}
                        onChange={(e) => setQuickPatientName(e.target.value)}
                        className="h-9"
                      />
                      <Button
                        type="button"
                        className="h-9 bg-primary text-primary-foreground hover:bg-primary/90"
                        onClick={createPendingPatient}
                        disabled={isCreatingPatient}
                      >
                        {isCreatingPatient ? "Criando..." : "Adicionar"}
                      </Button>
                    </div>
                  </div>
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
                  <div className="border-t bg-slate-50 p-3">
                    <div className="text-[11px] font-semibold text-slate-600">
                      Adicionar médico pendente
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Input
                        placeholder="Nome do médico"
                        value={quickDoctorName}
                        onChange={(e) => setQuickDoctorName(e.target.value)}
                        className="h-9"
                      />
                      <Button
                        type="button"
                        className="h-9 bg-purple-600 hover:bg-purple-700"
                        onClick={createPendingDoctor}
                        disabled={isCreatingDoctor}
                      >
                        {isCreatingDoctor ? "Criando..." : "Adicionar"}
                      </Button>
                    </div>
                  </div>
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
    <Select
      value={normalizeTime(form.time)}
      onValueChange={(v) => setForm((s) => ({ ...s, time: v }))}
      disabled={!form.date || allowedTimeSlots.length === 0}
    >
      <SelectTrigger className="h-10">
        <SelectValue placeholder={form.date ? "Selecione" : "Escolha a data"} />
      </SelectTrigger>
      <SelectContent>
        {allowedTimeSlots.map((t) => (
          <SelectItem key={t} value={t}>
            {t}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
              <div className="grid grid-cols-2 gap-2 mt-2">
                <Button
                  type="button"
                  variant={form.status === "agendado" ? "default" : "outline"}
                  className="h-9"
                  onClick={() => setForm((s) => ({ ...s, status: "agendado" }))}
                >
                  Pendente
                </Button>
                <Button
                  type="button"
                  variant={form.status === "confirmado" ? "default" : "outline"}
                  className="h-9"
                  onClick={() => setForm((s) => ({ ...s, status: "confirmado" }))}
                >
                  Confirmado
                </Button>
                <Button
                  type="button"
                  variant={form.status === "cancelado" ? "destructive" : "outline"}
                  className="h-9"
                  onClick={() => setForm((s) => ({ ...s, status: "cancelado" }))}
                >
                  Cancelado
                </Button>
                <Button
                  type="button"
                  variant={form.status === "realizado" ? "default" : "outline"}
                  className="h-9"
                  onClick={() => setForm((s) => ({ ...s, status: "realizado" }))}
                >
                  Realizado
                </Button>
              </div>
              {isReschedule && (
                <p className="text-[10px] text-amber-600">
                  Reagendado: status será definido como pendente automaticamente.
                </p>
              )}
              {isReschedule && (
                <p className="text-[10px] text-gray-500">
                  O médico recebe notificação no login.
                </p>
              )}
            </div>

            <label className="flex items-center gap-2 text-[11px] text-gray-700">
              <input
                type="checkbox"
                checked={autoWhatsApp}
                onChange={(e) => setAutoWhatsApp(e.target.checked)}
              />
              WhatsApp automático ao salvar (opcional)
            </label>

            <label className="flex items-center gap-2 text-[11px] text-gray-700">
              <input
                type="checkbox"
                checked={form.is_fixed}
                onChange={(e) => setForm((s) => ({ ...s, is_fixed: e.target.checked }))}
              />
              Agendamento fixo (repete semanalmente)
            </label>

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

            {/* WHATSAPP */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                className="h-10"
                onClick={() => sendWhatsApp("patient")}
              >
                WhatsApp Paciente
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-10"
                onClick={() => sendWhatsApp("doctor")}
              >
                WhatsApp Médico
              </Button>
              <Button
                type="button"
                className="h-10 col-span-2"
                onClick={() => sendWhatsApp("all")}
              >
                WhatsApp Todos
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

      {panelOpen && isMobile && (
        <div className="fixed inset-0 z-50 flex">
          <button
            className="absolute inset-0 bg-black/30"
            onClick={closePanel}
            aria-label="Fechar painel"
          />
          <aside className="relative ml-auto h-full w-full max-w-[520px] border-l bg-white p-4 pb-28 overflow-y-auto">
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

                  <PopoverContent className="p-0 w-[90vw] max-w-[420px]">
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
                    <div className="border-t bg-slate-50 p-3">
                      <div className="text-[11px] font-semibold text-slate-600">
                        Adicionar paciente pendente
                      </div>
                      <div className="mt-2 flex gap-2">
                        <Input
                          placeholder="Nome do paciente"
                          value={quickPatientName}
                          onChange={(e) => setQuickPatientName(e.target.value)}
                          className="h-9"
                        />
                        <Button
                          type="button"
                          className="h-9 bg-primary text-primary-foreground hover:bg-primary/90"
                          onClick={createPendingPatient}
                          disabled={isCreatingPatient}
                        >
                          {isCreatingPatient ? "Criando..." : "Adicionar"}
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

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

                  <PopoverContent className="p-0 w-[90vw] max-w-[420px]">
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
                    <div className="border-t bg-slate-50 p-3">
                      <div className="text-[11px] font-semibold text-slate-600">
                        Adicionar médico pendente
                      </div>
                      <div className="mt-2 flex gap-2">
                        <Input
                          placeholder="Nome do médico"
                          value={quickDoctorName}
                          onChange={(e) => setQuickDoctorName(e.target.value)}
                          className="h-9"
                        />
                        <Button
                          type="button"
                          className="h-9 bg-purple-600 hover:bg-purple-700"
                          onClick={createPendingDoctor}
                          disabled={isCreatingDoctor}
                        >
                          {isCreatingDoctor ? "Criando..." : "Adicionar"}
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

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

              <div className="grid grid-cols-2 gap-2">
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

                <div className="space-y-1">
                  <label className="text-[11px] text-gray-600">Hora*</label>
                  <Select
                    value={normalizeTime(form.time)}
                    onValueChange={(v) => setForm((s) => ({ ...s, time: v }))}
                    disabled={!form.date || allowedTimeSlots.length === 0}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder={form.date ? "Selecione" : "Escolha a data"} />
                    </SelectTrigger>
                    <SelectContent>
                      {allowedTimeSlots.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

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
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <Button
                    type="button"
                    variant={form.status === "agendado" ? "default" : "outline"}
                    className="h-9"
                    onClick={() => setForm((s) => ({ ...s, status: "agendado" }))}
                  >
                    Pendente
                  </Button>
                  <Button
                    type="button"
                    variant={form.status === "confirmado" ? "default" : "outline"}
                    className="h-9"
                    onClick={() => setForm((s) => ({ ...s, status: "confirmado" }))}
                  >
                    Confirmado
                  </Button>
                  <Button
                    type="button"
                    variant={form.status === "cancelado" ? "destructive" : "outline"}
                    className="h-9"
                    onClick={() => setForm((s) => ({ ...s, status: "cancelado" }))}
                  >
                    Cancelado
                  </Button>
                  <Button
                    type="button"
                    variant={form.status === "realizado" ? "default" : "outline"}
                    className="h-9"
                    onClick={() => setForm((s) => ({ ...s, status: "realizado" }))}
                  >
                    Realizado
                  </Button>
                </div>
              {isReschedule && (
                <p className="text-[10px] text-amber-600">
                  Reagendado: status será definido como pendente automaticamente.
                </p>
              )}
              {isReschedule && (
                <p className="text-[10px] text-gray-500">
                  O médico recebe notificação no login.
                </p>
              )}
            </div>

              <label className="flex items-center gap-2 text-[11px] text-gray-700">
                <input
                  type="checkbox"
                  checked={autoWhatsApp}
                  onChange={(e) => setAutoWhatsApp(e.target.checked)}
                />
                WhatsApp automático ao salvar (opcional)
              </label>

              <label className="flex items-center gap-2 text-[11px] text-gray-700">
                <input
                  type="checkbox"
                  checked={form.is_fixed}
                  onChange={(e) => setForm((s) => ({ ...s, is_fixed: e.target.checked }))}
                />
                Agendamento fixo (repete semanalmente)
              </label>

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

              <div className="space-y-1">
                <label className="text-[11px] text-gray-600">Observações</label>
                <Textarea
                  className="min-h-[100px]"
                  placeholder="Opcional..."
                  value={form.notes}
                  onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
                />
              </div>

              <div className="fixed bottom-0 left-0 right-0 z-10 border-t bg-white/95 backdrop-blur md:hidden">
                <div className="mx-auto flex w-full max-w-[520px] flex-col gap-2 p-4">
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 h-11 bg-purple-600 hover:bg-purple-700"
                      onClick={save}
                      disabled={conflictForm}
                    >
                      {editing ? "Salvar alterações" : "Salvar"}
                    </Button>
                    <Button variant="outline" className="flex-1 h-11" onClick={closePanel}>
                      Cancelar
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11"
                      onClick={() => sendWhatsApp("patient")}
                    >
                      WhatsApp Paciente
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11"
                      onClick={() => sendWhatsApp("doctor")}
                    >
                      WhatsApp Médico
                    </Button>
                    <Button
                      type="button"
                      className="h-11 col-span-2"
                      onClick={() => sendWhatsApp("all")}
                    >
                      WhatsApp Todos
                    </Button>
                  </div>
                </div>
              </div>

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
        </div>
      )}
    </div>
  );
}
