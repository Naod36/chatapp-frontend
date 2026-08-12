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
    const [syncState, setSyncState] = useState("connecting"); // "connecting" | "updating" | "ready"

    useEffect(() => {
        if (!wsConnected) {
            setSyncState("connecting");
        } else {
            setSyncState("updating");
            const timer = setTimeout(() => {
                setSyncState("ready");
            }, 1200);
            return () => clearTimeout(timer);
        }
    }, [wsConnected]);
    const [typingUsers, setTypingUsers] = useState({}); // { [convId]: { [userId]: boolean } }
    const [errorToast, setErrorToast] = useState(null);

    const showError = (msg) => {
        setErrorToast(msg);
        setTimeout(() => {
            setErrorToast(null);
        }, 5000);
    };

    // UI redesign states
    const [activeRailTab, setActiveRailTab] = useState("chats"); // "chats" | "profile" | "settings"
    const [showInspector, setShowInspector] = useState(true);
    const [myProfile, setMyProfile] = useState({ display_name: user?.username || "", bio: "", avatar_url: "" });
    const [selectedFile, setSelectedFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState({ percentage: 0, loadedFormatted: "0 MB", totalFormatted: "0 MB" });
    const [replyingTo, setReplyingTo] = useState(null);
    const [editingMessage, setEditingMessage] = useState(null);
    const [contextMenu, setContextMenu] = useState(null);
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const [profileSavedToast, setProfileSavedToast] = useState(false);
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
    const avatarInputRef = useRef(null);
    const emojiPickerRef = useRef(null);

    // Advanced chat feature states: Sound, Pin, Search, Reactions
    const [soundEnabled, setSoundEnabled] = useState(() => {
        const saved = localStorage.getItem("chat_sound_enabled");
        return saved !== null ? saved === "true" : true;
    });
    const [pinnedMessageIdMap, setPinnedMessageIdMap] = useState({});
    const [isInChatSearchOpen, setIsInChatSearchOpen] = useState(false);
    const [inChatSearchQuery, setInChatSearchQuery] = useState("");
    const [inChatSearchMatchIndex, setInChatSearchMatchIndex] = useState(0);
    const [hoveredMsgId, setHoveredMsgId] = useState(null);
    const [mutedConvIds, setMutedConvIds] = useState(() => {
        try {
            const saved = localStorage.getItem("muted_conversations");
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            return {};
        }
    });
    const [viewingParticipantProfile, setViewingParticipantProfile] = useState(null);

    // Group Creation Modal states
    const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
    const [groupTitle, setGroupTitle] = useState("");
    const [groupSearchQuery, setGroupSearchQuery] = useState("");
    const [groupSearchResults, setGroupSearchResults] = useState([]);
    const [selectedGroupMembers, setSelectedGroupMembers] = useState([]);
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);

    const getSenderNameColor = (senderId) => {
        const colors = ["#38bdf8", "#818cf8", "#f43f5e", "#fbbf24", "#34d399", "#a78bfa", "#f472b6"];
        if (!senderId) return colors[0];
        let hash = 0;
        for (let i = 0; i < senderId.length; i++) {
            hash = senderId.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    };

    // User search effect for group members
    useEffect(() => {
        if (!groupSearchQuery.trim()) {
            setGroupSearchResults([]);
            return;
        }
        const timer = setTimeout(async () => {
            try {
                const res = await userService.searchUsers(groupSearchQuery);
                const filtered = res.filter(u => u.id !== user.userId && !selectedGroupMembers.some(sm => sm.id === u.id));
                setGroupSearchResults(filtered);
            } catch (err) {
                console.error("Failed to search users for group:", err);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [groupSearchQuery, selectedGroupMembers, user.userId]);

    const handleSelectGroupMember = (u) => {
        setSelectedGroupMembers(prev => [...prev, u]);
        setGroupSearchQuery("");
        setGroupSearchResults([]);
    };

    const handleRemoveGroupMember = (userId) => {
        setSelectedGroupMembers(prev => prev.filter(u => u.id !== userId));
    };

    const handleCreateGroupSubmit = async (e) => {
        e.preventDefault();
        if (!groupTitle.trim()) {
            showError("Please enter a group title");
            return;
        }
        if (selectedGroupMembers.length === 0) {
            showError("Please select at least 1 other participant");
            return;
        }
        try {
            setIsCreatingGroup(true);
            const participantIds = selectedGroupMembers.map(u => u.id);
            const res = await conversationService.createGroup(groupTitle.trim(), participantIds);
            setIsCreateGroupOpen(false);
            setGroupTitle("");
            setSelectedGroupMembers([]);
            await loadConversations();
            if (res.conversation_id) {
                const newGroupConv = {
                    id: res.conversation_id,
                    type: "group",
                    title: groupTitle.trim(),
                    display_name: groupTitle.trim(),
                    participants: selectedGroupMembers,
                    avatar_url: null,
                    last_message_content: "Group created",
                    last_message_time: new Date().toISOString()
                };
                setActiveConv(newGroupConv);
            }
        } catch (err) {
            showError(err.message || "Failed to create group");
        } finally {
            setIsCreatingGroup(false);
        }
    };

    const toggleMuteConversation = (convId) => {
        if (!convId) return;
        setMutedConvIds(prev => {
            const next = { ...prev, [convId]: !prev[convId] };
            localStorage.setItem("muted_conversations", JSON.stringify(next));
            return next;
        });
    };

    const safeSendWs = (payload) => {
        try {
            if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
                socketRef.current.send(JSON.stringify(payload));
                return true;
            }
        } catch (e) {
            console.warn("WebSocket send error:", e);
        }
        return false;
    };

    const playNotificationSound = (targetConvId) => {
        if (!soundEnabled) return;
        if (targetConvId && mutedConvIds[targetConvId]) return;
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gain = ctx.createGain();

            osc1.type = "sine";
            osc2.type = "sine";
            osc1.frequency.setValueAtTime(587.33, ctx.currentTime);
            osc2.frequency.setValueAtTime(880.00, ctx.currentTime + 0.08);

            gain.gain.setValueAtTime(0.12, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(ctx.destination);

            osc1.start(ctx.currentTime);
            osc1.stop(ctx.currentTime + 0.1);
            osc2.start(ctx.currentTime + 0.08);
            osc2.stop(ctx.currentTime + 0.3);

            // Auto-close AudioContext to prevent Firefox Web Audio pool exhaustion
            setTimeout(() => {
                ctx.close().catch(() => {});
            }, 350);
        } catch (e) {}
    };

    const toggleSoundEnabled = () => {
        setSoundEnabled(prev => {
            const next = !prev;
            localStorage.setItem("chat_sound_enabled", String(next));
            return next;
        });
    };

    // Scroll-to-bottom and unread pill state
    const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
    const [newMessagesBelowCount, setNewMessagesBelowCount] = useState(0);
    const chatContainerRef = useRef(null);

    const socketRef = useRef(null);
    const messageEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const activeConvRef = useRef(activeConv);
    const inputTextareaRef = useRef(null);

    useEffect(() => {
        activeConvRef.current = activeConv;
    }, [activeConv]);

    // Auto-expand input textarea height based on message line count
    useEffect(() => {
        if (inputTextareaRef.current) {
            inputTextareaRef.current.style.height = "auto";
            const newHeight = Math.min(inputTextareaRef.current.scrollHeight, 180);
            inputTextareaRef.current.style.height = `${newHeight}px`;
        }
    }, [messageText]);

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
                const isGroup = c.type === "group";
                const other = c.other_participant;
                return {
                    id: c.conversation_id,
                    type: c.type,
                    title: c.title,
                    creator_id: c.creator_id,
                    participants: c.participants || [],
                    display_name: isGroup ? (c.title || "Group Chat") : (other ? (other.display_name || other.username) : "Saved Messages"),
                    avatar_url: isGroup ? c.avatar_url : (other ? other.avatar_url : null),
                    last_message_content: c.last_message?.content || "",
                    last_message_time: c.last_message?.created_at || null,
                    other_participant: other,
                    last_message: c.last_message,
                    unread_count: c.unread_count || 0
                };
            });

            let selfConv = normalized.find(c => c.type === "direct" && !c.other_participant);
            const others = normalized.filter(c => c.type === "group" || c.other_participant);

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

            const map = {};
            rawList.forEach(c => {
                if (c.pinned_message_id) {
                    map[c.conversation_id] = c.pinned_message_id;
                }
            });
            setPinnedMessageIdMap(map);

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

                    if (data.sender_id !== user.userId && soundEnabled) {
                        playNotificationSound();
                    }

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
                } else if (data.event === "message_edited") {
                    setMessages(prev => prev.map(m => m.id === data.message_id ? { ...m, content: data.content, is_edited: true } : m));
                } else if (data.event === "message_deleted") {
                    setMessages(prev => prev.filter(m => m.id !== data.message_id));
                } else if (data.event === "message_reacted") {
                    setMessages(prev => prev.map(m => {
                        const mId = m.id || m.message_id;
                        if (mId === data.message_id) {
                            const existingReactions = { ...(m.reactions || {}) };
                            const userList = existingReactions[data.emoji] ? [...existingReactions[data.emoji]] : [];
                            const userIndex = userList.indexOf(data.user_id);
                            if (userIndex > -1) {
                                userList.splice(userIndex, 1);
                            } else {
                                userList.push(data.user_id);
                            }
                            if (userList.length === 0) {
                                delete existingReactions[data.emoji];
                            } else {
                                existingReactions[data.emoji] = userList;
                            }
                            return { ...m, reactions: existingReactions };
                        }
                        return m;
                    }));
                } else if (data.event === "message_pinned") {
                    setPinnedMessageIdMap(prev => ({
                        ...prev,
                        [data.conversation_id]: data.message_id
                    }));
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
        const currentUserId = user?.userId || user?.user_id;
        if (conv.id === "virtual-saved-messages") {
            try {
                const response = await conversationService.createConversation(currentUserId);
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

    const handleAvatarFileSelect = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploadingAvatar(true);
        try {
            const uploadRes = await conversationService.uploadFile(file);
            setMyProfile(prev => ({ ...prev, avatar_url: uploadRes.url }));
        } catch (err) {
            console.error("Avatar upload failed:", err);
        } finally {
            setIsUploadingAvatar(false);
        }
    };

    const handleUpdateMyProfile = async (e) => {
        if (e) e.preventDefault();
        setIsSavingProfile(true);
        setProfileSavedToast(false);
        try {
            await userService.updateProfile({
                username: myProfile.username,
                display_name: myProfile.display_name,
                bio: myProfile.bio,
                avatar_url: myProfile.avatar_url,
                status: "online",
                is_public: myProfile.is_public !== false
            });
            const freshProfile = await userService.getProfile();
            if (freshProfile) {
                setMyProfile(freshProfile);
            }
            setProfileSavedToast(true);
            setTimeout(() => setProfileSavedToast(false), 3000);
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

            const currentUserId = user?.userId || user?.user_id;
            const response = await conversationService.createConversation(currentUserId);
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
        if (e) e.preventDefault();

        const hasText = messageText.trim().length > 0;
        if (!selectedFile && !hasText) return;
        if (!activeConv || !socketRef.current) return;

        // If editing an existing message
        if (editingMessage) {
            socketRef.current.send(JSON.stringify({
                action: "edit_message",
                message_id: editingMessage.id,
                content: messageText.trim()
            }));
            setMessages(prev => prev.map(m => m.id === editingMessage.id ? { ...m, content: messageText.trim(), is_edited: true } : m));
            setEditingMessage(null);
            setMessageText("");
            handleStopTypingNotification();
            return;
        }

        let mType = "text";
        let mediaUrl = null;
        let finalContent = messageText;

        setIsUploading(true);
        setUploadProgress({ percentage: 0, loadedFormatted: "0.0 MB", totalFormatted: selectedFile ? `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB` : "0.0 MB" });

        try {
            if (selectedFile) {
                const uploadRes = await conversationService.uploadFile(selectedFile, (progressInfo) => {
                    setUploadProgress(progressInfo);
                });
                mediaUrl = uploadRes.url;
                mType = selectedFile.type.startsWith("image/") ? "image" : "file";
                if (!finalContent) {
                    finalContent = selectedFile.name; // Use filename as fallback text
                }
            }

            const currentReplyToId = replyingTo?.id || null;

            // Broadcast to WebSocket Node
            socketRef.current.send(JSON.stringify({
                action: "send_message",
                conversation_id: activeConv.id,
                content: finalContent,
                message_type: mType,
                media_url: mediaUrl,
                reply_to_id: currentReplyToId
            }));

            // Send local optimistic write immediately to avoid wait loop
            const localMsg = {
                id: `temp-${Date.now()}`,
                sender_id: user.userId,
                content: finalContent,
                message_type: mType,
                media_url: mediaUrl,
                reply_to_id: currentReplyToId,
                created_at: new Date().toISOString(),
                status: null
            };
            setMessages(prev => [...prev, localMsg]);
            setReplyingTo(null);

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
            showError(err.message || "Failed to send attachment. Please try again.");
        } finally {
            setIsUploading(false);
        }

        // Clear input text & clear active typing statuses
        setMessageText("");
        handleStopTypingNotification();
    };

    // Context Menu & Message Action Handlers
    const handleContextMenu = (e, msg) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            message: msg
        });
    };

    const handleCloseContextMenu = () => {
        setContextMenu(null);
    };

    const handleStartReply = (msg) => {
        const isSelf = msg.sender_id === user.userId;
        const senderName = isSelf ? "You" : (activeConv?.other_participant?.username || "Participant");
        const previewContent = msg.content || (msg.message_type === "image" ? "📷 Image" : (msg.message_type === "audio" ? "🎙️ Voice message" : "📁 Attachment"));
        setReplyingTo({
            id: msg.id || msg.message_id,
            senderName,
            content: previewContent
        });
        handleCloseContextMenu();
    };

    const handleStartEdit = (msg) => {
        setEditingMessage({
            id: msg.id || msg.message_id,
            content: msg.content
        });
        setMessageText(msg.content || "");
        handleCloseContextMenu();
    };

    const handleDeleteMsg = (msg) => {
        const targetId = msg.id || msg.message_id;
        if (socketRef.current) {
            socketRef.current.send(JSON.stringify({
                action: "delete_message",
                message_id: targetId
            }));
        }
        setMessages(prev => prev.filter(m => (m.id || m.message_id) !== targetId));
        handleCloseContextMenu();
    };

    const handleCopyMsgText = (msg) => {
        if (msg.content) {
            navigator.clipboard.writeText(msg.content);
        }
        handleCloseContextMenu();
    };

    const handleCopyImage = async (msg) => {
        if (!msg.media_url) return;
        try {
            const imgUrl = getAssetUrl(msg.media_url);
            const res = await fetch(imgUrl);
            const blob = await res.blob();
            if (navigator.clipboard && window.ClipboardItem) {
                await navigator.clipboard.write([
                    new ClipboardItem({ [blob.type]: blob })
                ]);
            } else {
                await navigator.clipboard.writeText(imgUrl);
            }
        } catch (err) {
            console.error("Failed to copy image:", err);
            try {
                await navigator.clipboard.writeText(getAssetUrl(msg.media_url));
            } catch (e) {}
        }
        handleCloseContextMenu();
    };

    const handlePaste = (e) => {
        const clipboardData = e.clipboardData || window.clipboardData;
        if (!clipboardData || !clipboardData.items) return;

        const items = Array.from(clipboardData.items);
        for (const item of items) {
            if (item.kind === "file") {
                const file = item.getAsFile();
                if (file) {
                    e.preventDefault();
                    setSelectedFile(file);
                    if (file.type.startsWith("image/")) {
                        const reader = new FileReader();
                        reader.onload = () => setFilePreview(reader.result);
                        reader.readAsDataURL(file);
                    } else {
                        setFilePreview(null);
                    }
                    break;
                }
            }
        }
    };

    const REACTION_EMOJIS = ["❤️", "👍", "😂", "😮", "😢", "🔥"];

    const handleToggleReaction = (msg, emoji) => {
        if (!activeConv) return;
        const msgId = String(msg.id || msg.message_id || "");

        safeSendWs({
            action: "react_message",
            conversation_id: String(activeConv.id),
            message_id: msgId,
            emoji: String(emoji)
        });

        setMessages(prev => prev.map(m => {
            if ((m.id || m.message_id) === msgId) {
                const existingReactions = { ...(m.reactions || {}) };
                const userList = existingReactions[emoji] ? [...existingReactions[emoji]] : [];
                const userIndex = userList.indexOf(user.userId);

                if (userIndex > -1) {
                    userList.splice(userIndex, 1);
                } else {
                    userList.push(user.userId);
                }

                if (userList.length === 0) {
                    delete existingReactions[emoji];
                } else {
                    existingReactions[emoji] = userList;
                }
                return { ...m, reactions: existingReactions };
            }
            return m;
        }));

        handleCloseContextMenu();
    };

    const handleTogglePin = (msg) => {
        if (!activeConv) return;
        const msgId = String(msg.id || msg.message_id || "");
        const currentPinnedId = pinnedMessageIdMap[activeConv.id];
        const isCurrentlyPinned = currentPinnedId === msgId;

        const payload = {
            action: "pin_message",
            conversation_id: String(activeConv.id)
        };
        if (!isCurrentlyPinned) {
            payload.message_id = msgId;
        }

        safeSendWs(payload);

        setPinnedMessageIdMap(prev => ({
            ...prev,
            [activeConv.id]: isCurrentlyPinned ? null : msgId
        }));
        handleCloseContextMenu();
    };

    const searchMatchingMessages = messages.filter(m => {
        if (!inChatSearchQuery.trim()) return false;
        return m.content?.toLowerCase().includes(inChatSearchQuery.toLowerCase());
    });

    const handleNextSearchMatch = () => {
        if (searchMatchingMessages.length === 0) return;
        const nextIdx = (inChatSearchMatchIndex + 1) % searchMatchingMessages.length;
        setInChatSearchMatchIndex(nextIdx);
        const targetMsg = searchMatchingMessages[nextIdx];
        const el = document.getElementById(`msg-${targetMsg.id || targetMsg.message_id}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    };

    const handlePrevSearchMatch = () => {
        if (searchMatchingMessages.length === 0) return;
        const prevIdx = (inChatSearchMatchIndex - 1 + searchMatchingMessages.length) % searchMatchingMessages.length;
        setInChatSearchMatchIndex(prevIdx);
        const targetMsg = searchMatchingMessages[prevIdx];
        const el = document.getElementById(`msg-${targetMsg.id || targetMsg.message_id}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
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
        <div className={`ht-app-container ${theme === "dark" ? "ht-dark-theme" : "ht-light-theme"}`} style={{ background: t.chatBg, color: t.text }}>
            {errorToast && (
                <div style={{
                    position: "fixed",
                    top: 20,
                    left: "50%",
                    transform: "translateX(-50%)",
                    zIndex: 9999,
                    background: "rgba(220, 38, 38, 0.94)",
                    backdropFilter: "blur(12px)",
                    color: "#ffffff",
                    padding: "12px 20px",
                    borderRadius: "14px",
                    fontSize: "13px",
                    fontWeight: 600,
                    boxShadow: "0 10px 30px rgba(220, 38, 38, 0.4)",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    maxWidth: "90%",
                    animation: "fadeIn 0.3s ease"
                }}>
                    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>{errorToast}</span>
                    <button
                        onClick={() => setErrorToast(null)}
                        style={{
                            background: "rgba(255, 255, 255, 0.2)",
                            border: "none",
                            borderRadius: "50%",
                            width: "22px",
                            height: "22px",
                            color: "#ffffff",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            marginLeft: "10px",
                            fontSize: "12px",
                            fontWeight: 700
                        }}
                    >
                        ✕
                    </button>
                </div>
            )}

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
                            <div className="ht-sidebar-title-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <h2 style={{ margin: 0, fontSize: 20, fontWeight: "800", color: t.text }}>Messages</h2>
                                    <button
                                        type="button"
                                        onClick={() => setIsCreateGroupOpen(true)}
                                        style={{
                                            background: "rgba(56, 189, 248, 0.12)",
                                            border: "1px solid rgba(56, 189, 248, 0.3)",
                                            color: "#38bdf8",
                                            borderRadius: "20px",
                                            padding: "3px 10px",
                                            fontSize: "11px",
                                            fontWeight: "800",
                                            cursor: "pointer",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "4px",
                                            transition: "all 0.2s ease"
                                        }}
                                        title="Create New Group Chat"
                                    >
                                        <span>+ Group</span>
                                    </button>
                                </div>
                                
                                {syncState === "connecting" && (
                                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: "#eab308" }}>
                                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#eab308", display: "inline-block" }} />
                                        <span>Connecting...</span>
                                    </div>
                                )}

                                {syncState === "updating" && (
                                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: t.accent }}>
                                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: t.accent, display: "inline-block" }} />
                                        <span>Updating...</span>
                                    </div>
                                )}

                                {syncState === "ready" && (
                                    <span style={{
                                        fontSize: 11,
                                        fontWeight: 800,
                                        letterSpacing: "0.5px",
                                        background: "linear-gradient(135deg, #38bdf8, #818cf8)",
                                        WebkitBackgroundClip: "text",
                                        WebkitTextFillColor: "transparent",
                                        textTransform: "uppercase"
                                    }}>
                                        FlowChat
                                    </span>
                                )}
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
                )}

                {activeRailTab === "settings" && (
                    <div style={{ padding: 20, display: "flex", flexDirection: "column", height: "100%", overflowY: "auto" }}>
                        <h2 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: "800", color: t.text }}>System Settings</h2>

                        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                            {/* Theme & Appearance */}
                            <div>
                                <div className="ht-section-label" style={{ color: t.textMuted, paddingLeft: 0, marginBottom: 8 }}>Appearance & Theme</div>
                                <div style={{ display: "flex", gap: 10 }}>
                                    <div
                                        className="ht-theme-card"
                                        onClick={() => { setTheme("light"); localStorage.setItem("theme_preference", "light"); }}
                                        style={{ flex: 1, background: theme === "light" ? "rgba(56, 189, 248, 0.12)" : "rgba(120, 120, 120, 0.05)", border: theme === "light" ? `1.5px solid ${t.accent}` : "1.5px solid transparent", borderRadius: 12, padding: 12, cursor: "pointer" }}
                                    >
                                        <div style={{ fontSize: 13, fontWeight: "700", color: t.text }}>Light Mode</div>
                                        <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2 }}>Clean high contrast</div>
                                    </div>
                                    <div
                                        className="ht-theme-card"
                                        onClick={() => { setTheme("dark"); localStorage.setItem("theme_preference", "dark"); }}
                                        style={{ flex: 1, background: theme === "dark" ? "rgba(56, 189, 248, 0.12)" : "rgba(120, 120, 120, 0.05)", border: theme === "dark" ? `1.5px solid ${t.accent}` : "1.5px solid transparent", borderRadius: 12, padding: 12, cursor: "pointer" }}
                                    >
                                        <div style={{ fontSize: 13, fontWeight: "700", color: t.text }}>Dark Mode</div>
                                        <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2 }}>Sleek dark theme</div>
                                    </div>
                                </div>
                            </div>

                            {/* Notifications */}
                            <div>
                                <div className="ht-section-label" style={{ color: t.textMuted, paddingLeft: 0, marginBottom: 8 }}>Notifications & Sounds</div>
                                <div
                                    onClick={toggleSoundEnabled}
                                    style={{ background: "rgba(120, 120, 120, 0.05)", border: t.border, borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
                                >
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Message Sound Effects</div>
                                        <div style={{ fontSize: 10.5, color: t.textMuted }}>Play chime when receiving messages</div>
                                    </div>
                                    <span style={{ fontSize: 11, fontWeight: 800, color: soundEnabled ? "#34A853" : t.textMuted }}>
                                        {soundEnabled ? "Enabled ✓" : "Muted ✕"}
                                    </span>
                                </div>
                            </div>

                            {/* Privacy */}
                            <div>
                                <div className="ht-section-label" style={{ color: t.textMuted, paddingLeft: 0, marginBottom: 8 }}>Privacy & Security</div>
                                <div style={{ background: "rgba(120, 120, 120, 0.05)", border: t.border, borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Read Receipts</div>
                                        <div style={{ fontSize: 10.5, color: t.textMuted }}>Show when messages are read</div>
                                    </div>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: t.accent }}>Enabled</span>
                                </div>
                            </div>

                            {/* Storage & Limits */}
                            <div>
                                <div className="ht-section-label" style={{ color: t.textMuted, paddingLeft: 0, marginBottom: 8 }}>Storage & Attachments</div>
                                <div style={{ background: "rgba(120, 120, 120, 0.05)", border: t.border, borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Max Attachment Payload</div>
                                        <div style={{ fontSize: 10.5, color: t.textMuted }}>High-capacity Rocket file limit</div>
                                    </div>
                                    <span style={{ fontSize: 11, fontWeight: 800, color: "#38bdf8", background: "rgba(56,189,248,0.15)", padding: "4px 8px", borderRadius: 8 }}>50 MB</span>
                                </div>
                            </div>

                            {/* Account Session */}
                            <div style={{ marginTop: 10 }}>
                                <button
                                    type="button"
                                    onClick={onLogout}
                                    style={{
                                        width: "100%",
                                        padding: "12px",
                                        borderRadius: 12,
                                        border: "1px solid rgba(239, 68, 68, 0.4)",
                                        background: "rgba(239, 68, 68, 0.1)",
                                        color: "#ef4444",
                                        fontWeight: 800,
                                        cursor: "pointer"
                                    }}
                                >
                                    Log Out of FlowChat
                                </button>
                            </div>
                        </div>

                        <div style={{ marginTop: "auto", borderTop: t.border, paddingTop: 16, fontSize: 11, color: t.textMuted, textAlign: "center" }}>
                            FlowChat v2.5.0 • End-to-End Encrypted
                        </div>
                    </div>
                )}
            </div>

            {/* 3. Center Messaging Pane */}
            <div className="ht-chat-pane">
                {activeConv ? (
                    <>
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
                                            (activeConv.type === "group"
                                                ? `${activeConv.participants?.length || 0} members`
                                                : (!activeConv.other_participant
                                                    ? "personal cloud storage"
                                                    : (activeConv.other_participant.status === "online"
                                                        ? "online"
                                                        : formatLastSeen(activeConv.other_participant.last_seen))))}
                                    </span>
                                </div>
                            )}

                            <div className="ht-header-actions" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                {!isInChatSearchOpen && (
                                    <button
                                        className="ht-action-circle-btn"
                                        style={{ color: t.text }}
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

                        {/* Pinned Message Banner */}
                        {pinnedMessageIdMap[activeConv?.id] && (() => {
                            const pinnedMsgId = pinnedMessageIdMap[activeConv.id];
                            const pinnedMsg = messages.find(m => (m.id || m.message_id) === pinnedMsgId);
                            if (!pinnedMsg) return null;
                            const isSelf = pinnedMsg.sender_id === user.userId;
                            const senderTitle = isSelf ? "You" : (activeConv.display_name || "Participant");
                            return (
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        padding: "8px 16px",
                                        background: "rgba(3, 52, 110, 0.08)",
                                        backdropFilter: "blur(8px)",
                                        borderBottom: t.border,
                                        cursor: "pointer",
                                        zIndex: 10
                                    }}
                                    onClick={() => {
                                        const el = document.getElementById(`msg-${pinnedMsgId}`);
                                        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                                    }}
                                >
                                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                                        <svg width="16" height="16" fill={t.accent} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                                            <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6l1 1 1-1v-6h5v-2l-2-2z" />
                                        </svg>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontSize: 11, fontWeight: 700, color: t.accent }}>Pinned Message • {senderTitle}</div>
                                            <div style={{ fontSize: 12, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                {pinnedMsg.content || (pinnedMsg.message_type === "image" ? "📷 Image" : "Attachment")}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleTogglePin(pinnedMsg);
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
                                        style={{ position: "relative" }}
                                    >
                                        <div className="ht-msg-avatar">
                                            {isSelf ? (
                                                myProfile.avatar_url ? (
                                                    <img src={myProfile.avatar_url} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                                                ) : (
                                                    user?.username?.[0]?.toUpperCase() || "U"
                                                )
                                            ) : (
                                                m.sender_avatar ? (
                                                    <img src={m.sender_avatar} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                                                ) : (
                                                    (m.sender_name?.[0] || activeConv.display_name?.[0])?.toUpperCase() || "@"
                                                )
                                            )}
                                        </div>
                                        <div className="ht-msg-bubble-box" style={{ position: "relative" }}>

                                            <div
                                                className="ht-msg-bubble"
                                                onContextMenu={(e) => handleContextMenu(e, m)}
                                                style={{
                                                    background: isSelf ? t.bubbleSent : t.bubbleRecv,
                                                    color: isSelf ? t.bubbleSentText : t.bubbleRecvText,
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
                                                        {m.sender_name || "Participant"}
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
                                                        const hasReacted = uids.includes(user.userId);
                                                        return (
                                                            <button
                                                                key={emoji}
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleToggleReaction(m, emoji);
                                                                }}
                                                                style={{
                                                                    background: hasReacted ? "rgba(99, 102, 241, 0.25)" : "rgba(0, 0, 0, 0.2)",
                                                                    border: hasReacted ? "1px solid #6366f1" : "1px solid transparent",
                                                                    borderRadius: "12px",
                                                                    padding: "2px 6px",
                                                                    fontSize: "12px",
                                                                    cursor: "pointer",
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    gap: "4px",
                                                                    color: isSelf ? t.bubbleSentText : t.bubbleRecvText,
                                                                    transition: "all 0.15s ease"
                                                                }}
                                                                title={`${uids.length} reaction${uids.length > 1 ? "s" : ""}`}
                                                            >
                                                                <span>{emoji}</span>
                                                                <span style={{ fontSize: "10.5px", fontWeight: "700" }}>{uids.length}</span>
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
                                    {pinnedMessageIdMap[activeConv?.id] === (contextMenu.message.id || contextMenu.message.message_id) ? "Unpin Message" : "Pin Message"}
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
                            <button
                                className="ht-inspector-action-btn"
                                style={{ color: t.text }}
                                onClick={() => {
                                    setViewingParticipantProfile({
                                        display_name: activeConv.display_name,
                                        username: activeConv.other_participant?.username || activeConv.display_name,
                                        avatar_url: activeConv.avatar_url,
                                        status: activeConv.other_participant?.status || "online",
                                        last_seen: activeConv.other_participant?.last_seen
                                    });
                                }}
                                title="View User Profile"
                            >
                                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                <span>Profile</span>
                            </button>
                            <button
                                className="ht-inspector-action-btn"
                                style={{ color: mutedConvIds[activeConv.id] ? "#ef4444" : t.text }}
                                onClick={() => toggleMuteConversation(activeConv.id)}
                                title={mutedConvIds[activeConv.id] ? "Unmute Notifications" : "Mute Notifications"}
                            >
                                {mutedConvIds[activeConv.id] ? (
                                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                                    </svg>
                                ) : (
                                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                                )}
                                <span>{mutedConvIds[activeConv.id] ? "Muted" : "Mute"}</span>
                            </button>
                            <button
                                className="ht-inspector-action-btn"
                                style={{ color: isInChatSearchOpen ? t.accent : t.text }}
                                onClick={() => {
                                    setIsInChatSearchOpen(true);
                                    setInChatSearchQuery("");
                                    setInChatSearchMatchIndex(0);
                                }}
                                title="Search Messages in Chat"
                            >
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

            {/* Participant Profile Modal */}
            {viewingParticipantProfile && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: "rgba(0, 0, 0, 0.6)",
                        backdropFilter: "blur(8px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 9999,
                        padding: 20
                    }}
                    onClick={() => setViewingParticipantProfile(null)}
                >
                    <div
                        style={{
                            width: 360,
                            background: t.cardBg,
                            border: t.border,
                            borderRadius: 24,
                            padding: 24,
                            boxShadow: "0 20px 50px rgba(0,0,0,0.4)",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            position: "relative",
                            animation: "fadeIn 0.2s ease"
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
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
                                fontWeight: "bold"
                            }}
                        >
                            ✕
                        </button>

                        <div style={{ width: 96, height: 96, borderRadius: "50%", background: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 36, fontWeight: 800, overflow: "hidden", marginBottom: 16, border: `3px solid ${t.accent}` }}>
                            {viewingParticipantProfile.avatar_url ? (
                                <img src={viewingParticipantProfile.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                                viewingParticipantProfile.display_name?.[0]?.toUpperCase() || "@"
                            )}
                        </div>

                        <h3 style={{ margin: 0, fontSize: 20, color: t.text, fontWeight: 800 }}>{viewingParticipantProfile.display_name}</h3>
                        <div style={{ fontSize: 13, color: t.accent, fontWeight: 600, marginTop: 4 }}>@{viewingParticipantProfile.username}</div>

                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, padding: "4px 12px", background: "rgba(120, 120, 120, 0.08)", borderRadius: 12, fontSize: 12, color: viewingParticipantProfile.status === "online" ? "#34A853" : t.textMuted }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: viewingParticipantProfile.status === "online" ? "#34A853" : t.textMuted }} />
                            {viewingParticipantProfile.status === "online" ? "Active Now" : (viewingParticipantProfile.last_seen ? `Last seen ${formatLastSeen(viewingParticipantProfile.last_seen)}` : "Offline")}
                        </div>

                        <div style={{ width: "100%", display: "flex", gap: 12, marginTop: 24 }}>
                            <div style={{ flex: 1, padding: 12, borderRadius: 14, background: "rgba(120, 120, 120, 0.05)", border: t.border, textAlign: "center" }}>
                                <div style={{ fontSize: 16, fontWeight: 800, color: t.text }}>{sharedImages.length}</div>
                                <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2 }}>Shared Images</div>
                            </div>
                            <div style={{ flex: 1, padding: 12, borderRadius: 14, background: "rgba(120, 120, 120, 0.05)", border: t.border, textAlign: "center" }}>
                                <div style={{ fontSize: 16, fontWeight: 800, color: t.text }}>{sharedFiles.length}</div>
                                <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2 }}>Shared Files</div>
                            </div>
                        </div>

                        {/* Group Member List segment */}
                        {activeConv.type === "group" && (
                            <div style={{ borderBottom: t.border, paddingBottom: 16, marginBottom: 16 }}>
                                <div style={{ fontSize: 13, fontWeight: "755", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                    <span>Group Members</span>
                                    <span style={{ fontSize: 11, color: t.textMuted }}>{activeConv.participants?.length || 0}</span>
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                    {activeConv.participants?.map(p => (
                                        <div key={p.user_id || p.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#6366f1", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12 }}>
                                                {p.avatar_url ? <img src={p.avatar_url} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} /> : ((p.display_name || p.username)?.[0]?.toUpperCase() || "@")}
                                            </div>
                                            <div style={{ flex: 1, overflow: "hidden" }}>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                    {p.display_name || p.username} {p.user_id === user.userId && <span style={{ fontSize: 10, opacity: 0.6 }}>(You)</span>}
                                                </div>
                                                <div style={{ fontSize: 11, color: p.status === "online" ? "#34A853" : t.textMuted }}>
                                                    {p.status === "online" ? "online" : "offline"}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <button
                            onClick={() => setViewingParticipantProfile(null)}
                            style={{
                                width: "100%",
                                padding: "12px",
                                borderRadius: 14,
                                border: "none",
                                background: t.accent,
                                color: "white",
                                fontWeight: 800,
                                fontSize: 14,
                                cursor: "pointer",
                                marginTop: 20
                            }}
                        >
                            Close Profile
                        </button>
                    </div>
                </div>
            )}

            {/* Create Group Modal */}
            {isCreateGroupOpen && (
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
                                    placeholder="e.g. Design System Team"
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
                                            <span key={m.id} style={{
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
                                                    onClick={() => handleRemoveGroupMember(m.id)}
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
                                                key={u.id}
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
            )}
        </div>
    );
};
