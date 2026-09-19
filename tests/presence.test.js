import { test } from "node:test";
import assert from "node:assert/strict";
import { applyPresence, customStatus, presenceLabel, statusExpiry } from "../src/utils/presence.js";

test("invisible overrides stale online state and last seen", () => {
  assert.equal(presenceLabel({ presence_visibility: "invisible", status: "online", last_seen: "yesterday" }), "Status unavailable");
  assert.equal(presenceLabel({ status: "hidden", custom_status: "Busy" }), "Busy · Status unavailable");
  assert.equal(presenceLabel({ status: "offline", last_seen: "yesterday" }, (value) => `Last seen ${value}`), "Last seen yesterday");
});

test("expired and identity-hidden custom statuses are not displayed", () => {
  assert.equal(customStatus({ custom_status: "Sleeping", status_expires_at: "2020-01-01" }), "");
  assert.equal(customStatus({ custom_status: "Busy", identity_hidden: true }), "");
  assert.equal(statusExpiry("1", null, 0), "1970-01-01T01:00:00.000Z");
  assert.equal(statusExpiry("never"), null);
  assert.equal(statusExpiry("keep", "2020-01-01"), null);
});

test("presence updates direct and group participants and clears old last seen", () => {
  const peer = { user_id: "peer", status: "online", last_seen: "yesterday" };
  const result = applyPresence({ other_participant: peer, participants: [peer, { user_id: "other" }] }, {
    user_id: "peer", status: "hidden", last_seen: null, custom_status: "Busy",
  });
  assert.equal(result.other_participant.last_seen, null);
  assert.equal(result.participants[0].custom_status, "Busy");
  assert.equal(result.participants[1].custom_status, undefined);
});