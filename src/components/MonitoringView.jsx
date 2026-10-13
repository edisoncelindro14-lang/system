import React from "react";
import { motion } from "framer-motion";
import { Eye, CheckCircle, AlertCircle, Ticket } from "lucide-react";
import { maintenanceStatus, formatDate, formatTime } from "../lib/helpers";
import { Badge } from "./ui";

/**
 * Shared 1st-Level Downline Monitoring view.
 * Matches the dark-card + white-slots design from the screenshot.
 *
 * @param {object} member - The member whose downlines are being monitored
 * @param {array}  members - All members
 * @param {array}  codes   - All maintenance codes
 */
export default function MonitoringView({ member, members, codes }) {
  if (!member) return null;

  const downlines = members.filter(m => m.referrer_id === member.id && m.status === "approved");
  const slotsFilled = downlines.length;
  const maxSlots = 8;

  // Cycle logic: each member's first cycle starts when they're approved.
  // A cycle is "complete" when all 8 slots are filled AND all have redeemed.
  // For simplicity, current cycle = completed cycles + 1.
  const redeemedThisCycle = downlines.filter(d => maintenanceStatus(d, codes).isGreen).length;
  const completedCycles = 0; // no cycle-completion tracking yet
  const currentCycle = completedCycles + 1;
  const cycleProgress = maxSlots > 0 ? Math.round((redeemedThisCycle / maxSlots) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Dark monitoring card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#1E293B] rounded-3xl shadow-xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
              <Eye className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">1st-Level Downline Monitoring</h2>
              <p className="text-sm text-gray-400">
                Tracking maintenance-code redemptions for {member.full_name || member.username}'s direct downlines
              </p>
            </div>
          </div>
        </div>

        {/* Stat blocks */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-6">
          {[
            { label: "Current Cycle", value: `#${currentCycle}`, color: "text-white" },
            { label: "Redeemed This Cycle", value: `${redeemedThisCycle}/${maxSlots}`, color: "text-[#10B981]" },
            { label: "Completed Cycles", value: `${completedCycles}`, color: "text-white" },
            { label: "Slots Filled", value: `${slotsFilled}/${maxSlots}`, color: "text-white" },
          ].map((stat, i) => (
            <div key={i} className="bg-[#334155] rounded-2xl p-4">
              <p className="text-xs text-gray-400 mb-1">{stat.label}</p>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="px-6 pb-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Cycle {currentCycle} progress</span>
            <span className="text-sm font-bold text-white">{cycleProgress}%</span>
          </div>
          <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#10B981] to-emerald-400 rounded-full transition-all duration-500"
              style={{ width: `${cycleProgress}%` }}
            />
          </div>
        </div>

        {/* Footer text */}
        <div className="px-6 pb-6 pt-2">
          {downlines.length === 0 ? (
            <p className="text-sm text-gray-400">
              No 1st-level downlines yet. Once your downlines redeem codes, progress will show here.
            </p>
          ) : (
            <p className="text-sm text-gray-400">
              {redeemedThisCycle} of {maxSlots} downlines have redeemed their maintenance code this cycle.
            </p>
          )}
        </div>
      </motion.div>

      {/* White slots card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden"
      >
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">Downline Slots (1–8)</h3>
        </div>

        {downlines.length === 0 ? (
          <div className="p-12 text-center">
            <Eye className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium mb-1">No 1st-level downlines placed yet.</p>
            <p className="text-sm text-gray-400">
              Redemption monitoring will begin once your direct downlines are approved.
            </p>
          </div>
        ) : (
          <div className="p-4">
            {downlines.map((d, i) => {
              const status = maintenanceStatus(d, codes);
              const memberCodes = codes
                .filter(c => c.is_used && c.used_by_member_id === d.id)
                .sort((a, b) => new Date(b.used_at) - new Date(a.used_at));

              return (
                <div
                  key={d.id}
                  className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0 px-2 hover:bg-gray-50 rounded-xl transition-colors"
                >
                  {/* Slot number */}
                  <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {i + 1}
                  </div>
                  {/* User info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 truncate">{d.full_name || d.username}</p>
                    <p className="text-sm text-gray-400 truncate">@{d.username}</p>
                  </div>
                  {/* Status */}
                  <div className="flex-shrink-0">
                    {status.isGreen ? (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 rounded-lg">
                        <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                        <span className="text-sm font-medium text-green-700">{formatTime(status.secondsLeft)}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 rounded-lg">
                        <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                        <span className="text-sm font-medium text-red-700">{status.secondsLeft > 0 ? formatTime(status.secondsLeft) : "Expired"}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Empty slots */}
            {Array.from({ length: maxSlots - downlines.length }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0 px-2"
              >
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-400 text-sm font-bold flex-shrink-0">
                  {downlines.length + i + 1}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-300">Slot {downlines.length + i + 1} — Available</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
