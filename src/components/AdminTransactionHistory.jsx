import React, { useState, useMemo } from "react";
import { FileText } from "lucide-react";
import { money, formatDate } from "../lib/helpers";
import { Badge } from "./ui";
import SearchableDropdown from "./SearchableDropdown";

const CATEGORIES = [
  { key: "referral_bonus", label: "Referral Bonus", types: ["referral_bonus"], head: "bg-blue-100 text-blue-700" },
  { key: "level_bonus", label: "Level Bonus", types: ["level_bonus"], head: "bg-emerald-100 text-emerald-700" },
  { key: "maintenance", label: "Maintenance Code", types: ["maintenance_code", "adjustment"], head: "bg-teal-100 text-teal-700" },
  { key: "withdrawal", label: "Withdrawal", types: ["withdrawal"], head: "bg-red-100 text-red-700" },
  { key: "product", label: "Product Wallet", types: ["product_conversion"], head: "bg-purple-100 text-purple-700" },
  { key: "other", label: "Other", types: null, head: "bg-gray-100 text-gray-700" },
];
const KNOWN = CATEGORIES.flatMap(c => c.types || []);
const ROW_H = 76; // px per row -> 10 rows visible, the rest scrolls

// Admin view: pick one username, then see their transactions split into one scrollable column per category.
export default function AdminTransactionHistory({ members, transactions }) {
  const [username, setUsername] = useState("");
  const usernames = useMemo(() => members.map(m => m.username).filter(Boolean).sort((a, b) => a.localeCompare(b)), [members]);
  const member = members.find(m => m.username === username);

  const columns = useMemo(() => {
    if (!member) return [];
    const mine = transactions
      .filter(t => t.member_id === member.id)
      .sort((a, b) => new Date(b.created_date || b.created_at) - new Date(a.created_date || a.created_at));
    return CATEGORIES.map(c => ({
      ...c,
      items: mine.filter(t => (c.types ? c.types.includes(t.type) : !KNOWN.includes(t.type))),
    }));
  }, [member, transactions]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><FileText className="w-5 h-5 text-amber-500" /> User Transaction History</h2>
        <div className="flex-1 min-w-[220px] max-w-md">
          <SearchableDropdown value={username} onChange={setUsername} options={usernames} placeholder="Search & select username…" />
        </div>
      </div>

      {!member ? (
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 py-16 text-center text-gray-400">Select a username to view their transactions</div>
      ) : (
        <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2" style={{ WebkitOverflowScrolling: "touch" }}>
          {columns.map(col => (
            <div key={col.key} className="snap-start shrink-0 w-[280px] sm:w-[300px] bg-white rounded-2xl shadow border border-gray-100 overflow-hidden">
              <div className={`px-4 py-3 flex items-center justify-between font-semibold text-sm ${col.head}`}>
                <span>{col.label}</span>
                <span className="text-xs opacity-80">{col.items.length}</span>
              </div>
              <div className="overflow-y-auto overscroll-contain" style={{ maxHeight: ROW_H * 10 }}>
                {col.items.length === 0 ? (
                  <p className="text-center text-sm text-gray-400 py-8">No records</p>
                ) : col.items.map(t => {
                  const out = t.type === "withdrawal";
                  return (
                    <div key={t.id} className="px-4 py-3 border-b border-gray-50 hover:bg-gray-50" style={{ minHeight: ROW_H }}>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-sm font-bold ${out ? "text-red-600" : "text-emerald-600"}`}>{out ? "" : "+"}{money(Math.abs(t.amount || 0))}</span>
                        <Badge className={t.status === "completed" ? "bg-green-100 text-green-700" : t.status === "pending" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}>{t.status}</Badge>
                      </div>
                      <p className="text-xs text-gray-600 mt-1 line-clamp-2">{t.description || "—"}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatDate(t.created_date || t.created_at, "MMM d, yyyy")}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
