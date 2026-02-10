"use client";

import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard,
  Users,
  Calendar,
  DollarSign,
  Settings,
  FileText,
  MessageSquare,
  LogOut,
  Brain,
  Stethoscope,
  User,
  CalendarCheck,
  AlertTriangle,
  TestTube,
  Menu,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { DEFAULT_SETTINGS, loadStoredSettings, type AppSettings } from "@/lib/appSettings";

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

export function Sidebar({ activeSection, onSectionChange }: SidebarProps) {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    const checkScreen = () => setIsMobile(window.innerWidth < 768);
    checkScreen();
    window.addEventListener("resize", checkScreen);
    return () => window.removeEventListener("resize", checkScreen);
  }, []);

  useEffect(() => {
    const updateSettings = () => setAppSettings(loadStoredSettings());
    updateSettings();
    window.addEventListener("storage", updateSettings);
    window.addEventListener("app-settings-updated", updateSettings);
    return () => {
      window.removeEventListener("storage", updateSettings);
      window.removeEventListener("app-settings-updated", updateSettings);
    };
  }, []);

  const getMenuItems = () => {
    const baseItems = [{ id: "dashboard", label: "Dashboard", icon: LayoutDashboard }];

    switch (user?.role) {
      case "admin":
        return [
          ...baseItems,
          { id: "usuarios", label: "Usuários", icon: Users },
          { id: "medicos", label: "Médicos", icon: Stethoscope },
          { id: "pacientes", label: "Pacientes", icon: Users },
          { id: "agendamento", label: "Agendamento", icon: Calendar },
          { id: "financeiro", label: "Financeiro", icon: DollarSign },
          { id: "prontuarios", label: "Prontuários", icon: FileText },
          { id: "whatsapp", label: "WhatsApp", icon: MessageSquare },
          { id: "configuracoes", label: "Configurações", icon: Settings },
        ];

      case "financeiro":
        return [...baseItems, { id: "financeiro", label: "Financeiro", icon: DollarSign }];

      case "agendamento":
        return [
          ...baseItems,
          { id: "usuarios", label: "Usuários", icon: Users },
          { id: "agendamento", label: "Agendamento", icon: Calendar },
          { id: "pacientes", label: "Pacientes", icon: Users },
          { id: "whatsapp", label: "WhatsApp", icon: MessageSquare },
        ];

      case "medico":
        return [
          ...baseItems,
          { id: "meus-pacientes", label: "Meus Pacientes", icon: Users },
          { id: "minhas-consultas", label: "Minhas Consultas", icon: CalendarCheck },
          { id: "justificar-falta", label: "Justificar Falta", icon: AlertTriangle },
          { id: "prontuarios", label: "Prontuários", icon: FileText },
          { id: "perfil", label: "Meu Perfil", icon: User },
        ];

      case "paciente":
        return [
          ...baseItems,
          { id: "meus-agendamentos", label: "Meus Agendamentos", icon: Calendar },
          { id: "financeiro", label: "Financeiro", icon: DollarSign },
          { id: "prontuarios", label: "Meus Prontuários", icon: FileText },
        ];

      default:
        return baseItems;
    }
  };

  const menuItems = getMenuItems();

  return (
    <>
      {/* Botão Mobile */}
      {isMobile && (
        <div className="fixed top-3 left-3 z-50">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(!isOpen)}
            className="bg-white shadow rounded-full h-10 w-10 p-0"
          >
            <Menu className="h-6 w-6 text-gray-700" />
          </Button>
        </div>
      )}

      {/* Sidebar Desktop */}
      {!isMobile && (
        <div
          className={cn(
            "hidden md:flex flex-col h-screen bg-sidebar/95 backdrop-blur-md border-r border-sidebar-border/80 shadow-xl transition-all duration-300",
            isCollapsed ? "w-20" : "w-64"
          )}
        >
          <Header collapsed={isCollapsed} settings={appSettings} />
          <MenuList
            menuItems={menuItems}
            activeSection={activeSection}
            onSectionChange={onSectionChange}
            collapsed={isCollapsed}
          />
          <Footer user={user} logout={logout} collapsed={isCollapsed} />

          {/* Botão colapso */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="absolute -right-3 top-20 bg-white border rounded-full p-1 shadow hover:bg-gray-100"
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      )}

      {/* Sidebar Mobile */}
      {isMobile && (
        <div
          className={cn(
            "fixed inset-0 z-40 flex md:hidden transition-transform duration-300",
            isOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="w-72 bg-sidebar/95 backdrop-blur-md shadow-xl flex flex-col text-base animate-slide-in">
            <Header collapsed={false} settings={appSettings} />
            <MenuList
              menuItems={menuItems}
              activeSection={activeSection}
              onSectionChange={(id) => {
                onSectionChange(id);
                setIsOpen(false);
              }}
              collapsed={false}
            />
            <Footer user={user} logout={logout} collapsed={false} />
          </div>
          <div className="flex-1 bg-black/50" onClick={() => setIsOpen(false)} />
        </div>
      )}
    </>
  );
}

function Header({ collapsed, settings }: { collapsed: boolean; settings: AppSettings }) {
  const displayName = settings.site_short_name || settings.company_name || "Neuro";
  return (
    <div
      className="flex h-16 items-center border-b px-4"
      style={{
        background: `linear-gradient(90deg, ${settings.brand_primary}, ${settings.brand_accent})`,
      }}
    >
      {settings.logo_site_url ? (
        <img
          src={settings.logo_site_url}
          alt={displayName}
          className="h-8 w-8 rounded-md object-contain mr-2 bg-white/10 p-1"
        />
      ) : (
        <Brain className="h-7 w-7 text-white mr-2" />
      )}
      {!collapsed && <span className="text-lg font-bold text-white">{displayName}</span>}
    </div>
  );
}

function MenuList({
  menuItems,
  activeSection,
  onSectionChange,
  collapsed,
}: {
  menuItems: any[];
  activeSection: string;
  onSectionChange: (id: string) => void;
  collapsed: boolean;
}) {
  return (
    <ScrollArea className="flex-1 px-3 py-3">
      <div className="space-y-1">
        {menuItems.map((item) => (
          <Button
            key={item.id}
            variant={activeSection === item.id ? "secondary" : "ghost"}
            className={cn(
              "w-full justify-start h-11 text-base transition-all duration-200 rounded-md",
              activeSection === item.id
                ? "bg-secondary text-primary border-l-4 border-l-primary shadow"
                : "hover:bg-secondary/70",
              collapsed ? "px-2 justify-center" : "px-3"
            )}
            onClick={() => onSectionChange(item.id)}
          >
            <item.icon className="h-5 w-5" />
            {!collapsed && <span className="ml-3">{item.label}</span>}
          </Button>
        ))}
      </div>
    </ScrollArea>
  );
}

function Footer({
  user,
  logout,
  collapsed,
}: {
  user: any;
  logout: () => void;
  collapsed: boolean;
}) {
  return (
    <div className="border-t border-sidebar-border p-3 bg-sidebar-accent">
      {!collapsed && (
        <div className="mb-2 text-xs">
          <p className="font-medium text-gray-800 truncate">{user?.name}</p>
          <p className="text-gray-500 capitalize flex items-center">
            <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-1"></span>
            {user?.role}
          </p>
        </div>
      )}
      <Separator className="mb-2" />
      <Button
        variant="ghost"
        className={cn(
          "w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors h-10 text-base",
          collapsed && "justify-center"
        )}
        onClick={logout}
      >
        <LogOut className="h-4 w-4" />
        {!collapsed && <span className="ml-2">Sair</span>}
      </Button>
    </div>
  );
}
