import { useEffect, useRef, useState } from "react";
import { conversationService } from "../services/conversations.js";

export default function useMessageSearch(query, filters, token, revision) {
  const [state, setState] = useState({
    key: "",
    messages: [],
    has_more: false,
    loading: false,
    error: null,
  });
  const [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState({ key: "", offset: 0 });
  const key = JSON.stringify([
    query.trim(),
    filters.sender,
    filters.from,
    filters.to,
    token,
    revision,
  ]);
  const offset = page.key === key ? page.offset : 0;
  const pending = useRef(false);
  useEffect(() => {
    let cancelled = false;
    const text = query.trim();
    pending.current = Boolean(text);
    setState((previous) => ({
      key,
      messages: offset && previous.key === key ? previous.messages : [],
      has_more: offset && previous.key === key ? previous.has_more : false,
      loading: Boolean(text),
      error: null,
    }));
    if (!text) return;
    const timer = setTimeout(async () => {
      try {
        if (filters.from && filters.to && filters.from > filters.to) {
          throw new Error("Start date must not follow end date.");
        }
        const result = await conversationService.searchMessages(text, {
          ...filters,
          offset,
        });
        if (cancelled) return;
        setState((previous) => {
          const messages = offset
            ? [...previous.messages, ...result.messages]
            : result.messages;
          return {
            key,
            messages: [
              ...new Map(
                messages.map((message) => [message.id, message]),
              ).values(),
            ],
            has_more: result.has_more && offset < 10000,
            loading: false,
            error: null,
          };
        });
      } catch (error) {
        if (!cancelled)
          setState((previous) => ({
            ...previous,
            loading: false,
            error: error.message || "Could not search messages.",
          }));
      } finally {
        if (!cancelled) pending.current = false;
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key, offset, attempt]);
  const current =
    state.key === key
      ? state
      : {
          messages: [],
          has_more: false,
          loading: Boolean(query.trim()),
          error: null,
        };
  return {
    ...current,
    retry: () => setAttempt((value) => value + 1),
    loadMore: () => {
      if (pending.current || !current.has_more || current.error) return;
      pending.current = true;
      setPage({ key, offset: offset + 50 });
    },
  };
}
