"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useApp } from '@/contexts/AppContext';
import { toast } from 'sonner';
import { formatDateBR } from '@/utils/date';
import { Trash2, RefreshCw, Database } from 'lucide-react';

export function TestDeleteComponent() {
  const { 
    users, 
    appointments, 
    financialRecords, 
    deleteUser, 
    deleteAppointment, 
    deleteFinancialRecord 
  } = useApp();

  const testDeleteUser = async () => {
    if (users.length === 0) {
      toast.error('❌ Nenhum usuário para testar');
      return;
    }

    const userToDelete = users[users.length - 1]; // Pegar o último usuário
    
    if (window.confirm(`TESTE: Excluir permanentemente o usuário "${userToDelete.name}"?`)) {
      console.log('🧪 TESTE: Excluindo usuário:', userToDelete.id);
      
      const success = await deleteUser(userToDelete.id);
      
      if (success) {
        toast.success('🧪 TESTE: Usuário excluído! Recarregue a página para confirmar.');
      } else {
        toast.error('🧪 TESTE: Falha na exclusão do usuário');
      }
    }
  };

  const testDeleteAppointment = async () => {
    if (appointments.length === 0) {
      toast.error('❌ Nenhuma consulta para testar');
      return;
    }

    const appointmentToDelete = appointments[appointments.length - 1]; // Pegar a última consulta
    
    if (window.confirm(`TESTE: Excluir permanentemente a consulta de ${formatDateBR(appointmentToDelete.date)}?`)) {
      console.log('🧪 TESTE: Excluindo consulta:', appointmentToDelete.id);
      
      const success = await deleteAppointment(appointmentToDelete.id);
      
      if (success) {
        toast.success('🧪 TESTE: Consulta excluída! Recarregue a página para confirmar.');
      } else {
        toast.error('🧪 TESTE: Falha na exclusão da consulta');
      }
    }
  };

  const testDeleteFinancial = async () => {
    if (financialRecords.length ===   0) {
      toast.error('❌ Nenhum registro financeiro para testar');
      return;
    }

    const recordToDelete = financialRecords[financialRecords.length - 1]; // Pegar o último registro
    
    if (window.confirm(`TESTE: Excluir permanentemente o registro "${recordToDelete.description}"?`)) {
      console.log('🧪 TESTE: Excluindo registro financeiro:', recordToDelete.id);
      
      const success = await deleteFinancialRecord(recordToDelete.id);
      
      if (success) {
        toast.success('🧪 TESTE: Registro financeiro excluído! Recarregue a página para confirmar.');
      } else {
        toast.error('🧪 TESTE: Falha na exclusão do registro financeiro');
      }
    }
  };

  const reloadPage = () => {
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">🧪 Teste de Exclusões Permanentes</h1>
        <p className="text-gray-600 mt-2">
          Teste se as exclusões estão funcionando corretamente
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Database className="mr-2 h-5 w-5" />
              Dados Atuais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span>Usuários:</span>
              <Badge>{users.length}</Badge>
            </div>
            <div className="flex justify-between">
              <span>Consultas:</span>
              <Badge>{appointments.length}</Badge>
            </div>
            <div className="flex justify-between">
              <span>Registros Financeiros:</span>
              <Badge>{financialRecords.length}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>🧪 Testes de Exclusão</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={testDeleteUser}
              className="w-full"
              disabled={users.length === 0}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Testar Exclusão de Usuário
            </Button>
            
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={testDeleteAppointment}
              className="w-full"
              disabled={appointments.length === 0}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Testar Exclusão de Consulta
            </Button>
            
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={testDeleteFinancial}
              className="w-full"
              disabled={financialRecords.length === 0}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Testar Exclusão Financeira
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>🔄 Verificação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button 
              variant="outline" 
              onClick={reloadPage}
              className="w-full"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Recarregar Página
            </Button>
            
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>Como testar:</strong>
                <br />1. Clique em "Testar Exclusão"
                <br />2. Confirme a exclusão
                <br />3. Clique em "Recarregar Página"
                <br />4. ✅ O item NÃO deve voltar
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="text-red-800">⚠️ Aviso Importante</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-700 space-y-2">
            <p><strong>🗑️ EXCLUSÃO PERMANENTE:</strong> Os testes acima fazem exclusão REAL do banco de dados Supabase.</p>
            <p><strong>❌ NÃO HÁ RECUPERAÇÃO:</strong> Os dados excluídos não podem ser recuperados.</p>
            <p><strong>✅ TESTE VÁLIDO:</strong> Se após recarregar a página o item não voltar, a exclusão está funcionando.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
