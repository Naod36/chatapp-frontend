import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";
import { organizedConversations } from "../src/utils/conversationOrganization.js";

test("organization views exclude archives from inbox and preserve folder membership", () => {
  const chats = [{ id: "direct", unread_count: 2 }, { id: "group", type: "group" }];
  const state = { archived_ids: ["direct"], folders: [{ id: "work", conversation_ids: ["direct", "group"] }] };
  assert.deepEqual(organizedConversations(chats, state, "all"), [chats[1]]);
  assert.deepEqual(organizedConversations(chats, state, "groups"), [chats[1]]);
  assert.deepEqual(organizedConversations(chats, state, "archived"), [chats[0]]);
  assert.deepEqual(organizedConversations(chats, state, "folder:work"), chats);
  assert.deepEqual(organizedConversations(chats, state, "folder:deleted"), []);
  assert.deepEqual(organizedConversations(chats, undefined, "all"), chats);
});

test("organization confirms mutations, ignores stale responses, refreshes across clients and isolates sessions", async () => {
  const dom = new JSDOM('<div id="root"></div>', { pretendToBeVisual: true });
  const keys = ["window", "document", "navigator", "IS_REACT_ACT_ENVIRONMENT"];
  const descriptors = new Map(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: dom.window.navigator });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const server = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    server: { middlewareMode: true, hmr: false }, appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  const { React, act, createRoot } = await server.ssrLoadModule("/tests/runtime.jsx");
  const { default: useOrganization } = await server.ssrLoadModule("/src/hooks/useConversationOrganization.js");
  const { organizationService } = await server.ssrLoadModule("/src/services/organization.js");
  const { default: OrganizationControls } = await server.ssrLoadModule("/src/components/chat/Sidebar/OrganizationControls.jsx");
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  const requests = [];
  const changes = [];
  organizationService.get = () => new Promise((resolve, reject) => requests.push({ resolve, reject }));
  organizationService.update = (change) => new Promise((resolve, reject) => changes.push({ change, resolve, reject }));
  const snapshot = (revision, archived_ids = []) => ({ revision, archived_ids, folders: [] });
  let current;
  function Probe({ token }) { current = useOrganization(token); return null; }
  const root = createRoot(document.getElementById("root"));
  try {
    await act(async () => root.render(React.createElement(Probe, { token: "first" })));
    await act(async () => requests[0].resolve(snapshot(0)));
    assert.equal(current.ready, true);
    await act(async () => { current.refresh(); });
    let mutation;
    await act(async () => { mutation = current.update({ action: "archive", conversation_id: "chat", archived: true }); });
    assert.deepEqual(current.archived_ids, [], "no optimistic archive");
    assert.equal(current.pending, true);
    await act(async () => { current.refresh(); current.update({ action: "delete_folder", folder_id: "folder" }); });
    assert.equal(requests.length, 2);
    assert.equal(changes.length, 1, "parallel mutations are disabled");
    await act(async () => { changes[0].resolve(snapshot(1, ["chat"])); await mutation; });
    await act(async () => requests[1].resolve(snapshot(0)));
    assert.deepEqual(current.archived_ids, ["chat"], "old GET cannot undo mutation");
    await act(async () => { mutation = current.update({ action: "archive", conversation_id: "chat", archived: false }); });
    await act(async () => { changes[1].reject(new Error("offline")); await mutation; });
    assert.equal(current.error, "offline");
    assert.deepEqual(current.archived_ids, ["chat"]);
    await act(async () => window.dispatchEvent(new window.Event("focus")));
    await act(async () => requests[2].resolve(snapshot(2)));
    assert.deepEqual(current.archived_ids, [], "focus sees other client's restore");
    assert.equal(current.error, null);
    const oldSession = current;
    await act(async () => { mutation = current.update({ action: "archive", conversation_id: "chat", archived: true }); });
    await act(async () => root.render(React.createElement(Probe, { token: "second" })));
    assert.equal(current.ready, false);
    await act(async () => { changes[2].resolve(snapshot(3, ["chat"])); await mutation; oldSession.refresh(); });
    assert.deepEqual(current.archived_ids, []);
    await act(async () => requests[3].resolve(snapshot(0, ["other"])));
    assert.deepEqual(current.archived_ids, ["other"]);
    await act(async () => { current.refresh(); });
    await act(async () => requests[4].reject(new Error("refresh offline")));
    assert.deepEqual(current.archived_ids, ["other"], "refresh errors preserve known organization");

    let controlState = { ...snapshot(0), ready: true, pending: false, error: null, folders: [{ id: "work", name: "Work", conversation_ids: [] }] };
    const controlChanges = [];
    let selectedView = "all";
    const renderControls = () => root.render(React.createElement(OrganizationControls, {
      organization: { ...controlState, refresh() {}, async update(change) { controlChanges.push(change); return true; } },
      conversations: [{ id: "chat", display_name: "Peer" }], view: selectedView,
      onViewChange(value) { selectedView = value; }, themeTokens: { text: "#222", sidebarBg: "#fff" },
    }));
    const click = async (element) => { assert.ok(element); await act(async () => element.click()); };
    const button = (text) => [...document.querySelectorAll("button")].find((element) => element.textContent === text);
    const changeValue = async (selector, value) => {
      const element = document.querySelector(selector);
      await act(async () => {
        const prototype = element.tagName === "SELECT" ? dom.window.HTMLSelectElement.prototype : dom.window.HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(prototype, "value").set.call(element, value);
        element.dispatchEvent(new window.Event(element.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
      });
    };
    await act(async () => renderControls());
    await click(button("Organize"));
    assert.ok(document.querySelector("dialog").open);
    await changeValue('[aria-label="New folder name"]', "Personal");
    await click(button("Create Folder"));
    assert.deepEqual(controlChanges.pop(), { action: "create_folder", name: "Personal" });
    await changeValue('[aria-label="Manage folder"]', "work");
    await click(document.querySelector('[aria-label="Include Peer in Work"]'));
    assert.deepEqual(controlChanges.pop(), { action: "set_membership", folder_id: "work", conversation_id: "chat", included: true });
    await click(document.querySelector('[aria-label="Archive Peer"]'));
    assert.deepEqual(controlChanges.pop(), { action: "archive", conversation_id: "chat", archived: true });
    controlState = { ...controlState, archived_ids: ["chat"], folders: [{ id: "work", name: "Work", conversation_ids: ["chat"] }] };
    await act(async () => renderControls());
    await click(document.querySelector('[aria-label="Include Peer in Work"]'));
    assert.equal(controlChanges.pop().included, false);
    await click(document.querySelector('[aria-label="Archive Peer"]'));
    assert.equal(controlChanges.pop().archived, false);
    await changeValue('[aria-label="Folder name"]', "Projects");
    await click(button("Rename"));
    assert.deepEqual(controlChanges.pop(), { action: "rename_folder", folder_id: "work", name: "Projects" });
    await click(button("Delete Folder"));
    assert.equal(controlChanges.length, 0, "deletion needs confirmation");
    await click(button("Cancel"));
    assert.equal(button("Confirm Delete"), undefined);
    await click(button("Delete Folder"));
    await click(button("Confirm Delete"));
    assert.deepEqual(controlChanges.pop(), { action: "delete_folder", folder_id: "work" });
    await click(button("Close"));
    assert.equal(document.querySelector("dialog"), null);
    assert.equal(document.activeElement, button("Organize"));
    await changeValue('[aria-label="Conversation collection"]', "archived");
    assert.equal(selectedView, "archived");
  } finally {
    await act(async () => root.unmount());
    await server.close();
    for (const key of keys) {
      if (descriptors.get(key)) Object.defineProperty(globalThis, key, descriptors.get(key));
      else delete globalThis[key];
    }
    dom.window.close();
  }
});