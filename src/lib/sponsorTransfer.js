import { assertPlacementMove } from "./genealogyPositions.js";

const SETUP_MESSAGE = "Genealogy database setup is outdated. Run supabase/migrations/012_change_sponsor_function.sql in the connected Supabase project's SQL Editor, then retry.";

function transferError(error) {
  if (["PGRST202", "PGRST204", "42703", "42883"].includes(error?.code)) {
    return new Error(SETUP_MESSAGE);
  }
  return new Error(error?.message || "Failed to change sponsor");
}

// Both admin edits and tree drags use the same atomic database operation.
// Read back the attachment so an outdated function cannot report a false success.
export async function transferSponsor(client, memberId, newSponsorId) {
  const sponsorId = newSponsorId || null;
  // Do not trust a cached tree or an older deployed change_sponsor function.
  // Reject an ancestor-to-descendant move before the database can save a cycle.
  const { data: placements, error: placementError } = await client.from("members")
    .select("id, placement_id");
  if (placementError) throw transferError(placementError);
  assertPlacementMove(placements || [], memberId, sponsorId);

  const { data, error } = await client.rpc("change_sponsor", {
    p_member_id: memberId,
    p_new_sponsor_id: sponsorId,
  });
  if (error) throw transferError(error);
  if (data?.success !== true) throw new Error("The database did not confirm the sponsor transfer. Refresh and try again.");

  const { data: member, error: readError } = await client.from("members")
    .select("id, referrer_id, placement_id").eq("id", memberId).single();
  if (readError) throw transferError(readError);
  if (!member || member.referrer_id !== sponsorId || member.placement_id !== sponsorId) {
    throw new Error("The saved genealogy attachment does not match the selected sponsor. Update the connected database with supabase/migrations/012_change_sponsor_function.sql.");
  }
  return data;
}
