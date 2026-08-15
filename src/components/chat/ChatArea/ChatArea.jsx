import { useState } from "react";
import EmojiPicker from "emoji-picker-react";
import VoicePlayer from "../../VoicePlayer";
import { formatTime, renderMessageStatus, getSenderNameColor, getAssetUrl, formatLastSeen } from "../../../utils/theme";

export default function ChatArea({
    activeConv,
    theme,
    themeTokens: t,
    isInChatSearchOpen,
    setIsInChatSearchOpen,
    inChatSearchQuery,
    setInChatSearchQuery,
    inChatSearchMatchIndex,
    setInChatSearchMatchIndex,
    searchMatchingMessages,
    handlePrevSearchMatch,
    handleNextSearchMatch,
    setEditGroupTitle,
    setEditGroupAvatarUrl,
    setIsGroupInfoOpen,
    setShowInspector,
    showInspector,
    getActiveTypingLabel,
    headerMenuRef,
    isHeaderMenuOpen,
    setIsHeaderMenuOpen,
    togglePinConversation,
    isConvPinned,
    toggleMuteConversation,
    mutedConvIds,
    pinnedMessageIdMap,
    pinnedMessagesMap,
    handleUnpin,
    messages,
    user,
    handleTogglePin,
    chatContainerRef,
    handleChatScroll,
    handleCloseContextMenu,
    handlePaste,
    _hoveredMsgId,
    setHoveredMsgId,
    myProfile,
    handleContextMenu,
    handleToggleReaction,
    showScrollBottomBtn,
    newMessagesBelowCount,
    scrollToBottom,
    contextMenu,
    REACTION_EMOJIS,
    handleStartReply,
    handleCopyMsgText,
    handleCopyImage,
    handleStartEdit,
    handleDeleteMsg,
    handleSendMessage,
    replyingTo,
    setReplyingTo,
    editingMessage,
    setEditingMessage,
    setMessageText,
    selectedFile,
    filePreview,
    cancelAttachment,
    isUploading,
    setIsUploading,
    uploadProgress,
    fileInputRef,
    inputTextareaRef,
    messageText,
    handleKeyPress,
    emojiPickerRef,
    showEmojiPicker,
    setShowEmojiPicker,
    isRecording,
    setIsRecording,
    mediaRecorderRef,
    audioStreamRef,
    recordingTimerRef,
    recordingSeconds,
    setRecordingSeconds,
    audioChunksRef,
    socketRef,
    setMessages,
    handleFileSelect,
    messageEndRef,
    API_BASE
}) {
    const [activePinIndex, setActivePinIndex] = useState(0);

    if (!activeConv) {
        return (
            <div className="ht-chat-pane">
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: t.textMuted, padding: 40, textAlign: "center" }}>
                    <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" style={{ marginBottom: 16, opacity: 0.5 }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <h4 style={{ margin: "0 0 8px", fontSize: 16, color: t.text, fontWeight: 750 }}>No Conversation Selected</h4>
                    <p style={{ margin: 0, fontSize: 13, maxWidth: 280, lineHeight: 1.45 }}>Choose a message thread from the inbox sidebar, or search profiles in the system directory.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="ht-chat-pane">
            {/* Floating Header Card */}
            <div className="ht-chat-header" style={{ background: t.cardBg, border: t.border, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                {isInChatSearchOpen ? (
                    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, background: "rgba(120, 120, 120, 0.08)", padding: "6px 14px", borderRadius: 20, border: `1px solid ${t.accent}` }}>
                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0, opacity: 0.7 }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Search in this conversation..."
                            value={inChatSearchQuery}
                            onChange={(e) => {
                                setInChatSearchQuery(e.target.value);
                                setInChatSearchMatchIndex(0);
                            }}
                            autoFocus
                            style={{
                                flex: 1,
                                background: "transparent",
                                border: "none",
                                outline: "none",
                                color: t.text,
                                fontSize: 13,
                                fontWeight: 500
                            }}
                        />
                        {inChatSearchQuery.trim() && (
                            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: t.textMuted }}>
                                <span style={{ fontSize: 11, fontWeight: 700 }}>
                                    {searchMatchingMessages.length > 0
                                        ? `${inChatSearchMatchIndex + 1}/${searchMatchingMessages.length}`
                                        : "0/0"}
                                </span>
                                <button
                                    type="button"
                                    onClick={handlePrevSearchMatch}
                                    disabled={searchMatchingMessages.length === 0}
                                    style={{ background: "none", border: "none", color: t.text, cursor: "pointer", opacity: searchMatchingMessages.length ? 1 : 0.3, padding: "2px 4px" }}
                                    title="Previous Match"
                                >
                                    ▲
                                </button>
                                <button
                                    type="button"
                                    onClick={handleNextSearchMatch}
                                    disabled={searchMatchingMessages.length === 0}
                                    style={{ background: "none", border: "none", color: t.text, cursor: "pointer", opacity: searchMatchingMessages.length ? 1 : 0.3, padding: "2px 4px" }}
                                    title="Next Match"
                                >
                                    ▼
                                </button>
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={() => {
                                setIsInChatSearchOpen(false);
                                setInChatSearchQuery("");
                                setInChatSearchMatchIndex(0);
                            }}
                            style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer", padding: "2px 4px", fontSize: 13, fontWeight: 700 }}
                            title="Close Search"
                        >
                            ✕
                        </button>
                    </div>
                ) : (
                    <div
                        onClick={() => {
                            if (activeConv.type === "group") {
                                setEditGroupTitle(activeConv.title || activeConv.display_name || "");
                                setEditGroupAvatarUrl(activeConv.avatar_url || "");
                                setIsGroupInfoOpen(true);
                            } else {
                                setShowInspector(prev => !prev);
                            }
                        }}
                        style={{ cursor: "pointer" }}
                        title={activeConv.type === "group" ? "Click to view group info & settings" : "Click to toggle details panel"}
                    >
                        <h3 style={{ margin: 0, fontSize: 16, color: t.text, fontWeight: 800, display: "flex", alignItems: "center", gap: 6 }}>
                            {activeConv.display_name}
                            {activeConv.type === "group" && (
                                <span
                                    title="Group Chat"
                                    style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        background: "rgba(56,189,248,0.18)",
                                        color: "#38bdf8",
                                        width: 26,
                                        height: 26,
                                        borderRadius: "50%",
                                        flexShrink: 0
                                    }}
                                >
                                    <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                </span>
                            )}
                        </h3>
                        <span style={{
                            fontSize: 11,
                            color: getActiveTypingLabel() ? t.accent : ((activeConv.other_participant?.status === "online" || activeConv.status === "online") ? "#34A853" : t.textMuted),
                            height: 14,
                            display: "block"
                        }}>
                            {getActiveTypingLabel() ||
                                (activeConv.type === "group"
                                    ? `${activeConv.participants?.length || 0} members`
                                    : (!activeConv.other_participant
                                        ? "personal cloud storage"
                                        : ((activeConv.other_participant.status === "online" || activeConv.status === "online")
                                            ? "online"
                                            : formatLastSeen(activeConv.other_participant.last_seen))))}
                        </span>
                    </div>
                )}

                <div className="ht-header-actions" style={{ display: "flex", alignItems: "center", gap: 8, position: "relative" }}>
                    {!isInChatSearchOpen && (
                        <button
                            className="ht-action-circle-btn"
                            style={{ color: isInChatSearchOpen ? (theme === "dark" ? "#38bdf8" : "#0284c7") : t.text }}
                            onClick={() => {
                                setIsInChatSearchOpen(true);
                                setInChatSearchQuery("");
                                setInChatSearchMatchIndex(0);
                            }}
                            title="Search Messages in Chat"
                        >
                            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </button>
                    )}
                    <button
                        className="ht-action-circle-btn"
                        style={{ color: showInspector ? (theme === "dark" ? "#38bdf8" : "#0284c7") : t.text }}
                        onClick={() => setShowInspector(prev => !prev)}
                        title="Toggle Conversation Inspector"
                    >
                        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </button>

                    {/* Conversation Options Dropdown (Pin / Mute / Group Info) */}
                    <div ref={headerMenuRef} style={{ position: "relative" }}>
                        <button
                            className="ht-action-circle-btn"
                            style={{ color: isHeaderMenuOpen ? (theme === "dark" ? "#38bdf8" : "#0284c7") : t.text }}
                            onClick={() => setIsHeaderMenuOpen(prev => !prev)}
                            title="Conversation Options"
                        >
                            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                            </svg>
                        </button>

                        {isHeaderMenuOpen && (
                            <div style={{
                                position: "absolute",
                                top: 40,
                                right: 0,
                                width: 175,
                                background: t.cardBg,
                                border: t.border,
                                borderRadius: 12,
                                boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
                                zIndex: 100,
                                padding: 6,
                                backdropFilter: "blur(12px)"
                            }}>
                                {activeConv.type === "group" && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setEditGroupTitle(activeConv.title || activeConv.display_name || "");
                                            setEditGroupAvatarUrl(activeConv.avatar_url || "");
                                            setIsGroupInfoOpen(true);
                                            setIsHeaderMenuOpen(false);
                                        }}
                                        style={{
                                            width: "100%",
                                            padding: "8px 12px",
                                            background: "none",
                                            border: "none",
                                            color: t.text,
                                            fontSize: 13,
                                            fontWeight: 500,
                                            borderRadius: 8,
                                            cursor: "pointer",
                                            textAlign: "left",
                                            marginBottom: 2
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = "rgba(120, 120, 120, 0.1)"}
                                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                                    >
                                        Group Info & Settings
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => {
                                        togglePinConversation(activeConv.id);
                                        setIsHeaderMenuOpen(false);
                                    }}
                                    style={{
                                        width: "100%",
                                        padding: "8px 12px",
                                        background: "none",
                                        border: "none",
                                        color: t.text,
                                        fontSize: 13,
                                        fontWeight: 500,
                                        borderRadius: 8,
                                        cursor: "pointer",
                                        textAlign: "left",
                                        marginBottom: 2
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = "rgba(120, 120, 120, 0.1)"}
                                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                                >
                                    {isConvPinned(activeConv) ? "Unpin Chat" : "Pin Chat"}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        toggleMuteConversation(activeConv.id);
                                        setIsHeaderMenuOpen(false);
                                    }}
                                    style={{
                                        width: "100%",
                                        padding: "8px 12px",
                                        background: "none",
                                        border: "none",
                                        color: t.text,
                                        fontSize: 13,
                                        fontWeight: 500,
                                        borderRadius: 8,
                                        cursor: "pointer",
                                        textAlign: "left"
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = "rgba(120, 120, 120, 0.1)"}
                                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                                >
                                    {(Array.isArray(mutedConvIds) ? mutedConvIds.includes(activeConv.id) : mutedConvIds?.[activeConv.id]) ? "Unmute Notifications" : "Mute Notifications"}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Pinned Message Stack Banner */}
            {(() => {
                const pins = pinnedMessagesMap?.[activeConv?.id] || [];
                if (pins.length === 0) return null;
                const safeIndex = activePinIndex % pins.length;
                const pinItem = pins[safeIndex];
                const pinnedMsgId = pinItem.message_id || pinItem.id;
                const pinnedMsg = messages.find(m => String(m.id || m.message_id) === String(pinnedMsgId)) || pinItem;
                const isSelf = pinnedMsg.sender_id === user.userId;
                const senderPart = (activeConv?.participants || []).find(p => (p.user_id || p.id) === pinnedMsg.sender_id);
                const senderTitle = isSelf ? "You" : (pinnedMsg.sender_name || senderPart?.display_name || senderPart?.username || activeConv.display_name || "Participant");
                const scopeBadge = pinItem.scope === "personal" ? " (Only for you)" : "";

                return (
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "8px 16px",
                            background: "rgba(3, 52, 110, 0.12)",
                            backdropFilter: "blur(8px)",
                            borderBottom: t.border,
                            cursor: "pointer",
                            zIndex: 10
                        }}
                        onClick={() => {
                            const nextIdx = (activePinIndex + 1) % pins.length;
                            setActivePinIndex(nextIdx);
                            const nextPin = pins[nextIdx];
                            const nextId = nextPin.message_id || nextPin.id;
                            const el = document.getElementById(`msg-${nextId}`);
                            if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                            <svg width="16" height="16" fill={t.accent} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                                <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6l1 1 1-1v-6h5v-2l-2-2z" />
                            </svg>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: t.accent }}>
                                    Pinned Message {pins.length > 1 ? `(${safeIndex + 1}/${pins.length})` : ""} • {senderTitle}{scopeBadge}
                                </div>
                                <div style={{ fontSize: 12, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {pinnedMsg.content || (pinnedMsg.message_type === "image" ? "📷 Image" : "Attachment")}
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (handleUnpin) {
                                    handleUnpin(pinItem);
                                } else {
                                    handleTogglePin(pinnedMsg);
                                }
                            }}
                            style={{
                                background: "none",
                                border: "none",
                                color: t.textMuted,
                                cursor: "pointer",
                                padding: 4,
                                display: "flex",
                                alignItems: "center"
                            }}
                            title="Unpin Message"
                        >
                            ✕
                        </button>
                    </div>
                );
            })()}

            {/* Interactive Scroll Pane */}
            <div className="ht-message-stream" ref={chatContainerRef} onScroll={handleChatScroll} onClick={handleCloseContextMenu} onPaste={handlePaste} style={{ position: "relative" }}>
                {messages.map(m => {
                    const isSelf = m.sender_id === user.userId;
                    const parentMsg = m.reply_to_id ? messages.find(msg => (msg.id || msg.message_id) === m.reply_to_id) : null;
                    const isSearchMatched = inChatSearchQuery.trim() && m.content?.toLowerCase().includes(inChatSearchQuery.toLowerCase());
                    const isCurrentSearchMatch = isSearchMatched && searchMatchingMessages[inChatSearchMatchIndex]?.id === (m.id || m.message_id);

                    return (
                        <div
                            id={`msg-${m.id || m.message_id}`}
                            key={m.id || m.message_id}
                            className={`ht-msg-row ${isSelf ? "self" : "recv"}`}
                            onMouseEnter={() => setHoveredMsgId(m.id || m.message_id)}
                            onMouseLeave={() => setHoveredMsgId(null)}
                            style={{ position: "relative", wordBreak: "break-all", minWidth: 0 }}
                        >
                            <div className="ht-msg-avatar">
                                {isSelf ? (
                                    myProfile.avatar_url ? (
                                        <img src={myProfile.avatar_url} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                                    ) : (
                                        user?.username?.[0]?.toUpperCase() || "U"
                                    )
                                ) : (
                                    (() => {
                                        const senderPart = (activeConv?.participants || []).find(p => (p.user_id || p.id) === m.sender_id);
                                        const avatarUrl = m.sender_avatar || senderPart?.avatar_url;
                                        const nameForInitial = m.sender_name || senderPart?.display_name || senderPart?.username || activeConv?.display_name || "P";
                                        return avatarUrl ? (
                                            <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                                        ) : (
                                            nameForInitial[0]?.toUpperCase() || "@"
                                        );
                                    })()
                                )}
                            </div>
                            <div className="ht-msg-bubble-box" style={{ position: "relative", minWidth: 0, maxWidth: "100%", overflow: "hidden" }}>

                                <div
                                    className="ht-msg-bubble"
                                    onContextMenu={(e) => handleContextMenu(e, m)}
                                    style={{
                                        background: isSelf ? t.bubbleSent : t.bubbleRecv,
                                        color: isSelf ? t.bubbleSentText : t.bubbleRecvText,
                                        wordBreak: "break-all",
                                        overflowWrap: "anywhere",
                                        whiteSpace: "pre-wrap",
                                        maxWidth: "100%",
                                        overflow: "hidden",
                                        padding: m.message_type === "image" ? "6px" : "12px 16px",
                                        cursor: "context-menu",
                                        border: isCurrentSearchMatch ? "2px solid #EAB308" : (isSearchMatched ? "1.5px solid rgba(234, 179, 8, 0.6)" : "1px solid transparent"),
                                        boxShadow: isCurrentSearchMatch ? "0 0 16px rgba(234, 179, 8, 0.5)" : "none",
                                        transition: "all 0.2s ease"
                                    }}
                                >
                                    {activeConv.type === "group" && !isSelf && (
                                        <div style={{
                                            fontSize: "11.5px",
                                            fontWeight: "800",
                                            color: getSenderNameColor(m.sender_id),
                                            marginBottom: "4px",
                                            letterSpacing: "0.2px"
                                        }}>
                                            {(() => {
                                                const senderPart = (activeConv?.participants || []).find(p => (p.user_id || p.id) === m.sender_id);
                                                return m.sender_name || senderPart?.display_name || senderPart?.username || "Participant";
                                            })()}
                                        </div>
                                    )}
                                    {m.reply_to_id && (
                                        <div
                                            style={{
                                                borderLeft: `3px solid ${isSelf ? "#ffffff" : t.accent}`,
                                                background: "rgba(0, 0, 0, 0.15)",
                                                padding: "4px 8px",
                                                borderRadius: "4px",
                                                fontSize: "11px",
                                                marginBottom: "6px",
                                                cursor: "pointer"
                                            }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const el = document.getElementById(`msg-${m.reply_to_id}`);
                                                if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                                            }}
                                        >
                                            <div style={{ fontWeight: 700, fontSize: "10px", opacity: 0.9 }}>
                                                Replying to message
                                            </div>
                                            <div style={{ opacity: 0.85, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", maxWidth: "200px" }}>
                                                {parentMsg?.content || "Quoted attachment"}
                                            </div>
                                        </div>
                                    )}

                                    {m.message_type === "image" ? (
                                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                            <img
                                                src={getAssetUrl(m.media_url || m.file_url)}
                                                alt="Attachment"
                                                style={{ maxWidth: "260px", maxHeight: "260px", borderRadius: 10, objectFit: "cover", cursor: "pointer" }}
                                                onClick={() => window.open(getAssetUrl(m.media_url || m.file_url), "_blank")}
                                            />
                                            {m.content && m.content !== (m.media_url || m.file_url)?.split("/").pop() && (
                                                <div style={{ padding: "4px 8px 2px", fontSize: 13, color: isSelf ? t.bubbleSentText : t.bubbleRecvText }}>{m.content}</div>
                                            )}
                                        </div>
                                    ) : (m.message_type === "audio" || m.message_type === "voice") ? (
                                        <VoicePlayer
                                            src={getAssetUrl(m.media_url || m.file_url)}
                                            isSelf={isSelf}
                                            themeColors={t}
                                        />
                                    ) : m.message_type === "file" ? (
                                        <a
                                            href={getAssetUrl(m.media_url || m.file_url)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "inherit" }}
                                        >
                                            <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(120, 120, 120, 0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                            </div>
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontSize: 13, fontWeight: "700", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", maxWidth: "180px" }}>{m.content}</div>
                                                <div style={{ fontSize: 10, opacity: 0.6 }}>Attached File</div>
                                            </div>
                                        </a>
                                    ) : (
                                        <span style={{ wordBreak: "break-all", overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>
                                            {m.content}
                                        </span>
                                    )}
                                </div>

                                {/* Reaction Badges */}
                                {m.reactions && Object.keys(m.reactions).length > 0 && (
                                    <div style={{
                                        display: "flex",
                                        flexWrap: "wrap",
                                        gap: "4px",
                                        marginTop: "4px",
                                        justifyContent: isSelf ? "flex-end" : "flex-start"
                                    }}>
                                        {Object.entries(m.reactions).map(([emoji, uids]) => {
                                            const currentUserId = String(user?.userId || user?.user_id || "");
                                            const hasReacted = Array.isArray(uids) && uids.includes(currentUserId);

                                            const reactUsers = uids.map(uid => {
                                                const normUid = String(uid);
                                                if (normUid === currentUserId) {
                                                    return {
                                                        avatar: myProfile?.avatar_url || user?.avatar_url,
                                                        initial: (user?.username || myProfile?.display_name || "U")[0].toUpperCase()
                                                    };
                                                }
                                                const part = (activeConv?.participants || []).find(p => String(p.user_id || p.id) === normUid);
                                                if (part) {
                                                    return {
                                                        avatar: part.avatar_url,
                                                        initial: (part.display_name || part.username || "?")[0].toUpperCase()
                                                    };
                                                }
                                                const other = activeConv?.other_participant;
                                                if (other && String(other.user_id || other.id) === normUid) {
                                                    return {
                                                        avatar: other.avatar_url,
                                                        initial: (other.display_name || other.username || "?")[0].toUpperCase()
                                                    };
                                                }
                                                return { avatar: null, initial: "?" };
                                            });

                                            const shownUsers = reactUsers.slice(0, 3);

                                            return (
                                                <button
                                                    key={emoji}
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleToggleReaction(m, emoji);
                                                    }}
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: "4px",
                                                        paddingLeft: "5px",
                                                        paddingRight: "8px",
                                                        paddingTop: "3px",
                                                        paddingBottom: "3px",
                                                        borderRadius: "9999px",
                                                        background: hasReacted ? "rgba(63, 224, 197, 0.18)" : "rgba(255, 255, 255, 0.07)",
                                                        border: hasReacted ? "1px solid #3FE0C5" : "1px solid rgba(255, 255, 255, 0.12)",
                                                        backdropFilter: "blur(8px)",
                                                        cursor: "pointer",
                                                        transition: "all 0.15s ease",
                                                        color: isSelf ? t.bubbleSentText : t.bubbleRecvText
                                                    }}
                                                    title={`${uids.length} reaction${uids.length > 1 ? "s" : ""}`}
                                                >
                                                    <div style={{ display: "flex", alignItems: "center", marginRight: 2 }}>
                                                        {shownUsers.map((u, idx) => (
                                                            <div
                                                                key={idx}
                                                                style={{
                                                                    width: 16,
                                                                    height: 16,
                                                                    borderRadius: "50%",
                                                                    overflow: "hidden",
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    justifyContent: "center",
                                                                    marginLeft: idx === 0 ? 0 : -6,
                                                                    border: "1.5px solid #0B0E16",
                                                                    background: u.avatar ? "transparent" : "linear-gradient(135deg, #4A3FE0, #8B7FFF)",
                                                                    zIndex: shownUsers.length - idx,
                                                                    flexShrink: 0
                                                                }}
                                                            >
                                                                {u.avatar ? (
                                                                    <img src={getAssetUrl(u.avatar)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                                                ) : (
                                                                    <span style={{ fontSize: 8, fontWeight: 700, color: "#fff" }}>
                                                                        {u.initial}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <span style={{ fontSize: 12 }}>{emoji}</span>
                                                    {uids.length > 1 && (
                                                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, opacity: 0.85, fontWeight: 600, marginLeft: 2 }}>
                                                            {uids.length}
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                <span style={{ fontSize: 9.5, color: t.textMuted, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                                    {formatTime(m.created_at)}
                                    {m.is_edited && <span style={{ fontStyle: "italic", opacity: 0.7 }}>(edited)</span>}
                                    {isSelf && renderMessageStatus(m.status, false)}
                                </span>
                            </div>
                        </div>
                    );
                })}

                {/* Animated Typing Indicator Bubble */}
                {getActiveTypingLabel() && (
                    <div className="ht-msg-row recv" style={{ position: "relative", marginBottom: 12, marginTop: 4 }}>
                        <div className="ht-msg-avatar" style={{ background: "linear-gradient(135deg, #6366f1, #38bdf8)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 11 }}>
                            💬
                        </div>
                        <div className="ht-msg-bubble-box">
                            <div
                                className="ht-msg-bubble"
                                style={{
                                    background: t.bubbleRecv,
                                    color: t.bubbleRecvText,
                                    padding: "8px 14px",
                                    borderRadius: "18px",
                                    borderTopLeftRadius: "4px",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 8,
                                    boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
                                }}
                            >
                                <span style={{ fontSize: 12, fontWeight: 700, color: theme === "dark" ? "#38bdf8" : t.accent }}>
                                    {getActiveTypingLabel()}
                                </span>
                                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: theme === "dark" ? "#38bdf8" : t.accent, animation: "typingBounce 1.4s infinite ease-in-out both", animationDelay: "0s" }} />
                                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: theme === "dark" ? "#38bdf8" : t.accent, animation: "typingBounce 1.4s infinite ease-in-out both", animationDelay: "0.2s" }} />
                                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: theme === "dark" ? "#38bdf8" : t.accent, animation: "typingBounce 1.4s infinite ease-in-out both", animationDelay: "0.4s" }} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messageEndRef} />
            </div>

            {/* Floating Scroll to Bottom / New Messages Pill Button */}
            {showScrollBottomBtn && (
                <button
                    type="button"
                    onClick={() => scrollToBottom(true)}
                    style={{
                        position: "absolute",
                        bottom: 84,
                        right: 28,
                        background: t.accent,
                        color: "#ffffff",
                        border: "none",
                        borderRadius: 30,
                        padding: "8px 16px",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        cursor: "pointer",
                        boxShadow: "0 6px 20px rgba(0, 0, 0, 0.35)",
                        fontSize: 12,
                        fontWeight: "700",
                        zIndex: 50,
                        transition: "all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
                    }}
                >
                    <span>{newMessagesBelowCount > 0 ? `${newMessagesBelowCount} new ${newMessagesBelowCount === 1 ? "message" : "messages"}` : "Latest messages"}</span>
                    <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
                    </svg>
                </button>
            )}

            {/* Right-Click Message Context Menu */}
            {contextMenu && (
                <div
                    style={{
                        position: "fixed",
                        top: Math.min(contextMenu.y, window.innerHeight - 280),
                        left: Math.min(contextMenu.x, window.innerWidth - 200),
                        zIndex: 10000,
                        background: "rgba(20, 25, 35, 0.96)",
                        backdropFilter: "blur(14px)",
                        border: "1px solid rgba(255, 255, 255, 0.12)",
                        borderRadius: "14px",
                        boxShadow: "0 12px 36px rgba(0, 0, 0, 0.5)",
                        padding: "8px",
                        minWidth: "180px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px"
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Quick Emoji Reactions Header */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 2px 8px", borderBottom: "1px solid rgba(255, 255, 255, 0.1)" }}>
                        {REACTION_EMOJIS.map(emoji => (
                            <button
                                key={emoji}
                                type="button"
                                onClick={() => handleToggleReaction(contextMenu.message, emoji)}
                                style={{
                                    background: "none",
                                    border: "none",
                                    fontSize: "18px",
                                    cursor: "pointer",
                                    padding: "4px",
                                    borderRadius: "8px",
                                    transition: "transform 0.15s ease"
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.25)"}
                                onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>

                    <button
                        type="button"
                        onClick={() => handleStartReply(contextMenu.message)}
                        style={{
                            background: "transparent",
                            border: "none",
                            color: "#ffffff",
                            padding: "8px 12px",
                            borderRadius: "8px",
                            fontSize: "13px",
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            cursor: "pointer",
                            textAlign: "left"
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)"}
                        onMouseOut={(e) => e.currentTarget.style.background = "transparent"}
                    >
                        Reply
                    </button>

                    <button
                        type="button"
                        onClick={() => handleTogglePin(contextMenu.message)}
                        style={{
                            background: "transparent",
                            border: "none",
                            color: "#ffffff",
                            padding: "8px 12px",
                            borderRadius: "8px",
                            fontSize: "13px",
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            cursor: "pointer",
                            textAlign: "left"
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)"}
                        onMouseOut={(e) => e.currentTarget.style.background = "transparent"}
                    >
                        {((pinnedMessagesMap?.[activeConv?.id] || []).some(p => String(p.message_id || p.id) === String(contextMenu.message.id || contextMenu.message.message_id))) ? "Unpin Message" : "Pin Message"}
                    </button>

                    {contextMenu.message.content && (
                        <button
                            type="button"
                            onClick={() => handleCopyMsgText(contextMenu.message)}
                            style={{
                                background: "transparent",
                                border: "none",
                                color: "#ffffff",
                                padding: "8px 12px",
                                borderRadius: "8px",
                                fontSize: "13px",
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                                cursor: "pointer",
                                textAlign: "left"
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)"}
                            onMouseOut={(e) => e.currentTarget.style.background = "transparent"}
                        >
                            Copy Text
                        </button>
                    )}

                    {contextMenu.message.message_type === "image" && (
                        <button
                            type="button"
                            onClick={() => handleCopyImage(contextMenu.message)}
                            style={{
                                background: "transparent",
                                border: "none",
                                color: "#ffffff",
                                padding: "8px 12px",
                                borderRadius: "8px",
                                fontSize: "13px",
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                                cursor: "pointer",
                                textAlign: "left"
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)"}
                            onMouseOut={(e) => e.currentTarget.style.background = "transparent"}
                        >
                            Copy Image
                        </button>
                    )}

                    {contextMenu.message.sender_id === user.userId && contextMenu.message.message_type === "text" && (
                        <button
                            type="button"
                            onClick={() => handleStartEdit(contextMenu.message)}
                            style={{
                                background: "transparent",
                                border: "none",
                                color: "#ffffff",
                                padding: "8px 12px",
                                borderRadius: "8px",
                                fontSize: "13px",
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                                cursor: "pointer",
                                textAlign: "left"
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)"}
                            onMouseOut={(e) => e.currentTarget.style.background = "transparent"}
                        >
                            Edit Message
                        </button>
                    )}

                    {contextMenu.message.sender_id === user.userId && (
                        <button
                            type="button"
                            onClick={() => handleDeleteMsg(contextMenu.message)}
                            style={{
                                background: "transparent",
                                border: "none",
                                color: "#ef4444",
                                padding: "8px 12px",
                                borderRadius: "8px",
                                fontSize: "13px",
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                                cursor: "pointer",
                                textAlign: "left",
                                fontWeight: 600
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = "rgba(239, 68, 68, 0.15)"}
                            onMouseOut={(e) => e.currentTarget.style.background = "transparent"}
                        >
                            Delete Message
                        </button>
                    )}
                </div>
            )}

            {/* Floating Rounded Input Card */}
            <form className="ht-chat-input-form" onSubmit={handleSendMessage}>
                {replyingTo && (
                    <div style={{
                        padding: "8px 14px",
                        marginBottom: 8,
                        background: "rgba(56, 189, 248, 0.12)",
                        borderLeft: `4px solid ${t.accent}`,
                        borderRadius: "10px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        fontSize: "12px"
                    }}>
                        <div>
                            <span style={{ fontWeight: 700, color: t.accent }}>Replying to {replyingTo.senderName}: </span>
                            <span style={{ color: t.text, opacity: 0.85 }}>{replyingTo.content}</span>
                        </div>
                        <button type="button" onClick={() => setReplyingTo(null)} style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer", fontSize: "14px", fontWeight: "bold" }}>✕</button>
                    </div>
                )}

                {editingMessage && (
                    <div style={{
                        padding: "8px 14px",
                        marginBottom: 8,
                        background: "rgba(234, 179, 8, 0.12)",
                        borderLeft: "4px solid #eab308",
                        borderRadius: "10px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        fontSize: "12px"
                    }}>
                        <div>
                            <span style={{ fontWeight: 700, color: "#eab308" }}>Editing message</span>
                        </div>
                        <button type="button" onClick={() => { setEditingMessage(null); setMessageText(""); }} style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer", fontSize: "14px", fontWeight: "bold" }}>✕</button>
                    </div>
                )}

                {selectedFile && (
                    <div style={{
                        background: t.cardBg,
                        border: t.border,
                        borderRadius: 14,
                        padding: "8px 12px",
                        marginBottom: 8,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        boxShadow: "0 4px 12px rgba(0,0,0,0.05)"
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            {filePreview ? (
                                <img src={filePreview} alt="Preview" style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover" }} />
                            ) : (
                                <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(120, 120, 120, 0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                            )}
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: "700", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", maxWidth: "200px", color: t.text }}>{selectedFile.name}</div>
                                <div style={{ fontSize: 10, color: t.textMuted }}>{(selectedFile.size / 1024).toFixed(1)} KB</div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={cancelAttachment}
                            style={{
                                background: "rgba(120, 120, 120, 0.1)",
                                border: "none",
                                borderRadius: "50%",
                                width: 24,
                                height: 24,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                                color: t.text
                            }}
                        >
                            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                )}

                {isUploading && (
                    <div style={{ padding: "6px 12px 10px", width: "100%", boxSizing: "border-box" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 4 }}>
                            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span className="flowchat-beacon-dot" style={{ width: 6, height: 6, margin: 0 }}></span>
                                Uploading attachment...
                            </span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#38bdf8" }}>
                                {uploadProgress.loadedFormatted} / {uploadProgress.totalFormatted} • {uploadProgress.percentage}%
                            </span>
                        </div>
                        <div className="ht-upload-progress-container">
                            <div className="ht-upload-progress-bar-real" style={{ width: `${uploadProgress.percentage}%` }}></div>
                        </div>
                    </div>
                )}

                <div className="ht-chat-input-card" style={{ background: t.cardBg, border: t.border }}>
                    <svg
                        width="18"
                        height="18"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        viewBox="0 0 24 24"
                        style={{ cursor: "pointer", opacity: 0.65, marginBottom: "8px" }}
                        title="Attach File"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 11-2.828-2.828l6.414-6.414a4 4 0 015.656 5.656l-6.415 6.415a6 6 0 11-8.486-8.486L10.5 5" />
                    </svg>

                    <textarea
                        ref={inputTextareaRef}
                        rows={1}
                        placeholder={selectedFile ? "Add a caption..." : "Type a message..."}
                        value={messageText}
                        onChange={(e) => {
                            setMessageText(e.target.value);
                            handleKeyPress();
                        }}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                if (e.shiftKey) {
                                    return; // Allow Shift + Enter to insert a new line naturally
                                }
                                e.preventDefault();
                                handleSendMessage(e);
                            }
                        }}
                        onPaste={handlePaste}
                        className="ht-chat-input-field"
                        style={{
                            color: t.text,
                            resize: "none",
                            border: "none",
                            outline: "none",
                            background: "transparent",
                            fontFamily: "inherit",
                            fontSize: "14px",
                            maxHeight: "100px",
                            overflowY: "auto",
                            paddingTop: "6px",
                            paddingBottom: "6px"
                        }}
                    />

                    <div className="ht-input-actions">
                        <div style={{ position: "relative" }} ref={emojiPickerRef}>
                            <svg
                                width="18"
                                height="18"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                viewBox="0 0 24 24"
                                style={{ cursor: "pointer", opacity: showEmojiPicker ? 1 : 0.6, marginRight: 8, color: showEmojiPicker ? t.accent : "currentColor" }}
                                title="Insert Emoji"
                                onClick={() => setShowEmojiPicker(prev => !prev)}
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {showEmojiPicker && (
                                <div style={{
                                    position: "absolute",
                                    bottom: "calc(100% + 22px)",
                                    right: 0,
                                    zIndex: 100,
                                    "--epr-bg-color": t.cardBg,
                                    "--epr-category-label-bg-color": t.cardBg,
                                    "--epr-header-padding": "12px",
                                    "--epr-search-input-bg-color": theme === "dark" ? "#121316" : "#f0f1f3",
                                    "--epr-search-input-bg-color-active": theme === "dark" ? "#121316" : "#f0f1f3",
                                    "--epr-search-border-color": theme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
                                    "--epr-search-input-text-color": t.text,
                                    "--epr-text-color": t.text,
                                    "--epr-category-label-text-color": t.textMuted,
                                    "--epr-hover-bg-color": theme === "dark" ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)",
                                    "--epr-focus-bg-color": theme === "dark" ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)",
                                    "--epr-picker-border-color": theme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                                    "--epr-active-skin-tone-indicator-border-color": t.accent,
                                    "--epr-skin-tone-picker-menu-overlay-bg-color": t.cardBg,
                                    borderRadius: 16,
                                    overflow: "hidden",
                                    boxShadow: theme === "dark" ? "0 8px 40px rgba(0,0,0,0.5)" : "0 8px 32px rgba(0,0,0,0.16)",
                                    border: t.border,
                                }}>
                                    <EmojiPicker
                                        theme={theme === "dark" ? "dark" : "light"}
                                        emojiStyle="native"
                                        onEmojiClick={(emojiData) => {
                                            setMessageText(prev => prev + emojiData.emoji);
                                            setShowEmojiPicker(false);
                                        }}
                                        searchPlaceHolder="Search emoji..."
                                        lazyLoadEmojis
                                        height={340}
                                        width={380}
                                        previewConfig={{ showPreview: false }}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Voice message mic button */}
                        {!messageText.trim() && !selectedFile && (
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                {isRecording && (
                                    <button
                                        type="button"
                                        title="Cancel recording"
                                        onClick={() => {
                                            if (mediaRecorderRef.current?.state === "recording") {
                                                mediaRecorderRef.current.onstop = null;
                                                mediaRecorderRef.current.stop();
                                            }
                                            if (audioStreamRef.current) {
                                                audioStreamRef.current.getTracks().forEach(t => t.stop());
                                            }
                                            clearInterval(recordingTimerRef.current);
                                            setIsRecording(false);
                                            setRecordingSeconds(0);
                                        }}
                                        style={{
                                            border: "none",
                                            background: "rgba(229, 62, 62, 0.15)",
                                            color: "#e53e3e",
                                            borderRadius: "50%",
                                            width: 32,
                                            height: 32,
                                            cursor: "pointer",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center"
                                        }}
                                    >
                                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                )}
                                <button
                                    type="button"
                                    title={isRecording ? "Click to stop & send voice message" : "Click to record voice message"}
                                    onClick={async () => {
                                        if (isRecording) {
                                            if (mediaRecorderRef.current?.state === "recording") {
                                                mediaRecorderRef.current.stop();
                                            }
                                            clearInterval(recordingTimerRef.current);
                                            setIsRecording(false);
                                            setRecordingSeconds(0);
                                            return;
                                        }

                                        if (!activeConv) return;
                                        try {
                                            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                                            audioStreamRef.current = stream;
                                            audioChunksRef.current = [];
                                            const mr = new MediaRecorder(stream);
                                            mediaRecorderRef.current = mr;

                                            mr.ondataavailable = (e) => {
                                                if (e.data.size > 0) audioChunksRef.current.push(e.data);
                                            };

                                            mr.onstop = async () => {
                                                stream.getTracks().forEach(t => t.stop());
                                                const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
                                                if (blob.size < 1000) return;

                                                setIsUploading(true);
                                                try {
                                                    const fd = new FormData();
                                                    fd.append("file", blob, `voice_${Date.now()}.webm`);
                                                    const token = localStorage.getItem("chat_token");
                                                    const res = await fetch(`${API_BASE}/upload`, {
                                                        method: "POST",
                                                        headers: { Authorization: `Bearer ${token}` },
                                                        body: fd
                                                    });
                                                    const data = await res.json();
                                                    if (data.url && socketRef.current) {
                                                        const tempId = `temp-${Date.now()}`;
                                                        setMessages(prev => [
                                                            ...prev,
                                                            {
                                                                id: tempId,
                                                                sender_id: user.userId,
                                                                content: "Voice message",
                                                                message_type: "audio",
                                                                media_url: data.url,
                                                                created_at: new Date().toISOString(),
                                                                status: "pending"
                                                            }
                                                        ]);
                                                        socketRef.current.send(JSON.stringify({
                                                            action: "send_message",
                                                            conversation_id: activeConv.id,
                                                            content: "Voice message",
                                                            message_type: "audio",
                                                            media_url: data.url
                                                        }));
                                                    }
                                                } catch (err) {
                                                    console.error("Voice upload failed:", err);
                                                } finally {
                                                    setIsUploading(false);
                                                }
                                            };

                                            mr.start();
                                            setIsRecording(true);
                                            setRecordingSeconds(0);
                                            recordingTimerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
                                        } catch (err) {
                                            console.error("Mic error:", err);
                                            if (err.name === "NotFoundError" || err.message?.includes("not be found")) {
                                                alert("No microphone device found on your computer. Please connect a microphone to record voice messages.");
                                            } else {
                                                alert("Could not access microphone. Please check your browser and system microphone permissions.");
                                            }
                                        }
                                    }}
                                    style={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: "50%",
                                        border: "none",
                                        background: isRecording ? "#e53e3e" : t.accent,
                                        color: "white",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        cursor: "pointer",
                                        flexShrink: 0,
                                        transition: "all 0.2s ease"
                                    }}
                                >
                                    {isRecording ? (
                                        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "-0.5px" }}>
                                            {Math.floor(recordingSeconds / 60).toString().padStart(2, "0")}:{(recordingSeconds % 60).toString().padStart(2, "0")}
                                        </span>
                                    ) : (
                                        <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
                                            <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                            <line x1="8" y1="23" x2="16" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        )}

                        {/* Send button */}
                        {(messageText.trim() || selectedFile) && (
                            <button className="ht-send-pill" type="submit" style={{ background: t.accent }} disabled={isUploading}>
                                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>
            </form>
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                style={{ display: "none" }}
            />
        </div>
    );
}
