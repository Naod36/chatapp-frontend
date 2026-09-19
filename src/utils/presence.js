export function presenceFields(person = {}) {
  return Object.fromEntries(["status", "last_seen", "presence_visibility", "custom_status", "status_emoji", "status_expires_at"]
    .filter((key) => Object.hasOwn(person, key)).map((key) => [key, person[key]]));
}

export function customStatus(person, now = Date.now()) {
  if (!person || person.identity_hidden || (person.status_expires_at && Date.parse(person.status_expires_at) <= now)) return "";
  return [person.status_emoji, person.custom_status].filter(Boolean).join(" ");
}

export function presenceLabel(person, formatLastSeen = () => "Offline") {
  if (person?.identity_hidden) return "";
  const status = person?.status === "hidden" || person?.presence_visibility === "invisible"
    ? "Status unavailable" : person?.status === "online" ? "Online"
      : person?.last_seen ? formatLastSeen(person.last_seen) : "Offline";
  return [customStatus(person), status].filter(Boolean).join(" · ");
}

export function applyPresence(conversation, event) {
  if (!conversation) return conversation;
  const matches = (person) => person && String(person.user_id || person.id) === String(event.user_id);
  const update = (person) => matches(person) ? { ...person, ...presenceFields(event) } : person;
  return {
    ...conversation,
    ...(matches(conversation.other_participant) ? { status: event.status } : {}),
    other_participant: update(conversation.other_participant),
    ...(conversation.participants ? { participants: conversation.participants.map(update) } : {}),
  };
}

export function statusExpiry(choice, current, now = Date.now()) {
  if (choice === "keep") return current && Date.parse(current) > now ? current : null;
  if (choice === "never") return null;
  if (choice === "today") {
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    return midnight.toISOString();
  }
  return new Date(now + Number(choice) * 3600000).toISOString();
}