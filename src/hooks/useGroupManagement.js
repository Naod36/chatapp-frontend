import { useEffect, useRef, useState } from "react";
import { conversationService } from "../services/conversations.js";

export default function useGroupManagement(onConfirmed) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const change = async (conversationId, payload) => {
    if (busy.current) return false;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      await conversationService.updateMembers(conversationId, payload);
      if (mounted.current) await onConfirmed(conversationId, payload);
      return true;
    } catch (failure) {
      if (mounted.current) setError(failure.message || "Could not update group membership.");
      return false;
    } finally {
      busy.current = false;
      if (mounted.current) setPending(false);
    }
  };
  return { pending, error, change };
}