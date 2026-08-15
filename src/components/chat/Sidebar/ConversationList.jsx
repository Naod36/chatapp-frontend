import { useState, useEffect } from "react";
import { formatTime, renderMessageStatus, getAssetUrl } from "../../../utils/theme";
import { apiFetch, API_BASE } from "../../../services/api";

export default function ConversationList({
    leftSidebarWidth,
    themeTokens: t,
    theme,
    activeRailTab,
    syncState,
    searchQuery,
    setSearchQuery,
    conversations,
    isConvPinned,
    activeConv,
    handleSelectConversation,
    user,
    convoTab,
    setConvoTab,
    isSearching,
    searchResults,
    handleStartConversation,
    setIsCreateGroupOpen,
    myProfile,
    setMyProfile,
    handleUpdateMyProfile,
    avatarInputRef,
    handleAvatarFileSelect,
    isUploadingAvatar,
    profileSavedToast,
    isSavingProfile,
    setTheme,
    soundEnabled,
    toggleSoundEnabled,
    onLogout,
    setIsResizingLeft,
    isResizingLeft,
    typingUsers = {}
}) {
    const [latestRelease, setLatestRelease] = useState(null);
    const [isLoadingRelease, setIsLoadingRelease] = useState(false);

    useEffect(() => {
        if (activeRailTab === "download") {
            setIsLoadingRelease(true);
            apiFetch("/releases/latest?platform=android")
                .then(data => setLatestRelease(data))
                .catch(err => console.error("Error fetching latest release:", err))
                .finally(() => setIsLoadingRelease(false));
        }
    }, [activeRailTab]);

    const checkIsTyping = (convId) => {
        const convTypists = typingUsers?.[convId];
        if (!convTypists) return false;
        return Object.entries(convTypists).some(([uid, typing]) => String(uid) !== String(user?.userId) && Boolean(typing));
    };
    return (
        <div className="ht-sidebar" style={{ width: `${leftSidebarWidth}px`, background: t.sidebarBg, borderRight: t.border, position: "relative", flexShrink: 0 }}>
            {activeRailTab === "chats" && (
                <>
                    <div className="ht-sidebar-header">
                        <div className="ht-sidebar-title-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            {syncState === "connecting" && (
                                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: "#acacacff" }}>
                                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#acacacff", display: "inline-block" }} />
                                    <span>Connecting...</span>
                                </div>
                            )}

                            {syncState === "updating" && (
                                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: "#acacacff" }}>
                                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#acacacff", display: "inline-block" }} />
                                    <span>Updating...</span>
                                </div>
                            )}

                            {syncState === "ready" && (
                                <span style={{
                                    fontSize: 16,
                                    fontWeight: 900,
                                    letterSpacing: "0.2px",
                                    background: "linear-gradient(135deg, #38bdf8, #818cf8)",
                                    WebkitBackgroundClip: "text",
                                    WebkitTextFillColor: "transparent",
                                    textTransform: "uppercase"
                                }}>
                                    " FlowChat
                                </span>
                            )}
                        </div>
                        <div className="ht-sidebar-search-row">
                            <div className="ht-search-container">
                                <svg className="ht-search-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input
                                    type="text"
                                    placeholder="Search user profile..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="ht-search-pill"
                                    style={{ background: t.inputBg, border: t.inputBorder, color: t.text }}
                                />
                            </div>
                        </div>

                        {/* Pinned Conversations Section (Rendered ABOVE Category Tabs) */}
                        {!searchQuery.trim() && (() => {
                            const pinnedList = conversations.filter(c => isConvPinned(c));
                            if (pinnedList.length === 0) return null;

                            return (
                                <div style={{ padding: "8px 16px 4px", borderBottom: t.border }}>
                                    <div className="ht-section-label" style={{ color: theme === "dark" ? "#38bdf8" : "#082a3bff", paddingLeft: 0, marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
                                        <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                                        </svg>
                                        <span>Pinned Conversations</span>
                                    </div>
                                    {pinnedList.map(c => {
                                        const isActive = activeConv && activeConv.id === c.id;
                                        const isSaved = c.id === "virtual-saved-messages" || (c.type === "direct" && !c.other_participant);
                                        const isGroup = c.type === "group";
                                        const isOnline = !isGroup && !isSaved && c.other_participant?.status === "online";
                                        const isTyping = checkIsTyping(c.id);

                                        return (
                                            <div
                                                key={c.id}
                                                onClick={() => handleSelectConversation(c)}
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 12,
                                                    padding: "10px 12px",
                                                    borderRadius: 14,
                                                    cursor: "pointer",
                                                    background: isActive
                                                        ? (theme === "dark" ? "rgba(56, 189, 248, 0.12)" : "rgba(3, 52, 110, 0.08)")
                                                        : (theme === "dark" ? "rgba(120, 120, 120, 0.05)" : "rgba(0, 0, 0, 0.03)"),
                                                    marginBottom: 4,
                                                    border: isActive ? `1px solid ${theme === "dark" ? "#38bdf8" : "#0284c7"}` : "1px solid transparent",
                                                    transition: "all 0.2s ease"
                                                }}
                                            >
                                                <div style={{
                                                    width: 38,
                                                    height: 38,
                                                    borderRadius: "50%",
                                                    background: isSaved
                                                        ? "linear-gradient(135deg, #de4977, #c93b66)"
                                                        : (isGroup ? "linear-gradient(135deg, #6366f1, #4f46e5)" : "#4f46e5"),
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    color: "white",
                                                    fontWeight: "800",
                                                    flexShrink: 0,
                                                    position: "relative"
                                                }}>
                                                    {isSaved ? (
                                                        <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                                                            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                                                        </svg>
                                                    ) : c.avatar_url ? (
                                                        <img src={getAssetUrl(c.avatar_url)} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                                                    ) : (
                                                        c.display_name?.[0]?.toUpperCase() || (isGroup ? "G" : "@")
                                                    )}
                                                    {isOnline && (
                                                        <div style={{ position: "absolute", bottom: 0, right: 0, width: 9, height: 9, borderRadius: "50%", background: "#34A853", border: `2px solid ${t.sidebarBg}` }} />
                                                    )}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, width: "100%" }}>
                                                        <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0, flex: 1 }}>
                                                            <span style={{ fontSize: 13, fontWeight: "750", color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                                {isSaved ? "Saved Messages" : c.display_name}
                                                            </span>
                                                            {isGroup && (
                                                                <span
                                                                    title="Group Chat"
                                                                    style={{
                                                                        display: "inline-flex",
                                                                        alignItems: "center",
                                                                        justifyContent: "center",
                                                                        background: "rgba(56,189,248,0.18)",
                                                                        color: "#38bdf8",
                                                                        width: 22,
                                                                        height: 22,
                                                                        borderRadius: "50%",
                                                                        flexShrink: 0
                                                                    }}
                                                                >
                                                                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                                                    </svg>
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span style={{ fontSize: 9.5, color: c.unread_count > 0 ? t.accent : t.textMuted, fontWeight: c.unread_count > 0 ? "700" : "normal", flexShrink: 0, marginLeft: 4 }}>
                                                            {isSaved ? "" : formatTime(c.last_message_time)}
                                                        </span>
                                                    </div>
                                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
                                                        <p style={{ margin: 0, fontSize: 11, color: isTyping ? "#34A853" : (c.unread_count > 0 ? t.text : t.textMuted), fontWeight: (isTyping || c.unread_count > 0) ? "700" : "normal", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: 4, flex: 1, minWidth: 0 }}>
                                                            {!isTyping && c.last_message && c.last_message.sender_id === user.userId && renderMessageStatus(c.last_message.status, true)}
                                                            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                                                                {isTyping ? "typing..." : (isSaved ? "Personal notes cloud inbox" : (c.last_message_content || (isGroup ? `${c.participants?.length || 0} members` : "No messages yet")))}
                                                            </span>
                                                        </p>
                                                        {c.unread_count > 0 && (
                                                            <div style={{ background: t.accent, color: "#ffffff", borderRadius: 10, padding: "2px 7px", fontSize: 10.5, fontWeight: "700", marginLeft: 6, flexShrink: 0 }}>
                                                                {c.unread_count}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })()}

                        {/* Category Filter Tabs (All Messages / Groups) */}
                        {(() => {
                            const groupUnreadTotal = conversations
                                .filter(c => c.type === "group")
                                .reduce((acc, c) => acc + (c.unread_count || 0), 0);

                            return (
                                <div style={{ display: "flex", gap: 6, padding: "8px 12px", borderBottom: t.border, width: "100%", boxSizing: "border-box" }}>
                                    <button
                                        type="button"
                                        onClick={() => setConvoTab("all")}
                                        style={{
                                            flex: 1,
                                            background: convoTab === "all" ? "rgba(56, 189, 248, 0.15)" : "transparent",
                                            border: "none",
                                            borderRadius: "10px",
                                            padding: "6px 8px",
                                            fontSize: "12px",
                                            fontWeight: 800,
                                            color: convoTab === "all" ? (theme === "dark" ? "#38bdf8" : t.accent) : t.textMuted,
                                            cursor: "pointer",
                                            textAlign: "center",
                                            whiteSpace: "nowrap",
                                            transition: "all 0.2s ease"
                                        }}
                                    >
                                        All Messages
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setConvoTab("groups")}
                                        style={{
                                            flex: 1,
                                            background: convoTab === "groups" ? "rgba(56, 189, 248, 0.15)" : "transparent",
                                            border: "none",
                                            borderRadius: "10px",
                                            padding: "6px 8px",
                                            fontSize: "12px",
                                            fontWeight: 800,
                                            color: convoTab === "groups" ? (theme === "dark" ? "#38bdf8" : t.accent) : t.textMuted,
                                            cursor: "pointer",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            gap: 6,
                                            whiteSpace: "nowrap",
                                            transition: "all 0.2s ease"
                                        }}
                                    >
                                        <span>Groups</span>
                                        {groupUnreadTotal > 0 && (
                                            <span style={{
                                                background: t.accent,
                                                color: "#ffffff",
                                                borderRadius: 10,
                                                padding: "1px 6px",
                                                fontSize: 10,
                                                fontWeight: 800
                                            }}>
                                                {groupUnreadTotal}
                                            </span>
                                        )}
                                    </button>
                                </div>
                            );
                        })()}
                    </div>

                    <div className="ht-convo-list">
                        {isSearching ? (
                            <div style={{ textAlign: "center", padding: "20px 0", fontSize: 13, color: t.textMuted }}>Scanning database profiles...</div>
                        ) : searchQuery.trim() ? (
                            <>
                                <div className="ht-section-label" style={{ color: t.textMuted }}>Directory matches</div>
                                {searchResults.map(userItem => (
                                    <div
                                        key={userItem.user_id || userItem.id}
                                        onClick={() => handleStartConversation(userItem)}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 12,
                                            padding: "10px 12px",
                                            borderRadius: 12,
                                            cursor: "pointer",
                                            background: "rgba(120, 120, 120, 0.05)",
                                            margin: "0 4px 6px"
                                        }}
                                    >
                                        <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#de4977", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "700" }}>
                                            {(userItem.display_name || userItem.username)[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: "700", color: t.text }}>{userItem.display_name || userItem.username}</div>
                                            <div style={{ fontSize: 11, color: t.textMuted }}>@{userItem.username}</div>
                                        </div>
                                    </div>
                                ))}
                                {searchResults.length === 0 && (
                                    <div style={{ textAlign: "center", padding: 20, color: t.textMuted, fontSize: 12 }}>No matching nodes.</div>
                                )}
                            </>
                        ) : convoTab === "groups" ? (
                            <>
                                <div style={{ color: t.textMuted, display: "flex", alignItems: "center", justifyContent: "space-between", paddingRight: 12 }}>
                                    <span className="ht-section-label" >Group Chats</span>
                                    <button
                                        type="button"
                                        onClick={() => setIsCreateGroupOpen(true)}
                                        style={{
                                            background: theme === "dark" ? "rgba(56, 189, 248, 0.2)" : "rgba(3, 105, 161, 0.12)",
                                            border: theme === "dark" ? "1px solid rgba(56, 189, 248, 0.5)" : "1px solid rgba(3, 105, 161, 0.3)",
                                            color: theme === "dark" ? "#38bdf8" : "#0284c7",
                                            borderRadius: "8px",
                                            padding: "4px 10px",
                                            fontSize: "11px",
                                            fontWeight: "800",
                                            cursor: "pointer",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "4px",
                                            transition: "all 0.2s ease"
                                        }}
                                        title="Create New Group Chat"
                                    >
                                        <span>+ Group</span>
                                    </button>
                                </div>
                                {conversations.filter(c => c.type === "group").map(c => {
                                    const isActive = activeConv && activeConv.id === c.id;
                                    const isTyping = checkIsTyping(c.id);
                                    return (
                                        <div
                                            key={c.id}
                                            onClick={() => handleSelectConversation(c)}
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 12,
                                                padding: "12px 14px",
                                                borderRadius: 14,
                                                cursor: "pointer",
                                                background: isActive ? "rgba(120, 120, 120, 0.09)" : "transparent",
                                                marginBottom: 4,
                                                border: isActive ? `1px solid ${t.accent}` : "1px solid transparent"
                                            }}
                                        >
                                            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg, #6366f1, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "800", flexShrink: 0, position: "relative" }}>
                                                {c.avatar_url ? (
                                                    <img src={getAssetUrl(c.avatar_url)} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                                                ) : (
                                                    c.display_name?.[0]?.toUpperCase() || "G"
                                                )}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, width: "100%" }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flex: 1 }}>
                                                        <span style={{ fontSize: 13, fontWeight: "755", color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.display_name}</span>
                                                        <span
                                                            title="Group Chat"
                                                            style={{
                                                                display: "inline-flex",
                                                                alignItems: "center",
                                                                justifyContent: "center",
                                                                background: "rgba(56,189,248,0.18)",
                                                                color: "#38bdf8",
                                                                width: 22,
                                                                height: 22,
                                                                borderRadius: "50%",
                                                                flexShrink: 0
                                                            }}
                                                        >
                                                            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                                            </svg>
                                                        </span>
                                                    </div>
                                                    <span style={{ fontSize: 9.5, color: c.unread_count > 0 ? t.accent : t.textMuted, fontWeight: c.unread_count > 0 ? "700" : "normal", flexShrink: 0, marginLeft: 4 }}>{formatTime(c.last_message_time)}</span>
                                                </div>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
                                                    <p style={{ margin: 0, fontSize: 11.5, color: isTyping ? "#34A853" : (c.unread_count > 0 ? t.text : t.textMuted), fontWeight: (isTyping || c.unread_count > 0) ? "700" : "normal", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: 4, flex: 1 }}>
                                                        {!isTyping && c.last_message && c.last_message.sender_id === user.userId && renderMessageStatus(c.last_message.status, true)}
                                                        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                                                            {isTyping ? "typing..." : (c.last_message_content || `${c.participants?.length || 0} members`)}
                                                        </span>
                                                    </p>
                                                    {c.unread_count > 0 && (
                                                        <div style={{ background: t.accent, color: "#ffffff", borderRadius: 10, padding: "2px 7px", fontSize: 10.5, fontWeight: "700", marginLeft: 6, flexShrink: 0 }}>
                                                            {c.unread_count}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {conversations.filter(c => c.type === "group").length === 0 && (
                                    <div style={{ textAlign: "center", padding: "30px 10px", color: t.textMuted, fontSize: 12 }}>No group chats.</div>
                                )}
                            </>
                        ) : (
                            <>
                                {/* All Direct Messages & Group Messages */}
                                <div className="ht-section-label" style={{ color: theme === "dark" ? "#38bdf8" : "#082a3bff", paddingLeft: 15, marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>All Messages</div>
                                {conversations.map(c => {
                                    const isActive = activeConv && activeConv.id === c.id;
                                    const isSaved = c.id === "virtual-saved-messages" || (c.type === "direct" && !c.other_participant);
                                    const isGroup = c.type === "group";
                                    const isOnline = !isGroup && !isSaved && (c.other_participant?.status === "online" || c.status === "online");
                                    const isTyping = checkIsTyping(c.id);

                                    return (
                                        <div
                                            key={c.id}
                                            onClick={() => handleSelectConversation(c)}
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 12,
                                                padding: "12px 14px",
                                                borderRadius: 14,
                                                cursor: "pointer",
                                                background: isActive ? "rgba(120, 120, 120, 0.09)" : "transparent",
                                                marginBottom: 4,
                                                border: isActive ? `1px solid rgba(120, 120, 120, 0.15)` : "1px solid transparent"
                                            }}
                                        >
                                            <div style={{
                                                width: 40,
                                                height: 40,
                                                borderRadius: "50%",
                                                background: isSaved
                                                    ? "linear-gradient(135deg, #de4977, #c93b66)"
                                                    : (isGroup ? "linear-gradient(135deg, #6366f1, #4f46e5)" : "#4f46e5"),
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                color: "white",
                                                fontWeight: "800",
                                                flexShrink: 0,
                                                position: "relative"
                                            }}>
                                                {isSaved ? (
                                                    <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                                                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                                                    </svg>
                                                ) : c.avatar_url ? (
                                                    <img src={getAssetUrl(c.avatar_url)} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                                                ) : (
                                                    c.display_name?.[0]?.toUpperCase() || (isGroup ? "G" : "@")
                                                )}
                                                {isOnline && (
                                                    <div style={{ position: "absolute", bottom: 0, right: 0, width: 10, height: 10, borderRadius: "50%", background: "#34A853", border: `2px solid ${t.sidebarBg}` }} />
                                                )}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, width: "100%" }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flex: 1 }}>
                                                        <span style={{ fontSize: 13, fontWeight: "755", color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                            {isSaved ? "Saved Messages" : c.display_name}
                                                        </span>
                                                        {isGroup && (
                                                            <span
                                                                title="Group Chat"
                                                                style={{
                                                                    display: "inline-flex",
                                                                    alignItems: "center",
                                                                    justifyContent: "center",
                                                                    background: "rgba(56,189,248,0.18)",
                                                                    color: "#38bdf8",
                                                                    width: 22,
                                                                    height: 22,
                                                                    borderRadius: "50%",
                                                                    flexShrink: 0
                                                                }}
                                                            >
                                                                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                                                </svg>
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span style={{ fontSize: 9.5, color: c.unread_count > 0 ? t.accent : t.textMuted, fontWeight: c.unread_count > 0 ? "700" : "normal", flexShrink: 0, marginLeft: 4 }}>
                                                        {isSaved ? "" : formatTime(c.last_message_time)}
                                                    </span>
                                                </div>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
                                                    <p style={{ margin: 0, fontSize: 11.5, color: isTyping ? "#34A853" : (c.unread_count > 0 ? t.text : t.textMuted), fontWeight: (isTyping || c.unread_count > 0) ? "700" : "normal", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: 4, flex: 1 }}>
                                                        {!isTyping && c.last_message && c.last_message.sender_id === user.userId && renderMessageStatus(c.last_message.status, true)}
                                                        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                                                            {isTyping ? "typing..." : (isSaved ? "Personal notes cloud inbox" : (c.last_message_content || (isGroup ? `${c.participants?.length || 0} members` : "No messages yet")))}
                                                        </span>
                                                    </p>
                                                    {c.unread_count > 0 && (
                                                        <div style={{ background: t.accent, color: "#ffffff", borderRadius: 10, padding: "2px 7px", fontSize: 10.5, fontWeight: "700", marginLeft: 6, flexShrink: 0 }}>
                                                            {c.unread_count}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {conversations.length === 0 && (
                                    <div style={{ textAlign: "center", padding: "30px 10px", color: t.textMuted, fontSize: 11 }}>No messages yet.</div>
                                )}
                            </>
                        )}
                    </div>
                </>
            )}

            {activeRailTab === "profile" && (
                <div style={{ padding: 20, display: "flex", flexDirection: "column", height: "100%", overflowY: "auto" }}>
                    <h2 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: "800", color: t.text }}>Profile Settings</h2>

                    <form onSubmit={handleUpdateMyProfile} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        {/* Avatar File Uploader Card */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "16px 0" }}>
                            <input
                                type="file"
                                ref={avatarInputRef}
                                onChange={handleAvatarFileSelect}
                                accept="image/*"
                                style={{ display: "none" }}
                            />
                            <div
                                onClick={() => avatarInputRef.current?.click()}
                                style={{
                                    width: 90,
                                    height: 90,
                                    borderRadius: "50%",
                                    background: "linear-gradient(135deg, #38bdf8, #818cf8)",
                                    padding: 3,
                                    cursor: "pointer",
                                    position: "relative",
                                    boxShadow: "0 8px 24px rgba(0,0,0,0.2)"
                                }}
                                title="Click to change profile picture"
                            >
                                <div style={{
                                    width: "100%",
                                    height: "100%",
                                    borderRadius: "50%",
                                    overflow: "hidden",
                                    background: t.cardBg,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: 32,
                                    fontWeight: 800,
                                    color: t.accent,
                                    position: "relative"
                                }}>
                                    {myProfile.avatar_url ? (
                                        <img src={getAssetUrl(myProfile.avatar_url)} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                    ) : (
                                        myProfile.display_name?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || "U"
                                    )}

                                    {isUploadingAvatar ? (
                                        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                            <div className="flowchat-beacon-dot" style={{ width: 14, height: 14 }}></div>
                                        </div>
                                    ) : (
                                        <div
                                            style={{
                                                position: "absolute",
                                                inset: 0,
                                                background: "rgba(0,0,0,0.35)",
                                                opacity: 0,
                                                transition: "opacity 0.2s",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                color: "white"
                                            }}
                                            onMouseOver={(e) => e.currentTarget.style.opacity = "1"}
                                            onMouseOut={(e) => e.currentTarget.style.opacity = "0"}
                                        >
                                            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => avatarInputRef.current?.click()}
                                style={{
                                    background: "rgba(120, 120, 120, 0.1)",
                                    border: t.border,
                                    color: t.text,
                                    fontSize: 11,
                                    fontWeight: 600,
                                    padding: "6px 14px",
                                    borderRadius: 20,
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6
                                }}
                            >
                                📷 Upload Photo from Device
                            </button>
                        </div>

                        <div className="ht-form-group">
                            <label className="ht-form-label" style={{ color: t.textMuted }}>Display Name</label>
                            <input
                                type="text"
                                value={myProfile.display_name || ""}
                                onChange={(e) => setMyProfile(prev => ({ ...prev, display_name: e.target.value }))}
                                className="ht-form-input"
                                style={{ background: t.inputBg, border: t.inputBorder, color: t.text }}
                                placeholder="Enter your display name"
                                required
                            />
                        </div>

                        <div className="ht-form-group">
                            <label className="ht-form-label" style={{ color: t.textMuted }}>Username</label>
                            <input
                                type="text"
                                value={myProfile.username || ""}
                                onChange={(e) => setMyProfile(prev => ({ ...prev, username: e.target.value }))}
                                className="ht-form-input"
                                style={{ background: t.inputBg, border: t.inputBorder, color: t.text }}
                                placeholder="handle_username"
                                required
                            />
                        </div>

                        <div className="ht-form-group">
                            <label className="ht-form-label" style={{ color: t.textMuted }}>Bio / About</label>
                            <textarea
                                value={myProfile.bio || ""}
                                onChange={(e) => setMyProfile(prev => ({ ...prev, bio: e.target.value }))}
                                className="ht-form-textarea"
                                style={{ background: t.inputBg, border: t.inputBorder, color: t.text }}
                                placeholder="Tell others a bit about yourself..."
                            />
                        </div>

                        <div className="ht-form-group">
                            <label className="ht-form-label" style={{ color: t.textMuted }}>Profile Discovery</label>
                            <div
                                onClick={() => setMyProfile(prev => ({ ...prev, is_public: prev.is_public !== false ? false : true }))}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    background: "rgba(120, 120, 120, 0.05)",
                                    border: t.border,
                                    borderRadius: "12px",
                                    padding: "12px 14px",
                                    cursor: "pointer",
                                    userSelect: "none"
                                }}
                            >
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: "700", color: t.text }}>Public Search Visibility</div>
                                    <div style={{ fontSize: 10.5, color: t.textMuted, marginTop: 2 }}>Allow users to find you via search</div>
                                </div>
                                <div style={{
                                    width: 38,
                                    height: 22,
                                    borderRadius: 11,
                                    background: (myProfile.is_public !== false) ? t.accent : "rgba(120,120,120,0.3)",
                                    position: "relative",
                                    transition: "background 0.2s"
                                }}>
                                    <div style={{
                                        width: 16,
                                        height: 16,
                                        borderRadius: "50%",
                                        background: "white",
                                        position: "absolute",
                                        top: 3,
                                        left: (myProfile.is_public !== false) ? 19 : 3,
                                        transition: "left 0.2s"
                                    }} />
                                </div>
                            </div>
                        </div>

                        {profileSavedToast && (
                            <div style={{
                                background: "rgba(34, 197, 94, 0.15)",
                                border: "1px solid rgba(34, 197, 94, 0.4)",
                                color: "#22c55e",
                                padding: "8px 12px",
                                borderRadius: 10,
                                fontSize: 12,
                                fontWeight: 700,
                                textAlign: "center"
                            }}>
                                ✓ Profile updated successfully!
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isSavingProfile}
                            style={{
                                width: "100%",
                                padding: "12px",
                                borderRadius: 12,
                                border: "none",
                                background: t.accent,
                                color: "white",
                                fontWeight: "800",
                                cursor: isSavingProfile ? "not-allowed" : "pointer",
                                marginTop: 4,
                                opacity: isSavingProfile ? 0.7 : 1
                            }}
                        >
                            {isSavingProfile ? "Saving Changes..." : "Save Profile"}
                        </button>
                    </form>
                </div>
            )}

            {activeRailTab === "settings" && (
                <div style={{ padding: "24px 20px", display: "flex", flexDirection: "column", height: "100%", overflowY: "auto" }}>
                    <div style={{ marginBottom: 24 }}>
                        <h2 style={{ margin: 0, fontSize: 20, fontWeight: "800", color: t.text, letterSpacing: "-0.3px" }}>Settings</h2>
                        <div style={{ fontSize: 12, color: t.textMuted, marginTop: 3 }}>Manage your client preferences & options</div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                        {/* Section 1: Appearance */}
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 8 }}>
                                Appearance
                            </div>
                            <div style={{ background: t.cardBg, borderRadius: 12, border: t.border, overflow: "hidden" }}>
                                {/* Light Mode Radio Option */}
                                <div
                                    onClick={() => {
                                        setTheme("light");
                                        localStorage.setItem("theme_preference", "light");
                                    }}
                                    style={{
                                        padding: "14px 16px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        cursor: "pointer",
                                        borderBottom: t.border,
                                        background: theme === "light" ? "rgba(56, 189, 248, 0.05)" : "transparent"
                                    }}
                                >
                                    <div>
                                        <div style={{ fontSize: 13.5, fontWeight: 700, color: t.text }}>Light Mode</div>
                                        <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>High-contrast clean theme</div>
                                    </div>
                                    <div style={{
                                        width: 18,
                                        height: 18,
                                        borderRadius: "50%",
                                        border: theme === "light" ? `2px solid ${t.accent}` : "2px solid rgba(140,140,140,0.4)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        flexShrink: 0
                                    }}>
                                        {theme === "light" && <div style={{ width: 8, height: 8, borderRadius: "50%", background: t.accent }} />}
                                    </div>
                                </div>

                                {/* Dark Mode Radio Option */}
                                <div
                                    onClick={() => {
                                        setTheme("dark");
                                        localStorage.setItem("theme_preference", "dark");
                                    }}
                                    style={{
                                        padding: "14px 16px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        cursor: "pointer",
                                        background: theme === "dark" ? "rgba(56, 189, 248, 0.05)" : "transparent"
                                    }}
                                >
                                    <div>
                                        <div style={{ fontSize: 13.5, fontWeight: 700, color: t.text }}>Dark Mode</div>
                                        <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>Low-light sleek interface</div>
                                    </div>
                                    <div style={{
                                        width: 18,
                                        height: 18,
                                        borderRadius: "50%",
                                        border: theme === "dark" ? `2px solid ${t.accent}` : "2px solid rgba(140,140,140,0.4)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        flexShrink: 0
                                    }}>
                                        {theme === "dark" && <div style={{ width: 8, height: 8, borderRadius: "50%", background: t.accent }} />}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Notifications */}
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 8 }}>
                                Message Audio
                            </div>
                            <div style={{ background: t.cardBg, borderRadius: 12, border: t.border, overflow: "hidden" }}>
                                {/* Audio Enabled Radio */}
                                <div
                                    onClick={() => soundEnabled || toggleSoundEnabled()}
                                    style={{
                                        padding: "14px 16px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        cursor: "pointer",
                                        borderBottom: t.border,
                                        background: soundEnabled ? "rgba(56, 189, 248, 0.05)" : "transparent"
                                    }}
                                >
                                    <div>
                                        <div style={{ fontSize: 13.5, fontWeight: 700, color: t.text }}>Sound Chimes Enabled</div>
                                        <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>Play audio chime on incoming messages</div>
                                    </div>
                                    <div style={{
                                        width: 18,
                                        height: 18,
                                        borderRadius: "50%",
                                        border: soundEnabled ? `2px solid ${t.accent}` : "2px solid rgba(140,140,140,0.4)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        flexShrink: 0
                                    }}>
                                        {soundEnabled && <div style={{ width: 8, height: 8, borderRadius: "50%", background: t.accent }} />}
                                    </div>
                                </div>

                                {/* Audio Muted Radio */}
                                <div
                                    onClick={() => !soundEnabled || toggleSoundEnabled()}
                                    style={{
                                        padding: "14px 16px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        cursor: "pointer",
                                        background: !soundEnabled ? "rgba(56, 189, 248, 0.05)" : "transparent"
                                    }}
                                >
                                    <div>
                                        <div style={{ fontSize: 13.5, fontWeight: 700, color: t.text }}>Muted (Silent)</div>
                                        <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>Suppress all message audio playback</div>
                                    </div>
                                    <div style={{
                                        width: 18,
                                        height: 18,
                                        borderRadius: "50%",
                                        border: !soundEnabled ? `2px solid ${t.accent}` : "2px solid rgba(140,140,140,0.4)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        flexShrink: 0
                                    }}>
                                        {!soundEnabled && <div style={{ width: 8, height: 8, borderRadius: "50%", background: t.accent }} />}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section 3: Privacy & System Limits */}
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 8 }}>
                                Privacy & Storage
                            </div>
                            <div style={{ background: t.cardBg, borderRadius: 12, border: t.border, overflow: "hidden" }}>
                                <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: t.border }}>
                                    <div>
                                        <div style={{ fontSize: 13.5, fontWeight: 700, color: t.text }}>Read Receipts</div>
                                        <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>Inform senders when their messages have been read</div>
                                    </div>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: "#10b981", background: "rgba(16, 185, 129, 0.1)", padding: "3px 8px", borderRadius: 4 }}>
                                        Enabled
                                    </div>
                                </div>

                                <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                    <div>
                                        <div style={{ fontSize: 13.5, fontWeight: 700, color: t.text }}>Maximum File Size</div>
                                        <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>Maximum allowed media attachment payload</div>
                                    </div>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: t.accent, background: "rgba(56, 189, 248, 0.1)", padding: "3px 8px", borderRadius: 4 }}>
                                        50 MB
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section 4: Account Actions */}
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 8 }}>
                                Session
                            </div>
                            <div style={{ background: t.cardBg, borderRadius: 12, border: t.border, overflow: "hidden" }}>
                                <div
                                    onClick={onLogout}
                                    style={{
                                        padding: "14px 16px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        cursor: "pointer"
                                    }}
                                >
                                    <div>
                                        <div style={{ fontSize: 13.5, fontWeight: 700, color: "#ef4444" }}>Log Out</div>
                                        <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>Terminate active session on this device</div>
                                    </div>
                                    <svg width="18" height="18" fill="none" stroke="#ef4444" strokeWidth="2" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{ marginTop: "auto", paddingTop: 28, fontSize: 11, color: t.textMuted, textAlign: "center", opacity: 0.6 }}>
                        FlowChat Client v2.5.0
                    </div>
                </div>
            )}

            {activeRailTab === "download" && (
                <div style={{ padding: "24px 20px", display: "flex", flexDirection: "column", height: "100%", overflowY: "auto" }}>
                    <div style={{ marginBottom: 24 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                            <div style={{
                                width: 36,
                                height: 36,
                                borderRadius: 10,
                                background: "linear-gradient(135deg, #34A853, #10b981)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#fff"
                            }}>
                                <svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M17.5 12a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm-11 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm11.378-4.44l1.802-3.12a.5.5 0 00-.866-.5l-1.83 3.17A11.196 11.196 0 0012 6.002a11.196 11.196 0 00-4.984 1.108L5.186 3.94a.5.5 0 10-.866.5l1.802 3.12A10.96 10.96 0 002 14h20a10.96 10.96 0 00-4.122-6.44z" />
                                </svg>
                            </div>
                            <div>
                                <h2 style={{ margin: 0, fontSize: 19, fontWeight: "800", color: t.text, letterSpacing: "-0.3px" }}>Android App</h2>
                                <div style={{ fontSize: 11.5, color: t.textMuted }}>Get the native FlowChat experience</div>
                            </div>
                        </div>
                    </div>

                    {isLoadingRelease ? (
                        <div style={{ textAlign: "center", padding: "40px 0", color: t.textMuted, fontSize: 12 }}>
                            Loading latest APK release...
                        </div>
                    ) : latestRelease ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                            <div style={{
                                background: t.cardBg,
                                borderRadius: 16,
                                border: t.border,
                                padding: 20,
                                boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)",
                                display: "flex",
                                flexDirection: "column",
                                gap: 16
                            }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                    <div>
                                        <div style={{ fontSize: 15, fontWeight: "800", color: t.text }}>FlowChat Mobile</div>
                                        <div style={{ fontSize: 11.5, color: t.textMuted, marginTop: 2 }}>Official Android Release</div>
                                    </div>
                                    <span style={{
                                        background: "rgba(56, 189, 248, 0.15)",
                                        color: "#38bdf8",
                                        border: "1px solid rgba(56, 189, 248, 0.4)",
                                        fontSize: 11,
                                        fontWeight: 800,
                                        padding: "4px 10px",
                                        borderRadius: 20
                                    }}>
                                        v{latestRelease.version}
                                    </span>
                                </div>

                                {latestRelease.release_notes && (
                                    <div style={{
                                        background: theme === "dark" ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                                        borderRadius: 12,
                                        padding: 12,
                                        fontSize: 12,
                                        color: t.text,
                                        lineHeight: 1.5
                                    }}>
                                        <div style={{ fontSize: 10.5, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", marginBottom: 4 }}>What's New</div>
                                        {latestRelease.release_notes}
                                    </div>
                                )}

                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11, color: t.textMuted }}>
                                    <span>Build #{latestRelease.build_number}</span>
                                    <span>{latestRelease.download_count || 0} Downloads</span>
                                </div>

                                <a
                                    href={`${API_BASE}/releases/${latestRelease.id}/download`}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: 8,
                                        width: "100%",
                                        padding: "13px",
                                        borderRadius: 12,
                                        background: "linear-gradient(135deg, #10b981, #059669)",
                                        color: "#ffffff",
                                        fontWeight: "800",
                                        fontSize: 13.5,
                                        textDecoration: "none",
                                        boxShadow: "0 6px 20px rgba(16, 185, 129, 0.3)",
                                        transition: "transform 0.2s ease"
                                    }}
                                >
                                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    <span>Download APK</span>
                                </a>

                                {/* QR Code Section */}
                                <div style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    gap: 10,
                                    paddingTop: 14,
                                    borderTop: t.border
                                }}>
                                    <div style={{ fontSize: 11.5, fontWeight: 700, color: t.textMuted, textAlign: "center" }}>
                                        📱 Scan QR Code to Download on Phone
                                    </div>
                                    <div style={{
                                        background: "#ffffff",
                                        padding: 10,
                                        borderRadius: 16,
                                        boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center"
                                    }}>
                                        <img
                                            src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(`${API_BASE}/releases/${latestRelease.id}/download`)}`}
                                            alt="Scan to Download APK"
                                            style={{ width: 150, height: 150, borderRadius: 8, display: "block" }}
                                        />
                                    </div>
                                    <div style={{ fontSize: 10.5, color: t.textMuted, textAlign: "center", maxWidth: 220 }}>
                                        Point your mobile camera at the QR code to instantly start download
                                    </div>
                                </div>
                            </div>

                            <div style={{ fontSize: 11.5, color: t.textMuted, lineHeight: 1.5, padding: "0 4px" }}>
                                💡 <strong>Installation Note:</strong> After downloading the <code>.apk</code> file on your Android device, tap it to install. If prompted, enable "Allow installation from unknown sources".
                            </div>
                        </div>
                    ) : (
                        <div style={{ textAlign: "center", padding: "40px 0", color: t.textMuted, fontSize: 12 }}>
                            No Android releases currently published.
                        </div>
                    )}

                    <div style={{ marginTop: "auto", paddingTop: 28, fontSize: 11, color: t.textMuted, textAlign: "center", opacity: 0.6 }}>
                        FlowChat Distribution System
                    </div>
                </div>
            )}

            {/* Resizer Handle for Left Sidebar */}
            <div
                onMouseDown={(e) => {
                    e.preventDefault();
                    setIsResizingLeft(true);
                }}
                style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    width: 6,
                    height: "100%",
                    cursor: "col-resize",
                    zIndex: 100,
                    background: isResizingLeft ? t.accent : "transparent"
                }}
                className="ht-drag-handle"
                title="Drag to resize inbox sidebar"
            />
        </div>
    );
}
