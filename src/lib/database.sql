-- Habilitar RLS (Row Level Security)
ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret';

-- Criar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'financeiro', 'agendamento', 'medico', 'paciente')),
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  phone VARCHAR(20),
  cpf VARCHAR(14),
  birth_date DATE,
  address TEXT,
  crm VARCHAR(20),
  specialty VARCHAR(100)
);

-- Tabela de agendamentos
CREATE TABLE IF NOT EXISTS appointments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time TIME NOT NULL,
  status VARCHAR(20) DEFAULT 'agendado' CHECK (status IN ('agendado', 'confirmado', 'cancelado', 'realizado')),
  type VARCHAR(100) NOT NULL,
  notes TEXT,
  price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de registros financeiros
CREATE TABLE IF NOT EXISTS financial_records (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  type VARCHAR(10) NOT NULL CHECK (type IN ('receita', 'despesa')),
  amount DECIMAL(10,2) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(100) NOT NULL,
  date DATE NOT NULL,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'cancelado')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de prontuários médicos
CREATE TABLE IF NOT EXISTS medical_records (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  diagnosis TEXT NOT NULL,
  treatment TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de avaliações
CREATE TABLE IF NOT EXISTS evaluations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  medical_record_id UUID NOT NULL REFERENCES medical_records(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL,
  score INTEGER NOT NULL,
  observations TEXT,
  date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de horários dos médicos
CREATE TABLE IF NOT EXISTS doctor_schedules (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Configurar RLS (Row Level Security)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_schedules ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para usuários autenticados
CREATE POLICY "Usuários podem ver todos os dados" ON users FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins podem inserir usuários" ON users FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Admins podem atualizar usuários" ON users FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Usuários podem ver agendamentos" ON appointments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Usuários podem inserir agendamentos" ON appointments FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Usuários podem atualizar agendamentos" ON appointments FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Usuários podem deletar agendamentos" ON appointments FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Usuários podem ver registros financeiros" ON financial_records FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Usuários podem inserir registros financeiros" ON financial_records FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Usuários podem atualizar registros financeiros" ON financial_records FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Usuários podem ver prontuários" ON medical_records FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Médicos podem inserir prontuários" ON medical_records FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Médicos podem atualizar prontuários" ON medical_records FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Usuários podem ver avaliações" ON evaluations FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Médicos podem inserir avaliações" ON evaluations FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Médicos podem atualizar avaliações" ON evaluations FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Usuários podem ver horários" ON doctor_schedules FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins podem inserir horários" ON doctor_schedules FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Admins podem atualizar horários" ON doctor_schedules FOR UPDATE USING (auth.role() = 'authenticated');

-- Inserir dados iniciais
INSERT INTO users (name, email, role, created_at, is_active) VALUES
('Administrador', 'admin@neurointegrar.com', 'admin', NOW(), true),
('Financeiro', 'financeiro@neurointegrar.com', 'financeiro', NOW(), true),
('Dr. João Silva', 'joao@neurointegrar.com', 'medico', NOW(), true),
('Dra. Maria Santos', 'maria@neurointegrar.com', 'medico', NOW(), true),
('Ana Costa', 'ana@neurointegrar.com', 'agendamento', NOW(), true),
('Carlos Oliveira', 'carlos@email.com', 'paciente', NOW(), true),
('Fernanda Lima', 'fernanda@email.com', 'paciente', NOW(), true),
('Roberto Silva', 'roberto@email.com', 'paciente', NOW(), true);

-- Atualizar dados específicos dos médicos
UPDATE users SET 
  crm = '12345-SP',
  specialty = 'Neurologia',
  phone = '(11) 99999-1111'
WHERE email = 'joao@neurointegrar.com';

UPDATE users SET 
  crm = '67890-SP',
  specialty = 'Neuropsicologia',
  phone = '(11) 99999-2222'
WHERE email = 'maria@neurointegrar.com';

-- Atualizar dados dos pacientes
UPDATE users SET 
  cpf = '123.456.789-00',
  birth_date = '1985-03-15',
  phone = '(11) 98888-1111',
  address = 'Rua das Flores, 123 - São Paulo/SP'
WHERE email = 'carlos@email.com';

UPDATE users SET 
  cpf = '987.654.321-00',
  birth_date = '1990-07-22',
  phone = '(11) 98888-2222',
  address = 'Av. Paulista, 456 - São Paulo/SP'
WHERE email = 'fernanda@email.com';

UPDATE users SET 
  cpf = '456.789.123-00',
  birth_date = '1978-11-08',
  phone = '(11) 98888-3333',
  address = 'Rua Augusta, 789 - São Paulo/SP'
WHERE email = 'roberto@email.com';

-- Inserir horários dos médicos
INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, is_available)
SELECT 
  u.id,
  generate_series(1, 5) as day_of_week,
  '08:00'::time,
  '17:00'::time,
  true
FROM users u WHERE u.email = 'joao@neurointegrar.com';

INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, is_available)
SELECT 
  u.id,
  generate_series(1, 4) as day_of_week,
  '09:00'::time,
  '18:00'::time,
  true
FROM users u WHERE u.email = 'maria@neurointegrar.com';

-- Inserir alguns agendamentos de exemplo
INSERT INTO appointments (patient_id, doctor_id, date, time, status, type, notes, price)
SELECT 
  p.id,
  d.id,
  CURRENT_DATE + INTERVAL '1 day',
  '09:00'::time,
  'confirmado',
  'Consulta Inicial',
  'Primeira consulta neurológica',
  300.00
FROM users p, users d 
WHERE p.email = 'carlos@email.com' AND d.email = 'joao@neurointegrar.com';

INSERT INTO appointments (patient_id, doctor_id, date, time, status, type, notes, price)
SELECT 
  p.id,
  d.id,
  CURRENT_DATE + INTERVAL '1 day',
  '10:30'::time,
  'agendado',
  'Avaliação Neuropsicológica',
  'Avaliação completa',
  450.00
FROM users p, users d 
WHERE p.email = 'fernanda@email.com' AND d.email = 'maria@neurointegrar.com';

-- Inserir registros financeiros
INSERT INTO financial_records (type, amount, description, category, date, status)
VALUES 
('receita', 300.00, 'Consulta - Carlos Oliveira', 'Consulta', CURRENT_DATE - INTERVAL '5 days', 'pago'),
('receita', 450.00, 'Avaliação - Fernanda Lima', 'Avaliação', CURRENT_DATE - INTERVAL '4 days', 'pendente'),
('despesa', 1200.00, 'Aluguel do consultório', 'Infraestrutura', CURRENT_DATE - INTERVAL '10 days', 'pago'),
('receita', 250.00, 'Retorno - Roberto Silva', 'Consulta', CURRENT_DATE - INTERVAL '2 days', 'pago'),
('despesa', 350.00, 'Material de escritório', 'Suprimentos', CURRENT_DATE - INTERVAL '7 days', 'pago');