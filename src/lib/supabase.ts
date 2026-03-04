import { createClient } from "@supabase/supabase-js";

// Carregar variáveis de ambiente
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

// Garantir que estão definidas
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("❌ Supabase URL ou Anon Key não configurados no .env.local");
}

// Cliente sem schema rígido para evitar inferência "never" em tabelas dinâmicas.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Log de inicialização
console.log("🔧 Supabase configurado:", {
  url: supabaseUrl ? "OK" : "ERRO",
  key: supabaseAnonKey ? "OK" : "ERRO",
});
