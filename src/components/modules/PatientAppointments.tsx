"use client";

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
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
    <Card className="shadow-sm border border-gray-100">
      <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>📅 Meus Agendamentos</CardTitle>
          <CardDescription>Histórico completo de consultas</CardDescription>
        </div>
        <Button size="sm" variant="outline">
          <Download className="h-4 w-4 mr-2" /> Baixar PDF
        </Button>
      </CardHeader>
      <CardContent>
        {patientAppointments.length > 0 ? (
          <>
            <div className="space-y-3 md:hidden">
              {patientAppointments.map((apt) => (
                <div key={apt.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{format(new Date(apt.date), "dd/MM/yyyy")} • {apt.time}</p>
                    <Badge variant="secondary">{apt.status}</Badge>
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
            </div>
          </>
        ) : (
          <p className="text-center text-gray-500">Nenhuma consulta encontrada.</p>
        )}
      </CardContent>
    </Card>
  );
}
