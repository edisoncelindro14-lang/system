import test from "node:test";
import assert from "node:assert/strict";
import { placementParent, placementChildren, placementCycle, assertPlacementMove, planPositionSwap } from "./genealogyPositions.js";

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

test("moves reject self, direct-child and deep-descendant uplines before writing", () => {
  const tree = [member("root", null, 0), member("child", "root", 1), member("leaf", "child", 2)];
  for (const target of ["root", "child", "leaf"]) {
    assert.throws(() => assertPlacementMove(tree, "root", target), /own downline/);
  }
  assert.doesNotThrow(() => assertPlacementMove(tree, "leaf", "root"));
  assert.doesNotThrow(() => assertPlacementMove(tree, "root", null));
});

test("existing a-k and an-j loops cannot receive more members", () => {
  const tree = [member("a", "k", 2), member("k", "a", 3), member("an", "j", 0), member("j", "an", 1), member("leaf", "a", 4), member("other", null, 0)];
  assert.deepEqual(placementCycle(tree, "leaf"), ["a", "k"], "exclude members merely leading into a loop");
  assert.deepEqual(placementCycle(tree, "an"), ["an", "j"]);
  assert.deepEqual(placementCycle(tree, "other"), []);
  assert.throws(() => assertPlacementMove(tree, "other", "k"), /already has a circular/);
  assert.doesNotThrow(() => assertPlacementMove(tree, "a", null), "allow detaching out of a corrupt loop");
});

test("a moved username leaves its old placement, even with an unchanged referral sponsor", () => {
  const tree = [member("old", null, 0), member("new", null, 0), member("moved", "old", 1), member("leaf", "moved", 2)];
  assertPlacementMove(tree, "moved", "new");
  const moved = tree.map(m => m.id === "moved" ? { ...m, placement_id: "new" } : m);
  assert.deepEqual(placementChildren(moved, "old"), []);
  assert.deepEqual(placementChildren(moved, "new").map(m => m.id), ["moved"]);
  assert.deepEqual(placementChildren(moved, "moved").map(m => m.id), ["leaf"]);
});

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

function positions(members) {
  const result = new Map();
  function visit(parentId, path) {
    placementChildren(members, parentId).forEach((m, index) => {
      const slot = `${path}/${index + 1}`;
      result.set(slot, m.id);
      visit(m.id, slot);
    });
  }
  visit(null, "");
  return result;
}

function assertExactExchange(before, after, a, b) {
  const expected = new Map([...positions(before)].map(([slot, id]) => [slot, id === a ? b : id === b ? a : id]));
  assert.deepEqual(positions(after), expected, "every slot stays in place with only the two occupants exchanged");
  assert.deepEqual(positions([...after].reverse()), expected, "slots survive unordered database refetches");
  validTree(after);
}

test("K and Mike exchange their exact sibling slots even without children", () => {
  const tree = [member("root", null, 0), member("first", "root", 1), member("k", "root", 1), member("mike", "root", 1), member("last", "root", 1)]
    .map((m, index) => ({ ...m, created_at: `2026-10-15T00:00:0${index}Z` }));
  const after = swap(tree, "k", "mike");
  assertExactExchange(tree, after, "k", "mike");
  assertExactExchange(after, swap(after, "k", "mike"), "k", "mike");
});

test("crossline swaps retain exact slots and existing neighbor positions", () => {
  const tree = [member("root", null, 0),
    member("left", "root", 1, { placement_order: 1 }), member("right", "root", 1, { placement_order: 2 }),
    member("neighbor", "left", 2, { placement_order: 1 }), member("k", "left", 2, { placement_order: 4 }),
    member("mike", "right", 2, { placement_order: 2 }), member("other", "right", 2),
    member("k-child", "k", 3), member("mike-child", "mike", 3)];
  assertExactExchange(tree, swap(tree, "k", "mike"), "k", "mike");
});

for (const [a, b] of [["ben", "an"], ["an", "ben"], ["ben", "middle"], ["root", "leaf"]]) {
  test(`ancestor swap ${a} / ${b} keeps every exact slot`, () => {
    const tree = [...chain, member("neighbor", "root", 1), member("side", "middle", 3)];
    assertExactExchange(tree, swap(tree, a, b), a, b);
  });
}

test("placement slots do not exchange identity, sponsors, balances, or account dates", () => {
  const tree = [member("root", null, 0), member("k", "root", 1, { username: "k", available_balance: 123, created_at: "2026-01-01", maintenance_override: "green" }),
    member("mike", "root", 1, { username: "mike", available_balance: 456, created_at: "2026-02-01", maintenance_override: "red" })];
  const after = swap(tree, "k", "mike");
  for (const m of after) {
    const original = tree.find(old => old.id === m.id);
    for (const key of ["username", "referrer_id", "available_balance", "created_at", "maintenance_override"]) {
      assert.equal(m[key], original[key], `${key} stays with the member`);
    }
  }
});
