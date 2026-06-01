"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Eye, Filter, Pencil, RotateCw, Search, Send, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useApp } from "@/contexts/AppContext";
import { formatDateBR, formatDateTimeBR, nowLocal, toInputDate } from "@/utils/date";
import {
  buildWhatsAppUrl,
  createWhatsAppMessage,
  getLegacyWhatsAppStorageStats,
  listWhatsAppMessages,
  readLegacyWhatsAppMessages,
  resendWhatsAppMessage,
  restoreWhatsAppMessage,
  softDeleteWhatsAppMessage,
  subscribeToWhatsAppHistory,
  updateWhatsAppMessage,
  type WhatsAppHistoryMessage,
  type WhatsAppMessageType,
} from "@/lib/whatsapp";

const typeOptions: Array<{ value: WhatsAppMessageType | "all"; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "appointment.created", label: "Consulta marcada" },
  { value: "appointment.cancelled", label: "Consulta cancelada" },
  { value: "appointment.rescheduled", label: "Consulta remarcada" },
  { value: "appointment.reminder", label: "Lembrete" },
  { value: "appointment.confirmation", label: "Confirmacao de presenca" },
  { value: "patient.absent", label: "Falta do paciente" },
  { value: "payment.pending", label: "Pagamento pendente" },
  { value: "payment.confirmed", label: "Pagamento confirmado" },
  { value: "manual", label: "Manual" },
];

const statusOptions = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendente" },
  { value: "sent", label: "Enviado" },
  { value: "failed", label: "Falhou" },
  { value: "deleted", label: "Excluido" },
  { value: "restored", label: "Restaurado" },
];

const appointmentTemplateLabels: Record<string, string> = {
  "appointment.confirmation": "Confirmacao",
  "appointment.reminder": "Lembrete",
  "appointment.cancelled": "Cancelamento",
  "appointment.rescheduled": "Reagendamento",
};

const normalizePhoneBR = (raw?: string | null) => {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55")) return digits.length >= 12 ? digits : "";
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return "";
};

const normalizeTime = (value?: string | null) => {
  const match = String(value || "").match(/(\d{1,2}):(\d{2})/);
  if (!match) return "00:00";
  return `${match[1].padStart(2, "0")}:${match[2]}`;
};

const toDateTimeMs = (date?: string, time?: string) =>
  date ? new Date(`${date}T${normalizeTime(time)}:00`).getTime() : 0;

