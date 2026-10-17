import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, X, Send } from "lucide-react";
import toast from "react-hot-toast";
import { supabase } from "../lib/supabase";

// One-way admin -> member message. The sender is always branded
// "Zistem Client Service" on the member's end; the member cannot reply.
const SENDER_NAME = "Zistem Client Service";

export default function SendNotificationModal({ member, onClose, onSent }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  if (!member) return null;

  async function send() {
    const body = message.trim();
    if (!body) { toast.error("Enter a message"); return; }
    setBusy(true);
    try {
      const { error } = await supabase.from("notifications").insert({
        member_id: member.id,
        sender_name: SENDER_NAME,
        message: body,
      });
      if (error) throw error;
      toast.success("Notification sent to " + (member.full_name || member.username));
      onSent?.();
      onClose();
    } catch (err) {
      toast.error(err?.message || "Failed to send notification");
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
              <div className="p-2 bg-indigo-50 rounded-xl">
                <Mail className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-800">Send Notification</h2>
                <p className="text-xs text-gray-500">To {member.full_name || member.username} · @{member.username}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          <div className="px-6 py-5 space-y-4">
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-xs text-indigo-700">
              One-way message — the member cannot reply. It appears in their inbox from <span className="font-bold">Zistem Client Service</span>.
            </div>
            <div>
              <label className="font-semibold text-gray-900 block mb-1.5">Message</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={5}
                placeholder="Type your message to this member..."
                className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-gray-700 resize-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 px-6 py-5 border-t border-gray-100 bg-gray-50">
            <button
              onClick={onClose}
              className="flex-1 h-12 rounded-xl bg-white border border-gray-300 text-gray-900 font-medium hover:bg-gray-100 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={send}
              disabled={busy}
              className="flex-[2] h-12 rounded-xl font-medium text-white transition-all disabled:opacity-50 bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center gap-2"
            >
              {busy ? "Sending..." : (<><Send className="w-4 h-4" /> Send Notification</>)}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
