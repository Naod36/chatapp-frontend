import { getAssetUrl } from "../../../utils/theme";

export default function UserProfileModal({
    viewingParticipantProfile,
    setViewingParticipantProfile,
    user,
    handleStartConversation,
    themeTokens: t
}) {
    if (!viewingParticipantProfile) return null;

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 9999,
                background: "rgba(0, 0, 0, 0.65)",
                backdropFilter: "blur(8px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 20
            }}
            onClick={() => setViewingParticipantProfile(null)}
        >
            <div
                style={{
                    background: t.cardBg,
                    border: t.border,
                    borderRadius: 24,
                    width: "100%",
                    maxWidth: 400,
                    padding: 24,
                    boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    textAlign: "center"
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    type="button"
                    onClick={() => setViewingParticipantProfile(null)}
                    style={{
                        position: "absolute",
                        top: 16,
                        right: 16,
                        background: "none",
                        border: "none",
                        color: t.textMuted,
                        fontSize: 18,
                        cursor: "pointer",
                        fontWeight: 700
                    }}
                >
                    ✕
                </button>

                <div style={{
                    width: 80,
                    height: 80,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #0284c7, #6366f1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    fontSize: 28,
                    fontWeight: 800,
                    marginBottom: 14,
                    position: "relative"
                }}>
                    {viewingParticipantProfile.avatar_url ? (
                        <img src={getAssetUrl(viewingParticipantProfile.avatar_url)} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                    ) : (
                        (viewingParticipantProfile.display_name || viewingParticipantProfile.username)?.[0]?.toUpperCase() || "@"
                    )}
                    {viewingParticipantProfile.status === "online" && (
                        <div style={{ position: "absolute", bottom: 2, right: 2, width: 14, height: 14, borderRadius: "50%", background: "#34A853", border: `2px solid ${t.cardBg}` }} />
                    )}
                </div>

                <h3 style={{ margin: "0 0 2px", fontSize: 18, fontWeight: 800, color: t.text }}>
                    {viewingParticipantProfile.display_name || viewingParticipantProfile.username}
                </h3>
                <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 14 }}>
                    @{viewingParticipantProfile.username}
                </div>

                {/* Bio / About Section */}
                <div style={{
                    width: "100%",
                    background: "rgba(120, 120, 120, 0.08)",
                    border: t.border,
                    borderRadius: 14,
                    padding: "12px 14px",
                    marginBottom: 18,
                    textAlign: "left"
                }}>
                    <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px", color: t.textMuted, marginBottom: 4 }}>
                        About / Bio
                    </div>
                    <div style={{ fontSize: 13, color: t.text, lineHeight: 1.45, fontStyle: viewingParticipantProfile.bio ? "normal" : "italic", opacity: viewingParticipantProfile.bio ? 1 : 0.6 }}>
                        {viewingParticipantProfile.bio || "No bio added yet."}
                    </div>
                </div>

                {viewingParticipantProfile.user_id && viewingParticipantProfile.user_id !== user.userId && (
                    <button
                        type="button"
                        onClick={() => {
                            handleStartConversation({
                                user_id: viewingParticipantProfile.user_id,
                                username: viewingParticipantProfile.username,
                                display_name: viewingParticipantProfile.display_name,
                                avatar_url: viewingParticipantProfile.avatar_url
                            });
                            setViewingParticipantProfile(null);
                        }}
                        style={{
                            width: "100%",
                            padding: "11px",
                            borderRadius: 12,
                            background: t.accent,
                            color: "white",
                            border: "none",
                            fontWeight: 800,
                            fontSize: 13,
                            cursor: "pointer",
                            boxShadow: "0 4px 14px rgba(2, 132, 199, 0.3)"
                        }}
                    >
                        Send Direct Message
                    </button>
                )}
            </div>
        </div>
    );
}
