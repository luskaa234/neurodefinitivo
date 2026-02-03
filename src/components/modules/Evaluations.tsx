"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Brain, Plus, TrendingUp, TrendingDown, Minus, BarChart3, Trash2, Edit, Eye } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { formatDateBR } from '@/utils/date';

const evaluationSchema = z.object({
  medical_record_id: z.string().min(1, 'Prontuário é obrigatório'),
  type: z.string().min(1, 'Tipo de avaliação é obrigatório'),
  score: z.number().min(0).max(100, 'Pontuação deve estar entre 0 e 100'),
  observations: z.string().optional(),
  date: z.string().min(1, 'Data é obrigatória')
});

type EvaluationFormData = z.infer<typeof evaluationSchema>;

interface Evaluation {
  id: string;
  medical_record_id: string;
  type: string;
  score: number;
  observations?: string;
  date: string;
  created_at: string;
}

interface MedicalRecord {
  id: string;
  patient_id: string;
  doctor_id: string;
  date: string;
  diagnosis: string;
}

const evaluationTypes = [
  'Avaliação Cognitiva Geral',
  'Memória de Trabalho',
  'Atenção e Concentração',
  'Função Executiva',
  'Linguagem',
  'Habilidades Visuoespaciais',
  'Velocidade de Processamento',
  'Flexibilidade Cognitiva',
  'Controle Inibitório',
  'Planejamento e Organização'
];

