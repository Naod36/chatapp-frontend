import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { conversationService } from "../services/conversations.js";
import { isConfirmedMessage } from "../utils/outgoingMessages.js";

export default function useOlderMessages({ conversationId, messages, containerRef, isCurrent, onPrepend, enabled, revision = "" }) {
  const [state, setState] = useState({ key: "", loading: false, error: null, exhausted: false });
  const requestRef = useRef(null);
  const anchorRef = useRef(null);
  const currentRef = useRef(null);
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  const oldest = messages.find(isConfirmedMessage);
  const cursor = oldest?.message_id || oldest?.id;
  const key = `${conversationId}:${revision}:${cursor || ""}`;
  currentRef.current = { key, enabled, isCurrent, onPrepend };
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const container = containerRef.current;
    if (!anchor || !container) return;
    anchorRef.current = null;
    if (anchor.conversationId !== conversationId || !anchor.isCurrent()) return;
    const element = document.getElementById(anchor.id);
    if (element) container.scrollTop += element.getBoundingClientRect().top - anchor.top;
    else container.scrollTop += container.scrollHeight - anchor.height;
  }, [messages, conversationId]);
  const load = async () => {
    if (!enabled || !cursor || state.key === key && state.exhausted || requestRef.current?.key === key) return;
    const request = { key };
    requestRef.current = request;
    const valid = () => mountedRef.current && requestRef.current === request && currentRef.current.key === key && currentRef.current.enabled && isCurrent();
    setState({ key, loading: true, error: null, exhausted: false });
    try {
      const page = await conversationService.getOlderMessages(conversationId, cursor);
      if (!valid()) return;
      const existing = new Set(messages.map((message) => message.id || message.message_id));
      const older = [...new Map(page.filter((message) => !existing.has(message.message_id || message.id)).map((message) => [message.message_id || message.id, { ...message, id: message.message_id || message.id }])).values()];
      if (page.length && !older.length) throw new Error("Older history is not available from this server yet. Refresh and try again after deployment.");
      const container = containerRef.current;
      if (container && older.length) {
        const top = container.getBoundingClientRect().top;
        const visible = [...container.querySelectorAll('[id^="msg-"]')].find((element) => element.getBoundingClientRect().bottom > top);
        anchorRef.current = { conversationId, isCurrent, id: visible?.id, top: visible?.getBoundingClientRect().top || top, height: container.scrollHeight };
      }
      currentRef.current.onPrepend(older);
      const nextCursor = older[0]?.id || cursor;
      setState({ key: `${conversationId}:${revision}:${nextCursor}`, loading: false, error: null, exhausted: page.length < 100 });
    } catch (error) {
      if (valid()) setState({ key, loading: false, error: error.message || "Could not load older messages.", exhausted: false });
    } finally {
      if (requestRef.current === request) requestRef.current = null;
    }
  };
  const current = state.key === key ? state : { loading: false, error: null, exhausted: false };
  return { ...current, available: enabled && Boolean(cursor) && !current.exhausted, load };
}