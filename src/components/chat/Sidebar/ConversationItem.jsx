import GroupBadge from "../Common/GroupBadge";
import { formatTime, getAssetUrl, renderMessageStatus } from "../../../utils/theme";

export default function ConversationItem({
    c,
    isActive,
    user,
    theme,
    themeTokens: t,
    handleSelectConversation
}) {
    const isSaved = c.id === "virtual-saved-messages" || (c.type === "direct" && !c.other_participant);
    const isGroup = c.type === "group";
    const isOnline = !isGroup && !isSaved && c.other_participant?.status === "online";

    return (
        <div
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
                        {isGroup && <GroupBadge size={22} iconSize={14} />}
                    </div>
                    <span style={{ fontSize: 9.5, color: c.unread_count > 0 ? t.accent : t.textMuted, fontWeight: c.unread_count > 0 ? "700" : "normal", flexShrink: 0, marginLeft: 4 }}>
                        {isSaved ? "" : formatTime(c.last_message_time)}
                    </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
                    <p style={{ margin: 0, fontSize: 11.5, color: c.unread_count > 0 ? t.text : t.textMuted, fontWeight: c.unread_count > 0 ? "600" : "normal", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: 4, flex: 1, minWidth: 0 }}>
                        {c.last_message && c.last_message.sender_id === user.userId && renderMessageStatus(c.last_message.status, true)}
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
}
