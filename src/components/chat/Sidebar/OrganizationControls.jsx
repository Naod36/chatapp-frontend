import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import LoadFeedback from "../../LoadFeedback";
import CollectionTabs from "./CollectionTabs";
import ConversationOrganizationMenu from "./ConversationOrganizationMenu";

export default function OrganizationControls({
  organization,
  conversations,
  view,
  onViewChange,
  themeTokens: t,
  theme = "light",
  menuRequest = null,
  onCloseMenu = () => {},
}) {
  const [open, setOpen] = useState(false);
  const [folderId, setFolderId] = useState("");
  const [newName, setNewName] = useState("");
  const [rename, setRename] = useState("");
  const [query, setQuery] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dialogRef = useRef(null);
  const triggerRef = useRef(null);
  const nameRef = useRef(null);
  const focusNameRef = useRef(false);
  const folder = organization.folders.find((item) => item.id === folderId);
  const disabled = !organization.ready || organization.pending;
  const archived = new Set(organization.archived_ids);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    dialog.showModal();
    if (focusNameRef.current) nameRef.current?.focus();
    return () => {
      dialog.close();
      triggerRef.current?.focus();
    };
  }, [open]);
  useEffect(() => {
    setRename(folder?.name || "");
    setConfirmDelete(false);
  }, [folder?.id, folder?.name]);

  const close = () => setOpen(false);
  const feedback = (
    <LoadFeedback
      error={organization.error}
      loading={organization.loading && !organization.ready}
      label="Folders and archives"
      onRetry={organization.refresh}
      themeTokens={t}
    />
  );
  const label = (conversation) =>
    conversation.display_name || conversation.title || "Conversation";
  const inbox = conversations.filter((conversation) => !archived.has(conversation.id));
  const unread = inbox.filter((conversation) => Number(conversation.unread_count) > 0).length;
  const groupUnread = inbox.filter((conversation) => conversation.type === "group").reduce((total, conversation) => total + Number(conversation.unread_count || 0), 0);
  const collectionItems = [
    { value: "all", label: "All Messages" },
    { value: "unread", label: `Unread${unread ? ` (${unread})` : ""}`, ariaLabel: "Unread conversations" },
    { value: "groups", label: `Groups${groupUnread ? ` (${groupUnread})` : ""}`, ariaLabel: "Group conversations" },
    { value: "archived", label: `Archive (${organization.archived_ids.length})`, ariaLabel: "Archived conversations" },
    ...organization.folders.map((item) => ({ value: `folder:${item.id}`, label: item.name })),
  ];

  return (
    <>
      <div
        className="ht-organization-toolbar"
        style={{ color: t.text, borderBottom: t.border }}
      >
        <CollectionTabs items={collectionItems} value={view} onChange={onViewChange} />
        <button type="button" ref={triggerRef} className="ht-organize-button" aria-label="Manage folders" title="Manage folders" onClick={() => { focusNameRef.current = false; setOpen(true); }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 6h7l2 2h9v12H3zM12 11v6M9 14h6" /></svg>
        </button>
      </div>
      {menuRequest && !open && <ConversationOrganizationMenu request={menuRequest} conversation={conversations.find((conversation) => conversation.id === menuRequest.conversationId)} organization={organization} theme={theme} themeTokens={t} onClose={onCloseMenu} onCreate={() => { focusNameRef.current = true; setFolderId(""); setOpen(true); onCloseMenu(); }} />}
      {!open && feedback}
      {open &&
        createPortal(
          <dialog
            ref={dialogRef}
            className={`ht-organization-dialog ht-${theme}-theme`}
            aria-labelledby="organization-title"
            onCancel={(event) => {
              event.preventDefault();
              close();
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                close();
              }
            }}
            onClick={(event) => {
              if (event.target === dialogRef.current) close();
            }}
            style={{ background: t.sidebarBg, color: t.text, border: t.border }}
          >
            <div className="ht-organization-content">
              <header>
                <h2 id="organization-title">Folders and Archives</h2>
                <button type="button" onClick={close}>
                  Close
                </button>
              </header>
              {feedback}
              {organization.pending && (
                <div role="status">Saving changes...</div>
              )}
              <form
                className="ht-organization-form"
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (
                    await organization.update({
                      action: "create_folder",
                      name: newName,
                    })
                  )
                    setNewName("");
                }}
              >
                <input
                  ref={nameRef}
                  aria-label="New folder name"
                  placeholder="New folder name"
                  value={newName}
                  maxLength={40}
                  required
                  disabled={disabled}
                  onChange={(event) => setNewName(event.target.value)}
                />
                <button disabled={disabled || !newName.trim()} type="submit">
                  Create Folder
                </button>
              </form>
              <CollectionTabs label="Manage folder" items={[{ value: "", label: "Archives" }, ...organization.folders.map((item) => ({ value: item.id, label: item.name }))]} value={folder ? folderId : ""} onChange={setFolderId} />
              {folder && (
                <>
                  <form
                    className="ht-organization-form"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      await organization.update({
                        action: "rename_folder",
                        folder_id: folder.id,
                        name: rename,
                      });
                    }}
                  >
                    <input
                      aria-label="Folder name"
                      value={rename}
                      maxLength={40}
                      required
                      disabled={disabled}
                      onChange={(event) => setRename(event.target.value)}
                    />
                    <button disabled={disabled || !rename.trim()} type="submit">
                      Rename
                    </button>
                    <button
                      disabled={disabled}
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                    >
                      Delete Folder
                    </button>
                  </form>
                  {confirmDelete && (
                    <div className="ht-organization-delete" role="alert">
                      <span>Delete "{folder.name}"? Chats will be kept.</span>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={async () => {
                          if (
                            await organization.update({
                              action: "delete_folder",
                              folder_id: folder.id,
                            })
                          )
                            setFolderId("");
                        }}
                      >
                        Confirm Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </>
              )}
              <input
                className="ht-organization-search"
                aria-label="Filter conversations to organize"
                placeholder="Find a conversation"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <div className="ht-organization-rows">
                {conversations
                  .filter(
                    (conversation) =>
                      conversation.id !== "virtual-saved-messages" &&
                      label(conversation)
                        .toLowerCase()
                        .includes(query.trim().toLowerCase()),
                  )
                  .map((conversation) => (
                    <div className="ht-organization-row" key={conversation.id}>
                      <span>{label(conversation)}</span>
                      {folder && (
                        <label>
                          <input
                            type="checkbox"
                            aria-label={`Include ${label(conversation)} in ${folder.name}`}
                            checked={folder.conversation_ids.includes(
                              conversation.id,
                            )}
                            disabled={disabled}
                            onChange={(event) =>
                              organization.update({
                                action: "set_membership",
                                folder_id: folder.id,
                                conversation_id: conversation.id,
                                included: event.target.checked,
                              })
                            }
                          />
                          In folder
                        </label>
                      )}
                      <label>
                        <input
                          type="checkbox"
                          aria-label={`Archive ${label(conversation)}`}
                          checked={archived.has(conversation.id)}
                          disabled={disabled}
                          onChange={(event) =>
                            organization.update({
                              action: "archive",
                              conversation_id: conversation.id,
                              archived: event.target.checked,
                            })
                          }
                        />
                        Archived
                      </label>
                    </div>
                  ))}
                {conversations.filter(
                  (conversation) =>
                    conversation.id !== "virtual-saved-messages" &&
                    label(conversation)
                      .toLowerCase()
                      .includes(query.trim().toLowerCase()),
                ).length === 0 && <p>No conversations found.</p>}
              </div>
            </div>
          </dialog>,
          document.body,
        )}
    </>
  );
}
