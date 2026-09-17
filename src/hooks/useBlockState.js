import { useEffect, useRef, useState } from "react";
import { userService } from "../services/user";
import { participantId } from "../utils/blocking.js";

export default function useBlockState(token) {
  const [state, setState] = useState({
    token,
    outgoing: [],
    incoming: [],
    revision: 0,
    ready: false,
  });
  const stateRef = useRef(state);
  const refreshRef = useRef(() => Promise.resolve());
  const requestRef = useRef(0);

  if (stateRef.current.token !== token) {
    requestRef.current += 1;
    stateRef.current = {
      token,
      outgoing: [],
      incoming: [],
      revision: 0,
      ready: false,
    };
  }

  const publish = (next) => {
    stateRef.current = next;
    setState(next);
  };

  const acknowledgeOutgoing = (userId, blocked) => {
    if (stateRef.current.token !== token) return;
    requestRef.current += 1;
    const current = stateRef.current;
    const outgoing = current.outgoing.filter((id) => id !== String(userId));
    if (blocked) outgoing.push(String(userId));
    publish({
      ...current,
      outgoing: outgoing.sort(),
      revision: current.revision + 1,
    });
  };

  useEffect(() => {
    publish(stateRef.current);
    if (!token) return;
    let disposed = false;
    const refresh = async () => {
      if (disposed || stateRef.current.token !== token) return;
      const request = ++requestRef.current;
      const isCurrent = () =>
        !disposed &&
        stateRef.current.token === token &&
        request === requestRef.current;
      try {
        const [blocked, blockedBy] = await Promise.all([
          userService.getBlockedUsers(),
          userService.getBlockedByUsers(),
        ]);
        if (!isCurrent()) return;
        const normalize = (items) =>
          [
            ...new Set(
              (items || []).map((item) =>
                String(typeof item === "object" ? participantId(item) : item),
              ),
            ),
          ].sort();
        const outgoing = normalize(blocked);
        const incoming = normalize(blockedBy);
        const current = stateRef.current;
        if (
          !current.ready ||
          JSON.stringify([outgoing, incoming]) !==
            JSON.stringify([current.outgoing, current.incoming])
        ) {
          publish({
            token,
            outgoing,
            incoming,
            revision: current.revision + 1,
            ready: true,
          });
        }
      } catch (error) {
        if (!isCurrent()) return;
        publish({ ...stateRef.current, ready: false });
        console.error("Failed to refresh block state:", error);
      }
    };
    refreshRef.current = refresh;
    const onVisibility = () => {
      if (!document.hidden) refresh();
    };
    refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibility);
    const timer = setInterval(refresh, 12000);
    return () => {
      disposed = true;
      requestRef.current += 1;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
      refreshRef.current = () => Promise.resolve();
    };
  }, [token]);

  return {
    ...(state.token === token ? state : stateRef.current),
    stateRef,
    acknowledgeOutgoing,
    refresh: () =>
      stateRef.current.token === token
        ? refreshRef.current()
        : Promise.resolve(),
  };
}
