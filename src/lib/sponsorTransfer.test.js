import test from "node:test";
import assert from "node:assert/strict";
import { transferSponsor } from "./sponsorTransfer.js";

function client({ result = { success: true, changed: true }, error = null, member = { id: "member", referrer_id: "sponsor", placement_id: "sponsor" }, readError = null, placements = [{ id: "member", placement_id: "old" }, { id: "sponsor", placement_id: null }], placementError = null } = {}) {
  const calls = [];
  const query = {
    select(fields) { calls.push(["select", fields]); return this; },
    eq(key, value) { calls.push(["eq", key, value]); return this; },
    async single() { return { data: member, error: readError }; },
    then(resolve, reject) { return Promise.resolve({ data: placements, error: placementError }).then(resolve, reject); },
  };
  return {
    calls,
    async rpc(name, params) { calls.push([name, params]); return { data: result, error }; },
    from(name) { calls.push(["from", name]); return query; },
  };
}

test("transfers the existing member and verifies both saved links", async () => {
  const db = client();
  assert.equal((await transferSponsor(db, "member", "sponsor")).success, true);
  assert.deepEqual(db.calls.find(call => call[0] === "change_sponsor"), ["change_sponsor", { p_member_id: "member", p_new_sponsor_id: "sponsor" }]);
  assert.ok(db.calls.some(call => call[0] === "eq" && call[2] === "member"));
});

test("detaches to a root without creating or duplicating a member", async () => {
  const db = client({ member: { id: "member", referrer_id: null, placement_id: null } });
  await transferSponsor(db, "member", "");
  assert.equal(db.calls.find(call => call[0] === "change_sponsor")[1].p_new_sponsor_id, null);
});

for (const code of ["PGRST202", "PGRST204", "42703", "42883"]) {
  test(`missing database setup ${code} names the required migration`, async () => {
    const db = client({ error: { code, message: "Missing function or column" } });
    await assert.rejects(transferSponsor(db, "member", "sponsor"), /012_change_sponsor_function.sql/);
    assert.equal(db.calls.filter(call => call[0] === "change_sponsor").length, 1, "no fallback writes on an incompatible database");
  });
}

test("preflight blocks a cycle before even an outdated RPC can save it", async () => {
  const db = client({ placements: [{ id: "member", placement_id: null }, { id: "sponsor", placement_id: "member" }] });
  await assert.rejects(transferSponsor(db, "member", "sponsor"), /own downline/);
  assert.ok(!db.calls.some(call => call[0] === "change_sponsor"), "no write was attempted");
});

test("preflight refuses an already-circular target or an unreadable placement snapshot", async () => {
  const db = client({ placements: [{ id: "member", placement_id: null }, { id: "sponsor", placement_id: "other" }, { id: "other", placement_id: "sponsor" }] });
  await assert.rejects(transferSponsor(db, "member", "sponsor"), /already has a circular/);
  assert.ok(!db.calls.some(call => call[0] === "change_sponsor"));
  const unavailable = client({ placementError: { message: "Placement read denied" } });
  await assert.rejects(transferSponsor(unavailable, "member", "sponsor"), /Placement read denied/);
  assert.ok(!unavailable.calls.some(call => call[0] === "change_sponsor"));
});

test("permission errors are surfaced without bypassing them", async () => {
  await assert.rejects(transferSponsor(client({ error: { code: "42501", message: "Permission denied" } }), "member", "sponsor"), /Permission denied/);
});

test("rejects an unconfirmed response or stale referral-only attachment", async () => {
  await assert.rejects(transferSponsor(client({ result: null }), "member", "sponsor"), /did not confirm/);
  await assert.rejects(transferSponsor(client({ member: { id: "member", referrer_id: "sponsor", placement_id: "old" } }), "member", "sponsor"), /does not match/);
});

test("same-sponsor repairs still verify saved placement", async () => {
  const db = client({ result: { success: true, changed: false } });
  assert.equal((await transferSponsor(db, "member", "sponsor")).changed, false);
  assert.ok(db.calls.some(call => call[0] === "select"));
});

test("failed read-back cannot be reported as a successful transfer", async () => {
  await assert.rejects(transferSponsor(client({ readError: { message: "Read failed" } }), "member", "sponsor"), /Read failed/);
});
