import { distributeUplineBonuses } from "./redeem";

/**
 * Distribute upline commissions when a member is placed.
 * If the member already redeemed a maintenance code while in the lobby,
 * all uplines (referrer chain, up to 6 levels) receive their level bonus
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

  return distributeUplineBonuses(member, allMembers, allCodes);
}
