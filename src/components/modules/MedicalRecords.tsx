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
import {
  Plus,
  Edit,
  Eye,
  Trash2,
  Search,
  Filter,
  Printer,
  Upload,
} from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { supabase } from "@/lib/supabase";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

const medicalRecordSchema = z.object({
  patient_id: z.string().min(1, "Paciente é obrigatório"),
  doctor_id: z.string().min(1, "Médico é obrigatório"),
  date: z.string().min(1, "Data é obrigatória"),
  diagnosis: z.string().min(1, "Diagnóstico é obrigatório"),
  treatment: z.string().min(1, "Tratamento é obrigatório"),
  notes: z.string().optional(),
});

type MedicalRecordFormData = z.infer<typeof medicalRecordSchema>;

interface MedicalRecord {
  id: string;
  patient_id: string;
  doctor_id: string;
  date: string;
  diagnosis: string;
  treatment: string;
  notes?: string;
  created_at: string;
}

function logSb(prefix: string, e: any) {
  console.error(`${prefix}:`, JSON.stringify(e, null, 2));
  const msg =
    e?.message || e?.error_description || e?.details || e?.hint || e?.code;
  return msg || "Erro inesperado";
}

export function MedicalRecords() {
  const { patients, doctors } = useApp();
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<MedicalRecord[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [editingRecord, setEditingRecord] = useState<MedicalRecord | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterPatient, setFilterPatient] = useState("");
  const [filterDoctor, setFilterDoctor] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<MedicalRecordFormData>({
    resolver: zodResolver(medicalRecordSchema),
  });

  useEffect(() => {
    loadMedicalRecords();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchTerm, filterPatient, filterDoctor, medicalRecords]);

  const loadMedicalRecords = async () => {
    try {
      const { data, error } = await supabase
        .from("medical_records")
        .select("*")
        .order("date", { ascending: false });

      if (error) {
        const msg = logSb("Erro ao carregar prontuários", error);
        toast.error(`Erro ao carregar prontuários: ${msg}`);
        return;
      }

      setMedicalRecords(data || []);
    } catch (error: any) {
      const msg = logSb("Erro ao carregar prontuários (catch)", error);
      toast.error(`Erro ao carregar prontuários: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let records = [...medicalRecords];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      records = records.filter(
        (r) =>
          r.diagnosis.toLowerCase().includes(term) ||
          r.treatment.toLowerCase().includes(term) ||
          getPatientName(r.patient_id).toLowerCase().includes(term) ||
          getDoctorName(r.doctor_id).toLowerCase().includes(term)
      );
    }

    if (filterPatient) {
      records = records.filter((r) => r.patient_id === filterPatient);
    }

    if (filterDoctor) {
      records = records.filter((r) => r.doctor_id === filterDoctor);
    }

    setFilteredRecords(records);
  };

  const importCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const rows = text.split("\n").slice(1); // ignora cabeçalho
      const records = rows
        .map((row) => row.split(","))
        .filter((cols) => cols.length >= 5)
        .map((cols) => ({
          patient_id: cols[0].trim(),
          doctor_id: cols[1].trim(),
          date: cols[2].trim(),
          diagnosis: cols[3].trim(),
          treatment: cols[4].trim(),
          notes: cols[5]?.trim() || null,
        }));

      if (records.length === 0) {
        toast.error("CSV vazio ou inválido");
        return;
      }

      const { error } = await supabase.from("medical_records").insert(records);
      if (error) {
        const msg = logSb("Erro ao importar CSV", error);
        toast.error(`Erro ao importar: ${msg}`);
        return;
      }

      toast.success("📂 CSV importado com sucesso!");
      loadMedicalRecords();
    } catch (err) {
      toast.error("Erro ao processar CSV");
    }
  };

  const onSubmit = async (form: MedicalRecordFormData) => {
    try {
      const payload = {
        ...form,
        date: form.date.includes("T") ? form.date : `${form.date}T00:00:00Z`,
      };

      let response;
      if (editingRecord) {
        response = await supabase
          .from("medical_records")
          .update(payload)
          .eq("id", editingRecord.id)
          .select()
          .single();
      } else {
        response = await supabase
          .from("medical_records")
          .insert([payload])
          .select()
          .single();
      }

      const { data: savedRecord, error } = response;

      if (error) {
        const msg = logSb("Erro ao salvar prontuário", error);
        toast.error(`Erro ao salvar prontuário: ${msg}`);
        return;
      }

      if (savedRecord) {
        if (editingRecord) {
          setMedicalRecords((prev) =>
            prev.map((r) => (r.id === editingRecord.id ? savedRecord : r))
          );
          toast.success("✏️ Prontuário atualizado!");
        } else {
          setMedicalRecords((prev) => [savedRecord as MedicalRecord, ...prev]);
          toast.success("✅ Prontuário criado com sucesso!");
        }
        reset();
        setIsDialogOpen(false);
        setEditingRecord(null);
      }
    } catch (error: any) {
      const msg = logSb("Erro ao salvar prontuário (catch)", error);
      toast.error(`Erro ao salvar prontuário: ${msg}`);
    }
  };

  const deleteMedicalRecord = async (record: MedicalRecord) => {
    if (
      window.confirm(
        `Tem certeza que deseja excluir o prontuário de ${getPatientName(
          record.patient_id
        )}?`
      )
    ) {
      try {
        const { error } = await supabase
          .from("medical_records")
          .delete()
          .eq("id", record.id);

        if (error) {
          const msg = logSb("Erro ao excluir prontuário", error);
          toast.error(`Erro ao excluir prontuário: ${msg}`);
          return;
        }

        setMedicalRecords((prev) => prev.filter((r) => r.id !== record.id));
        toast.success("🗑️ Prontuário excluído!");
      } catch (error: any) {
        const msg = logSb("Erro ao excluir prontuário (catch)", error);
        toast.error(`Erro ao excluir prontuário: ${msg}`);
      }
    }
  };

  const handleEdit = (record: MedicalRecord) => {
    reset(record);
    setEditingRecord(record);
    setIsDialogOpen(true);
  };

  const handlePrint = (record: MedicalRecord) => {
    const printContent = `
      <div style="font-family: Arial; padding: 40px; line-height: 1.6;">
        <h2 style="text-align: center; border-bottom: 2px solid #1E40AF; padding-bottom: 5px;">
          🏥 Neuro Integrar<br/>Prontuário Médico
        </h2>
        <p><strong>Paciente:</strong> ${getPatientName(record.patient_id)}</p>
        <p><strong>Médico:</strong> ${getDoctorName(record.doctor_id)}</p>
        <p><strong>Data:</strong> ${new Date(record.date).toLocaleDateString(
          "pt-BR"
        )}</p>
        <hr/>
        <h3>Diagnóstico</h3>
        <p>${record.diagnosis}</p>
        <h3>Tratamento</h3>
        <p>${record.treatment}</p>
        ${
          record.notes ? `<h3>Observações</h3><p>${record.notes}</p>` : ""
        }
        <hr/>
        <p style="text-align:center; font-size: 12px; margin-top: 30px;">
          Neuro Integrar - CNPJ: 42.528.978/0001-70 | Endereço: Av. Exemplo, 123 - São Luís/MA
        </p>
      </div>
    `;

    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const getPatientName = (patientId: string) => {
    const patient = patients.find((p) => p.id === patientId);
    return patient ? patient.name : "Paciente não encontrado";
  };

  const getDoctorName = (doctorId: string) => {
    const doctor = doctors.find((d) => d.id === doctorId);
    return doctor ? doctor.name : "Médico não encontrado";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Carregando prontuários...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row justify-between gap-4 items-center">
        <div>
          <h1 className="text-3xl font-bold">📑 Prontuários Médicos</h1>
          <p className="text-gray-600 mt-1">
            Gerencie e pesquise os prontuários cadastrados
          </p>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative">
            <Input
              placeholder="Pesquisar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
          </div>

          <Select onValueChange={(val) => setFilterPatient(val)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrar por Paciente" />
            </SelectTrigger>
            <SelectContent>
              {patients.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select onValueChange={(val) => setFilterDoctor(val)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrar por Médico" />
            </SelectTrigger>
            <SelectContent>
              {doctors.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={() => {
              setFilterPatient("");
              setFilterDoctor("");
              setSearchTerm("");
            }}
          >
            <Filter className="mr-2 h-4 w-4" /> Limpar
          </Button>

          {/* Botão Importar CSV */}
          <label className="flex items-center px-3 py-2 bg-gray-200 rounded cursor-pointer">
            <Upload className="h-4 w-4 mr-2" />
            Importar CSV
            <input
              type="file"
              accept=".csv"
              onChange={importCSV}
              className="hidden"
            />
          </label>

          {/* Novo prontuário */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="mr-2 h-4 w-4" />
                Novo Prontuário
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingRecord ? "Editar Prontuário" : "Criar Novo Prontuário"}
                </DialogTitle>
                <DialogDescription>
                  Preencha os campos abaixo para registrar
                </DialogDescription>
              </DialogHeader>
              {/* Form */}
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Paciente</Label>
                    <Select
                      onValueChange={(val) =>
                        setValue("patient_id", val, { shouldValidate: true })
                      }
                      defaultValue={editingRecord?.patient_id}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {patients.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.patient_id && (
                      <p className="text-sm text-red-600">
                        {errors.patient_id.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label>Médico</Label>
                    <Select
                      onValueChange={(val) =>
                        setValue("doctor_id", val, { shouldValidate: true })
                      }
                      defaultValue={editingRecord?.doctor_id}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {doctors.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.doctor_id && (
                      <p className="text-sm text-red-600">
                        {errors.doctor_id.message}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <Label>Data</Label>
                  <Input
                    type="date"
                    defaultValue={
                      editingRecord ? editingRecord.date.split("T")[0] : ""
                    }
                    {...register("date")}
                  />
                  {errors.date && (
                    <p className="text-sm text-red-600">{errors.date.message}</p>
                  )}
                </div>

                <div>
                  <Label>Diagnóstico</Label>
                  <Textarea rows={3} {...register("diagnosis")} />
                </div>

                <div>
                  <Label>Tratamento</Label>
                  <Textarea rows={3} {...register("treatment")} />
                </div>

                <div>
                  <Label>Observações</Label>
                  <Textarea rows={2} {...register("notes")} />
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(false);
                      setEditingRecord(null);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting
                      ? "Salvando..."
                      : editingRecord
                      ? "Atualizar"
                      : "Salvar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Lista */}
      <Card>
        <CardHeader>
          <CardTitle>📋 Lista de Prontuários</CardTitle>
          <CardDescription>
            {filteredRecords.length} registro(s) encontrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead>Médico</TableHead>
                <TableHead>Diagnóstico</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>
                    {new Date(record.date).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell>{getPatientName(record.patient_id)}</TableCell>
                  <TableCell>{getDoctorName(record.doctor_id)}</TableCell>
                  <TableCell className="truncate max-w-[200px]">
                    {record.diagnosis}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedRecord(record)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleEdit(record)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handlePrint(record)}
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteMedicalRecord(record)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredRecords.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6">
                    Nenhum registro encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal visualizar */}
      <Dialog
        open={!!selectedRecord}
        onOpenChange={() => setSelectedRecord(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>📄 Visualizar Prontuário</DialogTitle>
            <DialogDescription>
              Detalhes completos do registro médico
            </DialogDescription>
          </DialogHeader>
          {selectedRecord && (
            <div className="space-y-4">
              <p>
                <strong>Paciente:</strong> {getPatientName(selectedRecord.patient_id)}
              </p>
              <p>
                <strong>Médico:</strong> {getDoctorName(selectedRecord.doctor_id)}
              </p>
              <p>
                <strong>Data:</strong>{" "}
                {new Date(selectedRecord.date).toLocaleDateString("pt-BR")}
              </p>
              <div>
                <h3 className="font-semibold">Diagnóstico</h3>
                <p>{selectedRecord.diagnosis}</p>
              </div>
              <div>
                <h3 className="font-semibold">Tratamento</h3>
                <p>{selectedRecord.treatment}</p>
              </div>
              {selectedRecord.notes && (
                <div>
                  <h3 className="font-semibold">Observações</h3>
                  <p>{selectedRecord.notes}</p>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => handlePrint(selectedRecord)}
                >
                  <Printer className="h-4 w-4 mr-2" /> Imprimir
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => handleEdit(selectedRecord)}
                >
                  <Edit className="h-4 w-4 mr-2" /> Editar
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => deleteMedicalRecord(selectedRecord)}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Excluir
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
