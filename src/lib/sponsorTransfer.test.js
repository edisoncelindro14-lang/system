import test from "node:test";
import assert from "node:assert/strict";
import { transferSponsor } from "./sponsorTransfer.js";

function client({ result = { success: true, changed: true }, error = null, member = { id: "member", referrer_id: "sponsor", placement_id: "sponsor" }, readError = null } = {}) {
  const calls = [];
  const query = {
    select(fields) { calls.push(["select", fields]); return this; },
    eq(key, value) { calls.push(["eq", key, value]); return this; },
    async single() { return { data: member, error: readError }; },
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
  assert.deepEqual(db.calls[0], ["change_sponsor", { p_member_id: "member", p_new_sponsor_id: "sponsor" }]);
  assert.ok(db.calls.some(call => call[0] === "eq" && call[2] === "member"));
});

test("detaches to a root without creating or duplicating a member", async () => {
  const db = client({ member: { id: "member", referrer_id: null, placement_id: null } });
  await transferSponsor(db, "member", "");
  assert.equal(db.calls[0][1].p_new_sponsor_id, null);
});

for (const code of ["PGRST202", "PGRST204", "42703", "42883"]) {
  test(`missing database setup ${code} names the required migration`, async () => {
    const db = client({ error: { code, message: "Missing function or column" } });
    await assert.rejects(transferSponsor(db, "member", "sponsor"), /012_change_sponsor_function.sql/);
    assert.equal(db.calls.length, 1, "no fallback writes on an incompatible database");
  });
}

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
