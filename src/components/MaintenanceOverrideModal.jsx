import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, X, Plus, Minus, CheckCircle, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import { updateRecord } from "../lib/useData";
import { maintenanceStatus, formatTime } from "../lib/helpers";

const MAINTENANCE_SECONDS = 43200; // 12 hours — must match helpers.js

export default function MaintenanceOverrideModal({ member, codes, onClose, onApplied }) {
  const [adjustMode, setAdjustMode] = useState("add"); // 'add' | 'deduct'
  const [hours, setHours] = useState("");
  const [forceMode, setForceMode] = useState(null); // 'green' | 'red' | null
  const [busy, setBusy] = useState(false);

  if (!member) return null;

  const status = maintenanceStatus(member, codes);
  const { isGreen, secondsLeft } = status;

  async function applyOverride() {
    setBusy(true);
    try {
      const updates = {};
      const h = parseFloat(hours) || 0;

      if (forceMode) {
        // Force status — override takes priority, clear timer
        updates.maintenance_override = forceMode;
        updates.maintenance_timer_seconds = null;
        updates.maintenance_timer_set_at = null;
      } else if (h > 0) {
        // Adjust timer — set/extend/shrink the countdown
        let baseSeconds = 0;
        if (member.maintenance_timer_seconds > 0 && member.maintenance_timer_set_at) {
          const elapsed = Math.floor((Date.now() - new Date(member.maintenance_timer_set_at).getTime()) / 1000);
          baseSeconds = Math.max(0, member.maintenance_timer_seconds - elapsed);
        } else if (isGreen) {
          baseSeconds = secondsLeft;
        }
        const delta = h * 3600;
        const newSeconds = adjustMode === "add" ? baseSeconds + delta : Math.max(0, baseSeconds - delta);
        updates.maintenance_override = "auto";
        updates.maintenance_timer_seconds = newSeconds;
        updates.maintenance_timer_set_at = new Date().toISOString();
      } else {
        toast.error("Enter hours to adjust or pick a force status");
        setBusy(false);
        return;
      }

      await updateRecord("members", member.id, updates);
      toast.success("Maintenance override applied!");
      onApplied?.();
      onClose();
    } catch (err) {
      toast.error(err?.message || "Failed to apply override");
    }
    setBusy(false);
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          onClick={e => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-xl">
                <Clock className="w-5 h-5 text-blue-500" />
              </div>
              <h2 className="text-lg font-bold text-gray-800">
                Maintenance Override — {member.username}
              </h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          <div className="px-6 py-5 space-y-6">
            {/* Current Status */}
            <div className={`rounded-xl border p-4 ${isGreen ? "border-green-100 bg-green-50" : "border-red-100 bg-red-50"}`}>
              <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isGreen ? "text-green-600" : "text-red-600"}`}>
                Current Status
              </p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${isGreen ? "bg-green-500" : "bg-red-500"}`} />
                  <span className="text-xl font-bold text-gray-900">
                    {isGreen ? "Active" : "Expired"}
                  </span>
                </div>
                <span className="font-mono text-gray-400 text-sm">
                  {isGreen ? formatTime(secondsLeft) : "00:00:00"}
                </span>
              </div>
            </div>

            {/* Adjust Timer */}
            <div>
              <p className="font-semibold text-gray-900 mb-3">Adjust Timer (hours)</p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <button
                  onClick={() => { setAdjustMode("add"); setForceMode(null); }}
                  className={`h-11 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-1.5 ${
                    adjustMode === "add" && !forceMode
                      ? "bg-[#00a345] text-white shadow-md"
                      : "bg-green-50 text-[#00a345] border border-green-200 hover:bg-green-100"
                  }`}
                >
                  <Plus className="w-4 h-4" /> Add Hours
                </button>
                <button
                  onClick={() => { setAdjustMode("deduct"); setForceMode(null); }}
                  className={`h-11 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-1.5 ${
                    adjustMode === "deduct" && !forceMode
                      ? "bg-[#e11d48] text-white shadow-md"
                      : "bg-transparent text-[#e11d48] border border-red-300 hover:bg-red-50"
                  }`}
                >
                  <Minus className="w-4 h-4" /> Deduct Hours
                </button>
              </div>
              <input
                type="number"
                value={hours}
                onChange={e => setHours(e.target.value)}
                placeholder="e.g. 24"
                className="w-full h-12 rounded-xl border border-gray-200 px-4 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-gray-700"
              />
            </div>

            {/* Force Status */}
            <div>
              <p className="font-semibold text-gray-900 mb-3">Force Status</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { setForceMode("green"); setHours(""); }}
                  className={`h-11 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-1.5 ${
                    forceMode === "green"
                      ? "bg-[#00a345] text-white shadow-md ring-2 ring-green-300"
                      : "bg-[#00a345] text-white hover:bg-green-600"
                  }`}
                >
                  <CheckCircle className="w-4 h-4" /> Set Active
                </button>
                <button
                  onClick={() => { setForceMode("red"); setHours(""); }}
                  className={`h-11 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-1.5 ${
                    forceMode === "red"
                      ? "bg-[#e11d48] text-white shadow-md ring-2 ring-red-300"
                      : "bg-[#e11d48] text-white hover:bg-red-600"
                  }`}
                >
                  <XCircle className="w-4 h-4" /> Set Expired
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 px-6 py-5 border-t border-gray-100 bg-gray-50">
            <button
              onClick={onClose}
              className="flex-[2] h-12 rounded-xl bg-white border border-gray-300 text-gray-900 font-medium hover:bg-gray-100 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={applyOverride}
              disabled={busy}
              className="flex-[3] h-12 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium hover:from-blue-600 hover:to-purple-700 transition-all disabled:opacity-50"
            >
              {busy ? "Applying..." : "Apply Timer"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
