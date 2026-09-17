import LoadFeedback from "../../LoadFeedback";

export default function MessageSearchResults({
  query,
  conversations,
  search,
  filters,
  setFilters,
  onConversation,
  onMessage,
  themeTokens,
  user,
}) {
  const matches = conversations.filter((conversation) =>
    [
      conversation.display_name,
      conversation.title,
      conversation.other_participant?.username,
    ].some((value) =>
      value?.toLowerCase().includes(query.trim().toLowerCase()),
    ),
  );
  const senders = new Map([
    [String(user.userId), { id: String(user.userId), name: "Me" }],
  ]);
  for (const conversation of conversations) {
    for (const person of [
      ...(conversation.participants || []),
      conversation.other_participant,
    ].filter(Boolean)) {
      const id = person.user_id || person.id;
      if (
        id &&
        person.display_name !== "Person Not Available" &&
        person.username !== "Person Not Available"
      ) {
        senders.set(String(id), {
          id: String(id),
          name: person.display_name || person.username || "Member",
        });
      }
    }
  }
  const changeFilter = (key, value) =>
    setFilters((previous) => ({ ...previous, [key]: value }));
  return (
    <div className="ht-unified-search" style={{ color: themeTokens.text }}>
      <section aria-label="Conversation search results">
        <h3 className="ht-section-label">Conversations ({matches.length})</h3>
        {matches.map((conversation) => (
          <button
            type="button"
            className="ht-search-result"
            key={conversation.id}
            onClick={() => onConversation(conversation)}
          >
            <strong>
              {conversation.display_name ||
                conversation.title ||
                "Conversation"}
            </strong>
            <span>{conversation.type === "group" ? "Group" : "Direct"}</span>
          </button>
        ))}
        {!matches.length && <p>No matching conversations.</p>}
      </section>
      <section aria-label="Message search results">
        <h3 className="ht-section-label">Messages</h3>
        <div className="ht-search-filters">
          <label>
            Sender
            <select
              aria-label="Message sender"
              value={filters.sender}
              onChange={(event) => changeFilter("sender", event.target.value)}
            >
              <option value="">All senders</option>
              {[...senders.values()].map((sender) => (
                <option key={sender.id} value={sender.id}>
                  {sender.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            From (UTC)
            <input
              type="date"
              aria-label="Messages from date"
              value={filters.from}
              onChange={(event) => changeFilter("from", event.target.value)}
            />
          </label>
          <label>
            Through (UTC)
            <input
              type="date"
              aria-label="Messages through date"
              value={filters.to}
              onChange={(event) => changeFilter("to", event.target.value)}
            />
          </label>
          {(filters.sender || filters.from || filters.to) && (
            <button
              type="button"
              onClick={() => setFilters({ sender: "", from: "", to: "" })}
            >
              Clear filters
            </button>
          )}
        </div>
        <LoadFeedback
          error={search.error}
          loading={search.loading}
          label="Message search"
          onRetry={search.retry}
          themeTokens={themeTokens}
        />
        {search.messages.map((message) => {
          const conversation = conversations.find(
            (item) => item.id === message.conversation_id,
          );
          if (!conversation) return null;
          return (
            <button
              type="button"
              className="ht-search-result"
              key={message.id}
              onClick={() => onMessage(message)}
            >
              <strong>
                {conversation.display_name ||
                  conversation.title ||
                  "Conversation"}
              </strong>
              <span>{message.content || message.message_type}</span>
              <small>
                {message.sender_name} -{" "}
                {new Date(message.created_at).toLocaleString()}
              </small>
            </button>
          );
        })}
        {!search.loading && !search.error && !search.messages.length && (
          <p>No matching messages.</p>
        )}
        {search.has_more && !search.error && (
          <button
            type="button"
            disabled={search.loading}
            onClick={search.loadMore}
          >
            More messages
          </button>
        )}
      </section>
    </div>
  );
}
