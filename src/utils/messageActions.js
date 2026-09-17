const events = {
  edit_message: "message_edited",
  delete_message: "message_deleted",
  react_message: "message_reacted",
  pin_message: "message_pinned",
  unpin_message: "message_unpinned",
};

export function matchesMessageAction(action, event, userId) {
  if (events[action.action] !== event.event ||
      String(action.message_id) !== String(event.message_id) ||
      String(action.conversation_id) !== String(event.conversation_id)) return false;
  if (action.action === "edit_message") return action.content === event.content;
  if (action.action === "react_message") {
    return action.emoji === event.emoji && String(event.user_id) === String(userId);
  }
  if (action.action === "pin_message" || action.action === "unpin_message") {
    return String(event.pinned_by_user_id) === String(userId) &&
      (event.scope || "shared") === (action.scope || "shared");
  }
  return true;
}

export function createMessageActionTracker({ send, userId, onChange, onSettle,
  schedule = setTimeout, cancel = clearTimeout, timeout = 12000 }) {
  let pending = null;
  let recovery = null;
  let timer;
  const settle = (error) => {
    if (!pending) return;
    const action = pending;
    pending = null;
    cancel(timer);
    onChange(null);
    const result = onSettle(action, error);
    if (error && result?.then) {
      recovery = result;
      const finish = () => { if (recovery === result) recovery = null; };
      result.then(finish, finish);
    }
  };
  return {
    start(action) {
      if (recovery) return "Wait for the conversation to refresh before retrying.";
      if (pending) return "Wait for the pending message action to finish.";
      if (!events[action.action] || !action.message_id || String(action.message_id).startsWith("temp-")) {
        return "This message has not been confirmed yet.";
      }
      pending = action;
      onChange(action);
      try {
        if (!send(action)) throw new Error("disconnected");
      } catch {
        pending = null;
        onChange(null);
        return "Not connected. Reconnect before trying this action again.";
      }
      if (pending) timer = schedule(() => settle("Confirmation timed out. Refreshing the conversation; check its state before retrying."), timeout);
      return null;
    },
    receive(event) {
      if (pending && matchesMessageAction(pending, event, userId)) settle(null);
    },
    fail(message) { settle(message); },
    dispose() {
      cancel(timer);
      pending = null;
      recovery = null;
    },
  };
}