// Maintenance status: 12-hour green cycle after redeem, no timer for red banner
const MAINTENANCE_SECONDS = 43200; // 12 hours — green banner after redeem
const GRACE_SECONDS = 0; // no timer — red banner before first redeem

export function maintenanceStatus(member, codes = []) {
  if (!member) return { isGreen: false, secondsLeft: 0, neverRedeemed: true };

  if (member.maintenance_override === "green") {
    return { isGreen: true, secondsLeft: MAINTENANCE_SECONDS, neverRedeemed: false };
  }
  if (member.maintenance_override === "red") {
    return { isGreen: false, secondsLeft: 0, neverRedeemed: false };
  }

  if (member.maintenance_timer_seconds > 0 && member.maintenance_timer_set_at) {
    const elapsed = Math.floor((Date.now() - new Date(member.maintenance_timer_set_at).getTime()) / 1000);
    const left = member.maintenance_timer_seconds - elapsed;
    return { isGreen: left > 0, secondsLeft: Math.max(0, left), neverRedeemed: false };
  }

  // User has redeemed a code — GREEN with 12h countdown from last redeem
  const usedCodes = codes.filter(c => c.is_used && c.used_by_member_id === member.id && c.used_at);
  if (usedCodes.length > 0) {
    const lastUsed = usedCodes
      .map(c => new Date(c.used_at).getTime())
      .sort((a, b) => b - a)[0];
    const left = Math.max(0, MAINTENANCE_SECONDS - Math.floor((Date.now() - lastUsed) / 1000));
    return { isGreen: left > 0, secondsLeft: left, neverRedeemed: false };
  }

  // User has NOT redeemed — RED with no timer
  return { isGreen: false, secondsLeft: 0, neverRedeemed: true };
}

export function formatTime(seconds) {
  if (seconds <= 0) return "00:00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatGraceTime(seconds) {
  if (seconds <= 0) return "120:00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Withdrawal charge: ₱10 flat for ₱300-999, ₱15 per ₱1000 for ₱1000+
export function withdrawalCharge(amount, min) {
  if (amount < 1000) return 10;
  return Math.ceil(amount / 1000) * 15;
}

export const money = n => `₱${Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export function formatDate(date, fmt = "MMM d, yyyy h:mm a") {
  const d = new Date(date);
  if (isNaN(d)) return "";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const h12 = d.getHours() % 12 || 12;
  const ampm = d.getHours() >= 12 ? "PM" : "AM";
  return fmt
    .replace("MMM", months[d.getMonth()])
    .replace("yyyy", d.getFullYear())
    .replace("d,", `${d.getDate()},`)
    .replace("d", d.getDate())
    .replace("h:mm", `${h12}:${String(d.getMinutes()).padStart(2, "0")}`)
    .replace("a", ampm);
}

export const LEVEL_CONFIG = [
  { level: 1, label: "Level 1 — Direct Downlines", bonus_amount: 300, max_members: 8, description: "Earn ₱300 every time a downline who used your referral link redeems a maintenance code.", color: "from-amber-500 to-orange-600", bgColor: "bg-amber-50", borderColor: "border-amber-200", textColor: "text-amber-700" },
  { level: 2, label: "Level 2 — Downlines of Downlines", bonus_amount: 300, max_members: 64, description: "Earn ₱300 every time a Level 2 downline redeems a maintenance code.", color: "from-gray-800 to-black", bgColor: "bg-gray-50", borderColor: "border-gray-300", textColor: "text-gray-800" },
  { level: 3, label: "Level 3 — Third Generation", bonus_amount: 300, max_members: 512, description: "Earn ₱300 every time a Level 3 downline redeems a maintenance code.", color: "from-amber-600 to-amber-800", bgColor: "bg-amber-50", borderColor: "border-amber-200", textColor: "text-amber-700" },
  { level: 4, label: "Level 4 — Fourth Generation", bonus_amount: 300, max_members: 4096, description: "Earn ₱300 every time a Level 4 downline redeems a maintenance code.", color: "from-amber-700 to-amber-900", bgColor: "bg-amber-50", borderColor: "border-amber-200", textColor: "text-amber-700" },
  { level: 5, label: "Level 5 — Fifth Generation", bonus_amount: 300, max_members: 32768, description: "Earn ₱300 every time a Level 5 downline redeems a maintenance code.", color: "from-rose-500 to-red-600", bgColor: "bg-rose-50", borderColor: "border-rose-200", textColor: "text-rose-700" },
  { level: 6, label: "Level 6 — Sixth Generation", bonus_amount: 300, max_members: 262144, description: "Earn ₱300 every time a Level 6 downline redeems a maintenance code.", color: "from-indigo-500 to-purple-600", bgColor: "bg-indigo-50", borderColor: "border-indigo-200", textColor: "text-indigo-700" },
];

// All 6 levels pay out income when downlines redeem maintenance codes
export const MAX_BONUS_LEVEL = 6;

export const TRANSACTION_TYPES = {
  level_bonus: { label: "Level Bonus", color: "bg-emerald-100 text-emerald-700" },
  referral_bonus: { label: "Referral Bonus", color: "bg-blue-100 text-blue-700" },
  adjustment: { label: "Maintenance Code", color: "bg-teal-100 text-teal-700" },
  withdrawal: { label: "Withdrawal", color: "bg-red-100 text-red-700" },
  product_conversion: { label: "Product Wallet", color: "bg-purple-100 text-purple-700" },
};

export function generateReferralCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, b => chars[b % chars.length]).join("");
}
