import test from "node:test";
import assert from "node:assert/strict";
import { planUplineDetachment } from "./placementMoves.js";
import { placementCycle } from "./genealogyPositions.js";

const member = (id, placement_id, tree_level) => ({ id, placement_id, tree_level, status: "approved", placement_order: 1, referrer_id: placement_id, direct_downlines_count: 0 });
function prepare(tree, source, target) {
  const changes = new Map(planUplineDetachment(tree, source, target).map(change => [change.id, change.updates]));
  return tree.map(member => ({ ...member, ...changes.get(member.id) }));
}

test("ordinary crossline moves require no detachment writes", () => {
  const tree = [member("a", null, 0), member("b", null, 0), member("child", "a", 1)];
  assert.deepEqual(planUplineDetachment(tree, "child", "b"), []);
  assert.deepEqual(planUplineDetachment(tree, "a", null), []);
});

for (const target of ["child", "leaf"]) {
  test(`lift ${target} before moving its ancestor without changing referral or account data`, () => {
    const tree = [member("root", null, 0), member("child", "root", 1), member("leaf", "child", 2), member("side", "leaf", 3)];
    const before = structuredClone(tree);
    const after = prepare(tree, "root", target);
    assert.equal(after.find(m => m.id === target).placement_id, null);
    assert.equal(after.find(m => m.id === target).tree_level, 0);
    for (const row of after) assert.equal(row.referrer_id, tree.find(m => m.id === row.id).referrer_id);
    assert.deepEqual(tree, before, "planning never mutates fetched data");
    for (const row of after) assert.deepEqual(placementCycle(after, row.id), []);
  });
}

test("an existing circular target is lifted instead of hidden or rejected", () => {
  const tree = [member("a", "k", 2), member("k", "a", 3), member("leaf", "a", 4), member("other", null, 0)];
  const after = prepare(tree, "other", "k");
  for (const row of after) assert.deepEqual(placementCycle(after, row.id), []);
  assert.equal(after.find(m => m.id === "k").tree_level, 0);
  assert.equal(after.find(m => m.id === "a").tree_level, 1);
  assert.equal(after.find(m => m.id === "leaf").tree_level, 2);
  assert.equal(after.find(m => m.id === "a").direct_downlines_count, 1);
});
