export default function NavigationRail({
    isRailExpanded,
    toggleRailExpanded,
    activeRailTab,
    setActiveRailTab,
    myProfile,
    user,
    onLogout
}) {
    return (
        <div className={`ht-rail ${isRailExpanded ? "expanded" : ""}`}>
            <div className="ht-rail-top">
                {/* Top Header & Toggle Button */}
                {isRailExpanded ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                        <div
                            onClick={() => setActiveRailTab("profile")}
                            style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", minWidth: 0, flex: 1 }}
                            title="View Profile"
                        >
                            <div className="ht-rail-avatar" style={{ width: 34, height: 34, margin: 0, border: "1.5px solid rgba(56, 189, 248, 0.5)" }}>
                                {myProfile?.avatar_url ? (
                                    <img src={myProfile.avatar_url} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                ) : (
                                    user?.username?.[0]?.toUpperCase() || "U"
                                )}
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", letterSpacing: "-0.2px" }}>
                                    {myProfile?.display_name || user?.username}
                                </div>
                                <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.5)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                                    @{user?.username}
                                </div>
                            </div>
                        </div>

                        <button
                            type="button"
                            className="ht-rail-toggle-btn"
                            onClick={toggleRailExpanded}
                            title="Collapse Sidebar"
                            style={{ marginLeft: 6 }}
                        >
                            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                            </svg>
                        </button>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, width: "100%", marginBottom: 8 }}>
                        <button
                            type="button"
                            className="ht-rail-toggle-btn"
                            onClick={toggleRailExpanded}
                            title="Expand Sidebar"
                            style={{ width: 40, height: 40 }}
                        >
                            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                        <div className="ht-rail-avatar" onClick={() => setActiveRailTab("profile")} title="My Profile" style={{ margin: 0 }}>
                            {myProfile?.avatar_url ? (
                                <img src={myProfile.avatar_url} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                                user?.username?.[0]?.toUpperCase() || "U"
                            )}
                        </div>
                    </div>
                )}

                {/* Navigation Menu */}
                <div className="ht-rail-menu">
                    <button className={`ht-rail-btn ${activeRailTab === "chats" ? "active" : ""}`} onClick={() => setActiveRailTab("chats")} title="Messages">
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        {isRailExpanded && <span className="ht-rail-btn-label">Chats</span>}
                    </button>

                    <button className={`ht-rail-btn ${activeRailTab === "profile" ? "active" : ""}`} onClick={() => setActiveRailTab("profile")} title="Profile Details">
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        {isRailExpanded && <span className="ht-rail-btn-label">Profile</span>}
                    </button>

                    <button className={`ht-rail-btn ${activeRailTab === "settings" ? "active" : ""}`} onClick={() => setActiveRailTab("settings")} title="Preferences">
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {isRailExpanded && <span className="ht-rail-btn-label">Settings</span>}
                    </button>
                </div>
            </div>

            {/* Footer Log Out Button */}
            <div className="ht-rail-bottom" style={{ width: "100%" }}>
                <button
                    type="button"
                    className="ht-rail-btn"
                    onClick={onLogout}
                    title="Log Out"
                    style={{ color: "#ef4444", width: "100%" }}
                >
                    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    {isRailExpanded && <span className="ht-rail-btn-label" style={{ color: "#ef4444" }}>Log Out</span>}
                </button>
            </div>
        </div>
    );
}
