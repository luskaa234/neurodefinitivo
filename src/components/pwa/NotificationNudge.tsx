"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getCurrentSubscription, getPushPermission, isPushSupported, subscribeToPush } from "@/lib/push";
import { loadStoredSettings } from "@/lib/appSettings";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function NotificationNudge() {
  const { user } = useAuth();
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission | "unsupported">("default");
  const [hasSubscription, setHasSubscription] = useState(false);
  const [globalEnabled, setGlobalEnabled] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const apply = () => {
      const settings = loadStoredSettings();
      setGlobalEnabled(!!settings.push_global_enabled);
    };
    apply();
    window.addEventListener("storage", apply);
    window.addEventListener("app-settings-updated", apply);
    return () => {
      window.removeEventListener("storage", apply);
      window.removeEventListener("app-settings-updated", apply);
    };
  }, []);

  useEffect(() => {
    if (!user?.id || typeof window === "undefined") return;
    const key = `push-banner-dismissed:${user.id}`;
    setBannerDismissed(localStorage.getItem(key) === "1");
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const sync = async () => {
      setPushSupported(isPushSupported());
      setPushPermission(getPushPermission() as NotificationPermission);
      const sub = await getCurrentSubscription();
      setHasSubscription(!!sub);
    };
    sync();
  }, [user?.id]);

  const shouldPrompt = useMemo(() => {
    if (!user?.id) return false;
    if (!pushSupported || !globalEnabled) return false;
    if (pushPermission === "denied") return false;
    if (hasSubscription) return false;
    return true;
  }, [user?.id, pushSupported, globalEnabled, pushPermission, hasSubscription]);

  useEffect(() => {
    if (!shouldPrompt || typeof window === "undefined" || !user?.id) return;
    const key = `push-entry-prompted:${user.id}`;
    if (localStorage.getItem(key) === "1") return;
  }, [shouldPrompt, user?.id]);

  const enablePush = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const res = await subscribeToPush(user.id);
      setPushPermission(getPushPermission() as NotificationPermission);
      if (res.ok) {
        const sub = await getCurrentSubscription();
        setHasSubscription(!!sub);
        localStorage.setItem(`push-entry-prompted:${user.id}`, "1");
        toast.success("Notificações ativadas com sucesso.");
        return;
      }
      if (res.reason === "denied") {
        toast.error("Permissão de notificações bloqueada no navegador.");
        return;
      }
      if (res.reason === "missing_vapid_public_key") {
        toast.error("Chave VAPID pública não configurada.");
        return;
      }
      if (res.reason === "timeout") {
        toast.error("Tempo esgotado ao ativar. Feche e abra o app novamente.");
        return;
      }
      if (res.reason === "network") {
        toast.error("Falha de rede ao salvar a inscrição.");
        return;
      }
      if (res.reason === "no_sw") {
        toast.error("Service Worker não registrado. Recarregue o app e tente novamente.");
        return;
      }
      if (res.reason === "no_controller") {
        toast.error("O app precisa ser recarregado para ativar as notificações.");
        return;
      }
      toast.error("Não foi possível ativar as notificações.");
    } finally {
      setIsLoading(false);
    }
  };

  const dismissBanner = () => {
    if (!user?.id) return;
    localStorage.setItem(`push-banner-dismissed:${user.id}`, "1");
    setBannerDismissed(true);
  };

  const showBanner =
    shouldPrompt && !bannerDismissed && pushPermission !== "denied";

  return (
    <>
      {showBanner && (
        <div className="fixed bottom-4 right-4 z-50 w-[92vw] max-w-sm rounded-2xl border bg-white/95 p-4 shadow-xl backdrop-blur sm:w-full">
          <div className="text-sm font-semibold text-gray-900">
            Ativar notificações?
          </div>
          <p className="mt-1 text-xs text-gray-600">
            Receba avisos de novos atendimentos, reagendamentos e cancelamentos.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button size="sm" variant="ghost" onClick={dismissBanner}>
              Agora não
            </Button>
            <Button size="sm" onClick={enablePush} disabled={isLoading}>
              {isLoading ? "Ativando..." : "Ativar notificações"}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
