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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Calendar,
  Plus,
  Trash2,
  Clock,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Edit,
  AlertTriangle,
  Eye,
  Save,
} from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

const appointmentSchema = z.object({
  patient_id: z.string().min(1, "Paciente é obrigatório"),
  doctor_id: z.string().min(1, "Médico é obrigatório"),
  date: z.string().min(1, "Data é obrigatória"),
  time: z.string().min(1, "Horário é obrigatório"),
  type: z.string().min(1, "Tipo de consulta é obrigatório"),
  price: z.number().min(0.01, "Preço deve ser maior que zero"),
  notes: z.string().optional(),
});

type AppointmentFormData = z.infer<typeof appointmentSchema>;

export function ScheduleGrid() {
  const { appointments, doctors, patients, services, addAppointment, updateAppointment, deleteAppointment } =
    useApp();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isNewAppointmentOpen, setIsNewAppointmentOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false); // 🔑 controle do modo edição
  const [localData, setLocalData] = useState<any>({});
  const [selectedService, setSelectedService] = useState<string>("");

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AppointmentFormData>({
    resolver: zodResolver(appointmentSchema),
  });

  const watchDate = watch("date");
  const watchTime = watch("time");

  useEffect(() => {
    if (selectedService) {
      const service = services.find((s) => s.name === selectedService);
      if (service) {
        setValue("price", service.price);
      }
    }
  }, [selectedService, services, setValue]);

  // Horários fixos até 21:00
  const generateTimeSlots = () => {
    const slots: string[] = [];
    for (let hour = 8; hour <= 20; hour++) {
      slots.push(`${hour.toString().padStart(2, "0")}:00`);
      slots.push(`${hour.toString().padStart(2, "0")}:30`);
    }
    slots.push("21:00");
    return slots;
  };

  const timeSlots = generateTimeSlots();
  const activeServices = services.filter((s) => s.is_active);

  const getDoctorName = (doctorId: string) => {
    const doctor = doctors.find((d) => d.id === doctorId);
    return doctor ? doctor.name : "Médico não encontrado";
  };

  const getPatientName = (patientId: string) => {
    const patient = patients.find((p) => p.id === patientId);
    return patient ? patient.name : "Paciente não encontrado";
  };

  // salvar edição
  const handleSaveEdit = async () => {
    const success = await updateAppointment(editingAppointment.id, localData);
    if (success) {
      toast.success("✅ Consulta atualizada com sucesso!");
      setEditingAppointment({ ...editingAppointment, ...localData });
      setIsEditing(false);
    } else {
      toast.error("❌ Erro ao salvar alterações.");
    }
  };

  return (
    <div className="space-y-6">
      {/* exemplo simplificado só do dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Gerenciar Consulta</DialogTitle>
          </DialogHeader>

          {editingAppointment && (
            <div className="space-y-4">
              {!isEditing ? (
                <>
                  <p>
                    <strong>Paciente:</strong>{" "}
                    {getPatientName(editingAppointment.patient_id)}
                  </p>
                  <p>
                    <strong>Médico:</strong>{" "}
                    {getDoctorName(editingAppointment.doctor_id)}
                  </p>
                  <p>
                    <strong>Data:</strong>{" "}
                    {new Date(editingAppointment.date).toLocaleDateString(
                      "pt-BR"
                    )}
                  </p>
                  <p>
                    <strong>Horário:</strong> {editingAppointment.time}
                  </p>
                  <p>
                    <strong>Valor:</strong> R${" "}
                    {editingAppointment.price.toLocaleString("pt-BR")}
                  </p>
                  <p>
                    <strong>Notas:</strong>{" "}
                    {editingAppointment.notes || "Sem observações"}
                  </p>

                  <Button onClick={() => {
                    setLocalData(editingAppointment);
                    setIsEditing(true);
                  }}>
                    <Edit className="mr-2 h-4 w-4" /> Editar
                  </Button>
                </>
              ) : (
                <div className="space-y-3">
                  <Label>Data</Label>
                  <Input
                    type="date"
                    value={localData.date}
                    onChange={(e) =>
                      setLocalData({ ...localData, date: e.target.value })
                    }
                  />

                  <Label>Hora</Label>
                  <Input
                    type="time"
                    value={localData.time}
                    onChange={(e) =>
                      setLocalData({ ...localData, time: e.target.value })
                    }
                  />

                  <Label>Preço</Label>
                  <Input
                    type="number"
                    value={localData.price}
                    onChange={(e) =>
                      setLocalData({
                        ...localData,
                        price: parseFloat(e.target.value),
                      })
                    }
                  />

                  <Label>Notas</Label>
                  <Textarea
                    value={localData.notes || ""}
                    onChange={(e) =>
                      setLocalData({ ...localData, notes: e.target.value })
                    }
                  />

                  <div className="flex space-x-2">
                    <Button onClick={handleSaveEdit} className="bg-green-600">
                      <Save className="mr-2 h-4 w-4" /> Salvar
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setIsEditing(false)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
