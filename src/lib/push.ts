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

export const registerServiceWorker = async () => {
  if (!isPushSupported()) return null;
  if (navigator.serviceWorker.controller) {
    return navigator.serviceWorker.ready;
  }
  try {
    await navigator.serviceWorker.register("/sw.js");
  } catch {
    // ignore
  }
  return navigator.serviceWorker.ready;
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

  const registration = await registerServiceWorker();
  if (!registration) return { ok: false, reason: "no_sw" };

  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    }));

  try {
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscription,
        userId,
        platform: navigator.platform,
        userAgent: navigator.userAgent,
      }),
    });
  } catch {
    // ignore
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
