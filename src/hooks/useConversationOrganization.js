import { useEffect, useRef, useState } from "react";
import { organizationService } from "../services/organization";

const emptyState = (token) => ({ token, revision: -1, archived_ids: [], folders: [], ready: false, loading: false, pending: false, error: null });

export default function useConversationOrganization(token) {
  const [state, setState] = useState(() => emptyState(token));
  const stateRef = useRef(state);
  const sequence = useRef(0);
  const mounted = useRef(false);
  const refreshRef = useRef(() => Promise.resolve());
  if (stateRef.current.token !== token) {
    sequence.current += 1;
    stateRef.current = emptyState(token);
  }
  const publish = (next) => {
    stateRef.current = next;
    setState(next);
  };
  const accept = (data) => {
    if (!Number.isSafeInteger(data?.revision) || !Array.isArray(data.archived_ids) || !Array.isArray(data.folders)) {
      throw new Error("Invalid conversation organization response.");
    }
    if (data.revision < stateRef.current.revision) return;
    publish({ ...stateRef.current, ...data, ready: true, error: null });
  };
  const refresh = async () => {
    if (!mounted.current || !token || stateRef.current.token !== token || stateRef.current.pending) return;
    const request = ++sequence.current;
    const current = () => mounted.current && stateRef.current.token === token && sequence.current === request;
    publish({ ...stateRef.current, loading: true });
    try {
      const data = await organizationService.get();
      if (current()) accept(data);
    } catch (error) {
      if (current()) publish({ ...stateRef.current, error: error.message || "Could not load folders and archives." });
    } finally {
      if (current()) publish({ ...stateRef.current, loading: false });
    }
  };
  refreshRef.current = refresh;

  const update = async (change) => {
    if (!mounted.current || stateRef.current.token !== token || !stateRef.current.ready || stateRef.current.pending) return false;
    const request = ++sequence.current;
    const current = () => mounted.current && stateRef.current.token === token && sequence.current === request;
    publish({ ...stateRef.current, pending: true, loading: false, error: null });
    try {
      const data = await organizationService.update(change);
      if (!current()) return false;
      accept(data);
      return true;
    } catch (error) {
      if (current()) publish({ ...stateRef.current, error: error.message || "Change not confirmed. Refresh before retrying." });
      return false;
    } finally {
      if (current()) publish({ ...stateRef.current, pending: false });
    }
  };

  useEffect(() => {
    mounted.current = true;
    publish(stateRef.current);
    const onVisible = () => { if (!document.hidden) refreshRef.current(); };
    refreshRef.current();
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(onVisible, 15000);
    return () => {
      mounted.current = false;
      sequence.current += 1;
      clearInterval(timer);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [token]);

  return { ...(state.token === token ? state : stateRef.current), refresh, update };
}