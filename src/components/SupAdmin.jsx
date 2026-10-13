import React, { useState } from "react";
import { motion } from "framer-motion";
import { Crown, Search, Shield, UserCog } from "lucide-react";
import toast from "react-hot-toast";
import { useTable, updateRecord } from "../lib/useData";
import { Button, Input, Badge } from "./ui";
import { money, formatDate, maintenanceStatus, formatTime } from "../lib/helpers";

export default function SupAdmin() {
  const [search, setSearch] = useState("");
  const { data: members = [] } = useTable("members");
  const { data: codes = [] } = useTable("maintenance_codes");

  const activeMembers = members.filter(m => m.status !== "deleted");
  const adminMembers = members.filter(m => m.role === "admin");

  const filteredMembers = activeMembers.filter(m => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (m.full_name || "").toLowerCase().includes(q) || (m.username || "").toLowerCase().includes(q);
  });

  async function promoteToAdmin(id) {
    try {
      await updateRecord("members", id, { role: "admin" });
      toast.success("Member promoted to Admin");
      window.location.reload();
    } catch { toast.error("Failed to promote member"); }
  }

  async function demoteToMember(id) {
    try {
      await updateRecord("members", id, { role: "member" });
      toast.success("Admin role removed");
      window.location.reload();
    } catch { toast.error("Failed to remove admin role"); }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl">
          <Shield className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Super Admin Panel</h1>
          <p className="text-gray-500">Promote members to admin accounts</p>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white rounded-2xl shadow border border-gray-100 p-5">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center mb-3">
            <Crown className="w-5 h-5 text-white" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{adminMembers.length}</p>
          <p className="text-sm text-gray-500">Active Admins</p>
        </div>
        <div className="bg-white rounded-2xl shadow border border-gray-100 p-5">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center mb-3">
            <UserCog className="w-5 h-5 text-white" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{activeMembers.filter(m => m.role === "member").length}</p>
          <p className="text-sm text-gray-500">Eligible Members</p>
        </div>
      </div>

      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search members..." className="pl-10" />
      </div>

      <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-gray-100">
              {["Name", "Username", "Role", "Status", "Maintenance", "Actions"].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody>
              {filteredMembers.length === 0 ? (
                <tr><td colSpan="6" className="text-center py-12 text-gray-400">No members found</td></tr>
              ) : filteredMembers.map(m => {
                const mStatus = maintenanceStatus(m, codes);
                return (
                <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{m.full_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">@{m.username}</td>
                  <td className="px-4 py-3"><Badge className="bg-gray-100 text-gray-600 capitalize">{m.role}</Badge></td>
                  <td className="px-4 py-3"><Badge className={m.status === "approved" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}>{m.status}</Badge></td>
                  <td className="px-4 py-3"><span className={`text-sm font-medium whitespace-nowrap ${mStatus.isGreen ? "text-green-700" : "text-red-700"}`}>{mStatus.secondsLeft > 0 ? formatTime(mStatus.secondsLeft) : "Expired"}</span></td>
                  <td className="px-4 py-3">
                    {m.role === "admin" ? (
                      <Button onClick={() => demoteToMember(m.id)} size="sm" variant="outline" className="border-purple-200 text-purple-600 hover:bg-purple-50 h-8 px-3 text-xs">Remove Admin</Button>
                    ) : (
                      <Button onClick={() => promoteToAdmin(m.id)} size="sm" className="bg-purple-600 hover:bg-purple-700 text-white h-8 px-3 text-xs"><Crown className="w-3 h-3 mr-1" /> Make Admin</Button>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
