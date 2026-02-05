"use client";

/* ======================================================================
   WhatsAppModule.tsx — FINAL UNIFICADO (DASHBOARD + ENVIO)
======================================================================== */

import React, { useEffect, useMemo, useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { toast } from "sonner";
import { formatDateBR, formatDateTimeBR } from "@/utils/date";

/* UI */
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableHead,
} from "@/components/ui/table";

/* Icons */
import {
  Plus,
  Send,
  Trash2,
  CalendarDays,
  Users,
  MessageCircle,
  User,
  Filter,
} from "lucide-react";

/* ======================================================================
   HELPERS
======================================================================== */
const normalizePhone = (v: string) => v.replace(/\D/g, "");
const ensureBR = (v: string) => (v.startsWith("55") ? v : `55${v}`);

const joinNames = (names: string[]) => {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} e ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
};

/* ======================================================================
   TEMPLATES
======================================================================== */
type TemplateType = "confirm" | "reminder" | "cancel" | "reschedule";

const templateLabel: Record<TemplateType, string> = {
  confirm: "Confirmação",
  reminder: "Lembrete",
  cancel: "Cancelamento",
  reschedule: "Reagendamento",
};

/* ======================================================================
   COMPONENT
======================================================================== */
export function WhatsAppModule() {
  const { appointments, patients, doctors } = useApp();

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"with" | "free">("with");

  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [selectedPatientIndex, setSelectedPatientIndex] = useState<0 | 1>(0);
  const [selectedPatients, setSelectedPatients] = useState<string[]>([]);
  const [template, setTemplate] = useState<TemplateType>("confirm");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const [history, setHistory] = useState<any[]>([]);

  /* ======================================================
     HISTÓRICO
====================================================== */
  useEffect(() => {
    const saved = localStorage.getItem("whatsapp-history");
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  const persist = (data: any[]) => {
    setHistory(data);
    localStorage.setItem("whatsapp-history", JSON.stringify(data));
  };

  /* ======================================================
     AGENDAMENTOS ORDENADOS
====================================================== */
  const orderedAppointments = useMemo(() => {
    return [...appointments]
      .sort(
        (a, b) =>
          new Date(`${a.date}T${a.time}`).getTime() -
          new Date(`${b.date}T${b.time}`).getTime()
      )
      .filter((a) => {
        const pats = patients.filter(
          (p) => a.patient_ids?.includes(p.id) || p.id === a.patient_id
        );

        return (
          !search ||
          pats.some((p) =>
            p.name.toLowerCase().includes(search.toLowerCase())
          ) ||
          a.date.includes(search)
        );
      });
  }, [appointments, patients, search]);

  /* ======================================================
     GERADOR DE MENSAGEM (AGENDAMENTO)
====================================================== */
  const buildAppointmentMessage = (
    patientName: string,
    others: string[],
    doctorsText: string,
    apt: any,
    type: TemplateType
  ) => {
    if (type === "confirm") {
      const serviceLabel = apt.type ? `com ${apt.type}` : "com consulta";
      return `
Olá, bom dia, tudo bem?
${patientName} você tem consulta agendada para o dia ${formatDateBR(
        apt.date
      )}, às ${apt.time}, ${serviceLabel} (${doctorsText}).
Posso confirmar a presença hoje?
`.trim();
    }

    const statusText: Record<TemplateType, string> = {
      confirm: "está confirmada",
      reminder: "está agendada",
      cancel: "foi cancelada",
      reschedule: "foi reagendada",
    };

    const together =
      others.length > 0
        ? `, que será realizada juntamente com ${joinNames(others)}`
        : "";

    return `
Olá ${patientName},

sua consulta${together} com ${doctorsText}
${statusText[type]} para:

Data: ${apt.date}
Horário: ${apt.time}

Qualquer dúvida estamos à disposição.
`.trim();
  };

  /* ======================================================
     AUTO-ATUALIZA TEXTO
====================================================== */
  useEffect(() => {
    if (!selectedAppointmentId) return;

    const apt = appointments.find((a) => a.id === selectedAppointmentId);
    if (!apt) return;

    const pats = patients.filter(
      (p) => apt.patient_ids?.includes(p.id) || p.id === apt.patient_id
    );

    const patient = pats[selectedPatientIndex];
    if (!patient) return;

    const otherPatients = pats
      .filter((_, idx) => idx !== selectedPatientIndex)
      .map((p) => p.name);

    const docs = doctors.filter(
      (d) => apt.doctor_ids?.includes(d.id) || d.id === apt.doctor_id
    );

    setMessage(
      buildAppointmentMessage(
        patient.name,
        otherPatients,
        joinNames(docs.map((d) => d.name)),
        apt,
        template
      )
    );
  }, [
    selectedAppointmentId,
    selectedPatientIndex,
    template,
    appointments,
    patients,
    doctors,
  ]);

  /* ======================================================
     ENVIO COM AGENDAMENTO
====================================================== */
  const sendWithAppointment = () => {
    if (!selectedAppointmentId) {
      toast.error("Selecione um agendamento");
      return;
    }

    const apt = appointments.find((a) => a.id === selectedAppointmentId);
    if (!apt) return;

    const pats = patients.filter(
      (p) => apt.patient_ids?.includes(p.id) || p.id === apt.patient_id
    );

    const patient = pats[selectedPatientIndex];
    if (!patient?.phone) {
      toast.error("Paciente sem telefone");
      return;
    }

    const phone = ensureBR(normalizePhone(patient.phone));

    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
      "_blank"
    );

    persist([
      {
        id: crypto.randomUUID(),
        patient: patient.name,
        message,
        date: new Date().toISOString(),
      },
      ...history,
    ]);

    toast.success("Mensagem enviada");
    setOpen(false);
  };

  /* ======================================================
     ENVIO SEM AGENDAMENTO
====================================================== */
  const sendFree = () => {
    if (!selectedPatients.length) {
      toast.error("Selecione ao menos um paciente");
      return;
    }

    if (!message.trim()) {
      toast.error("Digite a mensagem");
      return;
    }

    selectedPatients.forEach((pid) => {
      const p = patients.find((x) => x.id === pid);
      if (!p?.phone) return;

      const phone = ensureBR(normalizePhone(p.phone));

      window.open(
        `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
        "_blank"
      );

      persist([
        {
          id: crypto.randomUUID(),
          patient: p.name,
          message,
          date: new Date().toISOString(),
        },
        ...history,
      ]);
    });

    toast.success("Mensagens enviadas");
    setOpen(false);
    setMessage("");
    setSelectedPatients([]);
  };

  /* ======================================================================
     RENDER
======================================================================== */
  const patientsWithPhone = patients.filter((p) => p.phone).length;

  return (
    <div className="p-6 space-y-6">

      {/* HEADER */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">WhatsApp Profissional</h1>
          <p className="text-sm text-muted-foreground">
            Envio inteligente de mensagens
          </p>
        </div>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nova mensagem
        </Button>
      </div>

      {/* DASHBOARD */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <div className="text-sm text-muted-foreground">Agendamentos</div>
            <div className="text-2xl font-bold">{appointments.length}</div>
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
            <div className="text-sm text-muted-foreground">Com WhatsApp</div>
            <div className="text-2xl font-bold">{patientsWithPhone}</div>
          </CardContent>
        </Card>
      </div>

      {/* HISTÓRICO */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico</CardTitle>
          <CardDescription>Mensagens enviadas</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead>Mensagem</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>{formatDateTimeBR(m.date)}</TableCell>
                  <TableCell>{m.patient}</TableCell>
                  <TableCell className="truncate max-w-md">{m.message}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() =>
                        persist(history.filter((x) => x.id !== m.id))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* MODAL */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Enviar WhatsApp</DialogTitle>
          </DialogHeader>

          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="with">Com agendamento</TabsTrigger>
              <TabsTrigger value="free">Sem agendamento</TabsTrigger>
            </TabsList>

            {/* COM AGENDAMENTO */}
            <TabsContent value="with" className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex gap-2 items-center">
                  <Filter className="w-4 h-4" />
                  <Input
                    placeholder="Buscar paciente ou data..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <div className="border rounded max-h-[320px] overflow-y-auto">
                  {orderedAppointments.map((a) => {
                    const pats = patients.filter(
                      (p) =>
                        a.patient_ids?.includes(p.id) ||
                        p.id === a.patient_id
                    );

                    return (
                      <div
                        key={a.id}
                        onClick={() => setSelectedAppointmentId(a.id)}
                        className={`p-3 cursor-pointer border-b ${
                          selectedAppointmentId === a.id
                            ? "bg-primary/10"
                            : "hover:bg-muted"
                        }`}
                      >
                        <div className="font-medium">
                          {joinNames(pats.map((p) => p.name))}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {a.date} • {a.time}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Mensagem</CardTitle>
                  <CardDescription>
                    Escolha o paciente e edite o texto
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Button
                      variant={selectedPatientIndex === 0 ? "default" : "outline"}
                      onClick={() => setSelectedPatientIndex(0)}
                    >
                      <User className="mr-2 h-4 w-4" /> Paciente 1
                    </Button>
                    <Button
                      variant={selectedPatientIndex === 1 ? "default" : "outline"}
                      onClick={() => setSelectedPatientIndex(1)}
                    >
                      <User className="mr-2 h-4 w-4" /> Paciente 2
                    </Button>
                  </div>

                  <div className="flex gap-2 flex-wrap">
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

                  <Textarea rows={8} value={message} onChange={(e) => setMessage(e.target.value)} />

                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={sendWithAppointment}>
                    <Send className="mr-2 h-4 w-4" /> Enviar WhatsApp
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* SEM AGENDAMENTO */}
            <TabsContent value="free">
              <Label>Pacientes</Label>
              <div className="border rounded p-2 max-h-48 overflow-y-auto">
                {patients.map((p) => (
                  <label key={p.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedPatients.includes(p.id)}
                      onChange={(e) =>
                        setSelectedPatients((prev) =>
                          e.target.checked
                            ? [...prev, p.id]
                            : prev.filter((x) => x !== p.id)
                        )
                      }
                    />
                    {p.name}
                  </label>
                ))}
              </div>

              <Label className="mt-3 block">Mensagem</Label>
              <Textarea
                rows={6}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Digite a mensagem..."
              />

              <Button className="mt-3 bg-primary text-primary-foreground hover:bg-primary/90" onClick={sendFree}>
                <Send className="mr-2 h-4 w-4" /> Enviar mensagens
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
