import React, { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Wallet, ArrowRight, KeyRound, ChevronDown, ChevronUp, Ticket, Clock, Share2, Copy, Check, FileText, Users, ShoppingBag } from "lucide-react";
import toast from "react-hot-toast";
import { useTable, useCurrentMember, createRecord } from "../lib/useData";
import { supabase } from "../lib/supabase";
import { redeemCode } from "../lib/redeem";
import { money, formatDate, withdrawalCharge, LEVEL_CONFIG, MAX_BONUS_LEVEL, maintenanceStatus } from "../lib/helpers";
import { Button, Badge } from "./ui";
import AnnouncementBanner from "./AnnouncementBanner";

export default function Dashboard() {
  const [showHistory, setShowHistory] = useState(false);
  const [code, setCode] = useState("");
  const [redeemBusy, setRedeemBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const { data: members = [], isLoading } = useTable("members");
  const { data: allCodes = [] } = useTable("maintenance_codes");
  const { data: transactions = [] } = useTable("transactions");
  const { data: conversionReqs = [] } = useTable("conversion_requests");
  const { data: settings = [] } = useTable("system_settings");
  const { currentMember } = useCurrentMember(members);

  const termsVisible = settings.find(s => s.setting_key === "tab_terms_visible")?.setting_value !== "false";
  const productConversionVisible = settings.find(s => s.setting_key === "tab_product_conversion_visible")?.setting_value !== "false";
  const minWithdrawal = settings.find(s => s.setting_key === "withdrawal_minimum_amount")?.setting_value || "300";
  const minAmount = parseFloat(minWithdrawal);

  const myTx = currentMember ? transactions.filter(t => t.member_id === currentMember.id) : [];

  const availableBalance = myTx
    .filter(t => ["level_bonus", "referral_bonus", "adjustment"].includes(t.type) && t.status === "completed")
    .reduce((sum, t) => sum + Number(t.amount || 0), 0)
    - myTx
      .filter(t => (t.type === "withdrawal" || t.type === "product_conversion") && t.status === "completed")
      .reduce((sum, t) => sum + Math.abs(Number(t.amount || 0)), 0);

  const productWalletBalance = myTx
    .filter(t => t.type === "product_conversion" && t.status === "completed")
    .reduce((sum, t) => sum + Math.abs(Number(t.amount || 0)), 0);

  const pendingWithdrawal = conversionReqs.find(r => r.member_id === currentMember?.id && r.status === "pending");
  const withdrawals = myTx.filter(t => t.type === "withdrawal").sort((a, b) => new Date(b.created_date || b.created_at) - new Date(a.created_date || a.created_at));
  const myRedeemedCodes = allCodes.filter(c => c.is_used && c.used_by_member_id === currentMember?.id).sort((a, b) => new Date(b.used_at) - new Date(a.used_at));

  async function handleWithdraw() {
    if (withdrawValue < minAmount) {
      toast.error(`Minimum withdrawal is ₱${minAmount.toLocaleString()}.`);
      return;
    }
    if (withdrawValue > availableBalance) {
      toast.error("Amount exceeds your available balance.");
      return;
    }
    try {
      await createRecord("conversion_requests", {
        member_id: currentMember.id,
        amount: withdrawValue,
        status: "pending",
      });
      toast.success("Withdrawal request submitted!");
      window.location.reload();
    } catch (err) {
      toast.error("Failed to submit withdrawal request");
    }
  }

  async function handleConvertToProduct() {
    if (availableBalance < minAmount) {
      toast.error(`You need at least ₱${minAmount.toLocaleString()} to convert.`);
      return;
    }
    if (!window.confirm(`Convert ${money(availableBalance)} to your Product Wallet? This is instant and cannot be undone.`)) return;
    try {
      await createRecord("transactions", {
        member_id: currentMember.id,
        type: "product_conversion",
        amount: -availableBalance,
        status: "completed",
        description: "Converted to Product Wallet",
      });
      toast.success("Balance converted to Product Wallet!");
      window.location.reload();
    } catch (err) {
      toast.error("Failed to convert balance");
    }
  }

  async function handleRedeem(e) {
    e.preventDefault();
    if (!code) return;
    setRedeemBusy(true);
    try {
      // Find the code
      const { data: found, error } = await supabase
        .from("maintenance_codes").select("*").ilike("code", code.replace(/[%_\\]/g, c => `\\${c}`)).eq("is_used", false).limit(1);
      if (error || !found?.length) {
        toast.error("Invalid or already used code");
        setRedeemBusy(false);
        return;
      }
      const codeRecord = found[0];
      const result = await redeemCode(codeRecord, currentMember, members, allCodes);
      toast.success(result.message);
      setCode("");
      window.location.reload();
    } catch (err) {
      toast.error(err.message || "Failed to redeem code");
    }
    setRedeemBusy(false);
  }

  async function distributeUplineBonuses(member, allMembers, allCodes, codeRecord) {
    // Only uplines with GREEN maintenance status (redeemed & active) can earn bonuses
    const canEarn = (m) => {
      if (!m || m.status !== "approved") return false;
      const status = maintenanceStatus(m, allCodes);
      return status.isGreen;
    };

    // Walk up the referrer chain, paying bonuses at each level (1 through MAX_BONUS_LEVEL)
    let current = member;
    for (let level = 1; level <= MAX_BONUS_LEVEL; level++) {
      const upline = allMembers.find(m => m.id === current.referrer_id);
      if (!upline) break;
      if (canEarn(upline)) {
        const bonus = LEVEL_CONFIG.find(l => l.level === level)?.bonus_amount || 0;
        if (bonus > 0) {
          await supabase.from("transactions").insert({
            member_id: upline.id,
            type: "referral_bonus",
            amount: bonus,
            bonus_level: level,
            description: `Level ${level} bonus from ${member.username}`,
            status: "completed",
            from_member_id: member.id,
          });
        }
      }
      current = upline;
    }
  }

  const referralLink = currentMember?.referral_code ? `${window.location.origin}/Register?ref=${currentMember.referral_code}` : "";

  function copyReferral() {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Referral link copied!");
    setTimeout(() => setCopied(false), 2000);
  }

  if (!currentMember && !isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-md">
          <div className="w-20 h-20 bg-orange-500 rounded-3xl mx-auto mb-6 flex items-center justify-center">
            <Users className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Welcome!</h1>
          <p className="text-gray-600 mb-6">Please login to access your dashboard.</p>
          <Link to="/MemberLogin">
            <Button className="bg-orange-500 hover:bg-orange-600 text-white text-lg px-8 py-6">Login <ArrowRight className="ml-2 w-5 h-5" /></Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  if (!currentMember) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>;

  const withdrawValue = parseFloat(withdrawAmount) || 0;
  const charge = withdrawalCharge(withdrawValue > 0 ? withdrawValue : availableBalance, minAmount);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-2 pb-8">

      {/* Top action buttons */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-2 flex justify-end gap-2 sm:gap-3">
        {termsVisible && (
          <a href="https://forms.gle/bMLvWgG2KGfYXzBz8" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-1 bg-green-500 hover:bg-green-600 text-white font-bold px-4 py-2 rounded-xl text-xs sm:text-sm h-auto whitespace-nowrap shadow-sm transition-colors">
            <FileText className="w-4 h-4 mr-1" /> Membership Terms & Conditions
          </a>
        )}
      </motion.div>

      <AnnouncementBanner />

      <div className="mb-6 flex justify-center">
        <a href="https://forms.gle/5WRjKTq8DRBChf6RA" target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-black hover:bg-gray-800 text-white font-bold px-8 py-3 rounded-xl shadow-lg transition-all hover:scale-105">
          <FileText className="w-5 h-5" /> Client Form
        </a>
      </div>

      {/* Welcome header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
          Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-700 to-rose-700">{currentMember.username || "Member"}</span>
        </h1>
        <p className="text-gray-500 mt-2">Here's your Zistem network overview</p>
      </motion.div>

      {/* Balance card + Maintenance code */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Balance card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-2 bg-gradient-to-br from-[#8B4513] to-[#5C2E0A] rounded-3xl shadow-xl overflow-hidden flex flex-col">
          <div className="p-8 bg-black/10">
            <div className="flex items-center gap-6 flex-wrap">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
                <Wallet className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-amber-100 text-base font-medium">Current Balance</p>
                <p className="text-5xl font-extrabold text-white mt-1">{money(availableBalance)}</p>
                <p className="text-amber-100 text-xs mt-1">Minimum withdrawal: ₱{minAmount.toLocaleString()}</p>
              </div>
            </div>
            {availableBalance >= minAmount && !pendingWithdrawal && (
              <div className="mt-5 bg-white/20 rounded-2xl px-4 py-3 text-sm text-white space-y-2">
                <p className="font-bold">📋 Enter withdrawal amount</p>
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={e => setWithdrawAmount(e.target.value)}
                  placeholder={`Min ₱${minAmount.toLocaleString()} · Max ${money(availableBalance)}`}
                  className="w-full h-12 rounded-xl border border-white/30 bg-white/10 px-4 text-white text-lg font-bold outline-none focus:border-white/60 placeholder:text-white/40 placeholder:text-sm placeholder:font-normal"
                />
                {withdrawValue >= minAmount && withdrawValue <= availableBalance ? (
                  <>
                    <p>• ₱{minAmount.toLocaleString()}–₱999: flat <span className="font-bold">₱10</span> charge</p>
                    <p>• ₱1,000+: <span className="font-bold">₱15 per ₱1,000</span></p>
                    <div className="border-t border-white/30 mt-2 pt-2 flex justify-between">
                      <span>Charge: <span className="font-bold text-yellow-300">{money(charge)}</span></span>
                      <span className="font-bold text-yellow-200">You receive: ₱{(withdrawValue - charge).toLocaleString()}</span>
                    </div>
                  </>
                ) : withdrawValue > availableBalance ? (
                  <p className="text-red-300 font-medium">Amount exceeds your available balance.</p>
                ) : null}
              </div>
            )}
            {productWalletBalance > 0 && (
              <div className="mt-5 bg-amber-800/40 rounded-2xl px-4 py-3 flex items-center gap-3 text-sm text-white">
                <ShoppingBag className="w-5 h-5 shrink-0" />
                <div>
                  <p className="text-amber-100 text-xs">Product Wallet Balance</p>
                  <p className="font-bold text-lg">{money(productWalletBalance)}</p>
                </div>
              </div>
            )}
            <div className="mt-5 flex flex-wrap gap-3">
              {pendingWithdrawal ? (
                <div className="bg-white/20 rounded-2xl px-5 py-3 flex items-center gap-2 text-white text-sm font-semibold">
                  <Clock className="w-4 h-4" /> Withdrawal pending admin approval
                </div>
              ) : (
                <>
                  <Button onClick={handleWithdraw} disabled={withdrawValue < minAmount || withdrawValue > availableBalance}
                    className="bg-[#6B3410] text-white hover:bg-[#5C2A0D] font-bold text-base px-8 py-4 h-auto rounded-2xl shadow-lg disabled:opacity-100 disabled:text-white/40 disabled:bg-[#6B3410]/50">
                    <Wallet className="w-5 h-5 mr-2" /> Withdraw Now
                </Button>
                  {productConversionVisible && (
                  <Button onClick={handleConvertToProduct} disabled={availableBalance < minAmount}
                    className="bg-[#7A3E12] text-white hover:bg-[#6B3410] font-bold text-base px-6 py-4 h-auto rounded-2xl shadow-lg disabled:opacity-100 disabled:text-white/40 disabled:bg-[#7A3E12]/50">
                    <ShoppingBag className="w-5 h-5 mr-2" /> Convert to Product Wallet
                  </Button>
                  )}
                </>
              )}
              <Button onClick={() => setShowHistory(!showHistory)} variant="ghost"
                className="bg-[#5C2E0A] hover:bg-[#4A2408] text-white border border-amber-700/50 rounded-2xl">
                {showHistory ? <ChevronUp className="w-4 h-4 mr-2" /> : <ChevronDown className="w-4 h-4 mr-2" />} Withdrawal History
              </Button>
            </div>
            <AnimatePresence>
              {showHistory && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="bg-white/10 border-t border-white/20 overflow-hidden">
                  <div className="p-6">
                    <h3 className="text-white font-bold mb-4">Withdrawal History</h3>
                    {withdrawals.length === 0 ? (
                      <p className="text-amber-100 text-sm text-center py-4">No withdrawals yet</p>
                    ) : (
                      <div className="space-y-3">
                        {withdrawals.map(w => (
                          <div key={w.id} className="bg-white/10 rounded-2xl px-4 py-3 flex items-center justify-between gap-4">
                            <div>
                              <p className="text-white text-sm font-semibold">Withdrawal</p>
                              <p className="text-amber-100 text-xs">{formatDate(w.created_date || w.created_at)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-white font-bold">-{money(Math.abs(w.amount || 0))}</p>
                              <Badge className="bg-white/20 text-white border-white/30 text-xs mt-1">{w.status}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="flex-1 bg-[#fdf5e6]"></div>
        </motion.div>

        {/* Maintenance code redemption */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-white/70 backdrop-blur-md rounded-3xl shadow-lg border border-white/60 overflow-hidden">
          <div className="p-6 border-b border-white/40 bg-gradient-to-r from-black to-gray-800">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl">
                <Ticket className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Maintenance Code</h2>
                <p className="text-sm text-gray-200">Paki-Paste po sa box sa ibaba ang iyong eksaktong Code at i-click ang "Redeem Code" button</p>
              </div>
            </div>
          </div>
          <div className="px-6 pt-4 grid grid-cols-5 gap-3">
            {LEVEL_CONFIG.map(l => (
              <div key={l.level} className="text-center">
                <div className={`w-10 h-10 bg-gradient-to-br ${l.color} rounded-xl flex items-center justify-center text-white font-extrabold text-lg mx-auto mb-1`}>
                  L{l.level}
                </div>
                <p className="text-xs font-bold text-gray-700">₱{l.bonus_amount}</p>
              </div>
            ))}
          </div>
          <div className="p-6">
            <form onSubmit={handleRedeem} className="space-y-3">
              <input
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="MAINT-XXXXXX"
                className="w-full h-12 rounded-xl border border-gray-200 px-4 outline-none focus:border-black focus:ring-2 focus:ring-black/20 uppercase"
              />
              <Button type="submit" disabled={redeemBusy}
                className="w-full bg-gradient-to-r from-black to-gray-800 hover:from-gray-800 hover:to-black text-white font-bold h-12 rounded-xl">
                <KeyRound className="w-4 h-4 mr-2" /> {redeemBusy ? "Redeeming..." : "Redeem Code"}
              </Button>
            </form>
            {myRedeemedCodes.length > 0 && (
              <div className="mt-5 border-t border-gray-100 pt-4">
                <p className="text-sm font-bold text-gray-700 mb-2">Redeemed Codes History</p>
                <div className="space-y-2 max-h-20 overflow-y-auto">
                  {myRedeemedCodes.map(c => (
                    <div key={c.id} className="flex items-center justify-between bg-teal-50 rounded-lg px-3 py-2">
                      <code className="font-mono text-sm font-bold text-gray-900">{c.code}</code>
                      <span className="text-xs text-gray-500">{formatDate(c.used_at, "MMM d, yyyy")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Referral link */}
      {currentMember.referral_code && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-cyan-600 to-blue-800 rounded-2xl p-6 shadow-lg mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-white/20 rounded-xl">
              <Share2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white">Your Referral Link</h3>
              <p className="text-sm text-cyan-50">Share this link to invite new members to your network</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-white/15 rounded-xl px-4 py-3 border border-white/30 text-sm text-white truncate">{referralLink}</div>
            <Button onClick={copyReferral} className="!bg-white !text-blue-700 hover:!bg-blue-50 px-4 py-3 h-auto rounded-xl">
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              <span className="ml-2 text-sm font-semibold">{copied ? "Copied!" : "Copy"}</span>
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
