"use client";

import React, { useState } from 'react';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader,
  DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import {
  User, Edit, Save, X, Phone, Mail, Calendar, MapPin,
  Shield, Key, Copy
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';

const profileSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('Email inválido'),
  phone: z.string().optional(),
  cpf: z.string().optional(),
  birth_date: z.string().optional(),
  address: z.string().optional(),
  crm: z.string().optional(),
  specialty: z.string().optional(),
  password: z.string().optional()
});

type ProfileFormData = z.infer<typeof profileSchema>;

export function UserProfile() {
  const { user } = useAuth();
  const { updateUser } = useApp();
  const [isEditing, setIsEditing] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isLoginInfoDialogOpen, setIsLoginInfoDialogOpen] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema)
  });

  React.useEffect(() => {
    if (user) {
      setValue('name', user.name);
      setValue('email', user.email);
      setValue('phone', user.phone || '');
      setValue('cpf', user.cpf || '');
      setValue('birth_date', user.birth_date || '');
      setValue('address', user.address || '');
      setValue('crm', user.crm || '');
      setValue('specialty', user.specialty || '');
      setValue('password', '');
    }
  }, [user, setValue]);

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%';
    return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  };

  const onSubmit = async (data: ProfileFormData) => {
    if (!user) return;

    let newPassword = data.password;
    if (!newPassword) {
      newPassword = generatePassword();
      data.password = newPassword;
    }

    const success = await updateUser(user.id, data);

    if (success) {
      setIsEditing(false);
      setGeneratedPassword(newPassword);
      setIsLoginInfoDialogOpen(true);

      toast.success('Perfil atualizado com sucesso!');
      const updatedUser = { ...user, ...data };
      localStorage.setItem('neuro-integrar-user', JSON.stringify(updatedUser));
    }
  };

  const handleCancel = () => {
    reset();
    setIsEditing(false);
  };

  const getRoleLabel = (role: string) => {
    const labels = {
      admin: 'Administrador',
      financeiro: 'Financeiro',
      agendamento: 'Agendamento',
      medico: 'Médico',
      paciente: 'Paciente'
    };
    return labels[role as keyof typeof labels] || role;
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'financeiro': return 'default';
      case 'agendamento': return 'secondary';
      case 'medico': return 'outline';
      case 'paciente': return 'secondary';
      default: return 'outline';
    }
  };

  const calculateAge = (birthDate: string) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(`Login: ${user?.email}\nSenha: ${generatedPassword}`);
    toast.success('Informações copiadas!');
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Usuário não encontrado</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* --- Cabeçalho e botões --- */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Meu Perfil</h1>
          <p className="text-gray-600 mt-2">
            Gerencie suas informações pessoais e configurações
          </p>
        </div>

        <div className="flex space-x-2">
          <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Key className="mr-2 h-4 w-4" />
                Alterar Senha
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Alterar Senha</DialogTitle>
                <DialogDescription>
                  Uma nova senha será gerada automaticamente e exibida abaixo.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nova Senha (deixe vazio para gerar automaticamente)</Label>
                  <Input type="text" placeholder="Digite ou deixe em branco" {...register('password')} />
                </div>

                <div className="flex justify-end">
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Salvando...' : 'Salvar Senha'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)}>
              <Edit className="mr-2 h-4 w-4" />
              Editar Perfil
            </Button>
          ) : (
            <div className="flex space-x-2">
              <Button variant="outline" onClick={handleCancel}>
                <X className="mr-2 h-4 w-4" />
                Cancelar
              </Button>
              <Button onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
                <Save className="mr-2 h-4 w-4" />
                {isSubmitting ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* --- Corpo Principal (idêntico ao original) --- */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <User className="mr-2 h-5 w-5" />
              Informações Básicas
            </CardTitle>
            <CardDescription>Dados pessoais e de identificação</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center">
                <User className="h-8 w-8 text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">{user.name}</h3>
                <Badge variant={getRoleBadgeVariant(user.role)}>{getRoleLabel(user.role)}</Badge>
              </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome Completo</Label>
                {isEditing ? <Input id="name" {...register('name')} /> : <p className="p-2 bg-gray-50 rounded">{user.name}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                {isEditing ? <Input id="email" type="email" {...register('email')} /> : <p className="p-2 bg-gray-50 rounded">{user.email}</p>}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* --- Popup com dados de login --- */}
      <Dialog open={isLoginInfoDialogOpen} onOpenChange={setIsLoginInfoDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Informações de Login</DialogTitle>
            <DialogDescription>
              Guarde seus dados de acesso com segurança.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-gray-50 p-4 rounded-lg space-y-3 border border-gray-200">
            <div>
              <Label>Email:</Label>
              <p className="font-medium">{user.email}</p>
            </div>
            <div>
              <Label>Senha:</Label>
              <p className="font-medium">{generatedPassword}</p>
            </div>
          </div>

          <div className="flex justify-end mt-4 space-x-2">
            <Button variant="outline" onClick={handleCopy}>
              <Copy className="mr-2 h-4 w-4" /> Copiar
            </Button>
            <Button onClick={() => setIsLoginInfoDialogOpen(false)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
