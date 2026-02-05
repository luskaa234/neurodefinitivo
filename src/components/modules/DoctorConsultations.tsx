"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Clock, User, AlertTriangle, CheckCircle, FileText, Eye, Save } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { formatDateBR, formatDateTimeBR, nowLocal, toInputDate } from '@/utils/date';

const justificationSchema = z.object({
  appointment_id: z.string().min(1, 'Consulta é obrigatória'),
  reason: z.string().min(1, 'Motivo é obrigatório'),
  description: z.string().min(10, 'Descrição deve ter pelo menos 10 caracteres'),
  date: z.string().min(1, 'Data é obrigatória')
});

const normalizePhone = (value?: string | null) => {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('55') ? digits : `55${digits}`;
};

type JustificationFormData = z.infer<typeof justificationSchema>;

interface Justification {
  id: string;
  appointment_id: string;
  doctor_id: string;
  reason: string;
  description: string;
  date: string;
  created_at: string;
}

interface WhatsAppNotification {
  id: string;
  doctor_id: string;
  appointment_id?: string | null;
  type: "create" | "update" | "cancel" | "reschedule";
  message: string;
  created_at: string;
}

export function DoctorConsultations() {
  const { user } = useAuth();
  const { appointments, patients, updateAppointment } = useApp();
  const [isJustificationDialogOpen, setIsJustificationDialogOpen] = useState(false);
  const [justifications, setJustifications] = useState<Justification[]>([]);
  const [notifications, setNotifications] = useState<WhatsAppNotification[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<JustificationFormData>({
    resolver: zodResolver(justificationSchema)
  });

  React.useEffect(() => {
    // Carregar justificativas do localStorage
    const savedJustifications = localStorage.getItem('doctor-justifications');
    if (savedJustifications) {
      try {
        setJustifications(JSON.parse(savedJustifications));
      } catch (error) {
        console.error('Erro ao carregar justificativas:', error);
      }
    }
  }, []);

  React.useEffect(() => {
    if (!user?.id) return;
    const loadNotifications = () => {
      const raw = localStorage.getItem('whatsapp-notifications');
      if (!raw) {
        setNotifications([]);
        return;
      }
      try {
        const parsed = JSON.parse(raw) as WhatsAppNotification[];
        setNotifications(parsed.filter((n) => n.doctor_id === user.id));
      } catch {
        setNotifications([]);
      }
    };
    loadNotifications();
    window.addEventListener('storage', loadNotifications);
    return () => window.removeEventListener('storage', loadNotifications);
  }, [user?.id]);

  const deleteNotification = (notificationId: string) => {
    const raw = localStorage.getItem('whatsapp-notifications');
    if (!raw) return;
    try {
      const list = JSON.parse(raw) as WhatsAppNotification[];
      const next = list.filter((n) => n.id !== notificationId);
      localStorage.setItem('whatsapp-notifications', JSON.stringify(next));
      setNotifications(next.filter((n) => n.doctor_id === user?.id));
      toast.success('Notificação removida.');
    } catch {
      // ignore
    }
  };

  const saveJustifications = (newJustifications: Justification[]) => {
    setJustifications(newJustifications);
    localStorage.setItem('doctor-justifications', JSON.stringify(newJustifications));
  };

  const deleteJustification = (justificationId: string, appointmentId?: string) => {
    if (!window.confirm('Excluir esta falta justificada?')) return;
    const updated = justifications.filter((j) => j.id !== justificationId);
    saveJustifications(updated);
    if (appointmentId) {
      const raw = localStorage.getItem('scheduler-notifications');
      if (raw) {
        try {
          const list = JSON.parse(raw);
          const next = Array.isArray(list)
            ? list.filter((n: any) => n.appointment_id !== appointmentId)
            : [];
          localStorage.setItem('scheduler-notifications', JSON.stringify(next));
        } catch {
          // ignore
        }
      }
    }
    toast.success('Falta justificada excluída.');
  };

  const myAppointments = appointments.filter((apt) =>
    apt.doctor_id === user?.id || (apt.doctor_ids || []).includes(user?.id || "")
  );
  
  const today = nowLocal();
  const todayDateStr = toInputDate(today);
  const todayAppointments = myAppointments.filter(
    (apt) => apt.date === todayDateStr
  );

  const upcomingAppointments = myAppointments.filter(
    (apt) => apt.date > todayDateStr && apt.status !== "cancelado"
  );

  const getPatientName = (patientId: string) => {
    const patient = patients.find(p => p.id === patientId);
    return patient ? patient.name : 'Paciente não encontrado';
  };

  const getPatientPhone = (patientId: string) => {
    const patient = patients.find(p => p.id === patientId);
    return patient?.phone || 'Não informado';
  };

  const sendJustificationWhatsApp = (appointmentId: string) => {
    const appointment = appointments.find((apt) => apt.id === appointmentId);
    if (!appointment) {
      toast.error('Consulta não encontrada para enviar WhatsApp.');
      return;
    }
    const patientPhone = normalizePhone(getPatientPhone(appointment.patient_id));
    if (!patientPhone) {
      toast.error('Paciente sem telefone para WhatsApp.');
      return;
    }
    const patientName = getPatientName(appointment.patient_id);
    const dateTime = `${formatDateBR(appointment.date)} às ${appointment.time}`;
    const message = `Olá ${patientName}, sua consulta em ${dateTime} foi cancelada pelo médico (falta justificada).`;
    window.open(
      `https://api.whatsapp.com/send?phone=${patientPhone}&text=${encodeURIComponent(message)}`,
      '_blank'
    );
  };

  const onSubmitJustification = async (data: JustificationFormData) => {
    try {
      const newJustification: Justification = {
        id: Date.now().toString(),
        appointment_id: data.appointment_id,
        doctor_id: user?.id || '',
        reason: data.reason,
        description: data.description,
        date: data.date,
        created_at: new Date().toISOString()
      };

      const updatedJustifications = [newJustification, ...justifications];
      saveJustifications(updatedJustifications);

      // Atualizar status da consulta para cancelado
      await updateAppointment(data.appointment_id, { 
        status: 'cancelado',
        notes: `Falta justificada: ${data.reason} - ${data.description}`
      });

      sendJustificationWhatsApp(data.appointment_id);

      try {
        const appointment = appointments.find((apt) => apt.id === data.appointment_id);
        if (appointment && typeof window !== 'undefined') {
          const payload = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            appointment_id: appointment.id,
            patient_id: appointment.patient_id,
            doctor_id: appointment.doctor_id,
            patient_name: getPatientName(appointment.patient_id),
            doctor_name: user?.name || 'Médico',
            date: formatDateBR(appointment.date),
            time: appointment.time,
            reason: data.reason,
            created_at: new Date().toISOString(),
          };
          const raw = localStorage.getItem('scheduler-notifications');
          const list = raw ? JSON.parse(raw) : [];
          list.unshift(payload);
          localStorage.setItem('scheduler-notifications', JSON.stringify(list));
        }
      } catch (error) {
        console.error('Erro ao registrar notificação de reagendamento:', error);
      }

      toast.success('✅ Falta justificada com sucesso!');
      reset();
      setIsJustificationDialogOpen(false);
    } catch (error) {
      console.error('Erro ao justificar falta:', error);
      toast.error('❌ Erro ao justificar falta');
    }
  };

  const getJustificationForAppointment = (appointmentId: string) => {
    return justifications.find(j => j.appointment_id === appointmentId);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">👨‍⚕️ Minhas Consultas</h1>
          <p className="text-gray-600 mt-2">
            Visualize suas consultas e gerencie sua agenda médica
          </p>
        </div>

        <Dialog open={isJustificationDialogOpen} onOpenChange={setIsJustificationDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="bg-yellow-50 hover:bg-yellow-100 text-yellow-700">
              <AlertTriangle className="mr-2 h-4 w-4" />
              Justificar Falta
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Justificar Falta Médica</DialogTitle>
              <DialogDescription>
                Registre o motivo da ausência em uma consulta agendada
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmitJustification)} className="space-y-4">
              <div className="space-y-2">
                <Label>Consulta</Label>
                <Select onValueChange={(value) => setValue('appointment_id', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a consulta" />
                  </SelectTrigger>
                  <SelectContent>
                    {myAppointments
                      .filter(apt => apt.status === 'confirmado' || apt.status === 'pendente')
                      .map((appointment) => (
                      <SelectItem key={appointment.id} value={appointment.id}>
                        {getPatientName(appointment.patient_id)} - {formatDateBR(appointment.date)} às {appointment.time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.appointment_id && (
                  <p className="text-sm text-red-600">{errors.appointment_id.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Motivo da Falta</Label>
                <Select onValueChange={(value) => setValue('reason', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Doença">Doença</SelectItem>
                    <SelectItem value="Emergência Familiar">Emergência Familiar</SelectItem>
                    <SelectItem value="Compromisso Médico">Compromisso Médico</SelectItem>
                    <SelectItem value="Congresso/Curso">Congresso/Curso</SelectItem>
                    <SelectItem value="Problema de Transporte">Problema de Transporte</SelectItem>
                    <SelectItem value="Outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
                {errors.reason && (
                  <p className="text-sm text-red-600">{errors.reason.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição Detalhada</Label>
                <Textarea
                  id="description"
                  placeholder="Descreva detalhadamente o motivo da falta..."
                  rows={4}
                  {...register('description')}
                />
                {errors.description && (
                  <p className="text-sm text-red-600">{errors.description.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Data da Justificativa</Label>
                <Input
                  id="date"
                  type="date"
                  defaultValue={toInputDate(nowLocal())}
                  {...register('date')}
                />
                {errors.date && (
                  <p className="text-sm text-red-600">{errors.date.message}</p>
                )}
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsJustificationDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  <Save className="mr-2 h-4 w-4" />
                  {isSubmitting ? 'Salvando...' : 'Justificar Falta'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

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
              {notifications.slice(0, 6).map((note) => (
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
                      onClick={() => deleteNotification(note.id)}
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

      {/* Estatísticas do médico */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Consultas Hoje</CardTitle>
            <Calendar className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{todayAppointments.length}</div>
            <p className="text-xs text-muted-foreground">Agendadas para hoje</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Próximas Consultas</CardTitle>
            <Clock className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{upcomingAppointments.length}</div>
            <p className="text-xs text-muted-foreground">Agendamentos futuros</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Consultas Realizadas</CardTitle>
            <CheckCircle className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {myAppointments.filter(apt => apt.status === 'realizado').length}
            </div>
            <p className="text-xs text-muted-foreground">Total realizadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Faltas Justificadas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{justifications.length}</div>
            <p className="text-xs text-muted-foreground">Justificativas registradas</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="upcoming" className="space-y-4">
        <TabsList>
          <TabsTrigger value="upcoming">🔮 Próximas ({upcomingAppointments.length})</TabsTrigger>
          <TabsTrigger value="today">📅 Hoje ({todayAppointments.length})</TabsTrigger>
          <TabsTrigger value="justifications">⚠️ Justificativas ({justifications.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="today">
          <Card>
            <CardHeader>
              <CardTitle>📅 Minha Agenda de Hoje</CardTitle>
              <CardDescription>
                Suas consultas programadas para hoje
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Horário</TableHead>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {todayAppointments
                    .sort((a, b) => a.time.localeCompare(b.time))
                    .map((appointment) => (
                    <TableRow key={appointment.id}>
                      <TableCell className="font-bold text-purple-600">{appointment.time}</TableCell>
                      <TableCell className="font-medium">{getPatientName(appointment.patient_id)}</TableCell>
                      <TableCell>{getPatientPhone(appointment.patient_id)}</TableCell>
                      <TableCell>{appointment.type}</TableCell>
                      <TableCell className="text-green-600 font-medium">
                        R$ {appointment.price.toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          appointment.status === 'confirmado' ? 'default' :
                          appointment.status === 'pendente' ? 'secondary' :
                          appointment.status === 'realizado' ? 'outline' : 'destructive'
                        }>
                          {appointment.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              updateAppointment(appointment.id, { status: 'realizado' });
                              toast.success('✅ Consulta marcada como realizada!');
                            }}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {todayAppointments.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  📅 Nenhuma consulta agendada para hoje
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upcoming">
          <Card>
            <CardHeader>
              <CardTitle>🔮 Próximas Consultas</CardTitle>
              <CardDescription>
                Suas consultas agendadas para os próximos dias
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Horário</TableHead>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {upcomingAppointments
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                    .map((appointment) => (
                    <TableRow key={appointment.id}>
                      <TableCell>{formatDateBR(appointment.date)}</TableCell>
                      <TableCell className="font-bold text-blue-600">{appointment.time}</TableCell>
                      <TableCell className="font-medium">{getPatientName(appointment.patient_id)}</TableCell>
                      <TableCell>{getPatientPhone(appointment.patient_id)}</TableCell>
                      <TableCell>{appointment.type}</TableCell>
                      <TableCell>
                        <Badge variant={
                          appointment.status === 'confirmado' ? 'default' :
                          appointment.status === 'pendente' ? 'secondary' : 'outline'
                        }>
                          {appointment.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {upcomingAppointments.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  🔮 Nenhuma consulta futura agendada
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="justifications">
          <Card>
            <CardHeader>
              <CardTitle>⚠️ Faltas Justificadas</CardTitle>
              <CardDescription>
                Histórico de justificativas de faltas médicas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data da Consulta</TableHead>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Data da Justificativa</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {justifications
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                    .map((justification) => {
                      const appointment = appointments.find(apt => apt.id === justification.appointment_id);
                      
                      return (
                        <TableRow key={justification.id}>
                          <TableCell>
                            {appointment 
                              ? `${formatDateBR(appointment.date)} às ${appointment.time}`
                              : 'Consulta não encontrada'
                            }
                          </TableCell>
                          <TableCell className="font-medium">
                            {appointment ? getPatientName(appointment.patient_id) : 'N/A'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{justification.reason}</Badge>
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <div className="truncate" title={justification.description}>
                              {justification.description}
                            </div>
                          </TableCell>
                          <TableCell>
                            {formatDateBR(justification.created_at)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deleteJustification(justification.id, justification.appointment_id)}
                            >
                              Excluir
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
              {justifications.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  ⚠️ Nenhuma falta justificada
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
