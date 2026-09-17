import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import LoadFeedback from "../../LoadFeedback";

export default function OrganizationControls({
  organization,
  conversations,
  view,
  onViewChange,
  themeTokens: t,
}) {
  const [open, setOpen] = useState(false);
  const [folderId, setFolderId] = useState("");
  const [newName, setNewName] = useState("");
  const [rename, setRename] = useState("");
  const [query, setQuery] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dialogRef = useRef(null);
  const triggerRef = useRef(null);
  const folder = organization.folders.find((item) => item.id === folderId);
  const disabled = !organization.ready || organization.pending;
  const archived = new Set(organization.archived_ids);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    dialog.showModal();
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

  return (
    <>
      <div
        className="ht-organization-toolbar"
        style={{ color: t.text, borderBottom: t.border }}
      >
        <select
          aria-label="Conversation collection"
          value={
            view === "archived" || view.startsWith("folder:") ? view : "inbox"
          }
          onChange={(event) =>
            onViewChange(
              event.target.value === "inbox" ? "all" : event.target.value,
            )
          }
        >
          <option value="inbox">Inbox</option>
          <option value="archived">
            Archived ({organization.archived_ids.length})
          </option>
          {organization.folders.map((item) => (
            <option key={item.id} value={`folder:${item.id}`}>
              {item.name}
            </option>
          ))}
        </select>
        <button type="button" ref={triggerRef} onClick={() => setOpen(true)}>
          Organize
        </button>
      </div>
      {!open && feedback}
      {open &&
        createPortal(
          <dialog
            ref={dialogRef}
            className="ht-organization-dialog"
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
              <label className="ht-organization-field">
                Folder
                <select
                  aria-label="Manage folder"
                  value={folder ? folderId : ""}
                  onChange={(event) => setFolderId(event.target.value)}
                >
                  <option value="">Archives</option>
                  {organization.folders.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
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
