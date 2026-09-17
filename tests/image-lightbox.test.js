import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

test("ImageLightbox: navigation, keyboard, zoom reset and dismissal", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost" });
  const keys = ["window", "document", "navigator", "IS_REACT_ACT_ENVIRONMENT"];
  const descriptors = new Map(
    keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  for (const key of ["window", "document", "navigator"]) {
    Object.defineProperty(globalThis, key, {
      configurable: true,
      value: dom.window[key],
    });
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const server = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    server: { middlewareMode: true },
    appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  const { React, act, createRoot } =
    await server.ssrLoadModule("/tests/runtime.jsx");
  const root = createRoot(document.getElementById("root"));
  try {
    const { default: ImageLightbox } = await server.ssrLoadModule(
      "/src/components/chat/ImageLightbox.jsx",
    );
    const images = [
      { id: "a", src: "/img-a.jpg", caption: "First" },
      { id: "b", src: "/img-b.jpg", caption: "Second" },
      { id: "c", src: "/img-c.jpg", caption: "Third" },
    ];
    let closedCount = 0;
    const onClose = () => {
      closedCount += 1;
    };
    const flush = async (callback = () => {}) => {
      await act(async () => {
        await callback();
      });
    };
    const click = async (element) => {
      assert.ok(element, "expected clickable element");
      await flush(() =>
        element.dispatchEvent(
          new window.MouseEvent("click", { bubbles: true }),
        ),
      );
    };
    const dialog = () => document.querySelector('[aria-label="Image viewer"]');
    const counterText = () => dialog().textContent.match(/\d+ \/ \d+/)[0];
    const imgByAlt = (caption) =>
      document.querySelector(`img[alt="${caption}"]`);

    await flush(() =>
      root.render(
        React.createElement(ImageLightbox, {
          images,
          startIndex: 1,
          onClose,
          t: {},
        }),
      ),
    );

    assert.equal(counterText(), "2 / 3", "opens at the requested start index");

    await click(document.querySelector('[aria-label="Next image"]'));
    assert.equal(counterText(), "3 / 3");
    await click(document.querySelector('[aria-label="Next image"]'));
    assert.equal(
      counterText(),
      "1 / 3",
      "next wraps around past the last image",
    );

    await click(document.querySelector('[aria-label="Previous image"]'));
    assert.equal(
      counterText(),
      "3 / 3",
      "previous wraps around past the first image",
    );

    await flush(() =>
      window.dispatchEvent(
        new window.KeyboardEvent("keydown", { key: "ArrowLeft" }),
      ),
    );
    assert.equal(counterText(), "2 / 3", "left arrow key navigates backward");
    await flush(() =>
      window.dispatchEvent(
        new window.KeyboardEvent("keydown", { key: "ArrowRight" }),
      ),
    );
    assert.equal(counterText(), "3 / 3", "right arrow key navigates forward");

    // Zoom in via double click, then confirm navigating away resets it.
    await flush(() =>
      imgByAlt("Third").dispatchEvent(
        new window.MouseEvent("dblclick", { bubbles: true }),
      ),
    );
    assert.match(
      imgByAlt("Third").style.transform,
      /scale\(2\.5\)/,
      "double-click zooms to ~2.5x",
    );
    await flush(() =>
      window.dispatchEvent(
        new window.KeyboardEvent("keydown", { key: "ArrowRight" }),
      ),
    );
    assert.match(
      imgByAlt("First").style.transform,
      /scale\(1\)/,
      "zoom resets after navigating to a new image",
    );

    // Zoom +/- controls.
    await click(document.querySelector('[aria-label="Zoom in"]'));
    assert.match(imgByAlt("First").style.transform, /scale\(1\.5\)/);
    await click(document.querySelector('[aria-label="Zoom out"]'));
    assert.match(imgByAlt("First").style.transform, /scale\(1\)/);

    // Dismissal: Escape, backdrop click, and clicking the image itself (should NOT close).
    closedCount = 0;
    await flush(() =>
      window.dispatchEvent(
        new window.KeyboardEvent("keydown", { key: "Escape" }),
      ),
    );
    assert.equal(closedCount, 1, "Escape key closes the lightbox");

    closedCount = 0;
    await click(imgByAlt("First"));
    assert.equal(
      closedCount,
      0,
      "clicking the image itself does not close the lightbox",
    );

    closedCount = 0;
    await click(dialog());
    assert.equal(
      closedCount,
      1,
      "clicking the dark backdrop closes the lightbox",
    );

    // Listeners must be removed on unmount.
    await flush(() => root.unmount());
    closedCount = 0;
    window.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: "Escape" }),
    );
    assert.equal(closedCount, 0, "keydown listener is removed after unmount");
  } finally {
    root.unmount();
    await server.close();
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});

