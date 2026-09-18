import test from "node:test";
import assert from "node:assert/strict";
import { groupMemberActions, mustTransferBeforeLeaving } from "../src/utils/groupPolicy.js";
import { JSDOM } from "jsdom";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

test("group actions respect membership, owner, admin and last-owner boundaries", () => {
  const conversation = { type: "group", creator_id: "owner", participants: [
    { user_id: "owner", role: "admin" }, { user_id: "admin", role: "admin" }, { user_id: "member", role: "member" },
  ] };
  assert.equal(groupMemberActions(conversation, "owner", "member").length, 3);
  assert.equal(groupMemberActions(conversation, "owner", "admin")[0].is_admin, false);
  assert.equal(groupMemberActions(conversation, "admin", "member").length, 2);
  for (const actor of ["owner", "admin", "member", "outsider"]) {
    assert.deepEqual(groupMemberActions(conversation, actor, "owner"), []);
    assert.deepEqual(groupMemberActions(conversation, actor, actor), []);
  }
  assert.deepEqual(groupMemberActions(conversation, "member", "admin"), []);
  assert.equal(mustTransferBeforeLeaving(conversation, "owner"), true);
  assert.equal(mustTransferBeforeLeaving(conversation, "member"), false);
  assert.equal(mustTransferBeforeLeaving({ ...conversation, participants: conversation.participants.slice(0, 1) }, "owner"), false);
});

test("group changes wait for confirmation, prevent duplicate writes, retain failure and retry", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost" });
  const keys = ["window", "document", "navigator", "IS_REACT_ACT_ENVIRONMENT"];
  const descriptors = new Map(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const key of ["window", "document", "navigator"]) Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const server = await createServer({ root: fileURLToPath(new URL("../", import.meta.url)), server: { middlewareMode: true }, appType: "custom", optimizeDeps: { noDiscovery: true, include: [] } });
  const { React, act, createRoot } = await server.ssrLoadModule("/tests/runtime.jsx");
  const root = createRoot(document.getElementById("root"));
  try {
    const { default: useGroupManagement } = await server.ssrLoadModule("/src/hooks/useGroupManagement.js");
    const { conversationService } = await server.ssrLoadModule("/src/services/conversations.js");
    let controller;
    let finish;
    let requests = 0;
    const confirmed = [];
    conversationService.updateMembers = () => { requests++; return new Promise((resolve, reject) => { finish = { resolve, reject }; }); };
    function Fixture() { controller = useGroupManagement((...args) => confirmed.push(args)); return null; }
    await act(async () => root.render(React.createElement(Fixture)));
    let first;
    await act(async () => { first = controller.change("group", { action: "leave" }); });
    assert.equal(controller.pending, true);
    assert.deepEqual(confirmed, []);
    assert.equal(await controller.change("group", { action: "leave" }), false);
    assert.equal(requests, 1);
    await act(async () => { finish.reject(new Error("Transfer ownership first")); await first; });
    assert.equal(controller.error, "Transfer ownership first");
    assert.equal(controller.pending, false);
    assert.deepEqual(confirmed, []);
    let retry;
    await act(async () => { retry = controller.change("group", { action: "leave" }); });
    await act(async () => { finish.resolve({ status: "success" }); await retry; });
    assert.deepEqual(confirmed, [["group", { action: "leave" }]]);
    assert.equal(controller.error, null);
    assert.equal(controller.pending, false);
    const { default: GroupInfoModal } = await server.ssrLoadModule("/src/components/chat/Modals/GroupInfoModal.jsx");
    const { THEME } = await server.ssrLoadModule("/src/utils/theme.js");
    const conversation = { id: "group", type: "group", title: "Team", creator_id: "owner", participants: [
      { user_id: "owner", username: "Owner", role: "admin" },
      { user_id: "member", username: "Member", role: "member" },
    ] };
    const changes = [];
    const renderDialog = async (actor, pending = false, error = null) => act(async () => root.render(React.createElement(GroupInfoModal, {
      isGroupInfoOpen: true, setIsGroupInfoOpen() {}, activeConv: conversation,
      user: { userId: actor }, theme: "light", themeTokens: THEME.light,
      isUserGroupAdmin: (_conversation, id) => id === "owner", groupAvatarInputRef: { current: null },
      editGroupTitle: "Team", setEditGroupTitle() {}, setIsAddMemberOpen() {},
      groupManagement: { pending, error, change: (...args) => changes.push(args) },
    })));
    await renderDialog("owner");
    const leave = () => [...document.querySelectorAll("button")].find((button) => button.textContent === "Leave group");
    assert.equal(leave().disabled, true);
    const actions = document.querySelector('[aria-label="Actions for Member"]');
    assert.ok(actions);
    window.confirm = () => false;
    await act(async () => actions.click());
    await act(async () => [...document.querySelectorAll('[role="menuitem"]')].find((item) => item.textContent === "Remove member").click());
    assert.deepEqual(changes, []);
    window.confirm = () => true;
    await act(async () => actions.click());
    await act(async () => [...document.querySelectorAll('[role="menuitem"]')].find((item) => item.textContent === "Transfer ownership").click());
    assert.deepEqual(changes, [["group", { action: "transfer_ownership", target_user_id: "member" }]]);
    await renderDialog("owner", true, "Ownership transfer failed");
    assert.equal(document.querySelector('[aria-label="Actions for Member"]').disabled, true);
    assert.match(document.querySelector('[role="alert"]').textContent, /Ownership transfer failed/);
    await renderDialog("member");
    assert.equal(document.querySelector('[aria-label="Actions for Member"]'), null);
    assert.equal(document.querySelector("select"), null);
    assert.equal(leave().disabled, false);
    await act(async () => leave().click());
    assert.deepEqual(changes.at(-1), ["group", { action: "leave" }]);
  } finally {
    await act(async () => root.unmount());
    await server.close();
    dom.window.close();
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    }
  }
});