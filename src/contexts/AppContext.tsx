"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { sendPushNotification } from "@/lib/push";

/* ======================================================
   TIPOS (ALINHADOS AO BANCO REAL)
====================================================== */

export type UserRole =
  | "admin"
  | "financeiro"
  | "agendamento"
  | "medico"
  | "paciente";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  created_at: string;
  is_active: boolean;
  phone?: string;
}

/* 🔥 STATUS REAL DO BANCO */
export type AppointmentStatus =
  | "agendado"
  | "pendente"
  | "confirmado"
  | "realizado"
  | "cancelado";

export interface Appointment {
  id: string;

  patient_id: string; // principal
  doctor_id: string; // principal

  // ✅ DERIVADOS (NÃO EXISTEM COMO COLUNAS)
  patient_ids: string[];
  doctor_ids: string[];

  date: string; // YYYY-MM-DD
  time: string; // HH:mm (ou HH:mm:ss no banco)
  status: AppointmentStatus;
  type: string;
  notes?: string | null;
  price: number;
  created_at: string;
  is_fixed?: boolean;
  is_virtual?: boolean;
  recurrence_source_id?: string;
}

export interface AppointmentRecurrence {
  id: string;
  appointment_id: string;
  frequency: "weekly" | "monthly";
  interval: number;
  end_date?: string | null;
  created_at: string;
}

export interface FinancialRecord {
  id: string;
  type: "receita" | "despesa";
  amount: number;
  description: string;
  category: string;
  date: string;
  appointment_id?: string | null;
  status: "pendente" | "pago" | "cancelado";
  created_at: string;
}

export interface MedicalRecord {
  id: string;
  patient_id: string;
  doctor_id: string;
  appointment_id: string;
  date: string;
  description: string;
  notes?: string | null;
  created_at: string;
}

/* ⚠️ NÃO EXISTE TABELA services NO SEU BANCO
   → Mantido como MOCK para NÃO QUEBRAR telas (services.find) */
export interface Service {
  id: string;
  name: string;
  duration: number;
  price: number;
  description: string;
  category: string;
  is_active: boolean;
  created_at: string;
}

/* ======================================================
   CONTEXTO
====================================================== */

interface AppContextType {
  users: User[];
  doctors: User[];
  patients: User[];
  appointments: Appointment[];
  recurrences: AppointmentRecurrence[];
  financialRecords: FinancialRecord[];
  medicalRecords: MedicalRecord[];
  services: Service[];

  loading: boolean;
  error: string | null;

  reloadAll: () => Promise<void>;

  addUser: (
    data: Omit<User, "id" | "created_at"> & { password?: string },
    password?: string
  ) => Promise<boolean>;
  updateUser: (
    id: string,
    data: Partial<User> & { password?: string }
  ) => Promise<boolean>;
  deleteUser: (id: string) => Promise<boolean>;

  // ⚠️ Aqui aceitamos patient_ids/doctor_ids opcionais para multi seleção
  addAppointment: (
    data: Omit<Appointment, "id" | "created_at"> & {
      patient_ids?: string[];
      doctor_ids?: string[];
    }
  ) => Promise<boolean>;

  updateAppointment: (
    id: string,
    data: Partial<Appointment> & {
      patient_ids?: string[];
      doctor_ids?: string[];
    }
  ) => Promise<boolean>;

  deleteAppointment: (id: string) => Promise<boolean>;

  addFinancialRecord: (
    data: Omit<FinancialRecord, "id" | "created_at">
  ) => Promise<boolean>;
  updateFinancialRecord: (
    id: string,
    data: Partial<FinancialRecord>
  ) => Promise<boolean>;
  deleteFinancialRecord: (id: string) => Promise<boolean>;

