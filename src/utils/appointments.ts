import type { Appointment, User } from "@/contexts/AppContext";

const normalizeText = (value?: string | null) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

export const isResponsibleMeeting = (appointment?: Partial<Appointment> | null) => {
  if (!appointment) return false;
  if (appointment.is_professional_meeting) return true;
  const type = normalizeText(appointment.type);
  const notes = normalizeText(appointment.notes);
  return (
    type.includes("responsavel") ||
    type.includes("pais") ||
    notes.includes("responsavel") ||
    notes.includes("pais")
  );
};

export const getResponsibleName = (patient?: Partial<User> | null) =>
  String((patient as any)?.responsavel || "").trim();

export const getAppointmentPersonLabel = (
  appointment: Partial<Appointment>,
  patient?: Partial<User> | null
) => {
  const patientName = patient?.name || "Paciente";
  if (!isResponsibleMeeting(appointment)) return patientName;

  const responsibleName = getResponsibleName(patient);
  return responsibleName
    ? `Responsavel: ${responsibleName} (paciente: ${patientName})`
    : `Responsavel do paciente: ${patientName}`;
};

export const getAppointmentRecipientName = (
  appointment: Partial<Appointment>,
  patient?: Partial<User> | null
) => {
  if (!isResponsibleMeeting(appointment)) return patient?.name || "Paciente";
  return getResponsibleName(patient) || `Responsavel por ${patient?.name || "paciente"}`;
};

export const getAppointmentServiceLabel = (appointment: Partial<Appointment>) => {
  if (isResponsibleMeeting(appointment)) {
    return appointment.type ? `reuniao ${appointment.type}` : "reuniao com responsavel";
  }
  return appointment.type ? `com ${appointment.type}` : "com atendimento";
};
