import { useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";

export default function ConversationOrganizationMenu({ request, conversation, organization, onClose, onCreate, theme, themeTokens }) {
  const menuRef = useRef(null);
  useLayoutEffect(() => {
    const menu = menuRef.current;
    const bounds = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(request.x, window.innerWidth - bounds.width - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(request.y, window.innerHeight - bounds.height - 8))}px`;
    menu.querySelector("button:not(:disabled)")?.focus();
    const outside = (event) => { if (!menu.contains(event.target)) onClose(); };
    const resize = () => onClose();
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", resize);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", resize);
      request.trigger?.focus({ preventScroll: true });
    };
  }, [request]);
  const disabled = !organization.ready || organization.pending || !conversation || conversation.id === "virtual-saved-messages";
  const archived = organization.archived_ids.includes(conversation?.id);
  const mutate = async (change) => { if (await organization.update(change)) onClose(); };
  const keyboard = (event) => {
    if (event.key === "Escape" || event.key === "Tab") { event.preventDefault(); onClose(); return; }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const buttons = [...menuRef.current.querySelectorAll("button:not(:disabled)")];
    const current = buttons.indexOf(document.activeElement);
    const index = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (current + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
    buttons[index]?.focus();
  };
  return createPortal(<div ref={menuRef} role="menu" aria-label="Conversation actions" className={`ht-conversation-menu ht-${theme}-theme`} style={{ left: request.x, top: request.y, background: themeTokens.sidebarBg, color: themeTokens.text, border: themeTokens.border }} onKeyDown={keyboard} onContextMenu={(event) => event.preventDefault()}>
    <div className="ht-conversation-menu-title">{conversation?.display_name || conversation?.title || "Conversation"}</div>
    <button type="button" role="menuitem" disabled={disabled} onClick={() => mutate({ action: "archive", conversation_id: conversation.id, archived: !archived })}>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 8v12h16V8M3 4h18v4H3zM9 12h6" /></svg>
      {archived ? "Restore to Inbox" : "Archive"}
    </button>
    {organization.folders.length > 0 && <div className="ht-menu-separator" role="separator" />}
    {organization.folders.map((folder) => {
      const included = folder.conversation_ids.includes(conversation?.id);
      return <button type="button" role="menuitemcheckbox" aria-checked={included} key={folder.id} disabled={disabled} onClick={() => mutate({ action: "set_membership", folder_id: folder.id, conversation_id: conversation.id, included: !included })}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d={included ? "m5 12 4 4L19 6" : "M3 6h7l2 2h9v12H3z"} /></svg>
        <span>{folder.name}</span>
      </button>;
    })}
    {organization.error && <div role="alert" className="ht-menu-feedback">{organization.error}</div>}
    {organization.pending && <div role="status" className="ht-menu-feedback">Saving...</div>}
    <div className="ht-menu-separator" role="separator" />
    <button type="button" role="menuitem" disabled={!organization.ready || organization.pending} onClick={onCreate}>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
      Create Folder
    </button>
  </div>, document.body);
}