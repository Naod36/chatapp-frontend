export const SESSION_EXPIRED_EVENT = "flowchat:session-expired";
export const SESSION_EXPIRED_MESSAGE =
  "Your session has expired. Please sign in again.";

export function expireSession(token) {
  if (!token || localStorage.getItem("chat_token") !== token) return false;
  localStorage.removeItem("chat_token");
  localStorage.removeItem("chat_userId");
  localStorage.removeItem("chat_username");
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  return true;
}
