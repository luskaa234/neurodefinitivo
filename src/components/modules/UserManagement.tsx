"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  UserPlus, Edit, Trash2, Copy, Eye, Users, UserCheck, UserX, Activity, Upload, Download
} from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { User } from "@/types";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

const userSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  role: z.enum(["admin", "financeiro", "agendamento", "medico", "paciente"]),
  email: z.string().email("Email inválido").optional(),
  is_active: z.boolean().optional(),
});

type UserFormData = z.infer<typeof userSchema>;

type Cred = { name: string; role: string; email: string; password: string };

export function UserManagement() {
  const { users, addUser, updateUser, deleteUser } = useApp();

  // modais
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCredsOpen, setIsCredsOpen] = useState(false);
  const [isBulkCredsOpen, setIsBulkCredsOpen] = useState(false);
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false); // NOVO: confirmar deleção em massa

  // seleção
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState<"todos" | User["role"]>("todos");
  const [filterStatus, setFilterStatus] = useState<"todos" | "ativos" | "inativos">("todos");

  // credenciais geradas
  const [generatedLogin, setGeneratedLogin] = useState<Cred | null>(null);
  const [bulkCreds, setBulkCreds] = useState<Cred[]>([]);

  // import/export
  const fileRef = useRef<HTMLInputElement>(null);
  const [deletingMany, setDeletingMany] = useState(false); // NOVO: estado de loading da deleção em massa

  // ----- helpers -----
  const getRoleLabel = (role: string) => {
    const labels = {
      admin: "Administrador",
      financeiro: "Financeiro",
      agendamento: "Agendamento",
      medico: "Médico",
      paciente: "Paciente",
    };
    return labels[role as keyof typeof labels] || role;
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin": return "destructive";
      case "financeiro": return "default";
      case "agendamento": return "secondary";
      case "medico": return "outline";
      case "paciente": return "secondary";
      default: return "outline";
    }
  };

  const normalize = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const isEmailInUse = (email: string, excludeId?: string) =>
    users.some(u => u.email.toLowerCase() === email.toLowerCase() && u.id !== excludeId);

  const normalizeRoleToKey = (r: string): User["role"] | null => {
    const t = normalize(r).trim();
    if (["admin", "administrador"].includes(t)) return "admin";
    if (["financeiro"].includes(t)) return "financeiro";
    if (["agendamento"].includes(t)) return "agendamento";
    if (["medico", "médico"].includes(t)) return "medico";
    if (["paciente"].includes(t)) return "paciente";
    return null;
  };

  // Gera email único com base no primeiro + segundo nome; adiciona sufixo se já existir
  const generateUniqueEmail = (fullName: string, usedEmails: Set<string>) => {
    const parts = normalize(fullName).trim().split(/\s+/);
    const first = (parts[0] || "usuario").replace(/[^a-z0-9]/g, "");
    const second = (parts[1] || "").replace(/[^a-z0-9]/g, "");
    const base = `${first}${second}` || "usuario";
    const domain = "@neurointegrar.com";

    let candidate = base;
    let email = `${candidate}${domain}`;
    let i = 1;
    while (usedEmails.has(email)) {
      candidate = `${base}${i++}`;
      email = `${candidate}${domain}`;
    }
    usedEmails.add(email);
    return email;
  };

  // senha simples: primeiro nome + 4 dígitos
  const generatePassword = (fullName: string) => {
    const first = (normalize(fullName).trim().split(/\s+/)[0] || "usuario").replace(/[^a-z0-9]/g, "");
    const rnd = Math.floor(1000 + Math.random() * 9000);
    return `${first}${rnd}`;
  };

  // ----- forms -----
  // criar
  const {
    register: registerCreate,
    handleSubmit: handleSubmitCreate,
    setValue: setValueCreate,
    reset: resetCreate,
    formState: { isSubmitting: creating }
  } = useForm<UserFormData>({ resolver: zodResolver(userSchema) });

  // editar
  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    setValue: setValueEdit,
    reset: resetEdit,
    formState: { isSubmitting: savingEdit }
  } = useForm<UserFormData>({ resolver: zodResolver(userSchema) });

  // ----- filtros -----
  const filteredUsers = useMemo(() => {
    let data = [...users];

    if (filterRole !== "todos") data = data.filter(u => u.role === filterRole);
    if (filterStatus === "ativos") data = data.filter(u => u.is_active);
    if (filterStatus === "inativos") data = data.filter(u => !u.is_active);

    if (searchTerm.trim()) {
      const t = searchTerm.toLowerCase();
      data = data.filter(u =>
        u.name.toLowerCase().includes(t) || u.email.toLowerCase().includes(t)
      );
    }
    return data;
  }, [users, filterRole, filterStatus, searchTerm]);

  // ----- stats -----
  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter(u => u.is_active).length,
    inactive: users.filter(u => !u.is_active).length,
    doctors: users.filter(u => u.role === "medico").length,
  }), [users]);

  // ----- actions -----
  // Criar usuário
  const onCreate = async (data: UserFormData) => {
    const used = new Set(users.map(u => u.email.toLowerCase()));
    const email = generateUniqueEmail(data.name, used);
    const password = generatePassword(data.name);

    const newUser: Omit<User, "id" | "created_at"> = {
      name: data.name,
      email,
      role: data.role,
      is_active: true,
      phone: "",
      cpf: "",
      crm: "",
      specialty: "",
    };

    try {
      const ok = await addUser(newUser);
      if (ok) {
        setGeneratedLogin({ name: newUser.name, role: newUser.role, email, password });
        setIsCredsOpen(true);
        toast.success("Usuário criado com sucesso!");
        resetCreate();
        setIsCreateOpen(false);
      }
    } catch (e: any) {
      if (String(e?.status || e).includes("409")) {
        toast.error("Conflito de email (já existe). Tente novamente.");
      } else {
        toast.error("Erro ao criar usuário.");
      }
      console.error(e);
    }
  };

  // Abrir modal de editar
  const onOpenEdit = (u: User) => {
    setEditingUser(u);
    setValueEdit("name", u.name);
    setValueEdit("email", u.email);
    setValueEdit("role", u.role);
    setValueEdit("is_active", u.is_active);
    setIsEditOpen(true);
  };

  // Editar usuário
  const onEdit = async (data: UserFormData) => {
    if (!editingUser) return;

    if (data.email && isEmailInUse(data.email, editingUser.id)) {
      toast.error("Este e-mail já está em uso por outro usuário.");
      return;
    }

    try {
      const ok = await updateUser(editingUser.id, {
        name: data.name,
        email: data.email,
        role: data.role,
        is_active: data.is_active,
      });
      if (ok) {
        toast.success("Usuário atualizado com sucesso!");
        setIsEditOpen(false);
        setEditingUser(null);
        resetEdit();
      }
    } catch (e: any) {
      if (String(e?.status || e).includes("409")) {
        toast.error("Conflito de e-mail ao salvar. Escolha outro e-mail.");
      } else {
        toast.error("Erro ao atualizar usuário.");
      }
      console.error(e);
    }
  };

  // Excluir (individual)
  const onDelete = async (u: User) => {
    if (!window.confirm(`Deseja realmente excluir ${u.name}?`)) return;
    try {
      const ok = await deleteUser(u.id);
      if (ok) toast.success("Usuário excluído!");
    } catch (e) {
      toast.error("Erro ao excluir usuário.");
      console.error(e);
    }
  };

  // Copiar credenciais (modal individual)
  const copyCreds = () => {
    if (!generatedLogin) return;
    const { name, role, email, password } = generatedLogin;
    const text = `👤 Nome: ${name}
🔑 Tipo de login: ${getRoleLabel(role)}
📧 Email: ${email}
🔒 Senha: ${password}`;
    navigator.clipboard.writeText(text);
    toast.success("Credenciais copiadas!");
  };

  // --------- IMPORT / EXPORT CSV ----------
  const triggerImport = () => fileRef.current?.click();

  // parser simples (aceita vírgula ou ponto e vírgula; com ou sem header)
  const parseCSV = (raw: string): Array<{ name: string; role: string }> => {
    const text = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
    const lines = text.split("\n").filter(Boolean);
    if (lines.length === 0) return [];

    const splitLine = (line: string) => {
      if (line.includes(";") && !line.includes(",")) return line.split(";").map(s => s.trim());
      return line.split(",").map(s => s.trim());
    };

    const header = splitLine(lines[0]).map(normalize);
    let startIdx = 0;
    let idxName = -1, idxRole = -1;

    if (header.some(h => ["name", "nome"].includes(h)) || header.includes("role")) {
      idxName = header.findIndex(h => ["name", "nome"].includes(h));
      idxRole = header.findIndex(h => ["role", "perfil", "tipo", "funcao", "função"].includes(h));
      startIdx = 1;
    } else {
      idxName = 0;
      idxRole = 1;
      startIdx = 0;
    }

    const rows: Array<{ name: string; role: string }> = [];
    for (let i = startIdx; i < lines.length; i++) {
      const cols = splitLine(lines[i]);
      const name = (cols[idxName] || "").trim();
      const role = (cols[idxRole] || "").trim();
      if (!name || !role) continue;
      rows.push({ name, role });
    }
    return rows;
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset para permitir reimport
    if (!file) return;

    try {
      const text = await file.text();
      const rows = parseCSV(text);
      if (rows.length === 0) {
        toast.error("CSV vazio ou inválido. Use colunas: name,role");
        return;
      }

      const usedEmails = new Set(users.map(u => u.email.toLowerCase()));
      const createdCreds: Cred[] = [];
      let createdCount = 0;
      let skippedCount = 0;

      for (const row of rows) {
        const roleKey = normalizeRoleToKey(row.role);
        if (!roleKey) {
          skippedCount++;
          continue;
        }

        const email = generateUniqueEmail(row.name, usedEmails);
        const password = generatePassword(row.name);

        const newUser: Omit<User, "id" | "created_at"> = {
          name: row.name,
          email,
          role: roleKey,
          is_active: true,
          phone: "",
          cpf: "",
          crm: "",
          specialty: "",
        };

        try {
          const ok = await addUser(newUser);
          if (ok) {
            createdCreds.push({
              name: newUser.name,
              role: newUser.role,
              email,
              password,
            });
            createdCount++;
          }
        } catch {
          skippedCount++;
        }
      }

      if (createdCreds.length) {
        setBulkCreds(createdCreds);
        setIsBulkCredsOpen(true);
      }

      if (createdCount > 0) toast.success(`${createdCount} usuário(s) importado(s) com sucesso.`);
      if (skippedCount > 0) toast.message(`${skippedCount} linha(s) ignorada(s) (perfil inválido ou erro).`);
    } catch (err) {
      console.error(err);
      toast.error("Falha ao ler o arquivo CSV.");
    }
  };

  const exportCSV = (data: User[]) => {
    const header = ["name", "email", "role", "status", "created_at"];
    const rows = data.map(u => [
      `"${u.name.replace(/"/g, '""')}"`,
      `"${u.email.replace(/"/g, '""')}"`,
      `"${u.role}"`,
      `"${u.is_active ? "ativo" : "inativo"}"`,
      `"${new Date(u.created_at).toISOString()}"`
    ].join(","));
    const csv = [header.join(","), ...rows].join("\r\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `usuarios_export_${new Date().toISOString().slice(0,19).replace(/[:T]/g,"-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // --------- APAGAR TUDO (TODOS ou FILTRADOS) ----------
  const deleteMany = async (list: User[]) => {
    if (list.length === 0) {
      toast.message("Nada para apagar.");
      return;
    }
    setDeletingMany(true);
    try {
      const results = await Promise.allSettled(list.map(u => deleteUser(u.id)));
      const ok = results.filter(r => r.status === "fulfilled").length;
      const fail = results.length - ok;
      if (ok > 0) toast.success(`${ok} usuário(s) apagado(s).`);
      if (fail > 0) toast.error(`${fail} falha(s) ao apagar.`);
    } catch (e) {
      toast.error("Erro na deleção em massa.");
      console.error(e);
    } finally {
      setDeletingMany(false);
      setIsDeleteAllOpen(false);
    }
  };

  // ----- UI -----
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Gestão de Usuários</h1>
          <p className="text-gray-500">Controle total de usuários, papéis e acessos</p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={triggerImport}>
            <Upload className="h-4 w-4 mr-2" />
            Importar CSV
          </Button>
          <input
            type="file"
            ref={fileRef}
            accept=".csv"
            className="hidden"
            onChange={handleImportFile}
          />

          <Button variant="outline" onClick={() => exportCSV(filteredUsers)}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>

          {/* NOVO: Apagar Tudo (abre diálogo de confirmação) */}
          <Button
            variant="destructive"
            onClick={() => setIsDeleteAllOpen(true)}
            disabled={users.length === 0}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Apagar Tudo
          </Button>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
                <UserPlus className="h-4 w-4 mr-2" />
                Novo Usuário
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg bg-white rounded-2xl border border-gray-100 shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-indigo-700 text-2xl font-semibold text-center">
                  Criar Novo Usuário
                </DialogTitle>
                <DialogDescription className="text-center">
                  Informe o nome e o tipo. O e-mail e a senha serão gerados automaticamente.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmitCreate(onCreate)} className="space-y-5 mt-2">
                <div className="space-y-2">
                  <Label>Nome completo</Label>
                  <Input placeholder="Ex: João Silva" {...registerCreate("name")} />
                </div>

                <div className="space-y-2">
                  <Label>Tipo de usuário</Label>
                  <Select onValueChange={(v) => setValueCreate("role", v as any)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="financeiro">Financeiro</SelectItem>
                      <SelectItem value="agendamento">Agendamento</SelectItem>
                      <SelectItem value="medico">Médico</SelectItem>
                      <SelectItem value="paciente">Paciente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="pt-3">
                  <Button type="submit" disabled={creating} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                    {creating ? "Criando..." : "Criar Usuário"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col md:flex-row gap-3 md:items-end md:justify-between">
        <div className="w-full md:w-[38%]">
          <Label>Pesquisar</Label>
          <Input
            placeholder="Buscar por nome ou email..."
            className="mt-1"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="w-full md:w-[28%]">
          <Label>Filtrar por tipo</Label>
          <Select value={filterRole} onValueChange={(v) => setFilterRole(v as any)}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="admin">Administrador</SelectItem>
              <SelectItem value="financeiro">Financeiro</SelectItem>
              <SelectItem value="agendamento">Agendamento</SelectItem>
              <SelectItem value="medico">Médico</SelectItem>
              <SelectItem value="paciente">Paciente</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-full md:w-[28%]">
          <Label>Status</Label>
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ativos">Ativos</SelectItem>
              <SelectItem value="inativos">Inativos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-none shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-indigo-800">Total</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-between">
            <span className="text-3xl font-bold text-indigo-700">{stats.total}</span>
            <Users className="h-6 w-6 text-indigo-700" />
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-none shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-green-800">Ativos</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-between">
            <span className="text-3xl font-bold text-green-700">{stats.active}</span>
            <UserCheck className="h-6 w-6 text-green-700" />
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-none shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-red-800">Inativos</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-between">
            <span className="text-3xl font-bold text-red-700">{stats.inactive}</span>
            <UserX className="h-6 w-6 text-red-700" />
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-none shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-purple-800">Médicos</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-between">
            <span className="text-3xl font-bold text-purple-700">{stats.doctors}</span>
            <Activity className="h-6 w-6 text-purple-700" />
          </CardContent>
        </Card>
      </div>

      {/* Tabela */}
      <Card className="border-gray-200 shadow-md">
        <CardHeader>
          <CardTitle>Lista de Usuários</CardTitle>
          <CardDescription>Visualize, edite ou remova usuários</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredUsers.length === 0 ? (
            <p className="text-center text-gray-500 py-8">Nenhum usuário encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-40">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((u) => (
                    <TableRow key={u.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(u.role)}>{getRoleLabel(u.role)}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.is_active ? "default" : "destructive"}>
                          {u.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => { setSelectedUser(u); setIsViewOpen(true); }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => onOpenEdit(u)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => onDelete(u)}>
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal: Visualizar */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl border border-gray-100 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Detalhes do Usuário</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
              <p><b>Nome:</b> {selectedUser.name}</p>
              <p><b>Email:</b> {selectedUser.email}</p>
              <p><b>Tipo:</b> {getRoleLabel(selectedUser.role)}</p>
              <p><b>Status:</b> {selectedUser.is_active ? "Ativo" : "Inativo"}</p>
              <p><b>Criado em:</b> {new Date(selectedUser.created_at).toLocaleDateString("pt-BR")}</p>
            </div>
          )}
          <div className="flex justify-end mt-3">
            <Button onClick={() => setIsViewOpen(false)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Editar */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg bg-white rounded-2xl border border-gray-100 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-indigo-700 text-2xl font-semibold text-center">Editar Usuário</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitEdit(onEdit)} className="space-y-5 mt-2">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input {...registerEdit("name")} />
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" {...registerEdit("email")} />
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                onValueChange={(v) => setValueEdit("role", v as any)}
                defaultValue={editingUser?.role}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="financeiro">Financeiro</SelectItem>
                  <SelectItem value="agendamento">Agendamento</SelectItem>
                  <SelectItem value="medico">Médico</SelectItem>
                  <SelectItem value="paciente">Paciente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                onValueChange={(v) => setValueEdit("is_active", v === "true")}
                defaultValue={String(editingUser?.is_active)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Ativo</SelectItem>
                  <SelectItem value="false">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="pt-3">
              <Button type="submit" disabled={savingEdit} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                {savingEdit ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Credenciais geradas (individual) */}
      <Dialog open={isCredsOpen} onOpenChange={setIsCredsOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl border border-gray-100 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-indigo-700 text-xl font-semibold text-center">
              Credenciais de Login
            </DialogTitle>
            <DialogDescription className="text-center">
              Guarde essas informações com segurança.
            </DialogDescription>
          </DialogHeader>
          {generatedLogin && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 space-y-2">
              <p><b>👤 Nome:</b> {generatedLogin.name}</p>
              <p><b>🔑 Tipo de login:</b> {getRoleLabel(generatedLogin.role)}</p>
              <p><b>📧 Email:</b> {generatedLogin.email}</p>
              <p><b>🔒 Senha:</b> {generatedLogin.password}</p>
            </div>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={copyCreds}>
              <Copy className="h-4 w-4 mr-2" />
              Copiar tudo
            </Button>
            <Button onClick={() => setIsCredsOpen(false)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Credenciais geradas (import em lote) */}
      <Dialog open={isBulkCredsOpen} onOpenChange={setIsBulkCredsOpen}>
        <DialogContent className="max-w-xl bg-white rounded-2xl border border-gray-100 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-indigo-700 text-xl font-semibold text-center">
              Credenciais Geradas (Importação)
            </DialogTitle>
            <DialogDescription className="text-center">
              Copie e entregue as credenciais aos usuários.
            </DialogDescription>
          </DialogHeader>
          {bulkCreds.length > 0 ? (
            <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 space-y-3 max-h-[50vh] overflow-auto">
              {bulkCreds.map((c, i) => (
                <div key={`${c.email}-${i}`} className="bg-white border border-gray-200 rounded-md p-3">
                  <p><b>👤 Nome:</b> {c.name}</p>
                  <p><b>🔑 Tipo de login:</b> {getRoleLabel(c.role)}</p>
                  <p><b>📧 Email:</b> {c.email}</p>
                  <p><b>🔒 Senha:</b> {c.password}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-6">Nenhuma credencial gerada.</p>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                const text = bulkCreds.map(c =>
`👤 Nome: ${c.name}
🔑 Tipo de login: ${getRoleLabel(c.role)}
📧 Email: ${c.email}
🔒 Senha: ${c.password}`).join("\n\n");
                navigator.clipboard.writeText(text);
                toast.success("Todas as credenciais foram copiadas!");
              }}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copiar tudo
            </Button>
            <Button onClick={() => setIsBulkCredsOpen(false)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* NOVO: Modal de confirmação — Apagar Tudo */}
      <Dialog open={isDeleteAllOpen} onOpenChange={setIsDeleteAllOpen}>
        <DialogContent className="max-w-lg bg-white rounded-2xl border border-gray-100 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-red-600 text-xl font-semibold text-center">
              Apagar usuários em massa
            </DialogTitle>
            <DialogDescription className="text-center">
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-red-50 border border-red-100 rounded-lg p-4 space-y-2 text-red-800">
            <p><b>Total de usuários:</b> {users.length}</p>
            <p><b>Aplicado no filtro atual:</b> {filteredUsers.length}</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 justify-end mt-4">
            <Button
              variant="outline"
              onClick={() => deleteMany(filteredUsers)}
              disabled={deletingMany || filteredUsers.length === 0}
            >
              {deletingMany ? "Apagando..." : `Apagar apenas filtrados (${filteredUsers.length})`}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMany(users)}
              disabled={deletingMany || users.length === 0}
            >
              {deletingMany ? "Apagando..." : `Apagar TODOS (${users.length})`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
