export function organizedConversations(conversations, organization, view) {
  const archived = new Set(organization?.archived_ids || []);
  if (view === "archived")
    return conversations.filter((conversation) =>
      archived.has(conversation.id),
    );
  if (view.startsWith("folder:")) {
    const folder = organization?.folders.find(
      (item) => item.id === view.slice(7),
    );
    const members = new Set(folder?.conversation_ids || []);
    return conversations.filter((conversation) => members.has(conversation.id));
  }
  return conversations.filter((conversation) => !archived.has(conversation.id));
}
