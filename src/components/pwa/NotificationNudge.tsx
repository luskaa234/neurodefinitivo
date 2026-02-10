"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getCurrentSubscription, getPushPermission, isPushSupported, subscribeToPush } from "@/lib/push";
import { loadStoredSettings } from "@/lib/appSettings";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export default function NotificationNudge() {
  const { user } = useAuth();
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission | "unsupported">("default");
  const [hasSubscription, setHasSubscription] = useState(false);
  const [globalEnabled, setGlobalEnabled] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
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
    setPromptOpen(true);
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
        setPromptOpen(false);
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
        if (user?.id) {
          const key = `push-auto-reload:${user.id}`;
          if (localStorage.getItem(key) !== "1") {
            localStorage.setItem(key, "1");
            toast.message("Atualizando o app para ativar as notificações...");
            window.location.reload();
            return;
          }
        }
        toast.error("Tempo esgotado ao ativar. Recarregue o app e tente novamente.");
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
        if (user?.id) {
          const key = `push-auto-reload:${user.id}`;
          if (localStorage.getItem(key) !== "1") {
            localStorage.setItem(key, "1");
            toast.message("Atualizando o app para ativar as notificações...");
            window.location.reload();
            return;
          }
        }
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
      {showBanner && <div className="h-12" aria-hidden />}
      {showBanner && (
        <div className="fixed inset-x-0 top-0 z-50 border-b bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-2 text-xs sm:flex-row sm:items-center sm:justify-between sm:text-sm">
            <span className="font-medium text-gray-900">
              Ative as notificações para receber avisos de novos atendimentos,
              reagendamentos e cancelamentos.
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={enablePush} disabled={isLoading}>
                {isLoading ? "Ativando..." : "Ativar"}
              </Button>
              <Button size="sm" variant="ghost" onClick={dismissBanner}>
                Agora não
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={promptOpen} onOpenChange={setPromptOpen}>
        <DialogContent className="w-[92vw] max-w-md sm:w-full">
          <DialogHeader>
            <DialogTitle>Ativar notificações?</DialogTitle>
            <DialogDescription>
              Receba avisos de novos atendimentos, reagendamentos e cancelamentos.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => {
                if (user?.id) {
                  localStorage.setItem(`push-entry-prompted:${user.id}`, "1");
                }
                setPromptOpen(false);
              }}
            >
              Agora não
            </Button>
            <Button onClick={enablePush} disabled={isLoading}>
              {isLoading ? "Ativando..." : "Ativar notificações"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
