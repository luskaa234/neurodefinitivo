import { NextResponse } from "next/server";
import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY as string;
const vapidSubject =
  (process.env.VAPID_SUBJECT as string) || "mailto:admin@neurointegrar.com";

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

const formatDateBR = (date?: string) => {
  if (!date) return "";
  const [y, m, d] = date.split("-");
  if (!y || !m || !d) return date;
  return `${d}/${m}/${y}`;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!vapidPublicKey || !vapidPrivateKey) {
      return NextResponse.json({ error: "missing_vapid_keys" }, { status: 500 });
    }

    const type = String(body?.type || "update");
    const apt = body?.appointment || {};
    const dateLabel = formatDateBR(apt.date);
    const timeLabel = apt.time ? ` às ${apt.time}` : "";
    let title = "Neuro Integrar";
    let message = "Você tem uma nova atualização.";

    if (type === "test") {
      title = "Notificação de teste";
      message = "Push ativo com sucesso.";
    } else if (type === "create") {
      title = "Novo atendimento";
      message = `Atendimento criado para ${dateLabel}${timeLabel}.`;
    } else if (type === "reschedule") {
      title = "Atendimento reagendado";
      message = `Atendimento reagendado para ${dateLabel}${timeLabel}.`;
    } else if (type === "cancel") {
      title = "Atendimento cancelado";
      message = `Atendimento cancelado em ${dateLabel}${timeLabel}.`;
    } else if (type === "delete") {
      title = "Atendimento removido";
      message = `Atendimento removido em ${dateLabel}${timeLabel}.`;
    } else {
      title = "Atendimento atualizado";
      message = `Atendimento atualizado para ${dateLabel}${timeLabel}.`;
    }

    const { data: subs, error } = await supabaseAdmin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const payload = JSON.stringify({
      title,
      body: message,
      url: "/#agendamento",
      icon: "/icon-192x192.png",
      badge: "/icon-192x192.png",
      data: { appointmentId: apt.id, type },
    });

    const expired: string[] = [];
    await Promise.all(
      (subs || []).map(async (s) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: s.endpoint,
              keys: { p256dh: s.p256dh, auth: s.auth },
            },
            payload
          );
        } catch (err: any) {
          const status = err?.statusCode || err?.status;
          if (status === 404 || status === 410) {
            expired.push(s.endpoint);
          }
        }
      })
    );

    if (expired.length) {
      await supabaseAdmin.from("push_subscriptions").delete().in("endpoint", expired);
    }

    return NextResponse.json({ ok: true, sent: (subs || []).length });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "unknown_error" }, { status: 500 });
  }
}
