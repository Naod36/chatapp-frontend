import { useEffect, useRef, useState } from "react";
import { authService } from "../services/auth";
import { userService } from "../services/user";
import { conversationService } from "../services/conversations";
import { websocketService } from "../services/websocket";
import { API_BASE } from "../services/api";
import EmojiPicker from "emoji-picker-react";
import VoicePlayer from "./VoicePlayer";

const THEME = {
    light: {
        sidebarBg: "#f6f7f9",
        chatBg: "#eceef1",
        inspectorBg: "#ffffff",
        border: "1px solid rgba(0, 0, 0, 0.06)",
        cardBg: "#ffffff",
        text: "#14171a",
        textMuted: "#657786",
        accent: "#03346E",
        accentHover: "#022854",
        inputBg: "#ffffff",
        bubbleSent: "#03346E",
        bubbleSentText: "#ffffff",
        bubbleRecv: "#ffffff",
        bubbleRecvText: "#14171a",
        inputBorder: "1px solid rgba(0, 0, 0, 0.08)"
    },
    dark: {
        sidebarBg: "#121316",
        chatBg: "#16171b",
        inspectorBg: "#1a1c20",
        border: "1px solid rgba(255, 255, 255, 0.06)",
        cardBg: "#1e2126",
        text: "#e1e8ed",
        textMuted: "#8899a6",
        accent: "#03346E",
        accentHover: "#022854",
        inputBg: "#131417",
        bubbleSent: "#03346E",
        bubbleSentText: "#ffffff",
        bubbleRecv: "#1e2126",
        bubbleRecvText: "#e1e8ed",
        inputBorder: "1px solid rgba(255, 255, 255, 0.08)"
    }
};

const formatLastSeen = (timestamp) => {
    if (!timestamp) return "offline";
    try {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHr = Math.floor(diffMin / 60);
        const diffDays = Math.floor(diffHr / 24);

        if (diffSec < 60) return "last seen recently";
        if (diffMin < 60) return `last seen ${diffMin}m ago`;
        if (diffHr < 24) return `last seen ${diffHr}h ago`;
        if (diffDays === 1) return "last seen yesterday";
        if (diffDays < 7) return `last seen ${diffDays}d ago`;

        return `last seen ${date.toLocaleDateString()}`;
    } catch (e) {
        return "offline";
    }
};

const renderMessageStatus = (status, isSidebar = false) => {
    const strokeColor = status === "read"
        ? "#6366f1"
        : (isSidebar ? "rgba(120, 120, 120, 0.6)" : "rgba(180, 180, 180, 0.5)");

    if (status === "read" || status === "delivered") {
        return (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0, marginLeft: isSidebar ? 0 : 4 }}>
                <path d="M18 5L7 16l-5-5" />
                <path d="M22 5l-11 11-3-3" />
            </svg>
        );
    }
    if (status === "sent") {
        return (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0, marginLeft: isSidebar ? 0 : 4 }}>
                <path d="M20 6L9 17l-5-5" />
            </svg>
        );
    }
    // Pending / Clock
    return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0, marginLeft: isSidebar ? 0 : 4 }}>
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
        </svg>
    );
};

const getAssetUrl = (url) => {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) return url;
    return `${API_BASE}${url}`;
};

