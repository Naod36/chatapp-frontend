import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

test("custom choice menu supports keyboard selection, dismissal, disabled state and long labels", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost" });
  const keys = ["window", "document", "navigator", "IS_REACT_ACT_ENVIRONMENT"];
  const descriptors = new Map(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const key of ["window", "document", "navigator"]) Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const server = await createServer({ root: fileURLToPath(new URL("../", import.meta.url)), server: { middlewareMode: true }, appType: "custom", optimizeDeps: { noDiscovery: true, include: [] } });
  const { React, act, createRoot } = await server.ssrLoadModule("/tests/runtime.jsx");
  const root = createRoot(document.getElementById("root"));
  try {
    const { default: ChoiceMenu } = await server.ssrLoadModule("/src/components/ChoiceMenu.jsx");
    const changes = [];
    const props = { label: "Duration", value: "off", options: [{ value: "off", label: "Not muted" }, { value: "hour", label: "1 hour" }, { value: "forever", label: "Until unmuted" }], onChange: (value) => changes.push(value), themeTokens: { text: "#111", cardBg: "#fff" } };
    await act(async () => root.render(React.createElement(ChoiceMenu, props)));
    const trigger = document.querySelector("button");
    const key = async (value) => act(async () => document.activeElement.dispatchEvent(new window.KeyboardEvent("keydown", { key: value, bubbles: true })));
    trigger.focus();
    await key("ArrowDown");
    assert.equal(document.activeElement.textContent, "Not muted✓");
    await key("ArrowDown");
    assert.equal(document.activeElement.textContent, "1 hour");
    await act(async () => document.activeElement.click());
    assert.deepEqual(changes, ["hour"]);
    assert.equal(document.activeElement, trigger);
    assert.equal(document.querySelector('[role="menu"]'), null);
    await act(async () => trigger.click());
    await key("End");
    assert.equal(document.activeElement.textContent, "Until unmuted");
    await key("Escape");
    assert.equal(document.activeElement, trigger);
    await act(async () => trigger.click());
    await act(async () => document.body.dispatchEvent(new window.Event("pointerdown", { bubbles: true })));
    assert.equal(document.querySelector('[role="menu"]'), null);
    await act(async () => root.render(React.createElement(ChoiceMenu, { ...props, disabled: true })));
    assert.equal(trigger.disabled, true);
    assert.equal(document.querySelector("select"), null);
  } finally {
    await act(async () => root.unmount());
    await server.close(); dom.window.close();
    for (const [key, descriptor] of descriptors) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  }
});