  addService: (
    data: Omit<Service, "id" | "created_at">
  ) => Promise<boolean>;
  updateService: (id: string, data: Partial<Service>) => Promise<boolean>;
  deleteService: (id: string) => Promise<boolean>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

/* ======================================================
   PROVIDER
====================================================== */

export function AppProvider({ children }: { children: React.ReactNode }) {
  const RECURRENCE_OVERRIDE_NOTE_PREFIX = "__recurrence_override__:";
  const RECURRENCE_INSTANCE_NOTE_PREFIX = "__recurrence_instance__:";
  const isInternalRecurrenceNote = (notes?: string | null) => {
    const note = String(notes || "");
    return (
      note.startsWith(RECURRENCE_OVERRIDE_NOTE_PREFIX) ||
      note.startsWith(RECURRENCE_INSTANCE_NOTE_PREFIX)
    );
  };
  const pendingStatusRef = React.useRef<"agendado" | "pendente">("agendado");
  const CACHE_KEY = "neuro-app-cache-v1";
  const [users, setUsers] = useState<User[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [recurrences, setRecurrences] = useState<AppointmentRecurrence[]>([]);
  const [financialRecords, setFinancialRecords] = useState<FinancialRecord[]>(
    []
  );
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([]);

  // 🔥 SEMPRE array (nunca undefined) para não quebrar services.find
  const [services, setServices] = useState<Service[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const SERVICES_KEY = "neuro-services-v1";
  const usersRef = React.useRef<User[]>([]);
  const appointmentsRef = React.useRef<Appointment[]>([]);
  const optimisticPendingRef = React.useRef<Map<string, number>>(new Map());
  const isLoadingAllRef = React.useRef(false);
  const pendingLoadAllRef = React.useRef(false);
  const isLoadingAppointmentsOnlyRef = React.useRef(false);
  const pendingAppointmentsOnlyRef = React.useRef(false);
  const realtimeLoadTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  useEffect(() => {
    appointmentsRef.current = appointments;
  }, [appointments]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(SERVICES_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      setServices(
        parsed.map((s: any) => ({
          id: String(s.id || crypto.randomUUID()),
          name: String(s.name || "Serviço"),
          duration: Number(s.duration) || 60,
          price: Number(s.price) || 0,
          description: s.description ? String(s.description) : "",
          category: s.category ? String(s.category) : "Outros",
          is_active: s.is_active !== false,
          created_at: s.created_at ? String(s.created_at) : new Date().toISOString(),
        }))
      );
    } catch {
      // non-fatal
    }
  }, []);

  const doctors = users.filter((u) => u.role === "medico");
  const patients = users.filter((u) => u.role === "paciente");

  const uniq = (arr: string[] = []) =>
    Array.from(new Set(arr.filter(Boolean)));

  const normalizeTimeToHHMM = (t?: string | null) => {
    if (!t) return "";
    const raw = String(t).trim();
    const m = raw.match(/(\d{1,2}):(\d{2})/);
    if (!m) return "";
    return `${m[1].padStart(2, "0")}:${m[2]}`;
  };

  const normalizePhone = (value?: string | null) => {
    if (!value) return "";
    const digits = value.replace(/\D/g, "");
    if (!digits) return "";
    if (digits.startsWith("55")) {
      return digits.length >= 12 ? digits : "";
    }
    if (digits.length === 10 || digits.length === 11) {
      return `55${digits}`;
    }
    return "";
  };

  const getUserById = (id?: string | null) =>
    id ? users.find((u) => u.id === id) : undefined;

  const getUsersByIds = (ids: string[] = []) =>
    ids.map((id) => getUserById(id)).filter(Boolean) as User[];

  const toUiStatus = (s: AppointmentStatus) =>
    s === "pendente" || s === "agendado" ? "agendado" : s;

  const isAppointmentStatusConstraintError = (err: any) => {
    const msg = String(err?.message || err || "").toLowerCase();
    return msg.includes("appointments_status_check");
  };

  const alternatePendingStatus = (status: "agendado" | "pendente") =>
    status === "agendado" ? "pendente" : "agendado";

  const normalizeAppointmentStatusForDb = (
    status?: AppointmentStatus | string | null
  ): AppointmentStatus => {
    if (!status || status === "pendente" || status === "agendado") {
      return pendingStatusRef.current;
    }
    if (
      status === "confirmado" ||
      status === "realizado" ||
      status === "cancelado"
    ) {
      return status;
    }
    return pendingStatusRef.current;
  };

  const buildStatusCandidates = (
    status?: AppointmentStatus | string | null
  ): AppointmentStatus[] => {
    const normalized = normalizeAppointmentStatusForDb(status);
    if (normalized === "agendado" || normalized === "pendente") {
      const alt = alternatePendingStatus(normalized);
      return [normalized, alt];
    }
    return [normalized];
  };

  const forceAllAppointmentsToPending = async () => {
    const candidates = buildStatusCandidates("pendente");
    let lastError: any = null;

    for (const candidate of candidates) {
      const { error } = await supabase
        .from("appointments")
        .update({ status: candidate })
        .neq("status", candidate);

      if (!error) {
        if (candidate === "agendado" || candidate === "pendente") {
          pendingStatusRef.current = candidate;
        }
        return candidate;
      }

      lastError = error;
      if (!isAppointmentStatusConstraintError(error)) break;
    }

    throw lastError || new Error("Não foi possível deixar os agendamentos pendentes.");
  };

  const removeDuplicateAppointments = async () => {
    const { data, error } = await supabase
      .from("appointments")
      .select("id,date,time,doctor_id,patient_id,created_at,notes");

    if (error) throw error;

    const rows = (data ?? []).filter((apt: any) => {
      const note = String(apt?.notes || "");
      return (
        !note.startsWith(RECURRENCE_OVERRIDE_NOTE_PREFIX) &&
        !note.startsWith(RECURRENCE_INSTANCE_NOTE_PREFIX)
      );
    });

    const groups = new Map<string, any[]>();
    rows.forEach((apt: any) => {
      const key = `${apt.date}|${normalizeTimeToHHMM(apt.time)}|${apt.doctor_id}|${apt.patient_id}`;
      const list = groups.get(key) || [];
      list.push(apt);
      groups.set(key, list);
    });

    const toDelete: string[] = [];
    groups.forEach((list) => {
      if (list.length <= 1) return;
      const sorted = list
        .slice()
        .sort(
          (a, b) =>
            new Date(a.created_at || 0).getTime() -
            new Date(b.created_at || 0).getTime()
        );
      // mantém o mais antigo, remove os demais
      toDelete.push(...sorted.slice(1).map((row) => row.id).filter(Boolean));
    });

    if (!toDelete.length) return 0;

    await supabase.from("appointment_patients").delete().in("appointment_id", toDelete);
    await supabase.from("appointment_doctors").delete().in("appointment_id", toDelete);
    await supabase.from("financial_records").delete().in("appointment_id", toDelete);
    await supabase.from("appointments").delete().in("id", toDelete);

    return toDelete.length;
  };

  const formatDateTime = (date?: string, time?: string) => {
    if (!date || !time) return "";
    const [y, m, d] = date.split("-");
    const t = normalizeTimeToHHMM(time);
    return `${d}/${m}/${y} ${t}`;
  };

  const formatDateOnly = (date?: string) => {
    if (!date) return "";
    const [y, m, d] = date.split("-");
    return `${d}/${m}/${y}`;
  };

  const getDoctorName = (doctorId?: string | null) =>
    doctorId ? getUserById(doctorId)?.name || "Médico" : "Médico";

  const getPatientDailySummary = (
    patientId: string,
    date: string,
    includeAppointment?: Appointment
  ) => {
    const dayAppointments = appointments.filter(
      (apt) =>
        apt.date === date &&
        (apt.patient_id === patientId ||
          (apt.patient_ids || []).includes(patientId))
    );

    const include =
      includeAppointment &&
      !dayAppointments.some((a) => a.id === includeAppointment.id)
        ? [...dayAppointments, includeAppointment]
        : dayAppointments;

    const sorted = include
      .slice()
      .sort(
        (a, b) =>
          new Date(`${a.date}T${a.time || "00:00"}`).getTime() -
          new Date(`${b.date}T${b.time || "00:00"}`).getTime()
      );

    return sorted.map((apt) => {
      const doctorName = getDoctorName(apt.doctor_id);
      const time = normalizeTimeToHHMM(apt.time);
      const type = apt.type ? ` - ${apt.type}` : "";
      return `${time} (${doctorName}${type})`;
    });
  };

  const openWhatsApp = (to: string, message: string) => {
    const url = `https://api.whatsapp.com/send?phone=${to}&text=${encodeURIComponent(
      message
    )}`;
    window.open(url, "_blank");
  };

  const buildAppointmentMessages = (params: {
    type: "create" | "update" | "cancel" | "reschedule";
    appointment: Appointment;
    previous?: Appointment | null;
    patientIds: string[];
    doctorIds: string[];
  }) => {
    const { type, appointment, previous, patientIds, doctorIds } = params;
    const patientsList = getUsersByIds(patientIds);
    const doctorsList = getUsersByIds(doctorIds);

    const patientNames = patientsList.map((u) => u.name).join(", ");
    const doctorNames = doctorsList.map((u) => u.name).join(", ");

    const dateTime = formatDateTime(appointment.date, appointment.time);
    const prevDateTime = previous
      ? formatDateTime(previous.date, previous.time)
      : "";

    const statusLabel = toUiStatus(appointment.status);

    const dateLabel = formatDateOnly(appointment.date);
    const timeLabel = normalizeTimeToHHMM(appointment.time);
    const serviceLabel = appointment.type ? `com ${appointment.type}` : "com atendimento";

    const patientMessageBase =
      type === "cancel"
        ? `Olá, bom dia, tudo bem?\n${patientNames} seu atendimento agendado para o dia ${dateLabel}, às ${timeLabel}, ${serviceLabel} (${doctorNames}) foi cancelado.`
        : type === "reschedule"
          ? `Olá, bom dia, tudo bem?\n${patientNames} seu atendimento foi reagendado de ${prevDateTime || dateTime} para ${dateLabel}, às ${timeLabel}, ${serviceLabel} (${doctorNames}).`
          : `Olá, bom dia, tudo bem?\n${patientNames} você tem atendimento agendado para o dia ${dateLabel}, às ${timeLabel}, ${serviceLabel} (${doctorNames}).\nPosso confirmar a presença hoje?`;

    const patientSummaries = patientsList.map((p) => ({
      patientId: p.id,
      message: patientMessageBase.replace(patientNames, p.name),
    }));

    const doctorMessage =
      type === "cancel"
        ? `Olá, bom dia, tudo bem?\n${doctorNames} o atendimento agendado para o dia ${dateLabel}, às ${timeLabel}, ${serviceLabel} (${patientNames}) foi cancelado.`
        : type === "reschedule"
          ? `Olá, bom dia, tudo bem?\n${doctorNames} o atendimento foi reagendado de ${prevDateTime || dateTime} para ${dateLabel}, às ${timeLabel}, ${serviceLabel} (${patientNames}).`
          : `Olá, bom dia, tudo bem?\n${doctorNames} você tem atendimento agendado para o dia ${dateLabel}, às ${timeLabel}, ${serviceLabel} (${patientNames}).`;

    return { patientsList, doctorsList, patientSummaries, doctorMessage };
  };

  const logDoctorNotification = (
    doctorId: string,
    type: "create" | "update" | "cancel" | "reschedule",
    message: string,
    appointmentId: string
  ) => {
    if (typeof window === "undefined") return;
    const payload = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      doctor_id: doctorId,
      appointment_id: appointmentId,
      type,
      message,
      created_at: new Date().toISOString(),
    };
    const raw = localStorage.getItem("whatsapp-notifications");
    const list = raw ? JSON.parse(raw) : [];
    list.unshift(payload);
    localStorage.setItem("whatsapp-notifications", JSON.stringify(list));
  };

  const notifyAppointmentWhatsApp = (params: {
    type: "create" | "update" | "cancel" | "reschedule";
    appointment: Appointment;
    previous?: Appointment | null;
    patientIds: string[];
    doctorIds: string[];
  }) => {
    if (typeof window === "undefined") return;
    if (!navigator.onLine) {
      toast.error("Sem internet para enviar WhatsApp.");
      return;
    }

    if (localStorage.getItem("whatsapp-auto") !== "1") {
      return;
    }

    const { type, appointment, patientIds, doctorIds } = params;
    const { patientsList, doctorsList, patientSummaries, doctorMessage } =
      buildAppointmentMessages(params);

    const missing: string[] = [];

    patientSummaries.forEach((summary) => {
      const patient = patientsList.find((p) => p.id === summary.patientId);
      const phone = normalizePhone(patient?.phone);
      if (!phone || !patient) {
        missing.push(`Paciente: ${patient?.name || summary.patientId}`);
        return;
      }
      openWhatsApp(phone, summary.message);
    });

    doctorsList.forEach((d) => {
      const phone = normalizePhone(d.phone);
      if (!phone) {
        missing.push(`Médico: ${d.name}`);
        return;
      }
      openWhatsApp(phone, doctorMessage);
      logDoctorNotification(d.id, type, doctorMessage, appointment.id);
    });

    if (missing.length) {
      toast.error(`WhatsApp não enviado (sem telefone): ${missing.join(", ")}`);
    } else {
      toast.success("WhatsApp enviado para paciente(s) e médico(s).");
    }
  };

  /* ======================================================
     NORMALIZAÇÃO RELACIONAL
====================================================== */

  const normalizeAppointment = (apt: any): Appointment => {
    const patientRel = apt.appointment_patients ?? [];
    const doctorRel = apt.appointment_doctors ?? [];

    return {
      ...apt,
      time: normalizeTimeToHHMM(apt.time),
      patient_ids: uniq([
        apt.patient_id,
        ...patientRel.map((p: any) => p.patient_id),
      ]),
      doctor_ids: uniq([
        apt.doctor_id,
        ...doctorRel.map((d: any) => d.doctor_id),
      ]),
    };
  };

  const RECURRING_END_DATE = "2026-12-31";
  const RECURRENCE_EXPAND_DAYS = 56;

  const pad2 = (n: number) => String(n).padStart(2, "0");

  const toDateOnly = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const parseDate = (value?: string) => {
    if (!value) return null;
    const [y, m, d] = value.split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  };

  const formatDate = (d: Date) =>
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

  const addDays = (d: Date, days: number) => {
    const next = new Date(d);
    next.setDate(next.getDate() + days);
    return next;
  };

  const makeAppointmentKey = (apt: Appointment, dateOverride?: string) =>
    `${dateOverride ?? apt.date}|${apt.time}|${apt.doctor_id}|${apt.patient_id}`;

  const expandWeeklyAppointments = (base: Appointment[]) => {
    const isRecurrenceOverride = (apt: Appointment) =>
      typeof apt.notes === "string" &&
      apt.notes.startsWith(RECURRENCE_OVERRIDE_NOTE_PREFIX);

    const today = toDateOnly(new Date());
    const fixedEnd = parseDate(RECURRING_END_DATE);
    const maxWindowEnd = addDays(today, RECURRENCE_EXPAND_DAYS);
    const fixedOrDefault = fixedEnd && fixedEnd > today ? fixedEnd : addDays(today, 7);
    const horizon = fixedOrDefault < maxWindowEnd ? fixedOrDefault : maxWindowEnd;
    const existingKeys = new Set(base.map((apt) => makeAppointmentKey(apt)));
    const visibleBase = base.filter((apt) => !isRecurrenceOverride(apt));
    const expanded: Appointment[] = [...visibleBase];

    visibleBase.forEach((apt) => {
      if (apt.status === "cancelado") return;
      if (apt.is_fixed !== true) return;

      const baseDate = parseDate(apt.date);
      if (!baseDate) return;

      let next = baseDate < today ? baseDate : addDays(baseDate, 7);
      while (next < today) next = addDays(next, 7);

      for (; next <= horizon; next = addDays(next, 7)) {
        const nextDate = formatDate(next);
        const key = makeAppointmentKey(apt, nextDate);
        if (existingKeys.has(key)) continue;

        existingKeys.add(key);
        expanded.push({
          ...apt,
          id: `${apt.id}::${nextDate}`,
          date: nextDate,
          status: apt.status,
          is_virtual: true,
          recurrence_source_id: apt.id,
          is_fixed: true,
        });
      }
    });

    return expanded.sort(
      (a, b) =>
        new Date(`${a.date}T${a.time || "00:00"}`).getTime() -
        new Date(`${b.date}T${b.time || "00:00"}`).getTime()
    );
  };

  const fetchAllAppointments = async () => {
    const pageSize = 1000;
    const allRows: any[] = [];
    let from = 0;

    while (true) {
      let chunkRes = await supabase
        .from("appointments")
        .select(
          `
            *,
            appointment_patients(patient_id),
            appointment_doctors(doctor_id)
          `
        )
        .order("date", { ascending: true })
        .order("time", { ascending: true })
        .range(from, from + pageSize - 1);

      if (chunkRes.error) {
        console.warn(
          "fetchAllAppointments with relations failed, trying fallback:",
          chunkRes.error.message
        );

        const fallbackRes = await supabase
          .from("appointments")
          .select("*")
          .order("date", { ascending: true })
          .order("time", { ascending: true })
          .range(from, from + pageSize - 1);

        if (fallbackRes.error) {
          throw fallbackRes.error;
        }

        const fallbackRows = (fallbackRes.data ?? []).map((a: any) => ({
          ...a,
          appointment_patients: [],
          appointment_doctors: [],
        }));
        allRows.push(...fallbackRows);

        if ((fallbackRows?.length ?? 0) < pageSize) break;
        from += pageSize;
        continue;
      }

      const chunk = chunkRes.data ?? [];
      allRows.push(...chunk);
      if (chunk.length < pageSize) break;
      from += pageSize;
    }

    return allRows;
  };

  /* ======================================================
     LOAD ALL (FONTE ÚNICA)
====================================================== */

  const applyAppointmentsRows = useCallback(
    (allAppointmentsRows: any[]) => {
      const baseAppointments = allAppointmentsRows.map(normalizeAppointment);

      const now = Date.now();
      const serverIds = new Set(baseAppointments.map((apt) => apt.id));
      serverIds.forEach((id) => optimisticPendingRef.current.delete(id));

      const localBase = appointmentsRef.current.filter(
        (apt) => !apt.is_virtual && !String(apt.id || "").includes("::")
      );

      const carryFromOptimistic = localBase.filter((apt) => {
        const createdAt = optimisticPendingRef.current.get(apt.id);
        if (!createdAt) return false;
        const fresh = now - createdAt <= 2 * 60 * 1000;
        if (!fresh) {
          optimisticPendingRef.current.delete(apt.id);
          return false;
        }
        return !serverIds.has(apt.id);
      });

      const mergedBase = [
        ...baseAppointments,
        ...carryFromOptimistic.filter(
          (apt) => !baseAppointments.some((serverApt) => serverApt.id === apt.id)
        ),
      ];

      setAppointments(expandWeeklyAppointments(mergedBase));
    },
    []
  );

  const performLoadAll = useCallback(async () => {
    let coreLoaded = false;
    try {
      setLoading(true);
      setError(null);

      const [usersRes, allAppointmentsRows] = await Promise.all([
        supabase.from("users").select("*"),
        fetchAllAppointments(),
      ]);

      // Falhas críticas: sem usuários ou agendamentos não dá para operar.
      if (usersRes.error) throw usersRes.error;
      if (!Array.isArray(allAppointmentsRows)) {
        throw new Error("Falha ao carregar agendamentos.");
      }

      setUsers(usersRes.data ?? []);
      applyAppointmentsRows(allAppointmentsRows);
      coreLoaded = true;
      setLoading(false);

      const [finRes, medRes, recRes] = await Promise.all([
        supabase.from("financial_records").select("*"),
        supabase.from("medical_records").select("*"),
        supabase.from("appointment_recurrences").select("*"),
      ]);

      if (finRes.error) {
        console.warn("loadAll financial_records non-fatal:", finRes.error.message);
      }
      if (medRes.error) {
        console.warn("loadAll medical_records non-fatal:", medRes.error.message);
      }
      if (recRes.error) {
        console.warn("loadAll appointment_recurrences non-fatal:", recRes.error.message);
      }

      setFinancialRecords(finRes.error ? [] : finRes.data ?? []);
      setMedicalRecords(medRes.error ? [] : medRes.data ?? []);
      setRecurrences(recRes.error ? [] : recRes.data ?? []);

      // garante sempre array
      setServices((prev) => (Array.isArray(prev) ? prev : []));

      if (typeof window !== "undefined") {
        const cachePayload = {
          users: usersRes.data ?? [],
          appointments: allAppointmentsRows ?? [],
          financialRecords: finRes.error ? [] : finRes.data ?? [],
          medicalRecords: medRes.error ? [] : medRes.data ?? [],
          recurrences: recRes.error ? [] : recRes.data ?? [],
          services: [],
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cachePayload));
      }
    } catch (err: any) {
      console.error("loadAll error:", err?.message || err);
      if (typeof window !== "undefined") {
        try {
          const cachedRaw = localStorage.getItem(CACHE_KEY);
          const hasLiveState =
            usersRef.current.length > 0 || appointmentsRef.current.length > 0;

          if (cachedRaw && !hasLiveState) {
            const cached = JSON.parse(cachedRaw);
            setUsers(cached.users ?? []);
            applyAppointmentsRows(cached.appointments ?? []);
            setFinancialRecords(cached.financialRecords ?? []);
            setMedicalRecords(cached.medicalRecords ?? []);
            setRecurrences(cached.recurrences ?? []);
            setServices(Array.isArray(cached.services) ? cached.services : []);
            setError("Modo offline: dados carregados do cache");
          } else {
            setError(err?.message || "Erro ao carregar dados");
          }
        } catch {
          setError(err?.message || "Erro ao carregar dados");
        }
      } else {
        setError(err?.message || "Erro ao carregar dados");
      }
    } finally {
      if (!coreLoaded) setLoading(false);
    }
  }, [applyAppointmentsRows]);

