import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

test("message search ignores stale queries, paginates, retries, validates filters and isolates accounts", async () => {
  const dom = new JSDOM('<div id="root"></div>');
  const keys = ["window", "document", "navigator", "IS_REACT_ACT_ENVIRONMENT"];
  const descriptors = new Map(
    keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  for (const key of keys)
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value: key === "IS_REACT_ACT_ENVIRONMENT" ? true : dom.window[key],
    });
  const server = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    server: { middlewareMode: true, hmr: false },
    appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  const { React, act, createRoot } =
    await server.ssrLoadModule("/tests/runtime.jsx");
  const { default: useSearch } = await server.ssrLoadModule(
    "/src/hooks/useMessageSearch.js",
  );
  const { conversationService } = await server.ssrLoadModule(
    "/src/services/conversations.js",
  );
  const requests = [];
  conversationService.searchMessages = (query, filters) =>
    new Promise((resolve, reject) =>
      requests.push({ query, filters, resolve, reject }),
    );
  let current;
  function Probe({
    query = "alpha",
    filters = {},
    token = "first",
    revision = 0,
  }) {
    current = useSearch(query, filters, token, revision);
    return null;
  }
  const root = createRoot(document.getElementById("root"));
  const debounce = () =>
    act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 330));
    });
  const render = (props) =>
    act(async () => root.render(React.createElement(Probe, props)));
  try {
    await render({});
    await debounce();
    await render({ query: "beta" });
    await debounce();
    await act(async () =>
      requests[1].resolve({ messages: [{ id: "beta" }], has_more: true }),
    );
    await act(async () =>
      requests[0].resolve({ messages: [{ id: "old" }], has_more: false }),
    );
    assert.deepEqual(
      current.messages.map((message) => message.id),
      ["beta"],
    );
    await act(async () => {
      current.loadMore();
      current.loadMore();
    });
    await debounce();
    assert.equal(requests[2].filters.offset, 50);
    await act(async () => requests[2].reject(new Error("offline")));
    assert.equal(current.error, "offline");
    assert.equal(current.messages.length, 1);
    await act(async () => current.retry());
    await debounce();
    await act(async () =>
      requests[3].resolve({
        messages: [{ id: "beta" }, { id: "more" }],
        has_more: false,
      }),
    );
    assert.equal(current.messages.length, 2);
    await render({
      query: "beta",
      filters: { sender: "person", from: "2026-09-01", to: "2026-09-17" },
    });
    await debounce();
    assert.equal(requests[4].filters.sender, "person");
    assert.equal(requests[4].filters.offset, 0);
    await render({ query: "beta", token: "second" });
    await act(async () =>
      requests[4].resolve({ messages: [{ id: "private" }], has_more: false }),
    );
    assert.deepEqual(current.messages, []);
    await debounce();
    await act(async () =>
      requests[5].resolve({ messages: [], has_more: false }),
    );
    await render({
      query: "beta",
      token: "second",
      filters: { from: "2026-09-18", to: "2026-09-17" },
    });
    await debounce();
    assert.match(current.error, /Start date/);
    assert.equal(requests.length, 6);
    await render({ query: "" });
    assert.deepEqual(current.messages, []);
    assert.equal(current.loading, false);
  } finally {
    await act(async () => root.unmount());
    await server.close();
    dom.window.close();
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
