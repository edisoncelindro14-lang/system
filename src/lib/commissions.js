import { supabase } from "./supabase";
import { maintenanceStatus, LEVEL_CONFIG, MAX_BONUS_LEVEL } from "./helpers";

/**
 * Distribute upline commissions when a member is placed.
 * If the member already redeemed a maintenance code while in the lobby,
 * all uplines (referrer chain, up to 5 levels) receive their level bonus
 * at the moment of placement.
 *
 * @param {object} member       - The member being placed (must have referrer_id set)
 * @param {array}  allMembers   - All members (freshly fetched)
 * @param {array}  allCodes     - All maintenance codes (freshly fetched)
 * @returns {number}            - Number of bonuses distributed
 */
export async function distributePlacementCommissions(member, allMembers, allCodes) {
  if (!member || !member.referrer_id) return 0;

  // Check if the member has redeemed at least one maintenance code
  const hasRedeemed = (allCodes || []).some(
    c => c.is_used && c.used_by_member_id === member.id && c.used_at
  );
  if (!hasRedeemed) return 0;

  const canEarn = (m) => {
    if (!m || m.status !== "approved") return false;
    return maintenanceStatus(m, allCodes).isGreen;
  };

  let distributed = 0;
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
        distributed++;
      }
    }
    current = upline;
  }

  return distributed;
}