  const loadAll = useCallback(async () => {
    if (isLoadingAllRef.current) {
      pendingLoadAllRef.current = true;
      return;
    }

    isLoadingAllRef.current = true;
    try {
      do {
        pendingLoadAllRef.current = false;
        await performLoadAll();
      } while (pendingLoadAllRef.current);
    } finally {
      isLoadingAllRef.current = false;
    }
  }, [performLoadAll]);

  const refreshInBackground = useCallback(() => {
    void loadAll().catch((err: any) => {
      console.error("background loadAll error:", err?.message || err);
    });
  }, [loadAll]);

  const loadAppointmentsOnly = useCallback(async () => {
    if (isLoadingAppointmentsOnlyRef.current) {
      pendingAppointmentsOnlyRef.current = true;
      return;
    }

    isLoadingAppointmentsOnlyRef.current = true;
    try {
      do {
        pendingAppointmentsOnlyRef.current = false;
        const allAppointmentsRows = await fetchAllAppointments();
        if (Array.isArray(allAppointmentsRows)) {
          applyAppointmentsRows(allAppointmentsRows);
          if (typeof window !== "undefined") {
            try {
              const cachedRaw = localStorage.getItem(CACHE_KEY);
              const cached = cachedRaw ? JSON.parse(cachedRaw) : {};
              localStorage.setItem(
                CACHE_KEY,
                JSON.stringify({
                  ...(cached || {}),
                  appointments: allAppointmentsRows,
                  savedAt: new Date().toISOString(),
                })
              );
            } catch {
              // non-fatal
            }
          }
        }
      } while (pendingAppointmentsOnlyRef.current);
    } catch (err: any) {
      console.error("loadAppointmentsOnly error:", err?.message || err);
    } finally {
      isLoadingAppointmentsOnlyRef.current = false;
    }
  }, [applyAppointmentsRows]);

