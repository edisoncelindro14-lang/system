import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, X, Bell, Check } from "lucide-react";
import { supabase } from "../lib/supabase";
import { formatDate } from "../lib/helpers";

// Member-side inbox of one-way admin notifications. The member can read
// and dismiss them but cannot reply. Sender is always "Zistem Client Service".
export default function NotificationsInbox({ memberId, open, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!memberId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("member_id", memberId)
        .order("created_at", { ascending: false });
      if (!error) setItems(data || []);
    } catch (e) { /* ignore */ }
    setLoading(false);
  }, [memberId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  // Mark all as read when the inbox is opened.
  useEffect(() => {
    if (!open || !memberId || items.length === 0) return;
    const unread = items.filter(n => !n.read_at);
    if (unread.length === 0) return;
    (async () => {
      const now = new Date().toISOString();
      await supabase.from("notifications").update({ read_at: now }).in(
        "id",
        unread.map(n => n.id),
      );
      setItems(prev => prev.map(n => n.read_at ? n : { ...n, read_at: now }));
    })();
    // run once per open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;
  const unreadCount = items.filter(n => !n.read_at).length;

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
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 rounded-xl relative">
                <Mail className="w-5 h-5 text-indigo-600" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">{unreadCount}</span>
                )}
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-800">Notification Mail</h2>
                <p className="text-xs text-gray-500">Messages from Zistem Client Service · read-only</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* List */}
          <div className="p-4 overflow-y-auto flex-1">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-7 h-7 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-12">
                <Bell className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400 font-medium">No notifications yet</p>
                <p className="text-gray-300 text-sm">Messages from Zistem Client Service will appear here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map(n => (
                  <div
                    key={n.id}
                    className={`rounded-xl border p-4 transition-colors ${n.read_at ? "border-gray-100 bg-white" : "border-indigo-200 bg-indigo-50/60"}`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700">
                        <Mail className="w-3.5 h-3.5" /> Zistem Client Service
                      </span>
                      {!n.read_at && <span className="text-[10px] font-bold uppercase tracking-wide text-red-500">New</span>}
                    </div>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{n.message}</p>
                    <p className="text-[11px] text-gray-400 mt-2">{formatDate(n.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-center gap-2 text-xs text-gray-400">
            <Check className="w-3.5 h-3.5" /> This is a one-way message — replies are not supported.
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
