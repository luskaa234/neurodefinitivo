"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

// --- Tipos principais ---
export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "financeiro" | "agendamento" | "medico" | "paciente";
  avatar_url?: string;
  created_at: string;
  is_active: boolean;
  phone?: string;
  cpf?: string;
  birth_date?: string;
  address?: string;
  crm?: string;
  specialty?: string;

  // 🔹 Campos adicionais para pacientes
  responsavel?: string;
  valor_mensal?: number;
  tipo_atendimento?: string;
  password?: string; // senha inicial = 6 primeiras letras do nome
}



export type AppointmentStatus =
  | "pendente"
  | "confirmado"
  | "cancelado"
  | "realizado";

export interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  date: string;
  time: string;
  status: AppointmentStatus;
  type: string;
  notes?: string;
  price: number;
  created_at: string;
}

export interface FinancialRecord {
  id: string;
  type: "receita" | "despesa";
  amount: number;
  description: string;
  category: string;
  date: string;
  appointment_id?: string;
  status: "pendente" | "pago" | "cancelado";
  created_at: string;
}

export interface MedicalRecord {
  id: string;
  patient_id: string;
  doctor_id: string;
  appointment_id: string; // vínculo com agendamento
  date: string;
  description: string;
  notes?: string;
  created_at: string;
}


export interface Service {
  id: string;
  name: string;
  description?: string;
  price: number;
  duration: number;
  category: string;
  is_active: boolean;
  created_at: string;
}

// Tipos auxiliares
type NewAppointment = Omit<Appointment, "id" | "created_at">;
type NewFinancialRecord = Omit<FinancialRecord, "id" | "created_at">;
type NewMedicalRecord = Omit<MedicalRecord, "id" | "created_at">;

// --- Contexto ---
interface AppContextType {
  users: User[];
  doctors: User[];
  patients: User[];
  appointments: Appointment[];
  financialRecords: FinancialRecord[];
  medicalRecords: MedicalRecord[];
  services: Service[];
  loading: boolean;
  error: string | null;


  // Usuários
  addUser: (user: Omit<User, "id" | "created_at">) => Promise<boolean>;
  updateUser: (id: string, user: Partial<User>) => Promise<boolean>;
  deleteUser: (id: string) => Promise<boolean>;

  // Consultas
  addAppointment: (appointment: NewAppointment) => Promise<boolean>;
  updateAppointment: (id: string, appointment: Partial<Appointment>) => Promise<boolean>;
  deleteAppointment: (id: string) => Promise<boolean>;

  // Financeiro
  addFinancialRecord: (record: NewFinancialRecord) => Promise<boolean>;
  updateFinancialRecord: (id: string, record: Partial<FinancialRecord>) => Promise<boolean>;
  deleteFinancialRecord: (id: string) => Promise<boolean>;

  // Prontuários
  addMedicalRecord: (record: NewMedicalRecord) => Promise<boolean>;
  updateMedicalRecord: (id: string, record: Partial<MedicalRecord>) => Promise<boolean>;
  deleteMedicalRecord: (id: string) => Promise<boolean>;

  // Serviços
  addService: (service: Omit<Service, "id" | "created_at">) => Promise<boolean>;
  updateService: (id: string, updates: Partial<Service>) => Promise<boolean>;
  deleteService: (id: string) => Promise<boolean>;
}


