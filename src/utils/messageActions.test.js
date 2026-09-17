import test from "node:test";
import assert from "node:assert/strict";
import { createMessageActionTracker, matchesMessageAction } from "./messageActions.js";

const action = { action: "react_message", conversation_id: "chat", message_id: "message", emoji: "like" };
const event = { event: "message_reacted", conversation_id: "chat", message_id: "message", emoji: "like", user_id: "me" };

test("confirmation must match conversation, message, action, and actor", () => {
  assert.equal(matchesMessageAction(action, event, "me"), true);
  for (const difference of [{ conversation_id: "other" }, { message_id: "other" },
    { emoji: "other" }, { user_id: "other" }, { event: "message_deleted" }]) {
    assert.equal(matchesMessageAction(action, { ...event, ...difference }, "me"), false);
  }
  assert.equal(matchesMessageAction({ ...action, action: "edit_message", content: "new" },
    { ...event, event: "message_edited", content: "old" }, "me"), false);
  assert.equal(matchesMessageAction({ ...action, action: "pin_message", scope: "personal" },
    { ...event, event: "message_pinned", pinned_by_user_id: "me", scope: "shared" }, "me"), false);
  for (const [request, response] of [["pin_message", "message_pinned"], ["unpin_message", "message_unpinned"]]) {
    const pin = { ...action, action: request, scope: "personal" };
    const confirmation = { ...event, event: response, pinned_by_user_id: "me", scope: "personal" };
    assert.equal(matchesMessageAction(pin, confirmation, "me"), true);
    assert.equal(matchesMessageAction(pin, { ...confirmation, pinned_by_user_id: "other" }, "me"), false);
  }
});

test("retries wait for authoritative recovery to complete", async () => {
  let finishRecovery;
  const tracker = createMessageActionTracker({
    userId: "me", send: () => true, onChange() {},
    onSettle: () => new Promise((resolve) => { finishRecovery = resolve; }),
    schedule() {}, cancel() {},
  });
  tracker.start(action);
  tracker.fail("Connection lost");
  assert.match(tracker.start(action), /refresh/);
  finishRecovery();
  await Promise.resolve();
  assert.equal(tracker.start(action), null);
  tracker.dispose();
});

test("one pending action settles once; failures and timeouts retain recovery context", () => {
  let expire;
  let connected = true;
  let sends = 0;
  const changes = [];
  const settled = [];
  const tracker = createMessageActionTracker({
    userId: "me", send: () => { sends++; return connected; },
    onChange: (value) => changes.push(value), onSettle: (...args) => settled.push(args),
    schedule: (callback) => { expire = callback; }, cancel() {},
  });
  assert.equal(tracker.start(action), null);
  assert.match(tracker.start(action), /Wait/);
  assert.equal(sends, 1);
  tracker.receive({ ...event, user_id: "other" });
  assert.equal(settled.length, 0);
  tracker.receive(event);
  tracker.receive(event);
  assert.deepEqual(settled, [[action, null]]);
  tracker.start(action);
  expire();
  assert.match(settled[1][1], /timed out/);
  tracker.start(action);
  tracker.fail("Server rejected the action");
  assert.equal(settled[2][1], "Server rejected the action");
  connected = false;
  assert.match(tracker.start(action), /Not connected/);
  assert.equal(changes.at(-1), null);
  assert.match(tracker.start({ ...action, message_id: "temp-local" }), /not been confirmed/);
  connected = true;
  tracker.start(action);
  tracker.dispose();
  expire();
  assert.equal(settled.length, 3);
});