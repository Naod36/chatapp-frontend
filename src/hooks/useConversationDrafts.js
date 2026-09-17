import { useState } from "react";
import { createDraftStore } from "../utils/conversationDrafts.js";

export function useConversationDrafts(accountId, onStorageError) {
  const [savedStore, setStore] = useState(() => createDraftStore(accountId, localStorage));
  const [, refresh] = useState(0);
  let store = savedStore;
  if (store.accountId !== accountId) {
    store = createDraftStore(accountId, localStorage);
    setStore(store);
  }
  const changed = (persisted) => {
    refresh((previous) => previous + 1);
    if (!persisted) onStorageError("Draft kept in this tab, but could not be saved for refresh.");
  };
  return {
    drafts: store.drafts,
    setDraft: (id, value) => changed(store.set(id,
      typeof value === "function" ? value(store.drafts[id] || "") : value)),
    moveDraft: (from, to) => {
      const text = store.drafts[from];
      if (!text || from === to) return;
      changed(store.set(to, store.drafts[to] ? `${store.drafts[to]}\n${text}` : text));
      changed(store.set(from, ""));
    },
    captureDraft: (id) => {
      const snapshot = store.capture(id);
      return () => changed(store.clear(snapshot));
    },
  };
}