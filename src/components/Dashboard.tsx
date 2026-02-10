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
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { formatDateBR, formatDateTimeBR, nowLocal, toInputDate } from '@/utils/date';

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
  const [appNotifications, setAppNotifications] = useState<Array<{
    id: string;
    type: string;
    message: string;
    created_at: string;
  }>>([]);
  const [schedulerNotifications, setSchedulerNotifications] = useState<any[]>([]);

  const getPatientName = (patientId: string) => {
    const patient = patients.find(p => p.id === patientId);
    return patient ? patient.name : 'Paciente não encontrado';
  };

  const getDoctorName = (doctorId: string) => {
    const doctor = doctors.find(d => d.id === doctorId);
    return doctor ? doctor.name : 'Médico não encontrado';
  };

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
    const loadAppNotifications = () => {
      const raw = localStorage.getItem('app-notifications');
      if (!raw) {
        setAppNotifications([]);
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        setAppNotifications(Array.isArray(parsed) ? parsed : []);
      } catch {
        setAppNotifications([]);
      }
    };
    loadAppNotifications();
    window.addEventListener('storage', loadAppNotifications);
    return () => window.removeEventListener('storage', loadAppNotifications);
  }, []);

  React.useEffect(() => {
    if (user?.role !== 'agendamento' && user?.role !== 'admin') return;
    const loadSchedulerNotifications = () => {
      const raw = localStorage.getItem('scheduler-notifications');
      let base: any[] = [];
      try {
        base = raw ? JSON.parse(raw) : [];
      } catch {
        base = [];
      }
      setSchedulerNotifications(Array.isArray(base) ? base : []);
    };
    loadSchedulerNotifications();
    window.addEventListener('storage', loadSchedulerNotifications);
    return () => window.removeEventListener('storage', loadSchedulerNotifications);
  }, [user?.role]);

  React.useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("realtime-dashboard-notifications")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        (payload: any) => {
          const apt = payload.new || payload.old;
          if (!apt) return;

          if (user.role === "medico" && apt.doctor_id !== user.id) return;

          const dateLabel = apt.date ? formatDateBR(apt.date) : "data";
          const timeLabel = apt.time ? ` às ${apt.time}` : "";
          const patientName = apt.patient_id ? getPatientName(apt.patient_id) : "Paciente";
          const doctorName = apt.doctor_id ? getDoctorName(apt.doctor_id) : "Médico";

          let message = "";
          if (payload.eventType === "INSERT") {
            message = `Novo atendimento: ${patientName} com ${doctorName} em ${dateLabel}${timeLabel}.`;
          } else if (payload.eventType === "UPDATE") {
            message = `Atendimento atualizado: ${patientName} com ${doctorName} em ${dateLabel}${timeLabel}.`;
          } else if (payload.eventType === "DELETE") {
            message = `Atendimento removido: ${patientName} com ${doctorName} em ${dateLabel}${timeLabel}.`;
          } else {
            message = `Atualização de atendimento: ${patientName} com ${doctorName} em ${dateLabel}${timeLabel}.`;
          }

          const notice = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            type: payload.eventType || "UPDATE",
            message,
            created_at: new Date().toISOString(),
          };

          const raw = localStorage.getItem("app-notifications");
          const list = raw ? JSON.parse(raw) : [];
          const next = [notice, ...(Array.isArray(list) ? list : [])].slice(0, 50);
          localStorage.setItem("app-notifications", JSON.stringify(next));
          setAppNotifications(next);
          toast(message);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, doctors, patients]);

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

  const today = nowLocal();
  const todayDateStr = toInputDate(today);
  const toDateKey = (value?: string) => {
    if (!value) return null;
    const base = value.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(base)) {
      const [y, m, d] = base.split("-").map(Number);
      return y * 10000 + m * 100 + d;
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(base)) {
      const [d, m, y] = base.split("/").map(Number);
      return y * 10000 + m * 100 + d;
    }
    if (/^\d{4}\/\d{2}\/\d{2}$/.test(base)) {
      const [y, m, d] = base.split("/").map(Number);
      return y * 10000 + m * 100 + d;
    }
    return null;
  };
  const todayKey = toDateKey(todayDateStr);
  const baseAppointments = Array.isArray(appointments)
    ? appointments.filter((apt) => {
        if (user?.role !== 'medico') return true;
        return apt.doctor_id === user.id || (apt.doctor_ids || []).includes(user.id);
      })
    : [];

  const todayAppointments = baseAppointments.filter(
    (apt) => apt.date === todayDateStr
  );
  const todayConfirmedAppointments = todayAppointments.filter(
    (apt) => apt.status === "confirmado"
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

  const pendingAppointments = baseAppointments.filter((apt) => {
    if (apt.status !== "pendente") return false;
    const aptKey = toDateKey(apt.date);
    return aptKey !== null && todayKey !== null ? aptKey >= todayKey : false;
  });

  
  const confirmedAppointments = baseAppointments.filter(apt => apt.status === 'confirmado').length;

  const dashboardAppointments = Array.isArray(appointments)
    ? appointments.filter((apt) => {
        if (user?.role !== 'medico') return true;
        return apt.doctor_id === user.id || (apt.doctor_ids || []).includes(user.id);
      })
    : [];

  const upcomingAppointments = dashboardAppointments
    .filter((apt) => {
      if (apt.status === "cancelado") return false;
      const aptKey = toDateKey(apt.date);
      return aptKey !== null && todayKey !== null ? aptKey >= todayKey : false;
    })
    .sort(
      (a, b) =>
        new Date(`${a.date}T${a.time || "00:00"}`).getTime() -
        new Date(`${b.date}T${b.time || "00:00"}`).getTime()
    )
    .slice(0, 6);
  const upcomingAppointmentsFiltered = upcomingAppointments.filter((apt) => {
    const aptKey = toDateKey(apt.date);
    return aptKey !== null && todayKey !== null ? aptKey >= todayKey : false;
  });

  const getWelcomeMessage = () => {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
    return `${greeting}, ${user?.name || 'Usuário'}!`;
  };

  const filteredPendingAppointments = pendingAppointments.filter((appointment) => {
    const patientName = getPatientName(appointment.patient_id).toLowerCase();
    const doctorName = getDoctorName(appointment.doctor_id).toLowerCase();
    const query = pendingSearch.trim().toLowerCase();
    const matchesQuery = query.length === 0 || patientName.includes(query) || doctorName.includes(query);

    const appointmentDate = appointment.date;
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
            borderColor: 'border-purple-200',
            linkId: 'meus-pacientes'
          },
          {
            title: 'Consultas Hoje',
            value: doctorAppointments.filter((apt) => apt.date === todayDateStr).length.toString(),
            description: 'Suas consultas hoje',
            icon: Calendar,
            color: 'text-blue-600',
            bgColor: 'bg-blue-50',
            borderColor: 'border-blue-200'
          },
          {
            title: 'Próximas Consultas',
            value: doctorAppointments.filter((apt) => {
              if (apt.status === "cancelado") return false;
              const aptKey = toDateKey(apt.date);
              return aptKey !== null && todayKey !== null ? aptKey > todayKey : false;
            }).length.toString(),
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
            value: patientAppointments.filter((apt) => {
              if (apt.status === "cancelado") return false;
              const aptKey = toDateKey(apt.date);
              return aptKey !== null && todayKey !== null ? aptKey > todayKey : false;
            }).length > 0 ? '1' : '0',
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

  const isDoctor = user?.role === "medico";
  const upcomingList = isDoctor ? todayAppointments : upcomingAppointmentsFiltered;
  const upcomingTitle = isDoctor ? "Consultas de Hoje" : "Próximas Consultas";
  const upcomingDescription = isDoctor
    ? "Consultas programadas para hoje"
    : "Próximos agendamentos a partir de hoje";

  const upcomingCard = (
    <Card className="overflow-hidden border-slate-200 bg-gradient-to-br from-white via-white to-purple-50/40 shadow-sm">
      <CardHeader className="border-b border-slate-100">
        <CardTitle className="text-lg text-slate-900">{upcomingTitle}</CardTitle>
        <CardDescription className="text-slate-500">
          {upcomingDescription}
        </CardDescription>
      </CardHeader>
      <CardContent className="bg-white/60">
        <div className="space-y-4">
          {upcomingList.map((appointment) => (
            <div
              key={appointment.id}
              className="group relative flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_20px_-18px_rgba(15,23,42,0.6)] transition hover:-translate-y-0.5 hover:border-purple-200 hover:shadow-[0_12px_26px_-18px_rgba(124,58,237,0.6)]"
            >
              <div className="absolute left-0 top-4 h-10 w-1.5 rounded-full bg-purple-500/70" />
              <div className="pl-3">
                <p className="text-sm font-semibold text-slate-900">
                  {getPatientName(appointment.patient_id)}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5">
                    {formatDateBR(appointment.date)} às {appointment.time}
                  </span>
                  {appointment.type && (
                    <span className="rounded-full bg-purple-50 px-2 py-0.5 text-purple-700">
                      {appointment.type}
                    </span>
                  )}
                </div>
              </div>
              <Badge
                variant={
                  appointment.status === 'confirmado'
                    ? 'default'
                    : appointment.status === 'realizado'
                      ? 'secondary'
                      : appointment.status === 'cancelado'
                        ? 'destructive'
                        : 'outline'
                }
                className="capitalize shadow-sm"
              >
                {appointment.status}
              </Badge>
            </div>
          ))}
          {upcomingList.length === 0 && (
            <p className="text-slate-500 text-center py-4">
              {isDoctor ? "Nenhuma consulta agendada para hoje" : "Nenhuma consulta próxima"}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );

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
            Hoje: {formatDateBR(today)}
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
        {metrics.map((metric, index) => {
          const linkId = (metric as any).linkId as string | undefined;
          return (
            <Card
              key={index}
              className={`${metric.bgColor} ${metric.borderColor} border-2 ${linkId ? "cursor-pointer transition hover:-translate-y-0.5 hover:shadow-md" : ""}`}
              role={linkId ? "button" : undefined}
              onClick={() => {
                if (!linkId || typeof window === "undefined") return;
                window.location.hash = `#${linkId}`;
              }}
            >
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
          );
        })}
      </div>

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
                        {formatDateTimeBR(note.created_at)}
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

      {user?.role === "medico" && upcomingCard}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
        {user?.role !== "medico" && upcomingCard}

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
                          {formatDateTimeBR(note.created_at)}
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Notificações em Tempo Real</CardTitle>
              <CardDescription>Alterações recentes no sistema</CardDescription>
            </div>
            <Badge variant="secondary">{appNotifications.length}</Badge>
          </CardHeader>
          <CardContent>
            {appNotifications.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhuma notificação recente.</p>
            ) : (
              <div className="space-y-3">
                {appNotifications.slice(0, 4).map((note) => (
                  <div key={note.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold capitalize">{note.type}</span>
                      <span className="text-xs text-gray-500">
                        {formatDateTimeBR(note.created_at)}
                      </span>
                    </div>
                    <p className="mt-2 text-gray-700">{note.message}</p>
                  </div>
                ))}
              </div>
            )}
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
                                {user?.role !== "medico" && <TableHead>Valor</TableHead>}
                                <TableHead>Ações</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredPendingAppointments.map((appointment) => (
                                <TableRow key={appointment.id}>
                                  <TableCell>
                                    <div>
                                      <p className="font-medium">
                                        {formatDateBR(appointment.date)}
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
                                  {user?.role !== "medico" && (
                                    <TableCell className="text-green-600 font-medium">
                                      R$ {appointment.price.toLocaleString('pt-BR')}
                                    </TableCell>
                                  )}
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
                                  <TableCell colSpan={user?.role !== "medico" ? 6 : 5} className="text-center text-sm text-gray-500">
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
        <>
          <Card>
            <CardHeader>
              <CardTitle>Minha Agenda de Hoje</CardTitle>
              <CardDescription>
                Suas consultas programadas para hoje
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {todayAppointments
                  .slice()
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
                {todayAppointments.length === 0 && (
                  <p className="text-gray-500 text-center py-8">
                    Nenhuma consulta agendada para hoje
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Confirmados Hoje</CardTitle>
              <CardDescription>
                Apenas consultas confirmadas para hoje
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {todayConfirmedAppointments
                  .slice()
                  .sort((a, b) => a.time.localeCompare(b.time))
                  .map((appointment) => (
                    <div key={appointment.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="text-center">
                          <p className="font-bold text-lg text-green-600">{appointment.time}</p>
                          <p className="text-xs text-gray-500">{appointment.type}</p>
                        </div>
                        <div>
                          <p className="font-medium">{getPatientName(appointment.patient_id)}</p>
                        </div>
                      </div>
                      <Badge variant="default">confirmado</Badge>
                    </div>
                  ))}
                {todayConfirmedAppointments.length === 0 && (
                  <p className="text-gray-500 text-center py-8">
                    Nenhuma consulta confirmada para hoje
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
