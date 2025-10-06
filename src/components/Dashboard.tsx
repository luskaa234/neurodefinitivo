"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
  FileText,
  Phone,
  Activity,
  Target,
  BarChart3
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { toast } from 'sonner';

export function Dashboard() {
  const { user } = useAuth();
  const { doctors, patients, appointments, financialRecords, updateAppointment } = useApp();
  const [isAlertsDialogOpen, setIsAlertsDialogOpen] = useState(false);

  const today = new Date();
  const todayAppointments = Array.isArray(appointments) 
    ? appointments.filter(apt => new Date(apt.date).toDateString() === today.toDateString())
    : [];

  const thisMonthRevenue = Array.isArray(financialRecords)
    ? financialRecords
        .filter(record => 
          record.type === 'receita' && 
          new Date(record.date).getMonth() === today.getMonth() &&
          record.status === 'pago'
        )
        .reduce((sum, record) => sum + record.amount, 0)
    : 0;

  const pendingAppointments = Array.isArray(appointments) 
  ? appointments.filter(apt => apt.status === "pendente")
  : [];

  
  const confirmedAppointments = Array.isArray(appointments) 
    ? appointments.filter(apt => apt.status === 'confirmado').length 
    : 0;

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
          ? appointments.filter(apt => apt.doctor_id === user?.id)
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{getWelcomeMessage()}</h1>
        <p className="text-gray-600 mt-2">
          Aqui está um resumo das atividades do sistema
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Consultas Recentes</CardTitle>
            <CardDescription>
              Últimos agendamentos realizados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.isArray(appointments) && appointments.slice(0, 5).map((appointment) => {
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
                          size="sm"
                          onClick={() => handleConfirmAppointment(appointment.id)}
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
              {(!Array.isArray(appointments) || appointments.length === 0) && (
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
                        <Button size="sm" className="mt-2">
                          Ver Detalhes
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl">
                        <DialogHeader>
                          <DialogTitle>Consultas Pendentes</DialogTitle>
                          <DialogDescription>
                            Gerencie as consultas que aguardam confirmação
                          </DialogDescription>
                        </DialogHeader>
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
                              {pendingAppointments.map((appointment) => (
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
                                      onClick={() => handleConfirmAppointment(appointment.id)}
                                    >
                                      <CheckCircle className="h-4 w-4 mr-1" />
                                      Confirmar
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
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
                .filter(apt => apt.doctor_id === user.id && new Date(apt.date).toDateString() === today.toDateString())
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
              {appointments.filter(apt => apt.doctor_id === user.id && new Date(apt.date).toDateString() === today.toDateString()).length === 0 && (
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