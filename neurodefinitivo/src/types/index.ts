export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'financeiro' | 'agendamento' | 'medico' | 'paciente';
  avatar_url?: string;
  created_at: string;
  is_active: boolean;
  phone?: string;
  cpf?: string;
  birth_date?: string;
  address?: string;
  crm?: string;
  specialty?: string;
  password?: string;

}

export interface Doctor extends User {
  crm: string;
  specialty: string;
  phone: string;
  schedule: DoctorSchedule[];
}

export interface Patient extends User {
  cpf: string;
  birth_date: string;
  phone: string;
  address: string;
  medicalRecord: MedicalRecord[];
  appointments: Appointment[];
}

export interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  date: string;
  time: string;
  status: 'agendado' | 'confirmado' | 'cancelado' | 'realizado';
  type: string;
  notes?: string;
  price: number;
  created_at: string;
}

export interface MedicalRecord {
  id: string;
  patient_id: string;
  doctor_id: string;
  date: string;
  diagnosis: string;
  treatment: string;
  notes?: string;
  created_at: string;
}

export interface Evaluation {
  id: string;
  medical_record_id: string;
  type: string;
  score: number;
  observations?: string;
  date: string;
  created_at: string;
}

export interface DoctorSchedule {
  id?: string;
  doctor_id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
  created_at?: string;
}

export interface FinancialRecord {
  id: string;
  type: 'receita' | 'despesa';
  amount: number;
  description: string;
  category: string;
  date: string;
  appointment_id?: string;
  status: 'pendente' | 'pago' | 'cancelado';
  created_at: string;
}

export interface WhatsAppMessage {
  id: string;
  to: string;
  message: string;
  type: 'confirmation' | 'reminder' | 'cancellation' | 'manual';
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  sent_at: string;
  patient_name?: string;
}