const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<User[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [financialRecords, setFinancialRecords] = useState<FinancialRecord[]>(
    []
  );
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const doctors = users.filter((u) => u.role === "medico");
  const patients = users.filter((u) => u.role === "paciente");

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [usersData, appointmentsData, financialData, medicalData] =
        await Promise.all([
          supabase.from("users").select("*").order("created_at", { ascending: false }),
          supabase.from("appointments").select("*").order("date", { ascending: false }),
          supabase.from("financial_records").select("*").order("date", { ascending: false }),
          supabase.from("medical_records").select("*").order("date", { ascending: false }),
        ]);

      if (!usersData.error && usersData.data) setUsers(usersData.data);
      if (!appointmentsData.error && appointmentsData.data)
        setAppointments(appointmentsData.data);
      if (!financialData.error && financialData.data)
        setFinancialRecords(financialData.data);
      if (!medicalData.error && medicalData.data)
        setMedicalRecords(medicalData.data);
    } catch (err) {
      console.error("❌ Erro ao carregar dados:", err);
      setError("Erro ao carregar dados do sistema");
    } finally {
      setLoading(false);
    }
  };

  // Usuários
  const addUser = async (userData: Omit<User, "id" | "created_at">) => {
    try {
      const { data, error } = await supabase
        .from("users")
        .insert([userData])
        .select()
        .single();
      if (error || !data) return false;
      setUsers((prev) => [data, ...prev]);
      return true;
    } catch {
      return false;
    }
  };

  const updateUser = async (id: string, user: Partial<User>) => {
    try {
      const { data, error } = await supabase
        .from("users")
        .update(user)
        .eq("id", id)
        .select()
        .single();
      if (error || !data) return false;
      setUsers((prev) => prev.map((u) => (u.id === id ? data : u)));
      return true;
    } catch {
      return false;
    }
  };

  const deleteUser = async (id: string) => {
    try {
      const { error } = await supabase.from("users").delete().eq("id", id);
      if (error) return false;
      setUsers((prev) => prev.filter((u) => u.id !== id));
      return true;
    } catch {
      return false;
    }
  };

  // Consultas
  const addAppointment = async (appointment: NewAppointment) => {
    try {
      const { data, error } = await supabase
        .from("appointments")
        .insert([appointment])
        .select()
        .single();
      if (error || !data) return false;
      setAppointments((prev) => [data, ...prev]);
      return true;
    } catch {
      return false;
    }
  };

  const updateAppointment = async (
    id: string,
    appointment: Partial<Appointment>
  ) => {
    try {
      const { data, error } = await supabase
        .from("appointments")
        .update(appointment)
        .eq("id", id)
        .select()
        .single();
      if (error || !data) return false;
      setAppointments((prev) =>
        prev.map((apt) => (apt.id === id ? data : apt))
      );
      return true;
    } catch {
      return false;
    }
  };

  const deleteAppointment = async (id: string) => {
    try {
      const { error } = await supabase.from("appointments").delete().eq("id", id);
      if (error) return false;
      setAppointments((prev) => prev.filter((apt) => apt.id !== id));
      return true;
    } catch {
      return false;
    }
  };

  // Financeiro
  const addFinancialRecord = async (record: NewFinancialRecord) => {
    try {
      const { data, error } = await supabase
        .from("financial_records")
        .insert([record])
        .select()
        .single();
      if (error || !data) return false;
      setFinancialRecords((prev) => [data, ...prev]);
      return true;
    } catch {
      return false;
    }
  };

  const updateFinancialRecord = async (
    id: string,
    record: Partial<FinancialRecord>
  ) => {
    try {
      const { data, error } = await supabase
        .from("financial_records")
        .update(record)
        .eq("id", id)
        .select()
        .single();
      if (error || !data) return false;
      setFinancialRecords((prev) =>
        prev.map((r) => (r.id === id ? data : r))
      );
      return true;
    } catch {
      return false;
    }
  };

  const deleteFinancialRecord = async (id: string) => {
    try {
      const { error } = await supabase
        .from("financial_records")
        .delete()
        .eq("id", id);
      if (error) return false;
      setFinancialRecords((prev) => prev.filter((r) => r.id !== id));
      return true;
    } catch {
      return false;
    }
  };

  // Prontuários
  const addMedicalRecord = async (record: NewMedicalRecord) => {
    try {
      const { data, error } = await supabase
        .from("medical_records")
        .insert([record])
        .select()
        .single();
      if (error || !data) return false;
      setMedicalRecords((prev) => [data, ...prev]);
      return true;
    } catch {
      return false;
    }
  };

  const updateMedicalRecord = async (
    id: string,
    record: Partial<MedicalRecord>
  ) => {
    try {
      const { data, error } = await supabase
        .from("medical_records")
        .update(record)
        .eq("id", id)
        .select()
        .single();
      if (error || !data) return false;
      setMedicalRecords((prev) =>
        prev.map((rec) => (rec.id === id ? data : rec))
      );
      return true;
    } catch {
      return false;
    }
  };
  // Serviços
const addService = async (service: Omit<Service, "id" | "created_at">) => {
  try {
    const { data, error } = await supabase
      .from("services")
      .insert([service])
      .select()
      .single();
    if (error || !data) return false;
    setServices((prev) => [data, ...prev]);
    return true;
  } catch {
    return false;
  }
};

const updateService = async (id: string, updates: Partial<Service>) => {
  try {
    const { data, error } = await supabase
      .from("services")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error || !data) return false;
    setServices((prev) => prev.map((s) => (s.id === id ? data : s)));
    return true;
  } catch {
    return false;
  }
};

const deleteService = async (id: string) => {
  try {
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) return false;
    setServices((prev) => prev.filter((s) => s.id !== id));
    return true;
  } catch {
    return false;
  }
};


  const deleteMedicalRecord = async (id: string) => {
    try {
      const { error } = await supabase
        .from("medical_records")
        .delete()
        .eq("id", id);
      if (error) return false;
      setMedicalRecords((prev) => prev.filter((rec) => rec.id !== id));
      return true;
    } catch {
      return false;
    }
  };

  return (
  <AppContext.Provider
    value={{
      users,
      doctors,
      patients,
      appointments,
      financialRecords,
      medicalRecords,
      services,
      loading,
      error,
      addUser,
      updateUser,
      deleteUser,
      addAppointment,
      updateAppointment,
      deleteAppointment,
      addFinancialRecord,
      updateFinancialRecord,
      deleteFinancialRecord,
      addMedicalRecord,
      updateMedicalRecord,
      deleteMedicalRecord,
      addService,
      updateService,
      deleteService,
      
    }}
  >

      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within an AppProvider");
  return context;
}
