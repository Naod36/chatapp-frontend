import { useEffect, useRef, useState } from "react";
import { userService } from "../services/user";
import { conversationService } from "../services/conversations";
import { websocketService } from "../services/websocket";
import { API_BASE } from "../services/api";
import { THEME } from "../utils/theme";

// Modular Component Imports
import NavigationRail from "./chat/Sidebar/NavigationRail";
import ConversationList from "./chat/Sidebar/ConversationList";
import ConversationInspector from "./chat/Sidebar/ConversationInspector";
import ChatArea from "./chat/ChatArea/ChatArea";
import CreateGroupModal from "./chat/Modals/CreateGroupModal";
import AddMemberModal from "./chat/Modals/AddMemberModal";
import GroupInfoModal from "./chat/Modals/GroupInfoModal";
import UserProfileModal from "./chat/Modals/UserProfileModal";
import ParticipantContextMenu from "./chat/ContextMenu/ParticipantContextMenu";


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
    const [convoTab, setConvoTab] = useState("all"); // "all" | "groups"
    const [showInspector, setShowInspector] = useState(false);
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
    const [pinnedMessagesMap, setPinnedMessagesMap] = useState({});
    const [pinScopePromptMsg, setPinScopePromptMsg] = useState(null);
    const [pinNotifyStep, setPinNotifyStep] = useState(false);
    const [pinnedListOpen, setPinnedListOpen] = useState(false);
    const [isInChatSearchOpen, setIsInChatSearchOpen] = useState(false);
    const [inChatSearchQuery, setInChatSearchQuery] = useState("");
    const [inChatSearchMatchIndex, setInChatSearchMatchIndex] = useState(0);
    const [hoveredMsgId, setHoveredMsgId] = useState(null);
    const [mutedConvIds, setMutedConvIds] = useState(() => {
        try {
            const saved = localStorage.getItem("muted_conversations");
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    });
    const [pinnedConvIds, setPinnedConvIds] = useState(() => {
        try {
            const saved = localStorage.getItem("chat_pinned_conv_ids");
            return saved ? JSON.parse(saved) : ["virtual-saved-messages"];
        } catch (e) {
            return ["virtual-saved-messages"];
        }
    });
    const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
    const headerMenuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (headerMenuRef.current && !headerMenuRef.current.contains(event.target)) {
                setIsHeaderMenuOpen(false);
            }
        };
        if (isHeaderMenuOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isHeaderMenuOpen]);


    const [viewingParticipantProfile, setViewingParticipantProfile] = useState(null);
    const [isRailExpanded, setIsRailExpanded] = useState(() => {
        const saved = localStorage.getItem("chat_rail_expanded");
        return saved !== null ? saved === "true" : true;
    });

    const toggleRailExpanded = () => {
        setIsRailExpanded(prev => {
            const next = !prev;
            localStorage.setItem("chat_rail_expanded", String(next));
            return next;
        });
    };

    // Dynamic document title tab unread indicator
    useEffect(() => {
        const totalUnread = conversations.reduce((acc, c) => {
            const isMuted = Array.isArray(mutedConvIds) ? mutedConvIds.includes(c.id) : !!mutedConvIds?.[c.id];
            if (!isMuted) {
                return acc + (c.unread_count || 0);
            }
            return acc;
        }, 0);

        if (totalUnread > 0) {
            document.title = `(${totalUnread}) FlowChat — Realtime Messaging`;
        } else {
            document.title = "FlowChat — Realtime Messaging";
        }
    }, [conversations, mutedConvIds]);

    const isConvPinned = (c) => {
        if (!c) return false;
        const isSaved = c.id === "virtual-saved-messages" || (c.type === "direct" && !c.other_participant);
        if (isSaved) {
            return pinnedConvIds.includes("virtual-saved-messages") || pinnedConvIds.includes(c.id);
        }
        return pinnedConvIds.includes(c.id);
    };

    const togglePinConversation = (convId) => {
        setPinnedConvIds(prev => {
            const isSaved = activeConv && (activeConv.id === convId) && (activeConv.id === "virtual-saved-messages" || (activeConv.type === "direct" && !activeConv.other_participant));
            const currentlyPinned = isSaved
                ? (prev.includes(convId) || prev.includes("virtual-saved-messages"))
                : prev.includes(convId);
            let updated;
            if (currentlyPinned) {
                updated = prev.filter(id => id !== convId && id !== "virtual-saved-messages");
            } else {
                updated = [...prev, convId];
                if (isSaved) {
                    updated.push("virtual-saved-messages");
                }
            }
            localStorage.setItem("chat_pinned_conv_ids", JSON.stringify(updated));
            return updated;
        });
    };

    const toggleMuteConversation = (convId) => {
        setMutedConvIds(prev => {
            const isMuted = Array.isArray(prev) ? prev.includes(convId) : !!prev?.[convId];
            let updated;
            if (Array.isArray(prev)) {
                updated = isMuted ? prev.filter(id => id !== convId) : [...prev, convId];
            } else {
                updated = [convId];
            }
            localStorage.setItem("muted_conversations", JSON.stringify(updated));
            return updated;
        });
    };

    // Group Admin state & Add Member states
    const [groupAdminsMap, setGroupAdminsMap] = useState(() => {
        try {
            const saved = localStorage.getItem("group_admins_map");
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            return {};
        }
    });

    const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
    const [addMemberQuery, setAddMemberQuery] = useState("");
    const [addMemberResults, setAddMemberResults] = useState([]);
    const [participantContextMenu, setParticipantContextMenu] = useState(null);

    // Group Info & Admin Management state
    const [isGroupInfoOpen, setIsGroupInfoOpen] = useState(false);
    const [editGroupTitle, setEditGroupTitle] = useState("");
    const [editGroupAvatarUrl, setEditGroupAvatarUrl] = useState("");
    const [isSavingGroupInfo, setIsSavingGroupInfo] = useState(false);
    const groupAvatarInputRef = useRef(null);

    const handleSaveGroupInfo = async (e) => {
        e.preventDefault();
        if (!activeConv || activeConv.type !== "group") return;
        if (!editGroupTitle.trim()) {
            showError("Group title cannot be empty");
            return;
        }

        try {
            setIsSavingGroupInfo(true);
            const updatedTitle = editGroupTitle.trim();
            const updatedAvatar = editGroupAvatarUrl;

            // 1. Send WebSocket update action for instant real-time sync across connected clients
            if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
                socketRef.current.send(JSON.stringify({
                    action: "update_group",
                    conversation_id: activeConv.id,
                    title: updatedTitle,
                    avatar_url: updatedAvatar
                }));
            }

            // 2. Update local state immediately
            setActiveConv(prev => prev ? {
                ...prev,
                title: updatedTitle,
                display_name: updatedTitle,
                avatar_url: updatedAvatar
            } : null);

            setConversations(prev => prev.map(c => {
                if (c.id === activeConv.id) {
                    return {
                        ...c,
                        title: updatedTitle,
                        display_name: updatedTitle,
                        avatar_url: updatedAvatar
                    };
                }
                return c;
            }));

            // 3. REST API update call with fallback
            try {
                await conversationService.updateGroup(activeConv.id, {
                    title: updatedTitle,
                    avatar_url: updatedAvatar
                });
            } catch (apiErr) {
                console.warn("REST endpoint returned error, applied via WS/state fallback:", apiErr);
            }

            setIsGroupInfoOpen(false);
        } catch (err) {
            showError(err.message || "Failed to update group settings");
        } finally {
            setIsSavingGroupInfo(false);
        }
    };

    const handleGroupAvatarFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            showError("Please select a valid image file");
            return;
        }
        try {
            setIsUploading(true);
            const res = await conversationService.uploadFile(file, (loaded, total, pct) => {
                setUploadProgress({ loadedFormatted: (loaded / 1024 / 1024).toFixed(1) + " MB", totalFormatted: (total / 1024 / 1024).toFixed(1) + " MB", percentage: pct });
            });
            const uploadedUrl = res?.url || res?.media_url;
            if (uploadedUrl && activeConv) {
                setEditGroupAvatarUrl(uploadedUrl);

                // 1. Send WebSocket update action for instant real-time sync across connected clients
                if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
                    socketRef.current.send(JSON.stringify({
                        action: "update_group",
                        conversation_id: activeConv.id,
                        title: editGroupTitle.trim() || activeConv.title || activeConv.display_name,
                        avatar_url: uploadedUrl
                    }));
                }

                // 2. Update local state immediately
                setActiveConv(prev => prev ? {
                    ...prev,
                    avatar_url: uploadedUrl
                } : null);

                setConversations(prev => prev.map(c => {
                    if (c.id === activeConv.id) {
                        return {
                            ...c,
                            avatar_url: uploadedUrl
                        };
                    }
                    return c;
                }));

                // 3. REST API update call with fallback
                try {
                    await conversationService.updateGroup(activeConv.id, {
                        title: editGroupTitle.trim() || activeConv.title || activeConv.display_name,
                        avatar_url: uploadedUrl
                    });
                } catch (apiErr) {
                    console.warn("REST endpoint error on avatar upload, fallback via WS/state:", apiErr);
                }
            }
        } catch (err) {
            showError(err.message || "Failed to upload group avatar");
        } finally {
            setIsUploading(false);
        }
    };

    useEffect(() => {
        const handleCloseMenu = () => setParticipantContextMenu(null);
        window.addEventListener("click", handleCloseMenu);
        window.addEventListener("scroll", handleCloseMenu, true);
        return () => {
            window.removeEventListener("click", handleCloseMenu);
            window.removeEventListener("scroll", handleCloseMenu, true);
        };
    }, []);

    // Resizable sidebars state & mouse drag handling
    const [leftSidebarWidth, setLeftSidebarWidth] = useState(() => {
        const saved = localStorage.getItem("chat_left_sidebar_width");
        return saved ? Math.min(Math.max(parseInt(saved, 10), 220), 550) : 320;
    });

    const [rightSidebarWidth, setRightSidebarWidth] = useState(() => {
        const saved = localStorage.getItem("chat_right_sidebar_width");
        return saved ? Math.min(Math.max(parseInt(saved, 10), 220), 550) : 300;
    });

    const [isResizingLeft, setIsResizingLeft] = useState(false);
    const [isResizingRight, setIsResizingRight] = useState(false);

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (isResizingLeft) {
                const railWidth = 72;
                const newWidth = Math.min(Math.max(e.clientX - railWidth, 220), 550);
                setLeftSidebarWidth(newWidth);
                localStorage.setItem("chat_left_sidebar_width", String(newWidth));
            } else if (isResizingRight) {
                const newWidth = Math.min(Math.max(window.innerWidth - e.clientX, 220), 550);
                setRightSidebarWidth(newWidth);
                localStorage.setItem("chat_right_sidebar_width", String(newWidth));
            }
        };

        const handleMouseUp = () => {
            setIsResizingLeft(false);
            setIsResizingRight(false);
        };

        if (isResizingLeft || isResizingRight) {
            window.addEventListener("mousemove", handleMouseMove);
            window.addEventListener("mouseup", handleMouseUp);
            document.body.style.userSelect = "none";
            document.body.style.cursor = "col-resize";
        }

        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
            document.body.style.userSelect = "";
            document.body.style.cursor = "";
        };
    }, [isResizingLeft, isResizingRight]);

    const isUserGroupAdmin = (conv, userId) => {
        if (!conv || conv.type !== "group") return false;
        const currentCreator = conv.creator_id;
        if (currentCreator === userId) return true;
        const participant = (conv.participants || []).find(p => (p.user_id || p.id) === userId);
        if (participant && (participant.role === "admin" || participant.role === "creator")) return true;
        const admins = groupAdminsMap[conv.id] || [];
        return admins.includes(userId);
    };

    const handleMakeAdmin = (convId, memberId, isAdmin = true) => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({
                action: "update_group_admin",
                conversation_id: convId,
                target_user_id: memberId,
                is_admin: isAdmin
            }));
        }

        setGroupAdminsMap(prev => {
            const currentAdmins = prev[convId] || [];
            let updatedAdmins;
            if (isAdmin) {
                updatedAdmins = Array.from(new Set([...currentAdmins, memberId]));
            } else {
                updatedAdmins = currentAdmins.filter(id => id !== memberId);
            }
            const updated = { ...prev, [convId]: updatedAdmins };
            localStorage.setItem("group_admins_map", JSON.stringify(updated));
            return updated;
        });

        setConversations(prev => prev.map(c => {
            if (c.id === convId && c.participants) {
                const updatedParts = c.participants.map(p => {
                    const pId = p.user_id || p.id;
                    if (pId === memberId) {
                        return { ...p, role: isAdmin ? "admin" : "member" };
                    }
                    return p;
                });
                return { ...c, participants: updatedParts };
            }
            return c;
        }));

        setActiveConv(prev => {
            if (prev && prev.id === convId && prev.participants) {
                const updatedParts = prev.participants.map(p => {
                    const pId = p.user_id || p.id;
                    if (pId === memberId) {
                        return { ...p, role: isAdmin ? "admin" : "member" };
                    }
                    return p;
                });
                return { ...prev, participants: updatedParts };
            }
            return prev;
        });
    };

    const handleAddMemberToGroup = (newMember) => {
        if (!activeConv || activeConv.type !== "group") return;
        const memberId = newMember.user_id || newMember.id;

        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({
                action: "add_group_member",
                conversation_id: activeConv.id,
                target_user_id: memberId
            }));
        }

        const exists = activeConv.participants?.some(p => (p.user_id || p.id) === memberId);
        if (exists) return;

        const updatedParticipant = {
            user_id: memberId,
            username: newMember.username,
            display_name: newMember.display_name || newMember.username,
            avatar_url: newMember.avatar_url || null,
            status: newMember.status || "offline",
            last_seen: newMember.last_seen || null,
            role: "member"
        };

        const updatedParticipants = [...(activeConv.participants || []), updatedParticipant];

        setActiveConv(prev => ({
            ...prev,
            participants: updatedParticipants
        }));

        setConversations(prev => prev.map(c => {
            if (c.id === activeConv.id) {
                return { ...c, participants: updatedParticipants };
            }
            return c;
        }));

        setIsAddMemberOpen(false);
        setAddMemberQuery("");
    };

    // Group Creation Modal states
    const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
    const [groupTitle, setGroupTitle] = useState("");
    const [groupSearchQuery, setGroupSearchQuery] = useState("");
    const [groupSearchResults, setGroupSearchResults] = useState([]);
    const [selectedGroupMembers, setSelectedGroupMembers] = useState([]);
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);

    // User search effect for group members
    useEffect(() => {
        if (!groupSearchQuery.trim()) {
            setGroupSearchResults([]);
            return;
        }
        const timer = setTimeout(async () => {
            try {
                const res = await userService.searchUsers(groupSearchQuery);
                const currentUserId = user?.userId || user?.user_id;
                const normalized = res.map(u => ({
                    ...u,
                    id: u.id || u.user_id
                }));
                const filtered = normalized.filter(u => u.id !== currentUserId && !selectedGroupMembers.some(sm => (sm.id || sm.user_id) === u.id));
                setGroupSearchResults(filtered);
            } catch (err) {
                console.error("Failed to search users for group:", err);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [groupSearchQuery, selectedGroupMembers, user]);

    // Search users to add to existing group
    useEffect(() => {
        if (!addMemberQuery.trim()) {
            setAddMemberResults([]);
            return;
        }
        const timer = setTimeout(async () => {
            try {
                const res = await userService.searchUsers(addMemberQuery);
                const currentParticipants = activeConv?.participants || [];
                const existingIds = new Set(currentParticipants.map(p => p.user_id || p.id));
                const currentUserId = user?.userId || user?.user_id;

                const filtered = res
                    .map(u => ({
                        id: u.user_id || u.id,
                        user_id: u.user_id || u.id,
                        username: u.username,
                        display_name: u.display_name || u.username,
                        avatar_url: u.avatar_url
                    }))
                    .filter(u => u.id !== currentUserId && !existingIds.has(u.id));

                setAddMemberResults(filtered);
            } catch (err) {
                console.error("Failed to search members:", err);
            }
        }, 250);
        return () => clearTimeout(timer);
    }, [addMemberQuery, activeConv, user]);

    const handleSelectGroupMember = (u) => {
        const normalizedUser = { ...u, id: u.id || u.user_id };
        setSelectedGroupMembers(prev => [...prev, normalizedUser]);
        setGroupSearchQuery("");
        setGroupSearchResults([]);
    };

    const handleRemoveGroupMember = (userId) => {
        setSelectedGroupMembers(prev => prev.filter(u => (u.id || u.user_id) !== userId));
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
            const participantIds = selectedGroupMembers.map(u => u.id || u.user_id);
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
                ctx.close().catch(() => { });
            }, 350);
        } catch (e) { }
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
                    status: other?.status || c.status,
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

            const fullList = [selfConv, ...sortedOthers].filter(Boolean);
            setConversations(fullList);

            if (activeConvRef.current) {
                const freshActive = fullList.find(c => c.id === activeConvRef.current.id);
                if (freshActive) {
                    setActiveConv(prev => {
                        if (!prev) return freshActive;
                        return {
                            ...prev,
                            ...freshActive,
                            status: freshActive.status || freshActive.other_participant?.status || prev.status,
                            other_participant: freshActive.other_participant ? {
                                ...prev.other_participant,
                                ...freshActive.other_participant,
                                status: freshActive.other_participant.status
                            } : prev.other_participant
                        };
                    });
                }
            }
        } catch (err) {
            console.error("Failed to load conversations:", err);
        }
    };

    // Periodic background sync loop every 5 seconds as a fail-safe backup for WebSockets
    useEffect(() => {
        if (!user?.token) return;

        const interval = setInterval(() => {
            loadConversations();
        }, 5000);

        return () => clearInterval(interval);
    }, [user]);

    // Periodic message re-sync for the active conversation — fixes chat screen stuck on old messages.
    // The conversation list is polled every 5s (sidebar shows new previews) but the chat thread
    // has no equivalent refresh unless a WebSocket event fires. This closes that gap.
    useEffect(() => {
        if (!user?.token) return;

        const interval = setInterval(async () => {
            const conv = activeConvRef.current;
            if (!conv || !conv.id || conv.id === "virtual-saved-messages") return;
            try {
                const history = await conversationService.getMessages(conv.id);
                if (!history || !history.length) return;
                const incoming = history.map(m => ({ ...m, id: m.message_id || m.id }));
                setMessages(prev => {
                    const existingIds = new Set(prev.map(m => m.id || m.message_id));
                    const newOnes = incoming.filter(m => !existingIds.has(m.id));
                    if (newOnes.length === 0) return prev;
                    return [...prev, ...newOnes];
                });
            } catch (err) {
                // silent — WS is primary; this is a fallback
            }
        }, 4000);

        return () => clearInterval(interval);
    }, [user]);

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

        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission().catch(() => { });
        }
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

                    if (data.sender_id !== user.userId) {
                        if (soundEnabled) {
                            playNotificationSound();
                        }
                        if ("Notification" in window && Notification.permission === "granted" && (document.hidden || !isCurrentActive)) {
                            try {
                                const senderName = data.sender_name || "New Message";
                                const body = data.message_type === "image" ? "📷 Sent an image" : (data.message_type === "audio" ? "🎙️ Sent a voice message" : (data.message_type === "file" ? "📁 Sent a file" : (data.content || "New message")));
                                const notif = new Notification(`${senderName} (FlowChat)`, {
                                    body: body,
                                    icon: data.sender_avatar || "/favicon.ico",
                                    tag: data.conversation_id
                                });
                                notif.onclick = () => {
                                    window.focus();
                                    notif.close();
                                };
                            } catch (e) { }
                        }
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

                        // Separate Saved Messages from other conversations safely
                        const rest = prev.filter(c => c.id !== data.conversation_id);
                        const savedConv = rest.find(c => c.id === "virtual-saved-messages" || (c.type === "direct" && !c.other_participant));
                        const remaining = rest.filter(c => c !== savedConv);

                        if (updatedTarget.id === "virtual-saved-messages" || (updatedTarget.type === "direct" && !updatedTarget.other_participant)) {
                            return [updatedTarget, ...remaining];
                        } else if (savedConv) {
                            return [savedConv, updatedTarget, ...remaining];
                        } else {
                            return [updatedTarget, ...remaining];
                        }
                    });

                    // If incoming message belongs to our selected thread, push to chat bubble list with deduplication
                    if (isCurrentActive) {
                        setMessages(prev => {
                            // Don't add if message with exact ID is already in list
                            if (prev.some(m => (m.id || m.message_id) === data.message_id)) return prev;

                            // If sent by current user, replace optimistic temporary message if present
                            if (data.sender_id === user.userId) {
                                const tempIdx = prev.findIndex(m => m.id && m.id.toString().startsWith("temp") && (m.content === data.content || m.message_type === data.message_type || !m.content));
                                if (tempIdx !== -1) {
                                    const copy = [...prev];
                                    copy[tempIdx] = {
                                        id: data.message_id,
                                        message_id: data.message_id,
                                        sender_id: data.sender_id,
                                        sender_name: data.sender_name,
                                        sender_avatar: data.sender_avatar,
                                        content: data.content,
                                        message_type: data.message_type,
                                        media_url: data.media_url,
                                        created_at: data.created_at,
                                        reply_to_id: data.reply_to_id || null,
                                        status: data.status || "delivered",
                                        reactions: data.reactions || {}
                                    };
                                    return copy;
                                }
                            }

                            return [
                                ...prev,
                                {
                                    id: data.message_id,
                                    message_id: data.message_id,
                                    sender_id: data.sender_id,
                                    sender_name: data.sender_name,
                                    sender_avatar: data.sender_avatar,
                                    content: data.content,
                                    message_type: data.message_type,
                                    media_url: data.media_url,
                                    created_at: data.created_at,
                                    reply_to_id: data.reply_to_id || null,
                                    status: data.status || "delivered",
                                    reactions: data.reactions || {}
                                }
                            ];
                        });
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
                    const scope = data.scope || "shared";
                    const pUser = String(data.pinned_by_user_id || "");
                    if (scope === "personal" && pUser && pUser !== String(user.userId)) {
                        return;
                    }
                    const pinnedObj = data.pinned_message || {
                        message_id: data.message_id,
                        id: data.message_id,
                        conversation_id: data.conversation_id,
                        scope,
                        pinned_by_user_id: pUser,
                    };
                    setPinnedMessagesMap(prev => {
                        const list = prev[data.conversation_id] || [];
                        const filtered = list.filter(p => String(p.message_id || p.id) !== String(data.message_id));
                        return { ...prev, [data.conversation_id]: [pinnedObj, ...filtered] };
                    });
                    setPinnedMessageIdMap(prev => ({
                        ...prev,
                        [data.conversation_id]: data.message_id
                    }));
                } else if (data.event === "message_unpinned") {
                    setPinnedMessagesMap(prev => {
                        const list = prev[data.conversation_id] || [];
                        const filtered = list.filter(p => String(p.message_id || p.id) !== String(data.message_id));
                        return { ...prev, [data.conversation_id]: filtered };
                    });
                } else if (data.event === "user_status" || data.type === "user_status" || data.action === "user_status") {
                    setConversations(prev => {
                        return prev.map(c => {
                            const otherId = c.other_participant?.user_id || c.other_participant?.id;
                            if (otherId && String(otherId) === String(data.user_id)) {
                                return {
                                    ...c,
                                    status: data.status,
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
                        const otherId = prev?.other_participant?.user_id || prev?.other_participant?.id;
                        if (otherId && String(otherId) === String(data.user_id)) {
                            return {
                                ...prev,
                                status: data.status,
                                other_participant: {
                                    ...prev.other_participant,
                                    status: data.status,
                                    last_seen: data.last_seen
                                }
                            };
                        }
                        return prev;
                    });
                } else if (data.event === "group_admin_updated") {
                    const { conversation_id, target_user_id, is_admin } = data;
                    setGroupAdminsMap(prev => {
                        const currentAdmins = prev[conversation_id] || [];
                        let updatedAdmins;
                        if (is_admin) {
                            updatedAdmins = Array.from(new Set([...currentAdmins, target_user_id]));
                        } else {
                            updatedAdmins = currentAdmins.filter(id => id !== target_user_id);
                        }
                        const updated = { ...prev, [conversation_id]: updatedAdmins };
                        localStorage.setItem("group_admins_map", JSON.stringify(updated));
                        return updated;
                    });

                    setConversations(prev => prev.map(c => {
                        if (c.id === conversation_id && c.participants) {
                            const updatedParts = c.participants.map(p => {
                                const pId = p.user_id || p.id;
                                if (pId === target_user_id) {
                                    return { ...p, role: is_admin ? "admin" : "member" };
                                }
                                return p;
                            });
                            return { ...c, participants: updatedParts };
                        }
                        return c;
                    }));

                    setActiveConv(prev => {
                        if (prev && prev.id === conversation_id && prev.participants) {
                            const updatedParts = prev.participants.map(p => {
                                const pId = p.user_id || p.id;
                                if (pId === target_user_id) {
                                    return { ...p, role: is_admin ? "admin" : "member" };
                                }
                                return p;
                            });
                            return { ...prev, participants: updatedParts };
                        }
                        return prev;
                    });
                } else if (data.event === "group_member_added") {
                    fetchConversations();
                } else if (data.event === "group_updated") {
                    const { conversation_id, title, avatar_url } = data;
                    setConversations(prev => prev.map(c => {
                        if (c.id === conversation_id) {
                            return {
                                ...c,
                                title: title || c.title,
                                display_name: title || c.display_name,
                                avatar_url: avatar_url || c.avatar_url
                            };
                        }
                        return c;
                    }));

                    setActiveConv(prev => {
                        if (prev && prev.id === conversation_id) {
                            return {
                                ...prev,
                                title: title || prev.title,
                                display_name: title || prev.display_name,
                                avatar_url: avatar_url || prev.avatar_url
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
                const uniqueMap = new Map();
                mapped.forEach(m => uniqueMap.set(m.id, m));
                setMessages(Array.from(uniqueMap.values()));
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
            const uniqueMap = new Map();
            mapped.forEach(m => uniqueMap.set(m.id, m));
            setMessages(Array.from(uniqueMap.values()));

            // Fetch pinned messages stack
            try {
                const pins = await fetchWithAuth(`/conversations/${conv.id}/pins`);
                if (Array.isArray(pins)) {
                    setPinnedMessagesMap(prev => ({ ...prev, [conv.id]: pins }));
                }
            } catch (e) { }

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
                mType = selectedFile.type.startsWith("image/") ? "image" : (selectedFile.type.startsWith("audio/") ? "audio" : "file");
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
                // Re-sort conversation list: keep Saved Messages on top, sort all other conversations by last_message_time
                const savedConv = updated.find(c => c.id === "virtual-saved-messages" || (c.type === "direct" && !c.other_participant));
                const nonSaved = updated.filter(c => c !== savedConv);
                const sortedNonSaved = nonSaved.sort((a, b) => {
                    const aTime = a.last_message_time ? new Date(a.last_message_time).getTime() : 0;
                    const bTime = b.last_message_time ? new Date(b.last_message_time).getTime() : 0;
                    return bTime - aTime;
                });
                return savedConv ? [savedConv, ...sortedNonSaved] : sortedNonSaved;
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
            } catch (e) { }
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

    const isGroup = activeConv?.type === 'group';
    const currentParticipant = (activeConv?.participants || []).find(p => String(p.user_id || p.id) === String(user.userId));
    const isAdmin = !isGroup || String(activeConv?.creator_id) === String(user.userId) || currentParticipant?.role === 'admin' || currentParticipant?.role === 'creator';

    const handleTogglePin = (msg, forceScope = null) => {
        if (!activeConv) return;
        const msgId = String(msg.id || msg.message_id || "");
        const currentPins = pinnedMessagesMap[activeConv.id] || [];
        const isCurrentlyPinned = currentPins.some(p => String(p.message_id || p.id) === msgId);

        if (isCurrentlyPinned) {
            handleUnpin(msg);
        } else if (forceScope) {
            executePin(msg, forceScope);
        } else {
            setPinScopePromptMsg(msg);
            setPinNotifyStep(false);
            handleCloseContextMenu();
        }
    };

    const executePin = (msg, scope = "shared", notify = true) => {
        if (!activeConv || !msg) return;
        const msgId = String(msg.id || msg.message_id || "");
        safeSendWs({
            action: "pin_message",
            conversation_id: String(activeConv.id),
            message_id: msgId,
            scope,
            notify,
        });

        const pinObj = {
            ...msg,
            message_id: msgId,
            conversation_id: String(activeConv.id),
            scope,
            notify,
            pinned_by_user_id: user.userId,
        };

        setPinnedMessagesMap(prev => ({
            ...prev,
            [activeConv.id]: [pinObj, ...(prev[activeConv.id] || []).filter(p => String(p.message_id || p.id) !== msgId)]
        }));

        setPinScopePromptMsg(null);
        setPinNotifyStep(false);
        handleCloseContextMenu();
    };

    const handleUnpin = (msg) => {
        if (!activeConv || !msg) return;
        const msgId = String(msg.id || msg.message_id || "");
        safeSendWs({
            action: "unpin_message",
            conversation_id: String(activeConv.id),
            message_id: msgId,
        });

        setPinnedMessagesMap(prev => ({
            ...prev,
            [activeConv.id]: (prev[activeConv.id] || []).filter(p => String(p.message_id || p.id) !== msgId)
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
            <NavigationRail
                isRailExpanded={isRailExpanded}
                toggleRailExpanded={toggleRailExpanded}
                setActiveRailTab={setActiveRailTab}
                activeRailTab={activeRailTab}
                myProfile={myProfile}
                user={user}
                onLogout={onLogout}
            />

            {/* 2. Conversations / Settings / Profile Sidebar */}
            <ConversationList
                leftSidebarWidth={leftSidebarWidth}
                themeTokens={t}
                theme={theme}
                activeRailTab={activeRailTab}
                syncState={syncState}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                conversations={conversations}
                isConvPinned={isConvPinned}
                activeConv={activeConv}
                handleSelectConversation={handleSelectConversation}
                user={user}
                convoTab={convoTab}
                setConvoTab={setConvoTab}
                isSearching={isSearching}
                searchResults={searchResults}
                handleStartConversation={handleStartConversation}
                setIsCreateGroupOpen={setIsCreateGroupOpen}
                myProfile={myProfile}
                setMyProfile={setMyProfile}
                handleUpdateMyProfile={handleUpdateMyProfile}
                avatarInputRef={avatarInputRef}
                handleAvatarFileSelect={handleAvatarFileSelect}
                isUploadingAvatar={isUploadingAvatar}
                profileSavedToast={profileSavedToast}
                isSavingProfile={isSavingProfile}
                setTheme={setTheme}
                soundEnabled={soundEnabled}
                toggleSoundEnabled={toggleSoundEnabled}
                onLogout={onLogout}
                setIsResizingLeft={setIsResizingLeft}
                isResizingLeft={isResizingLeft}
                typingUsers={typingUsers}
            />

            {/* 3. Center Messaging Pane */}
            <ChatArea
                activeConv={activeConv}
                theme={theme}
                themeTokens={t}
                isInChatSearchOpen={isInChatSearchOpen}
                setIsInChatSearchOpen={setIsInChatSearchOpen}
                inChatSearchQuery={inChatSearchQuery}
                setInChatSearchQuery={setInChatSearchQuery}
                inChatSearchMatchIndex={inChatSearchMatchIndex}
                setInChatSearchMatchIndex={setInChatSearchMatchIndex}
                searchMatchingMessages={searchMatchingMessages}
                handlePrevSearchMatch={handlePrevSearchMatch}
                handleNextSearchMatch={handleNextSearchMatch}
                setEditGroupTitle={setEditGroupTitle}
                setEditGroupAvatarUrl={setEditGroupAvatarUrl}
                setIsGroupInfoOpen={setIsGroupInfoOpen}
                setShowInspector={setShowInspector}
                showInspector={showInspector}
                getActiveTypingLabel={getActiveTypingLabel}
                headerMenuRef={headerMenuRef}
                isHeaderMenuOpen={isHeaderMenuOpen}
                setIsHeaderMenuOpen={setIsHeaderMenuOpen}
                togglePinConversation={togglePinConversation}
                isConvPinned={isConvPinned}
                toggleMuteConversation={toggleMuteConversation}
                mutedConvIds={mutedConvIds}
                pinnedMessageIdMap={pinnedMessageIdMap}
                pinnedMessagesMap={pinnedMessagesMap}
                handleUnpin={handleUnpin}
                messages={messages}
                user={user}
                handleTogglePin={handleTogglePin}
                chatContainerRef={chatContainerRef}
                handleChatScroll={handleChatScroll}
                handleCloseContextMenu={handleCloseContextMenu}
                handlePaste={handlePaste}
                hoveredMsgId={hoveredMsgId}
                setHoveredMsgId={setHoveredMsgId}
                myProfile={myProfile}
                handleContextMenu={handleContextMenu}
                handleToggleReaction={handleToggleReaction}
                showScrollBottomBtn={showScrollBottomBtn}
                newMessagesBelowCount={newMessagesBelowCount}
                scrollToBottom={scrollToBottom}
                contextMenu={contextMenu}
                REACTION_EMOJIS={REACTION_EMOJIS}
                handleStartReply={handleStartReply}
                handleCopyMsgText={handleCopyMsgText}
                handleCopyImage={handleCopyImage}
                handleStartEdit={handleStartEdit}
                handleDeleteMsg={handleDeleteMsg}
                handleSendMessage={handleSendMessage}
                replyingTo={replyingTo}
                setReplyingTo={setReplyingTo}
                editingMessage={editingMessage}
                setEditingMessage={setEditingMessage}
                setMessageText={setMessageText}
                selectedFile={selectedFile}
                filePreview={filePreview}
                cancelAttachment={cancelAttachment}
                isUploading={isUploading}
                setIsUploading={setIsUploading}
                uploadProgress={uploadProgress}
                fileInputRef={fileInputRef}
                inputTextareaRef={inputTextareaRef}
                messageText={messageText}
                handleKeyPress={handleKeyPress}
                emojiPickerRef={emojiPickerRef}
                showEmojiPicker={showEmojiPicker}
                setShowEmojiPicker={setShowEmojiPicker}
                isRecording={isRecording}
                setIsRecording={setIsRecording}
                mediaRecorderRef={mediaRecorderRef}
                audioStreamRef={audioStreamRef}
                recordingTimerRef={recordingTimerRef}
                recordingSeconds={recordingSeconds}
                setRecordingSeconds={setRecordingSeconds}
                audioChunksRef={audioChunksRef}
                socketRef={socketRef}
                setMessages={setMessages}
                handleFileSelect={handleFileSelect}
                messageEndRef={messageEndRef}
                API_BASE={API_BASE}
            />

            {/* 4. Far Right Conversation Details Inspector Panel */}
            <ConversationInspector
                showInspector={showInspector}
                activeConv={activeConv}
                rightSidebarWidth={rightSidebarWidth}
                themeTokens={t}
                theme={theme}
                setIsResizingRight={setIsResizingRight}
                isResizingRight={isResizingRight}
                setShowInspector={setShowInspector}
                setViewingParticipantProfile={setViewingParticipantProfile}
                mutedConvIds={mutedConvIds}
                toggleMuteConversation={toggleMuteConversation}
                setIsInChatSearchOpen={setIsInChatSearchOpen}
                setInChatSearchQuery={setInChatSearchQuery}
                setInChatSearchMatchIndex={setInChatSearchMatchIndex}
                isUserGroupAdmin={isUserGroupAdmin}
                user={user}
                setIsAddMemberOpen={setIsAddMemberOpen}
                groupAdminsMap={groupAdminsMap}
                handleStartConversation={handleStartConversation}
                setParticipantContextMenu={setParticipantContextMenu}
                sharedImages={sharedImages}
                sharedFiles={sharedFiles}
            />

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

            {/* Modals */}
            <GroupInfoModal
                isGroupInfoOpen={isGroupInfoOpen}
                setIsGroupInfoOpen={setIsGroupInfoOpen}
                activeConv={activeConv}
                user={user}
                theme={theme}
                themeTokens={t}
                editGroupAvatarUrl={editGroupAvatarUrl}
                isUserGroupAdmin={isUserGroupAdmin}
                groupAvatarInputRef={groupAvatarInputRef}
                handleGroupAvatarFileChange={handleGroupAvatarFileChange}
                editGroupTitle={editGroupTitle}
                setEditGroupTitle={setEditGroupTitle}
                handleSaveGroupInfo={handleSaveGroupInfo}
                isSavingGroupInfo={isSavingGroupInfo}
                setIsAddMemberOpen={setIsAddMemberOpen}
            />

            <CreateGroupModal
                isCreateGroupOpen={isCreateGroupOpen}
                setIsCreateGroupOpen={setIsCreateGroupOpen}
                groupTitle={groupTitle}
                setGroupTitle={setGroupTitle}
                selectedGroupMembers={selectedGroupMembers}
                setSelectedGroupMembers={setSelectedGroupMembers}
                handleRemoveGroupMember={handleRemoveGroupMember}
                groupSearchQuery={groupSearchQuery}
                setGroupSearchQuery={setGroupSearchQuery}
                groupSearchResults={groupSearchResults}
                handleSelectGroupMember={handleSelectGroupMember}
                handleCreateGroupSubmit={handleCreateGroupSubmit}
                isCreatingGroup={isCreatingGroup}
                themeTokens={t}
            />

            <AddMemberModal
                isAddMemberOpen={isAddMemberOpen}
                setIsAddMemberOpen={setIsAddMemberOpen}
                addMemberQuery={addMemberQuery}
                setAddMemberQuery={setAddMemberQuery}
                addMemberResults={addMemberResults}
                handleAddMemberToGroup={handleAddMemberToGroup}
                themeTokens={t}
            />

            <UserProfileModal
                viewingParticipantProfile={viewingParticipantProfile}
                setViewingParticipantProfile={setViewingParticipantProfile}
                user={user}
                handleStartConversation={handleStartConversation}
                themeTokens={t}
            />

            {/* Participant Right-Click Context Menu */}
            <ParticipantContextMenu
                participantContextMenu={participantContextMenu}
                setParticipantContextMenu={setParticipantContextMenu}
                user={user}
                activeConv={activeConv}
                handleStartConversation={handleStartConversation}
                isUserGroupAdmin={isUserGroupAdmin}
                groupAdminsMap={groupAdminsMap}
                handleMakeAdmin={handleMakeAdmin}
                setViewingParticipantProfile={setViewingParticipantProfile}
                theme={theme}
                themeTokens={t}
            />

            {/* Pin Scope Choice Modal */}
            {pinScopePromptMsg && (
                <div style={{
                    position: "fixed",
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: "rgba(0, 0, 0, 0.6)",
                    backdropFilter: "blur(4px)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 9999
                }} onClick={() => { setPinScopePromptMsg(null); setPinNotifyStep(false); }}>
                    <div style={{
                        background: t.cardBg,
                        border: t.border,
                        borderRadius: 16,
                        padding: 24,
                        maxWidth: 360,
                        width: "90%",
                        boxShadow: "0 20px 40px rgba(0,0,0,0.4)"
                    }} onClick={(e) => e.stopPropagation()}>
                        {!pinNotifyStep ? (
                            <>
                                <h3 style={{ margin: "0 0 8px", fontSize: 18, color: t.text, fontWeight: 700 }}>Pin Message</h3>
                                <p style={{ margin: "0 0 20px", fontSize: 13, color: t.textMuted, lineHeight: 1.4 }}>
                                    Choose how you want to pin this message in this chat:
                                </p>

                                <button
                                    style={{
                                        width: "100%",
                                        padding: "14px 16px",
                                        background: t.inputBg || t.bg,
                                        border: t.border,
                                        borderRadius: 12,
                                        color: t.text,
                                        cursor: "pointer",
                                        textAlign: "left",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 12,
                                        marginBottom: 10
                                    }}
                                    onClick={() => executePin(pinScopePromptMsg, "personal", false)}
                                >
                                    <span style={{ fontSize: 20 }}>👤</span>
                                    <div>
                                        <div style={{ fontSize: 14, fontWeight: 600 }}>Pin for me</div>
                                        <div style={{ fontSize: 12, color: t.textMuted }}>Only visible to you</div>
                                    </div>
                                </button>

                                {isAdmin && (
                                    <button
                                        style={{
                                            width: "100%",
                                            padding: "14px 16px",
                                            background: t.inputBg || t.bg,
                                            border: t.border,
                                            borderRadius: 12,
                                            color: t.text,
                                            cursor: "pointer",
                                            textAlign: "left",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 12,
                                            marginBottom: 16
                                        }}
                                        onClick={() => {
                                            if (isGroup) {
                                                setPinNotifyStep(true);
                                            } else {
                                                executePin(pinScopePromptMsg, "shared", true);
                                            }
                                        }}
                                    >
                                        <span style={{ fontSize: 20 }}>👥</span>
                                        <div>
                                            <div style={{ fontSize: 14, fontWeight: 600 }}>
                                                {isGroup ? "Pin for everyone" : "Pin for both of us"}
                                            </div>
                                            <div style={{ fontSize: 12, color: t.textMuted }}>Visible to everyone in chat</div>
                                        </div>
                                    </button>
                                )}

                                <button
                                    style={{
                                        width: "100%",
                                        padding: "10px",
                                        background: "none",
                                        border: "none",
                                        color: t.textMuted,
                                        cursor: "pointer",
                                        fontSize: 14,
                                        fontWeight: 500
                                    }}
                                    onClick={() => { setPinScopePromptMsg(null); setPinNotifyStep(false); }}
                                >
                                    Cancel
                                </button>
                            </>
                        ) : (
                            <>
                                <h3 style={{ margin: "0 0 8px", fontSize: 18, color: t.text, fontWeight: 700 }}>Notify Members?</h3>
                                <p style={{ margin: "0 0 20px", fontSize: 13, color: t.textMuted, lineHeight: 1.4 }}>
                                    Choose whether to notify all group members about this pin.
                                </p>

                                <button
                                    style={{
                                        width: "100%",
                                        padding: "14px 16px",
                                        background: t.inputBg || t.bg,
                                        border: t.border,
                                        borderRadius: 12,
                                        color: t.text,
                                        cursor: "pointer",
                                        textAlign: "left",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 12,
                                        marginBottom: 10
                                    }}
                                    onClick={() => executePin(pinScopePromptMsg, "shared", true)}
                                >
                                    <span style={{ fontSize: 20 }}>🔔</span>
                                    <div>
                                        <div style={{ fontSize: 14, fontWeight: 600 }}>Notify members</div>
                                        <div style={{ fontSize: 12, color: t.textMuted }}>Send notification to all group members</div>
                                    </div>
                                </button>

                                <button
                                    style={{
                                        width: "100%",
                                        padding: "14px 16px",
                                        background: t.inputBg || t.bg,
                                        border: t.border,
                                        borderRadius: 12,
                                        color: t.text,
                                        cursor: "pointer",
                                        textAlign: "left",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 12,
                                        marginBottom: 16
                                    }}
                                    onClick={() => executePin(pinScopePromptMsg, "shared", false)}
                                >
                                    <span style={{ fontSize: 20 }}>🔕</span>
                                    <div>
                                        <div style={{ fontSize: 14, fontWeight: 600 }}>Silent pin</div>
                                        <div style={{ fontSize: 12, color: t.textMuted }}>Pin without sending a notification</div>
                                    </div>
                                </button>

                                <button
                                    style={{
                                        width: "100%",
                                        padding: "10px",
                                        background: "none",
                                        border: "none",
                                        color: t.textMuted,
                                        cursor: "pointer",
                                        fontSize: 14,
                                        fontWeight: 500
                                    }}
                                    onClick={() => setPinNotifyStep(false)}
                                >
                                    Back
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
