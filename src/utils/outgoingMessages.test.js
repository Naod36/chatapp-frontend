import test from "node:test";
import assert from "node:assert/strict";
import {
  confirmOutgoingMessage,
  failOutgoingMessage,
  isConfirmedMessage,
} from "./outgoingMessages.js";

test("REST confirmations correlate by temporary ID and preserve full optimistic payloads", () => {
  const first = {
    id: "temp-first",
    content: "caption",
    message_type: "image",
    media_url: "/image.png",
    reply_to_id: "reply",
    reply_to: { content: "original" },
    sender_id: "me",
    created_at: "now",
    status: "pending",
  };
  const second = { ...first, id: "temp-second", content: "second caption" };
  const sibling = {
    id: "sibling",
    message_type: "image",
    content: "sibling caption",
  };
  const echo = {
    id: "server-first",
    message_id: "server-first",
    status: "read",
  };
  let messages = confirmOutgoingMessage(
    [first, second, sibling, echo],
    "temp-second",
    { message_id: "server-second", status: "sent" },
  );
  assert.equal(messages[0], first);
  assert.equal(messages[2], sibling);
  assert.deepEqual(messages[1], {
    ...second,
    id: "server-second",
    message_id: "server-second",
    status: "sent",
  });
  messages = confirmOutgoingMessage(messages, "temp-first", {
    message_id: "server-first",
    status: "sent",
  });
  assert.equal(messages.length, 3);
  assert.deepEqual(messages[0], {
    ...first,
    id: "server-first",
    message_id: "server-first",
    status: "read",
  });
  assert.equal(
    confirmOutgoingMessage(messages, "temp-first", {
      message_id: "server-first",
      status: "sent",
    }),
    messages,
  );
});

test("rejection only fails its own bubble and pending/failed sends cannot receive success receipts", () => {
  const messages = [
    { id: "temp-first", status: "pending", content: "first" },
    { id: "temp-second", status: "pending", content: "second" },
    { id: "sibling", status: "sent" },
  ];
  const failed = failOutgoingMessage(messages, "temp-first");
  assert.deepEqual(failed[0], { ...messages[0], status: "failed" });
  assert.equal(failed[1], messages[1]);
  assert.equal(failed[2], messages[2]);
  assert.equal(isConfirmedMessage(failed[0]), false);
  assert.equal(isConfirmedMessage(failed[1]), false);
  assert.equal(isConfirmedMessage(failed[2]), true);
});
