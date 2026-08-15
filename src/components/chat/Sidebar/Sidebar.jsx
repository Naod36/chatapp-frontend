import ConversationItem from "./ConversationItem";
import GroupBadge from "../Common/GroupBadge";
import { formatTime, getAssetUrl, renderMessageStatus } from "../../../utils/theme";

export default function Sidebar({
    leftSidebarWidth,
    theme,
    themeTokens: t,
    syncState,
    searchQuery,
    setSearchQuery,
    isSearching,
    searchResults,
    handleStartConversation,
    conversations,
    isConvPinned,
    activeConv,
    handleSelectConversation,
    convoTab,
    setConvoTab,
    setIsCreateGroupOpen
}) {
    const pinnedList = conversations.filter(c => isConvPinned(c));
    const groupUnreadTotal = conversations
        .filter(c => c.type === "group")
        .reduce((acc, c) => acc + (c.unread_count || 0), 0);

    return (
        <div className="ht-sidebar" style={{ width: `${leftSidebarWidth}px`, background: t.sidebarBg, borderRight: t.border, position: "relative", flexShrink: 0 }}>
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
                {!searchQuery.trim() && pinnedList.length > 0 && (
                    <div style={{ padding: "8px 16px 4px", borderBottom: t.border }}>
                        <div className="ht-section-label" style={{ color: theme === "dark" ? "#38bdf8" : "#082a3bff", paddingLeft: 0, marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
                            <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                            </svg>
                            <span>Pinned Conversations</span>
                        </div>
                        {pinnedList.map(c => (
                            <ConversationItem
                                key={c.id}
                                c={c}
                                isActive={activeConv && activeConv.id === c.id}
                                user={{ userId: activeConv?.user_id }}
                                theme={theme}
                                themeTokens={t}
                                handleSelectConversation={handleSelectConversation}
                            />
                        ))}
                    </div>
                )}

                {/* Category Filter Tabs (All Messages / Groups) */}
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
                            <span className="ht-section-label">Group Chats</span>
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
                                                <GroupBadge size={22} iconSize={14} />
                                            </div>
                                            <span style={{ fontSize: 9.5, color: c.unread_count > 0 ? t.accent : t.textMuted, fontWeight: c.unread_count > 0 ? "700" : "normal", flexShrink: 0, marginLeft: 4 }}>{formatTime(c.last_message_time)}</span>
                                        </div>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
                                            <p style={{ margin: 0, fontSize: 11.5, color: c.unread_count > 0 ? t.text : t.textMuted, fontWeight: c.unread_count > 0 ? "600" : "normal", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: 4, flex: 1 }}>
                                                {c.last_message && c.last_message.sender_id === activeConv?.user_id && renderMessageStatus(c.last_message.status, true)}
                                                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                                                    {c.last_message_content || `${c.participants?.length || 0} members`}
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
                                                {isGroup && <GroupBadge size={22} iconSize={14} />}
                                            </div>
                                            <span style={{ fontSize: 9.5, color: c.unread_count > 0 ? t.accent : t.textMuted, fontWeight: c.unread_count > 0 ? "700" : "normal", flexShrink: 0, marginLeft: 4 }}>
                                                {isSaved ? "" : formatTime(c.last_message_time)}
                                            </span>
                                        </div>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
                                            <p style={{ margin: 0, fontSize: 11.5, color: c.unread_count > 0 ? t.text : t.textMuted, fontWeight: c.unread_count > 0 ? "600" : "normal", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: 4, flex: 1 }}>
                                                {c.last_message && c.last_message.sender_id === activeConv?.user_id && renderMessageStatus(c.last_message.status, true)}
                                                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                                                    {isSaved ? "Personal notes cloud inbox" : (c.last_message_content || (isGroup ? `${c.participants?.length || 0} members` : "No messages yet"))}
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
        </div>
    );
}
