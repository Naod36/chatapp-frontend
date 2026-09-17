import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { imageDownloads } from "../src/services/imageDownloads.js";

test("image downloads save a sanitized image filename without account credentials and release resources", async (context) => {
  const dom = new JSDOM("", { url: "http://localhost" });
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: dom.window.document,
  });
  context.after(() => {
    if (descriptor) Object.defineProperty(globalThis, "document", descriptor);
    else delete globalThis.document;
    dom.window.close();
  });
  const controller = new AbortController();
  const blob = new Blob(["image"], { type: "image/png" });
  context.mock.method(globalThis, "fetch", async (src, options) => {
    assert.equal(src, "https://images.example/photo.png");
    assert.deepEqual(options, {
      credentials: "omit",
      signal: controller.signal,
    });
    return { ok: true, blob: async () => blob };
  });
  context.mock.method(URL, "createObjectURL", (value) => {
    assert.equal(value, blob);
    return "blob:test-image";
  });
  const revoked = context.mock.method(URL, "revokeObjectURL", () => {});
  const clicked = context.mock.method(
    dom.window.HTMLAnchorElement.prototype,
    "click",
    function () {
      assert.equal(this.download, "flowchat-photo__1.png");
      assert.equal(this.href, "blob:test-image");
      assert.equal(this.isConnected, true);
    },
  );
  await imageDownloads.download(
    { id: "photo:/1", src: "https://images.example/photo.png" },
    controller.signal,
  );
  assert.equal(clicked.mock.callCount(), 1);
  assert.deepEqual(revoked.mock.calls[0].arguments, ["blob:test-image"]);
  assert.equal(document.querySelector("a"), null);
});

test("image downloads reject HTTP, non-image and cancelled responses before creating a download", async (context) => {
  const created = context.mock.method(
    URL,
    "createObjectURL",
    () => "blob:unexpected",
  );
  let response = { ok: false };
  context.mock.method(globalThis, "fetch", async () => response);
  const image = { id: "photo", src: "https://images.example/photo.png" };
  await assert.rejects(imageDownloads.download(image), /Could not download/);
  response = {
    ok: true,
    blob: async () => new Blob(["error"], { type: "text/html" }),
  };
  await assert.rejects(
    imageDownloads.download(image),
    /did not return an image/,
  );
  const controller = new AbortController();
  response = {
    ok: true,
    blob: async () => {
      controller.abort();
      return new Blob(["image"], { type: "image/png" });
    },
  };
  await assert.rejects(imageDownloads.download(image, controller.signal), {
    name: "AbortError",
  });
  assert.equal(created.mock.callCount(), 0);
});
