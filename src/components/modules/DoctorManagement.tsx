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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import {
  UserPlus,
  Edit,
  Phone,
  Loader2,
  Trash2,
  Mail,
  Clock,
  Search,
  Stethoscope,
} from "lucide-react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

const horarioSchema = z.object({
  day_of_week: z.string().min(1),
  start_time: z.string().min(1),
  end_time: z.string().min(1),
});

const doctorSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("Email inválido"),
  crm: z.string().optional(),
  specialty: z.string().optional(),
  phone: z.string().optional(),
  horarios: z.array(horarioSchema).optional(),
});

type DoctorFormData = z.infer<typeof doctorSchema>;

const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function DoctorManagement() {
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<any | null>(null);

  const [search, setSearch] = useState("");
  const [filterSpecialty, setFilterSpecialty] = useState("");

  // 🔹 Carregar médicos
  useEffect(() => {
    const loadDoctors = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("medicos")
        .select(`
          id,
          crm,
          specialty,
          horarios,
          users (
            id,
            name,
            email,
            phone,
            is_active
          )
        `)
        .order("created_at", { ascending: false });

      if (error) {
        toast.error("Erro ao carregar médicos: " + error.message);
      } else {
        const formatted = (data || []).map((d: any) => ({
          id: d.id,
          crm: d.crm,
          specialty: d.specialty,
          horarios: d.horarios ? JSON.parse(d.horarios) : [],
          name: d.users?.name || "Sem nome",
          email: d.users?.email || "Sem email",
          phone: d.users?.phone || "Sem telefone",
          is_active: d.users?.is_active ?? false,
          user_id: d.users?.id,
        }));
        setDoctors(formatted);
      }
      setLoading(false);
    };
    loadDoctors();
  }, []);

  // 🔹 Form cadastro
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { isSubmitting },
  } = useForm<DoctorFormData>({
    resolver: zodResolver(doctorSchema),
    defaultValues: { horarios: [] },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "horarios",
  });

  // 🔹 Form edição
  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    reset: resetEdit,
    control: controlEdit,
    formState: { isSubmitting: isSubmittingEdit },
  } = useForm<DoctorFormData>({
    resolver: zodResolver(doctorSchema),
    defaultValues: { horarios: [] },
  });

  const {
    fields: fieldsEdit,
    append: appendEdit,
    remove: removeEdit,
  } = useFieldArray({
    control: controlEdit,
    name: "horarios",
  });

  // 🔹 Criar médico
  const onSubmit = async (data: DoctorFormData) => {
    try {
      const { data: userData, error: userError } = await supabase
        .from("users")
        .insert([
          {
            name: data.name,
            email: data.email,
            phone: data.phone,
            role: "medico",
            is_active: true,
          },
        ])
        .select()
        .single();

      if (userError) {
        toast.error("Erro ao cadastrar usuário: " + userError.message);
        return;
      }

      const { error: medicoError } = await supabase.from("medicos").insert([
        {
          user_id: userData.id,
          crm: data.crm,
          specialty: data.specialty,
          horarios: JSON.stringify(data.horarios || []),
        },
      ]);

      if (medicoError) {
        toast.error("Erro ao cadastrar médico: " + medicoError.message);
        return;
      }

      toast.success("✅ Médico cadastrado com sucesso!");
      reset();
      setIsDialogOpen(false);

      setDoctors((prev) => [
        {
          id: userData.id,
          crm: data.crm,
          specialty: data.specialty,
          horarios: data.horarios,
          name: userData.name,
          email: userData.email,
          phone: userData.phone,
          is_active: userData.is_active,
          user_id: userData.id,
        },
        ...prev,
      ]);
    } catch (e) {
      console.error(e);
      toast.error("Erro inesperado.");
    }
  };

  // 🔹 Excluir médico
  const handleDelete = async (doctor: any) => {
    if (window.confirm(`Excluir médico ${doctor.name}?`)) {
      const { error } = await supabase.from("users").delete().eq("id", doctor.user_id);
      if (error) {
        toast.error("Erro ao excluir: " + error.message);
      } else {
        toast.success("Médico excluído!");
        setDoctors((prev) => prev.filter((d) => d.id !== doctor.id));
      }
    }
  };

  // 🔹 Filtragem
  const filteredDoctors = doctors.filter((d) => {
    const matchSearch =
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.email.toLowerCase().includes(search.toLowerCase());
    const matchSpecialty = filterSpecialty
      ? d.specialty?.toLowerCase().includes(filterSpecialty.toLowerCase())
      : true;
    return matchSearch && matchSpecialty;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
          <Stethoscope className="h-7 w-7 text-blue-600" />
          Gestão de Médicos
        </h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white">
              <UserPlus className="mr-2 h-4 w-4" /> Novo Médico
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Cadastrar Novo Médico</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Input placeholder="Nome" {...register("name")} />
              <Input placeholder="Email" {...register("email")} />
              <Input placeholder="CRM" {...register("crm")} />
              <Input placeholder="Especialidade" {...register("specialty")} />
              <Input placeholder="Telefone" {...register("phone")} />

              {/* Horários */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Horários de Atendimento</h3>
                {fields.map((field, index) => (
                  <div key={field.id} className="flex gap-2 items-center">
                    <select
                      {...register(`horarios.${index}.day_of_week` as const)}
                      className="border rounded px-2 py-1"
                    >
                      {diasSemana.map((d, i) => (
                        <option key={i} value={i}>
                          {d}
                        </option>
                      ))}
                    </select>
                    <Input type="time" {...register(`horarios.${index}.start_time` as const)} />
                    <Input type="time" {...register(`horarios.${index}.end_time` as const)} />
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => remove(index)}
                    >
                      Remover
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    append({ day_of_week: "1", start_time: "08:00", end_time: "17:00" })
                  }
                >
                  + Adicionar Horário
                </Button>
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isSubmitting ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filtros */}
      <div className="flex gap-4">
        <div className="flex items-center border rounded px-2 w-1/3">
          <Search className="h-4 w-4 text-gray-400 mr-2" />
          <Input
            placeholder="Pesquisar por nome ou email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <Input
          placeholder="Filtrar por especialidade"
          value={filterSpecialty}
          onChange={(e) => setFilterSpecialty(e.target.value)}
          className="w-1/3"
        />
      </div>

      {/* Lista */}
      {filteredDoctors.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center h-64 text-gray-500">
            Nenhum médico encontrado
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredDoctors.map((doctor) => (
            <Card key={doctor.id} className="shadow-md hover:shadow-lg transition">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">{doctor.name}</CardTitle>
                <CardDescription>
                  {doctor.specialty || "Especialidade não informada"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">📧 Email</TableCell>
                      <TableCell>{doctor.email}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">📞 Telefone</TableCell>
                      <TableCell>{doctor.phone || "Não informado"}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">🆔 CRM</TableCell>
                      <TableCell>{doctor.crm || "Não informado"}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">📌 Status</TableCell>
                      <TableCell>
                        {doctor.is_active ? (
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">
                            Ativo
                          </span>
                        ) : (
                          <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-medium">
                            Inativo
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">🕒 Horários</TableCell>
                      <TableCell>
                        {doctor.horarios.length > 0 ? (
                          <div className="space-y-1 text-sm">
                            {doctor.horarios.map((h: any, i: number) => (
                              <div
                                key={i}
                                className="flex justify-between border-b pb-1 last:border-0"
                              >
                                <span>{diasSemana[parseInt(h.day_of_week)]}</span>
                                <span>
                                  {h.start_time} - {h.end_time}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="italic text-gray-500">
                            Nenhum horário cadastrado
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>

                {/* Ações */}
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      toast.info("Função de editar pode ser ativada aqui 🚀")
                    }
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(doctor)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
