import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

test("dashboard blocking wiring, refresh triggers, masking and send races", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost" });
  const globals = [
    "window",
    "document",
    "navigator",
    "localStorage",
    "WebSocket",
    "fetch",
    "Notification",
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
    const { organizationService } = await server.ssrLoadModule("/src/services/organization.js");
    organizationService.get = async () => ({ revision: 0, archived_ids: [], folders: [] });
    const { conversationService } = await server.ssrLoadModule(
      "/src/services/conversations.js",
    );
    const { websocketService } = await server.ssrLoadModule(
      "/src/services/websocket.js",
    );
    const { default: ChatDashboard } = await server.ssrLoadModule(
      "/src/components/ChatDashboard.jsx",
    );
    const { default: ChatArea } = await server.ssrLoadModule(
      "/src/components/chat/ChatArea/ChatArea.jsx",
    );
    const { THEME, renderMessageStatus } = await server.ssrLoadModule(
      "/src/utils/theme.js",
    );
    assert.equal(renderMessageStatus(null), null);
    let outgoing = [];
    let incoming = [];
    let onMessage;
    let onOpen;
    let listCalls = 0;
    let historyCalls = 0;
    let pinCalls = 0;
    let outgoingCalls = 0;
    let incomingCalls = 0;
    let uploads = 0;
    let unblockCalls = 0;
    let releaseUpload;
    let failBlockRefresh = false;
    let failConversations = true;
    let failHistory = false;
    let failSearch = false;
    let failProfile = true;
    const sent = [];
    const peer = {
      user_id: "peer",
      username: "secret_handle",
      display_name: "Secret Identity",
      avatar_url: "/secret-avatar.jpg",
      status: "online",
      last_seen: "2026-09-15T12:00:00Z",
      bio: "Secret biography",
    };
    const me = { user_id: "me", username: "tester", display_name: "Tester" };
    const message = {
      message_id: "message",
      sender_id: "peer",
      sender_name: "Secret Identity",
      sender_avatar: "/secret-avatar.jpg",
      content: "Test history",
      created_at: "2026-09-15T12:00:00Z",
      message_type: "text",
      reactions: { like: ["peer"] },
    };
    const hiddenPeer = () =>
      incoming.length
        ? {
            ...peer,
            display_name: "Person Not Available",
            username: "",
            avatar_url: null,
            status: null,
            last_seen: null,
            bio: "",
          }
        : peer;
    userService.getProfile = async () => me;
    userService.updateProfile = async (profile) => {
      if (failProfile) throw new Error("Profile save offline");
      Object.assign(me, profile);
    };
    userService.getBlockedUsers = async () => {
      outgoingCalls += 1;
      if (failBlockRefresh) throw new Error("Block refresh offline");
      return outgoing.map((user_id) => ({ user_id }));
    };
    userService.getBlockedByUsers = async () => {
      incomingCalls += 1;
      return incoming;
    };
    userService.searchUsers = async () => {
      if (failSearch) throw new Error("Search offline");
      return [peer];
    };
    userService.blockUser = async () => {
      outgoing = ["peer"];
    };
    userService.unblockUser = async () => {
      unblockCalls += 1;
      outgoing = [];
    };
    conversationService.listConversations = async () => {
      listCalls += 1;
      if (failConversations) throw new Error("Inbox offline");
      return [
        {
          conversation_id: "direct",
          type: "direct",
          other_participant: hiddenPeer(),
          participants: [me, hiddenPeer()],
          last_message: { ...message, sender_id: "me", status: "read" },
        },
        {
          conversation_id: "group",
          type: "group",
          title: "Shared Group",
          participants: [me, hiddenPeer()],
          last_message: message,
        },
      ];
    };
    conversationService.getMessages = async () => {
      historyCalls += 1;
      if (failHistory) throw new Error("History offline");
      return [
        message,
        {
          ...message,
          message_id: "reply",
          sender_id: "me",
          sender_name: "Tester",
          sender_avatar: null,
          reply_to_id: "message",
          content: "Test reply",
          status: "read",
        },
      ];
    };
    conversationService.getPinnedMessages = async () => {
      pinCalls += 1;
      return [
        { ...message, message_id: "pin-only", content: "Pinned history" },
      ];
    };
    conversationService.uploadFile = async () => {
      uploads += 1;
      return new Promise((resolve) => {
        releaseUpload = resolve;
      });
    };
    websocketService.connect = (_token, messageHandler, openHandler) => {
      onMessage = messageHandler;
      onOpen = openHandler;
      return {
        readyState: 1,
        send: (payload) => sent.push(JSON.parse(payload)),
        close() {},
      };
    };
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
    const button = (label) =>
      [...document.querySelectorAll("button")].find(
        (element) => element.textContent.trim() === label,
      );
    const select = async (label) =>
      click(
        [...document.querySelectorAll(".ht-sidebar *")].find(
          (element) =>
            element.children.length === 0 &&
            element.textContent.trim() === label,
        ),
      );
    const changeText = async (element, value) =>
      flush(() => {
        const prototype =
          element.tagName === "TEXTAREA"
            ? window.HTMLTextAreaElement.prototype
            : window.HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(prototype, "value").set.call(
          element,
          value,
        );
        element.dispatchEvent(new window.Event("input", { bubbles: true }));
      });
    await flush(() =>
      root.render(
        React.createElement(ChatDashboard, {
          user: { userId: "me", username: "tester", token: "test-only" },
          onLogout() {},
        }),
      ),
    );
    await flush();
    assert.match(document.querySelector('.ht-sidebar [role="alert"]').textContent, /Could not load conversations/);
    assert.doesNotMatch(document.querySelector(".ht-sidebar").textContent, /No messages yet/);
    failConversations = false;
    await click(document.querySelector('[aria-label="Retry conversations"]'));
    assert.equal(document.querySelector('.ht-sidebar [role="alert"]'), null);
    await click(document.querySelector('[title="Profile Details"]'));
    await changeText(document.querySelector('[placeholder="Enter your display name"]'), "Unsaved profile");
    const submitProfile = () => document.querySelector(".ht-sidebar form")
      .dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    await flush(submitProfile);
    assert.match(document.body.textContent, /Profile save offline/);
    assert.equal(document.querySelector('[placeholder="Enter your display name"]').value, "Unsaved profile");
    assert.equal(button("Save Profile").disabled, false);
    failProfile = false;
    await flush(submitProfile);
    assert.match(document.querySelector(".ht-sidebar").textContent, /Profile updated successfully/);
    assert.doesNotMatch(document.body.textContent, /Profile save offline/);
    const normalUpload = conversationService.uploadFile;
    conversationService.uploadFile = async () => { throw new Error("Avatar upload offline"); };
    const avatarInput = document.querySelector('.ht-sidebar input[type="file"]');
    Object.defineProperty(avatarInput, "files", { configurable: true, value: [new window.File(["image"], "avatar.png", { type: "image/png" })] });
    await flush(() => avatarInput.dispatchEvent(new window.Event("change", { bubbles: true })));
    assert.match(document.body.textContent, /Avatar upload offline/);
    assert.equal(avatarInput.value, "");
    conversationService.uploadFile = normalUpload;
    await click(document.querySelector('[title="Messages"]'));
    failSearch = true;
    await changeText(document.querySelector('[placeholder="Search user profile..."]'), "secret");
    await flush(() => new Promise((resolve) => setTimeout(resolve, 350)));
    assert.match(document.querySelector('.ht-sidebar [role="alert"]').textContent, /Could not search users/);
    assert.doesNotMatch(document.querySelector(".ht-sidebar").textContent, /No matching nodes/);
    failSearch = false;
    await click(document.querySelector('[aria-label="Retry search"]'));
    await flush(() => new Promise((resolve) => setTimeout(resolve, 350)));
    assert.match(document.querySelector(".ht-sidebar").textContent, /Secret Identity/);
    const normalSearch = userService.searchUsers;
    let finishOldSearch;
    userService.searchUsers = (query) => query === "old"
      ? new Promise((resolve) => { finishOldSearch = resolve; })
      : normalSearch(query);
    await changeText(document.querySelector('[placeholder="Search user profile..."]'), "old");
    await flush(() => new Promise((resolve) => setTimeout(resolve, 350)));
    await changeText(document.querySelector('[placeholder="Search user profile..."]'), "new");
    await flush(() => new Promise((resolve) => setTimeout(resolve, 350)));
    await flush(() => finishOldSearch([]));
    assert.match(document.querySelector(".ht-sidebar").textContent, /Secret Identity/,
      "an old search cannot replace the latest results");
    userService.searchUsers = normalSearch;
    await changeText(document.querySelector('[placeholder="Search user profile..."]'), "");
    assert.ok(intervals.size > 0);
    const rail = document.querySelector(".ht-rail");
    const originalRailBounds = rail.getBoundingClientRect;
    rail.getBoundingClientRect = () => ({ width: 210 });
    await flush(() => document.querySelector('[title="Drag to resize inbox sidebar"]')
      .dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true })));
    await flush(() => window.dispatchEvent(new window.MouseEvent("mousemove", { clientX: 550 })));
    assert.equal(document.querySelector(".ht-sidebar").style.width, "340px",
      "expanded navigation width is subtracted when resizing");
    await flush(() => window.dispatchEvent(new window.MouseEvent("mouseup")));
    rail.getBoundingClientRect = originalRailBounds;
    const poll = [...intervals.values()].find((timer) => timer.delay === 12000);
    assert.ok(poll, "block list fallback must be bounded at 12 seconds");
    failHistory = true;
    await select("Secret Identity");
    assert.match(document.querySelector('.ht-chat-pane [role="alert"]').textContent, /Could not load messages/);
    failHistory = false;
    await click(document.querySelector('[aria-label="Retry messages"]'));
    assert.equal(document.querySelector('.ht-chat-pane [role="alert"]'), null);
    assert.match(document.querySelector("#msg-message").textContent, /Test history/);
    const normalHistory = conversationService.getMessages;
    let rejectOldHistory;
    conversationService.getMessages = (id) => id === "group"
      ? new Promise((_resolve, reject) => { rejectOldHistory = reject; })
      : normalHistory(id);
    await select("Shared Group");
    assert.match(document.querySelector('.ht-chat-pane [role="status"]').textContent, /Loading messages/);
    await select("Secret Identity");
    await flush(() => rejectOldHistory(new Error("Stale history failure")));
    assert.equal(document.querySelector('.ht-chat-pane [role="alert"]'), null);
    assert.match(document.querySelector("#msg-message").textContent, /Test history/);
    conversationService.getMessages = normalHistory;
    assert.ok(
      document.querySelector("textarea"),
      "unblocked direct composer exists",
    );

    const compactView = () =>
      document.querySelector(".ht-app-container").dataset.compactView;
    assert.equal(compactView(), "chat");
    await click(document.querySelector('[title="Toggle Conversation Inspector"]'));
    assert.equal(compactView(), "details");
    await click(document.querySelector('[aria-label="Back to conversation"]'));
    assert.equal(compactView(), "chat");
    await click(document.querySelector('[aria-label="Back to conversations"]'));
    assert.equal(compactView(), "list");
    await click(document.querySelector('[aria-label="Open navigation"]'));
    assert.equal(compactView(), "navigation");
    await click(document.querySelector('[title="Preferences"]'));
    assert.equal(compactView(), "list");
    await click(document.querySelector('[aria-label="Open navigation"]'));
    await click(document.querySelector('[title="Messages"]'));
    await select("Secret Identity");
    assert.equal(compactView(), "chat", "reopening the selected chat shows its pane");

    let sounds = 0;
    let notifications = 0;
    window.AudioContext = class {
      currentTime = 0;
      constructor() { sounds++; }
      createOscillator() {
        return { frequency: { setValueAtTime() {} }, connect() {}, start() {}, stop() {} };
      }
      createGain() {
        return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} };
      }
      close() { return Promise.resolve(); }
    };
    globalThis.Notification = window.Notification = class {
      static permission = "granted";
      constructor() { notifications++; }
    };
    const originalHandler = onMessage;
    const notify = async (conversationId) => flush(() => onMessage({
      event: "new_message",
      conversation_id: conversationId,
      message_id: `notification-${sounds}-${notifications}`,
      sender_id: "peer",
      content: "Notification test",
      created_at: "2026-09-17T12:00:00Z",
      message_type: "text",
    }));
    await notify("group");
    assert.equal(sounds, 1);
    assert.equal(notifications, 1);
    await click(document.querySelector('[title="Preferences"]'));
    await select("Muted (Silent)");
    await notify("group");
    assert.equal(sounds, 1, "sound preference applies without reconnect");
    assert.equal(notifications, 2, "global audio toggle does not mute desktop alerts");
    await select("Sound Chimes Enabled");
    await click(document.querySelector('[title="Messages"]'));
    await click(document.querySelector('[title="Toggle Conversation Inspector"]'));
    await click(document.querySelector('.ht-inspector [title="Mute Notifications"]'));
    await click(document.querySelector('[aria-label="Back to conversation"]'));
    await select("Shared Group");
    await notify("direct");
    assert.equal(sounds, 1, "muted conversation does not play sound");
    assert.equal(notifications, 2, "muted conversation does not show desktop notification");
    await notify("another-chat");
    assert.equal(sounds, 2, "other unmuted conversations still play sound");
    assert.equal(notifications, 3);
    await select("Secret Identity");
    await click(document.querySelector('[title="Toggle Conversation Inspector"]'));
    await click(document.querySelector('.ht-inspector [title="Unmute Notifications"]'));
    await click(document.querySelector('[aria-label="Back to conversation"]'));
    await select("Shared Group");
    await notify("direct");
    assert.equal(sounds, 3, "unmute applies immediately");
    assert.equal(notifications, 4);
    assert.equal(onMessage, originalHandler, "preferences do not recreate the socket");
    delete window.AudioContext;
    delete window.Notification;
    delete globalThis.Notification;
    await select("Secret Identity");

    let pageHidden = true;
    Object.defineProperty(document, "hidden", { configurable: true, get: () => pageHidden });
    const readCount = () => sent.filter((payload) => payload.action === "read_conversation").length;
    const beforeHiddenMessage = readCount();
    await notify("direct");
    assert.equal(readCount(), beforeHiddenMessage, "hidden selected chat is not read");
    await click(document.querySelector('[title="Conversation Options"]'));
    await click(button("Pin Chat"));
    await click(document.querySelector('[aria-label="Unread conversations"]'));
    assert.equal(document.querySelector('[aria-label="Unread conversations"]').getAttribute("aria-pressed"), "true");
    assert.match(document.querySelector(".ht-sidebar").textContent, /Secret Identity/);
    assert.match(document.querySelector(".ht-sidebar").textContent, /Pinned Conversations/);
    assert.doesNotMatch(document.querySelector(".ht-sidebar").textContent, /Saved Messages/);
    assert.ok(document.querySelector("textarea"), "filter changes preserve the active composer");
    pageHidden = false;
    await flush(() => document.dispatchEvent(new window.Event("visibilitychange")));
    assert.equal(readCount(), beforeHiddenMessage + 1, "returning to visible loaded chat acknowledges it");
    assert.doesNotMatch(document.querySelector(".ht-sidebar").textContent, /Secret Identity|Pinned Conversations/,
      "read conversations disappear from both regular and pinned unread rows");
    assert.ok(document.querySelector("textarea"), "reading the last unread chat does not close it");
    const beforeOtherMessage = readCount();
    await notify("group");
    assert.equal(readCount(), beforeOtherMessage, "another conversation is not read");
    assert.match(document.querySelector(".ht-sidebar").textContent, /Shared Group/);
    assert.equal(document.querySelector('[aria-label="Unread conversations"]').textContent.trim(), "Unread (1)");
    await select("Shared Group");
    assert.match(document.querySelector(".ht-sidebar").textContent, /All caught up/);
    assert.equal(document.querySelector('[aria-label="Unread conversations"]').textContent.trim(), "Unread");
    await click(document.querySelector('[aria-label="Group conversations"]'));
    assert.match(document.querySelector(".ht-sidebar").textContent, /Shared Group/);
    assert.doesNotMatch(document.querySelector(".ht-convo-list").textContent, /Secret Identity/);
    await click(button("All Messages"));
    assert.match(document.querySelector(".ht-sidebar").textContent, /Saved Messages/);
    await select("Secret Identity");
    await click(document.querySelector('[title="Conversation Options"]'));
    await click(button("Unpin Chat"));
    const previousMatchMedia = window.matchMedia;
    window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
    await click(document.querySelector('[aria-label="Back to conversations"]'));
    const beforeListMessage = readCount();
    await notify("direct");
    assert.equal(readCount(), beforeListMessage, "compact inbox hides the selected conversation");
    await select("Secret Identity");
    await click(document.querySelector('[title="Toggle Conversation Inspector"]'));
    const beforeDetailsMessage = readCount();
    await notify("direct");
    assert.equal(readCount(), beforeDetailsMessage, "compact details do not acknowledge hidden messages");
    await click(document.querySelector('[aria-label="Back to conversation"]'));
    assert.ok(readCount() > beforeDetailsMessage, "returning from details acknowledges visible messages");
    window.matchMedia = previousMatchMedia;
    const stream = document.querySelector(".ht-message-stream");
    Object.defineProperty(stream, "scrollHeight", { configurable: true, value: 2000 });
    Object.defineProperty(stream, "clientHeight", { configurable: true, value: 500 });
    let scrollCalls = 0;
    const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;
    window.HTMLElement.prototype.scrollIntoView = () => { scrollCalls++; };
    stream.scrollTop = 200;
    await flush(() => stream.dispatchEvent(new window.Event("scroll")));
    const readsWhileUp = readCount();
    await flush(() => onMessage({
      event: "new_message", conversation_id: "direct", message_id: "scrolled-up-arrival",
      sender_id: "peer", content: "New message below", message_type: "text",
      created_at: "2026-09-17T12:05:00Z",
    }));
    assert.equal(scrollCalls, 0, "arrival preserves a scrolled-up reader's position");
    assert.equal(readCount(), readsWhileUp, "messages below the reader are not read");
    await flush(() => onMessage({ event: "message_edited", message_id: "scrolled-up-arrival", content: "Edited below" }));
    assert.equal(scrollCalls, 0, "edits do not trigger auto-scroll");
    stream.scrollTop = 1500;
    await flush(() => stream.dispatchEvent(new window.Event("scroll")));
    assert.ok(readCount() > readsWhileUp, "scrolling to the bottom acknowledges the conversation");
    await flush(() => onMessage({
      event: "new_message", conversation_id: "direct", message_id: "bottom-arrival",
      sender_id: "peer", content: "Follow this message", message_type: "text",
      created_at: "2026-09-17T12:06:00Z",
    }));
    assert.equal(scrollCalls, 1, "near-bottom arrivals keep following the conversation");
    window.HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    delete stream.scrollHeight;
    delete stream.clientHeight;
    delete document.hidden;

    const openMessageMenu = async (id) => flush(() =>
      document.querySelector(`#msg-${id} .ht-msg-bubble`).dispatchEvent(
        new window.MouseEvent("contextmenu", { bubbles: true, clientX: 100, clientY: 100 }),
      ),
    );
    await select("Secret Identity");
    await openMessageMenu("reply");
    await click(button("Delete Message"));
    assert.ok(document.querySelector("#msg-reply"), "pending delete keeps confirmed message visible");
    assert.match(document.querySelector('.ht-chat-pane [role="status"]').textContent, /delete message/);
    const deleteSends = sent.filter((payload) => payload.action === "delete_message").length;
    await openMessageMenu("reply");
    await click(button("Delete Message"));
    assert.equal(sent.filter((payload) => payload.action === "delete_message").length, deleteSends,
      "duplicate pending deletes are not sent");
    await flush(() => onMessage({ event: "message_deleted", message_id: "reply", conversation_id: "direct" }));
    assert.equal(document.querySelector("#msg-reply"), null);
    assert.equal(document.querySelector('.ht-chat-pane [role="status"]'), null);

    await select("Secret Identity");
    await openMessageMenu("reply");
    await click(button("Edit Message"));
    await changeText(document.querySelector("textarea"), "Updated reply");
    await flush(() => document.querySelector("form.ht-chat-input-form")
      .dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })));
    assert.match(document.querySelector("#msg-reply").textContent, /Test reply/);
    assert.equal(document.querySelector("textarea").disabled, true);
    await flush(() => onMessage({ event: "error", message: "Edit was rejected" }));
    assert.equal(document.querySelector("textarea").value, "Updated reply", "rejected edit preserves draft");
    assert.equal(document.querySelector("textarea").disabled, false);
    await flush(() => document.querySelector("form.ht-chat-input-form")
      .dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })));
    await flush(() => onMessage({ event: "message_edited", conversation_id: "direct", message_id: "reply", content: "Updated reply" }));
    assert.match(document.querySelector("#msg-reply").textContent, /Updated reply/);
    assert.equal(document.querySelector("textarea").value, "");

    await openMessageMenu("reply");
    const reactionButton = [...document.querySelectorAll("button")].find((element) => element.textContent.trim() === String.fromCodePoint(0x1f44d));
    await click(reactionButton);
    assert.equal(document.querySelector('#msg-reply [title*="You"]'), null,
      "reaction is not optimistically toggled");
    const reactionAction = sent.findLast((payload) => payload.action === "react_message");
    await flush(() => onMessage({ event: "message_reacted", conversation_id: "direct", message_id: "reply", user_id: "me", emoji: reactionAction.emoji }));
    assert.ok(document.querySelector("#msg-reply").textContent.includes(reactionAction.emoji),
      "one echo adds the reaction instead of undoing an optimistic toggle");
    assert.equal(document.querySelector('.ht-chat-pane [role="status"]'), null);

    await click(document.querySelector('[title="Conversation Options"]'));
    failBlockRefresh = true;
    await click(button("Block User"));
    assert.equal(
      document.querySelector("textarea"),
      null,
      "acknowledged block stays locked when refresh fails",
    );
    await click(document.querySelector('[title="Conversation Options"]'));
    assert.ok(
      button("Unblock User"),
      "acknowledged outgoing block is retained after refresh failure",
    );
    await click(document.querySelector('[title="Conversation Options"]'));
    failBlockRefresh = false;
    outgoing = ["peer"];
    await flush(() => onMessage({ event: "block_state_changed" }));
    await flush();
    assert.equal(
      document.querySelector("textarea"),
      null,
      "outgoing block reaches ChatArea",
    );
    assert.match(
      document.querySelector(".ht-chat-header").textContent,
      /Secret Identity/,
    );
    await click(document.querySelector('[title="Conversation Options"]'));
    assert.ok(button("Unblock User"));
    const searchInput = document.querySelector(
      '.ht-sidebar input[type="text"]',
    );
    await changeText(searchInput, "secret");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 340));
    });
    assert.match(
      document.querySelector(".ht-sidebar").textContent,
      /Secret Identity/,
      "blocker can still search the peer",
    );
    await changeText(searchInput, "");

    incoming = ["peer"];
    await flush(() => onMessage({ event: "block_state_changed" }));
    await flush();
    assert.equal(document.querySelector("textarea"), null);
    assert.doesNotMatch(
      document.body.textContent,
      /Secret Identity|secret_handle|Secret biography/,
    );
    assert.equal(document.querySelector('img[src*="secret-avatar"]'), null);
    assert.ok(button("Unblock User"), "mutual block must preserve own unblock");
    await click(button("Unblock User"));
    assert.equal(unblockCalls, 1);
    assert.equal(
      document.querySelector("textarea"),
      null,
      "incoming block still locks composer after own unblock",
    );
    await changeText(searchInput, "secret");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 340));
    });
    assert.doesNotMatch(
      document.querySelector(".ht-sidebar").textContent,
      /Secret Identity|secret_handle/,
    );
    await changeText(searchInput, "");

    await select("Shared Group");
    assert.ok(document.querySelector("textarea"), "group remains usable");
    await flush(() =>
      onMessage({
        event: "typing_status",
        conversation_id: "group",
        user_id: "peer",
        is_typing: true,
      }),
    );
    assert.equal(
      document.querySelector('[aria-label="Contact is typing"]'),
      null,
    );
    await click(
      document.querySelector('[title="Toggle Conversation Inspector"]'),
    );
    assert.doesNotMatch(
      document.body.textContent,
      /Secret Identity|secret_handle|Secret biography/,
    );
    assert.equal(document.querySelector('img[src*="secret-avatar"]'), null);

    const previousFetches = [listCalls, historyCalls, pinCalls];
    incoming = [];
    await flush(() => window.dispatchEvent(new window.Event("focus")));
    await flush();
    assert.ok(
      listCalls > previousFetches[0] &&
        historyCalls > previousFetches[1] &&
        pinCalls > previousFetches[2],
      "unblock refetches conversations, history and pins",
    );
    assert.match(document.body.textContent, /Secret Identity/);
    assert.ok(document.querySelector('img[src*="secret-avatar"]'));
    const unchangedFetches = [listCalls, historyCalls, pinCalls];
    await flush(() => poll.callback());
    await flush(() => onOpen());
    await flush();
    assert.deepEqual(
      [listCalls, historyCalls, pinCalls],
      unchangedFetches,
      "unchanged block state must not loop data refreshes",
    );
    assert.equal(
      outgoingCalls,
      incomingCalls,
      "every refresh fetches both directions",
    );

    await select("Secret Identity");
    const fileInput = document.querySelector(
      '.ht-chat-pane input[type="file"]',
    );
    assert.ok(fileInput);
    await changeText(document.querySelector("textarea"), "Direct draft");
    assert.match(document.querySelector(".ht-sidebar").textContent, /Draft: Direct draft/);
    await select("Shared Group");
    assert.equal(document.querySelector("textarea").value, "");
    await changeText(document.querySelector("textarea"), "Group draft");
    await select("Secret Identity");
    assert.equal(document.querySelector("textarea").value, "Direct draft");
    assert.equal(JSON.parse(localStorage.getItem("flowchat:drafts:me")).group, "Group draft");
    await openMessageMenu("reply");
    await click(button("Edit Message"));
    await changeText(document.querySelector("textarea"), "Edited instead of drafted");
    assert.equal(JSON.parse(localStorage.getItem("flowchat:drafts:me")).direct, "Direct draft");
    await select("Shared Group");
    assert.equal(document.querySelector("textarea").value, "Group draft");
    await select("Secret Identity");
    assert.equal(document.querySelector("textarea").value, "Direct draft");
    const normalSend = conversationService.sendMessage;
    let failedClientId;
    conversationService.sendMessage = async (_conversation, payload) => {
      failedClientId = payload.client_message_id;
      throw new Error("Draft send offline");
    };
    const submitDraft = () => document.querySelector("form.ht-chat-input-form")
      .dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    await flush(submitDraft);
    assert.equal(document.querySelector("textarea").value, "Direct draft", "failed sends retain draft");
    assert.equal(JSON.parse(localStorage.getItem("flowchat:outbox:me"))[0].client_id, failedClientId);
    await select("Shared Group");
    assert.equal(document.querySelector('[aria-label="Retry failed message"]'), null);
    await select("Secret Identity");
    assert.ok(document.querySelector('[aria-label="Retry failed message"]'), "failed entry survives navigation");
    let copied;
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (text) => { copied = text; } } });
    await click(document.querySelector('[aria-label="Copy failed message"]'));
    assert.equal(copied, "Direct draft");
    let confirmDraft;
    let draftSends = 0;
    conversationService.sendMessage = (_conversation, payload) => {
      draftSends++;
      if (draftSends === 1) assert.equal(payload.client_message_id, failedClientId, "retry reuses original ID");
      return new Promise((resolve) => { confirmDraft = (result) => resolve({ ...result, message_id: payload.client_message_id }); });
    };
    await click(document.querySelector('[aria-label="Retry failed message"]'));
    await flush(submitDraft);
    assert.equal(draftSends, 1, "pending draft cannot be submitted twice");
    await select("Shared Group");
    await changeText(document.querySelector("textarea"), "New group draft");
    await select("Secret Identity");
    await changeText(document.querySelector("textarea"), "New direct draft");
    await flush(() => confirmDraft({ message_id: "draft-sent", status: "sent", sender_id: "me", content: "Direct draft" }));
    assert.equal(document.querySelector("textarea").value, "New direct draft", "late confirmation preserves newer text");
    await flush(submitDraft);
    assert.equal(document.querySelector(".ht-upload-progress-container"), null, "pending text sends do not show attachment upload progress");
    await select("Shared Group");
    await flush(() => confirmDraft({ message_id: "draft-sent-again", status: "sent", sender_id: "me", content: "New direct draft" }));
    assert.equal(document.querySelector("textarea").value, "New group draft", "confirmation cannot clear another conversation");
    await select("Secret Identity");
    assert.equal(document.querySelector("textarea").value, "", "successful send clears only its unchanged draft");
    assert.equal(JSON.parse(localStorage.getItem("flowchat:outbox:me")).length, 0);
    conversationService.sendMessage = async () => { throw new Error("Discard test offline"); };
    await changeText(document.querySelector("textarea"), "Discard this failed entry");
    await flush(submitDraft);
    await click(document.querySelector('[aria-label="Discard failed message"]'));
    assert.equal(document.querySelector('[aria-label="Retry failed message"]'), null);
    assert.equal(JSON.parse(localStorage.getItem("flowchat:outbox:me")).length, 0);
    assert.equal(document.querySelector("textarea").value, "Discard this failed entry", "discard does not delete the composer draft");
    await changeText(document.querySelector("textarea"), "");
    conversationService.sendMessage = normalSend;
    const oversizedImage = new window.File(["image"], "oversized.png", { type: "image/png" });
    Object.defineProperty(oversizedImage, "size", { value: 50_000_001 });
    for (const files of [[oversizedImage], [new window.File(["small"], "small.png", { type: "image/png" }), oversizedImage]]) {
      Object.defineProperty(fileInput, "files", { configurable: true, value: files });
      await flush(() => fileInput.dispatchEvent(new window.Event("change", { bubbles: true })));
      assert.match(document.body.textContent, /Attachments must be 50 MB or smaller/);
      assert.equal(uploads, 0, "invalid selection is rejected before any batch upload");
    }
    const paste = new window.Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(paste, "clipboardData", { value: { items: [{ kind: "file", getAsFile: () => oversizedImage }] } });
    await flush(() => document.querySelector("textarea").dispatchEvent(paste));
    assert.equal(paste.defaultPrevented, true);
    assert.equal(uploads, 0);
    assert.equal(document.querySelector('img[alt="Preview"]'), null);
    Object.defineProperty(fileInput, "files", {
      configurable: true,
      value: [new window.File(["test"], "test.txt", { type: "text/plain" })],
    });
    await flush(() =>
      fileInput.dispatchEvent(new window.Event("change", { bubbles: true })),
    );
    await flush(() =>
      document
        .querySelector("form.ht-chat-input-form")
        .dispatchEvent(
          new window.Event("submit", { bubbles: true, cancelable: true }),
        ),
    );
    assert.equal(uploads, 1);
    incoming = ["peer"];
    await flush(() => onMessage({ event: "block_state_changed" }));
    await flush(() => releaseUpload({ url: "/test-upload.txt" }));
    assert.equal(
      sent.filter((payload) => payload.action === "send_message").length,
      0,
      "block during upload prevents send",
    );

    await flush(() => root.unmount());
    assert.equal(intervals.size, 0, "all polling timers cleaned up");
    const childRoot = createRoot(document.getElementById("root"));
    try {
      let allowed = true;
      let releaseMic;
      let releaseVoiceUpload;
      let stoppedTracks = 0;
      let voiceUploads = 0;
      let recorder;
      const stream = {
        getTracks: () => [
          {
            stop: () => {
              stoppedTracks += 1;
            },
          },
        ],
      };
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          getUserMedia: () =>
            new Promise((resolve) => {
              releaseMic = resolve;
            }),
        },
      });
      const originalRecorder = Object.getOwnPropertyDescriptor(
        globalThis,
        "MediaRecorder",
      );
      globalThis.MediaRecorder = class {
        constructor() {
          recorder = this;
          this.state = "inactive";
        }
        start() {
          this.state = "recording";
        }
        stop() {
          this.state = "inactive";
          this.onstop?.();
        }
      };
      const props = {
        activeConv: {
          id: "voice",
          type: "direct",
          display_name: "Peer",
          other_participant: peer,
        },
        theme: "light",
        themeTokens: THEME.light,
        user: { userId: "me" },
        messages: [],
        pinnedMessagesMap: {},
        getActiveTypingLabel: () => null,
        headerMenuRef: { current: null },
        mutedConvIds: [],
        emojiPickerRef: { current: null },
        fileInputRef: { current: null },
        inputTextareaRef: { current: null },
        audioStreamRef: { current: null },
        audioChunksRef: { current: [] },
        mediaRecorderRef: { current: null },
        recordingTimerRef: { current: null },
        canSendToConversation: () => allowed,
        setIsRecording() {},
        setRecordingSeconds() {},
        setIsUploading(value) { props.isUploading = value; },
        setUploadProgress(value) { props.uploadProgress = value; },
        socketRef: {
          current: { send: (payload) => sent.push(JSON.parse(payload)) },
        },
        setMessages() {},
        API_BASE: "http://localhost",
        messageText: "",
        recordingSeconds: 0,
      };
      await flush(() => childRoot.render(React.createElement(ChatArea, props)));
      await click(
        document.querySelector('[title="Click to record voice message"]'),
      );
      allowed = false;
      await flush(() => releaseMic(stream));
      assert.equal(
        recorder,
        undefined,
        "block while permission is pending prevents recording",
      );
      assert.equal(stoppedTracks, 1);
      allowed = true;
      await click(
        document.querySelector('[title="Click to record voice message"]'),
      );
      await flush(() => releaseMic(stream));
      assert.ok(recorder);
      conversationService.uploadFile = async (file, onProgress) => {
        voiceUploads += 1;
        assert.equal(file.type, "audio/webm");
        onProgress({ percentage: 50, loadedFormatted: "0.5 MB", totalFormatted: "1.0 MB" });
        return new Promise((resolve) => {
          releaseVoiceUpload = resolve;
        });
      };
      props.audioChunksRef.current = [new Blob(["x".repeat(1100)])];
      let voicePromise;
      await flush(() => {
        voicePromise = recorder.onstop();
      });
      assert.equal(voiceUploads, 1);
      await flush(() => childRoot.render(React.createElement(ChatArea, props)));
      assert.match(document.querySelector(".ht-upload-progress-container").parentElement.textContent, /Uploading voice message/);
      assert.match(document.querySelector(".ht-upload-progress-container").parentElement.textContent, /50%/);
      allowed = false;
      await flush(async () => {
        releaseVoiceUpload({ url: "/voice.webm" });
        await voicePromise;
      });
      assert.equal(props.isUploading, false, "voice upload indicator clears after transfer");
      assert.equal(
        sent.filter((payload) => payload.action === "send_message").length,
        0,
        "block during voice upload prevents send",
      );
      await recorder.onstop();
      assert.equal(
        voiceUploads,
        1,
        "blocked recording cannot start another upload",
      );
      if (originalRecorder)
        Object.defineProperty(globalThis, "MediaRecorder", originalRecorder);
      else delete globalThis.MediaRecorder;
    } finally {
      await act(async () => childRoot.unmount());
    }
  } finally {
    await act(async () => root.unmount());
    await server.close();
    globalThis.setInterval = nativeSetInterval;
    globalThis.clearInterval = nativeClearInterval;
    for (const key of globals) {
      if (descriptors.get(key))
        Object.defineProperty(globalThis, key, descriptors.get(key));
      else delete globalThis[key];
    }
    dom.window.close();
  }
});
