export default function AddMemberModal({
    isAddMemberOpen,
    setIsAddMemberOpen,
    addMemberQuery,
    setAddMemberQuery,
    addMemberResults,
    handleAddMemberToGroup,
    themeTokens: t
}) {
    if (!isAddMemberOpen) return null;

    return (
        <div
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "rgba(0, 0, 0, 0.65)",
                backdropFilter: "blur(8px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 9999,
                padding: 20
            }}
        >
            <div style={{
                background: t.cardBg,
                border: t.border,
                borderRadius: 20,
                width: "100%",
                maxWidth: 440,
                padding: 24,
                boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
                position: "relative"
            }}>
                <button
                    type="button"
                    onClick={() => {
                        setIsAddMemberOpen(false);
                        setAddMemberQuery("");
                    }}
                    style={{
                        position: "absolute",
                        top: 16,
                        right: 16,
                        background: "none",
                        border: "none",
                        color: t.textMuted,
                        fontSize: 18,
                        cursor: "pointer"
                    }}
                >
                    ✕
                </button>

                <h3 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 800, color: t.text }}>
                    Add Member to Group
                </h3>

                <input
                    type="text"
                    placeholder="Search public accounts..."
                    value={addMemberQuery}
                    onChange={(e) => setAddMemberQuery(e.target.value)}
                    style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: 12,
                        background: t.inputBg,
                        border: t.inputBorder,
                        color: t.text,
                        fontSize: 13,
                        outline: "none",
                        marginBottom: 14
                    }}
                    autoFocus
                />

                <div style={{ maxHeight: 240, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                    {addMemberResults.map(u => (
                        <div
                            key={u.id}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "8px 12px",
                                borderRadius: 12,
                                background: "rgba(120, 120, 120, 0.06)"
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <div style={{ width: 34, height: 34, borderRadius: "50%", background: t.accent, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 13 }}>
                                    {(u.display_name || u.username)[0].toUpperCase()}
                                </div>
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{u.display_name || u.username}</div>
                                    <div style={{ fontSize: 11, color: t.textMuted }}>@{u.username}</div>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleAddMemberToGroup(u)}
                                style={{
                                    background: t.accent,
                                    border: "none",
                                    color: "white",
                                    fontWeight: 800,
                                    fontSize: 11,
                                    padding: "6px 12px",
                                    borderRadius: 8,
                                    cursor: "pointer"
                                }}
                            >
                                + Add
                            </button>
                        </div>
                    ))}
                    {addMemberQuery.trim() && addMemberResults.length === 0 && (
                        <div style={{ textAlign: "center", padding: 20, color: t.textMuted, fontSize: 12 }}>
                            No non-member public accounts found.
                        </div>
                    )}
                    {!addMemberQuery.trim() && (
                        <div style={{ textAlign: "center", padding: 20, color: t.textMuted, fontSize: 12 }}>
                            Type a username or display name to search users to add.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
