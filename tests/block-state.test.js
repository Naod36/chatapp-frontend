import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

test("block state acknowledges locally, fails closed, and ignores superseded requests and tokens", async () => {
  const dom = new JSDOM('<div id="root"></div>');
  const keys = ["window", "document", "navigator", "IS_REACT_ACT_ENVIRONMENT"];
  const descriptors = new Map(
    keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: dom.window.navigator,
  });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const server = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    server: { middlewareMode: true },
    appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  const { React, act, createRoot } =
    await server.ssrLoadModule("/tests/runtime.jsx");
  const { default: useBlockState } = await server.ssrLoadModule(
    "/src/hooks/useBlockState.js",
  );
  const { userService } = await server.ssrLoadModule("/src/services/user.js");
  const root = createRoot(document.getElementById("root"));
  const requests = [];
  userService.getBlockedUsers = () =>
    new Promise((resolve, reject) => requests.push({ resolve, reject }));
  userService.getBlockedByUsers = async () => [];
  let current;
  function Probe({ token }) {
    current = useBlockState(token);
    return null;
  }
  try {
    await act(async () =>
      root.render(React.createElement(Probe, { token: "first" })),
    );
    await act(async () => requests[0].resolve([]));
    assert.equal(current.ready, true);
    let older;
    await act(async () => {
      older = current.refresh();
    });
    await act(async () => current.acknowledgeOutgoing("peer", true));
    assert.deepEqual(current.stateRef.current.outgoing, ["peer"]);
    await act(async () => {
      requests[1].resolve([]);
      await older;
    });
    assert.deepEqual(
      current.outgoing,
      ["peer"],
      "pre-acknowledgement fetch cannot undo block",
    );

    let failed;
    await act(async () => {
      failed = current.refresh();
    });
    await act(async () => {
      requests[2].reject(new Error("offline"));
      await failed;
    });
    assert.deepEqual(current.outgoing, ["peer"]);
    assert.equal(current.ready, false, "refresh failure disables interaction");
    await act(async () => current.acknowledgeOutgoing("peer", false));
    assert.deepEqual(
      current.outgoing,
      [],
      "unblock acknowledgement applies without a fetch",
    );
    assert.equal(
      current.ready,
      false,
      "unblock cannot override unknown incoming state",
    );

    let newest;
    await act(async () => {
      older = current.refresh();
      newest = current.refresh();
    });
    await act(async () => {
      requests[4].resolve([{ user_id: "new" }]);
      await newest;
    });
    await act(async () => {
      requests[3].resolve([{ user_id: "old" }]);
      await older;
    });
    assert.deepEqual(current.outgoing, ["new"]);
    assert.equal(current.ready, true);
    await act(async () => {
      older = current.refresh();
      newest = current.refresh();
    });
    await act(async () => {
      requests[6].resolve([{ user_id: "new" }]);
      await newest;
    });
    await act(async () => {
      requests[5].reject(new Error("stale failure"));
      await older;
    });
    assert.equal(
      current.ready,
      true,
      "superseded failures cannot disable newer state",
    );

    const previousSession = current;
    await act(async () => {
      older = current.refresh();
    });
    await act(async () =>
      root.render(React.createElement(Probe, { token: "second" })),
    );
    assert.deepEqual(current.outgoing, []);
    assert.equal(current.ready, false);
    await act(async () => {
      previousSession.acknowledgeOutgoing("wrong-account", true);
      requests[7].resolve(["wrong-account"]);
      await older;
    });
    assert.deepEqual(current.outgoing, []);
    await act(async () => requests[8].resolve(["second-account"]));
    assert.deepEqual(current.outgoing, ["second-account"]);
    await act(async () =>
      root.render(React.createElement(Probe, { token: null })),
    );
    assert.deepEqual(current.outgoing, []);
    assert.deepEqual(current.incoming, []);
    assert.equal(current.ready, false);
  } finally {
    await act(async () => root.unmount());
    await server.close();
    for (const key of keys) {
      if (descriptors.get(key))
        Object.defineProperty(globalThis, key, descriptors.get(key));
      else delete globalThis[key];
    }
    dom.window.close();
  }
});
