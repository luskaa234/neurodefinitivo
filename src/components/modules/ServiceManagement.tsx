"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Plus, Edit, Trash2, Clock, DollarSign, Tag, Stethoscope } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';

const serviceSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  description: z.string().optional(),
  price: z.number().min(0.01, 'Preço deve ser maior que zero'),
  duration: z.number().min(1, 'Duração deve ser maior que zero'),
  category: z.string().min(1, 'Categoria é obrigatória'),
  is_active: z.boolean().default(true)
});

type ServiceFormData = z.infer<typeof serviceSchema>;

interface Service {
  id: string;
  name: string;
  description?: string;
  price: number;
  duration: number;
  category: string;
  is_active: boolean;
  created_at: string;
}

export function ServiceManagement() {
  const { services, addService, updateService, deleteService } = useApp();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<ServiceFormData>({
    resolver: zodResolver(serviceSchema)
  });

  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    reset: resetEdit,
    setValue: setValueEdit,
    formState: { errors: errorsEdit, isSubmitting: isSubmittingEdit }
  } = useForm<ServiceFormData>({
    resolver: zodResolver(serviceSchema)
  });

  const categories = [
    'Consulta',
    'Avaliação',
    'Terapia',
    'Exame',
    'Procedimento',
    'Outros'
  ];

  const onSubmit = async (data: ServiceFormData) => {
  const newService: Omit<Service, "id" | "created_at"> = {
    name: data.name,                              // ✅ agora é obrigatório
    description: data.description || "",          // opcional, mas garante string
    price: Number(data.price),                    // garante número
    duration: Number(data.duration),              // garante número
    category: data.category,                      // ✅ obrigatório
    is_active: data.is_active ?? true,            // default true
  };

  const success = await addService(newService);
  if (success) {
    reset();
    setIsDialogOpen(false);
  }
};


const onSubmitEdit = async (data: ServiceFormData) => {
  if (!editingService) return;

  const updatedService = {
    ...data,
    price: Number(data.price),
    duration: Number(data.duration),
    is_active: data.is_active ?? true,
  };

  const success = await updateService(editingService.id, updatedService);
  if (success) {
    resetEdit();
    setIsEditDialogOpen(false);
    setEditingService(null);
  }
};


  const handleEdit = (service: Service) => {
    setEditingService(service);
    setValueEdit('name', service.name);
    setValueEdit('description', service.description || '');
    setValueEdit('price', service.price);
    setValueEdit('duration', service.duration);
    setValueEdit('category', service.category);
    setValueEdit('is_active', service.is_active);
    setIsEditDialogOpen(true);
  };

  const handleToggleActive = async (service: Service) => {
    const success = await updateService(service.id, { is_active: !service.is_active });
    if (success) {
      toast.success(
        service.is_active 
          ? `${service.name} foi desativado` 
          : `${service.name} foi ativado`
      );
    }
  };

  const handleDelete = async (service: Service) => {
    if (window.confirm(`Tem certeza que deseja excluir o serviço "${service.name}"?`)) {
      await deleteService(service.id);
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`;
  };

  const getStats = () => {
    const total = services.length;
    const active = services.filter(s => s.is_active).length;
    const inactive = total - active;
    const avgPrice = services.length > 0 
      ? services.reduce((sum, s) => sum + s.price, 0) / services.length 
      : 0;

    return { total, active, inactive, avgPrice };
  };

  const stats = getStats();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gestão de Serviços</h1>
          <p className="text-gray-600 mt-2">
            Gerencie os serviços oferecidos pela clínica
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Serviço
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Criar Novo Serviço</DialogTitle>
              <DialogDescription>
                Adicione um novo serviço ao catálogo da clínica
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Serviço</Label>
                  <Input
                    id="name"
                    placeholder="Ex: Consulta Neurológica"
                    {...register('name')}
                  />
                  {errors.name && (
                    <p className="text-sm text-red-600">{errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select onValueChange={(value) => setValue('category', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.category && (
                    <p className="text-sm text-red-600">{errors.category.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  placeholder="Descrição detalhada do serviço..."
                  rows={3}
                  {...register('description')}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Preço (R$)</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    placeholder="300.00"
                    {...register('price', { valueAsNumber: true })}
                  />
                  {errors.price && (
                    <p className="text-sm text-red-600">{errors.price.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="duration">Duração (minutos)</Label>
                  <Input
                    id="duration"
                    type="number"
                    placeholder="60"
                    {...register('duration', { valueAsNumber: true })}
                  />
                  {errors.duration && (
                    <p className="text-sm text-red-600">{errors.duration.message}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_active"
                  defaultChecked={true}
                  {...register('is_active')}
                  className="rounded"
                />
                <Label htmlFor="is_active">Serviço ativo</Label>
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Criando...' : 'Criar Serviço'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Estatísticas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Serviços</CardTitle>
            <Stethoscope className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              Serviços cadastrados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Serviços Ativos</CardTitle>
            <Tag className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            <p className="text-xs text-muted-foreground">
              Disponíveis para agendamento
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Preço Médio</CardTitle>
            <DollarSign className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {stats.avgPrice.toFixed(0)}</div>
            <p className="text-xs text-muted-foreground">
              Valor médio dos serviços
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categorias</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(services.map(s => s.category)).size}
            </div>
            <p className="text-xs text-muted-foreground">
              Categorias diferentes
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Serviços</CardTitle>
          <CardDescription>
            Gerencie todos os serviços oferecidos pela clínica
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((service) => (
                <TableRow key={service.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{service.name}</p>
                      {service.description && (
                        <p className="text-sm text-gray-500 truncate max-w-xs">
                          {service.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{service.category}</Badge>
                  </TableCell>
                  <TableCell className="font-medium text-green-600">
                    R$ {service.price.toLocaleString('pt-BR')}
                  </TableCell>
                  <TableCell>{formatDuration(service.duration)}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={service.is_active}
                        onCheckedChange={() => handleToggleActive(service)}
                      />
                      <Badge variant={service.is_active ? 'default' : 'secondary'}>
                        {service.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleEdit(service)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDelete(service)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog de edição */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Serviço</DialogTitle>
            <DialogDescription>
              Atualize as informações do serviço
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitEdit(onSubmitEdit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nome do Serviço</Label>
                <Input
                  id="edit-name"
                  placeholder="Ex: Consulta Neurológica"
                  {...registerEdit('name')}
                />
                {errorsEdit.name && (
                  <p className="text-sm text-red-600">{errorsEdit.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select onValueChange={(value) => setValueEdit('category', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errorsEdit.category && (
                  <p className="text-sm text-red-600">{errorsEdit.category.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Descrição</Label>
              <Textarea
                id="edit-description"
                placeholder="Descrição detalhada do serviço..."
                rows={3}
                {...registerEdit('description')}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-price">Preço (R$)</Label>
                <Input
                  id="edit-price"
                  type="number"
                  step="0.01"
                  placeholder="300.00"
                  {...registerEdit('price', { valueAsNumber: true })}
                />
                {errorsEdit.price && (
                  <p className="text-sm text-red-600">{errorsEdit.price.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-duration">Duração (minutos)</Label>
                <Input
                  id="edit-duration"
                  type="number"
                  placeholder="60"
                  {...registerEdit('duration', { valueAsNumber: true })}
                />
                {errorsEdit.duration && (
                  <p className="text-sm text-red-600">{errorsEdit.duration.message}</p>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit-is_active"
                {...registerEdit('is_active')}
                className="rounded"
              />
              <Label htmlFor="edit-is_active">Serviço ativo</Label>
            </div>

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmittingEdit}>
                {isSubmittingEdit ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}