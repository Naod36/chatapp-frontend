import { getAssetUrl } from "../../../utils/theme";
import GroupBadge from "../Common/GroupBadge";

export default function Inspector({
    showInspector,
    setShowInspector,
    activeConv,
    rightSidebarWidth,
    setIsResizingRight,
    isResizingRight,
    user,
    theme,
    themeTokens: t,
    setViewingParticipantProfile,
    mutedConvIds,
    toggleMuteConversation,
    isInChatSearchOpen,
    setIsInChatSearchOpen,
    setInChatSearchQuery,
    setInChatSearchMatchIndex,
    isUserGroupAdmin,
    setIsAddMemberOpen,
    groupAdminsMap,
    handleStartConversation,
    setParticipantContextMenu,
    sharedImages,
    sharedFiles,
    setIsGroupInfoOpen
}) {
    return (
        <div
            className="ht-inspector"
            style={{
                width: (showInspector && activeConv) ? `${rightSidebarWidth}px` : "0px",
                background: t.inspectorBg,
                borderLeft: (showInspector && activeConv) ? t.border : "none",
                position: "relative",
                flexShrink: 0
            }}
        >
            {showInspector && activeConv && (
                <div
                    onMouseDown={(e) => {
                        e.preventDefault();
                        setIsResizingRight(true);
                    }}
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: 6,
                        height: "100%",
                        cursor: "col-resize",
                        zIndex: 100,
                        background: isResizingRight ? t.accent : "transparent"
                    }}
                    className="ht-drag-handle"
                    title="Drag to resize info sidebar"
                />
            )}
            {activeConv && (
                <div className="ht-inspector-inner">
                    <div className="ht-inspector-avatar-box">
                        <button className="ht-inspector-close-btn" onClick={() => setShowInspector(false)} title="Close Inspector">
                            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>

                        <div style={{ width: 84, height: 84, borderRadius: "50%", background: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "28px", fontWeight: "800", position: "relative", marginBottom: 12 }}>
                            {activeConv.avatar_url ? (
                                <img src={getAssetUrl(activeConv.avatar_url)} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                            ) : (
                                activeConv.display_name?.[0]?.toUpperCase() || "@"
                            )}
                        </div>

                        <div style={{ fontSize: 16, fontWeight: "800", color: t.text, display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                            {activeConv.display_name}
                            {activeConv.type === "group" && <GroupBadge size={20} iconSize={12} />}
                        </div>
                        <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>
                            {activeConv.other_participant ? `@${activeConv.other_participant.username}` : (activeConv.type === "group" ? `${activeConv.participants?.length || 0} Members` : "Personal Cloud")}
                        </div>

                        {activeConv.type === "group" && (
                            <button
                                type="button"
                                onClick={() => setIsGroupInfoOpen(true)}
                                style={{
                                    marginTop: 10,
                                    background: theme === "dark" ? "rgba(56, 189, 248, 0.15)" : "rgba(3, 105, 161, 0.1)",
                                    border: theme === "dark" ? "1px solid rgba(56, 189, 248, 0.4)" : "1px solid rgba(3, 105, 161, 0.25)",
                                    color: theme === "dark" ? "#38bdf8" : "#0284c7",
                                    padding: "5px 12px",
                                    borderRadius: 10,
                                    fontSize: 11.5,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 5
                                }}
                            >
                                ⚙ Group Settings
                            </button>
                        )}

                        {activeConv.other_participant?.bio && (
                            <div style={{
                                fontSize: 12,
                                color: t.text,
                                opacity: 0.85,
                                marginTop: 10,
                                padding: "8px 12px",
                                background: "rgba(120, 120, 120, 0.08)",
                                borderRadius: 10,
                                textAlign: "center",
                                lineHeight: 1.4,
                                wordBreak: "break-word"
                            }}>
                                "{activeConv.other_participant.bio}"
                            </div>
                        )}
                    </div>

                    <div className="ht-inspector-actions" style={{ borderBottom: t.border, paddingBottom: 20 }}>
                        {activeConv.other_participant && (
                            <button
                                className="ht-inspector-action-btn"
                                style={{ color: t.text }}
                                onClick={() => {
                                    setViewingParticipantProfile({
                                        user_id: activeConv.other_participant?.user_id,
                                        display_name: activeConv.display_name,
                                        username: activeConv.other_participant?.username || activeConv.display_name,
                                        bio: activeConv.other_participant?.bio,
                                        avatar_url: activeConv.avatar_url,
                                        status: activeConv.other_participant?.status || "online",
                                        last_seen: activeConv.other_participant?.last_seen
                                    });
                                }}
                                title="View User Profile"
                            >
                                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                <span>Profile</span>
                            </button>
                        )}
                        <button
                            className="ht-inspector-action-btn"
                            style={{ color: mutedConvIds[activeConv.id] ? "#ef4444" : t.text }}
                            onClick={() => toggleMuteConversation(activeConv.id)}
                            title={mutedConvIds[activeConv.id] ? "Unmute Notifications" : "Mute Notifications"}
                        >
                            {mutedConvIds[activeConv.id] ? (
                                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                                </svg>
                            ) : (
                                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                            )}
                            <span>{mutedConvIds[activeConv.id] ? "Muted" : "Mute"}</span>
                        </button>
                        <button
                            className="ht-inspector-action-btn"
                            style={{ color: isInChatSearchOpen ? t.accent : t.text }}
                            onClick={() => {
                                setIsInChatSearchOpen(true);
                                setInChatSearchQuery("");
                                setInChatSearchMatchIndex(0);
                            }}
                            title="Search Messages in Chat"
                        >
                            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            <span>Search</span>
                        </button>
                    </div>

                    {/* Group Participants Section */}
                    {activeConv.type === "group" && (
                        <div style={{ margin: "16px 0", paddingBottom: 16, borderBottom: t.border }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                <div style={{ fontSize: 13, fontWeight: "755", color: t.text }}>
                                    Group Members <span style={{ opacity: 0.6, fontWeight: "500" }}>({activeConv.participants?.length || 0})</span>
                                </div>
                                {isUserGroupAdmin(activeConv, user.userId) && (
                                    <button
                                        type="button"
                                        onClick={() => setIsAddMemberOpen(true)}
                                        style={{
                                            background: theme === "dark" ? "rgba(56, 189, 248, 0.2)" : "rgba(3, 105, 161, 0.12)",
                                            border: theme === "dark" ? "1px solid rgba(56, 189, 248, 0.5)" : "1px solid rgba(3, 105, 161, 0.3)",
                                            color: theme === "dark" ? "#38bdf8" : "#0284c7",
                                            borderRadius: "8px",
                                            padding: "4px 10px",
                                            fontSize: "11px",
                                            fontWeight: "800",
                                            cursor: "pointer",
                                            transition: "all 0.2s ease"
                                        }}
                                    >
                                        + Add Member
                                    </button>
                                )}
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto" }}>
                                {(activeConv.participants || []).map(p => {
                                    const pId = p.user_id || p.id;
                                    const isMe = pId === user.userId;
                                    const isCreator = pId === activeConv.creator_id;
                                    const isAdmin = isCreator || (groupAdminsMap[activeConv.id] || []).includes(pId);

                                    return (
                                        <div
                                            key={pId}
                                            onClick={() => {
                                                if (!isMe) {
                                                    handleStartConversation({
                                                        user_id: pId,
                                                        username: p.username,
                                                        display_name: p.display_name || p.username,
                                                        avatar_url: p.avatar_url
                                                    });
                                                }
                                            }}
                                            onContextMenu={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setParticipantContextMenu({
                                                    x: e.clientX,
                                                    y: e.clientY,
                                                    participant: p
                                                });
                                            }}
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                                padding: "6px 8px",
                                                borderRadius: 10,
                                                background: "rgba(120, 120, 120, 0.05)",
                                                cursor: isMe ? "default" : "pointer"
                                            }}
                                            title={isMe ? "You" : "Right-click or click for actions"}
                                        >
                                            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                                                <div style={{
                                                    width: 32,
                                                    height: 32,
                                                    borderRadius: "50%",
                                                    background: "#4f46e5",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    color: "white",
                                                    fontSize: 12,
                                                    fontWeight: 700,
                                                    flexShrink: 0
                                                }}>
                                                    {p.avatar_url ? (
                                                        <img src={getAssetUrl(p.avatar_url)} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                                                    ) : (
                                                        (p.display_name || p.username || "U")[0].toUpperCase()
                                                    )}
                                                </div>
                                                <div style={{ minWidth: 0 }}>
                                                    <div style={{ fontSize: 12, fontWeight: 700, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                        {p.display_name || p.username} {isMe && "(You)"}
                                                    </div>
                                                    <div style={{ fontSize: 10, color: t.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                        @{p.username}
                                                    </div>
                                                </div>
                                            </div>

                                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                                                {isCreator ? (
                                                    <span style={{ fontSize: 9, fontWeight: 800, background: "rgba(168, 85, 247, 0.2)", color: "#c084fc", padding: "2px 6px", borderRadius: 6 }}>CREATOR</span>
                                                ) : isAdmin ? (
                                                    <span style={{ fontSize: 9, fontWeight: 800, background: "rgba(56, 189, 248, 0.2)", color: theme === "dark" ? "#38bdf8" : t.accent, padding: "2px 6px", borderRadius: 6 }}>ADMIN</span>
                                                ) : (
                                                    <span style={{ fontSize: 9, fontWeight: 700, color: t.textMuted }}>MEMBER</span>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        e.preventDefault();
                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                        setParticipantContextMenu({
                                                            x: rect.left - 120,
                                                            y: rect.bottom + 4,
                                                            participant: p
                                                        });
                                                    }}
                                                    style={{
                                                        background: "none",
                                                        border: "none",
                                                        color: t.textMuted,
                                                        fontSize: 12,
                                                        cursor: "pointer",
                                                        padding: "2px 4px"
                                                    }}
                                                    title="Member options"
                                                >
                                                    •••
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Expandable Image Gallery segment */}
                    <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, fontWeight: "755", marginBottom: 8 }}>
                            <span>Images <span style={{ opacity: 0.5, fontWeight: "500" }}>({sharedImages.length} files)</span></span>
                            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" style={{ cursor: "pointer", opacity: 0.6 }}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                        </div>
                        {sharedImages.length > 0 ? (
                            <div className="ht-media-grid">
                                {sharedImages.map(imgMsg => (
                                    <div className="ht-media-tile" key={imgMsg.message_id || imgMsg.id}>
                                        <img
                                            src={getAssetUrl(imgMsg.media_url)}
                                            alt=""
                                            style={{ cursor: "pointer" }}
                                            onClick={() => window.open(getAssetUrl(imgMsg.media_url), "_blank")}
                                        />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ padding: "16px 12px", borderRadius: 10, background: "rgba(120, 120, 120, 0.04)", border: t.border, fontSize: 11, color: t.textMuted, textAlign: "center" }}>
                                No shared images.
                            </div>
                        )}
                    </div>

                    {/* Shared File list segment */}
                    <div style={{ marginTop: 20 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, fontWeight: "755", marginBottom: 8 }}>
                            <span>Recent Files <span style={{ opacity: 0.5, fontWeight: "500" }}>({sharedFiles.length} files)</span></span>
                            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" style={{ cursor: "pointer", opacity: 0.6 }}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                        </div>
                        {sharedFiles.length > 0 ? (
                            <div className="ht-file-list">
                                {sharedFiles.map(fileMsg => {
                                    const filename = fileMsg.content || fileMsg.media_url?.split("/").pop() || "Attachment";
                                    return (
                                        <div
                                            className="ht-file-item"
                                            key={fileMsg.message_id || fileMsg.id}
                                            style={{ cursor: "pointer" }}
                                            onClick={() => window.open(getAssetUrl(fileMsg.media_url), "_blank")}
                                        >
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EA4335" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: 12, fontWeight: "700", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: t.text }}>{filename}</div>
                                                <div style={{ fontSize: 9.5, color: t.textMuted }}>Shared File</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div style={{ padding: "16px 12px", borderRadius: 10, background: "rgba(120, 120, 120, 0.04)", border: t.border, fontSize: 11, color: t.textMuted, textAlign: "center" }}>
                                No shared documents.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
