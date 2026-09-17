export function trackMessageArrivals(
  messages,
  previousIds,
  unseenIds,
  userId,
  following,
) {
  const currentIds = new Set(
    messages.map((message) => String(message.id || message.message_id)),
  );
  const nextUnseenIds = new Set();
  let hasArrivals = false;

  for (const message of messages) {
    const id = String(message.id || message.message_id);
    const incoming = String(message.sender_id) !== String(userId);
    const arrived = !previousIds.has(id);
    if (arrived && incoming) hasArrivals = true;
    if (!following && incoming && (arrived || unseenIds.has(id))) {
      nextUnseenIds.add(id);
    }
  }

  return { currentIds, unseenIds: nextUnseenIds, hasArrivals };
}
