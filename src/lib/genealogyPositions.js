// Placement is determined by placement_id. A null placement_id means the member
// is not in the tree (a lobby/orphan member) — do NOT fall back to referrer_id,
// which would create phantom copies under the old sponsor after a move.
// An approved level-zero member is a placement root, even when they retain a sponsor.
export function placementParent(member) {
  if (member.placement_id) return member.placement_id;
  if (member.status === "approved" && member.tree_level === 0) return null;
  return null;
}

// Follow the proposed upline using placement links only. Validate fresh database
// data before a move, even when an external database still has an older RPC.
export function assertPlacementMove(members, memberId, newParentId) {
  const byId = new Map(members.map(member => [member.id, member]));
  if (!byId.has(memberId)) throw new Error("Member not found");
  const visited = new Set();
  let parentId = newParentId;
  while (parentId) {
    if (parentId === memberId) {
      throw new Error("Cannot move a member under themselves or their own downline. This would copy the old upline into a circular placement.");
    }
    if (visited.has(parentId)) {
      throw new Error("The selected upline already has a circular placement. Repair its placement before moving members into it.");
    }
    visited.add(parentId);
    const parent = byId.get(parentId);
    if (!parent) throw new Error("The selected upline could not be verified. Refresh and try again.");
    parentId = placementParent(parent);
  }
}

// Return only the members in a corrupt loop, excluding members leading into it.
export function placementCycle(members, startId) {
  const byId = new Map(members.map(member => [member.id, member]));
  const path = [];
  const indexes = new Map();
  let current = byId.get(startId);
  while (current) {
    if (indexes.has(current.id)) return path.slice(indexes.get(current.id));
    indexes.set(current.id, path.length);
    path.push(current.id);
    current = byId.get(placementParent(current));
  }
  return [];
}

// Persisted slot order wins; older members have a stable chronological fallback.
export function placementChildren(members, parentId) {
  return members.filter(member => placementParent(member) === parentId).sort((a, b) => {
    const orderA = a.placement_order ?? Infinity;
    const orderB = b.placement_order ?? Infinity;
    if (orderA !== orderB) return orderA < orderB ? -1 : 1;
    const dateOrder = (a.created_date || a.created_at || "").localeCompare(b.created_date || b.created_at || "");
    return dateOrder || a.id.localeCompare(b.id);
  });
}

// Exchange two positions, not just their incoming links: reconnect children too.
// This works for full nodes, roots, siblings, and ancestors at any distance,
// without circular links, extra slots, or changes to referral sponsors.
export function planPositionSwap(members, sourceId, targetId) {
  const byId = new Map(members.map(member => [member.id, member]));
  if (!byId.has(sourceId) || !byId.has(targetId)) throw new Error("Member not found");
  if (sourceId === targetId) return [];

  const exchange = id => id === sourceId ? targetId : id === targetId ? sourceId : id;
  const parents = new Map(members.map(member => [exchange(member.id), exchange(placementParent(member))]));
  const children = new Map(members.map(member => [member.id, []]));
  for (const [id, parentId] of parents) {
    children.get(parentId)?.push(id);
  }

  const levels = new Map();
  const queue = members.filter(member => !byId.has(parents.get(member.id)))
    .map(member => ({ id: member.id, level: 0 }));
  for (let i = 0; i < queue.length; i++) {
    const { id, level } = queue[i];
    if (levels.has(id)) continue;
    levels.set(id, level);
    children.get(id).forEach(childId => queue.push({ id: childId, level: level + 1 }));
  }
  if (!levels.has(sourceId) || !levels.has(targetId)) {
    throw new Error("The existing tree contains a circular link and needs repair before swapping");
  }

  const sourceParent = placementParent(byId.get(sourceId));
  const targetParent = placementParent(byId.get(targetId));
  // Normalize only the two original sibling groups, then exchange slot owners.
  // Saving their neighbors too prevents legacy (unordered) members shifting on refetch.
  const slotOrders = new Map();
  const approved = members.filter(member => member.status === "approved");
  for (const parentId of new Set([sourceParent, targetParent])) {
    placementChildren(approved, parentId).forEach((member, index) => {
      slotOrders.set(exchange(member.id), index + 1);
    });
  }
  const affectedRoots = new Set([sourceId, targetId]);
  const affected = [sourceId, targetId];
  for (let i = 0; i < affected.length; i++) {
    children.get(affected[i]).forEach(id => {
      if (!affectedRoots.has(id)) { affectedRoots.add(id); affected.push(id); }
    });
  }
  if (sourceParent) affectedRoots.add(sourceParent);
  if (targetParent) affectedRoots.add(targetParent);

  return members.filter(member => affectedRoots.has(member.id) || slotOrders.has(member.id)).flatMap(member => {
    const updates = {};
    if (slotOrders.has(member.id) && member.placement_order !== slotOrders.get(member.id)) {
      updates.placement_order = slotOrders.get(member.id);
    }
    const parentId = parents.get(member.id);
    if (parentId !== placementParent(member)) updates.placement_id = parentId;
    if (levels.has(member.id) && member.tree_level !== levels.get(member.id)) {
      updates.tree_level = levels.get(member.id);
    }
    const count = children.get(member.id).filter(id => byId.get(id).status === "approved").length;
    if (member.direct_downlines_count !== count) updates.direct_downlines_count = count;
    return Object.keys(updates).length ? [{ id: member.id, updates }] : [];
  });
}
