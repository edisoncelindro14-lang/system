import React, { useState, useEffect } from "react";
import { CheckCircle, AlertCircle } from "lucide-react";
import { useTable } from "../lib/useData";
import { getSessionMemberId } from "../lib/auth";
import { maintenanceStatus, formatTime, formatGraceTime } from "../lib/helpers";

export function MaintenanceBanner() {
  const [, setTick] = useState(0);
  const memberId = getSessionMemberId();
  const { data: members = [] } = useTable("members", { enabled: !!memberId });
  const { data: codes = [] } = useTable("maintenance_codes", { enabled: !!memberId });

  useEffect(() => {
    if (!memberId) return;
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [memberId]);

  const member = memberId ? members.find(m => m.id === memberId) : null;
  if (!member) return null;

  const status = maintenanceStatus(member, codes);
  const { isGreen, secondsLeft, neverRedeemed } = status;

  return (
    <div className={`w-full py-3 sm:py-2.5 px-4 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 font-semibold text-white ${isGreen ? "bg-blue-500" : "bg-black"}`}>
      {/* Status text */}
      <div className="flex items-center gap-2 sm:gap-3 text-center">
        <span className="inline-block w-3 h-3 rounded-full bg-white animate-pulse flex-shrink-0" />
        {isGreen ? (
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
        ) : (
          <AlertCircle className="w-5 h-5 flex-shrink-0 animate-pulse" />
        )}
        <span className="text-sm font-bold">
          {isGreen ? "Maintenance Active — Expires in:" : "⚠ Maintenance Inactive — Redeem a code to activate & start earning!"}
        </span>
      </div>
      {/* Timer */}
      <div className="flex items-center gap-2 sm:gap-3">
        {!isGreen && secondsLeft > 0 && (
          <span className="text-gray-400 text-sm">Expires in:</span>
        )}
        <span className={`font-mono px-3 py-1 rounded-lg text-white tracking-widest text-lg font-bold ${isGreen ? "bg-blue-700" : "bg-gray-800"}`}>
          {isGreen || secondsLeft > 0 ? formatTime(secondsLeft) : "EXPIRED"}
        </span>
        {(isGreen || secondsLeft > 0) && (
          <span className={`font-normal text-xs ${isGreen ? "text-blue-100" : "text-gray-400"}`}>
            {isGreen ? "12 Hours" : "120 Hours"}
          </span>
        )}
      </div>
    </div>
  );
}
