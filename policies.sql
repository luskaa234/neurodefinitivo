-- Liberar SELECT em todas as tabelas
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_users" ON public.users FOR SELECT USING (true);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_appointments" ON public.appointments FOR SELECT USING (true);

ALTER TABLE public.financial_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_financial_records" ON public.financial_records FOR SELECT USING (true);

ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_medical_records" ON public.medical_records FOR SELECT USING (true);

ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_evaluations" ON public.evaluations FOR SELECT USING (true);

ALTER TABLE public.doctor_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_doctor_schedules" ON public.doctor_schedules FOR SELECT USING (true);
