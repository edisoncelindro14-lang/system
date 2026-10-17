import React, { useEffect } from "react";
import { Megaphone } from "lucide-react";
import { useTable } from "../lib/useData";

/**
 * Site-wide announcement banner shown below the maintenance timer.
 * Reads `announcement_text` and `announcement_enabled` from system_settings.
 * Polls every 5 seconds and listens for a custom event so the banner
 * appears immediately after the admin saves it — no Supabase realtime needed.
 */
export default function AnnouncementBanner() {
  const { data: settings = [], refetch } = useTable("system_settings");

  useEffect(() => {
    const interval = setInterval(() => refetch(), 5000);
    const onSettingsChanged = () => refetch();
    window.addEventListener("system_settings_changed", onSettingsChanged);
    return () => { clearInterval(interval); window.removeEventListener("system_settings_changed", onSettingsChanged); };
  }, [refetch]);

  const map = {};
  settings.forEach(s => { map[s.setting_key] = s.setting_value; });

  const enabled = map.announcement_enabled === "true";
  const text = map.announcement_text;

  if (!enabled || !text) return null;

  return (
    <div className="mb-6 rounded-2xl shadow-md bg-[#1D5E63] text-white px-4 py-3 text-sm font-medium flex items-center justify-center gap-2">
      <span className="whitespace-pre-wrap">{text}</span>
    </div>
  );
}
