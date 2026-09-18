import { getAssetUrl } from "../../../utils/theme";
import GroupMemberActions from "./GroupMemberActions.jsx";
import { mustTransferBeforeLeaving } from "../../../utils/groupPolicy.js";

export default function GroupInfoModal({
    isGroupInfoOpen,
    setIsGroupInfoOpen,
    activeConv,
    user,
    theme,
    themeTokens: t,
    editGroupAvatarUrl,
    isUserGroupAdmin,
    groupAvatarInputRef,
    handleGroupAvatarFileChange,
    editGroupTitle,
    setEditGroupTitle,
    handleSaveGroupInfo,
    isSavingGroupInfo,
    setIsAddMemberOpen,
    groupManagement
}) {
    if (!isGroupInfoOpen || !activeConv || activeConv.type !== "group") return null;

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 9999,
                background: "rgba(0, 0, 0, 0.65)",
                backdropFilter: "blur(10px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 20
            }}
            onClick={() => setIsGroupInfoOpen(false)}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Group information"
                style={{
                    background: t.cardBg,
                    border: t.border,
                    borderRadius: 24,
                    width: "100%",
                    maxWidth: 460,
                    padding: 24,
                    boxShadow: "0 20px 50px rgba(0,0,0,0.4)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 20,
                    maxHeight: "90vh",
                    overflowY: "auto"
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: t.text }}>Group Info & Admin Settings</h3>
                    <button
                        aria-label="Close group information"
                        onClick={() => setIsGroupInfoOpen(false)}
                        style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer", fontSize: 18, fontWeight: 700 }}
                    >
                        ✕
                    </button>
                </div>

                {/* Avatar & Info */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                    <div style={{ position: "relative", width: 84, height: 84 }}>
                        <div style={{
                            width: 84,
                            height: 84,
                            borderRadius: "50%",
                            background: t.accent,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#fff",
                            fontSize: 32,
                            fontWeight: 800,
                            overflow: "hidden",
                            border: `3px solid ${t.accent}`
                        }}>
                            {editGroupAvatarUrl ? (
                                <img src={getAssetUrl(editGroupAvatarUrl)} alt="Group Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                                (activeConv.title || activeConv.display_name)?.[0]?.toUpperCase() || "G"
                            )}
                        </div>

                        {isUserGroupAdmin(activeConv, user.userId) && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => groupAvatarInputRef.current?.click()}
                                    style={{
                                        position: "absolute",
                                        bottom: 0,
                                        right: 0,
                                        width: 28,
                                        height: 28,
                                        borderRadius: "50%",
                                        background: t.accent,
                                        border: "2px solid " + t.cardBg,
                                        color: "#fff",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        cursor: "pointer",
                                        fontSize: 12,
                                        boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
                                    }}
                                    title="Change Group Photo"
                                >
                                    📷
                                </button>
                                <input
                                    ref={groupAvatarInputRef}
                                    type="file"
                                    accept="image/*"
                                    style={{ display: "none" }}
                                    onChange={handleGroupAvatarFileChange}
                                />
                            </>
                        )}
                    </div>

                    <div style={{ textAlign: "center" }}>
                        <h4 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: t.text }}>
                            {activeConv.title || activeConv.display_name}
                        </h4>
                        <span style={{ fontSize: 12, color: t.textMuted }}>
                            {activeConv.participants?.length || 0} Participants
                        </span>
                    </div>
                </div>

                {/* Admin Settings Form */}
                {isUserGroupAdmin(activeConv, user.userId) ? (
                    <form onSubmit={handleSaveGroupInfo} style={{ display: "flex", flexDirection: "column", gap: 14, background: "rgba(120,120,120,0.04)", padding: 16, borderRadius: 16, border: t.border }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: t.accent, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                            Group Admin Controls
                        </div>

                        <div>
                            <label style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, display: "block", marginBottom: 6 }}>
                                Group Name / Title
                            </label>
                            <input
                                type="text"
                                value={editGroupTitle}
                                onChange={(e) => setEditGroupTitle(e.target.value)}
                                placeholder="Enter group title..."
                                style={{
                                    width: "100%",
                                    padding: "10px 12px",
                                    borderRadius: 12,
                                    background: t.inputBg,
                                    border: t.inputBorder,
                                    color: t.text,
                                    outline: "none",
                                    fontSize: 13,
                                    fontWeight: 600
                                }}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isSavingGroupInfo}
                            style={{
                                width: "100%",
                                padding: "10px",
                                borderRadius: 12,
                                border: "none",
                                background: t.accent,
                                color: "white",
                                fontWeight: 800,
                                fontSize: 13,
                                cursor: "pointer",
                                opacity: isSavingGroupInfo ? 0.7 : 1
                            }}
                        >
                            {isSavingGroupInfo ? "Saving..." : "Save Group Settings"}
                        </button>
                    </form>
                ) : (
                    <div style={{ padding: 12, borderRadius: 12, background: "rgba(120,120,120,0.05)", fontSize: 12, color: t.textMuted, textAlign: "center" }}>
                        Only Group Admins can edit group title and photo.
                    </div>
                )}

                {/* Members Section */}
                <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: t.text, marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span>Group Members</span>
                        {isUserGroupAdmin(activeConv, user.userId) && (
                            <button
                                type="button"
                                onClick={() => {
                                    setIsGroupInfoOpen(false);
                                    setIsAddMemberOpen(true);
                                }}
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

                    <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 220, overflowY: "auto" }}>
                        {activeConv.participants?.map(p => {
                            const pId = p.user_id || p.id;
                            const isAdmin = isUserGroupAdmin(activeConv, pId);
                            const isCreator = activeConv.creator_id === pId;

                            return (
                                <div key={pId} style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderRadius: 12, background: "rgba(120,120,120,0.05)", overflowWrap: "anywhere", minWidth: 0 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, maxWidth: "100%" }}>
                                        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#6366f1", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13 }}>
                                            {p.avatar_url ? <img src={p.avatar_url} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} /> : ((p.display_name || p.username)?.[0]?.toUpperCase() || "@")}
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: t.text, display: "flex", alignItems: "center", gap: 6 }}>
                                                {p.display_name || p.username}
                                                {pId === user.userId && <span style={{ fontSize: 10, opacity: 0.6 }}>(You)</span>}
                                            </div>
                                            <div style={{ fontSize: 11, color: t.textMuted }}>@{p.username}</div>
                                        </div>
                                    </div>

                                    <div style={{ display: "flex", alignItems: "flex-end", flexDirection: "column", gap: 6, maxWidth: "100%" }}>
                                        {isCreator ? (
                                            <span style={{ fontSize: 10, fontWeight: 800, color: "#eab308", background: "rgba(234, 179, 8, 0.15)", padding: "2px 8px", borderRadius: 8 }}>Owner</span>
                                        ) : isAdmin ? (
                                            <span style={{ fontSize: 10, fontWeight: 800, color: "#38bdf8", background: "rgba(56, 189, 248, 0.15)", padding: "2px 8px", borderRadius: 8 }}>Admin</span>
                                        ) : (
                                            <span style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, background: "rgba(120, 120, 120, 0.1)", padding: "2px 8px", borderRadius: 8 }}>Member</span>
                                        )}
                                        <GroupMemberActions conversation={activeConv} actorId={user.userId} member={p} pending={groupManagement.pending} onChange={groupManagement.change} themeTokens={t} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {groupManagement.error && <p role="alert" style={{ color: t.text, overflowWrap: "anywhere" }}>{groupManagement.error}</p>}
                    {groupManagement.pending && <p role="status" style={{ color: t.textMuted }}>Updating group...</p>}
                    {mustTransferBeforeLeaving(activeConv, user.userId) && <p style={{ color: t.textMuted, fontSize: 12 }}>Transfer ownership before leaving.</p>}
                    <button type="button"
                        disabled={groupManagement.pending || mustTransferBeforeLeaving(activeConv, user.userId)}
                        onClick={() => {
                            if (window.confirm("Leave this group? You will lose access to its messages.")) groupManagement.change(activeConv.id, { action: "leave" });
                        }}
                        style={{ marginTop: 16, padding: "10px 14px", borderRadius: 8, border: t.inputBorder, color: t.text, background: t.inputBg }}
                    >Leave group</button>
                </div>
            </div>
        </div>
    );
}
