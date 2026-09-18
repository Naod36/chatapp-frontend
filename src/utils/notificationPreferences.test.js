import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMutes, isMutedUntil, isConversationMuted, notificationContent } from "./notificationPreferences.js";

test("global, folder and chat mutes combine without overriding one another", () => {
  const folders = [{ id: "work", conversation_ids: ["team"] }, { id: "other", conversation_ids: ["team"] }];
  assert.equal(isConversationMuted("team", {}, { all: true }, [], 100), true);
  assert.equal(isConversationMuted("team", {}, { "folder:work": 200 }, folders, 100), true);
  assert.equal(isConversationMuted("personal", {}, { "folder:work": true }, folders), false);
  assert.equal(isConversationMuted("team", {}, { "folder:work": 200 }, folders, 200), false);
  assert.equal(isConversationMuted("team", { team: true }, { all: 99 }, folders, 100), true);
  assert.equal(isConversationMuted("team", {}, { "folder:other": true }, folders), true);
  assert.equal(isConversationMuted("team", {}, { "folder:work": true }, []), false);
});

test("mute migration preserves permanent mutes and expiration uses the current clock", () => {
  assert.deepEqual(normalizeMutes(["first", "second"]), { first: true, second: true });
  assert.deepEqual(normalizeMutes({ first: true, second: 5000, invalid: "true" }), { first: true, second: 5000 });
  assert.equal(isMutedUntil(true, 9000), true);
  assert.equal(isMutedUntil(5000, 4999), true);
  assert.equal(isMutedUntil(5000, 5000), false);
  assert.equal(isMutedUntil(undefined), false);
});

test("hidden previews omit sender identity, avatar and message content", () => {
  const message = { sender_name: "Private sender", sender_avatar: "/private.png", content: "Private text", message_type: "text" };
  assert.deepEqual(notificationContent(message, true), { title: "FlowChat", body: "New message", icon: "/favicon.ico" });
  assert.equal(notificationContent(message, false).body, "Private text");
  assert.equal(notificationContent({ ...message, message_type: "voice" }, false).body, "Sent a voice message");
});