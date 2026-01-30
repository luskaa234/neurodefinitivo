"use client";

import { useEffect } from "react";
import {
  applySettingsToDocument,
  loadStoredSettings,
  saveSettings,
  DEFAULT_SETTINGS,
} from "@/lib/appSettings";

export default function SettingsApplier() {
  useEffect(() => {
    const apply = () => {
      const settings = loadStoredSettings();
      const paletteKey = "palette-fixed-2026-01";
      const needsLogo =
        settings.logo_site_url !== DEFAULT_SETTINGS.logo_site_url ||
        settings.logo_pwa_url !== DEFAULT_SETTINGS.logo_pwa_url;
      const needsName =
        settings.site_name !== DEFAULT_SETTINGS.site_name ||
        settings.site_short_name !== DEFAULT_SETTINGS.site_short_name;
      if (
        typeof window !== "undefined" &&
        (localStorage.getItem(paletteKey) !== "1" || needsLogo || needsName)
      ) {
        const next = {
          ...settings,
          brand_primary: DEFAULT_SETTINGS.brand_primary,
          brand_secondary: DEFAULT_SETTINGS.brand_secondary,
          brand_accent: DEFAULT_SETTINGS.brand_accent,
          brand_sidebar: DEFAULT_SETTINGS.brand_sidebar,
          brand_background: DEFAULT_SETTINGS.brand_background,
          logo_site_url: DEFAULT_SETTINGS.logo_site_url,
          logo_pwa_url: DEFAULT_SETTINGS.logo_pwa_url,
          site_name: DEFAULT_SETTINGS.site_name,
          site_short_name: DEFAULT_SETTINGS.site_short_name,
        };
        saveSettings(next);
        localStorage.setItem(paletteKey, "1");
        applySettingsToDocument(next);
        return;
      }
      applySettingsToDocument(settings);
    };
    apply();
    window.addEventListener("app-settings-updated", apply);
    window.addEventListener("storage", apply);
    return () => {
      window.removeEventListener("app-settings-updated", apply);
      window.removeEventListener("storage", apply);
    };
  }, []);

  return null;
}
