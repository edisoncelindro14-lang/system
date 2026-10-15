import test from "node:test";
import assert from "node:assert/strict";
import { placementParent, planPositionSwap } from "./genealogyPositions.js";

function member(id, parent, level, extra = {}) {
  return { id, placement_id: parent, referrer_id: parent, tree_level: level, status: "approved", direct_downlines_count: 0, ...extra };
}
function swap(members, a, b) {
  const updates = new Map(planPositionSwap(members, a, b).map(change => [change.id, change.updates]));
  return members.map(m => ({ ...m, ...updates.get(m.id) }));
}
function validTree(members) {
  const byId = new Map(members.map(m => [m.id, m]));
  for (const m of members) {
    const visited = new Set([m.id]);
    let current = m;
    while (placementParent(current)) {
      const parent = byId.get(placementParent(current));
      assert.ok(parent, "parent exists");
      assert.ok(!visited.has(parent.id), "no cycle");
      assert.equal(current.tree_level, parent.tree_level + 1, "correct depth");
      visited.add(parent.id);
      current = parent;
    }
  }
}

const chain = [member("root", null, 0), member("ben", "root", 1), member("middle", "ben", 2), member("an", "middle", 3), member("leaf", "an", 4)];
for (const [a, b] of [["ben", "an"], ["an", "ben"], ["ben", "middle"], ["middle", "ben"], ["root", "an"]]) {
  test(`unrestricted position swap ${a} to ${b}`, () => {
    const before = structuredClone(chain);
    const after = swap(chain, a, b);
    validTree(after);
    assert.equal(after.find(m => m.id === a).tree_level, before.find(m => m.id === b).tree_level);
    assert.equal(after.find(m => m.id === b).tree_level, before.find(m => m.id === a).tree_level);
    assert.deepEqual(chain, before, "planning does not mutate input");
    for (const m of after) assert.equal(m.referrer_id, before.find(old => old.id === m.id).referrer_id, "sponsors preserved");
    assert.equal(new Set(after.map(m => m.id)).size, chain.length);
  });
}

test("full parent and child can exchange all eight slots without overflow", () => {
  const tree = [member("root", null, 0), member("ben", "root", 1, { direct_downlines_count: 8 }), member("an", "ben", 2, { direct_downlines_count: 8 }),
    ...Array.from({ length: 7 }, (_, i) => member(`sibling${i}`, "ben", 2)),
    ...Array.from({ length: 8 }, (_, i) => member(`child${i}`, "an", 3))];
  const after = swap(tree, "ben", "an");
  validTree(after);
  for (const id of ["ben", "an"]) {
    assert.equal(after.filter(m => placementParent(m) === id).length, 8);
    assert.equal(after.find(m => m.id === id).direct_downlines_count, 8);
  }
});

test("crossline swaps preserve position depths and children", () => {
  const tree = [...chain, member("cross", "root", 1), member("crossleaf", "cross", 2)];
  const after = swap(tree, "an", "cross");
  validTree(after);
  assert.equal(placementParent(after.find(m => m.id === "leaf")), "cross");
  assert.equal(placementParent(after.find(m => m.id === "crossleaf")), "an");
  assert.equal(after.find(m => m.id === "an").tree_level, 1);
  assert.equal(after.find(m => m.id === "cross").tree_level, 3);
});

test("legacy referral-based placement and same-member no-op", () => {
  const tree = chain.map(m => ({ ...m, placement_id: null }));
  validTree(swap(tree, "ben", "an"));
  assert.deepEqual(planPositionSwap(tree, "ben", "ben"), []);
});

test("missing members fail before any updates", () => {
  assert.throws(() => planPositionSwap(chain, "ben", "missing"), /Member not found/);
});
