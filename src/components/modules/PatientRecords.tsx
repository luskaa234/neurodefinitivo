"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApp } from "@/contexts/AppContext";
import { format } from "date-fns";

interface PatientRecordsProps {
  patientId: string;
}

export function PatientRecords({ patientId }: PatientRecordsProps) {
  const { appointments, medicalRecords, doctors } = useApp();

  // Pega os agendamentos do paciente
  const patientAppointments = appointments.filter(
    (apt) => apt.patient_id === patientId
  );

  // Filtra os prontuários ligados a esses agendamentos
  const patientRecords = medicalRecords.filter((rec) =>
    patientAppointments.some((apt) => apt.id === rec.appointment_id)
  );

  // Helper para buscar nome do médico
  const getDoctorName = (doctor_id: string) => {
    const doctor = doctors.find((d) => d.id === doctor_id);
    return doctor ? doctor.name : "—";
  };

  return (
    <Card className="shadow-sm border border-gray-100">
      <CardHeader>
        <CardTitle>📄 Meus Prontuários</CardTitle>
        <CardDescription>Histórico clínico e anotações</CardDescription>
      </CardHeader>
      <CardContent>
        {patientRecords.length > 0 ? (
          <>
            <div className="space-y-3 md:hidden">
              {patientRecords.map((rec) => (
                <div key={rec.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">
                      {rec.date ? format(new Date(rec.date), "dd/MM/yyyy") : "—"}
                    </p>
                    <span className="text-xs text-gray-500">{getDoctorName(rec.doctor_id)}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{rec.description || "—"}</p>
                  <p className="text-xs text-gray-500 mt-1">{rec.notes || "—"}</p>
                </div>
              ))}
            </div>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Médico</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Notas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {patientRecords.map((rec) => (
                    <TableRow key={rec.id}>
                      <TableCell>
                        {rec.date ? format(new Date(rec.date), "dd/MM/yyyy") : "—"}
                      </TableCell>
                      <TableCell>{getDoctorName(rec.doctor_id)}</TableCell>
                      <TableCell>{rec.description || "—"}</TableCell>
                      <TableCell>{rec.notes || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        ) : (
          <p className="text-gray-500 text-center py-6">
            Nenhum prontuário encontrado.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default PatientRecords;
