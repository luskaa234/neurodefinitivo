"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  Brain,
  Calendar,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  DollarSign,
  FileText,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Bell,
  Settings,
  Stethoscope,
  User,
  Users,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { DEFAULT_SETTINGS, loadStoredSettings, type AppSettings } from "@/lib/appSettings";

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

type MenuItem = {
  id: string;
  label: string;
  icon: React.ElementType;
};

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

  const getMenuItems = (): MenuItem[] => {
    const baseItems: MenuItem[] = [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    ];
    const profileItem: MenuItem = { id: "perfil", label: "Meu Perfil", icon: User };

    switch (user?.role) {
      case "admin":
        return [
          ...baseItems,
          { id: "usuarios", label: "Usuários", icon: Users },
          { id: "medicos", label: "Médicos", icon: Stethoscope },
          { id: "pacientes", label: "Pacientes", icon: Users },
          { id: "agendamento", label: "Agendamento", icon: Calendar },
          { id: "financeiro", label: "Financeiro", icon: DollarSign },
          { id: "admin-financeiro-tabela-valores", label: "Tabela de Valores", icon: Landmark },
          { id: "prontuarios", label: "Prontuários", icon: FileText },
          { id: "avaliacoes", label: "Avaliações", icon: ClipboardCheck },
          { id: "whatsapp", label: "WhatsApp", icon: MessageSquare },
          { id: "notificacoes", label: "Notificações", icon: Bell },
          { id: "configuracoes", label: "Configurações", icon: Settings },
          profileItem,
        ];

      case "financeiro":
        return [
          ...baseItems,
          { id: "financeiro", label: "Financeiro", icon: DollarSign },
          profileItem,
        ];

      case "agendamento":
        return [
          ...baseItems,
          { id: "usuarios", label: "Usuários", icon: Users },
          { id: "agendamento", label: "Agendamento", icon: Calendar },
          { id: "pacientes", label: "Pacientes", icon: Users },
          { id: "whatsapp", label: "WhatsApp", icon: MessageSquare },
          { id: "notificacoes", label: "Notificações", icon: Bell },
          profileItem,
        ];

      case "medico":
        return [
          ...baseItems,
          { id: "meus-pacientes", label: "Meus Pacientes", icon: Users },
          { id: "minhas-consultas", label: "Minhas Consultas", icon: CalendarCheck },
          { id: "justificar-falta", label: "Justificar Falta", icon: AlertTriangle },
          { id: "prontuarios", label: "Prontuários", icon: FileText },
          { id: "notificacoes", label: "Notificações", icon: Bell },
          profileItem,
        ];

      case "paciente":
        return [
          ...baseItems,
          { id: "meus-agendamentos", label: "Meus Agendamentos", icon: Calendar },
          { id: "financeiro", label: "Financeiro", icon: DollarSign },
          { id: "prontuarios", label: "Meus Prontuários", icon: FileText },
          { id: "notificacoes", label: "Notificações", icon: Bell },
        ];

      default:
        return baseItems;
    }
  };

  const menuItems = getMenuItems();

  return (
    <>
      {isMobile && (
        <div className="fixed left-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-50">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(!isOpen)}
            className="h-10 w-10 rounded-full bg-white p-0 shadow md:h-11 md:w-11"
            aria-label="Abrir menu"
          >
            <Menu className="h-6 w-6 text-gray-700" />
          </Button>
        </div>
      )}

      {!isMobile && (
        <>
          <div
            aria-hidden="true"
            className={cn(
              "hidden h-dvh shrink-0 transition-all duration-300 md:block",
              isCollapsed ? "w-20" : "w-64 xl:w-72"
            )}
          />
          <aside
            className={cn(
              "fixed inset-y-0 left-0 z-30 hidden h-dvh shrink-0 flex-col border-r border-sidebar-border/80 bg-sidebar/95 shadow-xl backdrop-blur-md transition-all duration-300 md:flex",
              isCollapsed ? "w-20" : "w-64 xl:w-72"
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

            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="absolute -right-3 top-20 z-10 rounded-full border bg-white p-1 shadow hover:bg-gray-100"
              aria-label={isCollapsed ? "Expandir menu" : "Recolher menu"}
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          </aside>
        </>
      )}

      {isMobile && (
        <div
          className={cn(
            "fixed inset-0 z-40 flex transition-transform duration-300 md:hidden",
            isOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <aside className="flex h-full w-[min(18rem,86vw)] flex-col bg-sidebar/95 text-base shadow-xl backdrop-blur-md animate-slide-in">
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
          </aside>
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
      className="flex h-16 shrink-0 items-center border-b px-4"
      style={{
        background: `linear-gradient(90deg, ${settings.brand_primary}, ${settings.brand_accent})`,
      }}
    >
      {settings.logo_site_url ? (
        <img
          src={settings.logo_site_url}
          alt={displayName}
          className="mr-2 h-8 w-8 rounded-md bg-white/10 object-contain p-1"
        />
      ) : (
        <Brain className="mr-2 h-7 w-7 text-white" />
      )}
      {!collapsed && <span className="truncate text-lg font-bold text-white">{displayName}</span>}
    </div>
  );
}

function MenuList({
  menuItems,
  activeSection,
  onSectionChange,
  collapsed,
}: {
  menuItems: MenuItem[];
  activeSection: string;
  onSectionChange: (id: string) => void;
  collapsed: boolean;
}) {
  return (
    <ScrollArea className="min-h-0 flex-1 px-3 py-4">
      <div className="space-y-2">
        {menuItems.map((item) => (
          <Button
            key={item.id}
            variant={activeSection === item.id ? "secondary" : "ghost"}
            className={cn(
              "h-11 w-full justify-start rounded-md text-base transition-all duration-200",
              activeSection === item.id
                ? "border-l-4 border-l-primary bg-secondary text-primary shadow"
                : "hover:bg-secondary/70",
              collapsed ? "justify-center px-2" : "px-3"
            )}
            onClick={() => onSectionChange(item.id)}
            title={collapsed ? item.label : undefined}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span className="ml-3 truncate">{item.label}</span>}
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
  logout: () => void | Promise<void>;
  collapsed: boolean;
}) {
  return (
    <div className="shrink-0 border-t border-sidebar-border bg-sidebar-accent p-3">
      {!collapsed && (
        <div className="mb-2 text-xs">
          <p className="truncate font-medium text-gray-800">{user?.name}</p>
          <p className="flex items-center text-gray-500 capitalize">
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-green-500" />
            {user?.role}
          </p>
        </div>
      )}
      <Separator className="mb-2" />
      <Button
        variant="ghost"
        className={cn(
          "h-10 w-full justify-start text-base text-red-600 transition-colors hover:bg-red-50 hover:text-red-700",
          collapsed && "justify-center"
        )}
        onClick={logout}
      >
        <LogOut className="h-4 w-4 shrink-0" />
        {!collapsed && <span className="ml-2">Sair</span>}
      </Button>
    </div>
  );
}
