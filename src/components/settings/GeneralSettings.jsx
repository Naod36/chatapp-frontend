export default function GeneralSettings({
    theme,
    setTheme,
    soundEnabled,
    toggleSoundEnabled,
    onLogout,
    themeTokens: t
}) {
    return (
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
    );
}
