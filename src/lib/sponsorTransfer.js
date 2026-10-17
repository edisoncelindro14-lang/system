import { placementCycle } from "./genealogyPositions.js";
import { planUplineDetachment } from "./placementMoves.js";

const SETUP_MESSAGE = "Genealogy database setup is outdated. Run supabase/migrations/012_change_sponsor_function.sql in the connected Supabase project's SQL Editor, then retry.";
const PLACEMENT_FIELDS = "id, referrer_id, placement_id, placement_order, tree_level, status, direct_downlines_count, created_date";

function transferError(error) {
  if (["PGRST202", "PGRST204", "42703", "42883"].includes(error?.code)) {
    return new Error(SETUP_MESSAGE);
  }
  return new Error(error?.message || "Failed to change sponsor");
}

// Conditional writes keep a stale preparation/rollback from overwriting a newer
// edit. RLS/permission failures are never bypassed. The current SQL performs the
// same detachment atomically; preparation also supports older deployed RPCs.
async function writePlacement(client, id, updates, expected) {
  let query = client.from("members").update(updates).eq("id", id);
  for (const [key, value] of Object.entries(expected)) {
    query = value == null ? query.is(key, null) : query.eq(key, value);
  }
  const { data, error } = await query.select("id").single();
  if (error) throw transferError(error);
  if (!data) throw new Error("Placement changed during this move. Refresh and try again.");
}

// Both admin edits and tree drags replace the existing attachment, never insert
// a member. Lift a descendant target first rather than block the requested move.
export async function transferSponsor(client, memberId, newSponsorId) {
  const sponsorId = newSponsorId || null;
  const { data: placements, error: placementError } = await client.from("members").select(PLACEMENT_FIELDS);
  if (placementError) throw transferError(placementError);
  const preparation = planUplineDetachment(placements || [], memberId, sponsorId);
  const applied = [];
  let data;
  let rpcAttempted = false;
  let rpcRejected = false;
  try {
    for (const { id, updates } of preparation) {
      const original = placements.find(member => member.id === id);
      const previous = Object.fromEntries(Object.keys(updates).map(key => [key, original[key] ?? null]));
      await writePlacement(client, id, updates, previous);
      applied.push({ id, updates, previous });
    }
    rpcAttempted = true;
    const result = await client.rpc("change_sponsor", {
      p_member_id: memberId,
      p_new_sponsor_id: sponsorId,
    });
    if (result.error) {
      rpcRejected = !!result.error.code;
      throw transferError(result.error);
    }
    if (result.data?.success !== true) throw new Error("The database did not confirm the sponsor transfer. Refresh and try again.");
    data = result.data;
  } catch (error) {
    // A lost response may hide a committed move. Reattaching the old target in
    // that case could recreate a loop; only roll back a known database rejection.
    if (rpcAttempted && !rpcRejected && applied.length) {
      throw new Error("The move's result could not be confirmed. Refresh and check the latest placement before retrying.");
    }
    let rollbackFailed = false;
    for (const { id, updates, previous } of applied.reverse()) {
      try { await writePlacement(client, id, previous, updates); }
      catch { rollbackFailed = true; }
    }
    if (rollbackFailed) throw new Error("The move was interrupted and its previous placement could not be fully restored. Refresh and check the tree.");
    throw error;
  }

  // Read the actual graph, not a cached/optimistic card, before reporting success.
  const { data: saved, error: readError } = await client.from("members").select(PLACEMENT_FIELDS);
  if (readError) throw transferError(readError);
  const member = saved?.find(member => member.id === memberId);
  if (!member || member.referrer_id !== sponsorId || member.placement_id !== sponsorId || placementCycle(saved, memberId).length) {
    throw new Error("The saved genealogy attachment does not match the selected sponsor. Refresh and try again.");
  }
  return { ...data, changed: data.changed !== false || preparation.length > 0 };
}
