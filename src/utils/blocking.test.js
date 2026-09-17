import test from "node:test";
import assert from "node:assert/strict";
import {
  blockPolicy,
  directBlockPolicy,
  maskConversation,
  maskMessage,
  maskParticipant,
  visibleTypingUsers,
  createBlockStateSync,
  UNAVAILABLE_NAME,
} from "./blocking.js";

test("outgoing block preserves identity and search but disables direct interaction", () => {
  const policy = blockPolicy("peer", ["peer"], []);
  assert.equal(policy.maskIdentity, false);
  assert.equal(policy.canSearch, true);
  assert.equal(policy.canInteract, false);
  assert.equal(policy.canUnblock, true);
});

test("incoming block masks identity, search and direct interaction", () => {
  const policy = blockPolicy("peer", [], ["peer"]);
  assert.equal(policy.maskIdentity, true);
  assert.equal(policy.canSearch, false);
  assert.equal(policy.canInteract, false);
  assert.equal(policy.canUnblock, false);
});

test("mutual blocking never traps the outgoing unblock", () => {
  const policy = blockPolicy("peer", ["peer"], ["peer"]);
  assert.equal(policy.maskIdentity, true);
  assert.equal(policy.canUnblock, true);
  assert.equal(policy.canInteract, false);
});

test("groups remain interactive and unblocking restores direct interactions", () => {
  const other_participant = { user_id: "peer" };
  assert.equal(
    directBlockPolicy({ type: "group", other_participant }, ["peer"], ["peer"])
      .canInteract,
    true,
  );
  assert.equal(
    directBlockPolicy({ type: "direct", other_participant }, [], [])
      .canInteract,
    true,
  );
});

test("mask all identity fallbacks without changing the raw cached data", () => {
  const participant = {
    user_id: "peer",
    username: "secret",
    display_name: "Secret Name",
    avatar_url: "secret.jpg",
    bio: "secret bio",
    status: "online",
    last_seen: "today",
  };
  const message = {
    sender_id: "peer",
    sender_name: "Secret Name",
    sender_avatar: "secret.jpg",
    content: "hello",
    status: "read",
  };
  const conversation = {
    type: "direct",
    display_name: "Secret Name",
    other_participant: participant,
    participants: [participant],
    last_message: message,
  };
  const masked = maskConversation(conversation, ["peer"]);
  assert.equal(masked.display_name, UNAVAILABLE_NAME);
  assert.equal(masked.other_participant.username, "");
  assert.equal(masked.other_participant.status, null);
  assert.equal(masked.other_participant.last_seen, null);
  assert.equal(masked.participants[0].avatar_url, null);
  assert.equal(masked.last_message.sender_name, UNAVAILABLE_NAME);
  assert.equal(masked.last_message.status, null);
  assert.equal(
    maskConversation(conversation, []).other_participant,
    participant,
  );
  assert.equal(maskParticipant(participant, []).username, "secret");
  assert.equal(
    maskMessage({ reply_to: message, message }, ["peer"]).reply_to
      .sender_avatar,
    null,
  );
  assert.equal(
    maskMessage({ reply_to_message: message }, ["peer"]).reply_to_message
      .sender_name,
    UNAVAILABLE_NAME,
  );
  assert.equal(maskMessage(message, []).sender_name, "Secret Name");
  assert.equal(
    maskConversation(
      { ...conversation, type: "group", display_name: "Group" },
      ["peer"],
    ).display_name,
    "Group",
  );
  assert.deepEqual(
    visibleTypingUsers({ group: { peer: true, friend: true } }, ["peer"]),
    { group: { friend: true } },
  );
});

test("refresh compares both directions, ignores ordering, and detects unblock", async () => {
  let relations = [[{ user_id: "peer" }, { user_id: "other" }], ["peer"]];
  const changes = [];
  const refresh = createBlockStateSync(
    async () => relations,
    (state) => changes.push(state),
  );
  await refresh();
  relations = [[{ user_id: "other" }, { user_id: "peer" }], ["peer"]];
  await refresh();
  assert.equal(changes.length, 1);
  relations = [[], ["peer"]];
  await refresh();
  relations = [[], []];
  await refresh();
  assert.equal(changes.length, 3);
  assert.deepEqual(changes.at(-1), { outgoing: [], incoming: [] });
});

test("overlapping refresh triggers serialize with one trailing refresh", async () => {
  let release;
  let calls = 0;
  const refresh = createBlockStateSync(
    async () => {
      calls += 1;
      if (calls === 1)
        await new Promise((resolve) => {
          release = resolve;
        });
      return [[], []];
    },
    () => {},
  );
  const first = refresh();
  const second = refresh();
  refresh();
  assert.equal(calls, 1);
  release();
  await Promise.all([first, second]);
  assert.equal(calls, 2);
});
