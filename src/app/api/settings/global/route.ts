import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const SETTINGS_ID = "global";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("app_settings")
      .select("id, data, updated_at")
      .eq("id", SETTINGS_ID)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ settings: data?.data || {} });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "unknown_error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const settings = body?.settings;
    if (!settings || typeof settings !== "object") {
      return NextResponse.json({ error: "invalid_settings" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("app_settings").upsert(
      {
        id: SETTINGS_ID,
        data: settings,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "unknown_error" }, { status: 500 });
  }
}
