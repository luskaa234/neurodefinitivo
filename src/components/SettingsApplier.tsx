"use client";

import { useEffect } from "react";
import { applySettingsToDocument, loadStoredSettings } from "@/lib/appSettings";

export default function SettingsApplier() {
  useEffect(() => {
    const apply = () => {
      const settings = loadStoredSettings();
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
