export const UNAVAILABLE_NAME = "Person Not Available";

export const participantId = (participant) =>
  participant?.user_id || participant?.id;

export function blockPolicy(userId, blockedUserIds = [], blockedByUserIds = []) {
  const outgoing = blockedUserIds.includes(String(userId));
  const incoming = blockedByUserIds.includes(String(userId));
  return {
    outgoing,
    incoming,
    maskIdentity: incoming,
    canSearch: !incoming,
    canInteract: !outgoing && !incoming,
    canUnblock: outgoing,
  };
}

export function directBlockPolicy(conversation, blockedUserIds, blockedByUserIds) {
  return blockPolicy(
    conversation?.type === "direct"
      ? participantId(conversation.other_participant)
      : null,
    blockedUserIds,
    blockedByUserIds,
  );
}

export function maskParticipant(participant, blockedByUserIds) {
  if (!participant || !blockPolicy(participantId(participant), [], blockedByUserIds).maskIdentity) {
    return participant;
  }
  return {
    id: participant.id,
    user_id: participant.user_id,
    role: participant.role,
    display_name: UNAVAILABLE_NAME,
    username: "",
    avatar_url: null,
    bio: "",
    status: null,
    last_seen: null,
    identity_hidden: true,
  };
}

export function maskMessage(message, blockedByUserIds, hideReceipts = false) {
  if (!message) return message;
  const hidden = blockPolicy(message.sender_id, [], blockedByUserIds).maskIdentity;
  return {
    ...message,
    ...(hidden ? {
      sender_name: UNAVAILABLE_NAME,
      sender_username: "",
      sender_avatar: null,
      sender_avatar_url: null,
      sender_display_name: UNAVAILABLE_NAME,
    } : {}),
    ...(hidden || hideReceipts ? { status: null } : {}),
    sender: maskParticipant(message.sender, blockedByUserIds),
    reply_to: maskMessage(message.reply_to, blockedByUserIds, hideReceipts),
    reply_to_message: maskMessage(message.reply_to_message, blockedByUserIds, hideReceipts),
    message: maskMessage(message.message, blockedByUserIds, hideReceipts),
  };
}

export function maskConversation(conversation, blockedByUserIds) {
  if (!conversation) return conversation;
  const hidden = directBlockPolicy(conversation, [], blockedByUserIds).maskIdentity;
  return {
    ...conversation,
    ...(hidden ? {
      display_name: UNAVAILABLE_NAME,
      title: UNAVAILABLE_NAME,
      avatar_url: null,
      status: null,
      last_seen: null,
      identity_hidden: true,
    } : {}),
    other_participant: maskParticipant(conversation.other_participant, blockedByUserIds),
    participants: (conversation.participants || []).map((participant) => maskParticipant(participant, blockedByUserIds)),
    last_message: maskMessage(conversation.last_message, blockedByUserIds, hidden),
  };
}

export function visibleTypingUsers(typingUsers, blockedByUserIds) {
  return Object.fromEntries(Object.entries(typingUsers).map(([conversationId, typists]) => [
    conversationId,
    Object.fromEntries(Object.entries(typists).filter(([userId]) => !blockedByUserIds.includes(String(userId)))),
  ]));
}

export function createBlockStateSync(fetchState, onChange) {
  let pending = null;
  let queued = false;
  let signature = null;
  return function refresh() {
    if (pending) {
      queued = true;
      return pending;
    }
    pending = (async () => {
      do {
        queued = false;
        const [blocked, blockedBy] = await fetchState();
        const normalize = (items) => [...new Set((items || []).map((item) =>
          String(typeof item === "object" ? participantId(item) : item),
        ))].sort();
        const outgoing = normalize(blocked);
        const incoming = normalize(blockedBy);
        const nextSignature = JSON.stringify([outgoing, incoming]);
        if (signature !== nextSignature) {
          signature = nextSignature;
          onChange({ outgoing, incoming });
        }
      } while (queued);
    })().finally(() => { pending = null; });
    return pending;
  };
}