const joinNames = (names: string[]) => {
  if (names.length <= 1) return names[0] || "";
  if (names.length === 2) return `${names[0]} e ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
};

export function WhatsAppModule() {
  const { user } = useAuth();
  const { patients, doctors, appointments } = useApp();
  const [messages, setMessages] = useState<WhatsAppHistoryMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [patient, setPatient] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [selected, setSelected] = useState<WhatsAppHistoryMessage | null>(null);
  const [editing, setEditing] = useState<WhatsAppHistoryMessage | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTab, setComposeTab] = useState<"appointment" | "manual">("appointment");
  const [manualPatientId, setManualPatientId] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [manualMessage, setManualMessage] = useState("");
  const [manualType, setManualType] = useState<WhatsAppMessageType>("manual");
  const [appointmentSearch, setAppointmentSearch] = useState("");
  const [appointmentDateFilter, setAppointmentDateFilter] = useState("");
  const [selectedAppointmentId, setSelectedAppointmentId] = useState("");
  const [selectedAppointmentPatientId, setSelectedAppointmentPatientId] = useState("");
  const [appointmentMessageType, setAppointmentMessageType] = useState<WhatsAppMessageType>("appointment.confirmation");
  const [appointmentMessage, setAppointmentMessage] = useState("");
  const [appointmentPage, setAppointmentPage] = useState(1);
  const [legacyStats, setLegacyStats] = useState({ total: 0, keys: {} as Record<string, number> });
  const APPOINTMENT_PAGE_SIZE = 7;

  const load = async () => {
    setLoading(true);
    try {
      const rows = await listWhatsAppMessages({ patient, phone, status, type, dateFrom, dateTo, includeDeleted });
      setMessages(rows);
      setLegacyStats(getLegacyWhatsAppStorageStats());
    } catch (error: any) {
      toast.error(error?.message || "Erro ao carregar historico.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [patient, phone, status, type, dateFrom, dateTo, includeDeleted]);

  useEffect(() => subscribeToWhatsAppHistory(load), []);

  const patientById = useMemo(() => new Map(patients.map((item) => [item.id, item] as const)), [patients]);
  const doctorById = useMemo(() => new Map(doctors.map((item) => [item.id, item] as const)), [doctors]);
  const selectedManualPatient = useMemo(() => patients.find((item) => item.id === manualPatientId) || null, [manualPatientId, patients]);

  useEffect(() => {
    setManualPhone(normalizePhoneBR(selectedManualPatient?.phone));
  }, [selectedManualPatient?.id]);

  const filteredAppointments = useMemo(() => {
    const q = appointmentSearch.trim().toLowerCase();
    return appointments
      .filter((appointment) => String(appointment.status || "").toLowerCase() !== "cancelado")
      .filter((appointment) => !appointmentDateFilter || appointment.date === appointmentDateFilter)
      .sort((a, b) => toDateTimeMs(a.date, a.time) - toDateTimeMs(b.date, b.time))
      .filter((appointment) => {
        if (!q) return true;
        const patientIds = appointment.patient_ids?.length ? appointment.patient_ids : [appointment.patient_id];
        const doctorIds = appointment.doctor_ids?.length ? appointment.doctor_ids : [appointment.doctor_id];
        const patientText = patientIds.map((id) => patientById.get(id)?.name || "").join(" ");
        const doctorText = doctorIds.map((id) => doctorById.get(id)?.name || "").join(" ");
        return `${patientText} ${doctorText} ${appointment.date} ${appointment.time} ${appointment.type}`.toLowerCase().includes(q);
      });
  }, [appointmentDateFilter, appointmentSearch, appointments, doctorById, patientById]);

  const appointmentDates = useMemo(
    () =>
      Array.from(
        new Set(
          appointments
            .filter((appointment) => String(appointment.status || "").toLowerCase() !== "cancelado")
            .map((appointment) => appointment.date)
            .filter(Boolean)
        )
      ).sort(),
    [appointments]
  );

  useEffect(() => {
    if (appointmentDateFilter || appointmentDates.length === 0) return;
    const today = toInputDate(nowLocal());
    const nextDate = appointmentDates.find((date) => date >= today) || appointmentDates[0];
    setAppointmentDateFilter(appointmentDates.includes(today) ? today : nextDate);
  }, [appointmentDateFilter, appointmentDates]);

  const appointmentTotalPages = Math.max(1, Math.ceil(filteredAppointments.length / APPOINTMENT_PAGE_SIZE));
  const pagedAppointments = filteredAppointments.slice((appointmentPage - 1) * APPOINTMENT_PAGE_SIZE, appointmentPage * APPOINTMENT_PAGE_SIZE);
  const selectedAppointment = useMemo(
    () => filteredAppointments.find((item) => item.id === selectedAppointmentId) || null,
    [filteredAppointments, selectedAppointmentId]
  );
  const appointmentPatients = useMemo(() => {
    if (!selectedAppointment) return [];
    const ids = selectedAppointment.patient_ids?.length ? selectedAppointment.patient_ids : [selectedAppointment.patient_id];
    return ids.map((id) => patientById.get(id)).filter(Boolean) as typeof patients;
  }, [patientById, selectedAppointment]);
  const appointmentDoctors = useMemo(() => {
    if (!selectedAppointment) return [];
    const ids = selectedAppointment.doctor_ids?.length ? selectedAppointment.doctor_ids : [selectedAppointment.doctor_id];
    return ids.map((id) => doctorById.get(id)).filter(Boolean) as typeof doctors;
  }, [doctorById, selectedAppointment]);

  useEffect(() => setAppointmentPage(1), [appointmentDateFilter, appointmentSearch]);
  useEffect(() => {
    if (!selectedAppointment) return;
    const exists = appointmentPatients.some((item) => item.id === selectedAppointmentPatientId);
    if (!exists) setSelectedAppointmentPatientId(appointmentPatients[0]?.id || "");
  }, [appointmentPatients, selectedAppointment, selectedAppointmentPatientId]);

  const buildAppointmentMessage = (patientName: string, doctorsText: string, appointment: any, messageType: WhatsAppMessageType) => {
    const dateLabel = formatDateBR(appointment.date);
    const timeLabel = normalizeTime(appointment.time);
    const serviceLabel = appointment.type ? `com ${appointment.type}` : "com atendimento";
    const base = `Ola, bom dia, tudo bem?\n${patientName} voce tem atendimento agendado para o dia ${dateLabel}, as ${timeLabel}, ${serviceLabel} (${doctorsText}).`;
    if (messageType === "appointment.reminder") return `${base}\nEsse e um lembrete do seu atendimento.\nPosso confirmar a presenca hoje?`;
    if (messageType === "appointment.cancelled") return `Ola, bom dia, tudo bem?\n${patientName} seu atendimento agendado para o dia ${dateLabel}, as ${timeLabel}, ${serviceLabel} (${doctorsText}) foi cancelado.`;
    if (messageType === "appointment.rescheduled") return `Ola, bom dia, tudo bem?\n${patientName} seu atendimento foi reagendado para o dia ${dateLabel}, as ${timeLabel}, ${serviceLabel} (${doctorsText}).`;
    return `${base}\nPosso confirmar a presenca hoje?`;
  };

  useEffect(() => {
    if (!selectedAppointment || !selectedAppointmentPatientId) return;
    const destination = appointmentPatients.find((item) => item.id === selectedAppointmentPatientId);
    if (!destination) return;
    setAppointmentMessage(
      buildAppointmentMessage(destination.name, joinNames(appointmentDoctors.map((item) => item.name)), selectedAppointment, appointmentMessageType)
    );
  }, [appointmentDoctors, appointmentMessageType, appointmentPatients, selectedAppointment, selectedAppointmentPatientId]);

  const restoreFromLegacyStorage = () => {
    const legacyRows = readLegacyWhatsAppMessages();
    if (!legacyRows.length) {
      toast.error("Nao encontrei historico antigo neste navegador.");
      return;
    }
    setMessages((current) => {
      const byId = new Map<string, WhatsAppHistoryMessage>();
      [...current, ...legacyRows].forEach((row) => byId.set(row.id, row));
      return Array.from(byId.values()).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    });
    toast.success(`${legacyRows.length} mensagem(ns) antigas restauradas na tela.`);
  };

  const sendManual = async () => {
    const cleanPhone = normalizePhoneBR(manualPhone);
    if (!cleanPhone) return toast.error("Telefone invalido.");
    if (!manualMessage.trim()) return toast.error("Mensagem obrigatoria.");
    const patientName = selectedManualPatient?.name || "Contato manual";
    window.open(buildWhatsAppUrl(cleanPhone, manualMessage), "_blank");
    await createWhatsAppMessage({
      patientId: selectedManualPatient?.id || null,
      patientName,
      responsibleName: "",
      phone: cleanPhone,
      message: manualMessage,
      messageType: manualType,
      status: "sent",
      user: user ? { id: user.id, name: user.name } : null,
    });
    toast.success("Mensagem registrada no historico.");
    setComposeOpen(false);
    setManualMessage("");
    setManualPatientId("");
    await load();
  };

  const sendWithAppointment = async () => {
    if (!selectedAppointment) return toast.error("Selecione um agendamento.");
    const destination = appointmentPatients.find((item) => item.id === selectedAppointmentPatientId);
    if (!destination) return toast.error("Selecione o paciente destino.");
    const cleanPhone = normalizePhoneBR(destination.phone);
    if (!cleanPhone) return toast.error(`Paciente sem telefone valido: ${destination.name}`);
    if (!appointmentMessage.trim()) return toast.error("Mensagem obrigatoria.");
    window.open(buildWhatsAppUrl(cleanPhone, appointmentMessage), "_blank");
    await createWhatsAppMessage({
      patientId: destination.id,
      patientName: destination.name,
      responsibleName: "",
      phone: cleanPhone,
      message: appointmentMessage,
      messageType: appointmentMessageType,
      status: "sent",
      user: user ? { id: user.id, name: user.name } : null,
      appointmentId: selectedAppointment.id,
    });
    toast.success("Mensagem do agendamento registrada no historico.");
    setComposeOpen(false);
    await load();
  };

  const saveEdit = async () => {
    if (!editing) return;
    await updateWhatsAppMessage(editing.id, editing, user ? { id: user.id, name: user.name } : null);
    toast.success("Mensagem atualizada e auditada.");
    setEditing(null);
    await load();
  };

  const resend = async (row: WhatsAppHistoryMessage) => {
    await resendWhatsAppMessage(row, user ? { id: user.id, name: user.name } : null);
    toast.success("WhatsApp reaberto e reenvio auditado.");
    await load();
  };
  const remove = async (row: WhatsAppHistoryMessage) => {
    await softDeleteWhatsAppMessage(row, user ? { id: user.id, name: user.name } : null);
    toast.success("Mensagem excluida logicamente.");
    await load();
  };
  const restore = async (row: WhatsAppHistoryMessage) => {
    await restoreWhatsAppMessage(row, user ? { id: user.id, name: user.name } : null);
    toast.success("Mensagem restaurada.");
    await load();
  };

  const totals = useMemo(() => {
    const sent = messages.filter((item) => item.status === "sent").length;
    const failed = messages.filter((item) => item.status === "failed").length;
    const deleted = messages.filter((item) => item.deleted_at).length;
    return { sent, failed, deleted, total: messages.length };
  }, [messages]);

  return (
    <div className="space-y-6 px-2 sm:px-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Historico de WhatsApp</h1>
          <p className="text-sm text-slate-600">Mensagens enviadas, tentativas, respostas e auditoria operacional.</p>
        </div>
        <Button onClick={() => setComposeOpen(true)}>
          <Send className="mr-2 h-4 w-4" />
          Nova mensagem
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Summary title="Total" value={totals.total} />
        <Summary title="Enviadas" value={totals.sent} />
        <Summary title="Falhas" value={totals.failed} />
        <Summary title="Excluidas" value={totals.deleted} />
      </div>

      {legacyStats.total > 0 && messages.length === 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-amber-800">Encontrei {legacyStats.total} registro(s) antigos de WhatsApp neste navegador.</div>
            <Button variant="outline" onClick={restoreFromLegacyStorage}>Restaurar historico antigo</Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="h-4 w-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
          <Input placeholder="Paciente" value={patient} onChange={(e) => setPatient(e.target.value)} />
          <Input placeholder="Telefone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{statusOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{typeOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          <Button variant={includeDeleted ? "default" : "outline"} onClick={() => setIncludeDeleted((value) => !value)}>Excluidas</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mensagens</CardTitle>
          <CardDescription>{loading ? "Carregando..." : `${messages.length} registro(s)`}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[1320px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Responsavel</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Mensagem</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data e hora</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Tentativas</TableHead>
                  <TableHead className="text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {messages.map((row) => (
                  <TableRow key={row.id} className={row.deleted_at ? "opacity-60" : ""}>
                    <TableCell className="font-medium">{row.patient_name}</TableCell>
                    <TableCell>{row.responsible_name || "-"}</TableCell>
                    <TableCell>{row.phone}</TableCell>
                    <TableCell className="max-w-sm truncate">{row.message}</TableCell>
                    <TableCell>{typeOptions.find((item) => item.value === row.message_type)?.label || row.message_type}</TableCell>
                    <TableCell><Badge variant={row.status === "failed" ? "destructive" : row.deleted_at ? "secondary" : "default"}>{row.status}</Badge></TableCell>
                    <TableCell>{formatDateTimeBR(row.created_at)}</TableCell>
                    <TableCell>{row.user_name || "-"}</TableCell>
                    <TableCell>{row.attempts}</TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setSelected(row)}><Eye className="h-4 w-4" /></Button>
                        <Button variant="outline" size="sm" onClick={() => setEditing(row)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="outline" size="sm" onClick={() => resend(row)}><RotateCw className="h-4 w-4" /></Button>
                        {row.deleted_at ? (
                          <Button variant="outline" size="sm" onClick={() => restore(row)}><Undo2 className="h-4 w-4" /></Button>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => remove(row)}><Trash2 className="h-4 w-4" /></Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!messages.length && (
                  <TableRow>
                    <TableCell colSpan={10} className="py-10 text-center text-slate-500">Nenhuma mensagem encontrada.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da mensagem</DialogTitle>
            <DialogDescription>{selected?.patient_name}</DialogDescription>
          </DialogHeader>
          <Textarea readOnly className="min-h-32" value={selected?.message || ""} />
          <pre className="max-h-48 overflow-auto rounded bg-slate-950 p-3 text-xs text-white">
            {JSON.stringify(selected?.api_response || {}, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar mensagem</DialogTitle>
            <DialogDescription>Toda edicao gera auditoria.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Paciente" value={editing?.patient_name || ""} onChange={(v) => setEditing((row) => row ? { ...row, patient_name: v } : row)} />
            <Field label="Responsavel" value={editing?.responsible_name || ""} onChange={(v) => setEditing((row) => row ? { ...row, responsible_name: v } : row)} />
            <Field label="Telefone" value={editing?.phone || ""} onChange={(v) => setEditing((row) => row ? { ...row, phone: v } : row)} />
          </div>
          <div className="space-y-2">
            <Label>Mensagem</Label>
            <Textarea className="min-h-32" value={editing?.message || ""} onChange={(e) => setEditing((row) => row ? { ...row, message: e.target.value } : row)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={saveEdit}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>Enviar WhatsApp</DialogTitle>
            <DialogDescription>Escolha um agendamento ou envie uma mensagem manual.</DialogDescription>
          </DialogHeader>

          <Tabs value={composeTab} onValueChange={(value) => setComposeTab(value as "appointment" | "manual")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="appointment">Com agendamento</TabsTrigger>
              <TabsTrigger value="manual">Sem agendamento</TabsTrigger>
            </TabsList>

            <TabsContent value="appointment" className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
              <div className="space-y-3">
                <div className="grid gap-2 md:grid-cols-[1fr_180px]">
                  <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  <Input placeholder="Buscar paciente, medico, data ou servico..." value={appointmentSearch} onChange={(event) => setAppointmentSearch(event.target.value)} />
                  </div>
                  <Select value={appointmentDateFilter || "all"} onValueChange={(value) => setAppointmentDateFilter(value === "all" ? "" : value)}>
                    <SelectTrigger><SelectValue placeholder="Dia" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os dias</SelectItem>
                      {appointmentDates.map((date) => (
                        <SelectItem key={date} value={date}>{formatDateBR(date)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="max-h-[380px] overflow-auto rounded-md border">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Hora</TableHead>
                        <TableHead>Paciente</TableHead>
                        <TableHead>Medico/Servico</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedAppointments.map((appointment) => {
                        const patientNames = (appointment.patient_ids?.length ? appointment.patient_ids : [appointment.patient_id]).map((id) => patientById.get(id)?.name || "Paciente").join(", ");
                        const doctorNames = (appointment.doctor_ids?.length ? appointment.doctor_ids : [appointment.doctor_id]).map((id) => doctorById.get(id)?.name || "Medico").join(", ");
                        return (
                          <TableRow key={appointment.id} className={selectedAppointmentId === appointment.id ? "cursor-pointer bg-primary/10" : "cursor-pointer"} onClick={() => setSelectedAppointmentId(appointment.id)}>
                            <TableCell>{formatDateBR(appointment.date)}</TableCell>
                            <TableCell>{normalizeTime(appointment.time)}</TableCell>
                            <TableCell className="font-medium">{patientNames}</TableCell>
                            <TableCell>{doctorNames} - {appointment.type}</TableCell>
                            <TableCell><Badge variant="secondary">{appointment.status}</Badge></TableCell>
                          </TableRow>
                        );
                      })}
                      {!pagedAppointments.length && (
                        <TableRow><TableCell colSpan={5} className="py-8 text-center text-slate-500">Nenhum agendamento encontrado.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Button variant="outline" size="sm" disabled={appointmentPage <= 1} onClick={() => setAppointmentPage((page) => Math.max(1, page - 1))}>Anterior</Button>
                  <span className="text-xs text-slate-500">Pagina {appointmentPage} de {appointmentTotalPages}</span>
                  <Button variant="outline" size="sm" disabled={appointmentPage >= appointmentTotalPages} onClick={() => setAppointmentPage((page) => Math.min(appointmentTotalPages, page + 1))}>Proxima</Button>
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Mensagem</CardTitle>
                  <CardDescription>Selecione paciente e ajuste o texto antes de enviar.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label>Paciente destino</Label>
                    <Select value={selectedAppointmentPatientId} onValueChange={setSelectedAppointmentPatientId} disabled={!selectedAppointment}>
                      <SelectTrigger><SelectValue placeholder="Selecione o paciente" /></SelectTrigger>
                      <SelectContent>
                        {appointmentPatients.map((item) => (
                          <SelectItem key={item.id} value={item.id}>{item.name} - {normalizePhoneBR(item.phone) || "sem telefone"}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(appointmentTemplateLabels) as WhatsAppMessageType[]).map((item) => (
                      <Button key={item} size="sm" variant={appointmentMessageType === item ? "default" : "outline"} onClick={() => setAppointmentMessageType(item)}>
                        {appointmentTemplateLabels[item]}
                      </Button>
                    ))}
                  </div>
                  <Textarea className="min-h-[190px]" value={appointmentMessage} onChange={(event) => setAppointmentMessage(event.target.value)} />
                  <Button onClick={sendWithAppointment}><Send className="mr-2 h-4 w-4" />Enviar WhatsApp</Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="manual" className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Paciente</Label>
                  <Select value={manualPatientId} onValueChange={setManualPatientId}>
                    <SelectTrigger><SelectValue placeholder="Selecione ou use contato manual" /></SelectTrigger>
                    <SelectContent>{patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Field label="Telefone" value={manualPhone} onChange={setManualPhone} />
                <div className="space-y-2 md:col-span-2">
                  <Label>Tipo</Label>
                  <Select value={manualType} onValueChange={(v) => setManualType(v as WhatsAppMessageType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{typeOptions.filter((item) => item.value !== "all").map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <Textarea className="min-h-32" value={manualMessage} onChange={(e) => setManualMessage(e.target.value)} placeholder="Mensagem..." />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setComposeOpen(false)}>Cancelar</Button>
                <Button onClick={sendManual}>Enviar</Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Summary({ title, value }: { title: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent className="text-2xl font-bold">{value}</CardContent>
    </Card>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
