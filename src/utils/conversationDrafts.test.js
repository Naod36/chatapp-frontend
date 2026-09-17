import test from "node:test";
import assert from "node:assert/strict";
import { createDraftStore } from "./conversationDrafts.js";

test("drafts persist by account and conversation and clear only the sent revision", () => {
  const data = new Map();
  const storage = { getItem: (key) => data.get(key), setItem: (key, value) => data.set(key, value) };
  const store = createDraftStore("account-a", storage);
  store.set("chat-a", "First draft");
  store.set("chat-b", "Second draft");
  assert.equal(createDraftStore("account-a", storage).drafts["chat-a"], "First draft");
  assert.deepEqual(createDraftStore("account-b", storage).drafts, {});
  const sending = store.capture("chat-a");
  store.set("chat-a", "New draft");
  store.clear(sending);
  assert.equal(store.drafts["chat-a"], "New draft");
  store.clear(store.capture("chat-a"));
  assert.equal(store.drafts["chat-a"], undefined);
  assert.equal(store.drafts["chat-b"], "Second draft");
  assert.equal(createDraftStore("account-a", storage).drafts["chat-a"], undefined);
});

test("malformed storage and unavailable persistence do not lose in-memory input", () => {
  const store = createDraftStore("account", { getItem: () => "invalid", setItem() { throw new Error("Quota"); } });
  assert.deepEqual(store.drafts, {});
  assert.equal(store.set("chat", "Retained"), false);
  assert.equal(store.drafts.chat, "Retained");
});