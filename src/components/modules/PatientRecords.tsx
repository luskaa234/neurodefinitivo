"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const { appointments, medicalRecords, users } = useApp();

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
    const doctor = users.find((u) => u.id === doctor_id && u.role === "medico");
    return doctor ? doctor.name : "—";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>📄 Meus Prontuários</CardTitle>
      </CardHeader>
      <CardContent>
        {patientRecords.length > 0 ? (
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
