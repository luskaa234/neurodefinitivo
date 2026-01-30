export interface AppSettings {
  company_name: string;
  company_cnpj: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  whatsapp_number: string;
  site_name: string;
  site_short_name?: string;
  site_description?: string;
  site_url?: string;
  logo_site_url?: string;
  logo_pwa_url?: string;
  brand_primary: string;
  brand_secondary: string;
  brand_accent: string;
  brand_background: string;
  brand_sidebar: string;
  working_hours: {
    start: string;
    end: string;
  };
}

export const DEFAULT_SETTINGS: AppSettings = {
  company_name: "Neuro Integrar",
  company_cnpj: "",
  company_address: "",
  company_phone: "",
  company_email: "",
  whatsapp_number: "98974003414",
  site_name: "Neuro Integrar - Sistema de Gestão",
  site_short_name: "Neuro",
  site_description: "Sistema completo para gestão de clínicas neurológicas",
  site_url: "",
  logo_site_url: "/logo.png",
  logo_pwa_url: "/logo.png",
  brand_primary: "#891b98",
  brand_secondary: "#ecdff1",
  brand_accent: "#ede9fe",
  brand_background: "#ffffff",
  brand_sidebar: "#f8f5ff",
  working_hours: {
    start: "08:00",
    end: "21:00",
  },
};

const isHexColor = (value: string) => /^#([0-9a-fA-F]{6})$/.test(value);

const normalizeColor = (value: string, fallback: string) =>
  isHexColor(value) ? value : fallback;

const mergeSettings = (raw: Partial<AppSettings>): AppSettings => {
  const legacyLogo = (raw as { logo_url?: string }).logo_url || "";

  return {
    ...DEFAULT_SETTINGS,
    ...raw,
    logo_site_url: raw.logo_site_url || legacyLogo || DEFAULT_SETTINGS.logo_site_url,
    logo_pwa_url: raw.logo_pwa_url || legacyLogo || DEFAULT_SETTINGS.logo_pwa_url,
    brand_primary: normalizeColor(raw.brand_primary || "", DEFAULT_SETTINGS.brand_primary),
    brand_secondary: normalizeColor(raw.brand_secondary || "", DEFAULT_SETTINGS.brand_secondary),
    brand_accent: normalizeColor(raw.brand_accent || "", DEFAULT_SETTINGS.brand_accent),
    brand_background: normalizeColor(raw.brand_background || "", DEFAULT_SETTINGS.brand_background),
    brand_sidebar: normalizeColor(raw.brand_sidebar || "", DEFAULT_SETTINGS.brand_sidebar),
    working_hours: {
      start: raw.working_hours?.start || DEFAULT_SETTINGS.working_hours.start,
      end: raw.working_hours?.end || DEFAULT_SETTINGS.working_hours.end,
    },
  };
};

