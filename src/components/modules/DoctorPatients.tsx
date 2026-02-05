"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { formatDateBR, nowLocal, toInputDate } from "@/utils/date";

type PatientRow = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
};

const uniq = (arr: string[]) => Array.from(new Set(arr.filter(Boolean)));

export function DoctorPatients() {
  const { user } = useAuth();
  const { appointments, patients } = useApp();
  const [search, setSearch] = useState("");

  const todayKey = toInputDate(nowLocal());

  const myAppointments = useMemo(() => {
    if (!user?.id) return [];
    return appointments.filter(
      (apt) => apt.doctor_id === user.id || (apt.doctor_ids || []).includes(user.id)
    );
  }, [appointments, user?.id]);

  const patientIds = useMemo(
    () => uniq(myAppointments.map((apt) => apt.patient_id)),
    [myAppointments]
  );

  const patientRows = useMemo(() => {
    const base = patients
      .filter((p) => patientIds.includes(p.id))
      .map((p) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        phone: p.phone,
      })) as PatientRow[];

    const query = search.trim().toLowerCase();
    if (!query) return base;

    return base.filter((p) => {
      const name = (p.name || "").toLowerCase();
      const email = (p.email || "").toLowerCase();
      const phone = (p.phone || "").toLowerCase();
      return name.includes(query) || email.includes(query) || phone.includes(query);
    });
  }, [patients, patientIds, search]);

  const nextAppointmentByPatient = useMemo(() => {
    const map = new Map<string, string>();
    myAppointments
      .filter((apt) => apt.status !== "cancelado" && apt.date >= todayKey)
      .sort(
        (a, b) =>
          new Date(`${a.date}T${a.time || "00:00"}`).getTime() -
          new Date(`${b.date}T${b.time || "00:00"}`).getTime()
      )
      .forEach((apt) => {
        if (!map.has(apt.patient_id)) {
          map.set(apt.patient_id, `${formatDateBR(apt.date)} às ${apt.time}`);
        }
      });
    return map;
  }, [myAppointments, todayKey]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Meus Pacientes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          placeholder="Buscar por nome, email ou telefone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Paciente</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Próxima consulta</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {patientRows.map((patient) => (
              <TableRow key={patient.id}>
                <TableCell className="font-medium">{patient.name}</TableCell>
                <TableCell>{patient.phone || "—"}</TableCell>
                <TableCell>{patient.email || "—"}</TableCell>
                <TableCell>{nextAppointmentByPatient.get(patient.id) || "—"}</TableCell>
              </TableRow>
            ))}
            {patientRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-gray-500">
                  Nenhum paciente encontrado
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
