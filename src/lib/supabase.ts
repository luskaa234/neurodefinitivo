import { createClient } from "@supabase/supabase-js";

// Carregar variáveis de ambiente
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

// Garantir que estão definidas
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("❌ Supabase URL ou Anon Key não configurados no .env.local");
}

// Tipagem do banco de dados (gerada a partir do schema)
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
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
        };
        Insert: Omit<Database["public"]["Tables"]["users"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["users"]["Row"]>;
      };
      appointments: {
        Row: {
          id: string;
          patient_id: string;
          doctor_id: string;
          date: string;
          time: string;
          status: "agendado" | "confirmado" | "cancelado" | "realizado";
          type: string;
          notes?: string;
          price: number;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["appointments"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["appointments"]["Row"]>;
      };
      financial_records: {
        Row: {
          id: string;
          type: "receita" | "despesa";
          amount: number;
          description: string;
          category: string;
          date: string;
          appointment_id?: string;
          status: "pendente" | "pago" | "cancelado";
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["financial_records"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["financial_records"]["Row"]>;
      };
      medical_records: {
        Row: {
          id: string;
          patient_id: string;
          doctor_id: string;
          date: string;
          diagnosis: string;
          treatment: string;
          notes: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["medical_records"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["medical_records"]["Row"]>;
      };
      evaluations: {
        Row: {
          id: string;
          medical_record_id: string;
          type: string;
          score: number;
          observations: string;
          date: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["evaluations"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["evaluations"]["Row"]>;
      };
      doctor_schedules: {
        Row: {
          id: string;
          doctor_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          is_available: boolean;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["doctor_schedules"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["doctor_schedules"]["Row"]>;
      };
    };
  };
}

// Criar cliente Supabase tipado
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Log de inicialização
console.log("🔧 Supabase configurado:", {
  url: supabaseUrl ? "OK" : "ERRO",
  key: supabaseAnonKey ? "OK" : "ERRO",
});