test("ChatDashboard: image click opens lightbox at the right index and multi-image batches send sequentially with partial-failure reporting", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost" });
  const globals = [
    "window",
    "document",
    "navigator",
    "localStorage",
    "WebSocket",
    "fetch",
    "IS_REACT_ACT_ENVIRONMENT",
  ];
  const descriptors = new Map(
    globals.map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  for (const key of ["window", "document", "navigator", "localStorage"]) {
    Object.defineProperty(globalThis, key, {
      configurable: true,
      value: dom.window[key],
    });
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.WebSocket = { OPEN: 1 };
  globalThis.fetch = () => {
    throw new Error("Unexpected network request in local test");
  };
  window.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  });
  window.HTMLElement.prototype.scrollIntoView = () => {};
  const nativeSetInterval = globalThis.setInterval;
  const nativeClearInterval = globalThis.clearInterval;
  const intervals = new Map();
  globalThis.setInterval = (callback, delay) => {
    const timer = Symbol();
    intervals.set(timer, { callback, delay });
    return timer;
  };
  globalThis.clearInterval = (timer) => intervals.delete(timer);
  const server = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    server: { middlewareMode: true },
    appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  const { React, act, createRoot } =
    await server.ssrLoadModule("/tests/runtime.jsx");
  const root = createRoot(document.getElementById("root"));
  try {
    const { userService } = await server.ssrLoadModule("/src/services/user.js");
    const { conversationService } = await server.ssrLoadModule(
      "/src/services/conversations.js",
    );
    const { websocketService } = await server.ssrLoadModule(
      "/src/services/websocket.js",
    );
    const { default: ChatDashboard } = await server.ssrLoadModule(
      "/src/components/ChatDashboard.jsx",
    );

    const peer = {
      user_id: "peer",
      username: "peer_two",
      display_name: "Peer Two",
      avatar_url: null,
      status: "online",
      last_seen: null,
    };
    const me = { user_id: "me", username: "tester", display_name: "Tester" };
    const img1 = {
      message_id: "img1",
      sender_id: "peer",
      sender_name: "Peer Two",
      sender_avatar: null,
      content: "",
      created_at: "2026-09-15T12:00:00Z",
      message_type: "image",
      media_url: "/img-1.jpg",
    };
    const img2 = { ...img1, message_id: "img2", media_url: "/img-2.jpg" };
    const img3 = { ...img1, message_id: "img3", media_url: "/img-3.jpg" };
    const textMsg = {
      message_id: "text1",
      sender_id: "me",
      sender_name: "Tester",
      sender_avatar: null,
      content: "hello",
      created_at: "2026-09-15T12:00:01Z",
      message_type: "text",
    };

    let uploadResolvers = [];

    userService.getProfile = async () => me;
    userService.getBlockedUsers = async () => [];
    userService.getBlockedByUsers = async () => [];
    userService.searchUsers = async () => [];
    conversationService.listConversations = async () => [
      {
        conversation_id: "direct",
        type: "direct",
        other_participant: peer,
        participants: [me, peer],
        last_message: { ...textMsg },
      },
    ];
    conversationService.getMessages = async () => [img1, textMsg, img2, img3];
    conversationService.getPinnedMessages = async () => [];
    conversationService.sendMessage = async (conversationId, payload) => ({
      message_id: payload.client_message_id,
      status: "sent",
    });
    conversationService.uploadFile = (file) =>
      new Promise((resolve, reject) => {
        uploadResolvers.push({ file, resolve, reject });
      });
    websocketService.connect = () => ({
      readyState: 1,
      send() {},
      close() {},
    });

    const flush = async (callback = () => {}) => {
      await act(async () => {
        await callback();
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    };
    const click = async (element) => {
      assert.ok(element, "expected clickable element");
      await flush(() =>
        element.dispatchEvent(
          new window.MouseEvent("click", { bubbles: true }),
        ),
      );
    };
    const select = async (label) =>
      click(
        [...document.querySelectorAll(".ht-sidebar *")].find(
          (element) =>
            element.children.length === 0 &&
            element.textContent.trim() === label,
        ),
      );
    const dialog = () => document.querySelector('[aria-label="Image viewer"]');
    const counterText = () => dialog().textContent.match(/\d+ \/ \d+/)[0];
    const setFiles = async (files) => {
      const fileInput = document.querySelector(
        '.ht-chat-pane input[type="file"]',
      );
      assert.ok(fileInput, "expected the attachment file input");
      assert.equal(
        fileInput.multiple,
        true,
        "file input must allow multiple selection",
      );
      Object.defineProperty(fileInput, "files", {
        configurable: true,
        value: files,
      });
      await flush(() =>
        fileInput.dispatchEvent(new window.Event("change", { bubbles: true })),
      );
    };
    const progressText = () =>
      document.querySelector(".ht-chat-input-form")?.textContent || "";

    await flush(() =>
      root.render(
        React.createElement(ChatDashboard, {
          user: { userId: "me", username: "tester", token: "test-only" },
          onLogout() {},
        }),
      ),
    );
    await flush();
    await select("Peer Two");

    // (a) clicking an image opens the lightbox at the right index.
    const thumbnails = () =>
      [...document.querySelectorAll(".ht-message-stream img")].filter((el) =>
        el.src.includes("img-"),
      );
    assert.equal(thumbnails().length, 3, "three image messages rendered");
    const secondThumb = thumbnails().find((el) => el.src.includes("img-2"));
    await click(secondThumb);
    assert.ok(dialog(), "lightbox opens on image click");
    assert.equal(
      counterText(),
      "2 / 3",
      "lightbox opens at the clicked image's index",
    );

    // (b) next/prev navigation cycles through all image messages.
    await click(document.querySelector('[aria-label="Next image"]'));
    assert.equal(counterText(), "3 / 3");
    await click(document.querySelector('[aria-label="Next image"]'));
    assert.equal(
      counterText(),
      "1 / 3",
      "navigation cycles back to the first image",
    );
    await click(document.querySelector('[aria-label="Previous image"]'));
    assert.equal(counterText(), "3 / 3");

    // (c) keyboard arrows navigate and Escape closes.
    await flush(() =>
      window.dispatchEvent(
        new window.KeyboardEvent("keydown", { key: "ArrowLeft" }),
      ),
    );
    assert.equal(counterText(), "2 / 3", "left arrow navigates backward");
    await flush(() =>
      window.dispatchEvent(
        new window.KeyboardEvent("keydown", { key: "Escape" }),
      ),
    );
    assert.equal(dialog(), null, "Escape closes the lightbox");

    // (d) zoom resets when navigating (isolated unit test covers this directly against
    // ImageLightbox; re-open here and confirm state starts fresh each time).
    await click(thumbnails()[0]);
    assert.equal(counterText(), "1 / 3");
    const currentImg = () =>
      document.querySelector('[aria-label="Image viewer"] img');
    assert.match(
      currentImg().style.transform,
      /scale\(1\)/,
      "reopening starts at 1x zoom",
    );
    await flush(() =>
      window.dispatchEvent(
        new window.KeyboardEvent("keydown", { key: "Escape" }),
      ),
    );

    // (f) a single non-image file still follows the original (caption/preview) flow.
    const docFile = new window.File(["doc"], "report.pdf", {
      type: "application/pdf",
    });
    await setFiles([docFile]);
    assert.match(
      document.body.textContent,
      /report\.pdf/,
      "single non-image file shows the existing attachment preview",
    );
    assert.equal(
      uploadResolvers.length,
      0,
      "selecting a document alone must not auto-upload",
    );
    assert.equal(
      document.querySelectorAll(".ht-message-stream img").length,
      3,
      "no message was sent yet for the pending attachment",
    );
    // Clear the pending attachment without submitting, so it doesn't interfere with the batch test.
    const nameLabel = [...document.querySelectorAll(".ht-chat-pane div")].find(
      (d) => d.children.length === 0 && d.textContent.trim() === "report.pdf",
    );
    const attachmentContainer =
      nameLabel?.parentElement?.parentElement?.parentElement;
    const cancelBtn = attachmentContainer?.querySelector("button");
    assert.ok(cancelBtn, "expected the attachment cancel button");
    await click(cancelBtn);
    assert.doesNotMatch(
      document.body.textContent,
      /report\.pdf/,
      "cancelling the attachment removes its preview",
    );

    // (e) selecting multiple image files triggers sequential sends with progress updates,
    // and (g) a failed upload in the batch doesn't stop the rest.
    const batch1 = new window.File(["a"], "batch-1.png", { type: "image/png" });
    const batch2 = new window.File(["b"], "batch-2.png", { type: "image/png" });
    const batch3 = new window.File(["c"], "batch-3.png", { type: "image/png" });
    await setFiles([batch1, batch2, batch3]);

    assert.equal(uploadResolvers.length, 1, "first file uploads immediately");
    assert.match(progressText(), /Sending 1 of 3/);

    await flush(() =>
      uploadResolvers[0].resolve({ url: "/uploaded-batch-1.png" }),
    );
    assert.equal(
      uploadResolvers.length,
      2,
      "second upload only starts after the first completes (sequential, not parallel)",
    );
    assert.match(progressText(), /Sending 2 of 3/);

    await flush(() => uploadResolvers[1].reject(new Error("network error")));
    assert.equal(
      uploadResolvers.length,
      3,
      "a failure in the batch does not stop the remaining images",
    );
    assert.match(progressText(), /Sending 3 of 3/);

    await flush(() =>
      uploadResolvers[2].resolve({ url: "/uploaded-batch-3.png" }),
    );

    assert.equal(
      document.querySelector(".ht-upload-progress-container"),
      null,
      "progress indicator clears once the batch finishes",
    );
    assert.match(
      document.body.textContent,
      /1 of 3 images failed to send/,
      "batch failure summary reaches the existing error-toast mechanism",
    );
    assert.ok(
      document.querySelector('.ht-message-stream img[src*="uploaded-batch-1"]'),
      "first successful image was sent",
    );
    assert.ok(
      document.querySelector('.ht-message-stream img[src*="uploaded-batch-3"]'),
      "third successful image was sent despite the second one failing",
    );
    assert.equal(
      document.querySelector('.ht-message-stream img[src*="uploaded-batch-2"]'),
      null,
      "the failed image was not added as a message",
    );

    await flush(() => root.unmount());
  } finally {
    globalThis.setInterval = nativeSetInterval;
    globalThis.clearInterval = nativeClearInterval;
    await server.close();
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
