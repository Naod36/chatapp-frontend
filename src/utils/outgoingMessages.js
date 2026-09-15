export function confirmOutgoingMessage(messages, temporaryId, confirmation) {
  const optimistic = messages.find((message) => message.id === temporaryId);
  if (!optimistic) return messages;
  const echoed = messages.find((message) => (message.message_id || message.id) === confirmation.message_id);
  const confirmed = {
    ...optimistic,
    ...echoed,
    id: confirmation.message_id,
    message_id: confirmation.message_id,
    status: echoed?.status === "read" || echoed?.status === "delivered"
      ? echoed.status : confirmation.status,
  };
  return messages.flatMap((message) => {
    if (message.id === temporaryId) return [confirmed];
    if ((message.message_id || message.id) === confirmation.message_id) return [];
    return [message];
  });
}

export function failOutgoingMessage(messages, temporaryId) {
  return messages.map((message) => message.id === temporaryId
    ? { ...message, status: "failed" } : message);
}

export function isConfirmedMessage(message) {
  return message && !String(message.id || message.message_id).startsWith("temp-") &&
    message.status !== "pending" && message.status !== "failed";
}