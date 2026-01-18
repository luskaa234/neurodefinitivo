"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { format } from "date-fns";

export function PatientAppointments({ patientId }: { patientId: string }) {
  const { appointments, doctors } = useApp();

  const patientAppointments = appointments.filter(
    (apt) => apt.patient_id === patientId
  );

  const getDoctorName = (id: string) => {
    const doc = doctors.find((d) => d.id === id);
    return doc ? doc.name : "Médico não identificado";
  };

  return (
    <Card>
      <CardHeader className="flex justify-between items-center">
        <CardTitle>📅 Meus Agendamentos</CardTitle>
        <Button size="sm" variant="outline">
          <Download className="h-4 w-4 mr-2" /> Baixar PDF
        </Button>
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
                    <Badge variant="secondary">{apt.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-center text-gray-500">Nenhuma consulta encontrada.</p>
        )}
      </CardContent>
    </Card>
  );
}
