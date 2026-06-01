import { supabase } from "@/lib/supabase";
import { createAuditLog, type AuditUser } from "@/lib/audit";

export type WhatsAppMessageType =
  | "appointment.created"
  | "appointment.cancelled"
  | "appointment.rescheduled"
  | "appointment.reminder"
  | "appointment.confirmation"
  | "patient.absent"
  | "payment.pending"
  | "payment.confirmed"
  | "manual";

export type WhatsAppStatus = "pending" | "sent" | "failed" | "cancelled" | "deleted" | "restored";

export type WhatsAppHistoryMessage = {
  id: string;
  patient_id?: string | null;
  patient_name: string;
  responsible_name?: string | null;
  phone: string;
  message: string;
  message_type: WhatsAppMessageType;
  status: WhatsAppStatus;
  api_response?: unknown;
  attempts: number;
  user_id?: string | null;
  user_name?: string | null;
  appointment_id?: string | null;
  financial_record_id?: string | null;
  deleted_at?: string | null;
  restored_at?: string | null;
  created_at: string;
  updated_at?: string | null;
};

export type WhatsAppFilters = {
  patient?: string;
  phone?: string;
  status?: string;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
  includeDeleted?: boolean;
};

const LOCAL_KEY = "whatsapp-history";
const LEGACY_MESSAGE_KEY = "whatsapp-messages";
const LEGACY_NOTIFICATION_KEY = "whatsapp-notifications";

const normalizeLegacyRows = (rows: any[], source: string): WhatsAppHistoryMessage[] =>
  rows.map((row: any) => ({
    id: row.id || `${source}-${crypto.randomUUID()}`,
    patient_id: row.patient_id || row.doctor_id || null,
    patient_name: row.patient_name || row.patient || row.to || row.doctor_name || "Paciente",
    responsible_name: row.responsible_name || "",
    phone: row.phone || row.to || "",
    message: row.message || "",
    message_type: row.message_type || row.type || "manual",
    status: row.status || "sent",
    api_response: row.api_response || { source },
    attempts: Number(row.attempts || 1),
    user_id: row.user_id || null,
    user_name: row.user_name || null,
    appointment_id: row.appointment_id || null,
    financial_record_id: row.financial_record_id || null,
    deleted_at: row.deleted_at || null,
    restored_at: row.restored_at || null,
    created_at: row.created_at || row.sent_at || row.date || new Date().toISOString(),
    updated_at: row.updated_at || row.created_at || row.sent_at || row.date || new Date().toISOString(),
  })) as WhatsAppHistoryMessage[];

const readLocalArray = (key: string) => {
  try {
    const rows = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
};

const readLocal = (): WhatsAppHistoryMessage[] => {
  if (typeof window === "undefined") return [];
  try {
    const merged = [
      ...normalizeLegacyRows(readLocalArray(LOCAL_KEY), LOCAL_KEY),
      ...normalizeLegacyRows(readLocalArray(LEGACY_MESSAGE_KEY), LEGACY_MESSAGE_KEY),
      ...normalizeLegacyRows(readLocalArray(LEGACY_NOTIFICATION_KEY), LEGACY_NOTIFICATION_KEY),
    ];
    const byId = new Map<string, WhatsAppHistoryMessage>();
    merged.forEach((row) => byId.set(row.id, row));
    return Array.from(byId.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  } catch {
    return [];
  }
};

export function readLegacyWhatsAppMessages() {
  return readLocal();
}

export function getLegacyWhatsAppStorageStats() {
  if (typeof window === "undefined") {
    return { total: 0, keys: {} as Record<string, number> };
  }
  const keys = {
    [LOCAL_KEY]: readLocalArray(LOCAL_KEY).length,
    [LEGACY_MESSAGE_KEY]: readLocalArray(LEGACY_MESSAGE_KEY).length,
    [LEGACY_NOTIFICATION_KEY]: readLocalArray(LEGACY_NOTIFICATION_KEY).length,
  };
  return {
    total: Object.values(keys).reduce((sum, value) => sum + value, 0),
    keys,
  };
}

const writeLocal = (rows: WhatsAppHistoryMessage[]) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCAL_KEY, JSON.stringify(rows.slice(0, 1000)));
  window.dispatchEvent(new Event("whatsapp-history-updated"));
};

const normalizePhoneBR = (raw?: string | null) => {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55")) return digits.length >= 12 ? digits : "";
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return "";
};

export function buildWhatsAppUrl(phone: string, message: string) {
  return `https://api.whatsapp.com/send?phone=${normalizePhoneBR(phone)}&text=${encodeURIComponent(message)}`;
}

export async function listWhatsAppMessages(filters: WhatsAppFilters = {}) {
  try {
    let query = supabase.from("whatsapp_messages").select("*").order("created_at", { ascending: false }).limit(500);
    if (!filters.includeDeleted) query = query.is("deleted_at", null);
    if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
    if (filters.type && filters.type !== "all") query = query.eq("message_type", filters.type);
    if (filters.dateFrom) query = query.gte("created_at", `${filters.dateFrom}T00:00:00`);
    if (filters.dateTo) query = query.lte("created_at", `${filters.dateTo}T23:59:59`);
    const { data, error } = await query;
    if (error) throw error;
    const byId = new Map<string, WhatsAppHistoryMessage>();
    [...(data as WhatsAppHistoryMessage[]), ...readLocal()].forEach((row) => byId.set(row.id, row));
    return filterLocal(Array.from(byId.values()), filters);
  } catch {
    return filterLocal(readLocal(), filters);
  }
}

