import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

test("presence settings save choices, accept synchronized settings, and report failures", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost" });
  const keys = ["window", "document", "navigator", "IS_REACT_ACT_ENVIRONMENT"];
  const descriptors = new Map(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const key of ["window", "document", "navigator"]) Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const server = await createServer({ root: fileURLToPath(new URL("../", import.meta.url)), server: { middlewareMode: true }, appType: "custom", optimizeDeps: { noDiscovery: true, include: [] } });
  const { React, act, createRoot } = await server.ssrLoadModule("/tests/runtime.jsx");
  const root = createRoot(document.getElementById("root"));
  try {
    const { default: PresenceSettings } = await server.ssrLoadModule("/src/components/settings/PresenceSettings.jsx");
    const { userService } = await server.ssrLoadModule("/src/services/user.js");
    let saved;
    userService.updatePresence = async (value) => { saved = value; return value; };
    const props = { profile: {}, onSaved: () => {}, themeTokens: { text: "#111", cardBg: "#fff" } };
    await act(async () => root.render(React.createElement(PresenceSettings, props)));
    const choose = async (label, text) => {
      await act(async () => document.querySelector(`button[aria-label="${label}"]`).click());
      await act(async () => [...document.querySelectorAll('[role="menuitemradio"]')].find((node) => node.textContent.startsWith(text)).click());
    };
    await choose("Presence visibility", "Invisible");
    await choose("Status preset", "Busy");
    await choose("Clear status after", "1 hour");
    const save = () => [...document.querySelectorAll("button")].find((node) => node.textContent === "Save status");
    await act(async () => save().click());
    assert.equal(saved.presence_visibility, "invisible");
    assert.equal(saved.custom_status, "Busy");
    assert.ok(Date.parse(saved.status_expires_at) > Date.now());
    assert.match(document.querySelector('[role="status"]').textContent, /saved/);
    await act(async () => root.render(React.createElement(PresenceSettings, { ...props, profile: { custom_status: "Sleeping", presence_visibility: "default" } })));
    assert.equal(document.querySelector('input[aria-label="Custom status"]').value, "Sleeping");
    userService.updatePresence = async () => { throw new Error("Unavailable"); };
    await act(async () => save().click());
    assert.equal(document.querySelector('[role="status"]').textContent, "Unavailable");
  } finally {
    await act(async () => root.unmount());
    await server.close(); dom.window.close();
    for (const [key, descriptor] of descriptors) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  }
});