export function Evaluations() {
  const { patients, doctors } = useApp();
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedEvaluation, setSelectedEvaluation] = useState<Evaluation | null>(null);
  const [loading, setLoading] = useState(true);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<EvaluationFormData>({
    resolver: zodResolver(evaluationSchema)
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [evaluationsData, recordsData] = await Promise.all([
        supabase.from('evaluations').select('*').order('date', { ascending: false }),
        supabase.from('medical_records').select('*').order('date', { ascending: false })
      ]);

      if (evaluationsData.error) {
        console.error('Erro ao carregar avaliações:', evaluationsData.error);
      } else {
        setEvaluations(evaluationsData.data || []);
      }

      if (recordsData.error) {
        console.error('Erro ao carregar prontuários:', recordsData.error);
      } else {
        setMedicalRecords(recordsData.data || []);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: EvaluationFormData) => {
    try {
      const { data: newEvaluation, error } = await supabase
        .from('evaluations')
        .insert([data])
        .select()
        .single();

      if (error) {
        console.error('Erro ao criar avaliação:', error);
        toast.error('Erro ao criar avaliação');
        return;
      }

      if (newEvaluation) {
        setEvaluations(prev => [newEvaluation, ...prev]);
        toast.success('Avaliação criada com sucesso!');
        reset();
        setIsDialogOpen(false);
      }
    } catch (error) {
      console.error('Erro ao criar avaliação:', error);
      toast.error('Erro ao criar avaliação');
    }
  };

  const deleteEvaluation = async (evaluation: Evaluation) => {
    if (window.confirm(`Tem certeza que deseja EXCLUIR PERMANENTEMENTE a avaliação "${evaluation.type}" de ${getPatientName(evaluation.medical_record_id)}? Esta ação não pode ser desfeita.`)) {
      try {
        console.log('🗑️ EXCLUINDO AVALIAÇÃO PERMANENTEMENTE:', evaluation.id);
        
        // EXCLUSÃO REAL E PERMANENTE do Supabase
        const { error } = await supabase
          .from('evaluations')
          .delete()
          .eq('id', evaluation.id);

        if (error) {
          console.error('❌ Erro ao excluir avaliação do banco:', error);
          toast.error('❌ Erro ao excluir avaliação do banco de dados');
          return;
        }

        // Remover da lista local
        setEvaluations(prev => prev.filter(e => e.id !== evaluation.id));
        toast.success('🗑️ Avaliação EXCLUÍDA PERMANENTEMENTE do banco de dados!');
        
        console.log('✅ Avaliação excluída com sucesso do Supabase');
      } catch (error) {
        console.error('❌ Erro ao excluir avaliação:', error);
        toast.error('❌ Erro ao excluir avaliação');
      }
    }
  };

  const getPatientName = (recordId: string) => {
    const record = medicalRecords.find(r => r.id === recordId);
    if (!record) return 'Paciente não encontrado';
    
    const patient = patients.find(p => p.id === record.patient_id);
    return patient ? patient.name : 'Paciente não encontrado';
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return { variant: 'default' as const, label: 'Excelente' };
    if (score >= 60) return { variant: 'secondary' as const, label: 'Bom' };
    if (score >= 40) return { variant: 'outline' as const, label: 'Regular' };
    return { variant: 'destructive' as const, label: 'Baixo' };
  };

  const getAverageScoreByType = () => {
    const scoresByType: { [key: string]: number[] } = {};
    
    evaluations.forEach(evaluation => {
      if (!scoresByType[evaluation.type]) {
        scoresByType[evaluation.type] = [];
      }
      scoresByType[evaluation.type].push(evaluation.score);
    });

    return Object.entries(scoresByType).map(([type, scores]) => ({
      type,
      average: scores.reduce((sum, score) => sum + score, 0) / scores.length,
      count: scores.length
    })).sort((a, b) => b.average - a.average);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Carregando avaliações...</p>
        </div>
      </div>
    );
  }

  const averageScores = getAverageScoreByType();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Avaliações Neurológicas</h1>
          <p className="text-gray-600 mt-2">
            Gerencie e acompanhe as avaliações cognitivas dos pacientes
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova Avaliação
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Criar Nova Avaliação</DialogTitle>
              <DialogDescription>
                Adicione uma nova avaliação neurológica para o paciente
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label>Prontuário do Paciente</Label>
                <Select onValueChange={(value) => setValue('medical_record_id', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o prontuário" />
                  </SelectTrigger>
                  <SelectContent>
                    {medicalRecords.map((record) => (
                      <SelectItem key={record.id} value={record.id}>
                        {getPatientName(record.id)} - {formatDateBR(record.date)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.medical_record_id && (
                  <p className="text-sm text-red-600">{errors.medical_record_id.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Avaliação</Label>
                  <Select onValueChange={(value) => setValue('type', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {evaluationTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.type && (
                    <p className="text-sm text-red-600">{errors.type.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="score">Pontuação (0-100)</Label>
                  <Input
                    id="score"
                    type="number"
                    min="0"
                    max="100"
                    placeholder="85"
                    {...register('score', { valueAsNumber: true })}
                  />
                  {errors.score && (
                    <p className="text-sm text-red-600">{errors.score.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Data da Avaliação</Label>
                <Input
                  id="date"
                  type="date"
                  {...register('date')}
                />
                {errors.date && (
                  <p className="text-sm text-red-600">{errors.date.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="observations">Observações</Label>
                <Textarea
                  id="observations"
                  placeholder="Observações sobre a avaliação, comportamento do paciente, etc..."
                  rows={3}
                  {...register('observations')}
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Salvando...' : 'Salvar Avaliação'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Estatísticas gerais */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Avaliações</CardTitle>
            <Brain className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{evaluations.length}</div>
            <p className="text-xs text-muted-foreground">
              Avaliações registradas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pontuação Média</CardTitle>
            <BarChart3 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {evaluations.length > 0 
                ? Math.round(evaluations.reduce((sum, e) => sum + e.score, 0) / evaluations.length)
                : 0
              }
            </div>
            <p className="text-xs text-muted-foreground">
              Média geral
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avaliações Excelentes</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {evaluations.filter(e => e.score >= 80).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Pontuação ≥ 80
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Necessitam Atenção</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {evaluations.filter(e => e.score < 40).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Pontuação &lt; 40
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Avaliações por tipo */}
        <Card>
          <CardHeader>
            <CardTitle>Desempenho por Tipo de Avaliação</CardTitle>
            <CardDescription>
              Pontuação média por categoria
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {averageScores.map((item) => (
                <div key={item.type} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">{item.type}</span>
                    <span className={`text-sm font-bold ${getScoreColor(item.average)}`}>
                      {Math.round(item.average)}
                    </span>
                  </div>
                  <Progress value={item.average} className="h-2" />
                  <p className="text-xs text-gray-500">{item.count} avaliação{item.count !== 1 ? 'ões' : ''}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Avaliações recentes */}
        <Card>
          <CardHeader>
            <CardTitle>Avaliações Recentes</CardTitle>
            <CardDescription>
              Últimas avaliações realizadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {evaluations.slice(0, 5).map((evaluation) => {
                const badge = getScoreBadge(evaluation.score);
                return (
                  <div key={evaluation.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{getPatientName(evaluation.medical_record_id)}</p>
                      <p className="text-xs text-gray-600">{evaluation.type}</p>
                      <p className="text-xs text-gray-500">
                        {formatDateBR(evaluation.date)}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-bold ${getScoreColor(evaluation.score)}`}>
                        {evaluation.score}
                      </div>
                      <Badge variant={badge.variant} className="text-xs">
                        {badge.label}
                      </Badge>
                    </div>
                    <div className="ml-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteEvaluation(evaluation)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de todas as avaliações */}
      <Card>
        <CardHeader>
          <CardTitle>Todas as Avaliações</CardTitle>
          <CardDescription>
            Lista completa de avaliações neurológicas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead>Tipo de Avaliação</TableHead>
                <TableHead>Pontuação</TableHead>
                <TableHead>Classificação</TableHead>
                <TableHead>Observações</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {evaluations.map((evaluation) => {
                const badge = getScoreBadge(evaluation.score);
                return (
                  <TableRow key={evaluation.id}>
                    <TableCell>
                      {formatDateBR(evaluation.date)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {getPatientName(evaluation.medical_record_id)}
                    </TableCell>
                    <TableCell>{evaluation.type}</TableCell>
                    <TableCell>
                      <span className={`font-bold ${getScoreColor(evaluation.score)}`}>
                        {evaluation.score}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={badge.variant}>
                        {badge.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {evaluation.observations || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedEvaluation(evaluation)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteEvaluation(evaluation)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog de visualização da avaliação */}
      <Dialog open={!!selectedEvaluation} onOpenChange={() => setSelectedEvaluation(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da Avaliação</DialogTitle>
            <DialogDescription>
              Informações completas da avaliação neurológica
            </DialogDescription>
          </DialogHeader>
          {selectedEvaluation && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Paciente</Label>
                  <p className="font-medium">{getPatientName(selectedEvaluation.medical_record_id)}</p>
                </div>
                <div>
                  <Label>Data</Label>
                  <p className="font-medium">{formatDateBR(selectedEvaluation.date)}</p>
                </div>
              </div>

              <div>
                <Label>Tipo de Avaliação</Label>
                <p className="font-medium">{selectedEvaluation.type}</p>
              </div>

              <div>
                <Label>Pontuação</Label>
                <div className="flex items-center space-x-2">
                  <span className={`text-2xl font-bold ${getScoreColor(selectedEvaluation.score)}`}>
                    {selectedEvaluation.score}
                  </span>
                  <Badge variant={getScoreBadge(selectedEvaluation.score).variant}>
                    {getScoreBadge(selectedEvaluation.score).label}
                  </Badge>
                </div>
                <Progress value={selectedEvaluation.score} className="mt-2" />
              </div>

              {selectedEvaluation.observations && (
                <div>
                  <Label>Observações</Label>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm">{selectedEvaluation.observations}</p>
                  </div>
                </div>
              )}

              <div className="flex justify-between space-x-2">
                <Button
                  variant="destructive"
                  onClick={() => {
                    deleteEvaluation(selectedEvaluation);
                    setSelectedEvaluation(null);
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir Permanentemente
                </Button>
                <div className="flex space-x-2">
                  <Button variant="outline" onClick={() => setSelectedEvaluation(null)}>
                    Fechar
                  </Button>
                  <Button>
                    Editar Avaliação
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
