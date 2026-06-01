import { supabase } from "@/lib/supabase";

export type AuditAction =
  | "whatsapp_message.edit"
  | "whatsapp_message.resend"
  | "whatsapp_message.delete"
  | "whatsapp_message.restore"
  | "settings.update"
  | "admin.update";

export type AuditUser = {
  id?: string;
  name?: string;
};

const LOCAL_KEY = "audit-logs-fallback";

const readLocal = () => {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
  } catch {
    return [];
  }
};

const writeLocal = (rows: any[]) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCAL_KEY, JSON.stringify(rows.slice(0, 1000)));
};

export async function createAuditLog(params: {
  user?: AuditUser | null;
  action: AuditAction | string;
  entity: string;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  ip?: string | null;
}) {
  const payload = {
    user_id: params.user?.id || null,
    user_name: params.user?.name || null,
    action: params.action,
    entity: params.entity,
    entity_id: params.entityId || null,
    old_value: params.oldValue ?? null,
    new_value: params.newValue ?? null,
    ip: params.ip || null,
  };

  try {
    const { error } = await supabase.from("audit_logs").insert([payload]);
    if (error) throw error;
  } catch {
    writeLocal([{ id: crypto.randomUUID(), ...payload, created_at: new Date().toISOString() }, ...readLocal()]);
  }
}

export async function listAuditLogs(entity?: string, entityId?: string) {
  try {
    let query = supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(500);
    if (entity) query = query.eq("entity", entity);
    if (entityId) query = query.eq("entity_id", entityId);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch {
    return readLocal().filter((row: any) => (!entity || row.entity === entity) && (!entityId || row.entity_id === entityId));
  }
}
