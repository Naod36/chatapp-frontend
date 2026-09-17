import { useState } from "react";
import { createOutbox } from "../utils/outbox.js";

export function useOutbox(accountId, onError) {
  const [saved, setStore] = useState(() =>
    createOutbox(accountId, localStorage),
  );
  const [, render] = useState(0);
  let store = saved;
  if (store.accountId !== accountId) {
    store = createOutbox(accountId, localStorage);
    setStore(store);
  }
  const update = (persisted) => {
    render((previous) => previous + 1);
    if (!persisted)
      onError(
        "Could not save outgoing messages for refresh. Keep this tab open.",
      );
  };
  return {
    entries: store.entries,
    put: (entry) => update(store.put(entry)),
    remove: (id) => update(store.remove(id)),
  };
}
