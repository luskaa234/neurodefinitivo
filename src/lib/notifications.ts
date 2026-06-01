import { supabase } from "@/lib/supabase";

export type InternalNotification = {
  id: string;
  user_id?: string | null;
  title: string;
  message: string;
  type: string;
  entity?: string | null;
  entity_id?: string | null;
  read_at?: string | null;
  deleted_at?: string | null;
  created_at: string;
};

const LOCAL_KEY = "internal-notifications-fallback";

const readLocal = (): InternalNotification[] => {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
  } catch {
    return [];
  }
};

const writeLocal = (rows: InternalNotification[]) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCAL_KEY, JSON.stringify(rows.slice(0, 1000)));
  window.dispatchEvent(new Event("internal-notifications-updated"));
};

export async function createInternalNotification(input: {
  userId?: string | null;
  title: string;
  message: string;
  type: string;
  entity?: string;
  entityId?: string;
}) {
  const payload = {
    user_id: input.userId || null,
    title: input.title,
    message: input.message,
    type: input.type,
    entity: input.entity || null,
    entity_id: input.entityId || null,
  };
  try {
    const { data, error } = await supabase.from("internal_notifications").insert([payload]).select("*").single();
    if (error) throw error;
    return data as InternalNotification;
  } catch {
    const item: InternalNotification = {
      id: crypto.randomUUID(),
      ...payload,
      read_at: null,
      deleted_at: null,
      created_at: new Date().toISOString(),
    };
    writeLocal([item, ...readLocal()]);
    return item;
  }
}

export async function listInternalNotifications(userId?: string | null) {
  try {
    let query = supabase
      .from("internal_notifications")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(100);
    if (userId) query = query.or(`user_id.eq.${userId},user_id.is.null`);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as InternalNotification[];
  } catch {
    return readLocal().filter((item) => !item.deleted_at && (!userId || !item.user_id || item.user_id === userId));
  }
}

export async function markInternalNotificationRead(id: string) {
  const read_at = new Date().toISOString();
  try {
    const { error } = await supabase.from("internal_notifications").update({ read_at }).eq("id", id);
    if (error) throw error;
  } catch {
    writeLocal(readLocal().map((item) => (item.id === id ? { ...item, read_at } : item)));
  }
}

export async function deleteInternalNotification(id: string) {
  const deleted_at = new Date().toISOString();
  try {
    const { error } = await supabase.from("internal_notifications").update({ deleted_at }).eq("id", id);
    if (error) throw error;
  } catch {
    writeLocal(readLocal().map((item) => (item.id === id ? { ...item, deleted_at } : item)));
  }
}

export function subscribeToInternalNotifications(userId: string | undefined, callback: () => void) {
  if (!userId) return () => undefined;
  const channel = supabase
    .channel(`internal-notifications-${userId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "internal_notifications" },
      callback
    )
    .subscribe();
  const localCallback = () => callback();
  window.addEventListener("internal-notifications-updated", localCallback);
  return () => {
    supabase.removeChannel(channel);
    window.removeEventListener("internal-notifications-updated", localCallback);
  };
}
