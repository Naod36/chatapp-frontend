export default function ParticipantContextMenu({
    participantContextMenu,
    setParticipantContextMenu,
    user,
    activeConv,
    handleStartConversation,
    isUserGroupAdmin,
    groupAdminsMap,
    handleMakeAdmin,
    setViewingParticipantProfile,
    theme,
    themeTokens: t
}) {
    if (!participantContextMenu) return null;

    const pId = participantContextMenu.participant.user_id || participantContextMenu.participant.id;
    const isMe = pId === user.userId;
    const isCreator = pId === activeConv?.creator_id;
    const currentlyAdmin = participantContextMenu.participant.role === "admin" || (groupAdminsMap[activeConv?.id] || []).includes(pId);

    return (
        <div
            style={{
                position: "fixed",
                top: participantContextMenu.y,
                left: Math.min(participantContextMenu.x, window.innerWidth - 180),
                background: t.cardBg,
                border: t.border,
                borderRadius: 14,
                boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
                padding: "6px",
                zIndex: 10000,
                minWidth: 160,
                display: "flex",
                flexDirection: "column",
                gap: 2
            }}
            onClick={(e) => e.stopPropagation()}
        >
            <div style={{ padding: "6px 10px", fontSize: 11, fontWeight: 800, color: t.textMuted, borderBottom: t.border, marginBottom: 4 }}>
                @{participantContextMenu.participant.username}
            </div>

            {!isMe && (
                <button
                    type="button"
                    onClick={() => {
                        handleStartConversation({
                            user_id: pId,
                            username: participantContextMenu.participant.username,
                            display_name: participantContextMenu.participant.display_name || participantContextMenu.participant.username,
                            avatar_url: participantContextMenu.participant.avatar_url
                        });
                        setParticipantContextMenu(null);
                    }}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        width: "100%",
                        padding: "8px 10px",
                        background: "none",
                        border: "none",
                        color: t.text,
                        fontSize: 12,
                        fontWeight: 700,
                        borderRadius: 8,
                        cursor: "pointer",
                        textAlign: "left"
                    }}
                >
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    Direct Message
                </button>
            )}

            {activeConv && isUserGroupAdmin(activeConv, user.userId) && !isMe && !isCreator && (
                <button
                    type="button"
                    onClick={() => {
                        handleMakeAdmin(activeConv.id, pId, !currentlyAdmin);
                        setParticipantContextMenu(null);
                    }}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        width: "100%",
                        padding: "8px 10px",
                        background: "rgba(56, 189, 248, 0.12)",
                        border: "none",
                        color: theme === "dark" ? "#38bdf8" : t.accent,
                        fontSize: 12,
                        fontWeight: 800,
                        borderRadius: 8,
                        cursor: "pointer",
                        textAlign: "left"
                    }}
                >
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    {currentlyAdmin ? "Dismiss as Admin" : "Make Admin"}
                </button>
            )}

            <button
                type="button"
                onClick={() => {
                    setViewingParticipantProfile({
                        user_id: pId,
                        display_name: participantContextMenu.participant.display_name || participantContextMenu.participant.username,
                        username: participantContextMenu.participant.username,
                        bio: participantContextMenu.participant.bio,
                        avatar_url: participantContextMenu.participant.avatar_url,
                        status: participantContextMenu.participant.status || "offline",
                        last_seen: participantContextMenu.participant.last_seen
                    });
                    setParticipantContextMenu(null);
                }}
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                    padding: "8px 10px",
                    background: "none",
                    border: "none",
                    color: t.text,
                    fontSize: 12,
                    fontWeight: 700,
                    borderRadius: 8,
                    cursor: "pointer",
                    textAlign: "left"
                }}
            >
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                View Profile
            </button>
        </div>
    );
}
