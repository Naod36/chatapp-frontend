export function createOutbox(accountId, storage) {
  const key = `flowchat:outbox:${encodeURIComponent(accountId)}`;
  let entries = [];
  try {
    const saved = JSON.parse(storage.getItem(key) || "[]");
    if (Array.isArray(saved)) entries = saved.filter((entry) =>
      entry && typeof entry.client_id === "string" && typeof entry.conversation_id === "string" &&
      typeof entry.payload?.content === "string" && String(entry.sender_id) === accountId,
    ).map((entry) => ({ ...entry, status: "failed" }));
  } catch {}
  const persist = () => {
    try { storage.setItem(key, JSON.stringify(entries)); return true; }
    catch { return false; }
  };
  return {
    accountId,
    get entries() { return entries; },
    put(entry) {
      entries = [...entries.filter((item) => item.client_id !== entry.client_id), entry];
      return persist();
    },
    remove(id) { entries = entries.filter((item) => item.client_id !== id); return persist(); },
  };
}

export function mergeOutbox(messages, entries, conversationId) {
  const pending = entries.filter((entry) => entry.conversation_id === conversationId);
  const ids = new Set(pending.map((entry) => entry.id));
  const confirmed = new Set(messages.filter((message) => !String(message.id).startsWith("temp-"))
    .map((message) => message.message_id || message.id));
  return [...messages.filter((message) => !ids.has(message.id)),
    ...pending.filter((entry) => !confirmed.has(entry.client_id))];
}