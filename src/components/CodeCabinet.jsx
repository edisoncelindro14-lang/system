import React, { useMemo, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Archive, Copy, KeyRound, ArrowRight, CheckCircle2, Clock, History } from "lucide-react";
import toast from "react-hot-toast";
import { useTable, useCurrentMember } from "../lib/useData";
import { supabase } from "../lib/supabase";
import { redeemCode } from "../lib/redeem";
import { formatDate, formatTime, maintenanceStatus } from "../lib/helpers";
import { Button, Badge } from "./ui";
import AutoRedeemPanel from "./AutoRedeemPanel";
import WeeklyRedeemMonitor from "./WeeklyRedeemMonitor";

const REDEEM_UNLOCK_THRESHOLD = 7200; // redeem enabled when 12h maintenance countdown has ≤2h left

export default function CodeCabinet() {
  const nav = useNavigate();
  const { data: members = [] } = useTable("members");
  const { data: codes = [], refetch: refetchCodes } = useTable("maintenance_codes");
  const { data: redemptionHistory = [], refetch: refetchHistory } = useTable("code_redemption_history");
  const { data: systemSettings = [] } = useTable("system_settings");
  const { currentMember } = useCurrentMember(members);
  const [redeemBusyId, setRedeemBusyId] = useState(null);
  const [now, setNow] = useState(Date.now());

  // Tick every second for countdown timers
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Real-time: refetch when codes change
  useEffect(() => {
    const channel = supabase
      .channel("code_cabinet_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "maintenance_codes" }, (payload) => {
        const row = payload.new;
        if (row && currentMember && row.assigned_username === currentMember.username) {
          toast.success("New code received in your Code Cabinet!");
        }
        refetchCodes();
      })
      .subscribe();
    const interval = setInterval(() => { refetchCodes(); refetchHistory(); }, 5000);
    return () => { supabase.removeChannel(channel); clearInterval(interval); };
  }, [refetchCodes, refetchHistory, currentMember]);

  const myCodes = useMemo(() => {
    if (!currentMember) return [];
    return codes
      .filter(c => c.assigned_username === currentMember.username)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [codes, currentMember]);

  const myHistory = useMemo(() => {
    if (!currentMember) return [];
    return redemptionHistory
      .filter(h => h.redeemed_by_member_id === currentMember.id)
      .sort((a, b) => new Date(b.redeemed_at) - new Date(a.redeemed_at));
  }, [redemptionHistory, currentMember]);

  if (!currentMember) return <div className="p-10 text-center text-gray-400">Loading…</div>;

  const pending = myCodes.filter(c => !c.is_used);
  const redeemed = myCodes.filter(c => c.is_used);

  function copyCode(code) {
    navigator.clipboard.writeText(code);
    toast.success("Code copied! Paste it in the Maintenance Code box on your Dashboard.");
  }

  const maintenance = currentMember ? maintenanceStatus(currentMember, codes) : null;
  // Redeem is locked unless: never redeemed before, maintenance expired, or ≤1h left on the 12h countdown
  const canRedeem = !maintenance || !maintenance.isGreen || maintenance.secondsLeft <= REDEEM_UNLOCK_THRESHOLD;
  const lockSeconds = maintenance && maintenance.isGreen ? maintenance.secondsLeft : 0;

  async function handleRedeem(code) {
    if (!canRedeem) {
      toast.error(`Redeem unlocks in ${formatTime(lockSeconds - REDEEM_UNLOCK_THRESHOLD)} when 2 hours remain.`);
      return;
    }
    setRedeemBusyId(code.id);
    try {
      const result = await redeemCode(code, currentMember, members, codes);
      toast.success(result.message);
      refetchCodes();
      refetchHistory();
    } catch (err) {
      toast.error(err.message || "Failed to redeem code");
    }
    setRedeemBusyId(null);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex items-center gap-3">
        <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl">
          <Archive className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Code Cabinet</h1>
          <p className="text-gray-500">Codes assigned to you by the store. Redemption unlocks when your 12-hour maintenance cycle has 2 hours remaining.</p>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-2xl shadow border border-gray-100 p-5">
          <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl mb-3 flex items-center justify-center">
            <KeyRound className="w-5 h-5 text-white" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{pending.length}</p>
          <p className="text-sm text-gray-500">Available to redeem</p>
        </div>
        <div className="bg-white rounded-2xl shadow border border-gray-100 p-5">
          <div className="w-10 h-10 bg-gradient-to-br from-gray-400 to-gray-500 rounded-xl mb-3 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-white" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{redeemed.length}</p>
          <p className="text-sm text-gray-500">Redeemed</p>
        </div>
      </div>

      {systemSettings.find(s => s.setting_key === "auto_redeem_enabled")?.setting_value !== "false" && (
      <AutoRedeemPanel
        pending={pending}
        member={currentMember}
        members={members}
        codes={codes}
        onDone={() => { refetchCodes(); refetchHistory(); }}
      />
      )}

      <WeeklyRedeemMonitor
        title="My Weekly Redeemed Codes"
        showFilter={false}
        rows={[{ username: currentMember.username, usedAts: codes.filter(c => c.is_used && c.used_by_member_id === currentMember.id && c.used_at).map(c => c.used_at) }]}
      />

      {/* Pending codes */}
      <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden mb-6">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Available Codes</h2>
        </div>
        {pending.length === 0 ? (
          <p className="text-center py-10 text-gray-400">No codes assigned to you yet. When a store sends you a code, it will appear here.</p>
        ) : (
          <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto">
            {pending.map(c => (
              <div key={c.id} className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="font-mono font-bold text-gray-900">{c.code}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Received {formatDate(c.created_at, "MMM d, yyyy h:mm a")}</p>
                  {!canRedeem && (
                    <p className="text-xs font-semibold text-orange-600 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Unlocks in {formatTime(lockSeconds - REDEEM_UNLOCK_THRESHOLD)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => copyCode(c.code)}>
                    <Copy className="w-3.5 h-3.5" /> Copy
                  </Button>
                  <Button
                    size="sm"
                    disabled={!canRedeem || redeemBusyId === c.id}
                    className={!canRedeem
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : "!bg-blue-600 hover:!bg-blue-700 !text-white"}
                    onClick={() => handleRedeem(c)}
                  >
                    {redeemBusyId === c.id ? "Redeeming..." : "Redeem"} {canRedeem && <ArrowRight className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transaction history */}
      {myHistory.length > 0 && (
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden mb-6">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><History className="w-5 h-5 text-violet-500" /> Redemption History</h2>
          </div>
          <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto">
            {myHistory.map(h => (
              <div key={h.id} className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="font-mono font-bold text-gray-700">{h.code}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Redeemed {formatDate(h.redeemed_at, "MMM d, yyyy h:mm a")}</p>
                </div>
                <Badge className="bg-green-100 text-green-700">Completed</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Redeemed codes */}
      {redeemed.length > 0 && (
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-500">Redeemed Codes</h2>
          </div>
          <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto">
            {redeemed.map(c => (
              <div key={c.id} className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="font-mono font-bold text-gray-400">{c.code}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Redeemed {c.used_at ? formatDate(c.used_at, "MMM d, yyyy h:mm a") : "—"}</p>
                </div>
                <Badge className="bg-gray-100 text-gray-500">Redeemed</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
