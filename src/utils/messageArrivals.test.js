import test from "node:test";
import assert from "node:assert/strict";
import { trackMessageArrivals } from "./messageArrivals.js";

const incoming = (id) => ({ id, sender_id: "peer", content: "Message" });
const outgoing = (id) => ({ id, sender_id: "me", content: "My message" });

test("counts unique incoming arrivals in a batch, not outgoing confirmations", () => {
  const result = trackMessageArrivals(
    [incoming("old"), outgoing("confirmed"), incoming("new-1"), incoming("new-2"), incoming("new-2")],
    new Set(["old", "temp-local"]), new Set(), "me", false,
  );
  assert.deepEqual([...result.unseenIds], ["new-1", "new-2"]);
  assert.equal(result.hasArrivals, true);
  const confirmation = trackMessageArrivals(
    [outgoing("confirmed")], new Set(["temp-local"]), new Set(), "me", false,
  );
  assert.equal(confirmation.unseenIds.size, 0);
  assert.equal(confirmation.hasArrivals, false);
});

test("edits preserve unseen IDs and deletion removes them", () => {
  const result = trackMessageArrivals(
    [{ ...incoming("kept"), content: "Edited", status: "read" }],
    new Set(["kept", "deleted"]), new Set(["kept", "deleted"]), "me", false,
  );
  assert.deepEqual([...result.unseenIds], ["kept"]);
  assert.equal(result.hasArrivals, false);
});

test("following latest clears unseen messages and normalizes ID types", () => {
  const result = trackMessageArrivals(
    [incoming(12), incoming("new")], new Set(["12"]), new Set(["12"]), "me", true,
  );
  assert.equal(result.unseenIds.size, 0);
  assert.equal(result.hasArrivals, true);
  assert.deepEqual([...result.currentIds], ["12", "new"]);
});