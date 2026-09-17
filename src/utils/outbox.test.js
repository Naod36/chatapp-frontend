import test from "node:test";
import assert from "node:assert/strict";
import { createOutbox, mergeOutbox } from "./outbox.js";

test("outbox persists payloads, isolates accounts, and restores interrupted sends for manual retry", () => {
  const data = new Map();
  const storage = { getItem: (key) => data.get(key), setItem: (key, value) => data.set(key, value) };
  const outbox = createOutbox("me", storage);
  const entry = { client_id: "stable", id: "temp-stable", conversation_id: "chat", sender_id: "me", status: "pending", payload: { content: "text", media_url: "/uploaded.png" } };
  outbox.put(entry);
  const restored = createOutbox("me", storage);
  assert.equal(restored.entries[0].status, "failed");
  assert.deepEqual(restored.entries[0].payload, entry.payload);
  assert.equal(createOutbox("other", storage).entries.length, 0);
  assert.equal(mergeOutbox([], restored.entries, "other-chat").length, 0);
  assert.equal(mergeOutbox([entry], restored.entries, "chat").length, 1);
  assert.deepEqual(mergeOutbox([{ id: "stable" }], restored.entries, "chat"), [{ id: "stable" }]);
  restored.remove("stable");
  assert.equal(createOutbox("me", storage).entries.length, 0);
});