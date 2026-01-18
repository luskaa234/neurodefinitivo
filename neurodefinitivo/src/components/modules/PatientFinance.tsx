"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card>
      <CardHeader>
        <CardTitle>💳 Histórico Financeiro</CardTitle>
      </CardHeader>
      <CardContent>
        {patientFinancials.length > 0 ? (
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
        ) : (
          <p className="text-gray-500 text-center py-6">Nenhum registro financeiro encontrado.</p>
        )}
      </CardContent>
    </Card>
  );
}

export default PatientFinance;
