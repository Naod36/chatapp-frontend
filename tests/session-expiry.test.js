import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

test("authenticated requests expire only their own rejected session", async () => {
  const keys = ["window", "localStorage", "fetch", "XMLHttpRequest"];
  const descriptors = new Map(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const storage = new Map();
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  };
  globalThis.window = new EventTarget();
  const server = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    server: { middlewareMode: true, hmr: false },
    appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  try {
    const { apiFetch, uploadFileWithProgress } = await server.ssrLoadModule("/src/services/api.js");
    const { SESSION_EXPIRED_EVENT } = await server.ssrLoadModule("/src/services/session.js");
    let expirations = 0;
    window.addEventListener(SESSION_EXPIRED_EVENT, () => expirations++);
    const seed = (token) => {
      localStorage.setItem("chat_token", token);
      localStorage.setItem("chat_userId", "me");
      localStorage.setItem("chat_username", "tester");
    };
    const response = (status) => new Response("{}", { status, headers: { "content-type": "application/json" } });

    seed("expired");
    globalThis.fetch = async () => response(401);
    await assert.rejects(apiFetch("/me"), /session has expired/);
    assert.equal(storage.size, 0);
    assert.equal(expirations, 1);
    await assert.rejects(apiFetch("/me"));
    assert.equal(expirations, 1, "unauthenticated 401 does not emit another expiry");

    seed("old-session");
    globalThis.fetch = async () => {
      seed("new-session");
      return response(401);
    };
    await assert.rejects(apiFetch("/me"));
    assert.equal(localStorage.getItem("chat_token"), "new-session");
    assert.equal(expirations, 1);

    for (const status of [403, 500]) {
      globalThis.fetch = async () => response(status);
      await assert.rejects(apiFetch("/me"));
      assert.equal(localStorage.getItem("chat_token"), "new-session");
    }
    globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };
    await assert.rejects(apiFetch("/me"), /Unable to connect/);
    assert.equal(localStorage.getItem("chat_token"), "new-session");
    globalThis.fetch = async () => response(200);
    assert.deepEqual(await apiFetch("/me"), {});
    const { conversationService } = await server.ssrLoadModule("/src/services/conversations.js");
    globalThis.fetch = async (url) => {
      assert.equal(new URL(url).searchParams.get("mark_read"), "false");
      return response(200);
    };
    await conversationService.getMessages("chat");
    globalThis.fetch = async (url, options) => {
      assert.equal(new URL(url).pathname, "/conversations/chat/messages/stable-client-id");
      assert.equal(options.method, "PUT");
      assert.equal(JSON.parse(options.body).client_message_id, undefined);
      assert.ok(options.signal);
      return response(200);
    };
    await conversationService.sendMessage("chat", { content: "retry", client_message_id: "stable-client-id" });

    globalThis.XMLHttpRequest = class {
      upload = {};
      status = 401;
      responseText = "{}";
      getResponseHeader() { return "application/json"; }
      open() {}
      setRequestHeader() {}
      send() { this.onload(); }
    };
    await assert.rejects(uploadFileWithProgress(new Blob(["test"]), () => {}), /session has expired/);
    assert.equal(localStorage.getItem("chat_token"), null);
    assert.equal(expirations, 2);
    const { MAX_UPLOAD_BYTES, UPLOAD_SIZE_ERROR, UPLOAD_REJECTED_ERROR } = await server.ssrLoadModule("/src/utils/uploadLimits.js");
    let requests = 0;
    globalThis.fetch = async () => { requests++; return response(413); };
    globalThis.XMLHttpRequest = class {
      constructor() { requests++; }
      upload = {};
      status = 413;
      responseText = "<html>Too large</html>";
      getResponseHeader() { return "text/html"; }
      open() {}
      setRequestHeader() {}
      send() { this.onload(); }
    };
    const oversized = { size: MAX_UPLOAD_BYTES + 1 };
    await assert.rejects(conversationService.uploadFile(oversized), { message: UPLOAD_SIZE_ERROR });
    await assert.rejects(conversationService.uploadFile(oversized, () => {}), { message: UPLOAD_SIZE_ERROR });
    await assert.rejects(uploadFileWithProgress(oversized, () => {}), { message: UPLOAD_SIZE_ERROR });
    assert.equal(requests, 0, "oversized files never reach either transport");
    await assert.rejects(conversationService.uploadFile(new Blob(["small"])), { message: UPLOAD_REJECTED_ERROR });
    await assert.rejects(uploadFileWithProgress(new Blob(["small"]), () => {}), { message: UPLOAD_REJECTED_ERROR });
    assert.equal(requests, 2, "valid-size files reach the server and surface proxy rejections");
  } finally {
    await server.close();
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});