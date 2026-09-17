export function createDraftStore(accountId, storage) {
  const key = `flowchat:drafts:${encodeURIComponent(accountId)}`;
  let drafts = {};
  const revisions = new Map();
  try {
    const saved = JSON.parse(storage.getItem(key) || "{}");
    if (saved && typeof saved === "object" && !Array.isArray(saved)) {
      drafts = Object.fromEntries(
        Object.entries(saved).filter(([, text]) => typeof text === "string"),
      );
    }
  } catch {}
  const persist = () => {
    try {
      storage.setItem(key, JSON.stringify(drafts));
      return true;
    } catch {
      return false;
    }
  };
  return {
    accountId,
    get drafts() {
      return drafts;
    },
    set(id, text) {
      if (!id) return true;
      drafts = { ...drafts };
      if (text) drafts[id] = text;
      else delete drafts[id];
      revisions.set(id, (revisions.get(id) || 0) + 1);
      return persist();
    },
    capture(id) {
      return { id, revision: revisions.get(id) || 0 };
    },
    clear(snapshot) {
      if ((revisions.get(snapshot.id) || 0) !== snapshot.revision) return true;
      return this.set(snapshot.id, "");
    },
  };
}
