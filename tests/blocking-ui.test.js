import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

test("dashboard blocking wiring, refresh triggers, masking and send races", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost" });
  const globals = ["window", "document", "navigator", "localStorage", "WebSocket", "fetch", "IS_REACT_ACT_ENVIRONMENT"];
  const descriptors = new Map(globals.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const key of ["window", "document", "navigator", "localStorage"]) {
    Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.WebSocket = { OPEN: 1 };
  globalThis.fetch = () => { throw new Error("Unexpected network request in local test"); };
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
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
  const { React, act, createRoot } = await server.ssrLoadModule("/tests/runtime.jsx");
  const root = createRoot(document.getElementById("root"));
  try {
    const { userService } = await server.ssrLoadModule("/src/services/user.js");
    const { conversationService } = await server.ssrLoadModule("/src/services/conversations.js");
    const { websocketService } = await server.ssrLoadModule("/src/services/websocket.js");
    const { default: ChatDashboard } = await server.ssrLoadModule("/src/components/ChatDashboard.jsx");
    const { default: ChatArea } = await server.ssrLoadModule("/src/components/chat/ChatArea/ChatArea.jsx");
    const { THEME, renderMessageStatus } = await server.ssrLoadModule("/src/utils/theme.js");
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
    const sent = [];
    const peer = { user_id: "peer", username: "secret_handle", display_name: "Secret Identity", avatar_url: "/secret-avatar.jpg", status: "online", last_seen: "2026-09-15T12:00:00Z", bio: "Secret biography" };
    const me = { user_id: "me", username: "tester", display_name: "Tester" };
    const message = { message_id: "message", sender_id: "peer", sender_name: "Secret Identity", sender_avatar: "/secret-avatar.jpg", content: "Test history", created_at: "2026-09-15T12:00:00Z", message_type: "text", reactions: { like: ["peer"] } };
    const hiddenPeer = () => incoming.length ? { ...peer, display_name: "Person Not Available", username: "", avatar_url: null, status: null, last_seen: null, bio: "" } : peer;
    userService.getProfile = async () => me;
    userService.getBlockedUsers = async () => { outgoingCalls += 1; if (failBlockRefresh) throw new Error("Block refresh offline"); return outgoing.map((user_id) => ({ user_id })); };
    userService.getBlockedByUsers = async () => { incomingCalls += 1; return incoming; };
    userService.searchUsers = async () => [peer];
    userService.blockUser = async () => { outgoing = ["peer"]; };
    userService.unblockUser = async () => { unblockCalls += 1; outgoing = []; };
    conversationService.listConversations = async () => {
      listCalls += 1;
      return [
        { conversation_id: "direct", type: "direct", other_participant: hiddenPeer(), participants: [me, hiddenPeer()], last_message: { ...message, sender_id: "me", status: "read" } },
        { conversation_id: "group", type: "group", title: "Shared Group", participants: [me, hiddenPeer()], last_message: message },
      ];
    };
    conversationService.getMessages = async () => { historyCalls += 1; return [message, { ...message, message_id: "reply", sender_id: "me", sender_name: "Tester", sender_avatar: null, reply_to_id: "message", content: "Test reply", status: "read" }]; };
    conversationService.getPinnedMessages = async () => { pinCalls += 1; return [{ ...message, message_id: "pin-only", content: "Pinned history" }]; };
    conversationService.uploadFile = async () => {
      uploads += 1;
      return new Promise((resolve) => { releaseUpload = resolve; });
    };
    websocketService.connect = (_token, messageHandler, openHandler) => {
      onMessage = messageHandler;
      onOpen = openHandler;
      return { readyState: 1, send: (payload) => sent.push(JSON.parse(payload)), close() {} };
    };
    const flush = async (callback = () => {}) => {
      await act(async () => {
        await callback();
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    };
    const click = async (element) => {
      assert.ok(element, "expected clickable element");
      await flush(() => element.dispatchEvent(new window.MouseEvent("click", { bubbles: true })));
    };
    const button = (label) => [...document.querySelectorAll("button")].find((element) => element.textContent.trim() === label);
    const select = async (label) => click([...document.querySelectorAll(".ht-sidebar *")].find((element) => element.children.length === 0 && element.textContent.trim() === label));
    const changeText = async (element, value) => flush(() => {
      const prototype = element.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, "value").set.call(element, value);
      element.dispatchEvent(new window.Event("input", { bubbles: true }));
    });
    await flush(() => root.render(React.createElement(ChatDashboard, { user: { userId: "me", username: "tester", token: "test-only" }, onLogout() {} })));
    await flush();
    assert.ok(intervals.size > 0);
    const poll = [...intervals.values()].find((timer) => timer.delay === 12000);
    assert.ok(poll, "block list fallback must be bounded at 12 seconds");
    await select("Secret Identity");
    assert.ok(document.querySelector("textarea"), "unblocked direct composer exists");

    await click(document.querySelector('[title="Conversation Options"]'));
    failBlockRefresh = true;
    await click(button("Block User"));
    assert.equal(document.querySelector("textarea"), null, "acknowledged block stays locked when refresh fails");
    await click(document.querySelector('[title="Conversation Options"]'));
    assert.ok(button("Unblock User"), "acknowledged outgoing block is retained after refresh failure");
    await click(document.querySelector('[title="Conversation Options"]'));
    failBlockRefresh = false;
    outgoing = ["peer"];
    await flush(() => onMessage({ event: "block_state_changed" }));
    await flush();
    assert.equal(document.querySelector("textarea"), null, "outgoing block reaches ChatArea");
    assert.match(document.querySelector(".ht-chat-header").textContent, /Secret Identity/);
    await click(document.querySelector('[title="Conversation Options"]'));
    assert.ok(button("Unblock User"));
    const searchInput = document.querySelector('.ht-sidebar input[type="text"]');
    await changeText(searchInput, "secret");
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 340)); });
    assert.match(document.querySelector(".ht-sidebar").textContent, /Secret Identity/, "blocker can still search the peer");
    await changeText(searchInput, "");

    incoming = ["peer"];
    await flush(() => onMessage({ event: "block_state_changed" }));
    await flush();
    assert.equal(document.querySelector("textarea"), null);
    assert.doesNotMatch(document.body.textContent, /Secret Identity|secret_handle|Secret biography/);
    assert.equal(document.querySelector('img[src*="secret-avatar"]'), null);
    assert.ok(button("Unblock User"), "mutual block must preserve own unblock");
    await click(button("Unblock User"));
    assert.equal(unblockCalls, 1);
    assert.equal(document.querySelector("textarea"), null, "incoming block still locks composer after own unblock");
    await changeText(searchInput, "secret");
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 340)); });
    assert.doesNotMatch(document.querySelector(".ht-sidebar").textContent, /Secret Identity|secret_handle/);
    await changeText(searchInput, "");

    await select("Shared Group");
    assert.ok(document.querySelector("textarea"), "group remains usable");
    await flush(() => onMessage({ event: "typing_status", conversation_id: "group", user_id: "peer", is_typing: true }));
    assert.equal(document.querySelector('[aria-label="Contact is typing"]'), null);
    await click(document.querySelector('[title="Toggle Conversation Inspector"]'));
    assert.doesNotMatch(document.body.textContent, /Secret Identity|secret_handle|Secret biography/);
    assert.equal(document.querySelector('img[src*="secret-avatar"]'), null);

    const previousFetches = [listCalls, historyCalls, pinCalls];
    incoming = [];
    await flush(() => window.dispatchEvent(new window.Event("focus")));
    await flush();
    assert.ok(listCalls > previousFetches[0] && historyCalls > previousFetches[1] && pinCalls > previousFetches[2], "unblock refetches conversations, history and pins");
    assert.match(document.body.textContent, /Secret Identity/);
    assert.ok(document.querySelector('img[src*="secret-avatar"]'));
    const unchangedFetches = [listCalls, historyCalls, pinCalls];
    await flush(() => poll.callback());
    await flush(() => onOpen());
    await flush();
    assert.deepEqual([listCalls, historyCalls, pinCalls], unchangedFetches, "unchanged block state must not loop data refreshes");
    assert.equal(outgoingCalls, incomingCalls, "every refresh fetches both directions");

    await select("Secret Identity");
    const fileInput = document.querySelector('.ht-chat-pane input[type="file"]');
    assert.ok(fileInput);
    Object.defineProperty(fileInput, "files", { configurable: true, value: [new window.File(["test"], "test.txt", { type: "text/plain" })] });
    await flush(() => fileInput.dispatchEvent(new window.Event("change", { bubbles: true })));
    await flush(() => document.querySelector("form.ht-chat-input-form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })));
    assert.equal(uploads, 1);
    incoming = ["peer"];
    await flush(() => onMessage({ event: "block_state_changed" }));
    await flush(() => releaseUpload({ url: "/test-upload.txt" }));
    assert.equal(sent.filter((payload) => payload.action === "send_message").length, 0, "block during upload prevents send");

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
      const stream = { getTracks: () => [{ stop: () => { stoppedTracks += 1; } }] };
      Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: () => new Promise((resolve) => { releaseMic = resolve; }) } });
      const originalRecorder = Object.getOwnPropertyDescriptor(globalThis, "MediaRecorder");
      globalThis.MediaRecorder = class {
        constructor() { recorder = this; this.state = "inactive"; }
        start() { this.state = "recording"; }
        stop() { this.state = "inactive"; this.onstop?.(); }
      };
      const props = {
        activeConv: { id: "voice", type: "direct", display_name: "Peer", other_participant: peer },
        theme: "light", themeTokens: THEME.light, user: { userId: "me" }, messages: [], pinnedMessagesMap: {},
        getActiveTypingLabel: () => null, headerMenuRef: { current: null }, mutedConvIds: [],
        emojiPickerRef: { current: null }, fileInputRef: { current: null }, inputTextareaRef: { current: null },
        audioStreamRef: { current: null }, audioChunksRef: { current: [] }, mediaRecorderRef: { current: null }, recordingTimerRef: { current: null },
        canSendToConversation: () => allowed, setIsRecording() {}, setRecordingSeconds() {}, setIsUploading() {},
        socketRef: { current: { send: (payload) => sent.push(JSON.parse(payload)) } }, setMessages() {},
        API_BASE: "http://localhost", messageText: "", recordingSeconds: 0,
      };
      await flush(() => childRoot.render(React.createElement(ChatArea, props)));
      await click(document.querySelector('[title="Click to record voice message"]'));
      allowed = false;
      await flush(() => releaseMic(stream));
      assert.equal(recorder, undefined, "block while permission is pending prevents recording");
      assert.equal(stoppedTracks, 1);
      allowed = true;
      await click(document.querySelector('[title="Click to record voice message"]'));
      await flush(() => releaseMic(stream));
      assert.ok(recorder);
      globalThis.fetch = async () => {
        voiceUploads += 1;
        return new Promise((resolve) => { releaseVoiceUpload = resolve; });
      };
      props.audioChunksRef.current = [new Blob(["x".repeat(1100)])];
      let voicePromise;
      await flush(() => { voicePromise = recorder.onstop(); });
      assert.equal(voiceUploads, 1);
      allowed = false;
      await flush(async () => {
        releaseVoiceUpload({ ok: true, json: async () => ({ url: "/voice.webm" }) });
        await voicePromise;
      });
      assert.equal(sent.filter((payload) => payload.action === "send_message").length, 0, "block during voice upload prevents send");
      await recorder.onstop();
      assert.equal(voiceUploads, 1, "blocked recording cannot start another upload");
      if (originalRecorder) Object.defineProperty(globalThis, "MediaRecorder", originalRecorder);
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
      if (descriptors.get(key)) Object.defineProperty(globalThis, key, descriptors.get(key));
      else delete globalThis[key];
    }
    dom.window.close();
  }
});