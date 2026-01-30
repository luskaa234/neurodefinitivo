"use client";

import { useEffect } from "react";
import { applySettingsToDocument, loadStoredSettings } from "@/lib/appSettings";

export default function SettingsApplier() {
  useEffect(() => {
    const settings = loadStoredSettings();
    applySettingsToDocument(settings);
  }, []);

  return null;
}
