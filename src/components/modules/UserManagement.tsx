"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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
  Eye,
  EyeOff,
  UserPlus,
  Edit,
  Trash2,
  Copy,
  Users,
  UserCheck,
  UserX,
  Activity,
  Upload,
  Download,
  Clipboard,
  Search,
} from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { supabase } from "@/lib/supabase";
import { User } from "@/types";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { formatDateBR } from "@/utils/date";

const EMAIL_DOMAIN = "sistema.com"; // <--- ajuste aqui para seu domínio real

const userSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  role: z.enum(["admin", "financeiro", "agendamento", "medico", "paciente"]),
  email: z.string().email("Email inválido").optional(),
  is_active: z.boolean().optional(),
  password: z.string().optional(),
});

type UserFormData = z.infer<typeof userSchema>;

type Cred = { name: string; role: string; email: string; password: string };

export function UserManagement() {
  const { users, addUser, reloadAll } = useApp();

  // modais
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCredsOpen, setIsCredsOpen] = useState(false);

  // seleção
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // senha show/hidden
  const [showPassword, setShowPassword] = useState(false);
  const [showViewPassword, setShowViewPassword] = useState(false);

  // filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState<"todos" | User["role"]>("todos");
  const [filterStatus, setFilterStatus] = useState<
    "todos" | "ativos" | "inativos"
  >("todos");

  // credenciais geradas
  const [generatedLogin, setGeneratedLogin] = useState<Cred | null>(null);

  // UI helpers
  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: "Administrador",
      financeiro: "Financeiro",
      agendamento: "Agendamento",
      medico: "Médico",
      paciente: "Paciente",
    };
    return labels[role] || role;
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin":
        return "destructive";
      case "financeiro":
        return "default";
      case "agendamento":
        return "secondary";
      case "medico":
        return "outline";
      case "paciente":
        return "secondary";
      default:
        return "outline";
    }
  };

  const normalize = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const isEmailInUse = (email: string, excludeId?: string) =>
    users.some(
      (u) => (u.email || "").toLowerCase() === email.toLowerCase() && u.id !== excludeId
    );

  const generatePassword = (name: string) => {
    const first = normalize(name).split(" ")[0] || "user";
    const rnd = Math.floor(1000 + Math.random() * 9000);
    return `${first}${rnd}`;
  };

  // gera email base a partir do nome: primeiro.sobrenome@domain
  const generateEmailFromName = (name: string) => {
    const parts = normalize(name)
      .replace(/[^a-z\s]/g, "")
      .split(/\s+/)
      .filter(Boolean);
    if (parts.length === 0) return `user@${EMAIL_DOMAIN}`;
    if (parts.length === 1) return `${parts[0]}@${EMAIL_DOMAIN}`;
    const first = parts[0];
    const last = parts[parts.length - 1];
    let base = `${first}.${last}`.replace(/\.+/g, ".");
    base = base.replace(/(^\.)|(\.$)/g, "");
    // garantir unicidade adicionando sufixo numérico se necessário
    let candidate = `${base}@${EMAIL_DOMAIN}`;
    let i = 1;
    while (isEmailInUse(candidate)) {
      i += 1;
      candidate = `${base}${i}@${EMAIL_DOMAIN}`;
      if (i > 1000) break;
    }
    return candidate;
  };

  // forms
  const {
    register: registerCreate,
    handleSubmit: handleSubmitCreate,
    setValue: setValueCreate,
    reset: resetCreate,
    watch: watchCreate,
    formState: { isSubmitting: creating },
  } = useForm<UserFormData>({ resolver: zodResolver(userSchema) });

  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    setValue: setValueEdit,
    reset: resetEdit,
    watch: watchEdit,
    formState: { isSubmitting: savingEdit },
  } = useForm<UserFormData>({ resolver: zodResolver(userSchema) });

  // quando abrir criar, reset e preenche email automaticamente ao digitar nome
  useEffect(() => {
    if (isCreateOpen) {
      resetCreate({ name: "", email: "", role: "paciente", is_active: true });
    }
  }, [isCreateOpen, resetCreate]);

  // observa nome no form de criação para atualizar preview do email automaticamente
  const createName = watchCreate("name") || "";
  useEffect(() => {
    if (!createName) return;
    const generated = generateEmailFromName(createName);
    // só preenche o campo email se o usuário ainda não editou manualmente
    const currentEmail = (watchCreate("email") || "").trim();
    if (!currentEmail || currentEmail === "" || currentEmail.endsWith(`@${EMAIL_DOMAIN}`)) {
      setValueCreate("email", generated);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createName]);

  // efeito: quando abrir editar, popular valores no form
  useEffect(() => {
    if (isEditOpen && editingUser) {
      setValueEdit("name", editingUser.name);
      setValueEdit("email", editingUser.email || "");
      setValueEdit("role", editingUser.role as any);
      setValueEdit("is_active", !!editingUser.is_active);
      setShowPassword(false);
    } else if (!isEditOpen) {
      resetEdit();
      setEditingUser(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditOpen, editingUser]);

  // abrir modal visualizar
  const openView = (user: User) => {
    setSelectedUser(user);
    setShowViewPassword(false);
    setIsViewOpen(true);
  };

  // abrir modal editar
  const openEdit = (user: User) => {
    setEditingUser(user);
    setIsEditOpen(true);
  };

  // copiar para clipboard com toast
  const copyToClipboard = async (text: string, label = "Texto copiado") => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(label);
    } catch {
      toast.error("Erro ao copiar.");
    }
  };

  // criar usuário
  const onCreate = async (data: UserFormData) => {
    try {
      // se email vazio, gerar
      let email = data.email && data.email.trim() !== "" ? data.email.trim() : generateEmailFromName(data.name);
      // se email já em uso, garantir suffix
      if (isEmailInUse(email)) {
        // gera baseado em nome com sufixo incremental (a função generateEmailFromName já cuida, mas reafirmamos)
        email = generateEmailFromName(data.name);
      }

      const password = generatePassword(data.name);

      const newUser: Omit<User, "id" | "created_at"> = {
        name: data.name,
        email,
        role: data.role,
        is_active: data.is_active ?? true,
        phone: "",
        cpf: "",
        crm: "",
        specialty: "",
      } as any;

      // Tenta enviar senha também; se sua addUser não aceitar senha, ajuste lá.
      let ok = false;
      try {
        // @ts-ignore - chamada flexível para diferentes assinaturas
        ok = await addUser(newUser, password);
      } catch {
        // tenta sem senha
        // @ts-ignore
        ok = await addUser(newUser);
      }

      if (ok) {
        setGeneratedLogin({
          name: newUser.name,
          role: newUser.role,
          email: newUser.email,
          password,
        });
        setIsCredsOpen(true);
        setIsCreateOpen(false);
        toast.success("Usuário criado com sucesso!");
      } else {
        toast.error("Falha ao criar usuário.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Erro ao criar usuário.");
    }
  };

  // editar usuário
  const onEdit = async (data: UserFormData) => {
    if (!editingUser) return;
    try {
      // valida email único se alterado
      if (data.email && data.email.trim() !== "" && isEmailInUse(data.email.trim(), editingUser.id)) {
        toast.error("Email já está em uso por outro usuário.");
        return;
      }

      const payload: Partial<User> = {
        name: data.name,
        email: data.email,
        role: data.role,
        is_active: data.is_active,
      } as any;

      if (data.password && data.password.trim() !== "") {
        (payload as any).password = data.password;
      }

      const { error } = await supabase.from("users").update(payload).eq("id", editingUser.id);
      if (error) {
        toast.error("Falha ao atualizar usuário.");
        return;
      }
      toast.success("Usuário atualizado com sucesso!");
      setIsEditOpen(false);
      setEditingUser(null);
      await reloadAll();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar alterações.");
    }
  };

  // deletar usuário
  const handleDelete = async (id: string) => {
    try {
      const { data: asPatient, error: patientErr } = await supabase
        .from("appointments")
        .select("id")
        .eq("patient_id", id)
        .limit(1);

      if (patientErr) {
        toast.error("Erro ao verificar agendamentos do paciente.");
        return;
      }

      const { data: asDoctor, error: doctorErr } = await supabase
        .from("appointments")
        .select("id")
        .eq("doctor_id", id)
        .limit(1);

      if (doctorErr) {
        toast.error("Erro ao verificar agendamentos do médico.");
        return;
      }

      if ((asPatient && asPatient.length > 0) || (asDoctor && asDoctor.length > 0)) {
        toast.error("Não é possível excluir: usuário possui agendamentos.");
        return;
      }

      await supabase.from("medicos").delete().eq("user_id", id);

      const { error } = await supabase.from("users").delete().eq("id", id);
      if (error) {
        toast.error(error.message || "Erro ao remover usuário.");
        return;
      }
      toast.success("Usuário removido.");
      await reloadAll();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao remover usuário.");
    }
  };

  // filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (filterRole !== "todos" && u.role !== filterRole) return false;
      if (filterStatus === "ativos" && !u.is_active) return false;
      if (filterStatus === "inativos" && u.is_active) return false;
      if (!searchTerm) return true;
      const q = normalize(searchTerm);
      return (
        normalize(u.name).includes(q) ||
        (u.email && normalize(u.email).includes(q)) ||
        (u.phone && normalize(u.phone).includes(q))
      );
    });
  }, [users, filterRole, filterStatus, searchTerm]);

  const totalUsers = users.length;
  const totalActive = users.filter((u) => u.is_active).length;
  const totalInactive = totalUsers - totalActive;
  const totalDoctors = users.filter((u) => u.role === "medico").length;

  return (
    <div className="space-y-8 px-2 sm:px-4">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Usuários</h1>
          <p className="text-sm text-gray-500">
            Gerencie acessos, permissões e status do time.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-700 sm:text-xs">
            Total: {totalUsers}
          </div>
          <div className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-[11px] font-semibold text-green-700 sm:text-xs">
            Ativos: {totalActive}
          </div>
          <div className="rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 text-[11px] font-semibold text-yellow-700 sm:text-xs">
            Inativos: {totalInactive}
          </div>
          <div className="rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-[11px] font-semibold text-purple-700 sm:text-xs">
            Médicos: {totalDoctors}
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <Button onClick={() => setIsCreateOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            <UserPlus className="mr-2 h-4 w-4" /> Novo Usuário
          </Button>
          <div className="flex items-center border rounded-lg px-2 w-full md:w-1/3 bg-white">
            <Search className="h-4 w-4 text-gray-400 mr-2" />
            <Input
              placeholder="Pesquisar por nome ou email"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <Select
            value={filterRole}
            onValueChange={(v) =>
              setFilterRole(v as "todos" | User["role"])
            }
          >
            <SelectTrigger className="min-w-[180px] rounded-lg">
              <SelectValue placeholder="Filtrar por tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="admin">Administrador</SelectItem>
              <SelectItem value="financeiro">Financeiro</SelectItem>
              <SelectItem value="agendamento">Agendamento</SelectItem>
              <SelectItem value="medico">Médico</SelectItem>
              <SelectItem value="paciente">Paciente</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filterStatus}
            onValueChange={(v) =>
              setFilterStatus(v as "todos" | "ativos" | "inativos")
            }
          >
            <SelectTrigger className="min-w-[120px] rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ativos">Ativos</SelectItem>
              <SelectItem value="inativos">Inativos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabela de usuários */}
      <Card className="border border-gray-100 shadow-sm">
        <CardHeader>
          <CardTitle>Lista de Usuários</CardTitle>
          <CardDescription>Usuários cadastrados no sistema</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
        <div className="w-full overflow-x-auto">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((u) => (
                <TableRow key={u.id} className="hover:bg-gray-50">
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="text-gray-600">{u.email}</TableCell>
                  <TableCell>
                    <Badge variant={getRoleBadgeVariant(u.role)}>
                      {getRoleLabel(u.role)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {u.is_active ? (
                      <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">
                        Ativo
                      </span>
                    ) : u.role === "medico" ? (
                      <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-700">
                        Pendente
                      </span>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600">
                        Inativo
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {u.role === "medico" && !u.is_active && (
                        <Button
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                          onClick={() => openEdit(u)}
                        >
                          Completar cadastro
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => openView(u)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(u)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(u.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {filteredUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    Nenhum usuário encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        </CardContent>
      </Card>

      {/* Modal: Visualizar */}
      <Dialog open={isViewOpen} onOpenChange={(open) => setIsViewOpen(open)}>
        <DialogContent className="max-w-md bg-white rounded-2xl border border-gray-100 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Detalhes do Usuário</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
              <p className="text-lg font-medium">{selectedUser.name}</p>
              <p><b>Email:</b> {selectedUser.email}</p>
              <p><b>Tipo:</b> {getRoleLabel(selectedUser.role)}</p>
              <p><b>Status:</b> {selectedUser.is_active ? "Ativo" : "Inativo"}</p>

              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <p className="text-sm"><b>Senha:</b> {showViewPassword ? (selectedUser.password || "Sem senha") : "••••••••"}</p>
                  <p className="text-xs text-gray-500">O admin pode ver senhas aqui.</p>
                </div>

                <div className="flex flex-col gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowViewPassword((s) => !s)}
                    title={showViewPassword ? "Ocultar senha" : "Ver senha"}
                  >
                    {showViewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(selectedUser.password || "", "Senha copiada")}
                    title="Copiar senha"
                  >
                    <Clipboard className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <p className="text-sm"><b>Criado em:</b> {selectedUser.created_at ? formatDateBR(selectedUser.created_at) : "-"}</p>

              <div className="flex gap-2 mt-2">
                <Button size="sm" onClick={() => { copyToClipboard(selectedUser.email || "", "Email copiado"); }}>
                  <Copy className="mr-2 h-4 w-4" /> Copiar Email
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setIsViewOpen(false); openEdit(selectedUser); }}>
                  <Edit className="mr-2 h-4 w-4" /> Editar
                </Button>
              </div>
            </div>
          )}
          <div className="flex justify-end mt-3">
            <Button onClick={() => setIsViewOpen(false)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Editar */}
      <Dialog open={isEditOpen} onOpenChange={(open) => setIsEditOpen(open)}>
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

            {/* Campo de senha */}
            <div className="space-y-2">
              <Label>Senha</Label>
              <div className="flex gap-2">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Nova senha (opcional)"
                  {...registerEdit("password")}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPassword((s) => !s)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-gray-500">Deixe em branco para manter a senha atual.</p>
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                defaultValue={editingUser?.role ?? "paciente"}
                onValueChange={(v) => setValueEdit("role", v as any)}
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
                key={editingUser?.id ?? "select-is-active"}
                defaultValue={String(editingUser?.is_active ?? true)}
                onValueChange={(v) => setValueEdit("is_active", v === "true")}
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

      {/* Modal: Criar Usuário */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => setIsCreateOpen(open)}>
        <DialogContent className="max-w-lg bg-white rounded-2xl border border-gray-100 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold text-center">Criar Usuário</DialogTitle>
            <DialogDescription className="text-center">O e-mail será gerado automaticamente a partir do nome — você pode editar se quiser.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitCreate(onCreate)} className="space-y-5 mt-2">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input {...registerCreate("name")} />
            </div>

            <div className="space-y-2">
              <Label>Email (gerado automaticamente)</Label>
              <div className="flex gap-2">
                <Input type="email" {...registerCreate("email")} />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const name = watchCreate("name") || "";
                    const gen = generateEmailFromName(name || "user");
                    setValueCreate("email", gen);
                    toast.success("Email gerado");
                  }}
                >
                  Gerar
                </Button>
              </div>
              <p className="text-xs text-gray-500">Formato: nome.sobrenome@{EMAIL_DOMAIN}</p>
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                defaultValue="paciente"
                onValueChange={(v) => setValueCreate("role", v as any)}
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

            <div className="pt-3 flex gap-2">
              <Button type="submit" disabled={creating} className="flex-1 bg-green-600 hover:bg-green-700 text-white">
                {creating ? "Criando..." : "Criar Usuário"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => { setIsCreateOpen(false); }}>
                Cancelar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal credenciais - exibidor com copiar */}
      <Dialog open={isCredsOpen} onOpenChange={(open) => setIsCredsOpen(open)}>
        <DialogContent className="max-w-md bg-white rounded-2xl border border-gray-100 shadow-2xl">
          <DialogHeader>
            <DialogTitle>Credenciais geradas</DialogTitle>
            <DialogDescription>Anote as credenciais abaixo e envie ao usuário.</DialogDescription>
          </DialogHeader>
          {generatedLogin && (
            <div className="p-4 space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-500">Nome</p>
                  <p className="font-medium">{generatedLogin.name}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => copyToClipboard(generatedLogin.name, "Nome copiado")}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium">{generatedLogin.email}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => copyToClipboard(generatedLogin.email, "Email copiado")}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-500">Senha</p>
                  <p className="font-medium">{generatedLogin.password}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => copyToClipboard(generatedLogin.password, "Senha copiada")}>
                    <Clipboard className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <p className="text-xs text-gray-500">Lembre-se de trocar senhas padrão após o primeiro acesso.</p>
            </div>
          )}
          <div className="flex justify-end gap-2 mt-3">
            <Button onClick={() => { setIsCredsOpen(false); setGeneratedLogin(null); }}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
