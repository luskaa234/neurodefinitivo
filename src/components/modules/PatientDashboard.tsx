"use client";

import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApp } from "@/contexts/AppContext";
import { formatDateBR, nowLocal } from "@/utils/date";

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

  const stats = useMemo(() => {
    const now = nowLocal();
    const upcoming = patientAppointments.filter(
      (apt) => new Date(`${apt.date}T${apt.time || "00:00"}`) >= now && apt.status !== "cancelado"
    ).length;
    const completed = patientAppointments.filter((apt) => apt.status === "realizado").length;
    const pending = patientAppointments.filter((apt) => apt.status === "pendente" || apt.status === "agendado").length;
    const paid = patientFinancials.filter((rec) => rec.status === "pago").length;
    return { upcoming, completed, pending, paid };
  }, [patientAppointments, patientFinancials]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Meu Painel</h1>
        <p className="text-sm text-gray-500">Acompanhe suas consultas e pagamentos.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border border-blue-100 bg-blue-50/60">
          <CardHeader className="pb-2">
            <CardDescription>Próximas</CardDescription>
            <CardTitle className="text-2xl">{stats.upcoming}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border border-emerald-100 bg-emerald-50/60">
          <CardHeader className="pb-2">
            <CardDescription>Realizadas</CardDescription>
            <CardTitle className="text-2xl">{stats.completed}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border border-amber-100 bg-amber-50/60">
          <CardHeader className="pb-2">
            <CardDescription>Pendentes</CardDescription>
            <CardTitle className="text-2xl">{stats.pending}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border border-purple-100 bg-purple-50/60">
          <CardHeader className="pb-2">
            <CardDescription>Pagamentos</CardDescription>
            <CardTitle className="text-2xl">{stats.paid}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Consultas */}
      <Card>
        <CardHeader>
          <CardTitle>📅 Minhas Consultas</CardTitle>
          <CardDescription>Resumo das consultas agendadas</CardDescription>
        </CardHeader>
        <CardContent>
          {patientAppointments.length > 0 ? (
            <>
              <div className="space-y-3 md:hidden">
                {patientAppointments.map((apt) => (
                  <div key={apt.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{formatDateBR(apt.date)} • {apt.time}</p>
                      <Badge variant={statusVariant[apt.status as AppointmentStatus]}>
                        {apt.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{getDoctorName(apt.doctor_id)}</p>
                  </div>
                ))}
              </div>
              <div className="hidden md:block">
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
                        <TableCell>{formatDateBR(apt.date)}</TableCell>
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
              </div>
            </>
          ) : (
            <p className="text-gray-500 text-center py-6">Nenhuma consulta encontrada.</p>
          )}
        </CardContent>
      </Card>

      {/* Situação Financeira */}
      <Card>
        <CardHeader>
          <CardTitle>💰 Situação Financeira</CardTitle>
          <CardDescription>Pagamentos e registros</CardDescription>
        </CardHeader>
        <CardContent>
          {patientFinancials.length > 0 ? (
            <>
              <div className="space-y-3 md:hidden">
                {patientFinancials.map((rec) => (
                  <div key={rec.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{formatDateBR(rec.date)}</p>
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
                        <TableCell>{formatDateBR(rec.date)}</TableCell>
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
    </div>
  );
}

export default PatientDashboard;