  const refreshAppointmentsInBackground = useCallback(() => {
    void loadAppointmentsOnly();
  }, [loadAppointmentsOnly]);

  const scheduleRealtimeLoadAll = useCallback(() => {
    if (realtimeLoadTimerRef.current) {
      clearTimeout(realtimeLoadTimerRef.current);
    }

    realtimeLoadTimerRef.current = setTimeout(() => {
      realtimeLoadTimerRef.current = null;
      refreshAppointmentsInBackground();
    }, 300);
  }, [refreshAppointmentsInBackground]);

  /* ======================================================
     LOAD INICIAL
====================================================== */

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (usersRef.current.length > 0 || appointmentsRef.current.length > 0) return;
    try {
      const cachedRaw = localStorage.getItem(CACHE_KEY);
      if (!cachedRaw) return;
      const cached = JSON.parse(cachedRaw);
      if (!cached) return;

      const cachedUsers = Array.isArray(cached.users) ? cached.users : [];
      const cachedAppointments = Array.isArray(cached.appointments) ? cached.appointments : [];

      if (cachedUsers.length) setUsers(cachedUsers);
      if (cachedAppointments.length) {
        applyAppointmentsRows(cachedAppointments);
      }
      setFinancialRecords(Array.isArray(cached.financialRecords) ? cached.financialRecords : []);
      setMedicalRecords(Array.isArray(cached.medicalRecords) ? cached.medicalRecords : []);
      setRecurrences(Array.isArray(cached.recurrences) ? cached.recurrences : []);
      setServices(Array.isArray(cached.services) ? cached.services : []);
    } catch (err: any) {
      console.warn("cache hydrate non-fatal:", err?.message || err);
    }
  }, [applyAppointmentsRows]);

  useEffect(() => {
    refreshInBackground();
  }, [refreshInBackground]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const clearedKey = "justifications-cleared";
    if (localStorage.getItem(clearedKey) === "1") return;
    localStorage.removeItem("doctor-justifications");
    localStorage.removeItem("scheduler-notifications");
    localStorage.setItem(clearedKey, "1");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (loading) return;

    const recoveryKey = "recovery-recurring-overrides-v1";
    if (localStorage.getItem(recoveryKey) === "1") return;

    const runRecovery = async () => {
      try {
        const { data: blockedRows, error: blockedErr } = await supabase
          .from("appointments")
          .select("id")
          .like("notes", `${RECURRENCE_OVERRIDE_NOTE_PREFIX}%`);

        if (blockedErr) throw blockedErr;
        const ids = (blockedRows || []).map((r: any) => r.id).filter(Boolean);

        if (!ids.length) {
          localStorage.setItem(recoveryKey, "1");
          return;
        }

        // remove possíveis vínculos financeiros gerados por versões anteriores
        await supabase.from("financial_records").delete().in("appointment_id", ids);
        await supabase.from("appointments").delete().in("id", ids);

        localStorage.setItem(recoveryKey, "1");
        await loadAll();
        toast.success(`Recuperação concluída: ${ids.length} bloqueios removidos.`);
      } catch (err: any) {
        console.error("recovery recurring overrides:", err?.message || err);
        toast.error(err?.message || "Erro ao recuperar agendamentos ocultos.");
      }
    };

    runRecovery();
  }, [loading, loadAll]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (loading) return;

    const dedupeKey = "appointments-dedupe-v1";
    if (localStorage.getItem(dedupeKey) === "1") return;

    const run = async () => {
      try {
        const removed = await removeDuplicateAppointments();
        localStorage.setItem(dedupeKey, "1");
        if (removed > 0) {
          await loadAll();
          toast.success(`${removed} agendamento(s) duplicado(s) removido(s).`);
        }
      } catch (err: any) {
        console.error("removeDuplicateAppointments:", err?.message || err);
        toast.error(err?.message || "Erro ao remover agendamentos duplicados.");
      }
    };

    run();
  }, [loading, loadAll]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (loading) return;

    const migrationKey = "force-all-pending-v2";
    if (localStorage.getItem(migrationKey) === "1") return;

    const run = async () => {
      try {
        await forceAllAppointmentsToPending();
        localStorage.setItem(migrationKey, "1");
        await loadAll();
        toast.success("Todos os agendamentos foram deixados como pendente.");
      } catch (err: any) {
        console.error("forceAllAppointmentsToPending:", err?.message || err);
        toast.error(err?.message || "Erro ao deixar todos os agendamentos pendentes.");
      }
    };

    run();
  }, [loading, loadAll]);

  // Mantém a agenda fiel ao banco: sem mutações automáticas de status em background.

  /* ======================================================
     REALTIME
====================================================== */

  useEffect(() => {
    const channel = supabase
      .channel("realtime-appcontext")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        scheduleRealtimeLoadAll
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointment_patients" },
        scheduleRealtimeLoadAll
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointment_doctors" },
        scheduleRealtimeLoadAll
      )
      .subscribe();

    return () => {
      if (realtimeLoadTimerRef.current) {
        clearTimeout(realtimeLoadTimerRef.current);
        realtimeLoadTimerRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [scheduleRealtimeLoadAll]);

  /* ======================================================
     HELPERS RELACIONAIS (MULTI PACIENTE / MULTI MÉDICO)
====================================================== */

  const syncAppointmentPatients = async (
    appointmentId: string,
    patientIds: string[]
  ) => {
    // apaga e recria (simples e confiável)
    const { error: delErr } = await supabase
      .from("appointment_patients")
      .delete()
      .eq("appointment_id", appointmentId);

    if (delErr) throw delErr;

    const unique = uniq(patientIds);
    if (!unique.length) return;

    const rows = unique.map((pid) => ({
      appointment_id: appointmentId,
      patient_id: pid,
    }));

    const { error: insErr } = await supabase
      .from("appointment_patients")
      .insert(rows);

    if (insErr) throw insErr;
  };

  const syncAppointmentDoctors = async (
    appointmentId: string,
    doctorIds: string[]
  ) => {
    const { error: delErr } = await supabase
      .from("appointment_doctors")
      .delete()
      .eq("appointment_id", appointmentId);

    if (delErr) throw delErr;

    const unique = uniq(doctorIds);
    if (!unique.length) return;

    const rows = unique.map((did) => ({
      appointment_id: appointmentId,
      doctor_id: did,
    }));

    const { error: insErr } = await supabase
      .from("appointment_doctors")
      .insert(rows);

    if (insErr) throw insErr;
  };

  const isNonFatalRelationError = (err: any, table: string) => {
    const code = err?.code;
    const msg = String(err?.message || err || "").toLowerCase();
    if (code === "42P01") return true; // relation does not exist
    if (code === "42501") return true; // insufficient_privilege (RLS/permissions)
    if (msg.includes("row level security") || msg.includes("row-level security")) return true;
    if (msg.includes("permission denied")) return true;
    if (msg.includes("relation") && msg.includes(table)) return true;
    return false;
  };

  const trySyncAppointmentPatients = async (
    appointmentId: string,
    patientIds: string[]
  ) => {
    try {
      await syncAppointmentPatients(appointmentId, patientIds);
    } catch (err: any) {
      if (isNonFatalRelationError(err, "appointment_patients")) {
        console.warn("syncAppointmentPatients non-fatal:", err?.message || err);
        return;
      }
      throw err;
    }
  };

  const trySyncAppointmentDoctors = async (
    appointmentId: string,
    doctorIds: string[]
  ) => {
    try {
      await syncAppointmentDoctors(appointmentId, doctorIds);
    } catch (err: any) {
      if (isNonFatalRelationError(err, "appointment_doctors")) {
        console.warn("syncAppointmentDoctors non-fatal:", err?.message || err);
        return;
      }
      throw err;
    }
  };

  /* ======================================================
     CRUD (COM MULTI RELAÇÕES)
====================================================== */

  const addUser: AppContextType["addUser"] = async (data, password) => {
    try {
      const { password: dataPassword, ...rest } = data as any;
      const payload = { ...rest };
      void dataPassword;
      void password;

      const { data: created, error } = await supabase
        .from("users")
        .insert([payload])
        .select()
        .single();

      if (error || !created) throw error;

      await loadAll();
      return true;
    } catch (err: any) {
      console.error("addUser:", err?.message || err);
      return false;
    }
  };

  const updateUser: AppContextType["updateUser"] = async (id, data) => {
    try {
      const { password: _password, ...payload } = data as any;
      void _password;

      const { error } = await supabase.from("users").update(payload).eq("id", id);
      if (error) throw error;

      refreshInBackground();
      return true;
    } catch (err: any) {
      console.error("updateUser:", err?.message || err);
      toast.error(err?.message || "Erro ao atualizar usuário");
      return false;
    }
  };

  const deleteUser: AppContextType["deleteUser"] = async (id) => {
    try {
      await supabase.from("appointment_patients").delete().eq("patient_id", id);
      await supabase.from("appointment_doctors").delete().eq("doctor_id", id);
      await supabase.from("appointments").delete().eq("patient_id", id);
      await supabase.from("appointments").delete().eq("doctor_id", id);
      await supabase.from("patients").delete().eq("user_id", id);
      await supabase.from("medicos").delete().eq("user_id", id);

      const { error } = await supabase.from("users").delete().eq("id", id);
      if (error) throw error;

      refreshInBackground();
      return true;
    } catch (err: any) {
      console.error("deleteUser:", err?.message || err);
      toast.error(err?.message || "Erro ao excluir usuário");
      return false;
    }
  };

  const addAppointment: AppContextType["addAppointment"] = async (data) => {
    try {
      // ✅ aceita payload do ExcelScheduleGrid (que pode vir com patient_ids/doctor_ids)
      const patientIds = uniq(data.patient_ids ?? [data.patient_id]).filter(
        Boolean
      );
      const doctorIds = uniq(data.doctor_ids ?? [data.doctor_id]).filter(
        Boolean
      );

      const base = {
        patient_id: data.patient_id || patientIds[0],
        doctor_id: data.doctor_id || doctorIds[0],
        date: data.date,
        time: normalizeTimeToHHMM(data.time),
        status: normalizeAppointmentStatusForDb(data.status),
        type: data.type,
        notes: data.notes ?? null,
        price: Number(data.price) || 0,
        is_fixed: data.is_fixed === true,
      };

      if (!base.patient_id) throw new Error("patient_id obrigatório");
      if (!base.doctor_id) throw new Error("doctor_id obrigatório");

      let apt: any = null;
      let insertError: any = null;
      const statusCandidates = buildStatusCandidates(base.status);
      for (const candidate of statusCandidates) {
        const payload = { ...base, status: candidate };
        const { data: inserted, error } = await supabase
          .from("appointments")
          .insert([payload])
          .select()
          .single();
        if (!error && inserted) {
          apt = inserted;
          if (candidate === "agendado" || candidate === "pendente") {
            pendingStatusRef.current = candidate;
          }
          break;
        }
        insertError = error;
        if (!isAppointmentStatusConstraintError(error)) {
          break;
        }
      }
      if (!apt) throw insertError;

      const isRecurrenceOverride = isInternalRecurrenceNote(base.notes);

      if (!isRecurrenceOverride) {
        // cria registro financeiro pendente (inclui paciente/responsável)
        const patientName = getUserById(base.patient_id)?.name || "Paciente";
        const { data: patientRow } = await supabase
          .from("patients")
          .select("responsavel")
          .eq("user_id", base.patient_id)
          .maybeSingle();
        const responsavel = patientRow?.responsavel ? ` | Responsável: ${patientRow.responsavel}` : "";
        const { error: financialInsertError } = await supabase
          .from("financial_records")
          .insert([
          {
            type: "receita",
            amount: Number(base.price) || 0,
            description: `Consulta: ${base.type} | Paciente: ${patientName}${responsavel}`,
            category: "Consulta",
            date: base.date,
            appointment_id: apt.id,
            status: "pendente",
          },
        ]);
        if (financialInsertError) {
          console.warn(
            "addAppointment financial_records non-fatal:",
            financialInsertError?.message || financialInsertError
          );
        }
      }

      // 🔥 salva relações (multi)
      try {
        if (patientIds.length) {
          await trySyncAppointmentPatients(apt.id, patientIds);
        }
        if (doctorIds.length) {
          await trySyncAppointmentDoctors(apt.id, doctorIds);
        }
      } catch (syncErr: any) {
        console.warn(
          "addAppointment relation sync non-fatal:",
          syncErr?.message || syncErr
        );
      }

      // Atualização otimista local para evitar "salvou, mas não aparece"
      // quando houver atraso/erro temporário no reload.
      const optimistic = normalizeAppointment({
        ...apt,
        appointment_patients: patientIds.map((patient_id) => ({ patient_id })),
        appointment_doctors: doctorIds.map((doctor_id) => ({ doctor_id })),
      });
      optimisticPendingRef.current.set(optimistic.id, Date.now());
      setAppointments((prev) => {
        const base = prev.filter(
          (item) => !item.is_virtual && !String(item.id || "").includes("::")
        );
        const nextBase = [...base.filter((item) => item.id !== optimistic.id), optimistic];
        return expandWeeklyAppointments(nextBase);
      });

      refreshAppointmentsInBackground();
      if (!isRecurrenceOverride) {
        const { doctorsList, doctorMessage } = buildAppointmentMessages({
          type: "create",
          appointment: apt as Appointment,
          patientIds,
          doctorIds,
        });
        doctorsList.forEach((d) => {
          logDoctorNotification(d.id, "create", doctorMessage, apt.id);
        });
        notifyAppointmentWhatsApp({
          type: "create",
          appointment: apt as Appointment,
          patientIds,
          doctorIds,
        });
        sendPushNotification({ type: "create", appointment: apt as Appointment });
      }
      return true;
    } catch (err: any) {
      console.error("addAppointment:", err?.message || err);
      toast.error(err?.message || "Erro ao criar agendamento");
      return false;
    }
  };

  const updateAppointment: AppContextType["updateAppointment"] = async (
    id,
    data
  ) => {
    try {
      const target = appointments.find((a) => a.id === id);
      if (target?.is_virtual || id.includes("::")) {
        const [sourceIdFromVirtual, dateFromVirtual] = String(id).split("::");
        const sourceId = sourceIdFromVirtual || target?.recurrence_source_id || target?.id;
        const source =
          appointments.find((a) => a.id === sourceId) ||
          (target ? { ...target, id: sourceId } : null);

        const sourceDate = dateFromVirtual || source?.date || target?.date || "";
        const sourceTime = normalizeTimeToHHMM(source?.time || target?.time || "");
        const sourcePatientId = source?.patient_id || target?.patient_id || "";
        const sourceDoctorId = source?.doctor_id || target?.doctor_id || "";

        if (!sourceId || !sourceDate || !sourceTime || !sourcePatientId || !sourceDoctorId) {
          toast.error("Não foi possível identificar a ocorrência da recorrência.");
          return false;
        }
        // Regra estável e não-destrutiva:
        // editar ocorrência virtual altera o status/dados do agendamento base
        // sem forçar data/hora da ocorrência virtual no registro base.
        const {
          date: _virtualDate,
          time: _virtualTime,
          ...safeData
        } = (data as any) || {};
        void _virtualDate;
        void _virtualTime;

        return await updateAppointment(sourceId, {
          ...safeData,
          patient_id: sourcePatientId,
          doctor_id: sourceDoctorId,
          patient_ids:
            (safeData as any).patient_ids ?? source?.patient_ids ?? [sourcePatientId],
          doctor_ids:
            (safeData as any).doctor_ids ?? source?.doctor_ids ?? [sourceDoctorId],
        } as any);
      }
      const previous = appointments.find((a) => a.id === id) || null;
      const patientIds = data.patient_ids
        ? uniq(data.patient_ids)
        : undefined;
      const doctorIds = data.doctor_ids ? uniq(data.doctor_ids) : undefined;

      // ⚠️ nunca envie patient_ids/doctor_ids para a tabela appointments
      const {
        patient_ids: _pids,
        doctor_ids: _dids,
        ...rest
      } = data as any;

      const patch: any = { ...rest };
      const desiredStatus =
        patch.status !== undefined
          ? normalizeAppointmentStatusForDb(patch.status)
          : undefined;

      if (typeof patch.time === "string") {
        patch.time = normalizeTimeToHHMM(patch.time);
      }

      let updatedRows: Array<{ id: string; status?: AppointmentStatus }> | null =
        null;
      let updateError: any = null;
      const statusCandidates =
        desiredStatus !== undefined ? buildStatusCandidates(desiredStatus) : [];
      const tries = statusCandidates.length ? statusCandidates : [undefined];

      for (const candidate of tries) {
        const patchToSend: any = { ...patch };
        if (candidate !== undefined) {
          patchToSend.status = candidate;
        } else if ("status" in patchToSend) {
          delete patchToSend.status;
        }

        const { data, error } = await supabase
          .from("appointments")
          .update(patchToSend)
          .eq("id", id)
          .select("id,status");

        if (!error && data && data.length > 0) {
          updatedRows = data as any;
          if (candidate === "agendado" || candidate === "pendente") {
            pendingStatusRef.current = candidate;
          }
          patch.status = (data[0] as any).status;
          break;
        }

        updateError = error;
        if (!isAppointmentStatusConstraintError(error)) {
          break;
        }
      }

      if (updateError && !updatedRows) throw updateError;
      if (!updatedRows || updatedRows.length === 0) {
        throw new Error("Agendamento não encontrado para atualização.");
      }

      // Corrige dados duplicados no mesmo slot (mesmo paciente+médico+data+hora),
      // evitando que a UI continue exibindo um "clone" com status antigo.
      if (patch.status !== undefined) {
        const slotDate = patch.date || previous?.date;
        const slotTime = patch.time || previous?.time;
        const slotPatientId = patch.patient_id || previous?.patient_id;
        const slotDoctorId = patch.doctor_id || previous?.doctor_id;

        if (slotDate && slotTime && slotPatientId && slotDoctorId) {
          const { data: sameSlotRows, error: sameSlotErr } = await supabase
            .from("appointments")
            .select("id,notes")
            .eq("date", slotDate)
            .eq("time", slotTime)
            .eq("patient_id", slotPatientId)
            .eq("doctor_id", slotDoctorId)
            .neq("id", id);

          if (!sameSlotErr && sameSlotRows?.length) {
            const duplicateIds = sameSlotRows
              .filter((row: any) => {
                const note = String(row?.notes || "");
                return !note.startsWith(RECURRENCE_OVERRIDE_NOTE_PREFIX);
              })
              .map((row: any) => row.id)
              .filter(Boolean);

            if (duplicateIds.length) {
              await supabase
                .from("appointments")
                .update({ status: patch.status })
                .in("id", duplicateIds);
            }
          }
        }
      }

      // atualiza financeiro quando houver mudança relevante
      if (patch.price !== undefined || patch.status !== undefined) {
        const finStatus =
          patch.status === "cancelado" ? "cancelado" : "pendente";
        await supabase
          .from("financial_records")
          .update({
            amount: patch.price !== undefined ? Number(patch.price) || 0 : undefined,
            status: finStatus,
          })
          .eq("appointment_id", id);
      }

      // 🔥 se vierem relações, sincroniza
      if (patientIds) await trySyncAppointmentPatients(id, patientIds);
      if (doctorIds) await trySyncAppointmentDoctors(id, doctorIds);

      // Atualização otimista local: garante que a agenda reflita o novo status
      // imediatamente, mesmo se houver atraso/falha em recarga posterior.
      setAppointments((prev) =>
        prev.map((apt) => {
          if (apt.id !== id) return apt;
          return {
            ...apt,
            ...(patch as Partial<Appointment>),
            patient_ids: patientIds ?? apt.patient_ids,
            doctor_ids: doctorIds ?? apt.doctor_ids,
            status:
              (patch.status as AppointmentStatus | undefined) ?? apt.status,
            time:
              typeof patch.time === "string" && patch.time
                ? patch.time
                : apt.time,
          };
        })
      );

      refreshAppointmentsInBackground();
      const effectivePatientIds =
        patientIds ?? previous?.patient_ids ?? [previous?.patient_id || ""];
      const effectiveDoctorIds =
        doctorIds ?? previous?.doctor_ids ?? [previous?.doctor_id || ""];
      const nextStatus =
        (patch.status as AppointmentStatus) || previous?.status || "agendado";
      const nextDate = patch.date || previous?.date || "";
      const nextTime = patch.time || previous?.time || "";

      const nextAppointment: Appointment = {
        ...(previous || ({} as Appointment)),
        ...(patch as Appointment),
        status: nextStatus,
        date: nextDate,
        time: nextTime,
      };

      let type: "update" | "cancel" | "reschedule" = "update";
      if (nextStatus === "cancelado") {
        type = "cancel";
      } else if (
        previous &&
        (previous.date !== nextDate ||
          normalizeTimeToHHMM(previous.time) !==
            normalizeTimeToHHMM(nextTime))
      ) {
        type = "reschedule";
      }

      notifyAppointmentWhatsApp({
        type,
        appointment: nextAppointment,
        previous,
        patientIds: effectivePatientIds.filter(Boolean),
        doctorIds: effectiveDoctorIds.filter(Boolean),
      });
      sendPushNotification({ type, appointment: nextAppointment });

      const { doctorsList, doctorMessage } = buildAppointmentMessages({
        type,
        appointment: nextAppointment,
        previous,
        patientIds: effectivePatientIds.filter(Boolean),
        doctorIds: effectiveDoctorIds.filter(Boolean),
      });
      doctorsList.forEach((d) => {
        logDoctorNotification(d.id, type, doctorMessage, nextAppointment.id);
      });
      return true;
    } catch (err: any) {
      console.error("updateAppointment:", err?.message || err);
      toast.error(err?.message || "Erro ao atualizar agendamento");
      return false;
    }
  };

  const deleteAppointment = async (id: string) => {
    try {
      const target = appointments.find((a) => a.id === id);
      if (target?.is_virtual || id.includes("::")) {
        toast.error(
          "Este é um agendamento recorrente. Exclua o agendamento original."
        );
        return false;
      }
      const previous = appointments.find((a) => a.id === id) || null;
      // apaga relações primeiro para não deixar lixo
      const { error: delPatientsErr } = await supabase
        .from("appointment_patients")
        .delete()
        .eq("appointment_id", id);
      if (delPatientsErr) {
        if (!isNonFatalRelationError(delPatientsErr, "appointment_patients")) {
          throw delPatientsErr;
        }
        console.warn(
          "delete appointment_patients non-fatal:",
          delPatientsErr?.message || delPatientsErr
        );
      }

      const { error: delDoctorsErr } = await supabase
        .from("appointment_doctors")
        .delete()
        .eq("appointment_id", id);
      if (delDoctorsErr) {
        if (!isNonFatalRelationError(delDoctorsErr, "appointment_doctors")) {
          throw delDoctorsErr;
        }
        console.warn(
          "delete appointment_doctors non-fatal:",
          delDoctorsErr?.message || delDoctorsErr
        );
      }

      const { error } = await supabase.from("appointments").delete().eq("id", id);
      if (error) throw error;

      refreshAppointmentsInBackground();
      if (previous) {
        const { doctorsList, doctorMessage } = buildAppointmentMessages({
          type: "cancel",
          appointment: previous,
          previous,
          patientIds: previous.patient_ids ?? [previous.patient_id],
          doctorIds: previous.doctor_ids ?? [previous.doctor_id],
        });
        doctorsList.forEach((d) => {
          logDoctorNotification(d.id, "cancel", doctorMessage, previous.id);
        });
        notifyAppointmentWhatsApp({
          type: "cancel",
          appointment: previous,
          previous,
          patientIds: previous.patient_ids ?? [previous.patient_id],
          doctorIds: previous.doctor_ids ?? [previous.doctor_id],
        });
      }
      sendPushNotification({ type: "delete", appointment: previous ?? undefined });
      return true;
    } catch (err: any) {
      console.error("deleteAppointment:", err?.message || err);
      toast.error(err?.message || "Erro ao excluir agendamento");
      return false;
    }
  };

  const addFinancialRecord: AppContextType["addFinancialRecord"] = async (
    data
  ) => {
    try {
      const payload = {
        type: data.type,
        amount: Number(data.amount) || 0,
        description: data.description,
        category: data.category,
        date: data.date,
        status: data.status,
        appointment_id: data.appointment_id ?? null,
      };

      const { error } = await supabase
        .from("financial_records")
        .insert([payload]);
      if (error) throw error;

      refreshInBackground();
      return true;
    } catch (err: any) {
      console.error("addFinancialRecord:", err?.message || err);
      toast.error(err?.message || "Erro ao adicionar registro financeiro");
      return false;
    }
  };

  const updateFinancialRecord: AppContextType["updateFinancialRecord"] = async (
    id,
    data
  ) => {
    try {
      const patch: Partial<FinancialRecord> = { ...data };
      if (patch.amount !== undefined) {
        patch.amount = Number(patch.amount) || 0;
      }
      const { error } = await supabase
        .from("financial_records")
        .update(patch)
        .eq("id", id);
      if (error) throw error;

      refreshInBackground();
      return true;
    } catch (err: any) {
      console.error("updateFinancialRecord:", err?.message || err);
      toast.error(err?.message || "Erro ao atualizar registro financeiro");
      return false;
    }
  };

  const deleteFinancialRecord: AppContextType["deleteFinancialRecord"] = async (
    id
  ) => {
    try {
      const { error } = await supabase
        .from("financial_records")
        .delete()
        .eq("id", id);
      if (error) throw error;

      refreshInBackground();
      return true;
    } catch (err: any) {
      console.error("deleteFinancialRecord:", err?.message || err);
      toast.error(err?.message || "Erro ao excluir registro financeiro");
      return false;
    }
  };

  const saveServicesLocal = (list: Service[]) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(SERVICES_KEY, JSON.stringify(list));
  };

  const addService: AppContextType["addService"] = async (data) => {
    try {
      const newItem: Service = {
        id: crypto.randomUUID(),
        name: String(data.name || "").trim(),
        description: data.description ? String(data.description) : "",
        price: Number(data.price) || 0,
        duration: Number(data.duration) || 60,
        category: data.category ? String(data.category) : "Outros",
        is_active: data.is_active !== false,
        created_at: new Date().toISOString(),
      };
      setServices((prev) => {
        const next = [newItem, ...prev];
        saveServicesLocal(next);
        return next;
      });
      toast.success("Serviço criado.");
      return true;
    } catch (err: any) {
      console.error("addService:", err?.message || err);
      toast.error(err?.message || "Erro ao criar serviço");
      return false;
    }
  };

  const updateService: AppContextType["updateService"] = async (id, data) => {
    try {
      setServices((prev) => {
        const next = prev.map((s) =>
          s.id === id
            ? {
                ...s,
                ...data,
                price: data.price !== undefined ? Number(data.price) || 0 : s.price,
                duration:
                  data.duration !== undefined ? Number(data.duration) || 60 : s.duration,
              }
            : s
        );
        saveServicesLocal(next);
        return next;
      });
      toast.success("Serviço atualizado.");
      return true;
    } catch (err: any) {
      console.error("updateService:", err?.message || err);
      toast.error(err?.message || "Erro ao atualizar serviço");
      return false;
    }
  };

  const deleteService: AppContextType["deleteService"] = async (id) => {
    try {
      setServices((prev) => {
        const next = prev.filter((s) => s.id !== id);
        saveServicesLocal(next);
        return next;
      });
      toast.success("Serviço removido.");
      return true;
    } catch (err: any) {
      console.error("deleteService:", err?.message || err);
      toast.error(err?.message || "Erro ao remover serviço");
      return false;
    }
  };

  /* ======================================================
     PROVIDER
====================================================== */

  return (
    <AppContext.Provider
      value={{
        users,
        doctors,
        patients,
        appointments,
        recurrences,
        financialRecords,
        medicalRecords,
        services,
        loading,
        error,
        reloadAll: loadAll,
        addUser,
        updateUser,
        deleteUser,
        addAppointment,
        updateAppointment,
        deleteAppointment,
        addFinancialRecord,
        updateFinancialRecord,
        deleteFinancialRecord,
        addService,
        updateService,
        deleteService,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

/* ======================================================
   HOOK
====================================================== */

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error("useApp deve ser usado dentro do AppProvider");
  }
  return ctx;
}
