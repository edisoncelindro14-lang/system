import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wallet, X, Plus, Minus } from "lucide-react";
import toast from "react-hot-toast";
import { supabase } from "../lib/supabase";
import { money } from "../lib/helpers";

export default function EditBalanceModal({ member, currentBalance, onClose, onApplied }) {
  const [mode, setMode] = useState("add"); // 'add' | 'deduct'
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  if (!member) return null;

  async function applyBalance() {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) { toast.error("Enter a valid amount"); return; }
    setBusy(true);
    try {
      const signed = mode === "add" ? val : -val;
      const { error } = await supabase.from("transactions").insert({
        member_id: member.id,
        type: "adjustment",
        amount: signed,
        status: "completed",
        description: reason.trim() || (mode === "add" ? "Manual balance addition" : "Manual balance deduction"),
      });
      if (error) throw error;
      toast.success(mode === "add" ? "Balance added!" : "Balance deducted!");
      onApplied?.();
      onClose();
    } catch (err) {
      toast.error(err?.message || "Failed to update balance");
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
              <div className="p-2 bg-green-50 rounded-xl">
                <Wallet className="w-5 h-5 text-green-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-800">
                Edit Balance — {member.username}
              </h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          <div className="px-6 py-5 space-y-6">
            {/* Current Balance */}
            <div className="rounded-xl border border-green-100 bg-green-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-green-600 mb-2">
                Current Balance
              </p>
              <p className="text-2xl font-bold text-gray-900">{money(currentBalance)}</p>
            </div>

            {/* Action Toggles */}
            <div>
              <p className="font-semibold text-gray-900 mb-3">Action</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setMode("add")}
                  className={`h-11 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-1.5 ${
                    mode === "add"
                      ? "bg-[#00a345] text-white shadow-md"
                      : "bg-green-50 text-[#00a345] border border-green-200 hover:bg-green-100"
                  }`}
                >
                  <Plus className="w-4 h-4" /> Add Balance
                </button>
                <button
                  onClick={() => setMode("deduct")}
                  className={`h-11 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-1.5 ${
                    mode === "deduct"
                      ? "bg-[#e11d48] text-white shadow-md"
                      : "bg-transparent text-[#e11d48] border border-red-300 hover:bg-red-50"
                  }`}
                >
                  <Minus className="w-4 h-4" /> Deduct Balance
                </button>
              </div>
            </div>

            {/* Amount Input */}
            <div>
              <label className="font-semibold text-gray-900 block mb-1.5">Amount (₱)</label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full h-12 rounded-xl border border-gray-200 px-4 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all text-gray-700"
              />
            </div>

            {/* Reason Input */}
            <div>
              <label className="font-semibold text-gray-900 block mb-1.5">Reason (optional)</label>
              <input
                type="text"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g. Manual correction"
                className="w-full h-12 rounded-xl border border-gray-200 px-4 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all text-gray-700"
              />
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
              onClick={applyBalance}
              disabled={busy}
              className={`flex-[3] h-12 rounded-xl font-medium text-white transition-all disabled:opacity-50 ${
                mode === "add"
                  ? "bg-[#00a345] hover:bg-green-600"
                  : "bg-[#e11d48] hover:bg-red-600"
              }`}
            >
              {busy ? "Processing..." : mode === "add" ? "Add Balance" : "Deduct Balance"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
