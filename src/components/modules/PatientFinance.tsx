"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApp } from "@/contexts/AppContext";
import { format } from "date-fns";

interface PatientFinanceProps {
  patientId: string;
}

export function PatientFinance({ patientId }: PatientFinanceProps) {
  const { financialRecords, appointments } = useApp();

  const patientAppointments = appointments.filter((apt) => apt.patient_id === patientId);

  const patientFinancials = financialRecords.filter((rec) =>
    patientAppointments.some((apt) => apt.id === rec.appointment_id)
  );

  return (
    <Card className="shadow-sm border border-gray-100">
      <CardHeader>
        <CardTitle>💳 Histórico Financeiro</CardTitle>
        <CardDescription>Pagamentos, recibos e pendências</CardDescription>
      </CardHeader>
      <CardContent>
        {patientFinancials.length > 0 ? (
          <>
            <div className="space-y-3 md:hidden">
              {patientFinancials.map((rec) => (
                <div key={rec.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{format(new Date(rec.date), "dd/MM/yyyy")}</p>
                    <Badge
                      variant={
                        rec.status === "pago"
                          ? "default"
                          : rec.status === "pendente"
                          ? "secondary"
                          : "destructive"
                      }
                    >
                      {rec.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{rec.description}</p>
                  <p className="text-sm font-semibold mt-1">
                    {rec.type === "receita" ? "+" : "-"}{" "}
                    {rec.amount.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </p>
                </div>
              ))}
            </div>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {patientFinancials.map((rec) => (
                    <TableRow key={rec.id}>
                      <TableCell>{format(new Date(rec.date), "dd/MM/yyyy")}</TableCell>
                      <TableCell>{rec.description}</TableCell>
                      <TableCell>
                        {rec.type === "receita" ? "+" : "-"}{" "}
                        {rec.amount.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            rec.status === "pago"
                              ? "default"
                              : rec.status === "pendente"
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {rec.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        ) : (
          <p className="text-gray-500 text-center py-6">Nenhum registro financeiro encontrado.</p>
        )}
      </CardContent>
    </Card>
  );
}

export default PatientFinance;
