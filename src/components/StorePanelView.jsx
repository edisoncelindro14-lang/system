import React, { useState } from "react";
import { Ticket, Calendar, Copy } from "lucide-react";
import toast from "react-hot-toast";
import { useTable } from "../lib/useData";
import { formatDate } from "../lib/helpers";
import { storeQuotaSummary, generateStoreCodes } from "../lib/storeQuota";
import WeeklyRedeemMonitor from "./WeeklyRedeemMonitor";
import StoreAvailableCodes from "./StoreAvailableCodes";
import SearchableDropdown from "./SearchableDropdown";
import { Button, Input, Label, Badge } from "./ui";

export default function StorePanelView({ store }) {
  const { data: members = [] } = useTable("members");
  const { data: codes = [], refetch: refetchCodes } = useTable("maintenance_codes");
  const { data: quotas = [] } = useTable("store_code_quotas");
  const { data: redemptionHistory = [], refetch: refetchHistory } = useTable("code_redemption_history");
  const [count, setCount] = useState("1");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [phonebookVersion, setPhonebookVersion] = useState(0);
  const [genSelectedUser, setGenSelectedUser] = useState("");

  const q = storeQuotaSummary(store.id, quotas, codes);
  const isAdminRole = m => m.role === "admin" || m.role === "sub_admin";
  const adminNames = new Set(members.filter(isAdminRole).map(m => m.username));
  const usernames = members.filter(m => m.status === "approved" && !isAdminRole(m)).map(m => m.username);
  const hideAdminCodes = list => list.filter(c => !adminNames.has(c.assigned_username));
  const genUsernameOptions = [...new Set(hideAdminCodes(q.generatedCodes).map(c => c.assigned_username).filter(Boolean))];
  const filteredGeneratedCodes = genSelectedUser
    ? hideAdminCodes(q.generatedCodes).filter(c => c.assigned_username === genSelectedUser)
    : hideAdminCodes(q.generatedCodes);

  // Per-user weekly monitor: every non-admin user this store designated codes to
  const monitorRows = [...new Set(hideAdminCodes(q.generatedCodes).map(c => c.assigned_username).filter(Boolean))].map(u => {
    const m = members.find(x => x.username === u);
    return { username: u, usedAts: codes.filter(c => c.is_used && c.used_at && m && c.used_by_member_id === m.id).map(c => c.used_at) };
  });

  async function generate() {
    const n = parseInt(count) || 0;
    const target = username.trim().replace(/^@/, "");
    if (n < 1) { toast.error("Enter a valid number of codes"); return; }
    if (n > q.remaining) { toast.error(`You can only generate ${q.remaining} more code(s)`); return; }
    if (!target) { toast.error("Select a username to designate the code to"); return; }
    if (!usernames.includes(target)) { toast.error("Username not found"); return; }
    setBusy(true);
    try {
      await generateStoreCodes(store.id, n, target);
      toast.success(`${n} code(s) generated!`);
      setCount("1");
      setUsername("");
      refetchCodes();
      setPhonebookVersion(v => v + 1);
    } catch { toast.error("Failed to generate codes"); }
    setBusy(false);
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Allotted by Admin", value: q.allotted, color: "from-amber-500 to-orange-600" },
          { label: "Generated", value: q.generated, color: "from-blue-500 to-indigo-600" },
          { label: "Remaining", value: q.remaining, color: "from-teal-500 to-emerald-600" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl shadow border border-gray-100 p-5">
            <div className={`w-10 h-10 bg-gradient-to-br ${s.color} rounded-xl mb-3`} />
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-sm text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Allotments from admin */}
      <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden mb-6">
        <div className="p-6 border-b border-gray-100"><h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Calendar className="w-5 h-5 text-indigo-500" /> Codes Added by Admin</h2></div>
        <div className="overflow-auto max-h-[440px]">
          <table className="w-full">
            <thead className="sticky top-0 bg-white z-10"><tr className="border-b border-gray-100">{["Date", "Codes Added"].map(h => <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead>
            <tbody>
              {q.allotments.length === 0 ? <tr><td colSpan="2" className="text-center py-10 text-gray-400">No codes allotted yet</td></tr> :
              q.allotments.map(a => (
                <tr key={a.id} className="border-b border-gray-50">
                  <td className="px-6 py-3 text-sm text-gray-600">{formatDate(a.created_date)}</td>
                  <td className="px-6 py-3 text-sm font-semibold text-emerald-700">+{a.quota_amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Generate */}
      <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4"><Ticket className="w-5 h-5 text-teal-500" /> Generate Codes</h2>
        <div className="grid sm:grid-cols-[160px_1fr_auto] gap-3 items-end">
          <div>
            <Label>Number of codes</Label>
            <Input type="number" min="1" max={q.remaining} value={count} onChange={e => setCount(e.target.value)} />
          </div>
          <div>
            <Label>Designate to username</Label>
            <SearchableDropdown value={username} onChange={setUsername} options={usernames} placeholder="Select a username" />
          </div>
          <Button onClick={generate} disabled={busy || q.remaining < 1} className="bg-gradient-to-r from-teal-500 to-emerald-600 text-white h-10">{busy ? "Generating..." : "Generate"}</Button>
        </div>
        {q.remaining < 1 && <p className="text-sm text-red-500 mt-3">No remaining codes. Ask the admin to add more.</p>}
      </div>

      <WeeklyRedeemMonitor title="Weekly Redeemed Codes (Mon – Sun)" rows={monitorRows} />

      {/* Available codes designated to members — searchable list */}
      <StoreAvailableCodes
        storeId={store.id}
        members={members}
        codes={hideAdminCodes(codes)}
        refetchCodes={refetchCodes}
        refetchHistory={refetchHistory}
        onRedeemDone={() => setPhonebookVersion(v => v + 1)}
      />

      {/* Generated codes */}
      <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-3"><Ticket className="w-5 h-5 text-amber-500" /> My Generated Codes</h2>
          <div className="max-w-sm"><SearchableDropdown value={genSelectedUser} onChange={setGenSelectedUser} options={genUsernameOptions} placeholder="Filter by username" /></div>
        </div>
        <div className="overflow-auto max-h-[520px]">
          <table className="w-full">
            <thead className="sticky top-0 bg-white z-10"><tr className="border-b border-gray-100">{["Code", "Designated To", "Status", "Generated", "Used Date"].map(h => <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead>
            <tbody>
              {filteredGeneratedCodes.length === 0 ? <tr><td colSpan="5" className="text-center py-10 text-gray-400">No codes found</td></tr> :
              filteredGeneratedCodes.map(c => (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm font-mono font-bold text-gray-900">
                    <button onClick={() => { navigator.clipboard.writeText(c.code); toast.success("Copied"); }} className="inline-flex items-center gap-1 hover:text-teal-600">{c.code} <Copy className="w-3 h-3" /></button>
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600">{c.assigned_username ? `@${c.assigned_username}` : "Unassigned"}</td>
                  <td className="px-6 py-3"><Badge className={c.is_used ? "bg-gray-100 text-gray-500" : "bg-green-100 text-green-700"}>{c.is_used ? "Used" : "Available"}</Badge></td>
                  <td className="px-6 py-3 text-sm text-gray-500">{formatDate(c.created_at)}</td>
                  <td className="px-6 py-3 text-sm text-gray-400">{c.used_at ? formatDate(c.used_at) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
