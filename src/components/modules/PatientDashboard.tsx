"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApp } from "@/contexts/AppContext";
import { format } from "date-fns";

type AppointmentStatus = "agendado" | "confirmado" | "realizado" | "cancelado" | "falta";

const statusVariant: Record<AppointmentStatus, "default" | "secondary" | "outline" | "destructive"> = {
  confirmado: "default",
  agendado: "secondary",
  realizado: "outline",
  cancelado: "destructive",
  falta: "destructive",
};

interface PatientDashboardProps {
  patientId: string;
}

export function PatientDashboard({ patientId }: PatientDashboardProps) {
  const { appointments, financialRecords, doctors } = useApp();

  const patientAppointments = appointments.filter((apt) => apt.patient_id === patientId);

  const patientFinancials = financialRecords.filter((rec) =>
    patientAppointments.some((apt) => apt.id === rec.appointment_id)
  );

  const getDoctorName = (doctorId: string) => {
    const doctor = doctors.find((d) => d.id === doctorId);
    return doctor ? doctor.name : "Médico não identificado";
  };

  return (
    <div className="space-y-8">
      {/* Consultas */}
      <Card>
        <CardHeader>
          <CardTitle>📅 Minhas Consultas</CardTitle>
        </CardHeader>
        <CardContent>
          {patientAppointments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Hora</TableHead>
                  <TableHead>Médico</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patientAppointments.map((apt) => (
                  <TableRow key={apt.id}>
                    <TableCell>{format(new Date(apt.date), "dd/MM/yyyy")}</TableCell>
                    <TableCell>{apt.time}</TableCell>
                    <TableCell>{getDoctorName(apt.doctor_id)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[apt.status as AppointmentStatus]}>
                        {apt.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-gray-500 text-center py-6">Nenhuma consulta encontrada.</p>
          )}
        </CardContent>
      </Card>

      {/* Situação Financeira */}
      <Card>
        <CardHeader>
          <CardTitle>💰 Situação Financeira</CardTitle>
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
    </div>
  );
}

export default PatientDashboard;
