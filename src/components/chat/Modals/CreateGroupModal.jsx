export default function CreateGroupModal({
    isCreateGroupOpen,
    setIsCreateGroupOpen,
    groupTitle,
    setGroupTitle,
    selectedGroupMembers,
    setSelectedGroupMembers,
    handleRemoveGroupMember,
    groupSearchQuery,
    setGroupSearchQuery,
    groupSearchResults,
    handleSelectGroupMember,
    handleCreateGroupSubmit,
    isCreatingGroup,
    themeTokens: t
}) {
    if (!isCreateGroupOpen) return null;

    return (
        <div style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(10px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20
        }}>
            <div style={{
                background: t.cardBg,
                border: t.border,
                borderRadius: 24,
                width: "100%",
                maxWidth: 440,
                padding: 24,
                boxShadow: "0 20px 50px rgba(0,0,0,0.4)",
                display: "flex",
                flexDirection: "column",
                gap: 20
            }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: t.text }}>Create Group Chat</h3>
                    <button
                        onClick={() => {
                            setIsCreateGroupOpen(false);
                            setGroupTitle("");
                            setSelectedGroupMembers([]);
                        }}
                        style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer", fontSize: 18, fontWeight: 700 }}
                    >
                        ✕
                    </button>
                </div>

                <form onSubmit={handleCreateGroupSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div>
                        <label style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.6px", color: t.textMuted, display: "block", marginBottom: 6 }}>
                            Group Title
                        </label>
                        <input
                            type="text"
                            value={groupTitle}
                            onChange={(e) => setGroupTitle(e.target.value)}
                            style={{
                                width: "100%",
                                padding: "12px 14px",
                                borderRadius: 14,
                                background: t.inputBg,
                                border: t.inputBorder,
                                color: t.text,
                                outline: "none",
                                fontSize: 14,
                                fontWeight: 600
                            }}
                            autoFocus
                        />
                    </div>

                    <div>
                        <label style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.6px", color: t.textMuted, display: "block", marginBottom: 6 }}>
                            Add Members
                        </label>
                        {selectedGroupMembers.length > 0 && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                                {selectedGroupMembers.map(m => (
                                    <span key={m.id || m.user_id} style={{
                                        background: "rgba(56, 189, 248, 0.15)",
                                        color: "#38bdf8",
                                        border: "1px solid rgba(56, 189, 248, 0.3)",
                                        borderRadius: 20,
                                        padding: "4px 10px",
                                        fontSize: 12,
                                        fontWeight: 700,
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 6
                                    }}>
                                        {m.display_name || m.username}
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveGroupMember(m.id || m.user_id)}
                                            style={{ background: "none", border: "none", color: "#38bdf8", cursor: "pointer", padding: 0, fontSize: 12, fontWeight: 800 }}
                                        >
                                            ✕
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}

                        <input
                            type="text"
                            placeholder="Search user to add..."
                            value={groupSearchQuery}
                            onChange={(e) => setGroupSearchQuery(e.target.value)}
                            style={{
                                width: "100%",
                                padding: "10px 14px",
                                borderRadius: 14,
                                background: t.inputBg,
                                border: t.inputBorder,
                                color: t.text,
                                outline: "none",
                                fontSize: 13
                            }}
                        />

                        {groupSearchResults.length > 0 && (
                            <div style={{
                                marginTop: 6,
                                maxHeight: 160,
                                overflowY: "auto",
                                borderRadius: 12,
                                background: t.cardBg,
                                border: t.border,
                                boxShadow: "0 10px 25px rgba(0,0,0,0.2)"
                            }}>
                                {groupSearchResults.map(u => (
                                    <div
                                        key={u.id || u.user_id}
                                        onClick={() => handleSelectGroupMember(u)}
                                        style={{
                                            padding: "10px 14px",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 10,
                                            cursor: "pointer",
                                            borderBottom: t.border,
                                            transition: "background 0.2s ease"
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = "rgba(120, 120, 120, 0.08)"}
                                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                                    >
                                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#6366f1", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 11 }}>
                                            {u.avatar_url ? <img src={u.avatar_url} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} /> : (u.username?.[0]?.toUpperCase() || "U")}
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{u.display_name || u.username}</div>
                                            <div style={{ fontSize: 11, color: t.textMuted }}>@{u.username}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={isCreatingGroup || !groupTitle.trim() || selectedGroupMembers.length === 0}
                        style={{
                            marginTop: 10,
                            width: "100%",
                            padding: "12px",
                            borderRadius: 14,
                            background: "linear-gradient(135deg, #03346E, #0284c7)",
                            color: "#ffffff",
                            border: "none",
                            fontWeight: 800,
                            fontSize: 14,
                            cursor: "pointer",
                            opacity: (isCreatingGroup || !groupTitle.trim() || selectedGroupMembers.length === 0) ? 0.5 : 1,
                            boxShadow: "0 4px 14px rgba(2, 132, 199, 0.35)",
                            transition: "all 0.2s ease"
                        }}
                    >
                        {isCreatingGroup ? "Creating Group..." : "Create Group Chat"}
                    </button>
                </form>
            </div>
        </div>
    );
}
