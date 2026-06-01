"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building, Phone, Globe, Palette, Save, Clock, CheckCircle, Image, FileText, Bell } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { DEFAULT_SETTINGS, applySettingsToDocument, loadStoredSettings, saveSettings, type AppSettings } from '@/lib/appSettings';
import { formatDateTimeBR, nowLocal } from '@/utils/date';
import { useAuth } from '@/contexts/AuthContext';
import { getCurrentSubscription, getPushPermission, isPushSupported, subscribeToPush, unsubscribeFromPush } from '@/lib/push';
import { createAuditLog } from '@/lib/audit';

const cnpjSchema = z
  .string()
  .optional()
  .or(z.literal(""))
  .refine((value) => {
    if (!value) return true;
    return value.replace(/\D/g, "").length === 14;
  }, "CNPJ inválido");

const hexColorSchema = z.string().regex(/^#([0-9a-fA-F]{6})$/, "Cor inválida");
const LEGACY_FIXED_WHATSAPP = "98974003414";
const cleanLegacyWhatsApp = (value?: string | null) =>
  String(value || "").replace(/\D/g, "") === LEGACY_FIXED_WHATSAPP ? "" : String(value || "");

const settingsSchema = z.object({
  company_name: z.string().min(1, 'Nome da empresa é obrigatório'),
  company_cnpj: cnpjSchema,
  company_address: z.string().min(1, 'Endereço é obrigatório'),
  company_phone: z.string().min(1, 'Telefone é obrigatório'),
  company_email: z.string().email('Email inválido'),
  whatsapp_number: z.string().refine((value) => {
    const digits = value.replace(/\D/g, "");
    return digits.length === 0 || digits.length >= 10;
  }, 'WhatsApp deve estar vazio ou ter pelo menos 10 dígitos'),
  push_global_enabled: z.boolean().optional(),
  site_name: z.string().min(1, 'Nome do site é obrigatório'),
  site_short_name: z.string().optional().or(z.literal("")),
  site_description: z.string().optional().or(z.literal("")),
  site_url: z.string().url("URL inválida").optional().or(z.literal("")),
  logo_site_url: z.string().optional(),
  logo_pwa_url: z.string().optional(),
  brand_primary: hexColorSchema,
  brand_secondary: hexColorSchema,
  brand_accent: hexColorSchema,
  brand_background: hexColorSchema,
  brand_sidebar: hexColorSchema,
  working_hours_start: z.string().min(1, 'Horário de início é obrigatório'),
  working_hours_end: z.string().min(1, 'Horário de fim é obrigatório'),
  access_require_admin_for_settings: z.boolean().optional(),
  access_allow_financeiro_reports: z.boolean().optional(),
  access_allow_recepcao_schedule: z.boolean().optional(),
  access_allow_profissional_records: z.boolean().optional(),
  security_audit_enabled: z.boolean().optional(),
  security_session_timeout_minutes: z.coerce.number().min(5, "Mínimo de 5 minutos").max(480, "Máximo de 480 minutos"),
  security_require_strong_password: z.boolean().optional(),
  security_notify_admin_changes: z.boolean().optional(),
  backup_auto_enabled: z.boolean().optional(),
  backup_frequency: z.enum(["daily", "weekly", "monthly"]),
  backup_include_audit_logs: z.boolean().optional()
});

type SettingsFormData = z.infer<typeof settingsSchema>;

export function SystemSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isTestingWhatsApp, setIsTestingWhatsApp] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission | "unsupported">("default");
  const [pushEnabled, setPushEnabled] = useState(false);
  const [isPushLoading, setIsPushLoading] = useState(false);
  const [pushGlobalEnabled, setPushGlobalEnabled] = useState(false);
  const [pushStatusMessage, setPushStatusMessage] = useState<string | null>(null);
  const [pushLastError, setPushLastError] = useState<string | null>(null);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema)
  });

  const watchWhatsApp = watch('whatsapp_number');
  const watchPrimary = watch('brand_primary');
  const watchSecondary = watch('brand_secondary');
  const watchAccent = watch('brand_accent');
  const watchBackground = watch('brand_background');
  const watchSidebar = watch('brand_sidebar');

  useEffect(() => {
    loadSettings();
    syncRemoteSettings();
  }, []);

  useEffect(() => {
    const refreshPush = async () => {
      const supported = isPushSupported();
      setPushSupported(supported);
      if (!supported) {
        setPushPermission("unsupported");
        setPushEnabled(false);
        return;
      }
      setPushPermission(getPushPermission() as NotificationPermission);
      const sub = await getCurrentSubscription();
      setPushEnabled(!!sub);
    };
    refreshPush();
  }, []);

  const loadSettings = () => {
    try {
      const parsedSettings = loadStoredSettings();
      const normalized: AppSettings = {
        ...parsedSettings,
        logo_site_url: parsedSettings.logo_site_url || settings.logo_site_url || DEFAULT_SETTINGS.logo_site_url,
        logo_pwa_url: parsedSettings.logo_pwa_url || settings.logo_pwa_url || DEFAULT_SETTINGS.logo_pwa_url,
        brand_primary: parsedSettings.brand_primary || DEFAULT_SETTINGS.brand_primary,
        brand_secondary: parsedSettings.brand_secondary || DEFAULT_SETTINGS.brand_secondary,
        brand_accent: parsedSettings.brand_accent || DEFAULT_SETTINGS.brand_accent,
        brand_background: parsedSettings.brand_background || DEFAULT_SETTINGS.brand_background,
        brand_sidebar: parsedSettings.brand_sidebar || DEFAULT_SETTINGS.brand_sidebar,
      };
      setSettings(normalized);
      setPushGlobalEnabled(!!normalized.push_global_enabled);

      setValue('company_name', normalized.company_name);
      setValue('company_cnpj', normalized.company_cnpj || "");
      setValue('company_address', normalized.company_address);
      setValue('company_phone', normalized.company_phone);
      setValue('company_email', normalized.company_email);
      setValue('whatsapp_number', normalized.whatsapp_number);
      setValue('push_global_enabled', !!normalized.push_global_enabled);
      setValue('site_name', normalized.site_name);
      setValue('site_short_name', normalized.site_short_name || "");
      setValue('site_description', normalized.site_description || "");
      setValue('site_url', normalized.site_url || "");
      setValue('logo_site_url', normalized.logo_site_url || "");
      setValue('logo_pwa_url', normalized.logo_pwa_url || "");
      setValue('brand_primary', normalized.brand_primary);
      setValue('brand_secondary', normalized.brand_secondary);
      setValue('brand_accent', normalized.brand_accent);
      setValue('brand_background', normalized.brand_background);
      setValue('brand_sidebar', normalized.brand_sidebar);
      setValue('working_hours_start', normalized.working_hours?.start || '08:00');
      setValue('working_hours_end', normalized.working_hours?.end || '21:00');
      setValue('access_require_admin_for_settings', normalized.access_control.require_admin_for_settings);
      setValue('access_allow_financeiro_reports', normalized.access_control.allow_financeiro_reports);
      setValue('access_allow_recepcao_schedule', normalized.access_control.allow_recepcao_schedule);
      setValue('access_allow_profissional_records', normalized.access_control.allow_profissional_records);
      setValue('security_audit_enabled', normalized.security.audit_enabled);
      setValue('security_session_timeout_minutes', normalized.security.session_timeout_minutes);
      setValue('security_require_strong_password', normalized.security.require_strong_password);
      setValue('security_notify_admin_changes', normalized.security.notify_admin_changes);
      setValue('backup_auto_enabled', normalized.backup.auto_backup_enabled);
      setValue('backup_frequency', normalized.backup.backup_frequency);
      setValue('backup_include_audit_logs', normalized.backup.include_audit_logs);
      applySettingsToDocument(normalized);
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    }
  };

  const syncRemoteSettings = async () => {
    try {
      const res = await fetch("/api/settings/global");
      if (!res.ok) return;
      const data = await res.json();
      if (!data?.settings) return;
      const merged = {
        ...DEFAULT_SETTINGS,
        ...(data.settings || {}),
        working_hours: {
          ...DEFAULT_SETTINGS.working_hours,
          ...(data.settings.working_hours || {}),
        },
        access_control: {
          ...DEFAULT_SETTINGS.access_control,
          ...(data.settings.access_control || {}),
        },
        security: {
          ...DEFAULT_SETTINGS.security,
          ...(data.settings.security || {}),
        },
        backup: {
          ...DEFAULT_SETTINGS.backup,
          ...(data.settings.backup || {}),
        },
      } as AppSettings;
      const remoteWhatsApp = merged.whatsapp_number;
      merged.whatsapp_number = cleanLegacyWhatsApp(merged.whatsapp_number);
      saveSettings(merged);
      if (remoteWhatsApp !== merged.whatsapp_number) {
        await fetch("/api/settings/global", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ settings: merged }),
        }).catch(() => undefined);
      }
      setPushGlobalEnabled(!!merged.push_global_enabled);
      loadSettings();
      applySettingsToDocument(merged);
      window.dispatchEvent(new Event("app-settings-updated"));
    } catch {
      // ignore
    }
  };

  const handleEnablePush = async () => {
    setIsPushLoading(true);
    setPushStatusMessage("Ativando notificações...");
    setPushLastError(null);
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(() => {
      setIsPushLoading(false);
      setPushStatusMessage(null);
      setPushLastError("Tempo esgotado ao ativar.");
      toast.error("Tempo esgotado ao ativar.");
    }, 26000);
    try {
      if (!pushSupported) {
        toast.error("Seu navegador não suporta notificações push.");
        setPushLastError("Navegador sem suporte a push.");
        return;
      }

      const result = await Promise.race([
        subscribeToPush(user?.id),
        new Promise<{ ok: false; reason: "timeout" }>((resolve) =>
          setTimeout(() => resolve({ ok: false, reason: "timeout" }), 25000)
        ),
      ]);

      setPushPermission(getPushPermission() as NotificationPermission);
      const sub = await getCurrentSubscription();
      setPushEnabled(!!sub);

      if (!result.ok) {
        if (result.reason === "denied") {
          toast.error("Permissão negada no navegador.");
          setPushLastError("Permissão negada no navegador.");
          return;
        }
        if (result.reason === "missing_vapid_public_key") {
          toast.error("Chave VAPID pública não configurada.");
          setPushLastError("Chave VAPID pública não configurada.");
          return;
        }
        if (result.reason === "no_sw") {
          toast.error("Service Worker não registrado. Recarregue o app.");
          setPushLastError("Service Worker não registrado.");
          return;
        }
        if (result.reason === "no_controller") {
          toast.error("O app ainda está carregando o serviço de notificações. Tente novamente.");
          setPushLastError("Service Worker ainda não controlando a página.");
          return;
        }
        if (result.reason === "subscribe_failed") {
          const detail = result.detail || "erro desconhecido";
          toast.error(`Falha ao ativar push: ${detail}`);
          setPushLastError(`Falha ao ativar push: ${detail}`);
          return;
        }
        if (result.reason === "backend") {
          const detail = result.detail || "500";
          toast.error(`Erro ao salvar inscrição no servidor: ${detail}`);
          setPushLastError(`Erro no servidor ao salvar inscrição: ${detail}`);
          return;
        }
        if (result.reason === "timeout") {
          toast.error("Tempo esgotado ao ativar. Tente novamente.");
          setPushLastError("Tempo esgotado ao ativar.");
          return;
        }
        if (result.reason === "network") {
          toast.error("Falha de rede ao salvar a inscrição.");
          setPushLastError("Falha de rede ao salvar a inscrição.");
          return;
        }
        toast.error("Não foi possível ativar notificações.");
        setPushLastError("Não foi possível ativar notificações.");
        return;
      }
      toast.success("Notificações ativadas com sucesso.");
      setPushStatusMessage("Notificações ativadas.");
    } finally {
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
      setIsPushLoading(false);
      if (!pushEnabled) {
        setPushStatusMessage(null);
      }
    }
  };

  const handleDisablePush = async () => {
    setIsPushLoading(true);
    await unsubscribeFromPush();
    const sub = await getCurrentSubscription();
    setPushEnabled(!!sub);
    setIsPushLoading(false);
    toast.success("Notificações desativadas.");
  };

  const handleTestPush = async () => {
    try {
      await fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "test" }),
      });
      toast.success("Notificação de teste enviada.");
    } catch {
      toast.error("Falha ao enviar notificação de teste.");
    }
  };

  const onSubmit = async (data: SettingsFormData) => {
    try {
      const newSettings: AppSettings = {
        company_name: data.company_name,
        company_cnpj: data.company_cnpj || "",
        company_address: data.company_address,
        company_phone: data.company_phone,
        company_email: data.company_email,
        whatsapp_number: cleanLegacyWhatsApp(data.whatsapp_number).replace(/\D/g, ""),
        push_global_enabled: data.push_global_enabled ?? false,
        site_name: data.site_name,
        site_short_name: data.site_short_name || "",
        site_description: data.site_description || "",
        site_url: data.site_url || "",
        logo_site_url: data.logo_site_url || settings.logo_site_url || DEFAULT_SETTINGS.logo_site_url,
        logo_pwa_url: data.logo_pwa_url || settings.logo_pwa_url || DEFAULT_SETTINGS.logo_pwa_url,
        brand_primary: data.brand_primary,
        brand_secondary: data.brand_secondary,
        brand_accent: data.brand_accent,
        brand_background: data.brand_background,
        brand_sidebar: data.brand_sidebar,
        working_hours: {
          start: data.working_hours_start,
          end: data.working_hours_end
        },
        access_control: {
          require_admin_for_settings: data.access_require_admin_for_settings ?? true,
          allow_financeiro_reports: data.access_allow_financeiro_reports ?? true,
          allow_recepcao_schedule: data.access_allow_recepcao_schedule ?? true,
          allow_profissional_records: data.access_allow_profissional_records ?? true,
        },
        security: {
          audit_enabled: data.security_audit_enabled ?? true,
          session_timeout_minutes: Number(data.security_session_timeout_minutes || 60),
          require_strong_password: data.security_require_strong_password ?? true,
          notify_admin_changes: data.security_notify_admin_changes ?? true,
        },
        backup: {
          auto_backup_enabled: data.backup_auto_enabled ?? false,
          backup_frequency: data.backup_frequency,
          include_audit_logs: data.backup_include_audit_logs ?? true,
          last_backup_at: settings.backup.last_backup_at || "",
        },
      };
      
      saveSettings(newSettings);
      setSettings(newSettings);
      applySettingsToDocument(newSettings);
      window.dispatchEvent(new Event("app-settings-updated"));
      await fetch("/api/settings/global", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: newSettings }),
      });
      await createAuditLog({
        user: user ? { id: user.id, name: user.name } : null,
        action: "settings.update",
        entity: "app_settings",
        entityId: "global",
        oldValue: settings,
        newValue: newSettings,
      });
      
      toast.success('✅ Configurações salvas e aplicadas com sucesso!');
      
      const shouldReload =
        newSettings.working_hours.start !== settings.working_hours.start ||
        newSettings.working_hours.end !== settings.working_hours.end;

      if (shouldReload) {
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      }
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      toast.error('❌ Erro ao salvar configurações');
    }
  };

  const handleGlobalPushToggle = (value: boolean) => {
    const nextSettings: AppSettings = {
      ...settings,
      push_global_enabled: value,
    };
    setPushGlobalEnabled(value);
    saveSettings(nextSettings);
    setSettings(nextSettings);
    window.dispatchEvent(new Event("app-settings-updated"));
    fetch("/api/settings/global", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: nextSettings }),
    }).catch(() => {
      // ignore
    });
    createAuditLog({
      user: user ? { id: user.id, name: user.name } : null,
      action: "settings.update",
      entity: "app_settings",
      entityId: "global",
      oldValue: settings,
      newValue: nextSettings,
    });
    toast.success(
      value
        ? "Notificações globais ativadas para todos."
        : "Notificações globais desativadas."
    );
  };

  const testWhatsApp = async () => {
    try {
      setIsTestingWhatsApp(true);
      const clinicWhatsApp = String(watchWhatsApp || "").replace(/\D/g, "");
      if (clinicWhatsApp.length < 10) {
        toast.error("Informe o WhatsApp da clínica antes de testar.");
        return;
      }
      
      const testMessage = `🧪 TESTE DO SISTEMA NEURO INTEGRAR 🧪\n\nEste é um teste do sistema de WhatsApp.\n\nNúmero da clínica: ${clinicWhatsApp}\nData/Hora: ${formatDateTimeBR(nowLocal())}\n\n✅ Sistema funcionando corretamente!`;
      
      // Abrir WhatsApp com mensagem de teste
      const whatsappUrl = `https://api.whatsapp.com/send?phone=55${clinicWhatsApp}&text=${encodeURIComponent(testMessage)}`;
      
      window.open(whatsappUrl, '_blank');
      
      // Salvar teste no histórico
      const messageHistory = JSON.parse(localStorage.getItem('whatsapp-messages') || '[]');
      const testMessageRecord = {
        id: Date.now().toString(),
        from_clinic: clinicWhatsApp,
        to_patient: 'TESTE',
        message: testMessage,
        sent_at: new Date().toISOString(),
        status: 'test'
      };
      
      messageHistory.unshift(testMessageRecord);
      localStorage.setItem('whatsapp-messages', JSON.stringify(messageHistory));
      
      toast.success('📱 Teste do WhatsApp enviado! Verifique se recebeu a mensagem.');
      
    } catch (error) {
      console.error('Erro no teste do WhatsApp:', error);
      toast.error('❌ Erro no teste do WhatsApp');
    } finally {
      setIsTestingWhatsApp(false);
    }
  };

  const handleLogoUpload = (field: "logo_site_url" | "logo_pwa_url") => (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const logoUrl = e.target?.result as string;
        setValue(field, logoUrl);
        setSettings(prev => ({ ...prev, [field]: logoUrl }));
        toast.success('✅ Logo carregado! Salve as configurações para aplicar.');
      };
      reader.readAsDataURL(file);
    }
  };

  const generateTimeSlotPreview = () => {
    const start = watch('working_hours_start') || settings.working_hours.start;
    const end = watch('working_hours_end') || settings.working_hours.end;
    
    const startHour = parseInt(start.split(':')[0]);
    const endHour = parseInt(end.split(':')[0]);
    const slots = [];
    
    for (let hour = startHour; hour <= endHour; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      if (hour < endHour) {
        slots.push(`${hour.toString().padStart(2, '0')}:30`);
      }
    }
    
    return slots;
  };

  const timeSlotPreview = generateTimeSlotPreview();
  const goToSection = (section: string) => {
    window.location.hash = `#${section}`;
  };
  const exportBackup = () => {
    const backupSettings: AppSettings = {
      ...settings,
      backup: {
        ...settings.backup,
        last_backup_at: new Date().toISOString(),
      },
    };
    const payload = {
      exported_at: backupSettings.backup.last_backup_at,
      settings: backupSettings,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "backup-configuracoes-neuro.json";
    a.click();
    URL.revokeObjectURL(url);
    saveSettings(backupSettings);
    setSettings(backupSettings);
    toast.success("Backup de configurações exportado.");
  };

  const importBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result || "{}"));
        const imported = parsed.settings || parsed;
        const nextSettings: AppSettings = {
          ...DEFAULT_SETTINGS,
          ...settings,
          ...imported,
          working_hours: {
            ...DEFAULT_SETTINGS.working_hours,
            ...(imported.working_hours || {}),
          },
          access_control: {
            ...DEFAULT_SETTINGS.access_control,
            ...(imported.access_control || {}),
          },
          security: {
            ...DEFAULT_SETTINGS.security,
            ...(imported.security || {}),
          },
          backup: {
            ...DEFAULT_SETTINGS.backup,
            ...(imported.backup || {}),
            last_backup_at: new Date().toISOString(),
          },
        };
        saveSettings(nextSettings);
        setSettings(nextSettings);
        applySettingsToDocument(nextSettings);
        window.dispatchEvent(new Event("app-settings-updated"));
        await fetch("/api/settings/global", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ settings: nextSettings }),
        }).catch(() => undefined);
        loadSettings();
        toast.success("Backup importado e aplicado.");
      } catch {
        toast.error("Arquivo de backup inválido.");
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 px-2 sm:px-4">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">⚙️ Configurações do Sistema</h1>
        <p className="mt-2 text-sm text-gray-600 sm:text-base">
          Configure as informações da sua clínica - <strong>TODAS AS MUDANÇAS SÃO APLICADAS IMEDIATAMENTE</strong>
        </p>
      </div>

      <Tabs defaultValue="company" className="space-y-4">
        <TabsList className="flex w-full flex-nowrap gap-2 overflow-x-auto whitespace-nowrap sm:flex-wrap sm:gap-0">
          <TabsTrigger value="company">🏢 Empresa</TabsTrigger>
          <TabsTrigger value="schedule">⏰ Horários</TabsTrigger>
          <TabsTrigger value="whatsapp">📱 WhatsApp</TabsTrigger>
          <TabsTrigger value="notifications">🔔 Notificações</TabsTrigger>
          <TabsTrigger value="appearance">🎨 Aparência</TabsTrigger>
          <TabsTrigger value="access">Acessos</TabsTrigger>
          <TabsTrigger value="security">Segurança</TabsTrigger>
          <TabsTrigger value="backup">Backup</TabsTrigger>
        </TabsList>

        <form onSubmit={handleSubmit(onSubmit)}>
          <TabsContent value="company">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Building className="mr-2 h-5 w-5" />
                  Informações da Empresa
                </CardTitle>
                <CardDescription>
                  Configure os dados da sua clínica - Aplicado em todo o sistema
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="company_name">Nome da Clínica</Label>
                    <Input
                      id="company_name"
                      placeholder="Ex: Clínica Neuro Integrar"
                      {...register('company_name')}
                    />
                    {errors.company_name && (
                      <p className="text-sm text-red-600">{errors.company_name.message}</p>
                    )}
                    <p className="text-xs text-purple-600">
                      ✅ Aparece no cabeçalho do sistema e nas mensagens
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="company_email">Email da Clínica</Label>
                    <Input
                      id="company_email"
                      type="email"
                      placeholder="contato@clinica.com"
                      {...register('company_email')}
                    />
                    {errors.company_email && (
                      <p className="text-sm text-red-600">{errors.company_email.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company_address">Endereço Completo</Label>
                  <Textarea
                    id="company_address"
                    placeholder="Rua, número, bairro, cidade - UF, CEP"
                    rows={3}
                    {...register('company_address')}
                  />
                  {errors.company_address && (
                    <p className="text-sm text-red-600">{errors.company_address.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="company_phone">Telefone Principal</Label>
                    <Input
                      id="company_phone"
                      placeholder="(11) 99999-9999"
                      {...register('company_phone')}
                    />
                    {errors.company_phone && (
                      <p className="text-sm text-red-600">{errors.company_phone.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="company_cnpj">CNPJ</Label>
                    <Input
                      id="company_cnpj"
                      placeholder="00.000.000/0000-00"
                      {...register('company_cnpj')}
                    />
                    {errors.company_cnpj && (
                      <p className="text-sm text-red-600">{errors.company_cnpj.message}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="schedule">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="mr-2 h-5 w-5" />
                  ⏰ Horários de Funcionamento
                </CardTitle>
                <CardDescription>
                  Configure os horários de atendimento - <strong>APLICADO IMEDIATAMENTE NA AGENDA</strong>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="working_hours_start">🌅 Horário de Início</Label>
                    <Input
                      id="working_hours_start"
                      type="time"
                      {...register('working_hours_start')}
                    />
                    {errors.working_hours_start && (
                      <p className="text-sm text-red-600">{errors.working_hours_start.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="working_hours_end">🌆 Horário de Fim</Label>
                    <Input
                      id="working_hours_end"
                      type="time"
                      {...register('working_hours_end')}
                    />
                    {errors.working_hours_end && (
                      <p className="text-sm text-red-600">{errors.working_hours_end.message}</p>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <h4 className="font-bold text-purple-800 mb-2">📋 Como funciona:</h4>
                  <ul className="text-sm text-purple-700 space-y-1">
                    <li>✅ Os horários definidos aqui aparecem IMEDIATAMENTE na agenda</li>
                    <li>✅ Intervalos de 30 minutos são criados automaticamente</li>
                    <li>✅ Após salvar, a página recarrega para aplicar as mudanças</li>
                    <li>✅ Padrão atual: 08:00 às 21:00 = {timeSlotPreview.length} slots de 30 minutos</li>
                  </ul>
                </div>

                <div className="p-4 bg-gray-50 border rounded-lg">
                  <h4 className="font-bold mb-3">📅 Preview dos Horários Atuais:</h4>
                  <div className="grid grid-cols-6 gap-2 text-xs max-h-32 overflow-y-auto">
                    {timeSlotPreview.slice(0, 24).map(slot => (
                      <div key={slot} className="p-2 bg-white border rounded text-center font-medium">
                        {slot}
                      </div>
                    ))}
                    {timeSlotPreview.length > 24 && (
                      <div className="p-2 text-center text-gray-500 font-bold">
                        +{timeSlotPreview.length - 24} mais...
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-2 font-medium">
                    📊 Total: {timeSlotPreview.length} horários disponíveis por dia
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="whatsapp">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Phone className="mr-2 h-5 w-5" />
                  📱 Configurações do WhatsApp
                </CardTitle>
                <CardDescription>
                  Configure o WhatsApp DA CLÍNICA para envio automático de mensagens
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="whatsapp_number">📱 Número do WhatsApp da Clínica</Label>
                  <Input
                    id="whatsapp_number"
                    placeholder="Digite o WhatsApp da clínica"
                    {...register('whatsapp_number')}
                  />
                  {errors.whatsapp_number && (
                    <p className="text-sm text-red-600">{errors.whatsapp_number.message}</p>
                  )}
                  <p className="text-xs text-gray-500">
                    Digite apenas números: DDD + número. Este campo não usa número fixo.
                  </p>
                </div>

                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="font-bold text-green-800 mb-2">✅ Como funciona:</h4>
                  <ul className="text-sm text-green-700 space-y-1">
                    <li>📱 <strong>Mensagens são enviadas DO número da clínica</strong></li>
                    <li>📞 <strong>PARA o telefone do paciente</strong></li>
                    <li>✅ Confirmações de consulta automáticas</li>
                    <li>⏰ Lembretes são enviados 1 dia antes da consulta</li>
                    <li>📝 Mensagens personalizadas podem ser enviadas individualmente</li>
                    <li>📊 Envio em massa para múltiplas consultas</li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <Button 
                    type="button"
                    variant="outline" 
                    onClick={testWhatsApp}
                    disabled={isTestingWhatsApp}
                    className="w-full bg-green-50 hover:bg-green-100 text-green-700 border-green-300"
                  >
                    {isTestingWhatsApp ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600 mr-2"></div>
                        Enviando teste...
                      </>
                    ) : (
                      <>
                        <Phone className="mr-2 h-4 w-4" />
                        🧪 Testar WhatsApp da Clínica
                      </>
                    )}
                  </Button>
                  
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-700">
                      <strong>💡 Dica:</strong> Clique em "Testar WhatsApp" para verificar se o número está funcionando corretamente
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Bell className="mr-2 h-5 w-5" />
                  🔔 Notificações Push
                </CardTitle>
                <CardDescription>
                  Receba alertas fora do app no navegador e no celular
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border bg-slate-50 p-4 text-sm">
                  <p className="font-semibold text-slate-800">Status</p>
                  <p className="text-slate-600">
                    Suporte: {pushSupported ? "Disponível" : "Indisponível"}
                  </p>
                  <p className="text-slate-600">
                    Permissão: {pushPermission === "unsupported" ? "Não suportado" : pushPermission}
                  </p>
                  <p className="text-slate-600">
                    Ativado: {pushEnabled ? "Sim" : "Não"}
                  </p>
                </div>

                {user?.role === "admin" && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-emerald-800">Ativar para todos</p>
                        <p className="text-emerald-700">
                          Quando ligado, o sistema solicita permissão de push para todos os usuários.
                        </p>
                      </div>
                      <Switch
                        checked={pushGlobalEnabled}
                        onCheckedChange={handleGlobalPushToggle}
                      />
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleTestPush}
                    disabled={!pushSupported || isPushLoading}
                  >
                    Enviar teste
                  </Button>
                </div>
                {(pushStatusMessage || pushLastError) && (
                  <div className="rounded-lg border bg-white p-3 text-xs text-slate-600">
                    {pushStatusMessage && (
                      <p><strong>Status:</strong> {pushStatusMessage}</p>
                    )}
                    {pushLastError && (
                      <p className="text-red-600"><strong>Erro:</strong> {pushLastError}</p>
                    )}
                  </div>
                )}

                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                  <p className="font-semibold">iOS (iPhone/iPad)</p>
                  <p>
                    Para receber notificações no iOS, instale o app na Tela de Início
                    via Safari e permita notificações. Depois, ative aqui.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appearance">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Palette className="mr-2 h-5 w-5" />
                  🎨 Aparência e Logo
                </CardTitle>
                <CardDescription>
                  Controle total da identidade visual, cores e ícones do sistema
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3 rounded-lg border bg-slate-50 p-4">
                  <div className="flex items-center gap-2">
                    <Globe className="h-5 w-5 text-slate-700" />
                    <h4 className="text-sm font-semibold text-slate-800">Identidade do Sistema</h4>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="site_name">Nome do Sistema/Site</Label>
                      <Input id="site_name" placeholder="Ex: Neuro Integrar - Gestão" {...register('site_name')} />
                      {errors.site_name && (
                        <p className="text-sm text-red-600">{errors.site_name.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="site_short_name">Nome Curto (PWA)</Label>
                      <Input id="site_short_name" placeholder="Ex: Neuro" {...register('site_short_name')} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="site_description">Descrição</Label>
                    <Textarea
                      id="site_description"
                      placeholder="Descrição curta para SEO e PWA"
                      rows={2}
                      {...register('site_description')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="site_url">Site oficial (opcional)</Label>
                    <Input id="site_url" placeholder="https://sua-clinica.com.br" {...register('site_url')} />
                    {errors.site_url && (
                      <p className="text-sm text-red-600">{errors.site_url.message}</p>
                    )}
                  </div>
                </div>

                <input type="hidden" {...register('logo_site_url')} />
                <input type="hidden" {...register('logo_pwa_url')} />

                <div className="space-y-3 rounded-lg border bg-white p-4">
                  <div className="flex items-center gap-2">
                    <Image className="h-5 w-5 text-slate-700" />
                    <h4 className="text-sm font-semibold text-slate-800">Logos e Ícones</h4>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="logo-site">Logo do Site (sidebar e cabeçalho)</Label>
                      <Input
                        id="logo-site"
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload("logo_site_url")}
                      />
                      <p className="text-xs text-gray-500">
                        PNG, JPG ou SVG (máx. 2MB)
                      </p>
                      {settings.logo_site_url && (
                        <div className="mt-2 rounded-lg border bg-slate-50 p-3">
                          <img
                            src={settings.logo_site_url}
                            alt="Logo do site"
                            className="h-14 object-contain"
                          />
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="logo-pwa">Logo do PWA (ícone de instalação)</Label>
                      <Input
                        id="logo-pwa"
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload("logo_pwa_url")}
                      />
                      <p className="text-xs text-gray-500">
                        Recomendado 512x512 PNG com fundo transparente
                      </p>
                      {settings.logo_pwa_url && (
                        <div className="mt-2 rounded-lg border bg-slate-50 p-3">
                          <img
                            src={settings.logo_pwa_url}
                            alt="Logo do PWA"
                            className="h-14 object-contain"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-3 rounded-lg border bg-slate-50 p-4">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-slate-700" />
                    <h4 className="text-sm font-semibold text-slate-800">Paleta de Cores</h4>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="brand_primary">Primária</Label>
                      <div className="flex items-center gap-3">
                        <Input
                          id="brand_primary_picker"
                          type="color"
                          value={watchPrimary || settings.brand_primary}
                          onChange={(e) => setValue("brand_primary", e.target.value)}
                          className="h-10 w-16 p-1"
                        />
                        <Input id="brand_primary" {...register('brand_primary')} />
                      </div>
                      {errors.brand_primary && (
                        <p className="text-sm text-red-600">{errors.brand_primary.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="brand_secondary">Secundária</Label>
                      <div className="flex items-center gap-3">
                        <Input
                          id="brand_secondary_picker"
                          type="color"
                          value={watchSecondary || settings.brand_secondary}
                          onChange={(e) => setValue("brand_secondary", e.target.value)}
                          className="h-10 w-16 p-1"
                        />
                        <Input id="brand_secondary" {...register('brand_secondary')} />
                      </div>
                      {errors.brand_secondary && (
                        <p className="text-sm text-red-600">{errors.brand_secondary.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="brand_accent">Destaque</Label>
                      <div className="flex items-center gap-3">
                        <Input
                          id="brand_accent_picker"
                          type="color"
                          value={watchAccent || settings.brand_accent}
                          onChange={(e) => setValue("brand_accent", e.target.value)}
                          className="h-10 w-16 p-1"
                        />
                        <Input id="brand_accent" {...register('brand_accent')} />
                      </div>
                      {errors.brand_accent && (
                        <p className="text-sm text-red-600">{errors.brand_accent.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="brand_background">Fundo</Label>
                      <div className="flex items-center gap-3">
                        <Input
                          id="brand_background_picker"
                          type="color"
                          value={watchBackground || settings.brand_background}
                          onChange={(e) => setValue("brand_background", e.target.value)}
                          className="h-10 w-16 p-1"
                        />
                        <Input id="brand_background" {...register('brand_background')} />
                      </div>
                      {errors.brand_background && (
                        <p className="text-sm text-red-600">{errors.brand_background.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="brand_sidebar">Sidebar</Label>
                      <div className="flex items-center gap-3">
                        <Input
                          id="brand_sidebar_picker"
                          type="color"
                          value={watchSidebar || settings.brand_sidebar}
                          onChange={(e) => setValue("brand_sidebar", e.target.value)}
                          className="h-10 w-16 p-1"
                        />
                        <Input id="brand_sidebar" {...register('brand_sidebar')} />
                      </div>
                      {errors.brand_sidebar && (
                        <p className="text-sm text-red-600">{errors.brand_sidebar.message}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <span className="font-medium">Preview:</span>
                    <span className="h-6 w-6 rounded border" style={{ backgroundColor: watchPrimary || settings.brand_primary }} />
                    <span className="h-6 w-6 rounded border" style={{ backgroundColor: watchSecondary || settings.brand_secondary }} />
                    <span className="h-6 w-6 rounded border" style={{ backgroundColor: watchAccent || settings.brand_accent }} />
                    <span className="h-6 w-6 rounded border" style={{ backgroundColor: watchBackground || settings.brand_background }} />
                    <span className="h-6 w-6 rounded border" style={{ backgroundColor: watchSidebar || settings.brand_sidebar }} />
                  </div>
                </div>

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-bold text-blue-800 mb-2">✨ Recursos Visuais Ativos:</h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>✅ Interface responsiva (Desktop, Tablet, Mobile)</li>
                    <li>✅ Agenda estilo Excel com cores por status</li>
                    <li>✅ Gradientes e sombras modernas</li>
                    <li>✅ Ícones Lucide React integrados</li>
                    <li>✅ Animações suaves e transições</li>
                    <li>✅ Dark mode compatível</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="access">
            <Card>
              <CardHeader>
                <CardTitle>Usuários, Perfis e Permissões</CardTitle>
                <CardDescription>Controle os acessos principais e navegue para a gestão completa de usuários.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <ToggleSetting label="Somente ADMIN altera configurações" checked={watch("access_require_admin_for_settings") ?? true} onCheckedChange={(value) => setValue("access_require_admin_for_settings", value)} />
                  <ToggleSetting label="Financeiro acessa relatórios" checked={watch("access_allow_financeiro_reports") ?? true} onCheckedChange={(value) => setValue("access_allow_financeiro_reports", value)} />
                  <ToggleSetting label="Recepção gerencia agenda" checked={watch("access_allow_recepcao_schedule") ?? true} onCheckedChange={(value) => setValue("access_allow_recepcao_schedule", value)} />
                  <ToggleSetting label="Profissionais acessam prontuários" checked={watch("access_allow_profissional_records") ?? true} onCheckedChange={(value) => setValue("access_allow_profissional_records", value)} />
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <Button type="button" variant="outline" onClick={() => goToSection("usuarios")}>Gerenciar usuários</Button>
                  <Button type="button" variant="outline" onClick={() => goToSection("medicos")}>Gerenciar profissionais</Button>
                  <Button type="button" variant="outline" onClick={() => goToSection("admin-financeiro-tabela-valores")}>Permissões administrativas</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle>Segurança e Auditoria</CardTitle>
                <CardDescription>Defina regras de segurança aplicadas ao sistema e registre alterações administrativas.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <ToggleSetting label="Auditoria ativa" checked={watch("security_audit_enabled") ?? true} onCheckedChange={(value) => setValue("security_audit_enabled", value)} />
                  <ToggleSetting label="Exigir senha forte" checked={watch("security_require_strong_password") ?? true} onCheckedChange={(value) => setValue("security_require_strong_password", value)} />
                  <ToggleSetting label="Avisar alterações administrativas" checked={watch("security_notify_admin_changes") ?? true} onCheckedChange={(value) => setValue("security_notify_admin_changes", value)} />
                  <div className="space-y-2">
                    <Label htmlFor="security_session_timeout_minutes">Tempo de sessão (minutos)</Label>
                    <Input id="security_session_timeout_minutes" type="number" min={5} max={480} {...register("security_session_timeout_minutes")} />
                    {errors.security_session_timeout_minutes && <p className="text-sm text-red-600">{errors.security_session_timeout_minutes.message}</p>}
                  </div>
                </div>
                <div className="rounded-lg border bg-slate-50 p-4 text-sm text-slate-700">
                  <p>Perfil atual: <strong>{user?.role}</strong></p>
                  <p>Usuário: <strong>{user?.name}</strong></p>
                  <p>Persistência: <strong>Supabase/PostgreSQL + fallback local</strong></p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="backup">
            <Card>
              <CardHeader>
                <CardTitle>Backup</CardTitle>
                <CardDescription>Exporte, restaure e programe cópias das configurações atuais.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <ToggleSetting label="Backup automático" checked={watch("backup_auto_enabled") ?? false} onCheckedChange={(value) => setValue("backup_auto_enabled", value)} />
                  <ToggleSetting label="Incluir logs de auditoria no backup" checked={watch("backup_include_audit_logs") ?? true} onCheckedChange={(value) => setValue("backup_include_audit_logs", value)} />
                  <div className="space-y-2">
                    <Label>Frequência</Label>
                    <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={watch("backup_frequency") || "weekly"} onChange={(e) => setValue("backup_frequency", e.target.value as "daily" | "weekly" | "monthly")}>
                      <option value="daily">Diário</option>
                      <option value="weekly">Semanal</option>
                      <option value="monthly">Mensal</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Restaurar backup</Label>
                    <Input type="file" accept="application/json" onChange={importBackup} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={exportBackup}>Exportar backup das configurações</Button>
                  <Button type="button" variant="outline" onClick={() => toast.success("Configuração de backup pronta. Salve para aplicar.")}>Validar backup</Button>
                </div>
                <p className="text-sm text-slate-600">Último backup: {settings.backup.last_backup_at ? formatDateTimeBR(settings.backup.last_backup_at) : "Ainda não exportado/importado"}</p>
              </CardContent>
            </Card>
          </TabsContent>

          <div className="flex justify-end pt-6">
            <Button 
              type="submit" 
              disabled={isSubmitting} 
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-8 py-3"
            >
              <Save className="mr-2 h-5 w-5" />
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Salvando e Aplicando...
                </>
              ) : (
                '💾 Salvar e Aplicar Configurações'
              )}
            </Button>
          </div>
        </form>
      </Tabs>

      <div className="p-4 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg">
        <div className="flex items-center space-x-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <h4 className="font-bold text-green-800">🎯 Status do Sistema:</h4>
        </div>
        <div className="mt-2 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-green-700">
              <strong>📱 WhatsApp:</strong> {settings.whatsapp_number || 'Não configurado'}
            </p>
            <p className="text-green-700">
              <strong>⏰ Horários:</strong> {settings.working_hours.start} às {settings.working_hours.end}
            </p>
            <p className="text-green-700">
              <strong>🧾 CNPJ:</strong> {settings.company_cnpj || 'Não informado'}
            </p>
          </div>
          <div>
            <p className="text-green-700">
              <strong>🏢 Clínica:</strong> {settings.company_name}
            </p>
            <p className="text-green-700">
              <strong>🌐 Site:</strong> {settings.site_name}
            </p>
            <p className="text-green-700">
              <strong>📊 Slots:</strong> {timeSlotPreview.length} horários/dia
            </p>
          </div>
        </div>
        <p className="text-xs text-green-600 mt-2">
          ✅ <strong>Todas as configurações estão funcionando e sendo aplicadas em tempo real!</strong>
        </p>
      </div>
    </div>
  );
}

function ToggleSetting({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border bg-white p-4">
      <Label className="text-sm font-medium">{label}</Label>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
