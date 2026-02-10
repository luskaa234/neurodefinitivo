import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const subscription = body?.subscription;
    if (!subscription?.endpoint) {
      return NextResponse.json({ error: "invalid_subscription" }, { status: 400 });
    }

    const payload = {
      endpoint: subscription.endpoint,
      p256dh: subscription.keys?.p256dh ?? null,
      auth: subscription.keys?.auth ?? null,
      user_id: body?.userId ?? null,
      user_agent: body?.userAgent ?? null,
      platform: body?.platform ?? null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabaseAdmin
      .from("push_subscriptions")
      .upsert(payload, { onConflict: "endpoint" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "unknown_error" }, { status: 500 });
  }
}
