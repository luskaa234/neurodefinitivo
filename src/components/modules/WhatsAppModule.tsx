"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MessageSquare,
  Send,
  Trash2,
  Users,
  Calendar,
  Clock,
  Settings,
  Plus,
  Eye,
  Edit,
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

  // estados principais
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [mode, setMode] = useState<"withAppointment" | "free">("withAppointment");
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [customMessage, setCustomMessage] = useState("");
  const [clinicPhone, setClinicPhone] = useState("559870187749");


  // Permitir envio para número manual (qualquer telefone)
  const [useManualNumber, setUseManualNumber] = useState(false);
  const [manualNumber, setManualNumber] = useState("");
  const [manualName, setManualName] = useState("");

  // filtros locais (modal)
  const [filterDate, setFilterDate] = useState("");
  const [filterPatient, setFilterPatient] = useState("");
  const [filterDoctor, setFilterDoctor] = useState("");

  // filtro global (topo da página)
  const [globalSearch, setGlobalSearch] = useState("");

  // modal search (apenas para modal - opção 4 pedida: ambos)
  const [modalSearch, setModalSearch] = useState("");

  // view/edit modals
  const [viewMessage, setViewMessage] = useState<WhatsAppMessage | null>(null);
  const [editMessage, setEditMessage] = useState<WhatsAppMessage | null>(null);
  const [editText, setEditText] = useState("");

  const [messageTemplates] = useState([
    " Olá {nome}, sua consulta com {medico} está confirmada para {data} às {horario}. Clínica: +55 98 7018-7749",
    " Olá {nome}, lembramos que você tem consulta amanhã com {medico} às {horario}. Clínica: +55 98 7018-7749a",
    " Olá {nome}, sua consulta foi reagendada para {data} às {horario}. Clínica: +55 98 7018-7749a",
    " Olá {nome}, sua consulta de {data} foi cancelada. Entraremos em contato para reagendar. Clínica:{+55 98 7018-7749",
    " Oi {nome}, somos da clínica! Estamos à disposição para dúvidas ou marcações. Clínica: +55 98 7018-7749",
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

  // Utilitário: limpa tudo que não é número e normaliza
  const normalizePhone = (raw: string) => {
    const cleaned = (raw || "").replace(/\D/g, "");
    return cleaned;
  };

  // Detecta se o número já contém DDI ou prefixo internacional
  const ensureCountryCode = (cleanPhone: string) => {
    if (!cleanPhone) return "";
    // aceita números que já começam com + (tratados antes), mas aqui lidamos apenas com dígitos
    if (cleanPhone.startsWith("00")) return cleanPhone.slice(2);
    if (cleanPhone.startsWith("55")) return cleanPhone; // Brasil
    // se o usuário forneceu 11 ou 10 dígitos, assumimos Brasil e adicionamos 55
    if (cleanPhone.length === 10 || cleanPhone.length === 11) return `55${cleanPhone}`;
    // se o número possui mais de 11 dígitos e não começa com 55, mantemos como está (pode conter outro DDI)
    return cleanPhone;
  };

  // Função de envio (compatível com qualquer telefone) — agora suporta número manual
  const sendWhatsAppMessage = async (
    patientPhone: string,
    patientName: string,
    message: string,
    appointmentId?: string
  ) => {
    try {
      const rawPhone = patientPhone || "";
      const cleaned = normalizePhone(rawPhone);

      if (!cleaned) {
        toast.error(`❌ Telefone inválido para ${patientName || "destinatário"}`);
        return false;
      }

      let phoneForUrl = cleaned;

      // Se o número original começava com +, mantemos o DDI (já removemos não dígitos acima, então não veremos + aqui)
      // Normalizamos o DDI quando necessário
      phoneForUrl = ensureCountryCode(phoneForUrl);

      const whatsappUrl = `https://wa.me/${phoneForUrl}?text=${encodeURIComponent(message)}`;


      // Abre nova aba com o link do WhatsApp
      window.open(whatsappUrl, "_blank");

      const newMessage: WhatsAppMessage = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 6),
        from_clinic: clinicPhone,
        to_patient: phoneForUrl,
        patient_name: patientName,
        message,
        sent_at: new Date().toISOString(),
        status: "sent",
        appointment_id: appointmentId,
      };

      const updated = [newMessage, ...messages];
      setMessages(updated);
      localStorage.setItem("whatsapp-messages", JSON.stringify(updated));

      toast.success(`✅ WhatsApp aberto para ${patientName || phoneForUrl}`);
      return true;
    } catch (error) {
      console.error("Erro ao enviar WhatsApp:", error);
      toast.error("❌ Erro ao enviar WhatsApp");
      return false;
    }
  };

  const handleSend = async () => {
  // ===============================
  // ENVIO MANUAL
  // ===============================
  if (useManualNumber) {
    const cleaned = normalizePhone(manualNumber);
    if (!cleaned) return toast.error("❌ Digite um número de telefone válido");
    if (!customMessage.trim()) return toast.error("❌ Digite ou selecione uma mensagem");

    const msg = customMessage
      .replace(/{nome}/g, manualName || "Paciente")
      .replace(/{medico}/g, "Equipe Clínica")
      .replace(/{data}/g, "Data não definida")
      .replace(/{horario}/g, "Horário não definido")
      .trim();

    await sendWhatsAppMessage(cleaned, manualName || cleaned, msg);
    return;
  }

  // ===============================
  // ENVIO COM / SEM AGENDAMENTO
  // ===============================
  let patient: any = null;
  let appointment: any = null;

  if (mode === "withAppointment" && selectedAppointmentId) {
    appointment = appointments.find((a) => a.id === selectedAppointmentId);
    patient = patients.find((p) => p.id === appointment?.patient_id);
  } else if (mode === "free" && selectedPatientId) {
    patient = patients.find((p) => p.id === selectedPatientId);
  }

  if (!patient) return toast.error("❌ Nenhum paciente selecionado");
  if (!customMessage.trim()) return toast.error("❌ Digite ou selecione uma mensagem");

  // ===============================
  // 🔥 MULTI-MÉDICOS (REGRA CERTA)
  // ===============================
  let doctorNames = "Equipe Clínica";

  if (appointment) {
    const ids: string[] = Array.from(
      new Set([
        appointment.doctor_id,
        ...(appointment.doctor_ids || []),
      ])
    ).filter(Boolean);

    const names = ids
      .map((id) => doctors.find((d) => d.id === id)?.name)
      .filter(Boolean);

    if (names.length > 0) {
      doctorNames = names.join(" e ");
    }
  }

  // ===============================
  // MENSAGEM FINAL (UNIFICADA)
  // ===============================
  const msg = customMessage
    .replace(/{nome}/g, patient.name)
    .replace(/{medico}/g, doctorNames)
    .replace(/{data}/g, appointment?.date || "Data não definida")
    .replace(/{horario}/g, appointment?.time || "Horário não definido")
    .trim();

  await sendWhatsAppMessage(
    patient.phone || "",
    patient.name,
    msg,
    appointment?.id
  );
};


  const deleteMessage = (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta mensagem do histórico?")) return;
    const updated = messages.filter((m) => m.id !== id);
    setMessages(updated);
    localStorage.setItem("whatsapp-messages", JSON.stringify(updated));
    toast.success("✅ Mensagem excluída do histórico!");
  };

  const saveEditedMessage = () => {
    if (!editMessage) return;
    const updated = messages.map((m) => (m.id === editMessage.id ? { ...m, message: editText } : m));
    setMessages(updated);
    localStorage.setItem("whatsapp-messages", JSON.stringify(updated));
    toast.success("✅ Mensagem editada!");
    setEditMessage(null);
  };

  // FILTROS
  const filteredAppointments = appointments
    .filter((apt) => apt.status !== "cancelado")
    .filter((apt) => {
      const matchesDate = filterDate ? apt.date.startsWith(filterDate) : true;
      const matchesPatient = filterPatient ? apt.patient_id === filterPatient : true;
      const matchesDoctor = filterDoctor ? apt.doctor_id === filterDoctor : true;

      if (modalSearch && modalSearch.trim() !== "") {
        const txt = modalSearch.toLowerCase();
        const patient = patients.find((p) => p.id === apt.patient_id);
        const doctor = doctors.find((d) => d.id === apt.doctor_id);
        const date = apt.date?.toLowerCase?.() || "";
        const time = apt.time?.toLowerCase?.() || "";
        return (
          matchesDate &&
          matchesPatient &&
          matchesDoctor &&
          (patient?.name.toLowerCase().includes(txt) ||
            (patient?.phone || "").toLowerCase().includes(txt) ||
            doctor?.name.toLowerCase().includes(txt) ||
            date.includes(txt) ||
            time.includes(txt))
        );
      }

      return matchesDate && matchesPatient && matchesDoctor;
    });

  const filteredPatientsList = patients.filter((p) => {
    if (!modalSearch || modalSearch.trim() === "") return true;
    const txt = modalSearch.toLowerCase();
    return p.name.toLowerCase().includes(txt) || (p.phone || "").toLowerCase().includes(txt);
  });

  const globalFilteredAppointments = appointments.filter((apt) => {
    if (!globalSearch || globalSearch.trim() === "") return apt.status !== "cancelado";
    const txt = globalSearch.toLowerCase();
    const patient = patients.find((p) => p.id === apt.patient_id);
    const doctor = doctors.find((d) => d.id === apt.doctor_id);
    const date = apt.date?.toLowerCase?.() || "";
    const time = apt.time?.toLowerCase?.() || "";
    return (
      apt.status !== "cancelado" &&
      (patient?.name.toLowerCase().includes(txt) ||
        (patient?.phone || "").toLowerCase().includes(txt) ||
        doctor?.name.toLowerCase().includes(txt) ||
        date.includes(txt) ||
        time.includes(txt))
    );
  });

  const globalFilteredPatients = patients.filter((p) => {
    if (!globalSearch || globalSearch.trim() === "") return true;
    const txt = globalSearch.toLowerCase();
    return p.name.toLowerCase().includes(txt) || (p.phone || "").toLowerCase().includes(txt);
  });

  const globalFilteredMessages = messages.filter((m) => {
    if (!globalSearch || globalSearch.trim() === "") return true;
    const txt = globalSearch.toLowerCase();
    const patientName = (m.patient_name || "").toLowerCase();
    const messageText = (m.message || "").toLowerCase();
    const phone = (m.to_patient || "").toLowerCase();
    return patientName.includes(txt) || messageText.includes(txt) || phone.includes(txt);
  });

  return (
    <div className="space-y-6 px-2 md:px-6">
      {/* ========== TOPO: FILTRO GLOBAL ========== */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">📱 WhatsApp Profissional</h1>
          <p className="text-gray-600 mt-2">Envio profissional de mensagens automáticas e personalizadas</p>
        </div>

        <div className="flex-1 max-w-xl">
          <Input
            placeholder="🔎 Buscar em pacientes, agendamentos e histórico..."
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            className="w-full"
          />
          <p className="text-xs text-gray-500 mt-1">
            Resultado: {globalFilteredPatients.length} pacientes • {globalFilteredAppointments.length} agendamentos • {globalFilteredMessages.length} mensagens
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-green-600 hover:bg-green-700">
                <Plus className="mr-2 h-4 w-4" /> Nova Mensagem
              </Button>
            </DialogTrigger>

            {/* ================= MODAL NOVA MENSAGEM ================= */}
            <DialogContent className="max-w-5xl w-[95vw]">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold">📱 Enviar WhatsApp</DialogTitle>
                <DialogDescription>Escolha um agendamento, paciente, ou envie para qualquer número</DialogDescription>
              </DialogHeader>

              {/* Filtro local no modal */}
              <div className="mb-4">
                <Input
                  placeholder="🔎 Buscar aqui (pacientes, médico, data, horário)..."
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                />
              </div>

              <Tabs defaultValue="withAppointment" onValueChange={(v) => setMode(v as any)}>
                <TabsList className="mb-4 flex flex-wrap">
                  <TabsTrigger value="withAppointment">📅 Com Agendamento</TabsTrigger>
                  <TabsTrigger value="free">👤 Sem Agendamento</TabsTrigger>
                </TabsList>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Coluna Esquerda */}
                  <div className="space-y-4">
                    {mode === "withAppointment" ? (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
                          <select className="border p-2 rounded" value={filterPatient} onChange={(e) => setFilterPatient(e.target.value)}>
                            <option value="">Todos Pacientes</option>
                            {filteredPatientsList.map((p) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                          <select className="border p-2 rounded" value={filterDoctor} onChange={(e) => setFilterDoctor(e.target.value)}>
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
                                  selectedAppointmentId === apt.id ? "bg-blue-100 border-l-4 border-blue-600" : "hover:bg-gray-50"
                                }`}
                              >
                                <div className="font-semibold">{patient?.name}</div>
                                <div className="text-sm text-gray-600">🩺 {doctor?.name} — {apt.date} ⏰ {apt.time}</div>
                              </div>
                            );
                          })}
                          {filteredAppointments.length === 0 && (
                            <p className="p-3 text-gray-500 text-center">Nenhum agendamento encontrado</p>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="space-y-2">
                        <Label>🔎 Buscar Paciente</Label>
                        <Input
                          placeholder="Digite nome ou telefone..."
                          value={modalSearch}
                          onChange={(e) => setModalSearch(e.target.value)}
                        />

                        <Label>👥 Paciente</Label>
                        <select
                          className="border p-2 w-full rounded"
                          value={selectedPatientId || ""}
                          onChange={(e) => setSelectedPatientId(e.target.value)}
                        >
                          <option value="">Selecione</option>
                          {filteredPatientsList.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} — {p.phone || "Sem telefone"}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Opção para usar número manual */}
                    <div className="pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <input
                          id="useManual"
                          type="checkbox"
                          checked={useManualNumber}
                          onChange={(e) => setUseManualNumber(e.target.checked)}
                        />
                        <Label htmlFor="useManual">📲 Enviar para qualquer número (manual)</Label>
                      </div>

                      {useManualNumber && (
                        <div className="mt-2 space-y-2">
                          <Label>Nome do destinatário (opcional)</Label>
                          <Input placeholder="Ex: João da Silva" value={manualName} onChange={(e) => setManualName(e.target.value)} />

                          <Label>Número de telefone</Label>
                          <Input
                            placeholder="Ex: +55 11 91234-5678 ou 11912345678"
                            value={manualNumber}
                            onChange={(e) => setManualNumber(e.target.value)}
                          />

                          <p className="text-xs text-gray-500">Dica: você pode usar +DDI ou apenas o número local; o sistema adicionará o DDI do Brasil (55) quando apropriado.</p>
                        </div>
                      )}
                    </div>

                  </div>

                  {/* Coluna Direita */}
                  <div className="space-y-4">
                    <Label>📝 Templates</Label>
                    <div className="grid gap-2">
                      {messageTemplates.map((t, i) => (
                        <Card
                          key={i}
                          className={`p-3 cursor-pointer transition ${customMessage === t ? "border-blue-600 bg-blue-50" : "hover:bg-gray-50"}`}
                          onClick={() => setCustomMessage(t)}
                        >
                          <p className="text-sm">{t}</p>
                        </Card>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Mensagem personalizada */}
                <div className="mt-6 space-y-3">
                  <Label>✍️ Mensagem Personalizada</Label>
                  <Textarea
                    rows={4}
                    placeholder="Digite ou selecione um template..."
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                  />

                  {customMessage && (
                    <div className="p-4 border rounded-lg bg-gray-50">
                      <p className="text-xs text-gray-500 mb-1">📲 Preview da mensagem:</p>
                      <p className="whitespace-pre-wrap">{customMessage}</p>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                  <Button className="bg-green-600 hover:bg-green-700" onClick={handleSend}><Send className="mr-2 h-4 w-4" /> Enviar</Button>
                </div>
              </Tabs>
            </DialogContent>
          </Dialog>

          <Button variant="outline" onClick={() => { setMessages([]); localStorage.removeItem("whatsapp-messages"); }}>
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
              <CardDescription>Exibe mensagens enviadas — use o filtro global acima para pesquisar.</CardDescription>
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
                    {(globalSearch ? globalFilteredMessages : messages).map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>{new Date(m.sent_at).toLocaleString("pt-BR")}</TableCell>
                        <TableCell>{m.patient_name}</TableCell>
                        <TableCell>{m.to_patient}</TableCell>
                        <TableCell className="max-w-xs truncate">{m.message}</TableCell>
                        <TableCell className="flex gap-2">
                          <Button variant="secondary" size="sm" onClick={() => setViewMessage(m)}>
                            <Eye className="h-4 w-4" />
                          </Button>

                          <Button variant="outline" size="sm" onClick={() => { setEditMessage(m); setEditText(m.message); }}>
                            <Edit className="h-4 w-4" />
                          </Button>

                          <Button variant="destructive" size="sm" onClick={() => deleteMessage(m.id)}>
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

          <div className="text-right mt-4">
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

          <Textarea rows={6} value={editText} onChange={(e) => setEditText(e.target.value)} />

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setEditMessage(null)}>Cancelar</Button>
            <Button className="bg-blue-600 text-white" onClick={saveEditedMessage}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
