"use client";

import React, { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { toast } from "sonner";
import { formatDateBR, formatDateTimeBR } from "@/utils/date";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableCell, TableHead } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Send, Trash2, CalendarDays, Users, MessageCircle, User, Filter } from "lucide-react";

type TemplateType = "confirm" | "reminder" | "cancel" | "reschedule";
type HistoryItem = {
  id: string;
  patient: string;
  phone: string;
  appointmentDate?: string;
  message: string;
  date: string;
};

const templateLabel: Record<TemplateType, string> = {
  confirm: "Confirmação",
  reminder: "Lembrete",
  cancel: "Cancelamento",
  reschedule: "Reagendamento",
};

const normalizeTime = (value?: string | null) => {
  if (!value) return "00:00";
  const m = String(value).trim().match(/(\d{1,2}):(\d{2})/);
  if (!m) return "00:00";
  return `${m[1].padStart(2, "0")}:${m[2]}`;
};

const normalizePhoneBR = (raw?: string | null) => {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55")) return digits.length >= 12 ? digits : "";
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return "";
};

const joinNames = (names: string[]) => {
  if (names.length <= 1) return names[0] || "";
  if (names.length === 2) return `${names[0]} e ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
};

const toDateTimeMs = (date?: string, time?: string) => {
  if (!date) return 0;
  return new Date(`${date}T${normalizeTime(time)}:00`).getTime();
};

const toStatusLabel = (status?: string) => {
  const v = String(status || "").toLowerCase();
  if (v === "confirmado") return "Confirmado";
  if (v === "cancelado") return "Cancelado";
  if (v === "realizado") return "Realizado";
  return "Agendado";
};

const toStatusVariant = (status?: string): "default" | "secondary" | "destructive" | "outline" => {
  const v = String(status || "").toLowerCase();
  if (v === "confirmado") return "default";
  if (v === "cancelado") return "destructive";
  if (v === "realizado") return "outline";
  return "secondary";
};

export function WhatsAppModule() {
  const { appointments, patients, doctors } = useApp();

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"with" | "free">("with");
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string>("");
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [selectedPatients, setSelectedPatients] = useState<string[]>([]);
  const [template, setTemplate] = useState<TemplateType>("confirm");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [appointmentsPage, setAppointmentsPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const PAGE_SIZE = 40;

  const patientById = useMemo(
    () => new Map(patients.map((p) => [p.id, p] as const)),
    [patients]
  );
  const doctorById = useMemo(
    () => new Map(doctors.map((d) => [d.id, d] as const)),
    [doctors]
  );

  useEffect(() => {
    const saved = localStorage.getItem("whatsapp-history");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      setHistory(Array.isArray(parsed) ? parsed : []);
    } catch {
      setHistory([]);
    }
  }, []);

  const persistHistory = (updater: (prev: HistoryItem[]) => HistoryItem[]) => {
    setHistory((prev) => {
      const next = updater(prev).slice(0, 300);
      localStorage.setItem("whatsapp-history", JSON.stringify(next));
      return next;
    });
  };

  const activeAppointments = useMemo(() => {
    const now = Date.now();
    const q = deferredSearch.trim().toLowerCase();

    return [...appointments]
      .filter((apt) => {
        if (String(apt.status || "").toLowerCase() === "cancelado") return false;
        return toDateTimeMs(apt.date, apt.time) >= now;
      })
      .sort((a, b) => toDateTimeMs(a.date, a.time) - toDateTimeMs(b.date, b.time))
      .filter((apt) => {
        if (!q) return true;
        const patientIds = apt.patient_ids?.length ? apt.patient_ids : [apt.patient_id];
        const doctorIds = apt.doctor_ids?.length ? apt.doctor_ids : [apt.doctor_id];
        const patientNames = patientIds
          .map((id) => patientById.get(id)?.name || "")
          .join(" ")
          .toLowerCase();
        const doctorNames = doctorIds
          .map((id) => doctorById.get(id)?.name || "")
          .join(" ")
          .toLowerCase();
        const dateText = `${apt.date} ${normalizeTime(apt.time)}`.toLowerCase();
        const serviceText = String(apt.type || "").toLowerCase();
        return (
          patientNames.includes(q) ||
          doctorNames.includes(q) ||
          dateText.includes(q) ||
          serviceText.includes(q)
        );
      });
  }, [appointments, deferredSearch, patientById, doctorById]);

  const appointmentsTotalPages = Math.max(1, Math.ceil(activeAppointments.length / PAGE_SIZE));
  const pagedAppointments = useMemo(() => {
    const start = (appointmentsPage - 1) * PAGE_SIZE;
    return activeAppointments.slice(start, start + PAGE_SIZE);
  }, [activeAppointments, appointmentsPage]);

  const historyTotalPages = Math.max(1, Math.ceil(history.length / PAGE_SIZE));
  const pagedHistory = useMemo(() => {
    const start = (historyPage - 1) * PAGE_SIZE;
    return history.slice(start, start + PAGE_SIZE);
  }, [history, historyPage]);

  useEffect(() => {
    setAppointmentsPage(1);
  }, [deferredSearch, activeAppointments.length]);

  useEffect(() => {
    if (appointmentsPage > appointmentsTotalPages) setAppointmentsPage(appointmentsTotalPages);
  }, [appointmentsPage, appointmentsTotalPages]);

  useEffect(() => {
    if (historyPage > historyTotalPages) setHistoryPage(historyTotalPages);
  }, [historyPage, historyTotalPages]);

  const selectedAppointment = useMemo(
    () => activeAppointments.find((apt) => apt.id === selectedAppointmentId) || null,
    [activeAppointments, selectedAppointmentId]
  );

  const appointmentPatients = useMemo(() => {
    if (!selectedAppointment) return [];
    const ids = selectedAppointment.patient_ids?.length
      ? selectedAppointment.patient_ids
      : [selectedAppointment.patient_id];
    return ids
      .map((id) => patientById.get(id))
      .filter(Boolean) as Array<{ id: string; name: string; phone?: string }>;
  }, [selectedAppointment, patientById]);

  const appointmentDoctors = useMemo(() => {
    if (!selectedAppointment) return [];
    const ids = selectedAppointment.doctor_ids?.length
      ? selectedAppointment.doctor_ids
      : [selectedAppointment.doctor_id];
    return ids
      .map((id) => doctorById.get(id))
      .filter(Boolean) as Array<{ id: string; name: string }>;
  }, [selectedAppointment, doctorById]);

  useEffect(() => {
    if (!selectedAppointment) {
      setSelectedPatientId("");
      return;
    }
    const exists = appointmentPatients.some((p) => p.id === selectedPatientId);
    if (!exists) {
      setSelectedPatientId(appointmentPatients[0]?.id || "");
    }
  }, [selectedAppointment, appointmentPatients, selectedPatientId]);

  const buildAppointmentMessage = (
    patientName: string,
    doctorsText: string,
    apt: any,
    type: TemplateType
  ) => {
    const serviceLabel = apt.type ? `com ${apt.type}` : "com atendimento";
    const dateLabel = formatDateBR(apt.date);
    const timeLabel = normalizeTime(apt.time);
    const base = `Olá, bom dia, tudo bem?\n${patientName} você tem atendimento agendado para o dia ${dateLabel}, às ${timeLabel}, ${serviceLabel} (${doctorsText}).`;

    if (type === "confirm") return `${base}\nPosso confirmar a presença hoje?`;
    if (type === "reminder") return `${base}\nEsse é um lembrete do seu atendimento.\nPosso confirmar a presença hoje?`;
    if (type === "cancel") {
      return `Olá, bom dia, tudo bem?\n${patientName} seu atendimento agendado para o dia ${dateLabel}, às ${timeLabel}, ${serviceLabel} (${doctorsText}) foi cancelado.`;
    }
    return `Olá, bom dia, tudo bem?\n${patientName} seu atendimento foi reagendado para o dia ${dateLabel}, às ${timeLabel}, ${serviceLabel} (${doctorsText}).`;
  };

  useEffect(() => {
    if (!selectedAppointment || !selectedPatientId) return;
    const patient = appointmentPatients.find((p) => p.id === selectedPatientId);
    if (!patient) return;
    const doctorsText = joinNames(appointmentDoctors.map((d) => d.name));
    setMessage(buildAppointmentMessage(patient.name, doctorsText, selectedAppointment, template));
  }, [selectedAppointment, selectedPatientId, appointmentPatients, appointmentDoctors, template]);

  const sendWithAppointment = () => {
    if (!selectedAppointment) {
      toast.error("Selecione um agendamento.");
      return;
    }

    const now = Date.now();
    if (toDateTimeMs(selectedAppointment.date, selectedAppointment.time) < now) {
      toast.error("Este agendamento já passou. Selecione um agendamento futuro.");
      return;
    }

    const patient = appointmentPatients.find((p) => p.id === selectedPatientId);
    if (!patient) {
      toast.error("Paciente não encontrado para este agendamento.");
      return;
    }

    const phone = normalizePhoneBR(patient.phone);
    if (!phone) {
      toast.error(`Paciente sem telefone válido: ${patient.name}`);
      return;
    }

    const safeMessage = message.trim();
    if (!safeMessage) {
      toast.error("Mensagem vazia.");
      return;
    }

    window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(safeMessage)}`, "_blank");

    persistHistory((prev) => [
      {
        id: crypto.randomUUID(),
        patient: patient.name,
        phone,
        appointmentDate: `${selectedAppointment.date} ${normalizeTime(selectedAppointment.time)}`,
        message: safeMessage,
        date: new Date().toISOString(),
      },
      ...prev,
    ]);

    toast.success("WhatsApp aberto para envio.");
    setOpen(false);
  };

  const sendFree = () => {
    if (!selectedPatients.length) {
      toast.error("Selecione ao menos 1 paciente.");
      return;
    }

    const safeMessage = message.trim();
    if (!safeMessage) {
      toast.error("Digite a mensagem.");
      return;
    }

    let sent = 0;
    const historyRows: HistoryItem[] = [];

    const run = async () => {
      for (const pid of selectedPatients) {
        const patient = patientById.get(pid);
        const phone = normalizePhoneBR(patient?.phone);
        if (!patient || !phone) continue;

        window.open(
          `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(safeMessage)}`,
          "_blank"
        );
        sent += 1;
        historyRows.push({
          id: crypto.randomUUID(),
          patient: patient.name,
          phone,
          message: safeMessage,
          date: new Date().toISOString(),
        });
        await new Promise((resolve) => setTimeout(resolve, 180));
      }

      if (!sent) {
        toast.error("Nenhum paciente selecionado possui telefone válido.");
        return;
      }

      persistHistory((prev) => [...historyRows, ...prev]);
      toast.success(`${sent} mensagem(ns) enviada(s).`);
      setOpen(false);
      setMessage("");
      setSelectedPatients([]);
    };

    void run();
  };

  const patientsWithPhone = useMemo(
    () => patients.filter((p) => normalizePhoneBR(p.phone)).length,
    [patients]
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">WhatsApp Profissional</h1>
          <p className="text-sm text-muted-foreground">Envio preciso por agenda, paciente e telefone válido.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nova mensagem
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="border border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <Users className="mb-2 text-primary" />
            <div className="text-sm text-muted-foreground">Pacientes</div>
            <div className="text-2xl font-bold">{patients.length}</div>
          </CardContent>
        </Card>
        <Card className="border border-secondary bg-secondary/50">
          <CardContent className="p-4">
            <CalendarDays className="mb-2 text-secondary-foreground" />
            <div className="text-sm text-muted-foreground">Agendamentos ativos</div>
            <div className="text-2xl font-bold">{activeAppointments.length}</div>
          </CardContent>
        </Card>
        <Card className="border border-accent bg-accent/50">
          <CardContent className="p-4">
            <MessageCircle className="mb-2 text-accent-foreground" />
            <div className="text-sm text-muted-foreground">Mensagens</div>
            <div className="text-2xl font-bold">{history.length}</div>
          </CardContent>
        </Card>
        <Card className="border border-muted bg-muted/50">
          <CardContent className="p-4">
            <User className="mb-2 text-muted-foreground" />
            <div className="text-sm text-muted-foreground">Com WhatsApp válido</div>
            <div className="text-2xl font-bold">{patientsWithPhone}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico</CardTitle>
          <CardDescription>Últimos envios de WhatsApp</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data envio</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Data consulta</TableHead>
                <TableHead>Mensagem</TableHead>
                <TableHead>Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedHistory.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{formatDateTimeBR(row.date)}</TableCell>
                  <TableCell>{row.patient}</TableCell>
                  <TableCell>{row.phone}</TableCell>
                  <TableCell>{row.appointmentDate || "-"}</TableCell>
                  <TableCell className="max-w-md truncate">{row.message}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => persistHistory((prev) => prev.filter((x) => x.id !== row.id))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-3 flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={historyPage <= 1}
              onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <span className="text-xs text-muted-foreground">
              Página {historyPage} de {historyTotalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={historyPage >= historyTotalPages}
              onClick={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))}
            >
              Próxima
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>Enviar WhatsApp</DialogTitle>
          </DialogHeader>

          <Tabs value={tab} onValueChange={(v) => setTab(v as "with" | "free")}>
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="with">Com agendamento</TabsTrigger>
              <TabsTrigger value="free">Sem agendamento</TabsTrigger>
            </TabsList>

            <TabsContent value="with" className="grid grid-cols-1 gap-6 xl:grid-cols-[1.3fr_1fr]">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  <Input
                    placeholder="Buscar paciente, médico, data ou serviço..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <div className="max-h-[380px] overflow-auto rounded border">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Hora</TableHead>
                        <TableHead>Paciente(s)</TableHead>
                        <TableHead>Médico(s)</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedAppointments.map((apt) => {
                        const patientNames = (apt.patient_ids?.length ? apt.patient_ids : [apt.patient_id])
                          .map((id) => patientById.get(id)?.name || "Paciente")
                          .join(", ");
                        const doctorNames = (apt.doctor_ids?.length ? apt.doctor_ids : [apt.doctor_id])
                          .map((id) => doctorById.get(id)?.name || "Médico")
                          .join(", ");

                        return (
                          <TableRow
                            key={apt.id}
                            className={`cursor-pointer ${selectedAppointmentId === apt.id ? "bg-primary/10" : ""}`}
                            onClick={() => setSelectedAppointmentId(apt.id)}
                          >
                            <TableCell>{formatDateBR(apt.date)}</TableCell>
                            <TableCell>{normalizeTime(apt.time)}</TableCell>
                            <TableCell>{patientNames}</TableCell>
                            <TableCell>{doctorNames}</TableCell>
                            <TableCell>
                              <Badge variant={toStatusVariant(apt.status)}>{toStatusLabel(apt.status)}</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={appointmentsPage <= 1}
                    onClick={() => setAppointmentsPage((p) => Math.max(1, p - 1))}
                  >
                    Anterior
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Página {appointmentsPage} de {appointmentsTotalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={appointmentsPage >= appointmentsTotalPages}
                    onClick={() => setAppointmentsPage((p) => Math.min(appointmentsTotalPages, p + 1))}
                  >
                    Próxima
                  </Button>
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Mensagem</CardTitle>
                  <CardDescription>Selecione paciente e ajuste o texto antes de enviar.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    <Label>Paciente destino</Label>
                    <Select
                      value={selectedPatientId}
                      onValueChange={setSelectedPatientId}
                      disabled={!selectedAppointment}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o paciente" />
                      </SelectTrigger>
                      <SelectContent>
                        {appointmentPatients.map((p) => {
                          const phone = normalizePhoneBR(p.phone);
                          return (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name} {phone ? `• ${phone}` : "• sem telefone válido"}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(templateLabel) as TemplateType[]).map((t) => (
                      <Button
                        key={t}
                        size="sm"
                        variant={template === t ? "default" : "outline"}
                        onClick={() => setTemplate(t)}
                      >
                        {templateLabel[t]}
                      </Button>
                    ))}
                  </div>

                  <Textarea rows={9} value={message} onChange={(e) => setMessage(e.target.value)} />

                  <Button onClick={sendWithAppointment}>
                    <Send className="mr-2 h-4 w-4" /> Enviar WhatsApp
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="free">
              <Label>Pacientes</Label>
              <div className="max-h-52 overflow-auto rounded border p-2">
                {patients.map((p) => {
                  const phone = normalizePhoneBR(p.phone);
                  return (
                    <label key={p.id} className="flex items-center gap-2 py-1">
                      <input
                        type="checkbox"
                        checked={selectedPatients.includes(p.id)}
                        onChange={(e) =>
                          setSelectedPatients((prev) =>
                            e.target.checked ? [...prev, p.id] : prev.filter((x) => x !== p.id)
                          )
                        }
                      />
                      <span className={!phone ? "text-muted-foreground" : ""}>
                        {p.name} {phone ? `• ${phone}` : "• sem telefone válido"}
                      </span>
                    </label>
                  );
                })}
              </div>

              <Label className="mt-3 block">Mensagem</Label>
              <Textarea
                rows={6}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Digite a mensagem..."
              />

              <Button className="mt-3" onClick={sendFree}>
                <Send className="mr-2 h-4 w-4" /> Enviar mensagens
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
