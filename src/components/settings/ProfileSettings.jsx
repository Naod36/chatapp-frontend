import { getAssetUrl } from "../../utils/theme";

export default function ProfileSettings({
    myProfile,
    setMyProfile,
    user,
    avatarInputRef,
    handleAvatarFileSelect,
    isUploadingAvatar,
    handleUpdateMyProfile,
    profileSavedToast,
    isSavingProfile,
    themeTokens: t
}) {
    return (
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
    );
}
