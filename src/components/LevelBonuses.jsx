import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Layers, ArrowRight, HelpCircle } from "lucide-react";
import { useTable, useCurrentMember } from "../lib/useData";
import { LEVEL_CONFIG, money } from "../lib/helpers";
import { Button } from "./ui";

export default function LevelBonuses() {
  const { data: members = [] } = useTable("members");
  const { data: transactions = [] } = useTable("transactions");
  const { currentMember } = useCurrentMember(members);

  const totalMax = LEVEL_CONFIG.reduce((sum, l) => sum + l.bonus_amount * l.max_members, 0);

  if (!currentMember) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-md">
          <div className="w-20 h-20 bg-gradient-to-br from-amber-700 to-amber-900 rounded-3xl mx-auto mb-6 flex items-center justify-center">
            <Layers className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Zistem ComPlan</h1>
          <p className="text-gray-600 mb-6">Please login to view the compensation plan.</p>
          <Link to="/MemberLogin"><Button className="bg-orange-500 hover:bg-orange-600 text-white text-lg px-8 py-6">Login <ArrowRight className="ml-2 w-5 h-5" /></Button></Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-gradient-to-br from-amber-700 to-amber-900 rounded-2xl">
          <Layers className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Zistem ComPlan</h1>
          <p className="text-gray-500">5-level income structure — ₱1 per level per maintenance code redemption</p>
        </div>
      </motion.div>

      {/* Summary card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-amber-700 to-amber-900 rounded-3xl p-6 text-white mb-8 shadow-xl">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          <div><p className="text-amber-200 text-sm">Zistem Levels</p><p className="text-4xl font-extrabold">5</p></div>
          <div><p className="text-amber-200 text-sm">Max Downlines per Member</p><p className="text-4xl font-extrabold">8</p></div>
          <div><p className="text-amber-200 text-sm">Total Maximum Earnings</p><p className="text-4xl font-extrabold">{money(totalMax)}</p></div>
        </div>
      </motion.div>

      {/* How it works */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6 mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><HelpCircle className="w-5 h-5 text-amber-700" /> How Zistem Bonuses Work</h2>
        <ol className="space-y-3 text-gray-700">
          <li className="flex gap-3"><span className="w-6 h-6 bg-amber-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">1</span> A downline member redeems a maintenance code.</li>
          <li className="flex gap-3"><span className="w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">2</span> Level 1 bonus (₱1) goes to the referrer whose link was used; Levels 2–5 walk up the placement chain.</li>
          <li className="flex gap-3"><span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">3</span> Each upline within 5 levels receives their corresponding bonus instantly.</li>
        </ol>
      </motion.div>

      {/* Level details */}
      <div className="space-y-4">
        {LEVEL_CONFIG.map((l, i) => (
          <motion.div key={l.level} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.05 }}
            className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 bg-gradient-to-br ${l.color} rounded-2xl flex items-center justify-center text-white font-extrabold text-xl`}>L{l.level}</div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900">{l.label}</h3>
                <p className="text-sm text-gray-500 mt-1">{l.description}</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-extrabold text-gray-900">{money(l.bonus_amount)}</p>
                <p className="text-xs text-gray-500">per redemption</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
              <div><p className="text-xs text-gray-500">Max Members</p><p className="font-bold text-gray-900">{l.max_members.toLocaleString()}</p></div>
              <div><p className="text-xs text-gray-500">Total Max</p><p className="font-bold text-gray-900">{money(l.bonus_amount * l.max_members)}</p></div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Breakdown summary below levels */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        className="bg-gradient-to-r from-amber-700 to-amber-900 rounded-3xl p-6 text-white mt-8 shadow-xl">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          <div><p className="text-amber-200 text-sm">Zistem Levels</p><p className="text-4xl font-extrabold">5</p></div>
          <div><p className="text-amber-200 text-sm">Max Downlines per Member</p><p className="text-4xl font-extrabold">8</p></div>
          <div><p className="text-amber-200 text-sm">Total Maximum Earnings</p><p className="text-4xl font-extrabold">{money(totalMax)}</p></div>
        </div>
      </motion.div>
    </div>
  );
}
