import test from "node:test";
import assert from "node:assert/strict";
import {
  placementParent,
  placementChildren,
  placementCycle,
  assertPlacementMove,
  planPositionSwap,
} from "./genealogyPositions.js";
import { planUplineDetachment } from "./placementMoves.js";

// ────────────────────────────────────────────────────────────────────────────
// PLACEMENT INVARIANTS
//
// These tests lock the core principles of the placement system so that edits
// or merges from other branches cannot silently change the behaviour. Every
// principle below MUST hold after any change. If a test here fails, the change
// is wrong — fix the change, not the test.
// ────────────────────────────────────────────────────────────────────────────

function member(id, placement_id, tree_level, extra = {}) {
  return {
    id,
    placement_id,
    referrer_id: placement_id,
    tree_level,
    status: "approved",
    direct_downlines_count: 0,
    placement_order: 1,
    ...extra,
  };
}

function applyChanges(members, changes) {
  const map = new Map(changes.map(c => [c.id, c.updates]));
  return members.map(m => ({ ...m, ...map.get(m.id) }));
}

// ── Principle 1: placement is derived ONLY from placement_id ───────────────

test("INV-1: placementParent never falls back to referrer_id", () => {
  const m = member("x", null, 1, { referrer_id: "sponsor", status: "approved" });
  assert.equal(placementParent(m), null, "a null placement_id means no placement parent, even with a referrer");
  const rooted = member("y", null, 0, { referrer_id: "sponsor" });
  assert.equal(placementParent(rooted), null, "a level-zero root has no placement parent");
  const placed = member("z", "parent", 1);
  assert.equal(placementParent(placed), "parent");
});

// ── Principle 2: any existing member can be a new upline; no blocking ──────

test("INV-2: assertPlacementMove allows any member except self", () => {
  const tree = [member("root", null, 0), member("child", "root", 1), member("leaf", "child", 2)];
  for (const target of ["child", "leaf", null]) {
    assert.doesNotThrow(() => assertPlacementMove(tree, "root", target));
  }
  assert.throws(() => assertPlacementMove(tree, "root", "root"), /themselves/);
  assert.throws(() => assertPlacementMove(tree, "root", "ghost"), /not found/);
});

// ── Principle 3: a move replaces the old attachment; no duplicate copies ───

test("INV-3: a moved member detaches from its old parent automatically", () => {
  const tree = [member("old", null, 0), member("new", null, 0), member("moved", "old", 1), member("leaf", "moved", 2)];
  const moved = tree.map(m => (m.id === "moved" ? { ...m, placement_id: "new" } : m));
  assert.deepEqual(placementChildren(moved, "old"), [], "old parent has no children after move");
  assert.deepEqual(placementChildren(moved, "new").map(m => m.id), ["moved"], "new parent has the moved member");
  assert.equal(moved.length, tree.length, "no duplicate member rows created");
});

// ── Principle 4: sponsors are preserved; only placement changes ────────────

test("INV-4: a placement change never alters referrer_id", () => {
  const tree = [member("root", null, 0), member("child", "root", 1), member("leaf", "child", 2)];
  const before = structuredClone(tree);
  const swap = applyChanges(tree, planPositionSwap(tree, "child", "leaf"));
  for (const m of swap) {
    assert.equal(m.referrer_id, before.find(o => o.id === m.id).referrer_id, "sponsor unchanged");
  }
});

// ── Principle 5: no circular placement links after any operation ────────────

test("INV-5: planUplineDetachment produces a cycle-free graph", () => {
  const tree = [member("root", null, 0), member("child", "root", 1), member("leaf", "child", 2), member("side", "leaf", 3)];
  const after = applyChanges(tree, planUplineDetachment(tree, "root", "leaf"));
  for (const m of after) assert.deepEqual(placementCycle(after, m.id), [], "no cycle");
});

test("INV-5b: planPositionSwap produces a cycle-free graph", () => {
  const chain = [member("root", null, 0), member("a", "root", 1), member("b", "a", 2), member("c", "b", 3)];
  for (const [x, y] of [["a", "c"], ["c", "a"], ["root", "c"]]) {
    const after = applyChanges(chain, planPositionSwap(chain, x, y));
    for (const m of after) assert.deepEqual(placementCycle(after, m.id), [], `no cycle after swap ${x}/${y}`);
  }
});

// ── Principle 6: planning never mutates the input data ──────────────────────

test("INV-6: planning functions do not mutate their input", () => {
  const tree = [member("root", null, 0), member("child", "root", 1), member("leaf", "child", 2)];
  const before = structuredClone(tree);
  planUplineDetachment(tree, "root", "leaf");
  planPositionSwap(tree, "child", "leaf");
  assert.deepEqual(tree, before, "input array untouched");
});

// ── Principle 7: tree levels stay consistent with parent depth ──────────────

test("INV-7: tree_level equals parent tree_level + 1 after a swap", () => {
  const chain = [member("root", null, 0), member("a", "root", 1), member("b", "a", 2), member("c", "b", 3)];
  const after = applyChanges(chain, planPositionSwap(chain, "a", "c"));
  const byId = new Map(after.map(m => [m.id, m]));
  for (const m of after) {
    const parentId = placementParent(m);
    const expected = parentId ? byId.get(parentId).tree_level + 1 : 0;
    assert.equal(m.tree_level, expected, `${m.id} depth correct`);
  }
});
