"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  Calendar,
  AlertCircle,
  CheckCircle,
  Clock,
  CreditCard,
  Target,
  BarChart3,
  PieChart
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

export function FinanceiroDashboard() {
  const { financialRecords, appointments, patients } = useApp();

  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  // Métricas do mês atual
  const thisMonthRecords = financialRecords.filter(record => {
    const recordDate = new Date(record.date);
    return recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear;
  });

  // Métricas do mês passado
  const lastMonthRecords = financialRecords.filter(record => {
    const recordDate = new Date(record.date);
    return recordDate.getMonth() === lastMonth && recordDate.getFullYear() === lastMonthYear;
  });

  const thisMonthRevenue = thisMonthRecords
    .filter(r => r.type === 'receita' && r.status === 'pago')
    .reduce((sum, r) => sum + r.amount, 0);

  const thisMonthExpenses = thisMonthRecords
    .filter(r => r.type === 'despesa' && r.status === 'pago')
    .reduce((sum, r) => sum + r.amount, 0);

  const lastMonthRevenue = lastMonthRecords
    .filter(r => r.type === 'receita' && r.status === 'pago')
    .reduce((sum, r) => sum + r.amount, 0);

  const pendingRevenue = thisMonthRecords
    .filter(r => r.type === 'receita' && r.status === 'pendente')
    .reduce((sum, r) => sum + r.amount, 0);

  const pendingExpenses = thisMonthRecords
    .filter(r => r.type === 'despesa' && r.status === 'pendente')
    .reduce((sum, r) => sum + r.amount, 0);

  const netProfit = thisMonthRevenue - thisMonthExpenses;
  const revenueGrowth = lastMonthRevenue > 0 
    ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 
    : 0;

  // Consultas que geram receita
  const paidAppointments = appointments.filter(apt => apt.status === 'realizado');
  const pendingPayments = appointments.filter(apt => 
    apt.status === 'realizado' && 
    !financialRecords.some(fr => fr.appointment_id === apt.id && fr.status === 'pago')
  );

  // Transações recentes
  const recentTransactions = financialRecords
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8);

  // Dados para gráficos
  const getRevenueByCategory = () => {
    const revenueByCategory = thisMonthRecords
      .filter(r => r.type === 'receita' && r.status === 'pago')
      .reduce((acc, record) => {
        acc[record.category] = (acc[record.category] || 0) + record.amount;
        return acc;
      }, {} as Record<string, number>);

    return Object.entries(revenueByCategory).map(([category, amount]) => ({
      category,
      amount,
      percentage: Math.round((amount / thisMonthRevenue) * 100)
    }));
  };

  const getExpensesByCategory = () => {
    const expensesByCategory = thisMonthRecords
      .filter(r => r.type === 'despesa' && r.status === 'pago')
      .reduce((acc, record) => {
        acc[record.category] = (acc[record.category] || 0) + record.amount;
        return acc;
      }, {} as Record<string, number>);

    return Object.entries(expensesByCategory).map(([category, amount]) => ({
      category,
      amount
    }));
  };

  const getPatientName = (appointmentId?: string) => {
    if (!appointmentId) return 'N/A';
    const appointment = appointments.find(apt => apt.id === appointmentId);
    if (!appointment) return 'N/A';
    const patient = patients.find(p => p.id === appointment.patient_id);
    return patient ? patient.name : 'Paciente não encontrado';
  };

  const revenueByCategory = getRevenueByCategory();
  const expensesByCategory = getExpensesByCategory();
  const COLORS = ['#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#3b82f6'];

  return (
    <div className="space-y-6 px-2 sm:px-4">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Dashboard Financeiro</h1>
        <p className="mt-2 text-sm text-gray-600 sm:text-base">
          Controle completo das finanças e faturamento
        </p>
      </div>

      {/* Métricas principais */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-green-50 border-green-200 border-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita do Mês</CardTitle>
            <DollarSign className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              R$ {thisMonthRevenue.toLocaleString('pt-BR')}
            </div>
            <p className="text-xs text-green-700">
              {revenueGrowth >= 0 ? '+' : ''}{revenueGrowth.toFixed(1)}% vs mês anterior
            </p>
          </CardContent>
        </Card>

        <Card className="bg-red-50 border-red-200 border-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Despesas do Mês</CardTitle>
            <TrendingDown className="h-5 w-5 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              R$ {thisMonthExpenses.toLocaleString('pt-BR')}
            </div>
            <p className="text-xs text-red-700">
              Gastos confirmados
            </p>
          </CardContent>
        </Card>

        <Card className={`${netProfit >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'} border-2`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lucro Líquido</CardTitle>
            <Target className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${netProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              R$ {netProfit.toLocaleString('pt-BR')}
            </div>
            <p className="text-xs text-muted-foreground">
              Receita - Despesas
            </p>
          </CardContent>
        </Card>

        <Card className="bg-yellow-50 border-yellow-200 border-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">A Receber</CardTitle>
            <Clock className="h-5 w-5 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              R$ {pendingRevenue.toLocaleString('pt-BR')}
            </div>
            <p className="text-xs text-yellow-700">
              Valores pendentes
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Gráfico de receitas por categoria */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <PieChart className="mr-2 h-5 w-5" />
              Receitas por Categoria
            </CardTitle>
            <CardDescription>
              Distribuição das receitas do mês atual
            </CardDescription>
          </CardHeader>
          <CardContent>
            {revenueByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <RechartsPieChart>
                  <Pie
                    data={revenueByCategory}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ category, percentage }) => `${category} (${percentage}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="amount"
                  >
                    {revenueByCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `R$ ${Number(value).toLocaleString('pt-BR')}`} />
                </RechartsPieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-500">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                  <p>Nenhuma receita registrada este mês</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gráfico de despesas por categoria */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="mr-2 h-5 w-5" />
              Despesas por Categoria
            </CardTitle>
            <CardDescription>
              Distribuição das despesas do mês atual
            </CardDescription>
          </CardHeader>
          <CardContent>
            {expensesByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={expensesByCategory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" />
                  <YAxis />
                  <Tooltip formatter={(value) => `R$ ${Number(value).toLocaleString('pt-BR')}`} />
                  <Bar dataKey="amount" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-500">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                  <p>Nenhuma despesa registrada este mês</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Transações recentes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CreditCard className="mr-2 h-5 w-5" />
              Transações Recentes
            </CardTitle>
            <CardDescription>
              Últimas movimentações financeiras
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentTransactions.map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <Badge variant={transaction.type === 'receita' ? 'default' : 'destructive'}>
                        {transaction.type === 'receita' ? 'Receita' : 'Despesa'}
                      </Badge>
                      <Badge variant={
                        transaction.status === 'pago' ? 'default' :
                        transaction.status === 'pendente' ? 'secondary' : 'destructive'
                      }>
                        {transaction.status}
                      </Badge>
                    </div>
                    <p className="font-medium mt-1">{transaction.description}</p>
                    <p className="text-sm text-gray-600">{transaction.category}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(transaction.date).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${
                      transaction.type === 'receita' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {transaction.type === 'receita' ? '+' : '-'} R$ {transaction.amount.toLocaleString('pt-BR')}
                    </p>
                  </div>
                </div>
              ))}
              {recentTransactions.length === 0 && (
                <p className="text-gray-500 text-center py-4">
                  Nenhuma transação recente
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Alertas financeiros */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertCircle className="mr-2 h-5 w-5" />
              Alertas Financeiros
            </CardTitle>
            <CardDescription>
              Itens que precisam de atenção
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingRevenue > 0 && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center">
                    <Clock className="h-5 w-5 text-yellow-600 mr-2" />
                    <div>
                      <p className="font-medium text-yellow-800">
                        R$ {pendingRevenue.toLocaleString('pt-BR')} a receber
                      </p>
                      <p className="text-sm text-yellow-700">
                        Valores pendentes de pagamento
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {pendingExpenses > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center">
                    <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                    <div>
                      <p className="font-medium text-red-800">
                        R$ {pendingExpenses.toLocaleString('pt-BR')} a pagar
                      </p>
                      <p className="text-sm text-red-700">
                        Despesas pendentes
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {pendingPayments.length > 0 && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-blue-600 mr-2" />
                    <div>
                      <p className="font-medium text-blue-800">
                        {pendingPayments.length} consulta{pendingPayments.length !== 1 ? 's' : ''} sem cobrança
                      </p>
                      <p className="text-sm text-blue-700">
                        Consultas realizadas sem registro de pagamento
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {netProfit > 0 && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center">
                    <TrendingUp className="h-5 w-5 text-green-600 mr-2" />
                    <div>
                      <p className="font-medium text-green-800">
                        Mês lucrativo!
                      </p>
                      <p className="text-sm text-green-700">
                        Lucro de R$ {netProfit.toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {netProfit < 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center">
                    <TrendingDown className="h-5 w-5 text-red-600 mr-2" />
                    <div>
                      <p className="font-medium text-red-800">
                        Atenção: Prejuízo
                      </p>
                      <p className="text-sm text-red-700">
                        Prejuízo de R$ {Math.abs(netProfit).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resumo por categoria */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo por Categoria</CardTitle>
          <CardDescription>
            Distribuição de receitas e despesas por categoria
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="font-medium mb-3 text-green-600">Receitas</h4>
              <div className="space-y-2">
                {Object.entries(
                  thisMonthRecords
                    .filter(r => r.type === 'receita' && r.status === 'pago')
                    .reduce((acc, record) => {
                      acc[record.category] = (acc[record.category] || 0) + record.amount;
                      return acc;
                    }, {} as Record<string, number>)
                ).map(([category, amount]) => (
                  <div key={category} className="flex justify-between items-center p-2 bg-green-50 rounded">
                    <span className="text-sm">{category}</span>
                    <span className="font-medium text-green-600">
                      R$ {amount.toLocaleString('pt-BR')}
                    </span>
                  </div>
                ))}
                {Object.keys(thisMonthRecords.filter(r => r.type === 'receita' && r.status === 'pago').reduce((acc, record) => {
                  acc[record.category] = (acc[record.category] || 0) + record.amount;
                  return acc;
                }, {} as Record<string, number>)).length === 0 && (
                  <p className="text-gray-500 text-center py-4">Nenhuma receita este mês</p>
                )}
              </div>
            </div>
            
            <div>
              <h4 className="font-medium mb-3 text-red-600">Despesas</h4>
              <div className="space-y-2">
                {Object.entries(
                  thisMonthRecords
                    .filter(r => r.type === 'despesa' && r.status === 'pago')
                    .reduce((acc, record) => {
                      acc[record.category] = (acc[record.category] || 0) + record.amount;
                      return acc;
                    }, {} as Record<string, number>)
                ).map(([category, amount]) => (
                  <div key={category} className="flex justify-between items-center p-2 bg-red-50 rounded">
                    <span className="text-sm">{category}</span>
                    <span className="font-medium text-red-600">
                      R$ {amount.toLocaleString('pt-BR')}
                    </span>
                  </div>
                ))}
                {Object.keys(thisMonthRecords.filter(r => r.type === 'despesa' && r.status === 'pago').reduce((acc, record) => {
                  acc[record.category] = (acc[record.category] || 0) + record.amount;
                  return acc;
                }, {} as Record<string, number>)).length === 0 && (
                  <p className="text-gray-500 text-center py-4">Nenhuma despesa este mês</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
