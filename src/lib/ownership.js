export const OWNERSHIP_TOTAL_KEY = "ownership_total_amount";
export const OWNERSHIP_DISCOUNT_KEY = "ownership_discount_amount";

export const OWNERSHIP_STATUS = {
  unpaid: { label: "Unpaid", color: "bg-gray-100 text-gray-700" },
  partial: { label: "In Progress", color: "bg-amber-100 text-amber-700" },
  paid: { label: "Fully Paid", color: "bg-emerald-100 text-emerald-700" },
};

export function settingAmount(settings = [], key, fallback = 0) {
  const row = settings.find(s => s.setting_key === key);
  const value = Number(row?.setting_value);
  return Number.isFinite(value) ? value : fallback;
}

// Per-member override row (public.ownership_accounts) for one member, if any.
export function accountFor(accounts = [], memberId) {
  return accounts.find(a => a.member_id === memberId) || null;
}

// An override amount, or null when the member inherits the system setting.
export function overrideAmount(account, field) {
  if (!account) return null;
  const raw = account[field];
  if (raw === null || raw === undefined || raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

// A redeemed code pays part of the ownership. Codes redeemed before payment
// recording existed (or whose payment insert was rejected) still count, unless a
// payment whose note names that code already exists — so nothing counts twice.
function codePayments(memberId, recordedPayments = [], codes = []) {
  const notes = recordedPayments.map(p => p.note || "");
  return codes
    .filter(c => c.is_used && c.used_by_member_id === memberId && Number(c.amount) > 0)
    .filter(c => !notes.some(note => note.includes(c.code)))
    .map(c => ({
      id: `code:${c.id}`,
      amount: Number(c.amount),
      note: `Maintenance code ${c.code}`,
      created_date: c.used_at,
      from_code: true,
    }));
}

// Ownership totals for one member. The payable amount is the total minus the
// discount; payments reduce the remaining balance. Per-member overrides win
// over the system settings, and the next payment defaults to the balance.
export function ownershipSummary(memberId, payments = [], settings = [], account = null, codes = []) {
  const total = overrideAmount(account, "total_amount") ?? settingAmount(settings, OWNERSHIP_TOTAL_KEY);
  const discount = overrideAmount(account, "discount") ?? settingAmount(settings, OWNERSHIP_DISCOUNT_KEY);
  const payable = Math.max(0, total - discount);
  const recorded = payments.filter(p => p.member_id === memberId);
  const mine = [...recorded, ...codePayments(memberId, recorded, codes)]
    .sort((a, b) => new Date(b.created_date || b.created_at) - new Date(a.created_date || a.created_at));
  const paid = mine.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const balance = Math.max(0, payable - paid);
  const nextPayment = overrideAmount(account, "next_payment_amount") ?? balance;
  const nextPaymentDue = account?.next_payment_due || null;
  const percent = payable > 0 ? Math.min(100, (paid / payable) * 100) : 0;
  const status = paid <= 0 ? "unpaid" : balance <= 0 ? "paid" : "partial";
  return {
    total, discount, payable, paid, balance, nextPayment, nextPaymentDue, percent, status,
    hasCustomTotal: overrideAmount(account, "total_amount") !== null,
    hasCustomDiscount: overrideAmount(account, "discount") !== null,
    payments: mine, lastPayment: mine[0] || null,
  };
}
