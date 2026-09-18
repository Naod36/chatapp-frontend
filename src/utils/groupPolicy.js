export function groupMemberActions(conversation, actorId, memberId) {
  if (conversation?.type !== "group") return [];
  const members = conversation.participants || [];
  const actor = members.find((member) => (member.user_id || member.id) === actorId);
  const target = members.find((member) => (member.user_id || member.id) === memberId);
  if (!actor || !target || actorId === memberId || memberId === conversation.creator_id) return [];
  const owner = actorId === conversation.creator_id;
  if (!owner && (actor.role !== "admin" || target.role === "admin")) return [];
  return [
    { action: "set_admin", is_admin: target.role !== "admin", label: target.role === "admin" ? "Dismiss admin" : "Make admin" },
    { action: "remove_member", label: "Remove member" },
    ...(owner ? [{ action: "transfer_ownership", label: "Transfer ownership" }] : []),
  ];
}

export function mustTransferBeforeLeaving(conversation, actorId) {
  return conversation.creator_id === actorId && (conversation.participants || []).length > 1;
}