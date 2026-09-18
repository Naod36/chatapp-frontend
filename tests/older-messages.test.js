import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

test("older history locks requests, anchors prepends, rejects stale pages and retries failures", async () => {
  const dom = new JSDOM('<div id="root"></div><div id="stream"><div id="msg-current"></div></div>', { url: "http://localhost" });
  const keys = ["window", "document", "navigator", "IS_REACT_ACT_ENVIRONMENT"];
  const descriptors = new Map(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const key of ["window", "document", "navigator"]) Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const server = await createServer({ root: fileURLToPath(new URL("../", import.meta.url)), server: { middlewareMode: true }, appType: "custom", optimizeDeps: { noDiscovery: true, include: [] } });
  const { React, act, createRoot } = await server.ssrLoadModule("/tests/runtime.jsx");
  const root = createRoot(document.getElementById("root"));
  try {
    const { default: useOlderMessages } = await server.ssrLoadModule("/src/hooks/useOlderMessages.js");
    const { conversationService } = await server.ssrLoadModule("/src/services/conversations.js");
    const requests = [];
    conversationService.getOlderMessages = (conversation, cursor) => new Promise((resolve, reject) => requests.push({ conversation, cursor, resolve, reject }));
    const containerRef = { current: document.getElementById("stream") };
    let anchorTop = 20;
    document.getElementById("msg-current").getBoundingClientRect = () => ({ top: anchorTop, bottom: anchorTop + 50 });
    let controller;
    let messages = [{ id: "pending", status: "pending" }, { id: "current", status: "sent" }];
    let conversationId = "first";
    let valid = true;
    let revision = 0;
    const prepend = (older) => { messages = [...older, ...messages]; anchorTop += older.length * 40; };
    function Fixture() { controller = useOlderMessages({ conversationId, revision, messages, containerRef, enabled: true, isCurrent: () => valid, onPrepend: prepend }); return null; }
    const render = () => act(async () => root.render(React.createElement(Fixture)));
    await render();
    let request;
    await act(async () => { request = controller.load(); controller.load(); });
    assert.equal(requests.length, 1);
    assert.equal(requests[0].cursor, "current", "pending message is not a cursor");
    await act(async () => { requests[0].resolve([{ message_id: "older", status: "sent" }, { message_id: "older", status: "sent" }]); await request; });
    await render();
    assert.equal(messages[0].id, "older");
    assert.equal(containerRef.current.scrollTop, 40, "visible message offset remains fixed after prepend");
    assert.equal(controller.exhausted, true);
    conversationId = "second";
    messages = [{ id: "current", status: "sent" }];
    await render();
    await act(async () => { request = controller.load(); });
    await act(async () => { requests[1].reject(new Error("History offline")); await request; });
    assert.equal(controller.error, "History offline");
    assert.equal(messages.length, 1);
    await act(async () => { request = controller.load(); });
    conversationId = "third";
    await render();
    await act(async () => { requests[2].resolve([{ message_id: "stale" }]); await request; });
    assert.equal(messages.length, 1, "late response cannot populate another conversation");
    await act(async () => { request = controller.load(); });
    await act(async () => { requests[3].resolve([{ message_id: "current" }]); await request; });
    assert.match(controller.error, /not available from this server/);
    await act(async () => { request = controller.load(); });
    valid = false;
    await act(async () => { requests[4].resolve([{ message_id: "revoked" }]); await request; });
    assert.equal(messages.length, 1, "revoked history request cannot prepend");
    valid = true;
    revision++;
    await render();
    assert.equal(controller.loading, false, "new privacy revision clears stale pending state");
    await act(async () => { request = controller.load(); });
    await act(async () => { requests[5].resolve([]); await request; });
    assert.equal(controller.exhausted, true);
  } finally {
    await act(async () => root.unmount()); await server.close(); dom.window.close();
    for (const [key, descriptor] of descriptors) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  }
});