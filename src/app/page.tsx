"use client";

import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { LoginForm } from "@/components/LoginForm";
import { Sidebar } from "@/components/Sidebar";
import { Dashboard } from "@/components/Dashboard";
import ExcelScheduleGrid from "@/components/modules/ExcelScheduleGrid";
import { FinancialModule } from "@/components/modules/FinancialModule";
import { WhatsAppModule } from "@/components/modules/WhatsAppModule";
import { PatientManagement } from "@/components/modules/PatientManagement";
import { UserManagement } from "@/components/modules/UserManagement";
import { DoctorManagement } from "@/components/modules/DoctorManagement";
import { DoctorConsultations } from "@/components/modules/DoctorConsultations";
import { MedicalRecords } from "@/components/modules/MedicalRecords";
import { Evaluations } from "@/components/modules/Evaluations";
import { UserProfile } from "@/components/modules/UserProfile";
import { SystemSettings } from "@/components/modules/Settings";
import { TestDeleteComponent } from "@/components/TestDeleteComponent";
import { PatientDashboard } from "@/components/modules/PatientDashboard";
import { PatientRecords } from "@/components/modules/PatientRecords";
import { PatientFinance } from "@/components/modules/PatientFinance";
import { PatientAppointments } from "@/components/modules/PatientAppointments";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";

export default function Home() {
  const { user, isLoading } = useAuth();
  const [activeSection, setActiveSection] = useState("dashboard");

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
      case "whatsapp":
        return <WhatsAppModule />;
      case "usuarios":
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
      case "teste-exclusoes":
        return <TestDeleteComponent />;
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
      <div className="flex h-screen bg-gradient-to-br from-gray-50 to-blue-50">
        <Sidebar
          activeSection={activeSection}
          onSectionChange={setActiveSection}
        />
        <main className="flex-1 overflow-auto">
          <div className="p-6">{renderContent()}</div>
        </main>
      </div>
      <Toaster position="top-right" richColors />
    </>
  );
}
