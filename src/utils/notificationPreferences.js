export function normalizeMutes(value) {
  if (Array.isArray(value)) return Object.fromEntries(value.map((id) => [id, true]));
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value).filter(([, until]) => until === true || (Number.isFinite(until) && until > 0)));
}

export function isMutedUntil(value, now = Date.now()) {
  return value === true || (typeof value === "number" && value > now);
}

export function isConversationMuted(conversationId, mutes, scopes, folders, now = Date.now()) {
  return isMutedUntil(mutes[conversationId], now)
    || isMutedUntil(scopes.all, now)
    || folders.some((folder) => folder.conversation_ids.includes(conversationId) && isMutedUntil(scopes[`folder:${folder.id}`], now));
}

export function notificationContent(message, hidePreviews) {
  if (hidePreviews) return { title: "FlowChat", body: "New message", icon: "/favicon.ico" };
  const media = { image: "Sent an image", audio: "Sent a voice message", voice: "Sent a voice message", file: "Sent a file", video: "Sent a video" };
  return { title: `${message.sender_name || "New Message"} (FlowChat)`, body: media[message.message_type] || message.content || "New message", icon: message.sender_avatar || "/favicon.ico" };
}