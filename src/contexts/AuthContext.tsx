"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

// 🔹 Tipo do usuário
interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "financeiro" | "agendamento" | "medico" | "paciente";
  avatar_url?: string;
  created_at: string;
  is_active: boolean;
  phone?: string;
  cpf?: string;
  birth_date?: string;
  address?: string;
  crm?: string;
  specialty?: string;
  password?: string;
}

// 🔹 Tipo do contexto
interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  loginAsUser: (userId: string) => Promise<boolean>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

// 🔹 Criação do contexto
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // ✅ Carrega usuário salvo ao abrir o app
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("neuro-integrar-user");
      if (storedUser) setUser(JSON.parse(storedUser));
    } catch (error) {
      console.error("Erro ao carregar usuário:", error);
      localStorage.removeItem("neuro-integrar-user");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ✅ Login normal (com email e senha)
  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);

      const { data: userData, error } = await supabase
        .from("users")
        .select("*")
        .eq("email", email)
        .single();

      if (error || !userData) {
        toast.error("E-mail não encontrado");
        return false;
      }

      if (!userData.is_active) {
        toast.error("Usuário inativo");
        return false;
      }

      if (!userData.password || userData.password !== password) {
        toast.error("Senha incorreta");
        return false;
      }

      const userSession: User = { ...userData };
      localStorage.setItem("neuro-integrar-user", JSON.stringify(userSession));
      setUser(userSession);

      toast.success(`Bem-vindo, ${userData.name}!`);
      router.push("/");
      return true;
    } catch (error) {
      console.error("Erro no login:", error);
      toast.error("Erro interno ao tentar fazer login");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ Login direto por ID (para “Entrar como usuário”)
  const loginAsUser = async (userId: string): Promise<boolean> => {
    try {
      setIsLoading(true);

      const { data: userData, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();

      if (error || !userData) {
        toast.error("Usuário não encontrado");
        return false;
      }

      if (!userData.is_active) {
        toast.error("Usuário inativo");
        return false;
      }

      const userSession: User = { ...userData };
      localStorage.setItem("neuro-integrar-user", JSON.stringify(userSession));
      setUser(userSession);

      toast.success(`Logado como ${userData.name}`);
      router.push("/");

      return true;
    } catch (error) {
      console.error("Erro ao logar como usuário:", error);
      toast.error("Erro ao tentar logar como usuário");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ Logout
  const logout = async () => {
    localStorage.removeItem("neuro-integrar-user");
    setUser(null);
    toast.success("Logout realizado com sucesso!");
    router.push("/");
  };

  return (
    <AuthContext.Provider
      value={{ user, login, loginAsUser, logout, isLoading }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ✅ Hook para consumir o contexto
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
