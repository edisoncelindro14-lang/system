import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CreditCard, Search, Plus, Save, X, Receipt, Trash2, Percent, Wallet, Users, SlidersHorizontal } from "lucide-react";
import toast from "react-hot-toast";
import { useTable, createRecord, updateRecord, deleteRecord } from "../lib/useData";
import { getSessionMemberId } from "../lib/auth";
import { money, formatDate } from "../lib/helpers";
import { ownershipSummary, accountFor, settingAmount, OWNERSHIP_STATUS, OWNERSHIP_TOTAL_KEY, OWNERSHIP_DISCOUNT_KEY } from "../lib/ownership";
import { Button, Input, Label, Badge } from "./ui";

export default function AdminOwnershipTab({ members = [], settings = [], refetchSettings }) {
  const { data: payments = [], refetch: refetchPayments, mutate: mutatePayments } = useTable("ownership_payments", { order: "-created_date" });
  const { data: accounts = [], refetch: refetchAccounts } = useTable("ownership_accounts");
  const [search, setSearch] = useState("");
  const [totalAmount, setTotalAmount] = useState("0");
  const [discountAmount, setDiscountAmount] = useState("0");
  const [savingSettings, setSavingSettings] = useState(false);
  const [payModal, setPayModal] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");
  const [savingPay, setSavingPay] = useState(false);
  const [historyModal, setHistoryModal] = useState(null);
  const [amountModal, setAmountModal] = useState(null);
  const [formTotal, setFormTotal] = useState("");
  const [formNext, setFormNext] = useState("");
  const [formDue, setFormDue] = useState("");
  const [formDiscount, setFormDiscount] = useState("");
  const [savingAccount, setSavingAccount] = useState(false);

  useEffect(() => {
    const total = settings.find(s => s.setting_key === OWNERSHIP_TOTAL_KEY);
    const discount = settings.find(s => s.setting_key === OWNERSHIP_DISCOUNT_KEY);
    setTotalAmount(total?.setting_value || "0");
    setDiscountAmount(discount?.setting_value || "0");
  }, [settings]);

  // A redeemed code records a payment and lowers the system total, so re-read
  // payments, overrides and settings instead of showing the cached snapshot.
  useEffect(() => {
    const refresh = () => { refetchPayments(); refetchAccounts(); refetchSettings?.(); };
    const refreshIfVisible = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("focus", refresh);
    window.addEventListener("ownership_changed", refresh);
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("ownership_changed", refresh);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [refetchPayments, refetchAccounts, refetchSettings]);

  const summaryFor = member => ownershipSummary(member.id, payments, settings, accountFor(accounts, member.id));

  const rows = members
    .filter(m => m.status !== "deleted")
    .filter(m => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (m.full_name || "").toLowerCase().includes(q) || (m.username || "").toLowerCase().includes(q);
    });

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const fullyPaid = members.filter(m => summaryFor(m).status === "paid").length;
  const totalOutstanding = members.reduce((sum, m) => sum + summaryFor(m).balance, 0);

  async function saveOwnershipSettings() {
    const total = parseFloat(totalAmount);
    const discount = parseFloat(discountAmount);
    if (isNaN(total) || total < 0) { toast.error("Enter a valid total amount"); return; }
    if (isNaN(discount) || discount < 0) { toast.error("Enter a valid discount"); return; }
    setSavingSettings(true);
    try {
      const pairs = [
        { key: OWNERSHIP_TOTAL_KEY, value: String(total) },
        { key: OWNERSHIP_DISCOUNT_KEY, value: String(discount) },
      ];
      for (const { key, value } of pairs) {
        const existing = settings.find(s => s.setting_key === key);
        const { error } = existing
          ? await updateRecord("system_settings", existing.id, { setting_value: value })
          : await createRecord("system_settings", { setting_key: key, setting_value: value });
        if (error) throw error;
      }
      toast.success("Ownership amount and discount saved");
      refetchSettings?.();
      window.dispatchEvent(new CustomEvent("system_settings_changed"));
    } catch {
      toast.error("Failed to save ownership settings");
    }
    setSavingSettings(false);
  }

  function openPayModal(member) {
    setPayModal(member);
    setPayAmount("");
    setPayNote("");
  }

  function openAmountModal(member) {
    const account = accountFor(accounts, member.id);
    setAmountModal(member);
    setFormTotal(account?.total_amount != null ? String(account.total_amount) : "");
    setFormNext(account?.next_payment_amount != null ? String(account.next_payment_amount) : "");
    setFormDue(account?.next_payment_due || "");
    setFormDiscount(account?.discount != null ? String(account.discount) : "");
  }

  // Empty field = inherit the system amount for that member.
  function parseOptionalAmount(raw) {
    if (raw.trim() === "") return null;
    const value = parseFloat(raw);
    return Number.isFinite(value) && value >= 0 ? value : NaN;
  }

  async function saveAccount() {
    if (!amountModal) return;
    const total = parseOptionalAmount(formTotal);
    const next = parseOptionalAmount(formNext);
    const discount = parseOptionalAmount(formDiscount);
    const due = formDue || null;
    if ([total, next, discount].some(v => Number.isNaN(v))) {
      toast.error("Enter valid amounts (0 or higher) or leave blank");
      return;
    }
    const account = accountFor(accounts, amountModal.id);
    setSavingAccount(true);
    try {
      if (total === null && next === null && discount === null && !due) {
        if (account) {
          const { error } = await deleteRecord("ownership_accounts", account.id);
          if (error) throw error;
        }
        toast.success("Using system amounts again");
      } else {
        const values = { total_amount: total, next_payment_amount: next, next_payment_due: due, discount, updated_by: getSessionMemberId() || null };
        const { error } = account
          ? await updateRecord("ownership_accounts", account.id, values)
          : await createRecord("ownership_accounts", { member_id: amountModal.id, ...values });
        if (error) throw error;
        toast.success(`Ownership amounts saved for @${amountModal.username}`);
      }
      setAmountModal(null);
      refetchAccounts();
      window.dispatchEvent(new CustomEvent("ownership_changed"));
    } catch (error) {
      console.error("Failed to save ownership amounts:", error);
      toast.error("Failed to save ownership amounts");
    }
    setSavingAccount(false);
  }

  async function savePayment() {
    const amount = parseFloat(payAmount);
    if (!payModal) return;
    if (isNaN(amount) || amount <= 0) { toast.error("Enter a valid payment amount"); return; }
    const summary = summaryFor(payModal);
    setSavingPay(true);
    try {
      const { data: saved, error } = await createRecord("ownership_payments", {
        member_id: payModal.id,
        amount,
        total_amount: summary.total,
        discount: summary.discount,
        note: payNote.trim() || null,
        // An empty/stale session id must not block the insert (the column is a uuid FK).
        recorded_by: getSessionMemberId() || null,
      });
      if (error) throw error;
      // Show the new payment immediately; the refetch below only confirms it.
      if (saved) mutatePayments(prev => [saved, ...prev]);
      toast.success(`Payment of ${money(amount)} recorded`);
      setPayModal(null);
      refetchPayments();
      window.dispatchEvent(new CustomEvent("ownership_changed"));
    } catch (err) {
      toast.error(err?.message || "Failed to record payment");
    }
    setSavingPay(false);
  }

  async function removePayment(payment) {
    try {
      const { error } = await deleteRecord("ownership_payments", payment.id);
      if (error) throw error;
      mutatePayments(prev => prev.filter(p => p.id !== payment.id));
      toast.success("Payment deleted");
      refetchPayments();
      window.dispatchEvent(new CustomEvent("ownership_changed"));
    } catch (err) {
      toast.error(err?.message || "Failed to delete payment");
    }
  }

  const paySummary = payModal ? summaryFor(payModal) : null;
  const remainingAfter = paySummary ? Math.max(0, paySummary.balance - (parseFloat(payAmount) || 0)) : 0;
  const systemTotal = settingAmount(settings, OWNERSHIP_TOTAL_KEY);
  const systemDiscount = settingAmount(settings, OWNERSHIP_DISCOUNT_KEY);
  const amountSummary = amountModal ? summaryFor(amountModal) : null;

  return (
    <div className="space-y-6">
      {/* System amount & discount */}
      <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2"><CreditCard className="w-5 h-5 text-amber-500" /> System Ownership Amount</h2>
        <p className="text-sm text-gray-500 mb-4">Set the total amount every member must pay for ownership and the discount deducted from it.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div>
            <Label>Total Amount (₱)</Label>
            <Input type="number" value={totalAmount} onChange={e => setTotalAmount(e.target.value)} />
          </div>
          <div>
            <Label>Discount (₱)</Label>
            <Input type="number" value={discountAmount} onChange={e => setDiscountAmount(e.target.value)} />
          </div>
          <div className="flex gap-3 items-center">
            <Button onClick={saveOwnershipSettings} disabled={savingSettings} className="bg-gradient-to-r from-amber-500 to-orange-600 text-white">
              <Save className="w-4 h-4 mr-2" /> {savingSettings ? "Saving..." : "Save"}
            </Button>
            <div className="text-sm text-gray-500">
              Payable: <span className="font-bold text-gray-900">{money(Math.max(0, (parseFloat(totalAmount) || 0) - (parseFloat(discountAmount) || 0)))}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Collected", value: money(totalPaid), icon: Wallet, color: "from-emerald-500 to-teal-600" },
          { label: "Outstanding Balance", value: money(totalOutstanding), icon: CreditCard, color: "from-amber-500 to-orange-600" },
          { label: "Fully Paid Members", value: fullyPaid, icon: Users, color: "from-violet-500 to-indigo-600" },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-2xl shadow border border-gray-100 p-5">
            <div className={`w-10 h-10 bg-gradient-to-br ${s.color} rounded-xl flex items-center justify-center mb-3`}>
              <s.icon className="w-5 h-5 text-white" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-sm text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Members ownership monitor */}
      <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Percent className="w-5 h-5 text-fuchsia-500" /> Ownership by Member</h2>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search members..." className="pl-10" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Member</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Discount</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Next to Pay</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Paid</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Balance</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan="8" className="text-center py-12 text-gray-400">No members found</td></tr>
              ) : (
                rows.map(m => {
                  const s = summaryFor(m);
                  const status = OWNERSHIP_STATUS[s.status];
                  return (
                    <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <p className="font-bold text-gray-900 truncate">{m.full_name || m.username}</p>
                        <p className="text-xs text-gray-400 truncate">@{m.username}</p>
                      </td>
                      <td className="px-5 py-3 text-right text-sm text-gray-700">
                        {money(s.total)}
                        {s.hasCustomTotal && <span className="block text-[10px] text-amber-600 font-semibold uppercase">custom</span>}
                      </td>
                      <td className="px-5 py-3 text-right text-sm text-fuchsia-600">
                        {money(s.discount)}
                        {s.hasCustomDiscount && <span className="block text-[10px] text-amber-600 font-semibold uppercase">custom</span>}
                      </td>
                      <td className="px-5 py-3 text-right text-sm font-semibold text-amber-600">
                        {money(s.nextPayment)}
                        {s.nextPaymentDue && <span className="block text-[10px] text-gray-400 font-medium">Due {formatDate(`${s.nextPaymentDue}T00:00:00`, "MMM d, yyyy")}</span>}
                      </td>
                      <td className="px-5 py-3 text-right text-sm font-bold text-emerald-600">{money(s.paid)}</td>
                      <td className="px-5 py-3 text-right text-sm font-bold text-gray-900">{money(s.balance)}</td>
                      <td className="px-5 py-3">
                        <Badge className={status.color}>{status.label}</Badge>
                        <div className="mt-1 h-1.5 w-20 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${s.percent}%` }} />
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => openAmountModal(m)} className="p-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors" title="Set Amounts"><SlidersHorizontal className="w-4 h-4" /></button>
                          <button onClick={() => openPayModal(m)} className="p-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors" title="Record Payment"><Plus className="w-4 h-4" /></button>
                          <button onClick={() => setHistoryModal(m)} className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors" title="Payment History"><Receipt className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-member amounts modal */}
      <AnimatePresence>
        {amountModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setAmountModal(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-50 rounded-xl"><SlidersHorizontal className="w-5 h-5 text-amber-600" /></div>
                  <h2 className="text-lg font-bold text-gray-800">Ownership Amounts — {amountModal.username}</h2>
                </div>
                <button onClick={() => setAmountModal(null)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"><X className="w-5 h-5 text-gray-400" /></button>
              </div>
              <div className="px-6 py-5 space-y-4">
                <p className="text-xs text-gray-500">Leave a field blank to use the system default.</p>
                <div>
                  <Label>Total Amount (₱)</Label>
                  <Input type="number" min="0" step="0.01" value={formTotal} onChange={e => setFormTotal(e.target.value)} placeholder={`System: ${money(systemTotal)}`} />
                </div>
                <div>
                  <Label>Next Amount to Pay (₱)</Label>
                  <Input type="number" min="0" step="0.01" value={formNext} onChange={e => setFormNext(e.target.value)} placeholder={`Balance: ${money(amountSummary.balance)}`} />
                </div>
                <div>
                  <Label>Next Payment Due Date</Label>
                  <Input type="date" value={formDue} onChange={e => setFormDue(e.target.value)} />
                </div>
                <div>
                  <Label>Discount (₱)</Label>
                  <Input type="number" min="0" step="0.01" value={formDiscount} onChange={e => setFormDiscount(e.target.value)} placeholder={`System: ${money(systemDiscount)}`} />
                </div>
                <p className="text-xs text-gray-500">
                  Payable after discount:{" "}
                  <span className="font-bold text-gray-900">
                    {money(Math.max(0,
                      (parseOptionalAmount(formTotal) ?? systemTotal) - (parseOptionalAmount(formDiscount) ?? systemDiscount)
                    ))}
                  </span>
                </p>
              </div>
              <div className="flex gap-3 px-6 py-5 border-t border-gray-100 bg-gray-50">
                <button onClick={() => setAmountModal(null)} className="flex-[2] h-12 rounded-xl bg-white border border-gray-300 text-gray-900 font-medium hover:bg-gray-100 transition-all">Cancel</button>
                <button onClick={saveAccount} disabled={savingAccount} className="flex-[3] h-12 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-medium transition-all disabled:opacity-50">
                  {savingAccount ? "Saving..." : "Save Amounts"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Record payment modal */}
      <AnimatePresence>
        {payModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setPayModal(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-50 rounded-xl"><Wallet className="w-5 h-5 text-emerald-600" /></div>
                  <h2 className="text-lg font-bold text-gray-800">Record Payment — {payModal.username}</h2>
                </div>
                <button onClick={() => setPayModal(null)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"><X className="w-5 h-5 text-gray-400" /></button>
              </div>
              <div className="px-6 py-5 space-y-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Payable</p>
                    <p className="font-bold text-gray-900">{money(paySummary.payable)}</p>
                  </div>
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">Paid</p>
                    <p className="font-bold text-gray-900">{money(paySummary.paid)}</p>
                  </div>
                  <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">Balance</p>
                    <p className="font-bold text-gray-900">{money(paySummary.balance)}</p>
                  </div>
                </div>
                <div>
                  <Label>Payment Amount (₱)</Label>
                  <Input type="number" step="0.01" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="0.00" autoFocus />
                </div>
                <div>
                  <Label>Note (optional)</Label>
                  <Input value={payNote} onChange={e => setPayNote(e.target.value)} placeholder="e.g. GCash reference" />
                </div>
                <p className="text-xs text-gray-500">Balance after this payment: <span className="font-bold text-gray-900">{money(remainingAfter)}</span></p>
              </div>
              <div className="flex gap-3 px-6 py-5 border-t border-gray-100 bg-gray-50">
                <button onClick={() => setPayModal(null)} className="flex-[2] h-12 rounded-xl bg-white border border-gray-300 text-gray-900 font-medium hover:bg-gray-100 transition-all">Cancel</button>
                <button onClick={savePayment} disabled={savingPay} className="flex-[3] h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-all disabled:opacity-50">
                  {savingPay ? "Saving..." : "Record Payment"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Payment history modal */}
      <AnimatePresence>
        {historyModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setHistoryModal(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
              <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 rounded-xl"><Receipt className="w-5 h-5 text-slate-600" /></div>
                  <h2 className="text-lg font-bold text-gray-800">Payments — {historyModal.username}</h2>
                </div>
                <button onClick={() => setHistoryModal(null)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"><X className="w-5 h-5 text-gray-400" /></button>
              </div>
              <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
                {summaryFor(historyModal).payments.length === 0 ? (
                  <p className="text-center py-10 text-gray-400">No payments recorded yet</p>
                ) : (
                  <div className="space-y-2">
                    {summaryFor(historyModal).payments.map(p => (
                      <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900">{money(p.amount)}</p>
                          <p className="text-xs text-gray-400">{formatDate(p.created_date || p.created_at)}{p.note ? ` · ${p.note}` : ""}</p>
                        </div>
                        <button onClick={() => removePayment(p)} className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors" title="Delete Payment"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 text-sm text-gray-600 flex items-center justify-between">
                <span>Total paid</span>
                <span className="font-bold text-gray-900">{money(summaryFor(historyModal).paid)}</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