export default function ChatDashboard({ user, onLogout }) {
    const [theme, setTheme] = useState(() => {
        const saved = localStorage.getItem("theme_preference");
        if (saved) return saved;
        const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        return systemPrefersDark ? "dark" : "light";
    });
    const [conversations, setConversations] = useState([]);
    const [activeConv, setActiveConv] = useState(null);
    const [messages, setMessages] = useState([]);
    const [messageText, setMessageText] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [wsConnected, setWsConnected] = useState(false);
    const [typingUsers, setTypingUsers] = useState({}); // { [convId]: { [userId]: boolean } }

    // UI redesign states
    const [activeRailTab, setActiveRailTab] = useState("chats"); // "chats" | "profile" | "settings"
    const [showInspector, setShowInspector] = useState(true);
    const [myProfile, setMyProfile] = useState({ display_name: user?.username || "", bio: "", avatar_url: "" });
    const [selectedFile, setSelectedFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [filePreview, setFilePreview] = useState(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    // Voice message recording state
    const [isRecording, setIsRecording] = useState(false);
    const [recordingSeconds, setRecordingSeconds] = useState(0);
    const mediaRecorderRef = useRef(null);
    const recordingTimerRef = useRef(null);
    const audioChunksRef = useRef([]);
    const audioStreamRef = useRef(null);
    const fileInputRef = useRef(null);
    const emojiPickerRef = useRef(null);

    // Scroll-to-bottom and unread pill state
    const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
    const [newMessagesBelowCount, setNewMessagesBelowCount] = useState(0);
    const chatContainerRef = useRef(null);

    const socketRef = useRef(null);
    const messageEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const activeConvRef = useRef(activeConv);

    useEffect(() => {
        activeConvRef.current = activeConv;
    }, [activeConv]);

    // Close emoji picker on outside click
    useEffect(() => {
        const handler = (e) => {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
                setShowEmojiPicker(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const t = THEME[theme];

    const scrollToBottom = (smooth = true) => {
        messageEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
        setNewMessagesBelowCount(0);
        setShowScrollBottomBtn(false);
    };

    // Scroll listener on chat thread container
    const handleChatScroll = () => {
        const container = chatContainerRef.current;
        if (!container) return;
        const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
        if (distanceFromBottom > 120) {
            setShowScrollBottomBtn(true);
        } else {
            setShowScrollBottomBtn(false);
            setNewMessagesBelowCount(0);
        }
    };

    // Auto-scroll when messages change or new active conversation selected
    useEffect(() => {
        const container = chatContainerRef.current;
        if (!container) return;
        const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;

        // If close to bottom or initial load, auto scroll down
        if (distanceFromBottom <= 180 || newMessagesBelowCount === 0) {
            scrollToBottom(true);
        } else {
            setNewMessagesBelowCount(prev => prev + 1);
        }
    }, [messages]);

    // Load initial conversations list
    const loadConversations = async () => {
        try {
            const rawList = await conversationService.listConversations();
            const normalized = rawList.map(c => {
                const other = c.other_participant;
                return {
                    id: c.conversation_id,
                    type: c.type,
                    display_name: other ? (other.display_name || other.username) : "Saved Messages",
                    avatar_url: other ? other.avatar_url : null,
                    last_message_content: c.last_message?.content || "",
                    last_message_time: c.last_message?.created_at || null,
                    other_participant: other,
                    last_message: c.last_message,
                    unread_count: c.unread_count || 0
                };
            });

            let selfConv = normalized.find(c => !c.other_participant);
            const others = normalized.filter(c => c.other_participant);

            if (!selfConv) {
                selfConv = {
                    id: "virtual-saved-messages",
                    type: "direct",
                    display_name: "Saved Messages",
                    avatar_url: null,
                    last_message_content: "Personal cloud inbox...",
                    last_message_time: null,
                    other_participant: null
                };
            }

            const sortedOthers = others.sort((a, b) => {
                const aTime = a.last_message_time ? new Date(a.last_message_time).getTime() : 0;
                const bTime = b.last_message_time ? new Date(b.last_message_time).getTime() : 0;
                return bTime - aTime;
            });

            setConversations([selfConv, ...sortedOthers].filter(Boolean));
        } catch (err) {
            console.error("Failed to load conversations:", err);
        }
    };

    useEffect(() => {
        loadConversations();
        const fetchMyProfile = async () => {
            try {
                const profile = await userService.getProfile();
                if (profile) {
                    setMyProfile(profile);
                }
            } catch (err) {
                console.error("Failed to load my profile info:", err);
            }
        };
        fetchMyProfile();
    }, []);

    // Set up WebSocket connection with raw socket listener
    useEffect(() => {
        if (!user.token) return;

        const socket = websocketService.connect(
            user.token,
            // onMessage callback
            (data) => {
                console.log("WebSocket event:", data);
                if (data.event === "new_message") {
                    const isCurrentActive = activeConvRef.current && activeConvRef.current.id === data.conversation_id;

                    // Update conversation list item in real-time & move to top
                    setConversations(prev => {
                        const targetIndex = prev.findIndex(c => c.id === data.conversation_id);
                        let updatedTarget = null;

                        if (targetIndex !== -1) {
                            const existing = prev[targetIndex];
                            const snippet = data.message_type === "image" ? "📷 Image" : (data.message_type === "audio" ? "🎙️ Voice message" : (data.message_type === "file" ? "📁 File" : data.content));
                            updatedTarget = {
                                ...existing,
                                last_message_content: snippet,
                                last_message_time: data.created_at,
                                last_message: {
                                    message_id: data.message_id,
                                    sender_id: data.sender_id,
                                    content: snippet,
                                    status: "delivered"
                                },
                                unread_count: isCurrentActive ? 0 : ((existing.unread_count || 0) + 1)
                            };
                        }

                        if (!updatedTarget) return prev;

                        // Separate Pinned / Saved Messages from other conversations
                        const rest = prev.filter(c => c.id !== data.conversation_id);
                        const selfConv = rest.find(c => !c.other_participant);
                        const otherConvs = rest.filter(c => c.other_participant);

                        if (!updatedTarget.other_participant) {
                            return [updatedTarget, ...otherConvs];
                        } else {
                            return [selfConv, updatedTarget, ...otherConvs].filter(Boolean);
                        }
                    });

                    // If incoming message belongs to our selected thread, push to chat bubble list
                    if (isCurrentActive) {
                        setMessages(prev => [
                            ...prev,
                            {
                                id: data.message_id,
                                sender_id: data.sender_id,
                                content: data.content,
                                message_type: data.message_type,
                                media_url: data.media_url,
                                created_at: data.created_at
                            }
                        ]);
                        // Mark conversation as read via WebSocket
                        socketRef.current?.send(JSON.stringify({
                            action: "read_conversation",
                            conversation_id: activeConvRef.current.id
                        }));
                    }
                } else if (data.event === "typing_status") {
                    setTypingUsers(prev => ({
                        ...prev,
                        [data.conversation_id]: {
                            ...(prev[data.conversation_id] || {}),
                            [data.user_id]: data.is_typing
                        }
                    }));
                } else if (data.event === "message_sent") {
                    console.log("message_sent event handler matched. status:", data.status, "message_id:", data.message_id, "conversation_id:", data.conversation_id);
                    setMessages(prev => {
                        const index = prev.findIndex(m => m.id && typeof m.id === "string" && m.id.startsWith("temp-") && m.sender_id === user.userId);
                        if (index !== -1) {
                            const updated = [...prev];
                            updated[index] = {
                                ...updated[index],
                                id: data.message_id,
                                status: data.status
                            };
                            return updated;
                        }
                        return prev;
                    });

                    setConversations(prev => {
                        return prev.map(c => {
                            if (c.id === data.conversation_id && c.last_message && c.last_message.sender_id === user.userId) {
                                return {
                                    ...c,
                                    last_message: {
                                        ...c.last_message,
                                        message_id: data.message_id,
                                        status: data.status
                                    }
                                };
                            }
                            return c;
                        });
                    });
                } else if (data.event === "message_delivered") {
                    if (activeConvRef.current && activeConvRef.current.id === data.conversation_id) {
                        setMessages(prev => {
                            return prev.map(m => {
                                if (m.sender_id === user.userId && m.status !== "read") {
                                    return { ...m, status: "delivered" };
                                }
                                return m;
                            });
                        });
                    }

                    setConversations(prev => {
                        return prev.map(c => {
                            if (c.id === data.conversation_id && c.last_message && c.last_message.sender_id === user.userId && c.last_message.status !== "read") {
                                return {
                                    ...c,
                                    last_message: {
                                        ...c.last_message,
                                        status: "delivered"
                                    }
                                };
                            }
                            return c;
                        });
                    });
                } else if (data.event === "read_update") {
                    if (activeConvRef.current && activeConvRef.current.id === data.conversation_id) {
                        setMessages(prev => {
                            return prev.map(m => {
                                if (m.sender_id === user.userId) {
                                    return { ...m, status: "read" };
                                }
                                return m;
                            });
                        });
                    }

                    setConversations(prev => {
                        return prev.map(c => {
                            if (c.id === data.conversation_id && c.last_message && c.last_message.sender_id === user.userId) {
                                return {
                                    ...c,
                                    last_message: {
                                        ...c.last_message,
                                        status: "read"
                                    }
                                };
                            }
                            return c;
                        });
                    });
                } else if (data.event === "user_status") {
                    setConversations(prev => {
                        return prev.map(c => {
                            if (c.other_participant && c.other_participant.user_id === data.user_id) {
                                return {
                                    ...c,
                                    other_participant: {
                                        ...c.other_participant,
                                        status: data.status,
                                        last_seen: data.last_seen
                                    }
                                };
                            }
                            return c;
                        });
                    });

                    setActiveConv(prev => {
                        if (prev && prev.other_participant && prev.other_participant.user_id === data.user_id) {
                            return {
                                ...prev,
                                other_participant: {
                                    ...prev.other_participant,
                                    status: data.status,
                                    last_seen: data.last_seen
                                }
                            };
                        }
                        return prev;
                    });
                }
            },
            // onOpen callback
            () => setWsConnected(true),
            // onClose callback
            () => setWsConnected(false),
            // onError callback
            () => setWsConnected(false)
        );

        socketRef.current = socket;

        return () => {
            socket?.close();
        };
    }, [user.token]);

    // Load messages when selecting active conversation
    const handleSelectConversation = async (conv) => {
        if (conv.id === "virtual-saved-messages") {
            try {
                const response = await conversationService.createConversation(user.userId);
                await loadConversations();

                const realSelfConv = {
                    id: response.conversation_id,
                    type: "direct",
                    display_name: "Saved Messages",
                    avatar_url: null,
                    other_participant: null
                };
                setActiveConv(realSelfConv);
                setMessages([]);

                const history = await conversationService.getMessages(response.conversation_id);
                const mapped = (history || []).map(m => ({ ...m, id: m.message_id || m.id }));
                setMessages(mapped);
            } catch (err) {
                console.error("Failed to lazy-create saved messages:", err);
            }
            return;
        }

        setActiveConv(conv);
        setMessages([]);

        // Clear unread count badge in sidebar
        setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unread_count: 0 } : c));

        try {
            const history = await conversationService.getMessages(conv.id);
            const mapped = (history || []).map(m => ({ ...m, id: m.message_id || m.id }));
            setMessages(mapped);

            // Read conversation notification
            socketRef.current?.send(JSON.stringify({
                action: "read_conversation",
                conversation_id: conv.id
            }));
        } catch (err) {
            console.error("Failed to load messages:", err);
        }
    };

    // User Search triggered reactively whenever query edits
    useEffect(() => {
        const query = searchQuery.trim();
        if (!query) {
            setSearchResults([]);
            return;
        }

        const delayDebounceFn = setTimeout(async () => {
            setIsSearching(true);
            try {
                const results = await userService.searchUsers(query);
                setSearchResults(results);
            } catch (err) {
                console.error("Search failed:", err);
            } finally {
                setIsSearching(false);
            }
        }, 300); // 300ms debounce to prevent API spam

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    const handleUpdateMyProfile = async (e) => {
        if (e) e.preventDefault();
        setIsSavingProfile(true);
        try {
            await userService.updateProfile({
                display_name: myProfile.display_name,
                bio: myProfile.bio,
                avatar_url: myProfile.avatar_url,
                status: "online",
                is_public: myProfile.is_public !== false
            });
            // Update local state and trigger sidebars if needed
            const freshProfile = await userService.getProfile();
            if (freshProfile) {
                setMyProfile(freshProfile);
            }
        } catch (err) {
            console.error("Failed to update profile:", err);
        } finally {
            setIsSavingProfile(false);
        }
    };

    // Helper to start conversation with oneself (Saved Messages)
    const handleStartSelfConversation = async () => {
        try {
            const existing = conversations.find(c => !c.other_participant);
            if (existing) {
                handleSelectConversation(existing);
                return;
            }

            const response = await conversationService.createConversation(user.userId);
            await loadConversations();

            const completeConv = {
                id: response.conversation_id,
                type: "direct",
                display_name: "Saved Messages",
                avatar_url: null,
                other_participant: null
            };
            handleSelectConversation(completeConv);
        } catch (err) {
            console.error("Failed to start self-conversation:", err);
        }
    };

    // Start direct messaging with a searched user
    const handleStartConversation = async (targetUser) => {
        const targetUserId = targetUser.user_id || targetUser.id;
        if (targetUserId === user.userId) {
            await handleStartSelfConversation();
            return;
        }
        try {
            // Check if DM exists first
            const existing = conversations.find(c =>
                c.other_participant && c.other_participant.user_id === targetUserId
            );

            if (existing) {
                handleSelectConversation(existing);
                setSearchQuery("");
                setSearchResults([]);
                return;
            }

            const response = await conversationService.createConversation(targetUserId);
            await loadConversations();

            const completeConv = {
                id: response.conversation_id,
                type: "direct",
                display_name: targetUser.display_name || targetUser.username,
                avatar_url: targetUser.avatar_url,
                other_participant: {
                    user_id: targetUserId,
                    username: targetUser.username,
                    display_name: targetUser.display_name,
                    avatar_url: targetUser.avatar_url,
                    status: targetUser.status || "offline",
                    last_seen: targetUser.last_seen || null
                }
            };
            handleSelectConversation(completeConv);
            setSearchQuery("");
            setSearchResults([]);
        } catch (err) {
            console.error("Failed to start conversation:", err);
        }
    };

    const handleFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setSelectedFile(file);
        if (file.type.startsWith("image/")) {
            const previewUrl = URL.createObjectURL(file);
            setFilePreview(previewUrl);
        } else {
            setFilePreview(null);
        }
    };

    const cancelAttachment = () => {
        if (filePreview) {
            URL.revokeObjectURL(filePreview);
        }
        setSelectedFile(null);
        setFilePreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    // Send Message Workflow
    const handleSendMessage = async (e) => {
        e.preventDefault();

        const hasText = messageText.trim().length > 0;
        if (!selectedFile && !hasText) return;
        if (!activeConv || !socketRef.current) return;

        let mType = "text";
        let mediaUrl = null;
        let finalContent = messageText;

        setIsUploading(true);
        try {
            if (selectedFile) {
                const uploadRes = await conversationService.uploadFile(selectedFile);
                mediaUrl = uploadRes.url;
                mType = selectedFile.type.startsWith("image/") ? "image" : "file";
                if (!finalContent) {
                    finalContent = selectedFile.name; // Use filename as fallback text
                }
            }

            // Broadcast to WebSocket Node
            socketRef.current.send(JSON.stringify({
                action: "send_message",
                conversation_id: activeConv.id,
                content: finalContent,
                message_type: mType,
                media_url: mediaUrl
            }));

            // Send local optimistic write immediately to avoid wait loop
            const localMsg = {
                id: `temp-${Date.now()}`,
                sender_id: user.userId,
                content: finalContent,
                message_type: mType,
                media_url: mediaUrl,
                created_at: new Date().toISOString(),
                status: null
            };
            setMessages(prev => [...prev, localMsg]);

            // Optimistically update conversation list for sender!
            setConversations(prev => {
                const updated = prev.map(c => {
                    if (c.id === activeConv.id) {
                        return {
                            ...c,
                            last_message_content: mType === "image" ? "📷 Image" : (mType === "file" ? "📁 File" : finalContent),
                            last_message_time: localMsg.created_at,
                            last_message: {
                                message_id: localMsg.id,
                                sender_id: user.userId,
                                content: finalContent,
                                message_type: mType,
                                media_url: mediaUrl,
                                created_at: localMsg.created_at,
                                status: null
                            }
                        };
                    }
                    return c;
                });
                // Re-sort conversation list so it keeps the pinned Saved Messages on top and others sorted
                const selfConv = updated.find(c => !c.other_participant);
                const others = updated.filter(c => c.other_participant);
                const sortedOthers = others.sort((a, b) => {
                    const aTime = a.last_message_time ? new Date(a.last_message_time).getTime() : 0;
                    const bTime = b.last_message_time ? new Date(b.last_message_time).getTime() : 0;
                    return bTime - aTime;
                });
                return [selfConv, ...sortedOthers].filter(Boolean);
            });

            // Clear selected file & input
            cancelAttachment();
            setMessageText("");
            handleStopTypingNotification();
        } catch (err) {
            console.error("Failed to send message / upload file:", err);
            alert("Error sending attachment: " + err.message);
        } finally {
            setIsUploading(false);
        }

        // Clear input text & clear active typing statuses
        setMessageText("");
        handleStopTypingNotification();
    };

    // Send typing status to WebSocket Node
    const handleKeyPress = () => {
        if (!activeConv || !socketRef.current) return;

        // Broadcast active typing status
        socketRef.current.send(JSON.stringify({
            action: "typing",
            conversation_id: activeConv.id,
            is_typing: true
        }));

        // Reset timer to clear typing state after inactivity
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(handleStopTypingNotification, 3000);
    };

    const handleStopTypingNotification = () => {
        if (!activeConv || !socketRef.current) return;
        socketRef.current.send(JSON.stringify({
            action: "typing",
            conversation_id: activeConv.id,
            is_typing: false
        }));
    };

    // Helper: format connection status label
    const formatTime = (timeStr) => {
        if (!timeStr) return "";
        try {
            const date = new Date(timeStr);
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch {
            return "";
        }
    };

    // Render active other participant typing status
    const getActiveTypingLabel = () => {
        if (!activeConv) return null;
        const convTypists = typingUsers[activeConv.id];
        if (!convTypists) return null;

        const typingArr = Object.entries(convTypists)
            .filter(([uid, typing]) => uid !== user.userId && typing);

        if (typingArr.length > 0) {
            return "typing...";
        }
        return null;
    };

    const sharedImages = messages.filter(m => m.media_url && (m.message_type === "image" || m.media_url.match(/\.(jpeg|jpg|gif|png|webp|svg)/i)));
    const sharedFiles = messages.filter(m => m.media_url && !sharedImages.includes(m));

    return (
        <div className="ht-app-container" style={{ background: t.chatBg, color: t.text }}>
            {/* 1. Far Left Rail Navigation */}
            <div className="ht-rail">
                <div className="ht-rail-top">
                    <div className="ht-rail-avatar" onClick={() => setActiveRailTab("profile")} title="My Profile">
                        {myProfile?.avatar_url ? (
                            <img src={myProfile.avatar_url} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                            user?.username?.[0]?.toUpperCase() || "U"
                        )}
                    </div>

                    <div className="ht-rail-menu">
                        <button className={`ht-rail-btn ${activeRailTab === "chats" ? "active" : ""}`} onClick={() => setActiveRailTab("chats")} title="Messages">
                            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                        </button>

                        <button className={`ht-rail-btn ${activeRailTab === "profile" ? "active" : ""}`} onClick={() => setActiveRailTab("profile")} title="Profile Details">
                            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        </button>

                        <button className={`ht-rail-btn ${activeRailTab === "settings" ? "active" : ""}`} onClick={() => setActiveRailTab("settings")} title="Preferences">
                            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="ht-rail-bottom">
                    <button className="ht-rail-btn" onClick={onLogout} title="Log Out" style={{ color: "#EA4335" }}>
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* 2. Conversations / Settings / Profile Sidebar */}
            <div className="ht-sidebar" style={{ background: t.sidebarBg, borderRight: t.border }}>
                {activeRailTab === "chats" && (
                    <>
                        <div className="ht-sidebar-header">
                            <div className="ht-sidebar-title-row">
                                <h2 style={{ margin: 0, fontSize: 20, fontweight: "800", color: t.text }}>Messages</h2>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: wsConnected ? "#34A853" : "#EA4335" }} />
                                    <span style={{ fontSize: 11, opacity: 0.6 }}>{wsConnected ? "Online" : "Offline"}</span>
                                </div>
                            </div>
                            <div className="ht-sidebar-search-row">
                                <div className="ht-search-container">
                                    <svg className="ht-search-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                    <input
                                        type="text"
                                        placeholder="Search user profile nodes..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="ht-search-pill"
                                        style={{ background: t.inputBg, border: t.inputBorder, color: t.text }}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="ht-convo-list">
                            {isSearching ? (
                                <div style={{ textAlign: "center", padding: "20px 0", fontSize: 13, color: t.textMuted }}>Scanning database profiles...</div>
                            ) : searchQuery.trim() ? (
                                <>
                                    <div className="ht-section-label" style={{ color: t.textMuted }}>Directory matches</div>
                                    {searchResults.map(userItem => (
                                        <div
                                            key={userItem.user_id || userItem.id}
                                            onClick={() => handleStartConversation(userItem)}
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 12,
                                                padding: "10px 12px",
                                                borderRadius: 12,
                                                cursor: "pointer",
                                                background: "rgba(120, 120, 120, 0.05)",
                                                margin: "0 4px 6px"
                                            }}
                                        >
                                            <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#de4977", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "700" }}>
                                                {(userItem.display_name || userItem.username)[0].toUpperCase()}
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 13, fontWeight: "700", color: t.text }}>{userItem.display_name || userItem.username}</div>
                                                <div style={{ fontSize: 11, color: t.textMuted }}>@{userItem.username}</div>
                                            </div>
                                        </div>
                                    ))}
                                    {searchResults.length === 0 && (
                                        <div style={{ textAlign: "center", padding: 20, color: t.textMuted, fontSize: 12 }}>No matching nodes.</div>
                                    )}
                                </>
                            ) : (
                                <>
                                    {/* Saved cloud message row at top */}
                                    <div className="ht-section-label" style={{ color: t.accent }}>Pinned Message</div>
                                    {conversations.filter(c => !c.other_participant).map(c => {
                                        const isActive = activeConv && activeConv.id === c.id;
                                        return (
                                            <div
                                                key={c.id}
                                                onClick={() => handleSelectConversation(c)}
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 12,
                                                    padding: "12px 14px",
                                                    borderRadius: 14,
                                                    cursor: "pointer",
                                                    background: isActive ? "rgba(120, 120, 120, 0.09)" : "transparent",
                                                    marginBottom: 4,
                                                    border: isActive ? `1px solid ${t.accent}` : "1px solid transparent"
                                                }}
                                            >
                                                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg, #de4977, #c93b66)", display: "flex", alignItems: "center", justifycontent: "center", color: "white", flexShrink: 0, position: "relative" }}>
                                                    <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24" style={{ margin: "auto" }}>
                                                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                                                    </svg>
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                        <span style={{ fontSize: 13, fontWeight: "755", color: t.text }}>Saved Messages</span>
                                                    </div>
                                                    <p style={{ margin: 0, fontSize: 11.5, color: t.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                        Personal notes cloud inbox
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* All remaining active Direct Messages */}
                                    <div className="ht-section-label" style={{ color: t.textMuted }}>All Message</div>
                                    {conversations.filter(c => c.other_participant).map(c => {
                                        const isActive = activeConv && activeConv.id === c.id;
                                        const isOnline = c.other_participant?.status === "online";
                                        return (
                                            <div
                                                key={c.id}
                                                onClick={() => handleSelectConversation(c)}
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 12,
                                                    padding: "12px 14px",
                                                    borderRadius: 14,
                                                    cursor: "pointer",
                                                    background: isActive ? "rgba(120, 120, 120, 0.09)" : "transparent",
                                                    marginBottom: 4,
                                                    border: isActive ? `1px solid rgba(120, 120, 120, 0.15)` : "1px solid transparent"
                                                }}
                                            >
                                                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "800", flexShrink: 0, position: "relative" }}>
                                                    {c.avatar_url ? (
                                                        <img src={c.avatar_url} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                                                    ) : (
                                                        c.display_name?.[0]?.toUpperCase() || "@"
                                                    )}
                                                    {isOnline && (
                                                        <div style={{ position: "absolute", bottom: 0, right: 0, width: 10, height: 10, borderRadius: "50%", background: "#34A853", border: `2px solid ${t.sidebarBg}` }} />
                                                    )}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                        <span style={{ fontSize: 13, fontWeight: "755", color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.display_name}</span>
                                                        <span style={{ fontSize: 9.5, color: c.unread_count > 0 ? t.accent : t.textMuted, fontWeight: c.unread_count > 0 ? "700" : "normal" }}>{formatTime(c.last_message_time)}</span>
                                                    </div>
                                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
                                                        <p style={{ margin: 0, fontSize: 11.5, color: c.unread_count > 0 ? t.text : t.textMuted, fontWeight: c.unread_count > 0 ? "600" : "normal", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: 4, flex: 1 }}>
                                                            {c.last_message && c.last_message.sender_id === user.userId && renderMessageStatus(c.last_message.status, true)}
                                                            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                                                                {c.last_message_content || "No messages yet"}
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
                                    })}
                                    {conversations.filter(c => c.other_participant).length === 0 && (
                                        <div style={{ textAlign: "center", padding: "30px 10px", color: t.textMuted, fontSize: 11 }}>No message nodes in current cluster.</div>
                                    )}
                                </>
                            )}
                        </div>
                    </>
                )}

                {activeRailTab === "profile" && (
                    <div style={{ padding: 20, display: "flex", flexDirection: "column", height: "100%", overflowY: "auto" }}>
                        <h2 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: "800", color: t.text }}>My Profile</h2>
                        <form onSubmit={handleUpdateMyProfile}>
                            <div className="ht-form-group">
                                <label className="ht-form-label" style={{ color: t.textMuted }}>Display Name</label>
                                <input
                                    type="text"
                                    value={myProfile.display_name || ""}
                                    onChange={(e) => setMyProfile(prev => ({ ...prev, display_name: e.target.value }))}
                                    className="ht-form-input"
                                    style={{ background: t.inputBg, border: t.inputBorder, color: t.text }}
                                    placeholder="Enter display name"
                                    required
                                />
                            </div>
                            <div className="ht-form-group">
                                <label className="ht-form-label" style={{ color: t.textMuted }}>Avatar URL</label>
                                <input
                                    type="text"
                                    value={myProfile.avatar_url || ""}
                                    onChange={(e) => setMyProfile(prev => ({ ...prev, avatar_url: e.target.value }))}
                                    className="ht-form-input"
                                    style={{ background: t.inputBg, border: t.inputBorder, color: t.text }}
                                    placeholder="https://example.com/avatar.png"
                                />
                            </div>
                            <div className="ht-form-group">
                                <label className="ht-form-label" style={{ color: t.textMuted }}>Bio</label>
                                <textarea
                                    value={myProfile.bio || ""}
                                    onChange={(e) => setMyProfile(prev => ({ ...prev, bio: e.target.value }))}
                                    className="ht-form-textarea"
                                    style={{ background: t.inputBg, border: t.inputBorder, color: t.text }}
                                    placeholder="Explain your node telemetry configuration..."
                                />
                            </div>
                            <div className="ht-form-group" style={{ marginBottom: 20 }}>
                                <label className="ht-form-label" style={{ color: t.textMuted }}>Profile Visibility</label>
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
                                        marginTop: 4,
                                        userSelect: "none"
                                    }}
                                >
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: "700", color: t.text }}>Public Search Visibility</div>
                                        <div style={{ fontSize: 10.5, color: t.textMuted, marginTop: 2 }}>Allow others to discover your profile node</div>
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
                                    marginTop: 10,
                                    opacity: isSavingProfile ? 0.7 : 1
                                }}
                            >
                                {isSavingProfile ? "Saving Parameters..." : "Save Profile"}
                            </button>
                        </form>
                    </div>
                )}

                {activeRailTab === "settings" && (
                    <div style={{ padding: 20, display: "flex", flexDirection: "column", height: "100%", overflowY: "auto" }}>
                        <h2 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: "800", color: t.text }}>Settings</h2>
                        <div style={{ marginBottom: 24 }}>
                            <div className="ht-section-label" style={{ color: t.textMuted, paddingLeft: 0 }}>Theme Preferences</div>

                            <div
                                className="ht-theme-card"
                                onClick={() => { setTheme("light"); localStorage.setItem("theme_preference", "light"); }}
                                style={{ background: theme === "light" ? "rgba(222, 73, 119, 0.08)" : "rgba(120, 120, 120, 0.05)", border: theme === "light" ? `1.5px solid ${t.accent}` : "1.5px solid transparent" }}
                            >
                                <span style={{ fontSize: 13, fontWeight: "700" }}>Light Scheme</span>
                                <div style={{ width: 10, height: 10, borderRadius: "50%", background: theme === "light" ? t.accent : "transparent" }} />
                            </div>

                            <div
                                className="ht-theme-card"
                                onClick={() => { setTheme("dark"); localStorage.setItem("theme_preference", "dark"); }}
                                style={{ background: theme === "dark" ? "rgba(222, 73, 119, 0.08)" : "rgba(120, 120, 120, 0.05)", border: theme === "dark" ? `1.5px solid ${t.accent}` : "1.5px solid transparent" }}
                            >
                                <span style={{ fontSize: 13, fontWeight: "700" }}>Dark Charcoal</span>
                                <div style={{ width: 10, height: 10, borderRadius: "50%", background: theme === "dark" ? t.accent : "transparent" }} />
                            </div>
                        </div>

                        <div style={{ marginTop: "auto", borderTop: t.border, paddingTop: 16, fontSize: 11, color: t.textMuted }}>
                            Halftone Chat Sandbox v2.4.9<br />
                            Designed strictly to telemetry specifications.
                        </div>
                    </div>
                )}
            </div>

            {/* 3. Center Messaging Pane */}
            <div className="ht-chat-pane">
                {activeConv ? (
                    <>
                        {/* Floating Header Card */}
                        <div className="ht-chat-header" style={{ background: t.cardBg, border: t.border }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: 16, color: t.text, fontWeight: 800 }}>
                                    {activeConv.display_name}
                                </h3>
                                <span style={{
                                    fontSize: 11,
                                    color: getActiveTypingLabel() ? t.accent : (activeConv.other_participant?.status === "online" ? "#34A853" : t.textMuted),
                                    height: 14,
                                    display: "block"
                                }}>
                                    {getActiveTypingLabel() ||
                                        (!activeConv.other_participant
                                            ? "personal cloud storage"
                                            : (activeConv.other_participant.status === "online"
                                                ? "online"
                                                : formatLastSeen(activeConv.other_participant.last_seen)))}
                                </span>
                            </div>

                            <div className="ht-header-actions">
                                {/* 
                                    TODO: Voice & Video Calls — coming soon (requires WebRTC + TURN server)
                                    <button className="ht-action-circle-btn" title="Voice Call"><svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg></button>
                                    <button className="ht-action-circle-btn" title="Video Call"><svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg></button>
                                */}
                                <button
                                    className="ht-action-circle-btn"
                                    style={{ color: showInspector ? t.accent : t.text }}
                                    onClick={() => setShowInspector(prev => !prev)}
                                    title="Toggle Conversation Inspector"
                                >
                                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Interactive Scroll Pane */}
                        <div className="ht-message-stream" ref={chatContainerRef} onScroll={handleChatScroll} style={{ position: "relative" }}>
                            {messages.map(m => {
                                const isSelf = m.sender_id === user.userId;
                                return (
                                    <div key={m.id} className={`ht-msg-row ${isSelf ? "self" : "recv"}`}>
                                        <div className="ht-msg-avatar">
                                            {isSelf ? (
                                                myProfile.avatar_url ? (
                                                    <img src={myProfile.avatar_url} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                                                ) : (
                                                    user?.username?.[0]?.toUpperCase() || "U"
                                                )
                                            ) : (
                                                activeConv.avatar_url ? (
                                                    <img src={activeConv.avatar_url} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                                                ) : (
                                                    activeConv.display_name?.[0]?.toUpperCase() || "@"
                                                )
                                            )}
                                        </div>
                                        <div className="ht-msg-bubble-box">
                                            <div className="ht-msg-bubble" style={{ background: isSelf ? t.bubbleSent : t.bubbleRecv, color: isSelf ? t.bubbleSentText : t.bubbleRecvText, padding: m.message_type === "image" ? "6px" : "12px 16px" }}>
                                                {m.message_type === "image" ? (
                                                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                                        <img
                                                            src={getAssetUrl(m.media_url)}
                                                            alt="Attachment"
                                                            style={{ maxWidth: "260px", maxHeight: "260px", borderRadius: 10, objectFit: "cover", cursor: "pointer" }}
                                                            onClick={() => window.open(getAssetUrl(m.media_url), "_blank")}
                                                        />
                                                        {m.content && m.content !== m.media_url?.split("/").pop() && (
                                                            <div style={{ padding: "4px 8px 2px", fontSize: 13, color: isSelf ? t.bubbleSentText : t.bubbleRecvText }}>{m.content}</div>
                                                        )}
                                                    </div>
                                                ) : m.message_type === "audio" ? (
                                                    <VoicePlayer
                                                        src={getAssetUrl(m.media_url)}
                                                        isSelf={isSelf}
                                                        themeColors={t}
                                                    />
                                                ) : m.message_type === "file" ? (
                                                    <a
                                                        href={getAssetUrl(m.media_url)}
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
                                                    m.content
                                                )}
                                            </div>
                                            <span style={{ fontSize: 9.5, color: t.textMuted, marginTop: 4, display: "flex", alignItems: "center", gap: 3 }}>
                                                {formatTime(m.created_at)}
                                                {isSelf && renderMessageStatus(m.status, false)}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
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

                        {/* Floating Rounded Input Card */}
                        <form className="ht-chat-input-form" onSubmit={handleSendMessage}>
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
                                <div style={{ fontSize: 11, color: t.accent, padding: "4px 8px 8px" }}>
                                    Uploading attachment to database storage...
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
                                    style={{ cursor: "pointer", opacity: 0.65 }}
                                    title="Attach File"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 11-2.828-2.828l6.414-6.414a4 4 0 015.656 5.656l-6.415 6.415a6 6 0 11-8.486-8.486L10.5 5" />
                                </svg>

                                <input
                                    type="text"
                                    placeholder={selectedFile ? "Add a caption..." : "Type a message..."}
                                    value={messageText}
                                    onChange={(e) => {
                                        setMessageText(e.target.value);
                                        handleKeyPress();
                                    }}
                                    className="ht-chat-input-field"
                                    style={{ color: t.text }}
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
                                                // Override emoji picker CSS vars to exactly match our theme colors
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

                                    {/* Voice message mic button — click to start / click to send */}
                                    {!messageText.trim() && !selectedFile && (
                                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                            {isRecording && (
                                                <button
                                                    type="button"
                                                    title="Cancel recording"
                                                    onClick={() => {
                                                        if (mediaRecorderRef.current?.state === "recording") {
                                                            mediaRecorderRef.current.onstop = null; // don't send on cancel
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
                                                        // Stop and send
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
                                                            if (blob.size < 1000) return; // ignore super short clicks

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
                                                                    const tempId = `temp_${Date.now()}`;
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

                                    {/* Send button — shows when there's text or a file attached */}
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
                    </>
                ) : (
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: t.textMuted, padding: 40, textAlign: "center" }}>
                        <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" style={{ marginBottom: 16, opacity: 0.5 }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <h4 style={{ margin: "0 0 8px", fontSize: 16, color: t.text, fontWeight: 750 }}>No Conversation Selected</h4>
                        <p style={{ margin: 0, fontSize: 13, maxWidth: 280, lineHeight: 1.45 }}>Choose a message thread from the inbox sidebar, or scan profile nodes in the system directory.</p>
                    </div>
                )}
            </div>

            {/* 4. Far Right Context Inspector */}
            <div
                className="ht-inspector"
                style={{
                    width: (showInspector && activeConv) ? "300px" : "0px",
                    background: t.inspectorBg,
                    borderLeft: (showInspector && activeConv) ? t.border : "none"
                }}
            >
                {activeConv && (
                    <div className="ht-inspector-inner">
                        <div className="ht-inspector-avatar-box">
                            <button className="ht-inspector-close-btn" onClick={() => setShowInspector(false)} title="Close Inspector">
                                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>

                            <div style={{ width: 84, height: 84, borderRadius: "50%", background: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "28px", fontWeight: "800", position: "relative", marginBottom: 12 }}>
                                {activeConv.avatar_url ? (
                                    <img src={activeConv.avatar_url} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                                ) : (
                                    activeConv.display_name?.[0]?.toUpperCase() || "@"
                                )}
                            </div>

                            <div style={{ fontSize: 16, fontWeight: "800", color: t.text }}>{activeConv.display_name}</div>
                            <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>
                                {activeConv.other_participant ? `@${activeConv.other_participant.username}` : "Personal Cloud"}
                            </div>
                        </div>

                        <div className="ht-inspector-actions" style={{ borderBottom: t.border, paddingBottom: 20 }}>
                            <button className="ht-inspector-action-btn" style={{ color: t.text }}>
                                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                <span>Profile</span>
                            </button>
                            <button className="ht-inspector-action-btn" style={{ color: t.text }}>
                                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                                <span>Mute</span>
                            </button>
                            <button className="ht-inspector-action-btn" style={{ color: t.text }}>
                                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                <span>Search</span>
                            </button>
                        </div>

                        {/* Expandable Image Gallery segment */}
                        <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, fontWeight: "755", marginBottom: 8 }}>
                                <span>Images <span style={{ opacity: 0.5, fontWeight: "500" }}>({sharedImages.length} files)</span></span>
                                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" style={{ cursor: "pointer", opacity: 0.6 }}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                            </div>
                            {sharedImages.length > 0 ? (
                                <div className="ht-media-grid">
                                    {sharedImages.map(imgMsg => (
                                        <div className="ht-media-tile" key={imgMsg.message_id || imgMsg.id}>
                                            <img
                                                src={getAssetUrl(imgMsg.media_url)}
                                                alt=""
                                                style={{ cursor: "pointer" }}
                                                onClick={() => window.open(getAssetUrl(imgMsg.media_url), "_blank")}
                                            />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ padding: "16px 12px", borderRadius: 10, background: "rgba(120, 120, 120, 0.04)", border: t.border, fontSize: 11, color: t.textMuted, textAlign: "center" }}>
                                    No shared images.
                                </div>
                            )}
                        </div>

                        {/* Shared File list segment */}
                        <div style={{ marginTop: 20 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, fontWeight: "755", marginBottom: 8 }}>
                                <span>Recent Files <span style={{ opacity: 0.5, fontWeight: "500" }}>({sharedFiles.length} files)</span></span>
                                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" style={{ cursor: "pointer", opacity: 0.6 }}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                            </div>
                            {sharedFiles.length > 0 ? (
                                <div className="ht-file-list">
                                    {sharedFiles.map(fileMsg => {
                                        const filename = fileMsg.content || fileMsg.media_url?.split("/").pop() || "Attachment";
                                        return (
                                            <div
                                                className="ht-file-item"
                                                key={fileMsg.message_id || fileMsg.id}
                                                style={{ cursor: "pointer" }}
                                                onClick={() => window.open(getAssetUrl(fileMsg.media_url), "_blank")}
                                            >
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EA4335" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: 12, fontWeight: "700", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: t.text }}>{filename}</div>
                                                    <div style={{ fontSize: 9.5, color: t.textMuted }}>Shared File</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div style={{ padding: "16px 12px", borderRadius: 10, background: "rgba(120, 120, 120, 0.04)", border: t.border, fontSize: 11, color: t.textMuted, textAlign: "center" }}>
                                    No shared documents.
                                </div>
                            )}
                        </div>

                    </div>
                )}
            </div>
        </div>
    );
};
