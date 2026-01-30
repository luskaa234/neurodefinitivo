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
  CheckCircle,
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

  const openComplete = (doctor: any) => {
    setEditingDoctor(doctor);
    resetEdit({
      name: doctor.name || "",
      email: doctor.email === "Sem email" ? "" : doctor.email || "",
      crm: doctor.crm || "",
      specialty: doctor.specialty || "",
      phone: doctor.phone || "",
      horarios: doctor.horarios || [],
    });
    setIsEditDialogOpen(true);
  };

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
      const { data: hasAppointments, error: apptError } = await supabase
        .from("appointments")
        .select("id")
        .eq("doctor_id", doctor.user_id)
        .limit(1);

      if (apptError) {
        toast.error("Erro ao verificar agendamentos: " + apptError.message);
        return;
      }

      if (hasAppointments && hasAppointments.length > 0) {
        toast.error("Não é possível excluir: médico possui agendamentos.");
        return;
      }

      const { error } = await supabase.from("users").delete().eq("id", doctor.user_id);
      if (error) {
        toast.error("Erro ao excluir: " + error.message);
      } else {
        toast.success("Médico excluído!");
        setDoctors((prev) => prev.filter((d) => d.id !== doctor.id));
      }
    }
  };

  const onComplete = async (data: DoctorFormData) => {
    if (!editingDoctor) return;

    try {
      const { error: userError } = await supabase
        .from("users")
        .update({
          name: data.name,
          email: data.email,
          phone: data.phone,
          role: "medico",
          is_active: true,
        })
        .eq("id", editingDoctor.user_id);

      if (userError) {
        toast.error("Erro ao atualizar usuário: " + userError.message);
        return;
      }

      const { data: existingMedico } = await supabase
        .from("medicos")
        .select("user_id")
        .eq("user_id", editingDoctor.user_id)
        .maybeSingle();

      const sanitizedCrm = data.crm?.trim() || "";
      const sanitizedSpecialty = data.specialty?.trim() || "";

      const { error: medicoError } = existingMedico
        ? await supabase
            .from("medicos")
            .update({
              crm: sanitizedCrm,
              specialty: sanitizedSpecialty,
              horarios: JSON.stringify(data.horarios || []),
            })
            .eq("user_id", editingDoctor.user_id)
        : await supabase.from("medicos").insert([
            {
              user_id: editingDoctor.user_id,
              crm: sanitizedCrm,
              specialty: sanitizedSpecialty,
              horarios: JSON.stringify(data.horarios || []),
            },
          ]);

      if (medicoError) {
        toast.error("Erro ao atualizar médico: " + medicoError.message);
        return;
      }

      setDoctors((prev) =>
        prev.map((d) =>
          d.user_id === editingDoctor.user_id
            ? {
                ...d,
                name: data.name,
                email: data.email,
                phone: data.phone,
                crm: data.crm,
                specialty: data.specialty,
                horarios: data.horarios || [],
                is_active: true,
              }
            : d
        )
      );

      toast.success("Cadastro do médico concluído!");
      setIsEditDialogOpen(false);
      setEditingDoctor(null);
    } catch (e) {
      console.error(e);
      toast.error("Erro inesperado ao completar cadastro.");
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

  const totalDoctors = doctors.length;
  const totalActive = doctors.filter((d) => d.is_active).length;
  const totalPending = totalDoctors - totalActive;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 px-2 sm:px-4">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Stethoscope className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Gestão de Médicos</h1>
            <p className="text-xs text-gray-500 sm:text-sm">Cadastre, acompanhe e organize sua equipe clínica</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[11px] font-semibold text-primary sm:text-xs">
            Total: {totalDoctors}
          </div>
          <div className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-[11px] font-semibold text-green-700 sm:text-xs">
            Ativos: {totalActive}
          </div>
          <div className="rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 text-[11px] font-semibold text-yellow-700 sm:text-xs">
            Pendentes: {totalPending}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
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
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex items-center border rounded-lg px-2 w-full md:w-64 bg-white">
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
            className="w-full md:w-64"
          />
        </div>
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
            <Card key={doctor.id} className="shadow-sm hover:shadow-md transition border border-gray-100">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">{doctor.name}</CardTitle>
                <CardDescription>
                  {doctor.specialty || "Especialidade não informada"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="w-full overflow-x-auto">
                  <Table className="min-w-[520px]">
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
                          <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-medium">
                            Pendente
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
                </div>

                {/* Ações */}
                <div className="flex flex-wrap justify-end gap-2">
                  {!doctor.is_active && (
                    <Button
                      size="sm"
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={() => openComplete(doctor)}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Completar cadastro
                    </Button>
                  )}
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

      {/* Modal: Completar cadastro */}
      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            setEditingDoctor(null);
            resetEdit({ horarios: [] });
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Completar cadastro do médico</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitEdit(onComplete)} className="space-y-4">
            <Input placeholder="Nome" {...registerEdit("name")} />
            <Input placeholder="Email" {...registerEdit("email")} />
            <Input placeholder="CRM" {...registerEdit("crm")} />
            <Input placeholder="Especialidade" {...registerEdit("specialty")} />
            <Input placeholder="Telefone" {...registerEdit("phone")} />

            <div className="space-y-2">
              <h3 className="text-sm font-medium">Horários de Atendimento</h3>
              {fieldsEdit.map((field, index) => (
                <div key={field.id} className="flex gap-2 items-center">
                  <select
                    {...registerEdit(`horarios.${index}.day_of_week` as const)}
                    className="border rounded px-2 py-1"
                  >
                    {diasSemana.map((d, i) => (
                      <option key={i} value={i}>
                        {d}
                      </option>
                    ))}
                  </select>
                  <Input type="time" {...registerEdit(`horarios.${index}.start_time` as const)} />
                  <Input type="time" {...registerEdit(`horarios.${index}.end_time` as const)} />
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => removeEdit(index)}
                  >
                    Remover
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  appendEdit({ day_of_week: "1", start_time: "08:00", end_time: "17:00" })
                }
              >
                + Adicionar Horário
              </Button>
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={isSubmittingEdit}
                className="bg-green-600 hover:bg-green-700"
              >
                {isSubmittingEdit ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
