import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase URL ou Anon Key nao configurados.");
}

// Cliente sem schema rigido para evitar inferencia "never" em tabelas dinamicas.
export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "missing-anon-key"
);

console.log("Supabase configurado:", {
  url: supabaseUrl ? "OK" : "ERRO",
  key: supabaseAnonKey ? "OK" : "ERRO",
});
