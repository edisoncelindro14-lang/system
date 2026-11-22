import { supabase } from "./supabase";
import { maintenanceStatus, LEVEL_CONFIG, MAX_BONUS_LEVEL } from "./helpers";
import { getSessionMemberId } from "./auth";
import { OWNERSHIP_TOTAL_KEY, OWNERSHIP_DISCOUNT_KEY } from "./ownership";

// A redeemed code pays part of the system ownership: its amount is recorded in
// the member's payment history and deducted from the system ownership total,
// while its discount is added to the system discount so the payable drops too.
export async function applyCodeOwnership(memberId, codeRecord, recordedBy = null) {
  const amount = Number(codeRecord.amount || 0);
  const discount = Number(codeRecord.discount || 0);
  if (!(amount > 0) && !(discount > 0)) return;

  if (amount > 0) {
    const { error } = await supabase.from("ownership_payments").insert({
      member_id: memberId,
      amount,
      note: `Maintenance code ${codeRecord.code}${discount > 0 ? ` (discount ${discount})` : ""}`,
      recorded_by: recordedBy,
    });
    if (error) console.error("Ownership payment insert failed:", error);
  }

  const { data: rows } = await supabase
    .from("system_settings")
    .select("id, setting_key, setting_value")
    .in("setting_key", [OWNERSHIP_TOTAL_KEY, OWNERSHIP_DISCOUNT_KEY]);
  const totalRow = (rows || []).find(r => r.setting_key === OWNERSHIP_TOTAL_KEY);
  const discountRow = (rows || []).find(r => r.setting_key === OWNERSHIP_DISCOUNT_KEY);

  const writes = [];
  if (amount > 0 && totalRow) {
    const remaining = Math.max(0, Number(totalRow.setting_value || 0) - amount);
    writes.push(supabase.from("system_settings").update({ setting_value: String(remaining) }).eq("id", totalRow.id));
  }
  if (discount > 0) {
    const nextDiscount = Number(discountRow?.setting_value || 0) + discount;
    writes.push(discountRow
      ? supabase.from("system_settings").update({ setting_value: String(nextDiscount) }).eq("id", discountRow.id)
      : supabase.from("system_settings").insert({ setting_key: OWNERSHIP_DISCOUNT_KEY, setting_value: String(nextDiscount) }));
  }
  await Promise.all(writes);

  window.dispatchEvent(new CustomEvent("ownership_changed"));
}

// Redeem a maintenance code directly (used by CodeCabinet shortcut + Dashboard)
export async function redeemCode(codeRecord, currentMember, allMembers, allCodes) {
  if (codeRecord.assigned_username && codeRecord.assigned_username !== currentMember.username) {
    throw new Error(`This code is assigned to @${codeRecord.assigned_username}`);
  }

  // Mark code as used
  const writes = [supabase
    .from("maintenance_codes")
    .update({
      is_used: true,
      used_by_member_id: currentMember.id,
      used_at: new Date().toISOString(),
    })
    .eq("id", codeRecord.id)];

  // Clear any manual override so the redeemed code drives maintenance status
  writes.push(supabase
    .from("members")
    .update({ maintenance_override: null })
    .eq("id", currentMember.id));

  // Record transaction for the user
  writes.push(supabase.from("transactions").insert({
    member_id: currentMember.id,
    type: "maintenance_code",
    amount: Number(codeRecord.amount || 0),
    description: `Redeemed maintenance code: ${codeRecord.code}`,
    status: "completed",
  }));

  // Record in code_redemption_history (for both store and user)
  writes.push(supabase.from("code_redemption_history").insert({
    code_id: codeRecord.id,
    code: codeRecord.code,
    redeemed_by_member_id: currentMember.id,
    redeemed_by_username: currentMember.username,
    store_member_id: codeRecord.generated_by_store_id || null,
    redeemed_at: new Date().toISOString(),
    status: "completed",
  }));

  // Fetch fresh data so upline maintenance status is accurate
  await Promise.all(writes);
  await applyCodeOwnership(currentMember.id, codeRecord);
  const [{ data: freshMembers }, { data: freshCodes }] = await Promise.all([
    supabase.from("members").select("*"),
    supabase.from("maintenance_codes").select("*"),
  ]);

  const freshMember = (freshMembers || allMembers).find(m => m.id === currentMember.id);
  if (freshMember && freshMember.status !== "approved") {
    return { message: "Code redeemed. You must be placed under an upline before commissions are distributed." };
  }

  await distributeUplineBonuses(currentMember, freshMembers || allMembers, freshCodes || allCodes);
  return { message: "Code redeemed successfully! Upline bonuses distributed." };
}

