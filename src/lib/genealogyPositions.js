// An approved level-zero member is a placement root, even when they retain a sponsor.
export function placementParent(member) {
  if (member.placement_id) return member.placement_id;
  if (member.status === "approved" && member.tree_level === 0) return null;
  return member.referrer_id || null;
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
  const affectedRoots = new Set([sourceId, targetId]);
  const affected = [sourceId, targetId];
  for (let i = 0; i < affected.length; i++) {
    children.get(affected[i]).forEach(id => {
      if (!affectedRoots.has(id)) { affectedRoots.add(id); affected.push(id); }
    });
  }
  if (sourceParent) affectedRoots.add(sourceParent);
  if (targetParent) affectedRoots.add(targetParent);

  return members.filter(member => affectedRoots.has(member.id)).flatMap(member => {
    const updates = {};
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
