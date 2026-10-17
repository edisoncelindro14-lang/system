import test from "node:test";
import assert from "node:assert/strict";
import { transferSponsor } from "./sponsorTransfer.js";
import { placementChildren, placementCycle } from "./genealogyPositions.js";

const row = (id, placement_id = null, tree_level = 0) => ({ id, referrer_id: placement_id, placement_id, tree_level, status: "approved", placement_order: 1, direct_downlines_count: 0 });

// Emulate an older deployed RPC which does NOT protect against cycles. The
// production helper, including its real conditional writes, must prevent them.
function client(options = {}) {
  let rows = structuredClone(options.rows || [row("old"), row("sponsor"), row("member", "old", 1), row("leaf", "member", 2)]);
  const calls = [];
  let reads = 0;
  let writes = 0;
  return {
    calls,
    get rows() { return structuredClone(rows); },
    async rpc(name, params) {
      calls.push([name, params]);
      if (options.error || options.result === null) return { data: options.result ?? null, error: options.error };
      const member = rows.find(row => row.id === params.p_member_id);
      const target = rows.find(row => row.id === params.p_new_sponsor_id);
      const changed = member.placement_id !== (target?.id ?? null) || member.referrer_id !== (target?.id ?? null);
      if (!options.stale) {
        member.placement_id = member.referrer_id = target?.id ?? null;
        member.placement_order = target ? 99 : null;
        const queue = [{ id: member.id, level: target ? target.tree_level + 1 : 0 }];
        const seen = new Set();
        for (let i = 0; i < queue.length; i++) {
          const current = queue[i];
          if (seen.has(current.id)) continue;
          seen.add(current.id);
          rows.find(row => row.id === current.id).tree_level = current.level;
          placementChildren(rows, current.id).forEach(child => queue.push({ id: child.id, level: current.level + 1 }));
        }
        for (const parent of rows) {
          const children = placementChildren(rows, parent.id);
          parent.direct_downlines_count = children.length;
          children.forEach((child, index) => { child.placement_order = index + 1; });
        }
      }
      return { data: options.result || { success: true, changed }, error: null };
    },
    from(name) {
      calls.push(["from", name]);
      let updates;
      const filters = [];
      const query = {
        select(fields) { calls.push(["select", fields]); return this; },
        update(value) { updates = value; calls.push(["update", value]); return this; },
        eq(key, value) { filters.push([key, value]); return this; },
        is(key, value) { filters.push([key, value]); return this; },
        async single() {
          writes++;
          if (writes === options.writeErrorAt) return { data: null, error: { message: "Write denied" } };
          const member = rows.find(row => filters.every(([key, value]) => (row[key] ?? null) === value));
          if (!member) return { data: null, error: { code: "PGRST116", message: "Placement changed" } };
          Object.assign(member, updates);
          return { data: { id: member.id }, error: null };
        },
        then(resolve, reject) {
          reads++;
          return Promise.resolve({ data: structuredClone(rows), error: reads === 1 ? options.placementError : options.readError }).then(resolve, reject);
        },
      };
      return query;
    },
  };
}

function validTree(rows) {
  for (const member of rows) {
    assert.deepEqual(placementCycle(rows, member.id), [], "no circular links");
    const parent = rows.find(row => row.id === member.placement_id);
    assert.equal(member.tree_level, parent ? parent.tree_level + 1 : 0);
  }
}

test("repeated moves always replace the old attachment without copying the member or leaf", async () => {
  const db = client();
  for (let i = 0; i < 20; i++) {
    const target = i % 2 ? "old" : "sponsor";
    const old = i % 2 ? "sponsor" : "old";
    assert.equal((await transferSponsor(db, "member", target)).success, true);
    assert.equal(db.rows.length, 4);
    assert.deepEqual(placementChildren(db.rows, old), []);
    assert.deepEqual(placementChildren(db.rows, target).map(row => row.id), ["member"]);
    assert.equal(db.rows.find(row => row.id === "leaf").placement_id, "member");
    validTree(db.rows);
  }
});