function filterLocal(rows: WhatsAppHistoryMessage[], filters: WhatsAppFilters) {
  const patient = String(filters.patient || "").toLowerCase();
  const phone = String(filters.phone || "").replace(/\D/g, "");
  return rows.filter((row) => {
    if (!filters.includeDeleted && row.deleted_at) return false;
    if (patient && !row.patient_name.toLowerCase().includes(patient)) return false;
    if (phone && !row.phone.replace(/\D/g, "").includes(phone)) return false;
    if (filters.status && filters.status !== "all" && row.status !== filters.status) return false;
    if (filters.type && filters.type !== "all" && row.message_type !== filters.type) return false;
    if (filters.dateFrom && row.created_at < `${filters.dateFrom}T00:00:00`) return false;
    if (filters.dateTo && row.created_at > `${filters.dateTo}T23:59:59`) return false;
    return true;
  });
}

export async function createWhatsAppMessage(input: {
  patientId?: string | null;
  patientName: string;
  responsibleName?: string | null;
  phone: string;
  message: string;
  messageType: WhatsAppMessageType;
  status?: WhatsAppStatus;
  apiResponse?: unknown;
  user?: AuditUser | null;
  appointmentId?: string | null;
  financialRecordId?: string | null;
}) {
  const payload = {
    patient_id: input.patientId || null,
    patient_name: input.patientName,
    responsible_name: input.responsibleName || null,
    phone: normalizePhoneBR(input.phone),
    message: input.message,
    message_type: input.messageType,
    status: input.status || "sent",
    api_response: input.apiResponse || { provider: "whatsapp_web", opened: true },
    attempts: 1,
    user_id: input.user?.id || null,
    user_name: input.user?.name || null,
    appointment_id: input.appointmentId || null,
    financial_record_id: input.financialRecordId || null,
  };
  try {
    const { data, error } = await supabase.from("whatsapp_messages").insert([payload]).select("*").single();
    if (error) throw error;
    return data as WhatsAppHistoryMessage;
  } catch {
    const item: WhatsAppHistoryMessage = {
      id: crypto.randomUUID(),
      ...payload,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as WhatsAppHistoryMessage;
    writeLocal([item, ...readLocal()]);
    return item;
  }
}

export async function updateWhatsAppMessage(id: string, patch: Partial<WhatsAppHistoryMessage>, user?: AuditUser | null) {
  const oldValue = readLocal().find((item) => item.id === id) || null;
  try {
    const { data, error } = await supabase.from("whatsapp_messages").update(patch).eq("id", id).select("*").single();
    if (error) throw error;
    await createAuditLog({ user, action: "whatsapp_message.edit", entity: "whatsapp_messages", entityId: id, oldValue, newValue: data });
    return data as WhatsAppHistoryMessage;
  } catch {
    const rows = readLocal();
    const nextRows = rows.map((item) => (item.id === id ? { ...item, ...patch, updated_at: new Date().toISOString() } : item));
    const next = nextRows.find((item) => item.id === id) || null;
    writeLocal(nextRows);
    await createAuditLog({ user, action: "whatsapp_message.edit", entity: "whatsapp_messages", entityId: id, oldValue, newValue: next });
    return next;
  }
}

export async function resendWhatsAppMessage(row: WhatsAppHistoryMessage, user?: AuditUser | null) {
  window.open(buildWhatsAppUrl(row.phone, row.message), "_blank");
  const updated = await updateWhatsAppMessage(
    row.id,
    {
      status: "sent",
      attempts: Number(row.attempts || 0) + 1,
      api_response: { provider: "whatsapp_web", reopened: true, at: new Date().toISOString() },
    },
    user
  );
  await createAuditLog({ user, action: "whatsapp_message.resend", entity: "whatsapp_messages", entityId: row.id, oldValue: row, newValue: updated });
  return updated;
}

export async function softDeleteWhatsAppMessage(row: WhatsAppHistoryMessage, user?: AuditUser | null) {
  const updated = await updateWhatsAppMessage(row.id, { status: "deleted", deleted_at: new Date().toISOString() }, user);
  await createAuditLog({ user, action: "whatsapp_message.delete", entity: "whatsapp_messages", entityId: row.id, oldValue: row, newValue: updated });
  return updated;
}

export async function restoreWhatsAppMessage(row: WhatsAppHistoryMessage, user?: AuditUser | null) {
  const updated = await updateWhatsAppMessage(row.id, { status: "restored", deleted_at: null, restored_at: new Date().toISOString() }, user);
  await createAuditLog({ user, action: "whatsapp_message.restore", entity: "whatsapp_messages", entityId: row.id, oldValue: row, newValue: updated });
  return updated;
}

export function subscribeToWhatsAppHistory(callback: () => void) {
  const channel = supabase
    .channel("whatsapp-messages-history")
    .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_messages" }, callback)
    .subscribe();
  const localCallback = () => callback();
  window.addEventListener("whatsapp-history-updated", localCallback);
  return () => {
    supabase.removeChannel(channel);
    window.removeEventListener("whatsapp-history-updated", localCallback);
  };
}
