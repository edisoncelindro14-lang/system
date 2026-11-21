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

// Ownership totals for one member. The payable amount is the system total
// minus the system discount; payments reduce the remaining balance.
export function ownershipSummary(memberId, payments = [], settings = []) {
  const total = settingAmount(settings, OWNERSHIP_TOTAL_KEY);
  const discount = settingAmount(settings, OWNERSHIP_DISCOUNT_KEY);
  const payable = Math.max(0, total - discount);
  const mine = payments
    .filter(p => p.member_id === memberId)
    .sort((a, b) => new Date(b.created_date || b.created_at) - new Date(a.created_date || a.created_at));
  const paid = mine.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const balance = Math.max(0, payable - paid);
  const percent = payable > 0 ? Math.min(100, (paid / payable) * 100) : 0;
  const status = paid <= 0 ? "unpaid" : balance <= 0 ? "paid" : "partial";
  return { total, discount, payable, paid, balance, percent, status, payments: mine, lastPayment: mine[0] || null };
}
