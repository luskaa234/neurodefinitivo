"use client";

import React, { useState, useMemo } from "react";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  UserPlus, Edit, Eye, Loader2, Trash2, Users, Download
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

// ===== Schema (cadastro manual) =====
const patientSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("Email inválido"),
  cpf: z.string().min(1, "CPF é obrigatório"),
  birth_date: z.string().min(1, "Data de nascimento é obrigatória"),
  phone: z.string().min(1, "Telefone é obrigatório"),
  address: z.string().min(1, "Endereço é obrigatório"),
  responsavel: z.string().min(1, "Responsável é obrigatório"),
  valor_mensal: z.string().min(1, "Valor é obrigatório"),
  tipo_atendimento: z.string().min(1, "Tipo de atendimento é obrigatório"),
});
type PatientFormData = z.infer<typeof patientSchema>;

type PatientRow = {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string;
  is_active: boolean;
  created_at?: string;

  cpf: string;
  birth_date: string | null;
  address: string;
  responsavel: string;
  tipo_atendimento: string;
  valor_mensal: number | null;
};

export function PatientManagement() {
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Modais
  const [isDialogOpen, setIsDialogOpen] = useState(false); // criar manual
  const [viewPatient, setViewPatient] = useState<PatientRow | null>(null); // visualizar
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editing, setEditing] = useState<PatientRow | null>(null);

  // Sincronização
  const [syncing, setSyncing] = useState(false);

  // Filtros
  const [search, setSearch] = useState("");
  const [filterService, setFilterService] = useState("");

  // 🔹 Carregar pacientes ao montar
  React.useEffect(() => {
    const loadPatients = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("patients")
        .select(`
          id, user_id, cpf, birth_date, address, responsavel, tipo_atendimento, valor_mensal,
          users (id, name, email, phone, is_active, created_at)
        `)
        .order("created_at", { ascending: false });

      if (error) {
        toast.error("Erro ao carregar pacientes: " + error.message);
      } else if (data) {
        const formatted = (data as any[]).map((p) => ({
          id: p.id,
          user_id: p.user_id ?? p.users?.id,
          cpf: p.cpf ?? "",
          birth_date: p.birth_date ?? null,
          address: p.address ?? "",
          responsavel: p.responsavel ?? "",
          tipo_atendimento: p.tipo_atendimento ?? "",
          valor_mensal: p.valor_mensal ?? null,

          name: p.users?.name ?? "",
          email: p.users?.email ?? "",
          phone: p.users?.phone ?? "",
          is_active: p.users?.is_active ?? true,
          created_at: p.users?.created_at,
        })) as PatientRow[];
        setPatients(formatted);
      }
      setLoading(false);
    };
    loadPatients();
  }, []);

  // 🔹 Form cadastro manual
  const { register, handleSubmit, reset, formState: { isSubmitting } } =
    useForm<PatientFormData>({ resolver: zodResolver(patientSchema) });

  // 🔹 Criar paciente (manual)
  const onSubmit = async (data: PatientFormData) => {
    try {
      // 1) cria usuário (paciente)
      const { data: userData, error: userError } = await supabase
        .from("users")
        .insert([{
          name: data.name,
          email: data.email,
          phone: data.phone,
          role: "paciente",
          is_active: true,
        }])
        .select()
        .single();

      if (userError || !userData) {
        toast.error("Erro ao cadastrar usuário: " + (userError?.message || ""));
        return;
      }

      // 2) cria ficha de patient
      const { data: patientData, error: patientError } = await supabase
        .from("patients")
        .insert([{
          user_id: userData.id,
          cpf: data.cpf,
          birth_date: data.birth_date,
          address: data.address,
          responsavel: data.responsavel,
          tipo_atendimento: data.tipo_atendimento,
          valor_mensal: Number(data.valor_mensal),
        }])
        .select()
        .single();

      if (patientError || !patientData) {
        toast.error("Erro ao cadastrar paciente: " + (patientError?.message || ""));
        return;
      }

      toast.success("✅ Paciente cadastrado com sucesso!");
      reset();
      setIsDialogOpen(false);

      setPatients((prev) => [{
        id: patientData.id,
        user_id: userData.id,
        cpf: patientData.cpf ?? "",
        birth_date: patientData.birth_date ?? null,
        address: patientData.address ?? "",
        responsavel: patientData.responsavel ?? "",
        tipo_atendimento: patientData.tipo_atendimento ?? "",
        valor_mensal: patientData.valor_mensal ?? null,
        name: userData.name,
        email: userData.email,
        phone: userData.phone,
        is_active: userData.is_active,
        created_at: userData.created_at,
      }, ...prev]);

    } catch (e) {
      console.error(e);
      toast.error("Erro inesperado.");
    }
  };

  // 🔹 Excluir paciente (apaga user -> cascade patient, se FK configurada. Caso não, mantemos delete apenas no users)
  const handleDelete = async (p: PatientRow) => {
    if (!window.confirm(`Excluir paciente ${p.name}?`)) return;
    const { error } = await supabase.from("users").delete().eq("id", p.user_id);
    if (error) {
      toast.error("Erro ao excluir: " + error.message);
    } else {
      toast.success("Paciente excluído!");
      setPatients((prev) => prev.filter((x) => x.id !== p.id));
    }
  };

  // 🔹 Visualizar
  const openView = (p: PatientRow) => setViewPatient(p);

  // 🔹 Editar (abre modal com dados)
  const openEdit = (p: PatientRow) => {
    setEditing({ ...p });
    setIsEditOpen(true);
  };

  // 🔹 Salvar edição (users + patients)
  const saveEdit = async () => {
    if (!editing) return;
    try {
      // Atualiza users
      const { error: uErr } = await supabase
        .from("users")
        .update({
          name: editing.name,
          email: editing.email,
          phone: editing.phone,
          is_active: editing.is_active,
        })
        .eq("id", editing.user_id);
      if (uErr) {
        toast.error("Erro ao atualizar usuário: " + uErr.message);
        return;
      }

      // Atualiza patients
      const { error: pErr } = await supabase
        .from("patients")
        .update({
          cpf: editing.cpf,
          birth_date: editing.birth_date,
          address: editing.address,
          responsavel: editing.responsavel,
          tipo_atendimento: editing.tipo_atendimento,
          valor_mensal: editing.valor_mensal,
        })
        .eq("id", editing.id);
      if (pErr) {
        toast.error("Erro ao atualizar paciente: " + pErr.message);
        return;
      }

      // Atualiza lista local
      setPatients((prev) =>
        prev.map((x) => (x.id === editing.id ? { ...editing } : x))
      );

      toast.success("✅ Alterações salvas!");
      setIsEditOpen(false);
      setEditing(null);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar alterações.");
    }
  };

  // 🔹 Sincronizar: cria fichas em patients para users role='paciente' sem ficha
  const syncFromUsers = async () => {
    setSyncing(true);
    try {
      const { data: userRows, error: userErr } = await supabase
        .from("users")
        .select("id, name, email, phone, is_active, created_at, role, patients (id)")
        .eq("role", "paciente");

      if (userErr || !userRows) {
        toast.error("Erro ao buscar usuários: " + (userErr?.message || ""));
        setSyncing(false);
        return;
      }

      const missing = (userRows as any[]).filter((u) => !u.patients || u.patients.length === 0);
      if (missing.length === 0) {
        toast.message("Todos os pacientes já possuem ficha.");
        setSyncing(false);
        return;
      }

      const ok = window.confirm(`Encontramos ${missing.length} usuário(s) paciente sem ficha. Criar agora?`);
      if (!ok) { setSyncing(false); return; }

      let created = 0;
      const newItems: PatientRow[] = [];

      for (const u of missing) {
        const { data: patientData, error: pErr } = await supabase
          .from("patients")
          .insert([{
            user_id: u.id,
            cpf: "",
            birth_date: null,
            address: "",
            responsavel: "",
            tipo_atendimento: "",
            valor_mensal: null,
          }])
          .select()
          .single();

        if (pErr || !patientData) {
          console.warn("Falha ao criar ficha para", u.id, pErr);
          continue;
        }
        created++;
        newItems.push({
          id: patientData.id,
          user_id: u.id,
          cpf: "",
          birth_date: null,
          address: "",
          responsavel: "",
          tipo_atendimento: "",
          valor_mensal: null,
          name: u.name,
          email: u.email,
          phone: u.phone,
          is_active: u.is_active,
          created_at: u.created_at,
        });
      }

      if (created > 0) {
        setPatients((prev) => [...newItems, ...prev]);
        toast.success(`${created} ficha(s) criada(s)!`);
      } else {
        toast.message("Nenhuma ficha criada.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Falha na sincronização.");
    } finally {
      setSyncing(false);
    }
  };

  // 🔹 Exportar CSV (com base no filtro atual)
  const exportCSV = (data: PatientRow[]) => {
    const header = [
      "name","email","phone","is_active",
      "cpf","birth_date","address","responsavel","tipo_atendimento","valor_mensal","created_at"
    ];
    const rows = data.map((p) => ([
      p.name ?? "",
      p.email ?? "",
      p.phone ?? "",
      p.is_active ? "ativo" : "inativo",
      p.cpf ?? "",
      p.birth_date ?? "",
      p.address ?? "",
      p.responsavel ?? "",
      p.tipo_atendimento ?? "",
      p.valor_mensal != null ? String(p.valor_mensal) : "",
      p.created_at ?? ""
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")));

    const csv = [header.join(","), ...rows].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pacientes_${new Date().toISOString().slice(0,19).replace(/[:T]/g,"-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 🔹 Filtro em memória
  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      const s = search.trim().toLowerCase();
      const matchSearch =
        !s ||
        p.name?.toLowerCase().includes(s) ||
        p.email?.toLowerCase().includes(s) ||
        p.phone?.toLowerCase().includes(s);
      const matchService = filterService
        ? (p.tipo_atendimento || "").toLowerCase().includes(filterService.toLowerCase())
        : true;
      return matchSearch && matchService;
    });
  }, [patients, search, filterService]);

  if (loading)
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">👥 Gestão de Pacientes</h1>
          <p className="text-gray-600">Gerencie seus pacientes de forma prática</p>
        </div>

        <div className="flex gap-2">
          {/* Exportar */}
          <Button variant="outline" onClick={() => exportCSV(filteredPatients)}>
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>

          {/* Sincronizar de Usuários */}
          <Button variant="outline" onClick={syncFromUsers} disabled={syncing}>
            <Users className="mr-2 h-4 w-4" />
            {syncing ? "Sincronizando..." : "Sincronizar de Usuários"}
          </Button>

          {/* Novo Paciente (manual) */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                <UserPlus className="mr-2 h-4 w-4" /> Novo Paciente
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Novo Paciente</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
                <Input placeholder="Nome" {...register("name")} />
                <Input placeholder="Email" {...register("email")} />
                <Input placeholder="CPF" {...register("cpf")} />
                <Input type="date" {...register("birth_date")} />
                <Input placeholder="Telefone" {...register("phone")} />
                <Input placeholder="Endereço" {...register("address")} />
                <Input placeholder="Responsável" {...register("responsavel")} />
                <Input placeholder="Serviço(s)" {...register("tipo_atendimento")} />
                <Input type="number" placeholder="Valor mensal" {...register("valor_mensal")} />
                <div className="col-span-2 flex justify-end">
                  <Button type="submit" disabled={isSubmitting} className="bg-green-600 hover:bg-green-700">
                    {isSubmitting ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Pesquisa / Filtros */}
      <div className="flex gap-4">
        <Input
          placeholder="Pesquisar por nome, email ou telefone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full md:w-1/3"
        />
        <Input
          placeholder="Filtrar por serviço"
          value={filterService}
          onChange={(e) => setFilterService(e.target.value)}
          className="w-full md:w-1/3"
        />
      </div>

      {/* Lista */}
      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">Tabela</TabsTrigger>
          <TabsTrigger value="cards">Cards</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <Card>
            <CardHeader>
              <CardTitle>Pacientes</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Serviço</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead className="w-44">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPatients.map((p) => (
                    <TableRow key={p.id} className="hover:bg-gray-50 transition">
                      <TableCell>{p.name}</TableCell>
                      <TableCell>{p.email}</TableCell>
                      <TableCell>{p.phone}</TableCell>
                      <TableCell className="max-w-[240px] truncate" title={p.tipo_atendimento}>
                        {p.tipo_atendimento || "-"}
                      </TableCell>
                      <TableCell>
                        {p.valor_mensal != null ? `R$ ${Number(p.valor_mensal).toLocaleString("pt-BR")}` : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => openView(p)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="sm" className="bg-yellow-500 hover:bg-yellow-600 text-white" onClick={() => openEdit(p)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => handleDelete(p)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredPatients.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                        Nenhum paciente encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cards">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredPatients.map((p) => (
              <Card key={p.id} className="hover:shadow-md transition">
                <CardHeader>
                  <CardTitle className="text-lg">{p.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <div><b>Email:</b> {p.email || "-"}</div>
                  <div><b>Telefone:</b> {p.phone || "-"}</div>
                  <div className="line-clamp-3"><b>Serviços:</b> {p.tipo_atendimento || "-"}</div>
                  <div><b>Valor:</b> {p.valor_mensal != null ? `R$ ${Number(p.valor_mensal).toLocaleString("pt-BR")}` : "-"}</div>

                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="outline" onClick={() => openView(p)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button size="sm" className="bg-yellow-500 hover:bg-yellow-600 text-white" onClick={() => openEdit(p)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => handleDelete(p)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal: Visualizar */}
      <Dialog open={!!viewPatient} onOpenChange={(open) => !open && setViewPatient(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes do Paciente</DialogTitle>
          </DialogHeader>
          {viewPatient && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><b>Nome:</b> {viewPatient.name}</div>
              <div><b>Email:</b> {viewPatient.email}</div>
              <div><b>Telefone:</b> {viewPatient.phone || "-"}</div>
              <div><b>CPF:</b> {viewPatient.cpf || "-"}</div>
              <div><b>Nascimento:</b> {viewPatient.birth_date ? new Date(viewPatient.birth_date).toLocaleDateString("pt-BR") : "-"}</div>
              <div className="col-span-2"><b>Endereço:</b> {viewPatient.address || "-"}</div>
              <div className="col-span-2"><b>Responsável:</b> {viewPatient.responsavel || "-"}</div>
              <div className="col-span-2"><b>Serviço(s):</b> {viewPatient.tipo_atendimento || "-"}</div>
              <div><b>Valor:</b> {viewPatient.valor_mensal != null ? `R$ ${Number(viewPatient.valor_mensal).toLocaleString("pt-BR")}` : "-"}</div>
              <div><b>Status:</b> {viewPatient.is_active ? "Ativo" : "Inativo"}</div>
              <div className="col-span-2"><b>Criado em:</b> {viewPatient.created_at ? new Date(viewPatient.created_at).toLocaleString("pt-BR") : "-"}</div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Editar */}
      <Dialog open={isEditOpen} onOpenChange={(open) => { if (!open) { setIsEditOpen(false); setEditing(null); } }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Editar Paciente</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid grid-cols-2 gap-4">
              {/* users */}
              <Input
                placeholder="Nome"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
              <Input
                placeholder="Email"
                type="email"
                value={editing.email}
                onChange={(e) => setEditing({ ...editing, email: e.target.value })}
              />
              <Input
                placeholder="Telefone"
                value={editing.phone || ""}
                onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
              />
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={editing.is_active ? "true" : "false"}
                onChange={(e) => setEditing({ ...editing, is_active: e.target.value === "true" })}
              >
                <option value="true">Ativo</option>
                <option value="false">Inativo</option>
              </select>

              {/* patients */}
              <Input
                placeholder="CPF"
                value={editing.cpf || ""}
                onChange={(e) => setEditing({ ...editing, cpf: e.target.value })}
              />
              <Input
                type="date"
                value={editing.birth_date ? String(editing.birth_date).slice(0,10) : ""}
                onChange={(e) => setEditing({ ...editing, birth_date: e.target.value || null })}
              />
              <Input
                placeholder="Endereço"
                value={editing.address || ""}
                onChange={(e) => setEditing({ ...editing, address: e.target.value })}
              />
              <Input
                placeholder="Responsável"
                value={editing.responsavel || ""}
                onChange={(e) => setEditing({ ...editing, responsavel: e.target.value })}
              />
              <Input
                placeholder="Serviço(s)"
                value={editing.tipo_atendimento || ""}
                onChange={(e) => setEditing({ ...editing, tipo_atendimento: e.target.value })}
              />
              <Input
                type="number"
                placeholder="Valor mensal"
                value={editing.valor_mensal != null ? String(editing.valor_mensal) : ""}
                onChange={(e) =>
                  setEditing({ ...editing, valor_mensal: e.target.value === "" ? null : Number(e.target.value) })
                }
              />

              <div className="col-span-2 flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => { setIsEditOpen(false); setEditing(null); }}>
                  Cancelar
                </Button>
                <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={saveEdit}>
                  Salvar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