export const loadStoredSettings = (): AppSettings => {
  if (typeof window === "undefined") {
    return DEFAULT_SETTINGS;
  }

  try {
    const saved = localStorage.getItem("app-settings");
    if (!saved) {
      return DEFAULT_SETTINGS;
    }
    const parsed = JSON.parse(saved) as Partial<AppSettings>;
    return mergeSettings(parsed);
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export const saveSettings = (settings: AppSettings) => {
  if (typeof window === "undefined") return;
  localStorage.setItem("app-settings", JSON.stringify(settings));
};

const hexToHsl = (hex: string) => {
  const cleaned = hex.replace("#", "");
  const r = parseInt(cleaned.slice(0, 2), 16) / 255;
  const g = parseInt(cleaned.slice(2, 4), 16) / 255;
  const b = parseInt(cleaned.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    if (max === g) h = (b - r) / delta + 2;
    if (max === b) h = (r - g) / delta + 4;
  }
  h = Math.round(h * 60);
  if (h < 0) h += 360;

  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  return {
    h,
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
};

const hslToCss = ({ h, s, l }: { h: number; s: number; l: number }) =>
  `${h} ${s}% ${l}%`;

const foregroundFor = (hex: string) => {
  const { l } = hexToHsl(hex);
  return l < 55 ? "0 0% 98%" : "0 0% 9%";
};

const setCssVar = (name: string, value: string) => {
  document.documentElement.style.setProperty(name, value);
};

const ensureMeta = (selector: string, attrs: Record<string, string>) => {
  let element = document.querySelector(selector) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement("meta");
    Object.entries(attrs).forEach(([key, value]) => element!.setAttribute(key, value));
    document.head.appendChild(element);
  }
  return element;
};

const ensureLink = (selector: string, attrs: Record<string, string>) => {
  let element = document.querySelector(selector) as HTMLLinkElement | null;
  if (!element) {
    element = document.createElement("link");
    Object.entries(attrs).forEach(([key, value]) => element!.setAttribute(key, value));
    document.head.appendChild(element);
  }
  return element;
};

let manifestBlobUrl: string | null = null;

export const applySettingsToDocument = (settings: AppSettings) => {
  if (typeof document === "undefined") return;

  const primaryHsl = hslToCss(hexToHsl(settings.brand_primary));
  const secondaryHsl = hslToCss(hexToHsl(settings.brand_secondary));
  const accentHsl = hslToCss(hexToHsl(settings.brand_accent));
  const backgroundHsl = hslToCss(hexToHsl(settings.brand_background));
  const sidebarHsl = hslToCss(hexToHsl(settings.brand_sidebar));

  setCssVar("--primary", primaryHsl);
  setCssVar("--primary-foreground", foregroundFor(settings.brand_primary));
  setCssVar("--secondary", secondaryHsl);
  setCssVar("--secondary-foreground", foregroundFor(settings.brand_secondary));
  setCssVar("--accent", accentHsl);
  setCssVar("--accent-foreground", foregroundFor(settings.brand_accent));
  setCssVar("--background", backgroundHsl);
  setCssVar("--foreground", foregroundFor(settings.brand_background));
  setCssVar("--card", backgroundHsl);
  setCssVar("--card-foreground", foregroundFor(settings.brand_background));
  setCssVar("--popover", backgroundHsl);
  setCssVar("--popover-foreground", foregroundFor(settings.brand_background));
  setCssVar("--border", secondaryHsl);
  setCssVar("--input", secondaryHsl);
  setCssVar("--ring", primaryHsl);
  setCssVar("--muted", secondaryHsl);
  setCssVar("--muted-foreground", "0 0% 45%");
  setCssVar("--sidebar-background", sidebarHsl);
  setCssVar("--sidebar-foreground", foregroundFor(settings.brand_sidebar));
  setCssVar("--sidebar-primary", primaryHsl);
  setCssVar("--sidebar-primary-foreground", foregroundFor(settings.brand_primary));
  setCssVar("--sidebar-accent", secondaryHsl);
  setCssVar("--sidebar-accent-foreground", foregroundFor(settings.brand_secondary));
  setCssVar("--sidebar-border", secondaryHsl);
  setCssVar("--sidebar-ring", primaryHsl);

  if (settings.site_name) {
    document.title = settings.site_name;
  }

  if (settings.site_description) {
    const descriptionMeta = ensureMeta('meta[name="description"]', { name: "description" });
    descriptionMeta.setAttribute("content", settings.site_description);
  }

  const themeMeta = ensureMeta('meta[name="theme-color"]', { name: "theme-color" });
  themeMeta.setAttribute("content", settings.brand_primary);

  const faviconUrl = settings.logo_site_url || settings.logo_pwa_url;
  if (faviconUrl) {
    const iconLink = ensureLink('link[rel="icon"]', { rel: "icon" });
    iconLink.setAttribute("href", faviconUrl);
    const appleLink = ensureLink('link[rel="apple-touch-icon"]', { rel: "apple-touch-icon" });
    appleLink.setAttribute("href", faviconUrl);
  }

  const manifestLink = ensureLink('link[rel="manifest"]', { rel: "manifest" });
  if (manifestBlobUrl) {
    URL.revokeObjectURL(manifestBlobUrl);
  }

  const pwaTypeMatch = settings.logo_pwa_url?.match(/^data:(.*?);/);
  const pwaType = pwaTypeMatch ? pwaTypeMatch[1] : "image/png";

  const manifestData = {
    name: settings.site_name || settings.company_name,
    short_name: settings.site_short_name || settings.company_name,
    description: settings.site_description || "",
    start_url: "./",
    scope: "./",
    id: "./",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: settings.brand_background,
    theme_color: settings.brand_primary,
    icons: settings.logo_pwa_url
      ? [
          {
            src: settings.logo_pwa_url,
            sizes: "192x192",
            type: pwaType,
            purpose: "maskable any",
          },
          {
            src: settings.logo_pwa_url,
            sizes: "512x512",
            type: pwaType,
            purpose: "maskable any",
          },
        ]
      : [],
    lang: "pt-BR",
    dir: "ltr",
  };

  const manifestBlob = new Blob([JSON.stringify(manifestData)], {
    type: "application/manifest+json",
  });
  manifestBlobUrl = URL.createObjectURL(manifestBlob);
  manifestLink.setAttribute("href", manifestBlobUrl);
};