// Redeem a code on behalf of a specific member (used by Admin and Store)
export async function redeemCodeForMember(codeRecord, member, allMembers, allCodes) {
  if (codeRecord.assigned_username && codeRecord.assigned_username !== member.username) {
    throw new Error(`This code is assigned to @${codeRecord.assigned_username}`);
  }

  const writes = [supabase
    .from("maintenance_codes")
    .update({
      is_used: true,
      used_by_member_id: member.id,
      used_at: new Date().toISOString(),
    })
    .eq("id", codeRecord.id)];

  // Clear any manual override so the redeemed code drives maintenance status
  writes.push(supabase
    .from("members")
    .update({ maintenance_override: null })
    .eq("id", member.id));

  writes.push(supabase.from("transactions").insert({
    member_id: member.id,
    type: "maintenance_code",
    amount: Number(codeRecord.amount || 0),
    description: `Redeemed maintenance code: ${codeRecord.code}`,
    status: "completed",
  }));

  writes.push(supabase.from("code_redemption_history").insert({
    code_id: codeRecord.id,
    code: codeRecord.code,
    redeemed_by_member_id: member.id,
    redeemed_by_username: member.username,
    store_member_id: codeRecord.generated_by_store_id || null,
    redeemed_at: new Date().toISOString(),
    status: "completed",
  }));

  await Promise.all(writes);
  await applyCodeOwnership(member.id, codeRecord, getSessionMemberId() || null);
  const [{ data: freshMembers }, { data: freshCodes }] = await Promise.all([
    supabase.from("members").select("*"),
    supabase.from("maintenance_codes").select("*"),
  ]);
  const allM = freshMembers || allMembers;
  const allC = freshCodes || allCodes;

  const freshMember = allM.find(m => m.id === member.id);
  if (freshMember && freshMember.status !== "approved") {
    return { message: "Code redeemed. Member must be placed under an upline before commissions are distributed." };
  }

  await distributeUplineBonuses(member, allM, allC);
  return { message: "Code redeemed successfully! Upline bonuses distributed." };
}

// Every code a downline redeems pays each upline within 6 levels that level's
// bonus (LEVEL_CONFIG), walking up the referral chain. Shared by self-redeem,
// store redeem, admin redeem and placement.
export async function distributeUplineBonuses(member, allMembers, allCodes) {
  const canEarn = (m) => {
    if (!m || m.status !== "approved") return false;
    const status = maintenanceStatus(m, allCodes);
    return status.isGreen;
  };

  const bonusWrites = [];
  const paidMembers = new Set();
  let current = member;
  for (let level = 1; level <= MAX_BONUS_LEVEL; level++) {
    const upline = allMembers.find(m => m.id === current.referrer_id);
    if (!upline) break;
    if (canEarn(upline) && !paidMembers.has(upline.id)) {
      paidMembers.add(upline.id);
      const bonus = LEVEL_CONFIG.find(l => l.level === level)?.bonus_amount || 0;
      if (bonus > 0) {
        bonusWrites.push(supabase.from("transactions").insert({
          member_id: upline.id,
          type: "referral_bonus",
          amount: bonus,
          bonus_level: level,
          description: `Level ${level} bonus from ${member.username}`,
          status: "completed",
          from_member_id: member.id,
        }));
      }
    }
    current = upline;
  }
  await Promise.all(bonusWrites);
  return bonusWrites.length;
}
