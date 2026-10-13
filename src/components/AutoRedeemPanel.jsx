import React, { useEffect, useState } from "react";
import { Zap, Clock } from "lucide-react";
import { useTable } from "../lib/useData";


// Auto-redeem runs on the server (database job, see supabase/migrations/010_auto_redeem_server.sql):
// once a day at the admin-set time, whether or not the app is open. This panel only shows its schedule;
// the code lists refresh automatically, so redemptions appear in real time.
const DEFAULT_TZ = "Asia/Manila";

// Seconds until the next run of "HH:MM" in the server timezone
function secondsUntilNext(hhmm, tz, lastRun) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: tz, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .formatToParts(new Date()).map(p => [p.type, p.value]));
  const nowSec = (+parts.hour) * 3600 + (+parts.minute) * 60 + (+parts.second);
  const [h, m] = hhmm.split(":").map(Number);
  const target = h * 3600 + m * 60;
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  const ranToday = lastRun === today;
  return target > nowSec && !ranToday ? target - nowSec : target + 86400 - nowSec;
}

export default function AutoRedeemPanel({ pending }) {
  const { data: settings = [] } = useTable("system_settings");
  const get = k => settings.find(x => x.setting_key === k)?.setting_value || "";
  const adminTime = get("auto_redeem_start_time");
  const tz = get("auto_redeem_timezone") || DEFAULT_TZ;
  const lastRun = get("auto_redeem_last_run");
  const [, setNow] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setNow(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const [hh, mm] = (adminTime || "0:0").split(":").map(Number);
  const label = `${hh % 12 || 12}:${String(mm).padStart(2, "0")} ${hh >= 12 ? "PM" : "AM"}`;

  const secondsToNext = adminTime ? secondsUntilNext(adminTime, tz, lastRun) : 0;
  const tzName = tz === "Asia/Manila" ? "Philippine Standard Time" : tz;
  const nowLabel = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true }).format(new Date());
  const day = secondsToNext <= 86400 && new Date(Date.now() + secondsToNext * 1000).toLocaleDateString("en-CA", { timeZone: tz }) === new Date().toLocaleDateString("en-CA", { timeZone: tz }) ? "Today" : "Tomorrow";

  return (
    <div className="bg-white rounded-2xl shadow border border-gray-100 p-5 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <Zap className="w-5 h-5 text-amber-500" />
        <h2 className="text-lg font-bold text-gray-900">Auto-Redeem</h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Redeems one available code for you automatically once a day at the start time set by the admin. It runs on the server, so you don't need to keep the app open.
      </p>
      {adminTime && <p className="text-xs text-gray-500 mb-1">Current time: <span className="font-semibold">{nowLabel}</span> ({tzName})</p>}
      {adminTime ? (
        <p className="text-sm font-semibold text-emerald-700 flex items-center gap-1">
          <Clock className="w-4 h-4" />
          Next code {day} at {label} ({tzName}) · {pending.length} code{pending.length === 1 ? "" : "s"} queued
        </p>
      ) : (
        <p className="text-xs text-gray-400">Waiting for the admin to set the auto-redeem start time.</p>
      )}
    </div>
  );
}
