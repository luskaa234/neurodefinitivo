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
  price?: number;
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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

/* ======================================================
   PROVIDER
====================================================== */

export function AppProvider({ children }: { children: React.ReactNode }) {
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

  const doctors = users.filter((u) => u.role === "medico");
  const patients = users.filter((u) => u.role === "paciente");

  const uniq = (arr: string[] = []) =>
    Array.from(new Set(arr.filter(Boolean)));

  const normalizeTimeToHHMM = (t?: string | null) => {
    if (!t) return "";
    const m = t.match(/(\d{2}):(\d{2})/);
    return m ? `${m[1]}:${m[2]}` : "";
  };

  const normalizePhone = (value?: string | null) => {
    if (!value) return "";
    const digits = value.replace(/\D/g, "");
    if (!digits) return "";
    if (digits.startsWith("55")) return digits;
    return `55${digits}`;
  };

  const getUserById = (id?: string | null) =>
    id ? users.find((u) => u.id === id) : undefined;

  const getUsersByIds = (ids: string[] = []) =>
    ids.map((id) => getUserById(id)).filter(Boolean) as User[];

  const toUiStatus = (s: AppointmentStatus) =>
    s === "pendente" ? "agendado" : s;

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

    const patientMessageBase =
      type === "create"
        ? `Olá ${patientNames}, seu agendamento foi criado com ${doctorNames} para ${dateTime}. Status: ${statusLabel}.`
        : type === "cancel"
          ? `Olá ${patientNames}, seu agendamento com ${doctorNames} em ${prevDateTime || dateTime} foi cancelado.`
          : type === "reschedule"
            ? `Olá ${patientNames}, seu agendamento com ${doctorNames} foi reagendado de ${prevDateTime} para ${dateTime}.`
            : `Olá ${patientNames}, seu agendamento com ${doctorNames} foi atualizado. Data/Hora: ${dateTime}. Status: ${statusLabel}.`;

    const dateLabel = formatDateOnly(appointment.date);
    const patientSummaries = patientsList.map((p) => {
      const items = getPatientDailySummary(
        p.id,
        appointment.date,
        appointment
      );
      if (items.length <= 1) {
        return { patientId: p.id, message: patientMessageBase };
      }
      const summary = items
        .map((item) => {
          const [time, rest] = item.split(" ");
          return `${time} com ${rest.replace(/^\(|\)$/g, "")}`;
        })
        .join("; ");
      return {
        patientId: p.id,
        message: `Olá ${p.name}, você terá consulta em ${dateLabel}: ${summary}.`,
      };
    });

    const doctorMessage =
      type === "create"
        ? `Olá ${doctorNames}, novo agendamento com ${patientNames} para ${dateTime}. Status: ${statusLabel}.`
        : type === "cancel"
          ? `Olá ${doctorNames}, agendamento com ${patientNames} em ${prevDateTime || dateTime} foi cancelado.`
          : type === "reschedule"
            ? `Olá ${doctorNames}, agendamento com ${patientNames} foi reagendado de ${prevDateTime} para ${dateTime}.`
            : `Olá ${doctorNames}, agendamento com ${patientNames} foi atualizado. Data/Hora: ${dateTime}. Status: ${statusLabel}.`;

    return { patientsList, doctorsList, patientMessage, doctorMessage };
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
    const { patientsList, doctorsList, patientMessage, doctorMessage } =
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

  /* ======================================================
     LOAD ALL (FONTE ÚNICA)
====================================================== */

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [usersRes, aptRes, finRes, medRes, recRes] = await Promise.all([
        supabase.from("users").select("*"),

        supabase
          .from("appointments")
          .select(
            `
            *,
            appointment_patients(patient_id),
            appointment_doctors(doctor_id)
          `
          )
          .gte("date", "2026-01-01")
          .order("date", { ascending: true })
          .order("time", { ascending: true }),

        supabase.from("financial_records").select("*"),
        supabase.from("medical_records").select("*"),
        supabase.from("appointment_recurrences").select("*"),
      ]);

      if (usersRes.error) throw usersRes.error;
      if (aptRes.error) throw aptRes.error;
      if (finRes.error) throw finRes.error;
      if (medRes.error) throw medRes.error;
      if (recRes.error) throw recRes.error;

      setUsers(usersRes.data ?? []);
      setAppointments((aptRes.data ?? []).map(normalizeAppointment));
      setFinancialRecords(finRes.data ?? []);
      setMedicalRecords(medRes.data ?? []);
      setRecurrences(recRes.data ?? []);

      // garante sempre array
      setServices((prev) => (Array.isArray(prev) ? prev : []));

      if (typeof window !== "undefined") {
        const cachePayload = {
          users: usersRes.data ?? [],
          appointments: aptRes.data ?? [],
          financialRecords: finRes.data ?? [],
          medicalRecords: medRes.data ?? [],
          recurrences: recRes.data ?? [],
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
          if (cachedRaw) {
            const cached = JSON.parse(cachedRaw);
            setUsers(cached.users ?? []);
            setAppointments(
              (cached.appointments ?? []).map(normalizeAppointment)
            );
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
      setLoading(false);
    }
  }, []);

  /* ======================================================
     LOAD INICIAL
====================================================== */

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  /* ======================================================
     REALTIME
====================================================== */

  useEffect(() => {
    const channel = supabase
      .channel("realtime-appcontext")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        loadAll
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointment_patients" },
        loadAll
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointment_doctors" },
        loadAll
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadAll]);

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
        status: data.status,
        type: data.type,
        notes: data.notes ?? null,
        price: Number(data.price) || 0,
      };

      if (!base.patient_id) throw new Error("patient_id obrigatório");
      if (!base.doctor_id) throw new Error("doctor_id obrigatório");

      const { data: apt, error } = await supabase
        .from("appointments")
        .insert([base])
        .select()
        .single();

      if (error || !apt) throw error;

      // 🔥 salva relações (multi)
      await syncAppointmentPatients(apt.id, patientIds);
      await syncAppointmentDoctors(apt.id, doctorIds);

      await loadAll();
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

      if (typeof patch.time === "string") {
        patch.time = normalizeTimeToHHMM(patch.time);
      }

      const { error } = await supabase
        .from("appointments")
        .update(patch)
        .eq("id", id);

      if (error) throw error;

      // 🔥 se vierem relações, sincroniza
      if (patientIds) await syncAppointmentPatients(id, patientIds);
      if (doctorIds) await syncAppointmentDoctors(id, doctorIds);

      await loadAll();
      const effectivePatientIds =
        patientIds ?? previous?.patient_ids ?? [previous?.patient_id || ""];
      const effectiveDoctorIds =
        doctorIds ?? previous?.doctor_ids ?? [previous?.doctor_id || ""];
      const nextStatus =
        (patch.status as AppointmentStatus) || previous?.status || "pendente";
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
      const previous = appointments.find((a) => a.id === id) || null;
      // apaga relações primeiro para não deixar lixo
      await supabase
        .from("appointment_patients")
        .delete()
        .eq("appointment_id", id);
      await supabase
        .from("appointment_doctors")
        .delete()
        .eq("appointment_id", id);

      const { error } = await supabase.from("appointments").delete().eq("id", id);
      if (error) throw error;

      await loadAll();
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
      return true;
    } catch (err: any) {
      console.error("deleteAppointment:", err?.message || err);
      toast.error(err?.message || "Erro ao excluir agendamento");
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
        addAppointment,
        updateAppointment,
        deleteAppointment,
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
