"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { LoginForm } from "@/components/LoginForm";
import { Sidebar } from "@/components/Sidebar";
import { Dashboard } from "@/components/Dashboard";
import ExcelScheduleGrid from "@/components/modules/ExcelScheduleGrid";
import { FinancialModule } from "@/components/modules/FinancialModule";
import { AdminFinanceiroTabelaValores } from "@/components/modules/AdminFinanceiroTabelaValores";
import { WhatsAppModule } from "@/components/modules/WhatsAppModule";
import { NotificationCenter } from "@/components/modules/NotificationCenter";
import { PatientManagement } from "@/components/modules/PatientManagement";
import { UserManagement } from "@/components/modules/UserManagement";
import { DoctorManagement } from "@/components/modules/DoctorManagement";
import { DoctorConsultations } from "@/components/modules/DoctorConsultations";
import { MedicalRecords } from "@/components/modules/MedicalRecords";
import { Evaluations } from "@/components/modules/Evaluations";
import { UserProfile } from "@/components/modules/UserProfile";
import { SystemSettings } from "@/components/modules/Settings";
import { PatientDashboard } from "@/components/modules/PatientDashboard";
import { PatientRecords } from "@/components/modules/PatientRecords";
import { PatientFinance } from "@/components/modules/PatientFinance";
import { PatientAppointments } from "@/components/modules/PatientAppointments";
import { DoctorPatients } from "@/components/modules/DoctorPatients";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { formatDateFullBR, nowLocal } from "@/utils/date";
import { loadStoredSettings } from "@/lib/appSettings";
import { isPushSupported, subscribeToPush } from "@/lib/push";

export default function Home() {
  const { user, isLoading } = useAuth();
  const [activeSection, setActiveSection] = useState("dashboard");

  const setSection = (section: string) => {
    setActiveSection(section);
    if (typeof window !== "undefined") {
      const nextHash = `#${section}`;
      if (window.location.hash !== nextHash) {
        window.history.replaceState(null, "", nextHash);
      }
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const applyFromHash = () => {
      const next = window.location.hash.replace("#", "").trim();
      if (next) setActiveSection(next);
    };
    applyFromHash();
    console.log(
      "Local timezone:",
      Intl.DateTimeFormat().resolvedOptions().timeZone
    );
    window.addEventListener("hashchange", applyFromHash);
    return () => window.removeEventListener("hashchange", applyFromHash);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!user?.id) return;
    if (!isPushSupported()) return;

    const syncSettings = async () => {
      try {
        const res = await fetch("/api/settings/global");
        if (!res.ok) return;
        const data = await res.json();
        if (!data?.settings) return;
        localStorage.setItem("app-settings", JSON.stringify(data.settings));
        window.dispatchEvent(new Event("app-settings-updated"));
      } catch {
        // ignore
      }
    };

    const tryAutoSubscribe = () => {
      const settings = loadStoredSettings();
      if (!settings.push_global_enabled) return;
      const key = `push-auto-requested:${user.id}`;
      if (localStorage.getItem(key) === "1") return;
      localStorage.setItem(key, "1");
      subscribeToPush(user.id);
    };

    tryAutoSubscribe();
    syncSettings();
    window.addEventListener("app-settings-updated", tryAutoSubscribe);
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        syncSettings();
      }
    });
    return () => window.removeEventListener("app-settings-updated", tryAutoSubscribe);
  }, [user?.id]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Carregando sistema...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <LoginForm />
        <Toaster position="top-right" richColors />
      </>
    );
  }

  const renderContent = () => {
    // Fluxo do PACIENTE
    if (user.role === "paciente") {
      switch (activeSection) {
        case "dashboard":
          return <PatientDashboard patientId={user.id} />;
        case "meus-agendamentos":
          return <PatientAppointments patientId={user.id} />;
        case "financeiro":
          return <PatientFinance patientId={user.id} />;
        case "prontuarios":
          return <PatientRecords patientId={user.id} />;
        default:
          return (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-2">🚧 Em Desenvolvimento</h2>
                <p className="text-gray-600">
                  Esta seção está sendo desenvolvida e estará disponível em breve.
                </p>
              </div>
            </div>
          );
      }
    }

    // Fluxo ADMIN / FINANCEIRO / MÉDICO / SECRETÁRIA
    switch (activeSection) {
      case "dashboard":
        return <Dashboard />;
      case "agendamento":
        return <ExcelScheduleGrid />;
      case "financeiro":
        return <FinancialModule />;
      case "admin-financeiro-tabela-valores":
        if (user.role !== "admin") {
          return (
            <div className="flex h-64 items-center justify-center">
              <div className="text-center">
                <h2 className="mb-2 text-2xl font-bold">Acesso negado</h2>
                <p className="text-gray-600">Esta área é exclusiva para ADMIN.</p>
              </div>
            </div>
          );
        }
        return <AdminFinanceiroTabelaValores />;
      case "whatsapp":
        return <WhatsAppModule />;
      case "notificacoes":
        return <NotificationCenter />;
      case "usuarios":
        if (user.role !== "admin") {
          return (
            <div className="flex h-64 items-center justify-center">
              <div className="max-w-md rounded-lg border border-red-100 bg-white p-6 text-center shadow-sm">
                <h2 className="mb-2 text-2xl font-bold text-gray-900">Acesso negado</h2>
                <p className="text-gray-600">
                  Apenas administradores podem visualizar ou alterar usuários.
                </p>
              </div>
            </div>
          );
        }
        return <UserManagement />;
      case "medicos":
        return <DoctorManagement />;
      case "pacientes":
        return <PatientManagement />;
      case "prontuarios":
        return <MedicalRecords />;
      case "avaliacoes":
        return <Evaluations />;
      case "configuracoes":
        return <SystemSettings />;
      case "perfil":
        return <UserProfile />;
      case "minhas-consultas":
        return <DoctorConsultations />;
      case "justificar-falta":
        return <DoctorConsultations />;
      case "meus-pacientes":
        return <DoctorPatients />;
      default:
        return (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">🚧 Em Desenvolvimento</h2>
              <p className="text-gray-600">
                Esta seção está sendo desenvolvida e estará disponível em breve.
              </p>
            </div>
          </div>
        );
    }
  };

  return (
    <>
      <div className="flex min-h-dvh overflow-hidden bg-gradient-to-br from-gray-50 via-white to-slate-100">
        <Sidebar
          activeSection={activeSection}
          onSectionChange={setSection}
        />
        <main className="min-h-dvh min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
          <div className="mx-auto w-full max-w-screen-2xl p-3 pt-16 sm:p-4 sm:pt-16 md:p-6 lg:p-8">
            <div className="mb-3 flex justify-end md:justify-end">
              <div className="rounded-full border border-purple-200 bg-white/90 px-4 py-1 text-xs font-semibold text-purple-700 shadow-sm">
                {`Hoje é ${formatDateFullBR(nowLocal())}`}
              </div>
            </div>
            {renderContent()}
          </div>
        </main>
      </div>
      <Toaster position="top-right" richColors />
    </>
  );
}
