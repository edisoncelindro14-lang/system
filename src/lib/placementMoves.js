import { assertPlacementMove, placementChildren, placementParent } from "./genealogyPositions.js";

// Compatibility with already-deployed change_sponsor functions: lift a target
// out of the old chain BEFORE attaching the member. Only placement changes on
// the lifted upline; its referral sponsor and account data are preserved.
export function planUplineDetachment(members, memberId, newParentId) {
  assertPlacementMove(members, memberId, newParentId);
  const byId = new Map(members.map(member => [member.id, member]));
  const visited = new Set();
  let id = newParentId;
  let needsDetachment = false;
  while (id) {
    if (id === memberId || visited.has(id)) {
      needsDetachment = true;
      break;
    }
    visited.add(id);
    const parent = byId.get(id);
    if (!parent) throw new Error("The selected upline could not be verified. Refresh and try again.");
    id = placementParent(parent);
  }
  if (!needsDetachment) return [];

  const target = byId.get(newParentId);
  const changes = new Map([[target.id, { placement_id: null, placement_order: null, tree_level: 0 }]]);
  const detached = members.map(member => member.id === target.id ? { ...member, placement_id: null } : member);
  const queue = [{ id: target.id, level: 0 }];
  const seen = new Set();
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    if (seen.has(current.id)) continue;
    seen.add(current.id);
    const member = byId.get(current.id);
    if (member.tree_level !== current.level) {
      changes.set(member.id, { ...changes.get(member.id), tree_level: current.level });
    }
    placementChildren(detached, current.id).forEach(child => queue.push({ id: child.id, level: current.level + 1 }));
  }
  const oldParent = byId.get(target.placement_id);
  if (oldParent) {
    const siblings = placementChildren(detached.filter(member => member.status === "approved"), oldParent.id);
    changes.set(oldParent.id, { ...changes.get(oldParent.id), direct_downlines_count: siblings.length });
    siblings.forEach((member, index) => {
      if (member.placement_order !== index + 1) {
        changes.set(member.id, { ...changes.get(member.id), placement_order: index + 1 });
      }
    });
  }
  return [...changes].map(([id, updates]) => ({ id, updates }));
}
