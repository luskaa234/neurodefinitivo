const urlBase64ToUint8Array = (base64String: string) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

export const isPushSupported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

export const getPushPermission = () =>
  typeof window !== "undefined" && "Notification" in window
    ? Notification.permission
    : "unsupported";

const withTimeout = async <T>(promise: Promise<T>, ms: number) => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("timeout")), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const waitForActiveSW = async (registration: ServiceWorkerRegistration, ms = 12000) => {
  if (registration.active) return registration;
  const installing = registration.installing || registration.waiting;
  if (!installing) {
    return await withTimeout(navigator.serviceWorker.ready, ms);
  }
  return await withTimeout(
    new Promise<ServiceWorkerRegistration>((resolve, reject) => {
      const onState = () => {
        if (installing.state === "activated") {
          installing.removeEventListener("statechange", onState);
          resolve(registration);
        }
      };
      installing.addEventListener("statechange", onState);
      setTimeout(() => {
        installing.removeEventListener("statechange", onState);
        reject(new Error("timeout"));
      }, ms);
    }),
    ms
  );
};

const waitForController = async (ms = 4000) => {
  if (navigator.serviceWorker.controller) return true;
  return await withTimeout(
    new Promise<boolean>((resolve) => {
      const onChange = () => {
        navigator.serviceWorker.removeEventListener("controllerchange", onChange);
        resolve(true);
      };
      navigator.serviceWorker.addEventListener("controllerchange", onChange);
      setTimeout(() => {
        navigator.serviceWorker.removeEventListener("controllerchange", onChange);
        resolve(!!navigator.serviceWorker.controller);
      }, ms);
    }),
    ms
  );
};

const reRegisterServiceWorker = async () => {
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((r) => r.unregister()));
  return await registerServiceWorker();
};

export const registerServiceWorker = async () => {
  if (!isPushSupported()) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration("/");
    const registration = existing || (await navigator.serviceWorker.register("/sw.js"));
    try {
      return await waitForActiveSW(registration, 12000);
    } catch {
      return registration;
    }
  } catch {
    return null;
  }
};

export const subscribeToPush = async (userId?: string) => {
  if (!isPushSupported()) return { ok: false, reason: "unsupported" };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, reason: permission };
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    return { ok: false, reason: "missing_vapid_public_key" };
  }

  let registration = await registerServiceWorker();
  if (!registration) return { ok: false, reason: "no_sw" };
  try {
    await waitForController(4000);
  } catch {
    // ignore
  }

  let subscription: PushSubscription | null = null;
  const trySubscribe = async (reg: ServiceWorkerRegistration, timeoutMs: number) => {
    const existing = await withTimeout(reg.pushManager.getSubscription(), 8000);
    return (
      existing ||
      (await withTimeout(
        reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        }),
        timeoutMs
      ))
    );
  };

  try {
    subscription = await trySubscribe(registration, 15000);
  } catch {
    try {
      registration = await reRegisterServiceWorker();
      if (!registration) return { ok: false, reason: "no_sw" };
      await waitForController(4000);
      subscription = await trySubscribe(registration, 20000);
    } catch {
      return { ok: false, reason: "timeout" };
    }
  }

  try {
    await withTimeout(
      fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription,
          userId,
          platform: navigator.platform,
          userAgent: navigator.userAgent,
        }),
      }),
      12000
    );
  } catch {
    return { ok: false, reason: "network" };
  }

  return { ok: true };
};

export const unsubscribeFromPush = async () => {
  if (!isPushSupported()) return { ok: false, reason: "unsupported" };
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return { ok: true };

  try {
    await fetch("/api/push/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
  } catch {
    // ignore
  }

  await subscription.unsubscribe();
  return { ok: true };
};

export const getCurrentSubscription = async () => {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
};

export const sendPushNotification = async (payload: {
  type: string;
  appointment?: {
    id?: string;
    patient_id?: string;
    doctor_id?: string;
    date?: string;
    time?: string;
  };
}) => {
  if (typeof window === "undefined") return;
  try {
    await fetch("/api/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // ignore
  }
};
