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
    } catch (err: any) {
      console.error("loadAll error:", err?.message || err);
      setError(err?.message || "Erro ao carregar dados");
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
      return true;
    } catch (err: any) {
      console.error("updateAppointment:", err?.message || err);
      toast.error(err?.message || "Erro ao atualizar agendamento");
      return false;
    }
  };

  const deleteAppointment = async (id: string) => {
    try {
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