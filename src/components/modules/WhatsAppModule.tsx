"use client";

import React, { useState, useEffect } from "react";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Tabs, TabsContent, TabsList, TabsTrigger
} from "@/components/ui/tabs";
import {
  MessageSquare, Send, Trash2, Users, Calendar, Clock, Settings, Plus, Eye, Edit
} from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface WhatsAppMessage {
  id: string;
  from_clinic: string;
  to_patient: string;
  patient_name: string;
  message: string;
  sent_at: string;
  status: "sent" | "delivered" | "read";
  appointment_id?: string;
}

export function WhatsAppModule() {
  const { user } = useAuth();
  const { appointments, patients, doctors } = useApp();
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [mode, setMode] = useState<"withAppointment" | "free">("withAppointment");
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [customMessage, setCustomMessage] = useState("");
  const [clinicPhone, setClinicPhone] = useState("98974003414");

  // Filtros
  const [filterDate, setFilterDate] = useState("");
  const [filterPatient, setFilterPatient] = useState("");
  const [filterDoctor, setFilterDoctor] = useState("");

  // VIEW / EDIT MESSAGE MODALS
  const [viewMessage, setViewMessage] = useState<WhatsAppMessage | null>(null);
  const [editMessage, setEditMessage] = useState<WhatsAppMessage | null>(null);
  const [editText, setEditText] = useState("");

  const [messageTemplates] = useState([
    "✅ Olá {nome}, sua consulta com {medico} está confirmada para {data} às {horario}. Clínica: {telefone_clinica}",
    "⏰ Olá {nome}, lembramos que você tem consulta amanhã com {medico} às {horario}. Clínica: {telefone_clinica}",
    "🔄 Olá {nome}, sua consulta foi reagendada para {data} às {horario}. Clínica: {telefone_clinica}",
    "⚠️ Olá {nome}, sua consulta de {data} foi cancelada. Entraremos em contato para reagendar. Clínica: {telefone_clinica}",
    "📞 Oi {nome}, somos da clínica! Estamos à disposição para dúvidas ou marcações. Clínica: {telefone_clinica}",
  ]);

  useEffect(() => {
    loadMessages();
    loadSettings();
  }, []);

  const loadMessages = () => {
    const saved = localStorage.getItem("whatsapp-messages");
    if (saved) setMessages(JSON.parse(saved));
  };

  const loadSettings = () => {
    const settings = localStorage.getItem("app-settings");
    if (settings) {
      const parsed = JSON.parse(settings);
      if (parsed.whatsapp_number) setClinicPhone(parsed.whatsapp_number);
    }
  };

  const saveSettings = () => {
    const settings = JSON.parse(localStorage.getItem("app-settings") || "{}");
    settings.whatsapp_number = clinicPhone;
    localStorage.setItem("app-settings", JSON.stringify(settings));
    toast.success("Configurações salvas!");
  };

  const sendWhatsAppMessage = async (
    patientPhone: string,
    patientName: string,
    message: string,
    appointmentId?: string
  ) => {
    try {
      const cleanPhone = patientPhone.replace(/\D/g, "");
      if (!cleanPhone) {
        toast.error("Telefone inválido");
        return false;
      }

      const whatsappUrl = `https://api.whatsapp.com/send?phone=55${cleanPhone}&text=${encodeURIComponent(
        message
      )}`;
      window.open(whatsappUrl, "_blank");

      const newMessage: WhatsAppMessage = {
        id: Date.now().toString(),
        from_clinic: clinicPhone,
        to_patient: cleanPhone,
        patient_name: patientName,
        message,
        sent_at: new Date().toISOString(),
        status: "sent",
        appointment_id: appointmentId,
      };

      const updated = [newMessage, ...messages];
      setMessages(updated);
      localStorage.setItem("whatsapp-messages", JSON.stringify(updated));

      toast.success("Mensagem enviada!");
      return true;
    } catch {
      toast.error("Erro ao enviar mensagem");
      return false;
    }
  };

  const handleSend = async () => {
    let patient: any = null;
    let appointment: any = null;

    if (mode === "withAppointment" && selectedAppointmentId) {
      appointment = appointments.find((a) => a.id === selectedAppointmentId);
      patient = patients.find((p) => p.id === appointment.patient_id);
    } else {
      patient = patients.find((p) => p.id === selectedPatientId);
    }

    if (!patient || !customMessage.trim()) return;

    const doctor = appointment ? doctors.find((d) => d.id === appointment.doctor_id) : null;

    const msg = customMessage
      .replace("{nome}", patient.name)
      .replace("{medico}", doctor?.name || "Médico não informado")
      .replace("{telefone_clinica}", clinicPhone)
      .replace("{data}", appointment ? appointment.date : "")
      .replace("{horario}", appointment ? appointment.time : "");

    await sendWhatsAppMessage(patient.phone, patient.name, msg, appointment?.id);
  };

  const deleteMessage = (id: string) => {
    if (!confirm("Excluir mensagem?")) return;
    const updated = messages.filter((m) => m.id !== id);
    setMessages(updated);
    localStorage.setItem("whatsapp-messages", JSON.stringify(updated));
  };

  // SAVE EDITED
  const saveEditedMessage = () => {
    if (!editMessage) return;

    const updated = messages.map((m) =>
      m.id === editMessage.id ? { ...m, message: editText } : m
    );

    setMessages(updated);
    localStorage.setItem("whatsapp-messages", JSON.stringify(updated));
    toast.success("Mensagem editada!");
    setEditMessage(null);
  };

  const filteredAppointments = appointments.filter((apt) => {
    const matchDate = filterDate ? apt.date.startsWith(filterDate) : true;
    const matchPatient = filterPatient ? apt.patient_id === filterPatient : true;
    const matchDoctor = filterDoctor ? apt.doctor_id === filterDoctor : true;
    return matchDate && matchPatient && matchDoctor && apt.status !== "cancelado";
  });

  return (
    <div className="space-y-6 px-2 md:px-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">📱 WhatsApp Profissional</h1>
          <p className="text-gray-600 mt-2">
            Envio profissional de mensagens automáticas e personalizadas
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-green-600 hover:bg-green-700">
                <Plus className="mr-2 h-4 w-4" /> Nova Mensagem
              </Button>
            </DialogTrigger>

            <DialogContent className="max-w-5xl w-[95vw]">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold">📱 Enviar WhatsApp</DialogTitle>
                <DialogDescription>
                  Escolha um agendamento ou paciente e selecione a mensagem
                </DialogDescription>
              </DialogHeader>

              {/* TABS */}
              <Tabs defaultValue="withAppointment" onValueChange={(v) => setMode(v as any)}>
                <TabsList className="mb-4 flex flex-wrap">
                  <TabsTrigger value="withAppointment">📅 Com Agendamento</TabsTrigger>
                  <TabsTrigger value="free">👤 Sem Agendamento</TabsTrigger>
                </TabsList>

                {/* GRID RESPONSIVA */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* ESQUERDA */}
                  <div className="space-y-4">
                    {mode === "withAppointment" ? (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
                          <select
                            className="border p-2 rounded"
                            value={filterPatient}
                            onChange={(e) => setFilterPatient(e.target.value)}
                          >
                            <option value="">Todos Pacientes</option>
                            {patients.map((p) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                          <select
                            className="border p-2 rounded"
                            value={filterDoctor}
                            onChange={(e) => setFilterDoctor(e.target.value)}
                          >
                            <option value="">Todos Médicos</option>
                            {doctors.map((d) => (
                              <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="max-h-60 overflow-y-auto border rounded-lg divide-y">
                          {filteredAppointments.map((apt) => {
                            const patient = patients.find((p) => p.id === apt.patient_id);
                            const doctor = doctors.find((d) => d.id === apt.doctor_id);
                            return (
                              <div
                                key={apt.id}
                                onClick={() => setSelectedAppointmentId(apt.id)}
                                className={`p-3 cursor-pointer transition ${
                                  selectedAppointmentId === apt.id
                                    ? "bg-blue-100 border-l-4 border-blue-600"
                                    : "hover:bg-gray-50"
                                }`}
                              >
                                <div className="font-semibold">{patient?.name}</div>
                                <div className="text-sm text-gray-600">
                                  🩺 {doctor?.name} — {apt.date} ⏰ {apt.time}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <div className="space-y-2">
                        <Label>👥 Paciente</Label>
                        <select
                          className="border p-2 w-full rounded"
                          value={selectedPatientId || ""}
                          onChange={(e) => setSelectedPatientId(e.target.value)}
                        >
                          <option value="">Selecione</option>
                          {patients.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} — {p.phone || "Sem telefone"}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* DIREITA */}
                  <div className="space-y-4">
                    <Label>📝 Templates</Label>
                    <div className="grid gap-2">
                      {messageTemplates.map((t, i) => (
                        <Card
                          key={i}
                          className={`p-3 cursor-pointer transition ${
                            customMessage === t ? "border-blue-600 bg-blue-50" : "hover:bg-gray-50"
                          }`}
                          onClick={() => setCustomMessage(t)}
                        >
                          <p className="text-sm">{t}</p>
                        </Card>
                      ))}
                    </div>
                  </div>
                </div>

                {/* MENSAGEM PERSONALIZADA */}
                <div className="mt-6 space-y-3">
                  <Label>✍️ Mensagem Personalizada</Label>
                  <Textarea
                    rows={4}
                    placeholder="Digite ou selecione um template..."
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                  />
                </div>

                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                  <Button className="bg-green-600 hover:bg-green-700" onClick={handleSend}>
                    <Send className="mr-2 h-4 w-4" /> Enviar
                  </Button>
                </div>
              </Tabs>
            </DialogContent>
          </Dialog>

          <Button variant="outline" onClick={() => setMessages([])}>
            <Trash2 className="mr-2 h-4 w-4" /> Limpar Histórico
          </Button>
        </div>
      </div>

      {/* ========================== HISTÓRICO ========================== */}
      <Tabs defaultValue="history">
        <TabsList>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>📜 Histórico de Mensagens</CardTitle>
            </CardHeader>

            <CardContent>
              <div className="overflow-x-auto">
                <Table className="min-w-max">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Paciente</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Mensagem</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {messages.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>{new Date(m.sent_at).toLocaleString("pt-BR")}</TableCell>
                        <TableCell>{m.patient_name}</TableCell>
                        <TableCell>{m.to_patient}</TableCell>
                        <TableCell>{m.message.substring(0, 50)}...</TableCell>
                        <TableCell className="flex gap-2">

                          {/* VIEW BUTTON */}
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setViewMessage(m)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>

                          {/* EDIT BUTTON */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditMessage(m);
                              setEditText(m.message);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>

                          {/* DELETE */}
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteMessage(m.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>

                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {messages.length === 0 && (
                <p className="text-center py-4 text-gray-500">📭 Nenhuma mensagem</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ======================== VIEW MODAL ======================== */}
      <Dialog open={!!viewMessage} onOpenChange={() => setViewMessage(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>📩 Visualizar Mensagem</DialogTitle>
          </DialogHeader>

          <p className="text-sm whitespace-pre-wrap">{viewMessage?.message}</p>

          <div className="text-right">
            <Button onClick={() => setViewMessage(null)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ======================== EDIT MODAL ======================== */}
      <Dialog open={!!editMessage} onOpenChange={() => setEditMessage(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>✏️ Editar Mensagem</DialogTitle>
          </DialogHeader>

          <Textarea
            rows={6}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
          />

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setEditMessage(null)}>Cancelar</Button>
            <Button className="bg-blue-600 text-white" onClick={saveEditedMessage}>
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
