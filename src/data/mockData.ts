import { Doctor, Patient, Appointment, FinancialRecord, User } from '@/types';

export const mockUsers: User[] = [
  {
    id: '1',
    name: 'Dr. João Silva',
    email: 'joao@neurointegrar.com',
    role: 'medico',
    created_at: '2024-01-15T00:00:00.000Z',
    is_active: true
  },
  {
    id: '2',
    name: 'Dra. Maria Santos',
    email: 'maria@neurointegrar.com',
    role: 'medico',
    created_at: '2024-01-20T00:00:00.000Z',
    is_active: true
  },
  {
    id: '3',
    name: 'Ana Costa',
    email: 'ana@neurointegrar.com',
    role: 'agendamento',
    created_at: '2024-02-01T00:00:00.000Z',
    is_active: true
  }
];

export const mockDoctors: Doctor[] = [
  {
    id: '1',
    name: 'Dr. João Silva',
    email: 'joao@neurointegrar.com',
    role: 'medico',
    crm: '12345-SP',
    specialty: 'Neurologia',
    phone: '(11) 99999-1111',
    created_at: '2024-01-15T00:00:00.000Z',
    is_active: true,
    schedule: [
      { day_of_week: 1, start_time: '08:00', end_time: '17:00', is_available: true },
      { day_of_week: 2, start_time: '08:00', end_time: '17:00', is_available: true },
      { day_of_week: 3, start_time: '08:00', end_time: '17:00', is_available: true },
      { day_of_week: 4, start_time: '08:00', end_time: '17:00', is_available: true },
      { day_of_week: 5, start_time: '08:00', end_time: '12:00', is_available: true }
    ]
  },
  {
    id: '2',
    name: 'Dra. Maria Santos',
    email: 'maria@neurointegrar.com',
    role: 'medico',
    crm: '67890-SP',
    specialty: 'Neuropsicologia',
    phone: '(11) 99999-2222',
    created_at: '2024-01-20T00:00:00.000Z',
    is_active: true,
    schedule: [
      { day_of_week: 1, start_time: '09:00', end_time: '18:00', is_available: true },
      { day_of_week: 2, start_time: '09:00', end_time: '18:00', is_available: true },
      { day_of_week: 3, start_time: '09:00', end_time: '18:00', is_available: true },
      { day_of_week: 4, start_time: '09:00', end_time: '18:00', is_available: true }
    ]
  }
];

export const mockPatients: Patient[] = [
  {
    id: '1',
    name: 'Carlos Oliveira',
    email: 'carlos@email.com',
    role: 'paciente',
    cpf: '123.456.789-00',
    birth_date: '1985-03-15',
    phone: '(11) 98888-1111',
    address: 'Rua das Flores, 123 - São Paulo/SP',
    created_at: '2024-02-10T00:00:00.000Z',
    is_active: true,
    medicalRecord: [],
    appointments: []
  },
  {
    id: '2',
    name: 'Fernanda Lima',
    email: 'fernanda@email.com',
    role: 'paciente',
    cpf: '987.654.321-00',
    birth_date: '1990-07-22',
    phone: '(11) 98888-2222',
    address: 'Av. Paulista, 456 - São Paulo/SP',
    created_at: '2024-02-15T00:00:00.000Z',
    is_active: true,
    medicalRecord: [],
    appointments: []
  },
  {
    id: '3',
    name: 'Roberto Silva',
    email: 'roberto@email.com',
    role: 'paciente',
    cpf: '456.789.123-00',
    birth_date: '1978-11-08',
    phone: '(11) 98888-3333',
    address: 'Rua Augusta, 789 - São Paulo/SP',
    created_at: '2024-02-20T00:00:00.000Z',
    is_active: true,
    medicalRecord: [],
    appointments: []
  }
];

export const mockAppointments: Appointment[] = [
  {
    id: '1',
    patient_id: '1',
    doctor_id: '1',
    date: '2024-12-20',
    time: '09:00',
    status: 'confirmado',
    type: 'Consulta Inicial',
    notes: 'Primeira consulta neurológica',
    price: 300,
    created_at: '2024-12-10T00:00:00.000Z'
  },
  {
    id: '2',
    patient_id: '2',
    doctor_id: '2',
    date: '2024-12-20',
    time: '10:30',
    status: 'agendado',
    type: 'Avaliação Neuropsicológica',
    notes: 'Avaliação completa',
    price: 450,
    created_at: '2024-12-10T00:00:00.000Z'
  },
  {
    id: '3',
    patient_id: '3',
    doctor_id: '1',
    date: '2024-12-21',
    time: '14:00',
    status: 'confirmado',
    type: 'Retorno',
    notes: 'Acompanhamento do tratamento',
    price: 250,
    created_at: '2024-12-10T00:00:00.000Z'
  },
  {
    id: '4',
    patient_id: '1',
    doctor_id: '2',
    date: '2024-12-22',
    time: '11:00',
    status: 'agendado',
    type: 'Terapia',
    notes: 'Sessão de reabilitação',
    price: 200,
    created_at: '2024-12-10T00:00:00.000Z'
  }
];

export const mockFinancialRecords: FinancialRecord[] = [
  {
    id: '1',
    type: 'receita',
    amount: 300,
    description: 'Consulta - Carlos Oliveira',
    category: 'Consulta',
    date: '2024-12-15',
    appointment_id: '1',
    status: 'pago',
    created_at: '2024-12-10T00:00:00.000Z'
  },
  {
    id: '2',
    type: 'receita',
    amount: 450,
    description: 'Avaliação - Fernanda Lima',
    category: 'Avaliação',
    date: '2024-12-16',
    appointment_id: '2',
    status: 'pendente',
    created_at: '2024-12-10T00:00:00.000Z'
  },
  {
    id: '3',
    type: 'despesa',
    amount: 1200,
    description: 'Aluguel do consultório',
    category: 'Infraestrutura',
    date: '2024-12-01',
    status: 'pago',
    created_at: '2024-12-10T00:00:00.000Z'
  },
  {
    id: '4',
    type: 'receita',
    amount: 250,
    description: 'Retorno - Roberto Silva',
    category: 'Consulta',
    date: '2024-12-18',
    appointment_id: '3',
    status: 'pago',
    created_at: '2024-12-10T00:00:00.000Z'
  },
  {
    id: '5',
    type: 'despesa',
    amount: 350,
    description: 'Material de escritório',
    category: 'Suprimentos',
    date: '2024-12-10',
    status: 'pago',
    created_at: '2024-12-10T00:00:00.000Z'
  }
];
