"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Users, 
  Calendar, 
  DollarSign, 
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  MessageSquare,
  Brain,
  Stethoscope,
  Target
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { toast } from 'sonner';

export function Dashboard() {
  const { user } = useAuth();
  const { doctors, patients, appointments, financialRecords, updateAppointment } = useApp();
  const [isAlertsDialogOpen, setIsAlertsDialogOpen] = useState(false);
  const [pendingSearch, setPendingSearch] = useState('');
  const [pendingDate, setPendingDate] = useState('');
  const [pendingType, setPendingType] = useState('');
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    doctor_id: string;
    type: string;
    message: string;
    created_at: string;
  }>>([]);
  const [schedulerNotifications, setSchedulerNotifications] = useState<any[]>([]);

  React.useEffect(() => {
    if (user?.role !== 'medico' || !user.id) return;
    const loadNotifications = () => {
      const raw = localStorage.getItem('whatsapp-notifications');
      if (!raw) {
        setNotifications([]);
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        setNotifications(parsed.filter((n: any) => n.doctor_id === user.id));
      } catch {
        setNotifications([]);
      }
    };
    loadNotifications();
    window.addEventListener('storage', loadNotifications);
    return () => window.removeEventListener('storage', loadNotifications);
  }, [user?.role, user?.id]);

  React.useEffect(() => {
    if (user?.role !== 'agendamento' && user?.role !== 'admin') return;
    const loadSchedulerNotifications = () => {
      const raw = localStorage.getItem('scheduler-notifications');
      const rawJust = localStorage.getItem('doctor-justifications');
      let base: any[] = [];
      let justifications: any[] = [];
      try {
        base = raw ? JSON.parse(raw) : [];
      } catch {
        base = [];
      }
      try {
        justifications = rawJust ? JSON.parse(rawJust) : [];
      } catch {
        justifications = [];
      }
      const existingIds = new Set((base || []).map((n: any) => n.appointment_id));
      const fromJustifications = Array.isArray(justifications)
        ? justifications
            .filter((j: any) => !existingIds.has(j.appointment_id))
            .map((j: any) => {
              const appointment = appointments.find((apt) => apt.id === j.appointment_id);
              return {
                id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                appointment_id: j.appointment_id,
                patient_id: appointment?.patient_id,
                doctor_id: appointment?.doctor_id,
                patient_name: appointment ? getPatientName(appointment.patient_id) : 'Paciente',
                doctor_name: appointment ? getDoctorName(appointment.doctor_id) : 'Médico',
                date: appointment
                  ? new Date(appointment.date).toLocaleDateString('pt-BR')
                  : '',
                time: appointment?.time || '',
                reason: j.reason,
                created_at: j.created_at || new Date().toISOString(),
              };
            })
        : [];

      const fromAppointments = (appointments || [])
        .filter((apt) => apt.status === 'cancelado' && typeof apt.notes === 'string' && apt.notes.toLowerCase().includes('falta justificada'))
        .map((apt) => ({
          id: `apt-${apt.id}`,
          appointment_id: apt.id,
          patient_id: apt.patient_id,
          doctor_id: apt.doctor_id,
          patient_name: getPatientName(apt.patient_id),
          doctor_name: getDoctorName(apt.doctor_id),
          date: new Date(apt.date).toLocaleDateString('pt-BR'),
          time: apt.time || '',
          reason: extractJustificationReason(apt.notes),
          created_at: apt.created_at || new Date().toISOString(),
        }));

      const mergedRaw = [...fromAppointments, ...fromJustifications, ...(base || [])];
      const seen = new Set<string>();
      const merged = mergedRaw.filter((item: any) => {
        if (!item?.appointment_id) return false;
        if (seen.has(item.appointment_id)) return false;
        seen.add(item.appointment_id);
        return true;
      });
      localStorage.setItem('scheduler-notifications', JSON.stringify(merged));
      setSchedulerNotifications(merged);
      return;
    };
    loadSchedulerNotifications();
    window.addEventListener('storage', loadSchedulerNotifications);
    return () => window.removeEventListener('storage', loadSchedulerNotifications);
  }, [user?.role, appointments, doctors, patients]);

  const deleteDoctorNotification = (notificationId: string) => {
    const raw = localStorage.getItem('whatsapp-notifications');
    if (!raw) return;
    try {
      const list = JSON.parse(raw);
      const next = Array.isArray(list) ? list.filter((n: any) => n.id !== notificationId) : [];
      localStorage.setItem('whatsapp-notifications', JSON.stringify(next));
      setNotifications(next.filter((n: any) => n.doctor_id === user?.id));
      toast.success('Notificação removida.');
    } catch {
      // ignore
    }
  };

  const today = new Date();
  const baseAppointments = Array.isArray(appointments)
    ? appointments.filter((apt) => {
        if (user?.role !== 'medico') return true;
        return apt.doctor_id === user.id || (apt.doctor_ids || []).includes(user.id);
      })
    : [];

  const todayAppointments = baseAppointments.filter(
    (apt) => new Date(apt.date).toDateString() === today.toDateString()
  );

  const thisMonthRevenue = Array.isArray(financialRecords)
    ? financialRecords
        .filter(record => 
          record.type === 'receita' && 
          new Date(record.date).getMonth() === today.getMonth() &&
          record.status === 'pago'
        )
        .reduce((sum, record) => sum + record.amount, 0)
    : 0;

  const pendingAppointments = baseAppointments.filter(apt => apt.status === "pendente");

  
  const confirmedAppointments = baseAppointments.filter(apt => apt.status === 'confirmado').length;

  const dashboardAppointments = Array.isArray(appointments)
    ? appointments.filter((apt) => {
        if (user?.role !== 'medico') return true;
        return apt.doctor_id === user.id || (apt.doctor_ids || []).includes(user.id);
      })
    : [];

  const upcomingAppointments = dashboardAppointments
    .filter(apt => new Date(`${apt.date}T${apt.time || '00:00'}`) >= today && apt.status !== 'cancelado')
    .sort((a, b) => new Date(`${a.date}T${a.time || '00:00'}`).getTime() - new Date(`${b.date}T${b.time || '00:00'}`).getTime())
    .slice(0, 6);

  const recentAppointments = dashboardAppointments
    .slice()
    .sort((a, b) => new Date(`${b.date}T${b.time || '00:00'}`).getTime() - new Date(`${a.date}T${a.time || '00:00'}`).getTime())
    .slice(0, 5);

  const getWelcomeMessage = () => {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
    return `${greeting}, ${user?.name || 'Usuário'}!`;
  };

  const getPatientName = (patientId: string) => {
    const patient = patients.find(p => p.id === patientId);
    return patient ? patient.name : 'Paciente não encontrado';
  };

  const getDoctorName = (doctorId: string) => {
    const doctor = doctors.find(d => d.id === doctorId);
    return doctor ? doctor.name : 'Médico não encontrado';
  };

  const extractJustificationReason = (notes?: string | null) => {
    if (!notes) return 'Falta justificada';
    const match = notes.match(/Falta justificada:\s*([^-\n]+)/i);
    return match?.[1]?.trim() || 'Falta justificada';
  };

  const filteredPendingAppointments = pendingAppointments.filter((appointment) => {
    const patientName = getPatientName(appointment.patient_id).toLowerCase();
    const doctorName = getDoctorName(appointment.doctor_id).toLowerCase();
    const query = pendingSearch.trim().toLowerCase();
    const matchesQuery = query.length === 0 || patientName.includes(query) || doctorName.includes(query);

    const appointmentDate = new Date(appointment.date).toISOString().slice(0, 10);
    const matchesDate = pendingDate.length === 0 || appointmentDate === pendingDate;

    const typeText = String(appointment.type || '').toLowerCase();
    const matchesType = pendingType.trim().length === 0 || typeText.includes(pendingType.trim().toLowerCase());

    return matchesQuery && matchesDate && matchesType;
  });

  const handleConfirmAppointment = async (appointmentId: string) => {
    const success = await updateAppointment(appointmentId, { status: 'confirmado' });
    if (success) {
      toast.success('Consulta confirmada!');
    }
  };

  const getMetricsForRole = () => {
    switch (user?.role) {
      case 'admin':
        return [
          {
            title: 'Total de Médicos',
            value: Array.isArray(doctors) ? doctors.length.toString() : '0',
            description: 'Profissionais ativos',
            icon: Stethoscope,
            color: 'text-purple-600',
            bgColor: 'bg-purple-50',
            borderColor: 'border-purple-200'
          },
          {
            title: 'Total de Pacientes',
            value: Array.isArray(patients) ? patients.length.toString() : '0',
            description: 'Pacientes cadastrados',
            icon: Users,
            color: 'text-green-600',
            bgColor: 'bg-green-50',
            borderColor: 'border-green-200'
          },
          {
            title: 'Consultas Hoje',
            value: todayAppointments.length.toString(),
            description: 'Agendamentos para hoje',
            icon: Calendar,
            color: 'text-blue-600',
            bgColor: 'bg-blue-50',
            borderColor: 'border-blue-200'
          },
          {
            title: 'Receita do Mês',
            value: `R$ ${thisMonthRevenue.toLocaleString('pt-BR')}`,
            description: 'Faturamento mensal',
            icon: DollarSign,
            color: 'text-emerald-600',
            bgColor: 'bg-emerald-50',
            borderColor: 'border-emerald-200'
          }
        ];

      case 'financeiro':
        const thisMonthExpenses = Array.isArray(financialRecords)
          ? financialRecords
              .filter(r => r.type === 'despesa' && r.status === 'pago' && new Date(r.date).getMonth() === today.getMonth())
              .reduce((sum, r) => sum + r.amount, 0)
          : 0;
        
        const netProfit = thisMonthRevenue - thisMonthExpenses;
        
        return [
          {
            title: 'Receita do Mês',
            value: `R$ ${thisMonthRevenue.toLocaleString('pt-BR')}`,
            description: 'Faturamento mensal',
            icon: DollarSign,
            color: 'text-emerald-600',
            bgColor: 'bg-emerald-50',
            borderColor: 'border-emerald-200'
          },
          {
            title: 'Despesas do Mês',
            value: `R$ ${thisMonthExpenses.toLocaleString('pt-BR')}`,
            description: 'Gastos confirmados',
            icon: TrendingUp,
            color: 'text-red-600',
            bgColor: 'bg-red-50',
            borderColor: 'border-red-200'
          },
          {
            title: 'Lucro Líquido',
            value: `R$ ${netProfit.toLocaleString('pt-BR')}`,
            description: 'Receita - Despesas',
            icon: Target,
            color: netProfit >= 0 ? 'text-green-600' : 'text-red-600',
            bgColor: netProfit >= 0 ? 'bg-green-50' : 'bg-red-50',
            borderColor: netProfit >= 0 ? 'border-green-200' : 'border-red-200'
          },
          {
            title: 'Pendentes',
            value: Array.isArray(financialRecords) 
              ? financialRecords.filter(r => r.status === 'pendente').length.toString()
              : '0',
            description: 'Pagamentos pendentes',
            icon: Clock,
            color: 'text-yellow-600',
            bgColor: 'bg-yellow-50',
            borderColor: 'border-yellow-200'
          }
        ];

      case 'agendamento':
        const patientsWithPhone = Array.isArray(patients) ? patients.filter(p => p.phone).length : 0;
        
        return [
          {
            title: 'Consultas Hoje',
            value: todayAppointments.length.toString(),
            description: 'Agendamentos para hoje',
            icon: Calendar,
            color: 'text-purple-600',
            bgColor: 'bg-purple-50',
            borderColor: 'border-purple-200'
          },
          {
            title: 'Confirmadas',
            value: confirmedAppointments.toString(),
            description: 'Consultas confirmadas',
            icon: CheckCircle,
            color: 'text-green-600',
            bgColor: 'bg-green-50',
            borderColor: 'border-green-200'
          },
          {
            title: 'Pendentes',
            value: pendingAppointments.length.toString(),
            description: 'Aguardando confirmação',
            icon: Clock,
            color: 'text-yellow-600',
            bgColor: 'bg-yellow-50',
            borderColor: 'border-yellow-200'
          },
          {
            title: 'WhatsApp Disponível',
            value: patientsWithPhone.toString(),
            description: 'Pacientes com telefone',
            icon: MessageSquare,
            color: 'text-green-600',
            bgColor: 'bg-green-50',
            borderColor: 'border-green-200'
          }
        ];

      case 'medico':
        const doctorAppointments = Array.isArray(appointments) 
          ? appointments.filter(apt => apt.doctor_id === user?.id || (apt.doctor_ids || []).includes(user?.id || ''))
          : [];
        
        const doctorPatients = Array.isArray(patients) 
          ? patients.filter(p => doctorAppointments.some(apt => apt.patient_id === p.id))
          : [];
        
        return [
          {
            title: 'Meus Pacientes',
            value: doctorPatients.length.toString(),
            description: 'Pacientes atendidos',
            icon: Users,
            color: 'text-purple-600',
            bgColor: 'bg-purple-50',
            borderColor: 'border-purple-200'
          },
          {
            title: 'Consultas Hoje',
            value: doctorAppointments.filter(apt => 
              new Date(apt.date).toDateString() === today.toDateString()
            ).length.toString(),
            description: 'Suas consultas hoje',
            icon: Calendar,
            color: 'text-blue-600',
            bgColor: 'bg-blue-50',
            borderColor: 'border-blue-200'
          },
          {
            title: 'Próximas Consultas',
            value: doctorAppointments.filter(apt => 
              new Date(apt.date) > today && apt.status !== 'cancelado'
            ).length.toString(),
            description: 'Agendamentos futuros',
            icon: Clock,
            color: 'text-green-600',
            bgColor: 'bg-green-50',
            borderColor: 'border-green-200'
          },
          {
            title: 'Consultas Realizadas',
            value: doctorAppointments.filter(apt => apt.status === 'realizado').length.toString(),
            description: 'Total realizadas',
            icon: CheckCircle,
            color: 'text-emerald-600',
            bgColor: 'bg-emerald-50',
            borderColor: 'border-emerald-200'
          }
        ];

      case 'paciente':
        const patientAppointments = Array.isArray(appointments) 
          ? appointments.filter(apt => apt.patient_id === user?.id)
          : [];
        
        return [
          {
            title: 'Próxima Consulta',
            value: patientAppointments.filter(apt => 
              new Date(apt.date) > today && apt.status !== 'cancelado'
            ).length > 0 ? '1' : '0',
            description: 'Consultas agendadas',
            icon: Calendar,
            color: 'text-purple-600',
            bgColor: 'bg-purple-50',
            borderColor: 'border-purple-200'
          },
          {
            title: 'Histórico',
            value: patientAppointments.filter(apt => apt.status === 'realizado').length.toString(),
            description: 'Consultas realizadas',
            icon: CheckCircle,
            color: 'text-green-600',
            bgColor: 'bg-green-50',
            borderColor: 'border-green-200'
          },
          {
            title: 'Avaliações',
            value: '0',
            description: 'Avaliações realizadas',
            icon: Brain,
            color: 'text-purple-600',
            bgColor: 'bg-purple-50',
            borderColor: 'border-purple-200'
          },
          {
            title: 'Progresso',
            value: '85%',
            description: 'Evolução do tratamento',
            icon: TrendingUp,
            color: 'text-emerald-600',
            bgColor: 'bg-emerald-50',
            borderColor: 'border-emerald-200'
          }
        ];

      default:
        return [
          {
            title: 'Bem-vindo',
            value: '👋',
            description: 'Acesse as funcionalidades',
            icon: Users,
            color: 'text-purple-600',
            bgColor: 'bg-purple-50',
            borderColor: 'border-purple-200'
          }
        ];
    }
  };

  const metrics = getMetricsForRole();

  return (
    <div className="space-y-6 px-2 sm:px-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{getWelcomeMessage()}</h1>
          <p className="mt-2 text-sm text-gray-600 sm:text-base">
            Aqui está um resumo das atividades do sistema
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[11px] font-semibold text-primary sm:text-xs">
            Hoje: {today.toLocaleDateString('pt-BR')}
          </div>
          <div className="rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 text-[11px] font-semibold text-yellow-700 sm:text-xs">
            Pendentes: {pendingAppointments.length}
          </div>
          <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700 sm:text-xs">
            Confirmadas: {confirmedAppointments}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric, index) => (
          <Card key={index} className={`${metric.bgColor} ${metric.borderColor} border-2`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {metric.title}
              </CardTitle>
              <metric.icon className={`h-5 w-5 ${metric.color}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${metric.color}`}>{metric.value}</div>
              <p className="text-xs text-muted-foreground">
                {metric.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {user?.role === 'medico' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Notificações do WhatsApp</CardTitle>
              <CardDescription>Atualizações recentes de agendamentos</CardDescription>
            </div>
            <Badge variant="secondary">{notifications.length}</Badge>
          </CardHeader>
          <CardContent>
            {notifications.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhuma notificação recente.</p>
            ) : (
              <div className="space-y-3">
                {notifications.slice(0, 4).map((note) => (
                  <div key={note.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold capitalize">{note.type}</span>
                      <span className="text-xs text-gray-500">
                        {new Date(note.created_at).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <p className="mt-2 text-gray-700">{note.message}</p>
                    <div className="mt-3 flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteDoctorNotification(note.id)}
                      >
                        Excluir
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {(user?.role === 'agendamento' || user?.role === 'admin') && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Reagendamentos</CardTitle>
              <CardDescription>Consultas justificadas aguardando reagendamento</CardDescription>
            </div>
            <Badge variant="secondary">{schedulerNotifications.length}</Badge>
          </CardHeader>
          <CardContent>
            {schedulerNotifications.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhuma consulta aguardando reagendamento.</p>
            ) : (
              <div className="space-y-3">
                {schedulerNotifications.slice(0, 4).map((note) => (
                  <div key={note.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{note.patient_name} × {note.doctor_name}</span>
                      <span className="text-xs text-gray-500">
                        {new Date(note.created_at).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <p className="mt-2 text-gray-700">
                      Consulta cancelada em {note.date} {note.time} — Motivo: {note.reason || 'Falta justificada'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Próximas Consultas</CardTitle>
            <CardDescription>
              Próximos agendamentos a partir de hoje
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingAppointments.map((appointment) => (
                <div key={appointment.id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-gray-50">
                  <div>
                    <p className="font-medium">{getPatientName(appointment.patient_id)}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(appointment.date).toLocaleDateString('pt-BR')} às {appointment.time}
                    </p>
                    <p className="text-xs text-gray-400">{appointment.type}</p>
                  </div>
                  <Badge variant={
                    appointment.status === 'confirmado' ? 'default' :
                    appointment.status === 'realizado' ? 'secondary' :
                    appointment.status === 'cancelado' ? 'destructive' : 'outline'
                  }>
                    {appointment.status}
                  </Badge>
                </div>
              ))}
              {upcomingAppointments.length === 0 && (
                <p className="text-gray-500 text-center py-4">
                  Nenhuma consulta próxima
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Consultas Recentes</CardTitle>
            <CardDescription>
              Últimos agendamentos realizados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentAppointments.map((appointment) => {
                const patient = Array.isArray(patients) 
                  ? patients.find(p => p.id === appointment.patient_id)
                  : null;
                
                return (
                  <div key={appointment.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                    <div>
                      <p className="font-medium">{patient?.name || 'Paciente não encontrado'}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(appointment.date).toLocaleDateString('pt-BR')} às {appointment.time}
                      </p>
                      <p className="text-xs text-gray-400">{appointment.type}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={
                        appointment.status === 'confirmado' ? 'default' :
                        appointment.status === 'realizado' ? 'secondary' :
                        appointment.status === 'cancelado' ? 'destructive' : 'outline'
                      }>
                        {appointment.status}
                      </Badge>
                      {appointment.status === 'pendente' && (
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 border-green-200 text-green-700 hover:bg-green-50"
                          onClick={() => handleConfirmAppointment(appointment.id)}
                          aria-label="Confirmar consulta"
                          title="Confirmar consulta"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
              {recentAppointments.length === 0 && (
                <p className="text-gray-500 text-center py-4">
                  Nenhuma consulta encontrada
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertCircle className="mr-2 h-5 w-5" />
              Alertas e Ações
            </CardTitle>
            <CardDescription>
              Itens que precisam de atenção
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingAppointments.length > 0 && (
                <div className="flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-yellow-800">{pendingAppointments.length} consultas pendentes</p>
                    <p className="text-sm text-yellow-700">
                      Confirme as consultas para evitar faltas
                    </p>
                    <Dialog open={isAlertsDialogOpen} onOpenChange={setIsAlertsDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="mt-2 bg-blue-600 text-white hover:bg-blue-700">
                          Ver Detalhes
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Consultas Pendentes</DialogTitle>
                          <DialogDescription>
                            Gerencie as consultas que aguardam confirmação
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3">
                          <div className="grid gap-3 md:grid-cols-3">
                            <Input
                              placeholder="Buscar por paciente ou médico"
                              value={pendingSearch}
                              onChange={(e) => setPendingSearch(e.target.value)}
                            />
                            <Input
                              type="date"
                              value={pendingDate}
                              onChange={(e) => setPendingDate(e.target.value)}
                            />
                            <Input
                              placeholder="Filtrar por tipo de consulta"
                              value={pendingType}
                              onChange={(e) => setPendingType(e.target.value)}
                            />
                          </div>
                          <div className="flex items-center justify-between text-sm text-gray-500">
                            <span>Mostrando {filteredPendingAppointments.length} de {pendingAppointments.length} pendentes</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setPendingSearch('');
                                setPendingDate('');
                                setPendingType('');
                              }}
                            >
                              Limpar filtros
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Data/Hora</TableHead>
                                <TableHead>Paciente</TableHead>
                                <TableHead>Médico</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Valor</TableHead>
                                <TableHead>Ações</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredPendingAppointments.map((appointment) => (
                                <TableRow key={appointment.id}>
                                  <TableCell>
                                    <div>
                                      <p className="font-medium">
                                        {new Date(appointment.date).toLocaleDateString('pt-BR')}
                                      </p>
                                      <p className="text-sm text-gray-500">{appointment.time}</p>
                                    </div>
                                  </TableCell>
                                  <TableCell className="font-medium">
                                    {getPatientName(appointment.patient_id)}
                                  </TableCell>
                                  <TableCell>
                                    {getDoctorName(appointment.doctor_id)}
                                  </TableCell>
                                  <TableCell>{appointment.type}</TableCell>
                                  <TableCell className="text-green-600 font-medium">
                                    R$ {appointment.price.toLocaleString('pt-BR')}
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      size="sm"
                                      className="bg-green-600 text-white hover:bg-green-700"
                                      onClick={() => handleConfirmAppointment(appointment.id)}
                                    >
                                      <CheckCircle className="h-4 w-4 mr-1" />
                                      Confirmar
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                              {filteredPendingAppointments.length === 0 && (
                                <TableRow>
                                  <TableCell colSpan={6} className="text-center text-sm text-gray-500">
                                    Nenhuma consulta encontrada com os filtros atuais
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-medium text-green-800">Sistema funcionando</p>
                  <p className="text-sm text-green-700">
                    Todos os módulos operacionais
                  </p>
                </div>
              </div>

              {user?.role !== 'paciente' && (
                <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <MessageSquare className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-800">WhatsApp Integrado</p>
                    <p className="text-sm text-blue-700">
                      {patients.filter(p => p.phone).length} pacientes com telefone cadastrado
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Seção específica para médicos */}
      {user?.role === 'medico' && (
        <Card>
          <CardHeader>
            <CardTitle>Minha Agenda de Hoje</CardTitle>
            <CardDescription>
              Suas consultas programadas para hoje
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {appointments
                .filter(apt => (apt.doctor_id === user.id || (apt.doctor_ids || []).includes(user.id)) && new Date(apt.date).toDateString() === today.toDateString())
                .sort((a, b) => a.time.localeCompare(b.time))
                .map((appointment) => (
                <div key={appointment.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="text-center">
                      <p className="font-bold text-lg text-purple-600">{appointment.time}</p>
                      <p className="text-xs text-gray-500">{appointment.type}</p>
                    </div>
                    <div>
                      <p className="font-medium">{getPatientName(appointment.patient_id)}</p>
                      <p className="text-sm text-gray-600">R$ {appointment.price.toLocaleString('pt-BR')}</p>
                    </div>
                  </div>
                  <Badge variant={
                    appointment.status === 'confirmado' ? 'default' :
                    appointment.status === 'pendente' ? 'secondary' :
                    appointment.status === 'realizado' ? 'outline' : 'destructive'
                  }>
                    {appointment.status}
                  </Badge>
                </div>
              ))}
              {appointments.filter(apt => (apt.doctor_id === user.id || (apt.doctor_ids || []).includes(user.id)) && new Date(apt.date).toDateString() === today.toDateString()).length === 0 && (
                <p className="text-gray-500 text-center py-8">
                  Nenhuma consulta agendada para hoje
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