for (const target of ["member", "leaf"]) {
  test(`an ancestor can move under ${target}, including repeated reverse moves`, async () => {
    const db = client();
    await transferSponsor(db, "old", target);
    assert.equal(db.rows.find(row => row.id === target).placement_id, null);
    assert.equal(db.rows.find(row => row.id === target).referrer_id, target === "member" ? "old" : "member", "lifted sponsor is unchanged");
    assert.equal(db.rows.find(row => row.id === "old").placement_id, target);
    validTree(db.rows);
    await transferSponsor(db, target, "old");
    validTree(db.rows);
    assert.equal(db.rows.find(row => row.id === "old").placement_id, null);
    assert.equal(db.rows.find(row => row.id === target).placement_id, "old");
  });
}

test("existing two-node cycles are repaired by the requested move", async () => {
  const db = client({ rows: [row("member", "sponsor", 2), row("sponsor", "member", 3), row("leaf", "member", 4)] });
  const result = await transferSponsor(db, "member", "sponsor");
  assert.equal(result.changed, true, "a same-sponsor cycle repair is still a change");
  validTree(db.rows);
  assert.equal(db.rows.find(row => row.id === "sponsor").placement_id, null);
});

test("a circular target accepts a new member after automatic detachment", async () => {
  const db = client({ rows: [row("member"), row("sponsor", "other", 2), row("other", "sponsor", 3)] });
  await transferSponsor(db, "member", "sponsor");
  validTree(db.rows);
});

test("detaches to a root without creating a new member", async () => {
  const db = client();
  await transferSponsor(db, "member", "");
  assert.equal(db.rows.find(row => row.id === "member").placement_id, null);
  assert.equal(db.rows.find(row => row.id === "member").referrer_id, null);
  validTree(db.rows);
});

for (const code of ["PGRST202", "PGRST204", "42703", "42883"]) {
  test(`missing setup ${code} is surfaced`, async () => {
    await assert.rejects(transferSponsor(client({ error: { code } }), "member", "sponsor"), /012_change_sponsor_function.sql/);
  });
}

test("a failed transfer restores every preparatory detachment", async () => {
  const db = client({ error: { code: "42501", message: "Permission denied" } });
  const before = db.rows;
  await assert.rejects(transferSponsor(db, "old", "leaf"), /Permission denied/);
  assert.deepEqual(db.rows, before);
});

test("an ambiguous RPC response never restores a potentially circular old link", async () => {
  const db = client({ result: null });
  await assert.rejects(transferSponsor(db, "old", "leaf"), /could not be confirmed/);
  assert.equal(db.rows.find(row => row.id === "leaf").placement_id, null);
  validTree(db.rows);
});

test("a failed preparation restores its earlier writes without calling the RPC", async () => {
  const db = client({ writeErrorAt: 2 });
  const before = db.rows;
  await assert.rejects(transferSponsor(db, "old", "leaf"), /Write denied/);
  assert.deepEqual(db.rows, before);
  assert.ok(!db.calls.some(call => call[0] === "change_sponsor"));
});

test("unreadable snapshots, self moves and permission errors are not bypassed", async () => {
  const db = client({ placementError: { message: "Placement read denied" } });
  await assert.rejects(transferSponsor(db, "member", "sponsor"), /Placement read denied/);
  assert.ok(!db.calls.some(call => call[0] === "change_sponsor"));
  await assert.rejects(transferSponsor(client(), "member", "member"), /themselves/);
  await assert.rejects(transferSponsor(client({ error: { code: "42501", message: "Permission denied" } }), "member", "sponsor"), /Permission denied/);
});

test("unconfirmed responses, stale attachments and failed read-back are not successes", async () => {
  await assert.rejects(transferSponsor(client({ result: null }), "member", "sponsor"), /did not confirm/);
  await assert.rejects(transferSponsor(client({ stale: true }), "member", "sponsor"), /does not match/);
  await assert.rejects(transferSponsor(client({ readError: { message: "Read failed" } }), "member", "sponsor"), /Read failed/);
});
