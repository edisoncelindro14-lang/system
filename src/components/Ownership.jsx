import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CreditCard, ArrowRight, Receipt, TrendingDown, Percent, Wallet } from "lucide-react";
import { useTable, useCurrentMember } from "../lib/useData";
import { money, formatDate } from "../lib/helpers";
import { ownershipSummary, accountFor, OWNERSHIP_STATUS } from "../lib/ownership";
import { Button, Badge } from "./ui";

export default function Ownership() {
  const { data: members = [] } = useTable("members");
  const { data: payments = [], isLoading } = useTable("ownership_payments", { order: "-created_date" });
  const { data: settings = [] } = useTable("system_settings");
  const { data: accounts = [] } = useTable("ownership_accounts");
  const { currentMember } = useCurrentMember(members);

  if (!currentMember && !isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Please login to view your ownership.</p>
          <Link to="/MemberLogin"><Button className="bg-orange-500 hover:bg-orange-600 text-white">Login <ArrowRight className="ml-2 w-4 h-4" /></Button></Link>
        </div>
      </div>
    );
  }

  if (!currentMember) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>;
  }

  const summary = ownershipSummary(currentMember.id, payments, settings, accountFor(accounts, currentMember.id));
  const status = OWNERSHIP_STATUS[summary.status];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl">
            <CreditCard className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Ownership</h1>
            <p className="text-gray-500">Track your payments, discounts and remaining balance</p>
          </div>
        </div>
      </motion.div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-br from-slate-700 to-gray-900 rounded-3xl p-5 text-white shadow-xl">
          <CreditCard className="w-7 h-7 mb-3" />
          <p className="text-gray-300 text-sm">Total Amount</p>
          <p className="text-2xl font-extrabold mt-1">{money(summary.total)}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-gradient-to-br from-fuchsia-500 to-pink-600 rounded-3xl p-5 text-white shadow-xl">
          <Percent className="w-7 h-7 mb-3" />
          <p className="text-pink-100 text-sm">Discount</p>
          <p className="text-2xl font-extrabold mt-1">{money(summary.discount)}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-5 text-white shadow-xl">
          <Wallet className="w-7 h-7 mb-3" />
          <p className="text-emerald-100 text-sm">Amount Paid</p>
          <p className="text-2xl font-extrabold mt-1">{money(summary.paid)}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl p-5 text-white shadow-xl">
          <TrendingDown className="w-7 h-7 mb-3" />
          <p className="text-amber-100 text-sm">Balance</p>
          <p className="text-2xl font-extrabold mt-1">{money(summary.balance)}</p>
        </motion.div>
      </div>

      {/* Progress */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6 mb-6">
        <div className="flex items-center justify-between mb-2 gap-4 flex-wrap">
          <div>
            <p className="text-sm text-gray-500">Payable after discount</p>
            <p className="text-xl font-bold text-gray-900">{money(summary.payable)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Next to pay</p>
            <p className="text-xl font-bold text-amber-600">{money(summary.nextPayment)}</p>
          </div>
          <Badge className={status.color}>{status.label}</Badge>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full transition-all"
            style={{ width: `${summary.percent}%` }} />
        </div>
        <p className="text-xs text-gray-400 mt-2">{summary.percent.toFixed(0)}% of your ownership is paid</p>
      </motion.div>

      {/* Payment history */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center gap-2">
          <Receipt className="w-5 h-5 text-amber-500" />
          <h2 className="text-lg font-bold text-gray-900">Payment History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount Paid</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Note</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Recorded By</th>
              </tr>
            </thead>
            <tbody>
              {summary.payments.length === 0 ? (
                <tr><td colSpan="4" className="text-center py-12 text-gray-400">No payments recorded yet</td></tr>
              ) : (
                summary.payments.map(p => {
                  const recorder = members.find(m => m.id === p.recorded_by);
                  return (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-600">{formatDate(p.created_date || p.created_at)}</td>
                      <td className="px-6 py-4 text-right font-bold text-emerald-600">+{money(p.amount)}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{p.note || "—"}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{recorder ? `@${recorder.username}` : "—"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
