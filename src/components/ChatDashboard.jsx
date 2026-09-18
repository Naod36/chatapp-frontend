import { validateUploadSize } from "../utils/uploadLimits.js";
import { useConversationDrafts } from "../hooks/useConversationDrafts.js";
import { useOutbox } from "../hooks/useOutbox.js";
import useConversationOrganization from "../hooks/useConversationOrganization.js";
import useMessageSearch from "../hooks/useMessageSearch.js";
import useGroupManagement from "../hooks/useGroupManagement.js";
import useOlderMessages from "../hooks/useOlderMessages.js";
import NotificationSettings from "./settings/NotificationSettings.jsx";
import { normalizeMutes, isMutedUntil, isConversationMuted, notificationContent } from "../utils/notificationPreferences.js";
import { mergeOutbox } from "../utils/outbox.js";
import { useEffect, useRef, useState } from "react";
import { userService } from "../services/user";
import { conversationService } from "../services/conversations";
import { websocketService } from "../services/websocket";
import { API_BASE } from "../services/api";
import { THEME } from "../utils/theme";
import useBlockState from "../hooks/useBlockState";
import { trackMessageArrivals } from "../utils/messageArrivals.js";
import { createMessageActionTracker } from "../utils/messageActions.js";
import {
  confirmOutgoingMessage,
  failOutgoingMessage,
  isConfirmedMessage,
} from "../utils/outgoingMessages.js";
import {
  blockPolicy,
  directBlockPolicy,
  maskConversation,
  maskMessage,
  maskParticipant,
  participantId,
  visibleTypingUsers,
  UNAVAILABLE_NAME,
} from "../utils/blocking.js";

// Modular Component Imports
import NavigationRail from "./chat/Sidebar/NavigationRail";
import ConversationList from "./chat/Sidebar/ConversationList";
import ConversationInspector from "./chat/Sidebar/ConversationInspector";
import ImageLightbox from "./chat/ImageLightbox";
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
  const strokeColor =
    status === "read"
      ? "#6366f1"
      : isSidebar
        ? "rgba(120, 120, 120, 0.6)"
        : "rgba(180, 180, 180, 0.5)";

  if (status === "read" || status === "delivered") {
    return (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke={strokeColor}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          display: "inline-block",
          verticalAlign: "middle",
          flexShrink: 0,
          marginLeft: isSidebar ? 0 : 4,
        }}
      >
        <path d="M18 5L7 16l-5-5" />
        <path d="M22 5l-11 11-3-3" />
      </svg>
    );
  }
  if (status === "sent") {
    return (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke={strokeColor}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          display: "inline-block",
          verticalAlign: "middle",
          flexShrink: 0,
          marginLeft: isSidebar ? 0 : 4,
        }}
      >
        <path d="M20 6L9 17l-5-5" />
      </svg>
    );
  }
  // Pending / Clock
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke={strokeColor}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        display: "inline-block",
        verticalAlign: "middle",
        flexShrink: 0,
        marginLeft: isSidebar ? 0 : 4,
      }}
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
};

const getAssetUrl = (url) => {
  if (!url) return "";
  if (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("data:")
  )
    return url;
  return `${API_BASE}${url}`;
};

export default function ChatDashboard({ user, onLogout }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("theme_preference");
    if (saved) return saved;
    const systemPrefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    return systemPrefersDark ? "dark" : "light";
  });
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [membershipRevision, setMembershipRevision] = useState(0);
  const groupManagement = useGroupManagement(async (conversationId, change) => {
    handleGroupMembershipEvent({
      conversation_id: conversationId,
      event: change.action === "leave" ? "group_member_removed" : "group_members_changed",
      target_user_id: change.action === "leave" ? user.userId : change.target_user_id,
    });
  });
  const [messages, setMessages] = useState([]);
  const [editText, setEditText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFilters, setSearchFilters] = useState({
    sender: "",
    from: "",
    to: "",
  });
  const [historyTarget, setHistoryTarget] = useState(null);
  const [imageViewer, setImageViewer] = useState(null);
  const historyTargetRef = useRef(null);
  useEffect(() => {
    setImageViewer(null);
  }, [activeConv?.id, user.token]);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [connectionAttempt, setConnectionAttempt] = useState(0);
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
  const [conversationError, setConversationError] = useState(null);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const conversationRequestRef = useRef(0);
  const conversationFlightRef = useRef(null);
  const historyRequestRef = useRef(0);
  const [historyState, setHistoryState] = useState({
    loading: false,
    error: null,
  });
  const [searchError, setSearchError] = useState(null);
  const [searchAttempt, setSearchAttempt] = useState(0);
  const errorToastTimeoutRef = useRef(null);

  const showError = (msg) => {
    setErrorToast(msg);
    if (errorToastTimeoutRef.current)
      clearTimeout(errorToastTimeoutRef.current);
    errorToastTimeoutRef.current = setTimeout(() => {
      setErrorToast(null);
    }, 5000);
  };

  useEffect(() => {
    return () => {
      if (errorToastTimeoutRef.current)
        clearTimeout(errorToastTimeoutRef.current);
    };
  }, []);

  // UI redesign states
  const [activeRailTab, setActiveRailTab] = useState("chats"); // "chats" | "profile" | "settings"
  const [convoTab, setConvoTab] = useState("all"); // "all" | "groups"
  const organization = useConversationOrganization(user.token);
  const [showInspector, setShowInspector] = useState(false);
  const [compactChatOpen, setCompactChatOpen] = useState(false);
  const [compactNavigationOpen, setCompactNavigationOpen] = useState(false);
  useEffect(() => {
    setCompactChatOpen(Boolean(activeConv?.id));
    setCompactNavigationOpen(false);
    setShowInspector(false);
  }, [activeConv?.id]);
  const [myProfile, setMyProfile] = useState({
    display_name: user?.username || "",
    bio: "",
    avatar_url: "",
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({
    percentage: 0,
    loadedFormatted: "0 MB",
    totalFormatted: "0 MB",
  });
  const batchCancelRef = useRef(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const { drafts, setDraft, captureDraft, moveDraft } = useConversationDrafts(
    String(user.userId),
    showError,
  );
  const sendingMessageRef = useRef(false);
  const outbox = useOutbox(String(user.userId), showError);
  const pendingSendIdsRef = useRef(new Set());
  const messageText = editingMessage ? editText : drafts[activeConv?.id] || "";
  const setMessageText = (value) => {
    if (editingMessage) setEditText(value);
    else setDraft(activeConv?.id, value);
  };
  useEffect(() => {
    setEditingMessage(null);
    setReplyingTo(null);
    setEditText("");
    setSelectedFile(null);
    setFilePreview((preview) => {
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
      return null;
    });
    setContextMenu(null);
    setShowEmojiPicker(false);
  }, [activeConv?.id, user.userId]);
  const [pendingMessageAction, setPendingMessageAction] = useState(null);
  const actionTrackerRef = useRef(null);
  const actionCallbacksRef = useRef(null);
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
  const [muteUntil, setMuteUntil] = useState(() => {
    try {
      const saved = localStorage.getItem("muted_conversations");
      return normalizeMutes(saved ? JSON.parse(saved) : {});
    } catch (e) {
      return {};
    }
  });
  const [notificationClock, setNotificationClock] = useState(Date.now);
  const [muteScopes, setMuteScopes] = useState(() => {
    try { return normalizeMutes(JSON.parse(localStorage.getItem("notification_mute_scopes") || "{}")); }
    catch { return {}; }
  });
  const mutedConvIds = conversations.filter((conversation) => isConversationMuted(conversation.id, muteUntil, muteScopes, organization.folders, notificationClock)).map((conversation) => conversation.id);
  const setScopeMute = (scope, until) => {
    setNotificationClock(Date.now());
    setMuteScopes((previous) => {
      const next = { ...previous };
      if (until) next[scope] = until; else delete next[scope];
      localStorage.setItem("notification_mute_scopes", JSON.stringify(next));
      return next;
    });
  };
  const [hideNotificationPreviews, setHideNotificationPreviews] = useState(() => localStorage.getItem("hide_notification_previews") === "true");
  const setHidePreviews = (value) => {
    setHideNotificationPreviews(value);
    localStorage.setItem("hide_notification_previews", String(value));
  };
  useEffect(() => {
    const refresh = () => setNotificationClock(Date.now());
    const nextExpiry = Math.min(...[...Object.values(muteUntil), ...Object.values(muteScopes)].filter((until) => typeof until === "number" && until > Date.now()));
    const timer = Number.isFinite(nextExpiry) ? setTimeout(refresh, Math.min(2147483647, Math.max(1, nextExpiry - Date.now()))) : null;
    window.addEventListener("focus", refresh);
    return () => { clearTimeout(timer); window.removeEventListener("focus", refresh); };
  }, [muteUntil, muteScopes, notificationClock]);
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
  const {
    outgoing: blockedUserIds,
    incoming: blockedByUserIds,
    revision: blockRevision,
    ready: blockStateReady,
    stateRef: blockStateRef,
    refresh: refreshBlockState,
    acknowledgeOutgoing,
  } = useBlockState(user?.token);

  const messageSearch = useMessageSearch(
    searchQuery,
    searchFilters,
    user.token,
    `${blockRevision}:${membershipRevision}`,
  );

  const isBlocked = (userId) => blockedUserIds.includes(String(userId));
  const isBlockedBy = (userId) => blockedByUserIds.includes(String(userId));
  const activeBlockPolicy = directBlockPolicy(
    activeConv,
    blockedUserIds,
    blockedByUserIds,
  );
  const directReadOnly = !activeBlockPolicy.canInteract;
  const activeConvForDisplay = maskConversation(activeConv, blockedByUserIds);
  const conversationsForDisplay = conversations.map((conversation) =>
    maskConversation(conversation, blockedByUserIds),
  );
  const messagesForDisplay = mergeOutbox(
    messages,
    outbox.entries,
    activeConv?.id,
  ).map((message) =>
    maskMessage(message, blockedByUserIds, activeBlockPolicy.incoming),
  );
  useEffect(() => {
    const confirmed = new Set(
      messages
        .filter(isConfirmedMessage)
        .map((message) => message.message_id || message.id),
    );
    const reconciled = outbox.entries.filter(
      (entry) =>
        entry.conversation_id === activeConv?.id &&
        confirmed.has(entry.client_id),
    );
    if (!reconciled.length) return;
    const temporaryIds = new Set(reconciled.map((entry) => entry.id));
    for (const entry of reconciled) outbox.remove(entry.client_id);
    setMessages((previous) =>
      previous.filter((message) => !temporaryIds.has(message.id)),
    );
  }, [messages, outbox.entries, activeConv?.id]);
  const pinsForDisplay = Object.fromEntries(
    Object.entries(pinnedMessagesMap).map(([conversationId, pins]) => [
      conversationId,
      pins.map((pin) => maskMessage(pin, blockedByUserIds)),
    ]),
  );
  const typingForDisplay = visibleTypingUsers(typingUsers, blockedByUserIds);
  const canInteractWithConversation = (
    conversation = activeConvRef.current,
  ) => {
    const state = blockStateRef.current;
    return (
      state.ready &&
      directBlockPolicy(conversation, state.outgoing, state.incoming)
        .canInteract
    );
  };
  const canSendToConversation = (conversation) => {
    return Boolean(
      conversation &&
      activeConvRef.current?.id === conversation.id &&
      canInteractWithConversation(conversation),
    );
  };

  const handleBlockUser = async (userId) => {
    await userService.blockUser(userId);
    acknowledgeOutgoing(userId, true);
    await refreshBlockState();
  };

  const handleUnblockUser = async (userId) => {
    await userService.unblockUser(userId);
    acknowledgeOutgoing(userId, false);
    await refreshBlockState();
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        headerMenuRef.current &&
        !event.target.closest?.(".ht-choice-menu") &&
        !headerMenuRef.current.contains(event.target)
      ) {
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

  const [rawViewingParticipantProfile, setViewingParticipantProfile] =
    useState(null);
  const viewingParticipantProfile = maskParticipant(
    rawViewingParticipantProfile,
    blockedByUserIds,
  );
  const [isRailExpanded, setIsRailExpanded] = useState(() => {
    const saved = localStorage.getItem("chat_rail_expanded");
    return saved !== null ? saved === "true" : true;
  });

  const toggleRailExpanded = () => {
    setIsRailExpanded((prev) => {
      const next = !prev;
      localStorage.setItem("chat_rail_expanded", String(next));
      return next;
    });
  };

  // Dynamic document title tab unread indicator
  useEffect(() => {
    const totalUnread = conversations.reduce((acc, c) => {
      const isMuted = Array.isArray(mutedConvIds)
        ? mutedConvIds.includes(c.id)
        : !!mutedConvIds?.[c.id];
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
    const isSaved =
      c.id === "virtual-saved-messages" ||
      (c.type === "direct" && !c.other_participant);
    if (isSaved) {
      return (
        pinnedConvIds.includes("virtual-saved-messages") ||
        pinnedConvIds.includes(c.id)
      );
    }
    return pinnedConvIds.includes(c.id);
  };

  const togglePinConversation = (convId) => {
    setPinnedConvIds((prev) => {
      const isSaved =
        activeConv &&
        activeConv.id === convId &&
        (activeConv.id === "virtual-saved-messages" ||
          (activeConv.type === "direct" && !activeConv.other_participant));
      const currentlyPinned = isSaved
        ? prev.includes(convId) || prev.includes("virtual-saved-messages")
        : prev.includes(convId);
      let updated;
      if (currentlyPinned) {
        updated = prev.filter(
          (id) => id !== convId && id !== "virtual-saved-messages",
        );
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

  const setConversationMute = (convId, until) => {
    setNotificationClock(Date.now());
    setMuteUntil((prev) => {
      const updated = { ...prev };
      if (until) updated[convId] = until;
      else delete updated[convId];
      localStorage.setItem("muted_conversations", JSON.stringify(updated));
      return updated;
    });
  };
  const toggleMuteConversation = (convId) => setConversationMute(convId, isMutedUntil(muteUntil[convId]) ? false : true);

  // Group Admin state & Add Member states
  const groupAdminsMap = Object.fromEntries(conversations.map((conversation) => [
    conversation.id,
    (conversation.participants || []).filter((member) => member.role === "admin").map((member) => member.user_id || member.id),
  ]));

  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [addMemberQuery, setAddMemberQuery] = useState("");
  const [addMemberResults, setAddMemberResults] = useState([]);
  const [rawParticipantContextMenu, setParticipantContextMenu] = useState(null);
  const participantContextMenu = rawParticipantContextMenu
    ? {
        ...rawParticipantContextMenu,
        participant: maskParticipant(
          rawParticipantContextMenu.participant,
          blockedByUserIds,
        ),
      }
    : null;

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
      if (
        socketRef.current &&
        socketRef.current.readyState === WebSocket.OPEN
      ) {
        socketRef.current.send(
          JSON.stringify({
            action: "update_group",
            conversation_id: activeConv.id,
            title: updatedTitle,
            avatar_url: updatedAvatar,
          }),
        );
      }

      // 2. Update local state immediately
      setActiveConv((prev) =>
        prev
          ? {
              ...prev,
              title: updatedTitle,
              display_name: updatedTitle,
              avatar_url: updatedAvatar,
            }
          : null,
      );

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === activeConv.id) {
            return {
              ...c,
              title: updatedTitle,
              display_name: updatedTitle,
              avatar_url: updatedAvatar,
            };
          }
          return c;
        }),
      );

      // 3. REST API update call with fallback
      try {
        await conversationService.updateGroup(activeConv.id, {
          title: updatedTitle,
          avatar_url: updatedAvatar,
        });
      } catch (apiErr) {
        console.warn(
          "REST endpoint returned error, applied via WS/state fallback:",
          apiErr,
        );
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
      const res = await conversationService.uploadFile(
        file,
        (loaded, total, pct) => {
          setUploadProgress({
            loadedFormatted: (loaded / 1024 / 1024).toFixed(1) + " MB",
            totalFormatted: (total / 1024 / 1024).toFixed(1) + " MB",
            percentage: pct,
          });
        },
      );
      const uploadedUrl = res?.url || res?.media_url;
      if (uploadedUrl && activeConv) {
        setEditGroupAvatarUrl(uploadedUrl);

        // 1. Send WebSocket update action for instant real-time sync across connected clients
        if (
          socketRef.current &&
          socketRef.current.readyState === WebSocket.OPEN
        ) {
          socketRef.current.send(
            JSON.stringify({
              action: "update_group",
              conversation_id: activeConv.id,
              title:
                editGroupTitle.trim() ||
                activeConv.title ||
                activeConv.display_name,
              avatar_url: uploadedUrl,
            }),
          );
        }

        // 2. Update local state immediately
        setActiveConv((prev) =>
          prev
            ? {
                ...prev,
                avatar_url: uploadedUrl,
              }
            : null,
        );

        setConversations((prev) =>
          prev.map((c) => {
            if (c.id === activeConv.id) {
              return {
                ...c,
                avatar_url: uploadedUrl,
              };
            }
            return c;
          }),
        );

        // 3. REST API update call with fallback
        try {
          await conversationService.updateGroup(activeConv.id, {
            title:
              editGroupTitle.trim() ||
              activeConv.title ||
              activeConv.display_name,
            avatar_url: uploadedUrl,
          });
        } catch (apiErr) {
          console.warn(
            "REST endpoint error on avatar upload, fallback via WS/state:",
            apiErr,
          );
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
        const railWidth =
          document.querySelector(".ht-rail")?.getBoundingClientRect().width ||
          72;
        const newWidth = Math.min(Math.max(e.clientX - railWidth, 220), 550);
        setLeftSidebarWidth(newWidth);
        localStorage.setItem("chat_left_sidebar_width", String(newWidth));
      } else if (isResizingRight) {
        const newWidth = Math.min(
          Math.max(window.innerWidth - e.clientX, 220),
          550,
        );
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
    const participant = (conv.participants || []).find(
      (p) => (p.user_id || p.id) === userId,
    );
    if (
      participant &&
      (participant.role === "admin" || participant.role === "creator")
    )
      return true;
    return false;
  };

  const handleMakeAdmin = async (convId, memberId, isAdmin = true) => {
    setIsGroupInfoOpen(true);
    await groupManagement.change(convId, { action: "set_admin", target_user_id: memberId, is_admin: isAdmin });
  };

  const handleAddMemberToGroup = async (newMember) => {
    if (!activeConv || activeConv.type !== "group") return;
    const memberId = newMember.user_id || newMember.id;
    if (await groupManagement.change(activeConv.id, { action: "add_member", target_user_id: memberId })) {
      setIsAddMemberOpen(false);
      setAddMemberQuery("");
    }
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
        const normalized = res.map((u) => ({
          ...u,
          id: u.id || u.user_id,
        }));
        const filtered = normalized.filter(
          (u) =>
            u.id !== currentUserId &&
            !selectedGroupMembers.some((sm) => (sm.id || sm.user_id) === u.id),
        );
        setGroupSearchResults(filtered);
      } catch (err) {
        console.error("Failed to search users for group:", err);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [groupSearchQuery, selectedGroupMembers, user, blockRevision]);

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
        const existingIds = new Set(
          currentParticipants.map((p) => p.user_id || p.id),
        );
        const currentUserId = user?.userId || user?.user_id;

        const filtered = res
          .map((u) => ({
            id: u.user_id || u.id,
            user_id: u.user_id || u.id,
            username: u.username,
            display_name: u.display_name || u.username,
            avatar_url: u.avatar_url,
          }))
          .filter((u) => u.id !== currentUserId && !existingIds.has(u.id));

        setAddMemberResults(filtered);
      } catch (err) {
        console.error("Failed to search members:", err);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [addMemberQuery, activeConv, user, blockRevision]);

  const handleSelectGroupMember = (u) => {
    const normalizedUser = { ...u, id: u.id || u.user_id };
    setSelectedGroupMembers((prev) => [...prev, normalizedUser]);
    setGroupSearchQuery("");
    setGroupSearchResults([]);
  };

  const handleRemoveGroupMember = (userId) => {
    setSelectedGroupMembers((prev) =>
      prev.filter((u) => (u.id || u.user_id) !== userId),
    );
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
      const participantIds = selectedGroupMembers.map((u) => u.id || u.user_id);
      const res = await conversationService.createGroup(
        groupTitle.trim(),
        participantIds,
      );
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
          last_message_time: new Date().toISOString(),
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
    const conversation = payload.conversation_id
      ? conversationsRef.current.find(
          (item) => String(item.id) === String(payload.conversation_id),
        ) || activeConvRef.current
      : activeConvRef.current;
    if (!canInteractWithConversation(conversation)) return false;
    try {
      if (
        socketRef.current &&
        socketRef.current.readyState === WebSocket.OPEN
      ) {
        socketRef.current.send(JSON.stringify(payload));
        return true;
      }
    } catch (e) {
      console.warn("WebSocket send error:", e);
    }
    return false;
  };

  const notificationPreferencesRef = useRef({ soundEnabled, mutedConvIds });
  actionCallbacksRef.current = {
    send: safeSendWs,
    settle: async (action, error) => {
      if (error) showError(error);
      if (activeConvRef.current?.id !== action.conversation_id) return;
      if (!error && action.action === "edit_message") {
        setEditingMessage((current) =>
          current?.id === action.message_id ? null : current,
        );
        setEditText((current) =>
          current.trim() === action.content ? "" : current,
        );
      }
      if (error) {
        const token = user.token;
        const revision = dataRevisionRef.current;
        const historyRequest = historyRequestRef.current;
        const [history, pins] = await Promise.allSettled([
          conversationService.getMessages(
            action.conversation_id,
            historyTargetRef.current,
          ),
          conversationService.getPinnedMessages(action.conversation_id),
        ]);
        if (
          blockStateRef.current.token !== token ||
          historyRequest !== historyRequestRef.current ||
          revision !== dataRevisionRef.current ||
          activeConvRef.current?.id !== action.conversation_id
        )
          return;
        if (history.status === "fulfilled")
          setMessages((previous) => [
            ...history.value.map((message) => ({
              ...message,
              id: message.message_id || message.id,
            })),
            ...previous.filter((message) => !isConfirmedMessage(message)),
          ]);
        if (pins.status === "fulfilled")
          setPinnedMessagesMap((previous) => ({
            ...previous,
            [action.conversation_id]: pins.value,
          }));
        if (history.status === "rejected" || pins.status === "rejected") {
          showError(
            "Could not refresh the action result. Reopen this conversation before retrying.",
          );
        }
      }
    },
  };
  if (!actionTrackerRef.current) {
    actionTrackerRef.current = createMessageActionTracker({
      userId: user.userId,
      send: (action) => actionCallbacksRef.current.send(action),
      onChange: setPendingMessageAction,
      onSettle: (action, error) =>
        actionCallbacksRef.current.settle(action, error),
    });
  }
  useEffect(() => () => actionTrackerRef.current?.dispose(), []);
  const sendMessageAction = (payload) => {
    const error = actionTrackerRef.current.start(payload);
    if (error) showError(error);
    return !error;
  };

  notificationPreferencesRef.current = { soundEnabled, muteUntil, muteScopes, folders: organization.folders, hideNotificationPreviews };

  const isNotificationMuted = (conversationId) => {
    const preferences = notificationPreferencesRef.current;
    return isConversationMuted(conversationId, preferences.muteUntil, preferences.muteScopes, preferences.folders);
  };

  const playNotificationSound = (targetConvId) => {
    if (!notificationPreferencesRef.current.soundEnabled) return;
    if (isNotificationMuted(targetConvId)) return;
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
      osc2.frequency.setValueAtTime(880.0, ctx.currentTime + 0.08);

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
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem("chat_sound_enabled", String(next));
      return next;
    });
  };

  // Scroll-to-bottom and unread pill state
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const [newMessagesBelowCount, setNewMessagesBelowCount] = useState(0);
  const chatContainerRef = useRef(null);
  const followLatestRef = useRef(true);
  const renderedMessageIdsRef = useRef(new Set());
  const unseenMessageIdsRef = useRef(new Set());

  const socketRef = useRef(null);
  const messageEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const activeConvRef = useRef(activeConv);
  const conversationsRef = useRef(conversations);
  const dataRevisionRef = useRef(0);
  const inputTextareaRef = useRef(null);
  const loadedConversationRef = useRef(null);
  const compactVisibilityRef = useRef(null);
  compactVisibilityRef.current = {
    compactChatOpen,
    compactNavigationOpen,
    showInspector,
  };

  const isConversationVisible = (conversationId) => {
    if (historyTargetRef.current) return false;
    if (
      document.hidden ||
      String(activeConvRef.current?.id) !== String(conversationId)
    )
      return false;
    if (loadedConversationRef.current !== conversationId) return false;
    if (window.matchMedia("(max-width: 1100px)").matches) {
      const view = compactVisibilityRef.current;
      if (
        !view.compactChatOpen ||
        view.compactNavigationOpen ||
        view.showInspector
      )
        return false;
    }
    const container = chatContainerRef.current;
    return Boolean(
      container &&
      container.scrollHeight - container.scrollTop - container.clientHeight <=
        120,
    );
  };

  const markVisibleConversationRead = (conversationId) => {
    if (!conversationId || !isConversationVisible(conversationId)) return false;
    if (
      !safeSendWs({
        action: "read_conversation",
        conversation_id: conversationId,
      })
    )
      return false;
    setConversations((previous) =>
      previous.map((conversation) =>
        conversation.id === conversationId && conversation.unread_count
          ? { ...conversation, unread_count: 0 }
          : conversation,
      ),
    );
    return true;
  };
  const markVisibleReadRef = useRef(null);
  markVisibleReadRef.current = () =>
    markVisibleConversationRead(activeConvRef.current?.id);

  useEffect(() => {
    const refreshReadState = () => markVisibleReadRef.current();
    document.addEventListener("visibilitychange", refreshReadState);
    window.addEventListener("focus", refreshReadState);
    window.addEventListener("resize", refreshReadState);
    return () => {
      document.removeEventListener("visibilitychange", refreshReadState);
      window.removeEventListener("focus", refreshReadState);
      window.removeEventListener("resize", refreshReadState);
    };
  }, []);

  useEffect(() => {
    markVisibleReadRef.current();
  }, [
    compactChatOpen,
    compactNavigationOpen,
    showInspector,
    wsConnected,
    blockStateReady,
  ]);

  activeConvRef.current = activeConv;
  conversationsRef.current = conversations;

  useEffect(() => {
    if (!directReadOnly && blockRevision === 0) return;
    setContextMenu(null);
    setReplyingTo(null);
    setEditingMessage(null);
    setPinScopePromptMsg(null);
    setSelectedFile(null);
    setFilePreview((preview) => {
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
    setEditText("");
    setShowEmojiPicker(false);
    clearTimeout(typingTimeoutRef.current);
    const recorder = mediaRecorderRef.current;
    if (recorder) {
      recorder.onstop = null;
      if (recorder.state === "recording") recorder.stop();
    }
    audioStreamRef.current?.getTracks().forEach((track) => track.stop());
    clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setRecordingSeconds(0);
    audioChunksRef.current = [];
  }, [directReadOnly, blockRevision, activeConv?.id]);

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
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target)
      ) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const t = THEME[theme];
  const olderRevision = dataRevisionRef.current;
  const olderHistoryRequest = historyRequestRef.current;
  const olderMessages = useOlderMessages({
    conversationId: activeConv?.id,
    revision: `${olderRevision}:${olderHistoryRequest}`,
    messages,
    containerRef: chatContainerRef,
    enabled: Boolean(activeConv && activeConv.id !== "virtual-saved-messages" && loadedConversationRef.current === activeConv.id && !historyState.loading && !historyState.error),
    isCurrent: () => dataRevisionRef.current === olderRevision && historyRequestRef.current === olderHistoryRequest,
    onPrepend: (older) => {
      if (!older.length) return;
      followLatestRef.current = false;
      older.forEach((message) => renderedMessageIdsRef.current.add(message.id));
      setMessages((previous) => {
        const existing = new Set(previous.map((message) => message.id || message.message_id));
        return [...older.filter((message) => !existing.has(message.id)), ...previous];
      });
    },
  });

  const scrollToBottom = (smooth = true) => {
    followLatestRef.current = true;
    unseenMessageIdsRef.current = new Set();
    messageEndRef.current?.scrollIntoView({
      behavior: smooth ? "smooth" : "auto",
    });
    setNewMessagesBelowCount(0);
    setShowScrollBottomBtn(false);
  };

  // Scroll listener on chat thread container
  const handleChatScroll = () => {
    const container = chatContainerRef.current;
    if (!container) return;
    if (container.scrollTop < 80 && !olderMessages.loading && !olderMessages.error) olderMessages.load();
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    followLatestRef.current =
      !historyTargetRef.current && distanceFromBottom <= 120;
    if (distanceFromBottom > 120) {
      setShowScrollBottomBtn(true);
    } else {
      setShowScrollBottomBtn(false);
      unseenMessageIdsRef.current = new Set();
      setNewMessagesBelowCount(0);
      markVisibleReadRef.current();
    }
  };

  // Auto-scroll when messages change or new active conversation selected
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    const arrivals = trackMessageArrivals(
      messages,
      renderedMessageIdsRef.current,
      unseenMessageIdsRef.current,
      user.userId,
      followLatestRef.current,
    );
    const previousMessageCount = renderedMessageIdsRef.current.size;
    renderedMessageIdsRef.current = arrivals.currentIds;
    unseenMessageIdsRef.current = arrivals.unseenIds;
    if (
      followLatestRef.current &&
      (arrivals.hasArrivals ||
        (messages.length > 0 && previousMessageCount === 0))
    ) {
      scrollToBottom(true);
    } else {
      setNewMessagesBelowCount(arrivals.unseenIds.size);
    }
  }, [messages, user.userId]);

  // Load initial conversations list
  useEffect(() => {
    if (!historyTarget || historyState.loading || historyState.error) return;
    const target = document.getElementById(`msg-${historyTarget}`);
    target?.scrollIntoView({ block: "center", behavior: "auto" });
    target?.classList.add("ht-search-highlight");
    return () => target?.classList.remove("ht-search-highlight");
  }, [historyTarget, historyState.loading, historyState.error]);

  const loadConversations = async () => {
    const revision = dataRevisionRef.current;
    const currentFlight = conversationFlightRef.current;
    if (currentFlight?.revision === revision) {
      await currentFlight.done;
      return;
    }
    let complete;
    const flight = { revision, done: new Promise((resolve) => { complete = resolve; }) };
    conversationFlightRef.current = flight;
    const request = ++conversationRequestRef.current;
    setConversationsLoading(true);
    try {
      const rawList = await conversationService.listConversations();
      if (
        revision !== dataRevisionRef.current ||
        request !== conversationRequestRef.current
      )
        return;
      setConversationError(null);
      const normalized = rawList.map((c) => {
        const isGroup = c.type === "group";
        const other = c.other_participant;
        return {
          id: c.conversation_id,
          type: c.type,
          title: c.title,
          creator_id: c.creator_id,
          participants: c.participants || [],
          display_name: isGroup
            ? c.title || "Group Chat"
            : other
              ? other.display_name || other.username
              : "Saved Messages",
          avatar_url: isGroup ? c.avatar_url : other ? other.avatar_url : null,
          last_message_content: c.last_message?.content || "",
          last_message_time: c.last_message?.created_at || null,
          other_participant: other,
          status: other?.status || c.status,
          last_message: c.last_message,
          unread_count: c.unread_count || 0,
        };
      });

      let selfConv = normalized.find(
        (c) => c.type === "direct" && !c.other_participant,
      );
      const others = normalized.filter(
        (c) => c.type === "group" || c.other_participant,
      );

      if (!selfConv) {
        selfConv = {
          id: "virtual-saved-messages",
          type: "direct",
          display_name: "Saved Messages",
          avatar_url: null,
          last_message_content: "Personal cloud inbox...",
          last_message_time: null,
          other_participant: null,
        };
      }

      const sortedOthers = others.sort((a, b) => {
        const aTime = a.last_message_time
          ? new Date(a.last_message_time).getTime()
          : 0;
        const bTime = b.last_message_time
          ? new Date(b.last_message_time).getTime()
          : 0;
        return bTime - aTime;
      });

      const map = {};
      rawList.forEach((c) => {
        if (c.pinned_message_id) {
          map[c.conversation_id] = c.pinned_message_id;
        }
      });
      setPinnedMessageIdMap(map);

      const fullList = [selfConv, ...sortedOthers].filter(Boolean);
      conversationsRef.current = fullList;
      setConversations(fullList);

      if (activeConvRef.current) {
        const freshActive = fullList.find(
          (c) => c.id === activeConvRef.current.id,
        );
        if (freshActive) {
          setActiveConv((prev) => {
            if (!prev) return freshActive;
            return freshActive;
          });
        } else if (activeConvRef.current.type === "group") {
          revokeGroupAccess(activeConvRef.current.id);
        }
      }
    } catch (err) {
      console.error("Failed to load conversations:", err);
      if (
        revision === dataRevisionRef.current &&
        request === conversationRequestRef.current
      ) {
        setConversationError("Could not load conversations.");
      }
    } finally {
      complete();
      if (conversationFlightRef.current === flight) conversationFlightRef.current = null;
      if (request === conversationRequestRef.current)
        setConversationsLoading(false);
    }
  };

  const revokeGroupAccess = (conversationId) => {
    dataRevisionRef.current += 1;
    historyRequestRef.current += 1;
    conversationRequestRef.current += 1;
    setConversations((previous) => previous.filter((conversation) => conversation.id !== conversationId));
    setPinnedMessagesMap((previous) => {
      const next = { ...previous };
      delete next[conversationId];
      return next;
    });
    setMembershipRevision((previous) => previous + 1);
    if (activeConvRef.current?.id !== conversationId) return;
    activeConvRef.current = null;
    loadedConversationRef.current = null;
    historyTargetRef.current = null;
    setActiveConv(null);
    setMessages([]);
    setHistoryTarget(null);
    setHistoryState({ loading: false, error: null });
    setImageViewer(null);
    setReplyingTo(null);
    setContextMenu(null);
    setParticipantContextMenu(null);
    setViewingParticipantProfile(null);
    setIsGroupInfoOpen(false);
    setIsAddMemberOpen(false);
    setCompactChatOpen(false);
    setErrorToast("You no longer have access to this group.");
  };

  const handleGroupMembershipEvent = (event) => {
    if (event.event === "group_member_removed" && event.target_user_id === user.userId) {
      revokeGroupAccess(event.conversation_id);
    } else {
      dataRevisionRef.current += 1;
      historyRequestRef.current += 1;
      setMembershipRevision((previous) => previous + 1);
    }
  };

  useEffect(() => {
    if (!blockStateReady) return;
    dataRevisionRef.current += 1;
    const revision = dataRevisionRef.current;
    let disposed = false;
    const refreshData = async () => {
      await loadConversations();
      if (disposed || revision !== dataRevisionRef.current) return;
      const conversation = activeConvRef.current;
      setPinnedMessagesMap({});
      if (!conversation || conversation.id === "virtual-saved-messages") return;
      const request = ++historyRequestRef.current;
      setHistoryState({ loading: true, error: null });
      const [history, pins] = await Promise.allSettled([
        conversationService.getMessages(
          conversation.id,
          historyTargetRef.current,
        ),
        conversationService.getPinnedMessages(conversation.id),
      ]);
      if (
        disposed ||
        request !== historyRequestRef.current ||
        revision !== dataRevisionRef.current ||
        activeConvRef.current?.id !== conversation.id
      )
        return;
      if (history.status === "fulfilled") {
        loadedConversationRef.current = conversation.id;
        setHistoryState({ loading: false, error: null });
        setMessages(
          (history.value || []).map((message) => ({
            ...message,
            id: message.message_id || message.id,
          })),
        );
      } else {
        setHistoryState({ loading: false, error: "Could not load messages." });
      }
      if (pins.status === "fulfilled") {
        setPinnedMessagesMap({ [conversation.id]: pins.value || [] });
      }
    };
    refreshData();
    setViewingParticipantProfile(null);
    setParticipantContextMenu(null);
    setTypingUsers({});
    return () => {
      disposed = true;
    };
  }, [blockRevision, blockStateReady, membershipRevision]);

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
      const revision = dataRevisionRef.current;
      const historyRequest = historyRequestRef.current;
      if (historyTargetRef.current) return;
      if (!conv || !conv.id || conv.id === "virtual-saved-messages") return;
      try {
        const history = await conversationService.getMessages(conv.id);
        if (
          revision !== dataRevisionRef.current ||
          historyRequest !== historyRequestRef.current ||
          activeConvRef.current?.id !== conv.id
        )
          return;
        if (!history || !history.length) return;
        const incoming = history.map((m) => ({
          ...m,
          id: m.message_id || m.id,
        }));
        setMessages((prev) => {
          const existingIds = new Set(
            prev.map((m) => String(m.id || m.message_id).toLowerCase()),
          );
          const newOnes = incoming.filter(
            (m) => !existingIds.has(String(m.id || m.message_id).toLowerCase()),
          );

          if (newOnes.length > 0) {
            return [...prev, ...newOnes];
          }

          // Sync updated message statuses (e.g. sent -> delivered -> read) from server
          if (prev.length === incoming.length) {
            let hasChanged = false;
            for (let i = 0; i < prev.length; i++) {
              if (prev[i].status !== incoming[i].status) {
                hasChanged = true;
                break;
              }
            }
            if (hasChanged) return incoming;
          } else if (incoming.length > prev.length) {
            return incoming;
          }

          return prev;
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

  }, []);

  // Set up WebSocket connection with raw socket listener
  useEffect(() => {
    if (!user.token) return;
    let disposed = false;
    let reconnectTimer;

    const socket = websocketService.connect(
      user.token,
      // onMessage callback
      (data) => {
        if (data.event === "error") {
          actionTrackerRef.current.fail(
            data.message || "The server rejected the action.",
          );
          showError(data.message || "The server rejected the action.");
          return;
        }
        actionTrackerRef.current.receive(data);
        if (data.event === "block_state_changed") {
          refreshBlockState();
          return;
        }
        const incoming = blockStateRef.current.incoming;
        if (
          incoming.includes(String(data.user_id)) &&
          [
            "typing_status",
            "user_status",
            "user_status_changed",
            "read_update",
            "message_delivered",
          ].includes(data.event || data.action || data.type)
        )
          return;
        const eventConversation = conversationsRef.current.find(
          (conversation) =>
            String(conversation.id) === String(data.conversation_id),
        );
        if (
          ["read_update", "message_delivered"].includes(data.event) &&
          directBlockPolicy(eventConversation, [], incoming).incoming
        )
          return;
        if (data.event === "new_message") data = maskMessage(data, incoming);
        if (data.event === "new_message") {
          const isCurrentActive =
            activeConvRef.current &&
            String(activeConvRef.current.id).toLowerCase() ===
              String(data.conversation_id).toLowerCase();

          if (
            data.sender_id !== user.userId &&
            blockStateRef.current.ready &&
            !isNotificationMuted(data.conversation_id)
          ) {
            playNotificationSound(data.conversation_id);
            if (
              "Notification" in window &&
              Notification.permission === "granted" &&
              (document.hidden || !isCurrentActive)
            ) {
              try {
                const { title, ...content } = notificationContent(data, notificationPreferencesRef.current.hideNotificationPreviews);
                const notif = new Notification(title, {
                  ...content,
                  tag: data.conversation_id,
                });
                notif.onclick = async () => {
                  if (disposed) return;
                  window.focus();
                  notif.close();
                  await openNotificationConversationRef.current(data.conversation_id);
                };
              } catch (e) {}
            }
          }

          // Update conversation list item in real-time & move to top
          setConversations((prev) => {
            const targetIndex = prev.findIndex(
              (c) =>
                String(c.id).toLowerCase() ===
                String(data.conversation_id).toLowerCase(),
            );
            let updatedTarget = null;

            if (targetIndex !== -1) {
              const existing = prev[targetIndex];
              const snippet =
                data.message_type === "image"
                  ? "📷 Image"
                  : data.message_type === "audio"
                    ? "🎙️ Voice message"
                    : data.message_type === "file"
                      ? "📁 File"
                      : data.content;
              updatedTarget = {
                ...existing,
                last_message_content: snippet,
                last_message_time: data.created_at,
                last_message: {
                  message_id: data.message_id,
                  sender_id: data.sender_id,
                  content: snippet,
                  status: "delivered",
                },
                unread_count:
                  data.sender_id === user.userId
                    ? existing.unread_count || 0
                    : (existing.unread_count || 0) + 1,
              };
            }

            if (!updatedTarget) return prev;

            // Separate Saved Messages from other conversations safely
            const rest = prev.filter(
              (c) =>
                String(c.id).toLowerCase() !==
                String(data.conversation_id).toLowerCase(),
            );
            const savedConv = rest.find(
              (c) =>
                c.id === "virtual-saved-messages" ||
                (c.type === "direct" && !c.other_participant),
            );
            const remaining = rest.filter((c) => c !== savedConv);

            if (
              updatedTarget.id === "virtual-saved-messages" ||
              (updatedTarget.type === "direct" &&
                !updatedTarget.other_participant)
            ) {
              return [updatedTarget, ...remaining];
            } else if (savedConv) {
              return [savedConv, updatedTarget, ...remaining];
            } else {
              return [updatedTarget, ...remaining];
            }
          });

          // If incoming message belongs to our selected thread, push to chat bubble list with deduplication
          if (isCurrentActive && !historyTargetRef.current) {
            setMessages((prev) => {
              // Don't add if message with exact ID is already in list
              if (
                prev.some(
                  (m) =>
                    String(m.id || m.message_id).toLowerCase() ===
                    String(data.message_id).toLowerCase(),
                )
              )
                return prev;

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
                  reactions: data.reactions || {},
                },
              ];
            });
            // Mark conversation as read via WebSocket
            markVisibleConversationRead(data.conversation_id);
          }
        } else if (data.event === "typing_status") {
          setTypingUsers((prev) => ({
            ...prev,
            [data.conversation_id]: {
              ...(prev[data.conversation_id] || {}),
              [data.user_id]: data.is_typing,
            },
          }));
        } else if (data.event === "message_sent") {
          return;
        } else if (data.event === "message_delivered") {
          if (
            activeConvRef.current &&
            String(activeConvRef.current.id).toLowerCase() ===
              String(data.conversation_id).toLowerCase()
          ) {
            setMessages((prev) => {
              return prev.map((m) => {
                if (
                  m.sender_id === user.userId &&
                  isConfirmedMessage(m) &&
                  m.status !== "read"
                ) {
                  return { ...m, status: "delivered" };
                }
                return m;
              });
            });
          }

          setConversations((prev) => {
            return prev.map((c) => {
              if (
                String(c.id).toLowerCase() ===
                  String(data.conversation_id).toLowerCase() &&
                c.last_message &&
                c.last_message.sender_id === user.userId &&
                isConfirmedMessage(c.last_message) &&
                c.last_message.status !== "read"
              ) {
                return {
                  ...c,
                  last_message: {
                    ...c.last_message,
                    status: "delivered",
                  },
                };
              }
              return c;
            });
          });
        } else if (data.event === "read_update") {
          if (
            activeConvRef.current &&
            String(activeConvRef.current.id).toLowerCase() ===
              String(data.conversation_id).toLowerCase()
          ) {
            setMessages((prev) => {
              return prev.map((m) => {
                if (m.sender_id === user.userId && isConfirmedMessage(m)) {
                  return { ...m, status: "read" };
                }
                return m;
              });
            });
          }

          setConversations((prev) => {
            return prev.map((c) => {
              if (
                String(c.id).toLowerCase() ===
                  String(data.conversation_id).toLowerCase() &&
                c.last_message &&
                c.last_message.sender_id === user.userId &&
                isConfirmedMessage(c.last_message)
              ) {
                return {
                  ...c,
                  last_message: {
                    ...c.last_message,
                    status: "read",
                  },
                };
              }
              return c;
            });
          });
        } else if (data.event === "message_edited") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === data.message_id
                ? { ...m, content: data.content, is_edited: true }
                : m,
            ),
          );
        } else if (data.event === "message_deleted") {
          setMessages((prev) => prev.filter((m) => m.id !== data.message_id));
          setPinnedMessagesMap((previous) => ({
            ...previous,
            [data.conversation_id]: (
              previous[data.conversation_id] || []
            ).filter(
              (pin) =>
                String(pin.message_id || pin.id) !== String(data.message_id),
            ),
          }));
        } else if (data.event === "message_reacted") {
          setMessages((prev) =>
            prev.map((m) => {
              const mId = m.id || m.message_id;
              if (mId === data.message_id) {
                const existingReactions = { ...(m.reactions || {}) };
                const userList = existingReactions[data.emoji]
                  ? [...existingReactions[data.emoji]]
                  : [];
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
            }),
          );
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
          setPinnedMessagesMap((prev) => {
            const list = prev[data.conversation_id] || [];
            const filtered = list.filter(
              (p) => String(p.message_id || p.id) !== String(data.message_id),
            );
            return {
              ...prev,
              [data.conversation_id]: [pinnedObj, ...filtered],
            };
          });
          setPinnedMessageIdMap((prev) => ({
            ...prev,
            [data.conversation_id]: data.message_id,
          }));
        } else if (data.event === "message_unpinned") {
          if (
            data.scope === "personal" &&
            String(data.pinned_by_user_id) !== String(user.userId)
          )
            return;
          setPinnedMessagesMap((prev) => {
            const list = prev[data.conversation_id] || [];
            const filtered = list.filter(
              (p) => String(p.message_id || p.id) !== String(data.message_id),
            );
            return { ...prev, [data.conversation_id]: filtered };
          });
        } else if (
          data.event === "user_status" ||
          data.type === "user_status" ||
          data.action === "user_status"
        ) {
          setConversations((prev) => {
            return prev.map((c) => {
              const otherId =
                c.other_participant?.user_id || c.other_participant?.id;
              if (otherId && String(otherId) === String(data.user_id)) {
                return {
                  ...c,
                  status: data.status,
                  other_participant: {
                    ...c.other_participant,
                    status: data.status,
                    last_seen: data.last_seen,
                  },
                };
              }
              return c;
            });
          });

          setActiveConv((prev) => {
            const otherId =
              prev?.other_participant?.user_id || prev?.other_participant?.id;
            if (otherId && String(otherId) === String(data.user_id)) {
              return {
                ...prev,
                status: data.status,
                other_participant: {
                  ...prev.other_participant,
                  status: data.status,
                  last_seen: data.last_seen,
                },
              };
            }
            return prev;
          });
        } else if (["group_admin_updated", "group_member_added", "group_member_removed", "group_ownership_transferred"].includes(data.event)) {
          handleGroupMembershipEvent(data);
        } else if (data.event === "group_updated") {
          const { conversation_id, title, avatar_url } = data;
          setConversations((prev) =>
            prev.map((c) => {
              if (c.id === conversation_id) {
                return {
                  ...c,
                  title: title || c.title,
                  display_name: title || c.display_name,
                  avatar_url: avatar_url || c.avatar_url,
                };
              }
              return c;
            }),
          );

          setActiveConv((prev) => {
            if (prev && prev.id === conversation_id) {
              return {
                ...prev,
                title: title || prev.title,
                display_name: title || prev.display_name,
                avatar_url: avatar_url || prev.avatar_url,
              };
            }
            return prev;
          });
        }
      },
      // onOpen callback
      () => {
        setWsConnected(true);
        refreshBlockState();
      },
      // onClose callback
      () => {
        actionTrackerRef.current.fail(
          "Connection lost before confirmation. Check the refreshed conversation before retrying.",
        );
        setWsConnected(false);
        if (!disposed)
          reconnectTimer = setTimeout(
            () => setConnectionAttempt((attempt) => attempt + 1),
            15000,
          );
      },
      // onError callback
      () => setWsConnected(false),
    );

    socketRef.current = socket;

    return () => {
      disposed = true;
      clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [user.token, connectionAttempt]);

  // Load messages when selecting active conversation
  const openNotificationConversationRef = useRef(null);
  openNotificationConversationRef.current = async (conversationId) => {
    let conversation = conversationsRef.current.find((item) => item.id === conversationId);
    if (!conversation) {
      await loadConversations();
      conversation = conversationsRef.current.find((item) => item.id === conversationId);
    }
    if (!conversation) { showError("This conversation is no longer available."); return; }
    setActiveRailTab("chats");
    await handleSelectConversation(conversation);
  };

  const handleSelectConversation = async (
    conv,
    preserveMessages = false,
    targetMessage = null,
  ) => {
    const request = ++historyRequestRef.current;
    historyTargetRef.current = targetMessage;
    setHistoryTarget(targetMessage);
    followLatestRef.current = !targetMessage;
    renderedMessageIdsRef.current = new Set();
    unseenMessageIdsRef.current = new Set();
    setNewMessagesBelowCount(0);
    setShowScrollBottomBtn(false);
    setCompactChatOpen(true);
    setCompactNavigationOpen(false);
    setShowInspector(false);
    conv =
      conversationsRef.current.find(
        (conversation) => conversation.id === conv.id,
      ) || conv;
    const revision = dataRevisionRef.current;
    activeConvRef.current = conv;
    loadedConversationRef.current = null;
    setActiveConv(conv);
    if (!preserveMessages) setMessages([]);
    setHistoryState({ loading: true, error: null });
    const currentUserId = user?.userId || user?.user_id;
    if (conv.id === "virtual-saved-messages") {
      try {
        const response =
          await conversationService.createConversation(currentUserId);
        if (
          request !== historyRequestRef.current ||
          revision !== dataRevisionRef.current
        )
          return;

        const realSelfConv = {
          id: response.conversation_id,
          type: "direct",
          display_name: "Saved Messages",
          avatar_url: null,
          other_participant: null,
        };
        conv = realSelfConv;
        moveDraft("virtual-saved-messages", conv.id);
        activeConvRef.current = conv;
        setActiveConv(conv);
        loadConversations();
      } catch (err) {
        console.error("Failed to lazy-create saved messages:", err);
        if (
          request === historyRequestRef.current &&
          revision === dataRevisionRef.current
        ) {
          setHistoryState({
            loading: false,
            error: "Could not open Saved Messages.",
          });
        }
        return;
      }
    }

    try {
      const history = await conversationService.getMessages(
        conv.id,
        targetMessage,
      );
      if (
        request !== historyRequestRef.current ||
        revision !== dataRevisionRef.current ||
        activeConvRef.current?.id !== conv.id
      )
        return;
      const mapped = (history || []).map((m) => ({
        ...m,
        id: m.message_id || m.id,
      }));
      const uniqueMap = new Map();
      mapped.forEach((m) => uniqueMap.set(m.id, m));
      if (targetMessage && !uniqueMap.has(targetMessage))
        throw new Error("Message is no longer available.");
      setMessages((previous) => [
        ...uniqueMap.values(),
        ...(preserveMessages
          ? previous.filter((message) => !isConfirmedMessage(message))
          : []),
      ]);
      loadedConversationRef.current = conv.id;
      setHistoryState({ loading: false, error: null });

      // Fetch pinned messages stack
      try {
        const pins = await conversationService.getPinnedMessages(conv.id);
        if (
          Array.isArray(pins) &&
          request === historyRequestRef.current &&
          revision === dataRevisionRef.current &&
          activeConvRef.current?.id === conv.id
        ) {
          setPinnedMessagesMap((prev) => ({ ...prev, [conv.id]: pins }));
        }
      } catch (e) {}

      // Read conversation notification
      markVisibleConversationRead(conv.id);
    } catch (err) {
      console.error("Failed to load messages:", err);
      if (
        request === historyRequestRef.current &&
        revision === dataRevisionRef.current &&
        activeConvRef.current?.id === conv.id
      ) {
        setHistoryState({ loading: false, error: "Could not load messages." });
      }
    }
  };

  // User Search triggered reactively whenever query edits
  useEffect(() => {
    const query = searchQuery.trim();
    let cancelled = false;
    setSearchError(null);
    setSearchResults([]);
    if (!query) {
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const delayDebounceFn = setTimeout(async () => {
      try {
        const results = await userService.searchUsers(query);
        if (!cancelled) setSearchResults(results);
      } catch (err) {
        console.error("Search failed:", err);
        if (!cancelled) setSearchError("Could not search users.");
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 300); // 300ms debounce to prevent API spam

    return () => {
      cancelled = true;
      clearTimeout(delayDebounceFn);
    };
  }, [searchQuery, blockRevision, searchAttempt, user.token]);

  const handleAvatarFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    try {
      const uploadRes = await conversationService.uploadFile(file);
      setMyProfile((prev) => ({ ...prev, avatar_url: uploadRes.url }));
      setErrorToast(null);
    } catch (err) {
      console.error("Avatar upload failed:", err);
      showError(
        err.message || "Could not upload your avatar. Please try again.",
      );
    } finally {
      setIsUploadingAvatar(false);
      e.target.value = "";
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
        is_public: myProfile.is_public !== false,
      });
      const freshProfile = await userService.getProfile();
      if (freshProfile) {
        setMyProfile((current) =>
          current === myProfile ? freshProfile : current,
        );
      }
      setErrorToast(null);
      setProfileSavedToast(true);
      setTimeout(() => setProfileSavedToast(false), 3000);
    } catch (err) {
      console.error("Failed to update profile:", err);
      showError(
        err.message ||
          "Could not save your profile. Your changes are still here.",
      );
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Helper to start conversation with oneself (Saved Messages)
  const handleStartSelfConversation = async () => {
    try {
      const existing = conversations.find((c) => !c.other_participant);
      if (existing) {
        handleSelectConversation(existing);
        return;
      }

      const currentUserId = user?.userId || user?.user_id;
      const response =
        await conversationService.createConversation(currentUserId);
      await loadConversations();

      const completeConv = {
        id: response.conversation_id,
        type: "direct",
        display_name: "Saved Messages",
        avatar_url: null,
        other_participant: null,
      };
      handleSelectConversation(completeConv);
    } catch (err) {
      console.error("Failed to start self-conversation:", err);
    }
  };

  // Start direct messaging with a searched user
  const handleStartConversation = async (targetUser) => {
    const targetUserId = targetUser.user_id || targetUser.id;
    if (blockStateRef.current.incoming.includes(String(targetUserId))) return;
    if (targetUserId === user.userId) {
      await handleStartSelfConversation();
      return;
    }
    try {
      // Check if DM exists first
      const existing = conversations.find(
        (c) =>
          c.other_participant && c.other_participant.user_id === targetUserId,
      );

      if (existing) {
        handleSelectConversation(existing);
        setSearchQuery("");
        setSearchResults([]);
        return;
      }

      if (
        !blockPolicy(
          targetUserId,
          blockStateRef.current.outgoing,
          blockStateRef.current.incoming,
        ).canInteract
      ) {
        showError("Unblock this user before starting a direct chat.");
        return;
      }

      const response =
        await conversationService.createConversation(targetUserId);
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
          last_seen: targetUser.last_seen || null,
        },
      };
      handleSelectConversation(completeConv);
      setSearchQuery("");
      setSearchResults([]);
    } catch (err) {
      console.error("Failed to start conversation:", err);
    }
  };

  // Uploads and sends each image as its own message, one at a time, updating a
  // combined progress indicator. Stops early if cancelBatchSend() is called.
  const sendImageBatch = async (files) => {
    if (!canSendToConversation(activeConv)) return;
    batchCancelRef.current = false;
    const total = files.length;
    let failedCount = 0;
    setIsUploading(true);
    for (let i = 0; i < total; i++) {
      if (batchCancelRef.current) break;
      const file = files[i];
      setUploadProgress({
        percentage: 0,
        loadedFormatted: "0.0 MB",
        totalFormatted: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        batchCurrent: i + 1,
        batchTotal: total,
      });
      try {
        const uploadRes = await conversationService.uploadFile(
          file,
          (progressInfo) => {
            if (batchCancelRef.current) return;
            setUploadProgress({
              ...progressInfo,
              batchCurrent: i + 1,
              batchTotal: total,
            });
          },
        );
        if (batchCancelRef.current) break;
        if (!canSendToConversation(activeConv)) break;
        await sendOptimisticMessage(activeConv, {
          content: "",
          message_type: "image",
          media_url: uploadRes.url,
          reply_to_id: null,
        });
      } catch (err) {
        console.error("Failed to send image in batch:", err);
        failedCount += 1;
      }
    }
    setIsUploading(false);
    setUploadProgress({
      percentage: 0,
      loadedFormatted: "0 MB",
      totalFormatted: "0 MB",
    });
    if (batchCancelRef.current) {
      showError("Cancelled sending the remaining images.");
    } else if (failedCount > 0) {
      showError(
        `${failedCount} of ${total} image${total === 1 ? "" : "s"} failed to send.`,
      );
    }
  };

  const cancelBatchSend = () => {
    batchCancelRef.current = true;
  };

  const handleFileSelect = (e) => {
    if (!canSendToConversation(activeConv)) return;
    const files = Array.from(e.target.files || []);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (files.length === 0) return;
    try {
      files.forEach(validateUploadSize);
    } catch (error) {
      showError(error.message);
      return;
    }

    const allImages = files.every((f) => f.type.startsWith("image/"));
    if (files.length > 1 && allImages) {
      sendImageBatch(files);
      return;
    }

    const file = files[0];
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
  const sendOptimisticMessage = async (
    conversation,
    payload,
    retryEntry = null,
  ) => {
    if (!canSendToConversation(conversation)) return;
    const previous =
      retryEntry ||
      outbox.entries.find(
        (entry) =>
          entry.conversation_id === conversation.id &&
          JSON.stringify(entry.payload) === JSON.stringify(payload),
      );
    const clientId = previous?.client_id || crypto.randomUUID();
    if (pendingSendIdsRef.current.has(clientId)) return;
    pendingSendIdsRef.current.add(clientId);
    const localMsg = {
      ...payload,
      id: `temp-${clientId}`,
      client_id: clientId,
      conversation_id: conversation.id,
      payload,
      sender_id: user.userId,
      sender_name: myProfile?.display_name || user.username,
      sender_avatar: myProfile?.avatar_url,
      created_at: previous?.created_at || new Date().toISOString(),
      status: "pending",
    };
    const token = user.token;
    outbox.put(localMsg);
    if (activeConvRef.current?.id === conversation.id) {
      setMessages((prev) => [
        ...prev.filter((message) => message.id !== localMsg.id),
        localMsg,
      ]);
    }
    setConversations((prev) => {
      const updated = prev.map((conversationItem) =>
        conversationItem.id === conversation.id
          ? {
              ...conversationItem,
              last_message_content: localMsg.content,
              last_message_time: localMsg.created_at,
              last_message: { ...localMsg, message_id: localMsg.id },
            }
          : conversationItem,
      );
      const saved = updated.find(
        (item) =>
          item.id === "virtual-saved-messages" ||
          (item.type === "direct" && !item.other_participant),
      );
      const sorted = updated
        .filter((item) => item !== saved)
        .sort(
          (first, second) =>
            new Date(second.last_message_time || 0) -
            new Date(first.last_message_time || 0),
        );
      return saved ? [saved, ...sorted] : sorted;
    });
    try {
      const confirmation = await conversationService.sendMessage(
        conversation.id,
        { ...payload, client_message_id: clientId },
      );
      if (confirmation?.message_id !== clientId)
        throw new Error(
          "Message confirmation was missing. Check history before retrying.",
        );
      if (blockStateRef.current.token !== token) return;
      outbox.remove(clientId);
      if (activeConvRef.current?.id === conversation.id) {
        setMessages((prev) =>
          confirmOutgoingMessage(prev, localMsg.id, confirmation),
        );
      }
      setConversations((prev) =>
        prev.map((item) =>
          item.id === conversation.id &&
          item.last_message?.message_id === localMsg.id
            ? {
                ...item,
                last_message: {
                  ...item.last_message,
                  id: confirmation.message_id,
                  message_id: confirmation.message_id,
                  status: confirmation.status,
                },
              }
            : item,
        ),
      );
      return true;
    } catch (error) {
      if (blockStateRef.current.token !== token) return;
      outbox.put({ ...localMsg, status: "failed", error: error.message });
      if (activeConvRef.current?.id === conversation.id) {
        setMessages((prev) => failOutgoingMessage(prev, localMsg.id));
      }
      setConversations((prev) =>
        prev.map((item) =>
          item.id === conversation.id &&
          item.last_message?.message_id === localMsg.id
            ? {
                ...item,
                last_message: { ...item.last_message, status: "failed" },
              }
            : item,
        ),
      );
      throw error;
    } finally {
      pendingSendIdsRef.current.delete(clientId);
    }
  };

  const handleRetryMessage = async (message) => {
    if (!activeConv || message.conversation_id !== activeConv.id) return;
    if (!canSendToConversation(activeConv)) {
      showError("Messaging is unavailable in this conversation.");
      return;
    }
    const clearDraft = captureDraft(activeConv.id);
    const matchesDraft =
      message.payload.content === (drafts[activeConv.id] || "");
    try {
      if (await sendOptimisticMessage(activeConv, message.payload, message)) {
        if (matchesDraft) clearDraft();
      }
    } catch (error) {
      showError(error.message || "Could not retry the message.");
    }
  };

  const handleDiscardMessage = (message) => {
    if (pendingSendIdsRef.current.has(message.client_id)) return;
    outbox.remove(message.client_id);
    setMessages((previous) =>
      previous.filter((item) => item.id !== message.id),
    );
    loadConversations();
  };

  const handleCopyFailedMessage = async (message) => {
    try {
      await navigator.clipboard.writeText(
        message.content || message.media_url || "",
      );
    } catch {
      showError("Could not copy the message.");
    }
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (sendingMessageRef.current) return;

    const hasText = messageText.trim().length > 0;
    if (!selectedFile && !hasText) return;
    if (!activeConv) return;

    if (!canSendToConversation(activeConv)) {
      showError("Messaging is unavailable in this conversation.");
      return;
    }

    // If editing an existing message
    if (editingMessage) {
      sendMessageAction({
        action: "edit_message",
        conversation_id: activeConv.id,
        message_id: editingMessage.id,
        content: messageText.trim(),
      });
      return;
    }

    let mType = "text";
    let mediaUrl = null;
    let finalContent = messageText;
    const clearSentDraft = captureDraft(activeConv.id);
    sendingMessageRef.current = true;

    try {
      if (selectedFile) {
        setIsUploading(true);
        setUploadProgress({
          percentage: 0,
          loadedFormatted: "0.0 MB",
          totalFormatted: `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB`,
        });
        const uploadRes = await conversationService.uploadFile(
          selectedFile,
          (progressInfo) => {
            setUploadProgress(progressInfo);
          },
        );
        setIsUploading(false);
        mediaUrl = uploadRes.url;
        mType = selectedFile.type.startsWith("image/")
          ? "image"
          : selectedFile.type.startsWith("audio/")
            ? "audio"
            : "file";
        if (!finalContent) {
          finalContent = selectedFile.name; // Use filename as fallback text
        }
      }

      const currentReplyToId = replyingTo?.id || null;
      if (!canSendToConversation(activeConv)) return;

      if (selectedFile && activeConvRef.current?.id === activeConv.id) {
        setSelectedFile((current) =>
          current === selectedFile ? null : current,
        );
        setFilePreview((current) => {
          if (current !== filePreview) return current;
          if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
          return null;
        });
      }

      const sending = sendOptimisticMessage(activeConv, {
        content: finalContent,
        message_type: mType,
        media_url: mediaUrl,
        reply_to_id: currentReplyToId,
      });
      handleStopTypingNotification();
      const confirmed = await sending;
      if (confirmed) {
        clearSentDraft();
        if (activeConvRef.current?.id === activeConv.id) {
          setReplyingTo((current) => (current === replyingTo ? null : current));
          setSelectedFile((current) =>
            current === selectedFile ? null : current,
          );
          setFilePreview((current) => {
            if (current !== filePreview) return current;
            if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
            return null;
          });
        }
      }
    } catch (err) {
      console.error("Failed to send message / upload file:", err);
      showError(err.message || "Failed to send message. Please try again.");
    } finally {
      sendingMessageRef.current = false;
      setIsUploading(false);
    }
  };

  // Context Menu & Message Action Handlers
  const handleContextMenu = (e, msg) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      message: msg,
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const handleStartReply = (msg) => {
    if (!canSendToConversation(activeConv)) return;
    const isSelf = msg.sender_id === user.userId;
    const senderName = isSelf
      ? "You"
      : activeConv?.other_participant?.username || "Participant";
    const previewContent =
      msg.content ||
      (msg.message_type === "image"
        ? "📷 Image"
        : msg.message_type === "audio"
          ? "🎙️ Voice message"
          : "📁 Attachment");
    setReplyingTo({
      id: msg.id || msg.message_id,
      sender_id: msg.sender_id,
      senderName: isBlockedBy(msg.sender_id)
        ? UNAVAILABLE_NAME
        : msg.sender_name || senderName,
      content: previewContent,
    });
    handleCloseContextMenu();
  };

  const handleStartEdit = (msg) => {
    if (!canSendToConversation(activeConv)) return;
    setEditingMessage({
      id: msg.id || msg.message_id,
      content: msg.content,
    });
    setEditText(msg.content || "");
    handleCloseContextMenu();
  };

  const handleDeleteMsg = (msg) => {
    if (!canSendToConversation(activeConv)) return;
    const targetId = msg.id || msg.message_id;
    sendMessageAction({
      action: "delete_message",
      conversation_id: activeConv.id,
      message_id: targetId,
    });
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
          new ClipboardItem({ [blob.type]: blob }),
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
    if (!canSendToConversation(activeConv)) return;
    const clipboardData = e.clipboardData || window.clipboardData;
    if (!clipboardData || !clipboardData.items) return;

    const items = Array.from(clipboardData.items);
    for (const item of items) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          try {
            validateUploadSize(file);
          } catch (error) {
            showError(error.message);
            return;
          }
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
    if (!activeConv || !canSendToConversation(activeConv)) return;
    const msgId = String(msg.id || msg.message_id || "");

    sendMessageAction({
      action: "react_message",
      conversation_id: String(activeConv.id),
      message_id: msgId,
      emoji: String(emoji),
    });

    handleCloseContextMenu();
  };

  const isGroup = activeConv?.type === "group";
  const currentParticipant = (activeConv?.participants || []).find(
    (p) => String(p.user_id || p.id) === String(user.userId),
  );
  const isAdmin =
    !isGroup ||
    String(activeConv?.creator_id) === String(user.userId) ||
    currentParticipant?.role === "admin" ||
    currentParticipant?.role === "creator";

  const handleTogglePin = (msg, forceScope = null) => {
    if (!activeConv || !canSendToConversation(activeConv)) return;
    const msgId = String(msg.id || msg.message_id || "");
    const currentPins = pinnedMessagesMap[activeConv.id] || [];
    const isCurrentlyPinned = currentPins.some(
      (p) => String(p.message_id || p.id) === msgId,
    );

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
    if (!activeConv || !msg || !canSendToConversation(activeConv)) return;
    const msgId = String(msg.id || msg.message_id || "");
    if (
      !sendMessageAction({
        action: "pin_message",
        conversation_id: String(activeConv.id),
        message_id: msgId,
        scope,
        notify,
      })
    )
      return;

    setPinScopePromptMsg(null);
    setPinNotifyStep(false);
    handleCloseContextMenu();
  };

  const handleUnpin = (msg) => {
    if (!activeConv || !msg || !canSendToConversation(activeConv)) return;
    const msgId = String(msg.id || msg.message_id || "");
    const pinned = (pinnedMessagesMap[activeConv.id] || []).find(
      (pin) => String(pin.message_id || pin.id) === msgId,
    );
    sendMessageAction({
      action: "unpin_message",
      conversation_id: String(activeConv.id),
      message_id: msgId,
      scope: pinned?.scope || msg.scope || "shared",
    });
    handleCloseContextMenu();
  };

  const searchMatchingMessages = messages.filter((m) => {
    if (!inChatSearchQuery.trim()) return false;
    return m.content?.toLowerCase().includes(inChatSearchQuery.toLowerCase());
  });

  const handleNextSearchMatch = () => {
    if (searchMatchingMessages.length === 0) return;
    const nextIdx =
      (inChatSearchMatchIndex + 1) % searchMatchingMessages.length;
    setInChatSearchMatchIndex(nextIdx);
    const targetMsg = searchMatchingMessages[nextIdx];
    const el = document.getElementById(
      `msg-${targetMsg.id || targetMsg.message_id}`,
    );
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handlePrevSearchMatch = () => {
    if (searchMatchingMessages.length === 0) return;
    const prevIdx =
      (inChatSearchMatchIndex - 1 + searchMatchingMessages.length) %
      searchMatchingMessages.length;
    setInChatSearchMatchIndex(prevIdx);
    const targetMsg = searchMatchingMessages[prevIdx];
    const el = document.getElementById(
      `msg-${targetMsg.id || targetMsg.message_id}`,
    );
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // Send typing status to WebSocket Node
  const handleKeyPress = () => {
    if (!activeConv || !socketRef.current || !canSendToConversation(activeConv))
      return;

    // Broadcast active typing status
    socketRef.current.send(
      JSON.stringify({
        action: "typing",
        conversation_id: activeConv.id,
        is_typing: true,
      }),
    );

    // Reset timer to clear typing state after inactivity
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(handleStopTypingNotification, 3000);
  };

  const handleStopTypingNotification = () => {
    if (!activeConv || !socketRef.current || !canSendToConversation(activeConv))
      return;
    socketRef.current.send(
      JSON.stringify({
        action: "typing",
        conversation_id: activeConv.id,
        is_typing: false,
      }),
    );
  };

  // Helper: format connection status label
  const formatTime = (timeStr) => {
    if (!timeStr) return "";
    try {
      const date = new Date(timeStr);
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  // Render active other participant typing status
  const getActiveTypingLabel = () => {
    if (!activeConv) return null;
    const convTypists = typingForDisplay[activeConv.id];
    if (!convTypists) return null;

    const typingArr = Object.entries(convTypists).filter(
      ([uid, typing]) => uid !== user.userId && typing,
    );

    if (typingArr.length > 0) {
      return "typing...";
    }
    return null;
  };

  const sharedImages = messages.filter(
    (m) =>
      m.media_url &&
      (m.message_type === "image" ||
        m.media_url.match(/\.(jpeg|jpg|gif|png|webp|svg)/i)),
  );
  const sharedFiles = messages.filter(
    (m) => m.media_url && !sharedImages.includes(m),
  );

  return (
    <div
      className={`ht-app-container ${theme === "dark" ? "ht-dark-theme" : "ht-light-theme"}`}
      data-compact-view={
        compactNavigationOpen
          ? "navigation"
          : showInspector && activeConv
            ? "details"
            : compactChatOpen && activeConv
              ? "chat"
              : "list"
      }
      style={{ background: t.chatBg, color: t.text }}
    >
      <div
        className="ht-compact-header"
        style={{ background: t.sidebarBg, borderBottom: t.border }}
      >
        {compactNavigationOpen ||
        showInspector ||
        (compactChatOpen && activeConv) ? (
          <button
            type="button"
            aria-label={
              compactNavigationOpen
                ? "Back to inbox"
                : showInspector
                  ? "Back to conversation"
                  : "Back to conversations"
            }
            title="Back"
            onClick={() => {
              if (compactNavigationOpen) setCompactNavigationOpen(false);
              else if (showInspector) setShowInspector(false);
              else setCompactChatOpen(false);
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M19 12H5m7-7-7 7 7 7" />
            </svg>
          </button>
        ) : (
          <button
            type="button"
            aria-label="Open navigation"
            title="Open navigation"
            onClick={() => setCompactNavigationOpen(true)}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
        <span>
          {compactNavigationOpen
            ? "Navigation"
            : showInspector && activeConv
              ? "Conversation details"
              : "FlowChat"}
        </span>
      </div>
      {errorToast && (
        <div
          style={{
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
            animation: "fadeIn 0.3s ease",
          }}
        >
          <svg
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            viewBox="0 0 24 24"
            style={{ flexShrink: 0 }}
          >
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
              fontWeight: 700,
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
        setActiveRailTab={(tab) => {
          setActiveRailTab(tab);
          setCompactNavigationOpen(false);
          setCompactChatOpen(false);
          setShowInspector(false);
        }}
        activeRailTab={activeRailTab}
        myProfile={myProfile}
        user={user}
        onLogout={onLogout}
      />

      {/* 2. Conversations / Settings / Profile Sidebar */}
      <ConversationList
        messageSearch={{
          ...messageSearch,
          messages: blockStateReady
            ? messageSearch.messages.map((message) =>
                maskMessage(message, blockedByUserIds),
              )
            : [],
        }}
        searchFilters={searchFilters}
        setSearchFilters={setSearchFilters}
        onMessageSearchResult={(message) => {
          const conversation = conversationsRef.current.find(
            (item) => item.id === message.conversation_id,
          );
          if (conversation)
            handleSelectConversation(conversation, false, message.id);
          else
            showError(
              "Conversation is no longer available. Refresh the conversation list.",
            );
        }}
        organization={organization}
        chatMute={{ mutes: muteUntil, scopes: muteScopes, setMute: setConversationMute }}
        drafts={drafts}
        conversationError={conversationError}
        conversationsLoading={conversationsLoading}
        onRetryConversations={loadConversations}
        searchError={searchError}
        onRetrySearch={() => setSearchAttempt((previous) => previous + 1)}
        leftSidebarWidth={leftSidebarWidth}
        themeTokens={t}
        theme={theme}
        activeRailTab={activeRailTab}
        syncState={syncState}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        conversations={blockStateReady ? conversationsForDisplay : []}
        isBlockedBy={isBlockedBy}
        isConvPinned={isConvPinned}
        activeConv={activeConvForDisplay}
        handleSelectConversation={handleSelectConversation}
        user={user}
        convoTab={convoTab}
        setConvoTab={setConvoTab}
        isSearching={isSearching}
        searchResults={
          blockStateReady
            ? searchResults.filter(
                (participant) => !isBlockedBy(participantId(participant)),
              )
            : []
        }
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
        notificationSettings={<NotificationSettings hidePreviews={hideNotificationPreviews} setHidePreviews={setHidePreviews} folders={organization.folders} scopes={muteScopes} setScopeMute={setScopeMute} themeTokens={t} />}
        onLogout={onLogout}
        setIsResizingLeft={setIsResizingLeft}
        isResizingLeft={isResizingLeft}
        typingUsers={typingForDisplay}
      />

      {/* 3. Center Messaging Pane */}
      {imageViewer && (
        <ImageLightbox
          images={imageViewer.images}
          startIndex={imageViewer.startIndex}
          onClose={() => setImageViewer(null)}
          onJumpToMessage={(image) => {
            const conversation = conversationsRef.current.find(
              (item) => item.id === imageViewer.conversationId,
            );
            setImageViewer(null);
            if (conversation)
              handleSelectConversation(conversation, false, image.id);
            else showError("Conversation is no longer available.");
          }}
        />
      )}
      <ChatArea
        olderMessages={olderMessages}
        onOpenImage={(message) => {
          const images = messagesForDisplay.filter(
            (item) =>
              item.message_type === "image" &&
              (item.media_url || item.file_url),
          );
          const id = message.id || message.message_id;
          setImageViewer({
            conversationId: activeConv.id,
            images: images.map((item) => ({
              id: item.id || item.message_id,
              src: getAssetUrl(item.media_url || item.file_url),
              caption: item.content,
              canJump: isConfirmedMessage(item),
            })),
            startIndex: Math.max(
              0,
              images.findIndex((item) => (item.id || item.message_id) === id),
            ),
          });
        }}
        historyTarget={historyTarget}
        onLatestHistory={() => handleSelectConversation(activeConvRef.current)}
        handleRetryMessage={handleRetryMessage}
        handleDiscardMessage={handleDiscardMessage}
        handleCopyFailedMessage={handleCopyFailedMessage}
        historyError={historyState.error}
        historyLoading={historyState.loading}
        onRetryHistory={() =>
          handleSelectConversation(
            activeConvRef.current,
            true,
            historyTargetRef.current,
          )
        }
        pendingMessageAction={pendingMessageAction}
        activeConv={activeConvForDisplay}
        blockedByUser={activeBlockPolicy.incoming}
        blockedUser={activeBlockPolicy.outgoing}
        directReadOnly={directReadOnly || !blockStateReady}
        canSendToConversation={canSendToConversation}
        handleBlockUser={handleBlockUser}
        handleUnblockUser={handleUnblockUser}
        showError={showError}
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
        chatMute={{ mutes: muteUntil, scopes: muteScopes, folders: organization.folders, setMute: setConversationMute }}
        mutedConvIds={mutedConvIds}
        pinnedMessageIdMap={pinnedMessageIdMap}
        pinnedMessagesMap={pinsForDisplay}
        handleUnpin={handleUnpin}
        messages={messagesForDisplay}
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
        sendOptimisticMessage={sendOptimisticMessage}
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
        setUploadProgress={setUploadProgress}
        cancelBatchSend={cancelBatchSend}
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
        onOpenImage={(message) => {
          const id = message.id || message.message_id;
          setImageViewer({
            conversationId: activeConv.id,
            images: sharedImages.map((item) => ({
              id: item.id || item.message_id,
              src: getAssetUrl(item.media_url || item.file_url),
              caption: item.content,
              canJump: isConfirmedMessage(item),
            })),
            startIndex: Math.max(
              0,
              sharedImages.findIndex(
                (item) => (item.id || item.message_id) === id,
              ),
            ),
          });
        }}
        showInspector={showInspector}
        activeConv={activeConvForDisplay}
        rightSidebarWidth={rightSidebarWidth}
        themeTokens={t}
        theme={theme}
        setIsResizingRight={setIsResizingRight}
        isResizingRight={isResizingRight}
        setShowInspector={setShowInspector}
        setViewingParticipantProfile={setViewingParticipantProfile}
        mutedConvIds={Object.keys(muteUntil).filter((id) => isMutedUntil(muteUntil[id], notificationClock))}
        scopeMuted={activeConv && isConversationMuted(activeConv.id, {}, muteScopes, organization.folders, notificationClock)}
        toggleMuteConversation={toggleMuteConversation}
        setIsInChatSearchOpen={(open) => {
          setIsInChatSearchOpen(open);
          if (open && window.matchMedia("(max-width: 1100px)").matches) {
            setShowInspector(false);
            setCompactChatOpen(true);
          }
        }}
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
            padding: 20,
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
              animation: "fadeIn 0.2s ease",
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
                fontWeight: "bold",
              }}
            >
              ✕
            </button>

            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: "50%",
                background: "#4f46e5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: 36,
                fontWeight: 800,
                overflow: "hidden",
                marginBottom: 16,
                border: `3px solid ${t.accent}`,
              }}
            >
              {viewingParticipantProfile.avatar_url ? (
                <img
                  src={viewingParticipantProfile.avatar_url}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                viewingParticipantProfile.display_name?.[0]?.toUpperCase() ||
                "@"
              )}
            </div>

            <h3
              style={{
                margin: 0,
                fontSize: 20,
                color: t.text,
                fontWeight: 800,
              }}
            >
              {viewingParticipantProfile.display_name}
            </h3>
            <div
              style={{
                fontSize: 13,
                color: t.accent,
                fontWeight: 600,
                marginTop: 4,
              }}
            >
              @{viewingParticipantProfile.username}
            </div>

            {!viewingParticipantProfile.identity_hidden && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 12,
                  padding: "4px 12px",
                  background: "rgba(120, 120, 120, 0.08)",
                  borderRadius: 12,
                  fontSize: 12,
                  color:
                    viewingParticipantProfile.status === "online"
                      ? "#34A853"
                      : t.textMuted,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background:
                      viewingParticipantProfile.status === "online"
                        ? "#34A853"
                        : t.textMuted,
                  }}
                />
                {viewingParticipantProfile.status === "online"
                  ? "Active Now"
                  : viewingParticipantProfile.last_seen
                    ? `Last seen ${formatLastSeen(viewingParticipantProfile.last_seen)}`
                    : "Offline"}
              </div>
            )}

            <div
              style={{ width: "100%", display: "flex", gap: 12, marginTop: 24 }}
            >
              <div
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 14,
                  background: "rgba(120, 120, 120, 0.05)",
                  border: t.border,
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 800, color: t.text }}>
                  {sharedImages.length}
                </div>
                <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2 }}>
                  Shared Images
                </div>
              </div>
              <div
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 14,
                  background: "rgba(120, 120, 120, 0.05)",
                  border: t.border,
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 800, color: t.text }}>
                  {sharedFiles.length}
                </div>
                <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2 }}>
                  Shared Files
                </div>
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
                marginTop: 20,
              }}
            >
              Close Profile
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      <GroupInfoModal
        groupManagement={groupManagement}
        isGroupInfoOpen={isGroupInfoOpen}
        setIsGroupInfoOpen={setIsGroupInfoOpen}
        activeConv={activeConvForDisplay}
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
        selectedGroupMembers={selectedGroupMembers.map((participant) =>
          maskParticipant(participant, blockedByUserIds),
        )}
        setSelectedGroupMembers={setSelectedGroupMembers}
        handleRemoveGroupMember={handleRemoveGroupMember}
        groupSearchQuery={groupSearchQuery}
        setGroupSearchQuery={setGroupSearchQuery}
        groupSearchResults={
          blockStateReady
            ? groupSearchResults.filter(
                (participant) => !isBlockedBy(participantId(participant)),
              )
            : []
        }
        handleSelectGroupMember={handleSelectGroupMember}
        handleCreateGroupSubmit={handleCreateGroupSubmit}
        isCreatingGroup={isCreatingGroup}
        themeTokens={t}
      />

      <AddMemberModal
        pending={groupManagement.pending}
        error={groupManagement.error}
        isAddMemberOpen={isAddMemberOpen}
        setIsAddMemberOpen={setIsAddMemberOpen}
        addMemberQuery={addMemberQuery}
        setAddMemberQuery={setAddMemberQuery}
        addMemberResults={
          blockStateReady
            ? addMemberResults.filter(
                (participant) => !isBlockedBy(participantId(participant)),
              )
            : []
        }
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
        activeConv={activeConvForDisplay}
        handleStartConversation={handleStartConversation}
        isUserGroupAdmin={isUserGroupAdmin}
        groupAdminsMap={groupAdminsMap}
        handleMakeAdmin={handleMakeAdmin}
        setViewingParticipantProfile={setViewingParticipantProfile}
        isBlocked={isBlocked}
        isBlockedBy={isBlockedBy}
        handleBlockUser={handleBlockUser}
        handleUnblockUser={handleUnblockUser}
        theme={theme}
        themeTokens={t}
      />

      {/* Pin Scope Choice Modal */}
      {pinScopePromptMsg && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
          onClick={() => {
            setPinScopePromptMsg(null);
            setPinNotifyStep(false);
          }}
        >
          <div
            style={{
              background: t.cardBg,
              border: t.border,
              borderRadius: 16,
              padding: 24,
              maxWidth: 360,
              width: "90%",
              boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {!pinNotifyStep ? (
              <>
                <h3
                  style={{
                    margin: "0 0 8px",
                    fontSize: 18,
                    color: t.text,
                    fontWeight: 700,
                  }}
                >
                  Pin Message
                </h3>
                <p
                  style={{
                    margin: "0 0 20px",
                    fontSize: 13,
                    color: t.textMuted,
                    lineHeight: 1.4,
                  }}
                >
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
                    marginBottom: 10,
                  }}
                  onClick={() =>
                    executePin(pinScopePromptMsg, "personal", false)
                  }
                >
                  <span style={{ fontSize: 20 }}>👤</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      Pin for me
                    </div>
                    <div style={{ fontSize: 12, color: t.textMuted }}>
                      Only visible to you
                    </div>
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
                      marginBottom: 16,
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
                      <div style={{ fontSize: 12, color: t.textMuted }}>
                        Visible to everyone in chat
                      </div>
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
                    fontWeight: 500,
                  }}
                  onClick={() => {
                    setPinScopePromptMsg(null);
                    setPinNotifyStep(false);
                  }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <h3
                  style={{
                    margin: "0 0 8px",
                    fontSize: 18,
                    color: t.text,
                    fontWeight: 700,
                  }}
                >
                  Notify Members?
                </h3>
                <p
                  style={{
                    margin: "0 0 20px",
                    fontSize: 13,
                    color: t.textMuted,
                    lineHeight: 1.4,
                  }}
                >
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
                    marginBottom: 10,
                  }}
                  onClick={() => executePin(pinScopePromptMsg, "shared", true)}
                >
                  <span style={{ fontSize: 20 }}>🔔</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      Notify members
                    </div>
                    <div style={{ fontSize: 12, color: t.textMuted }}>
                      Send notification to all group members
                    </div>
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
                    marginBottom: 16,
                  }}
                  onClick={() => executePin(pinScopePromptMsg, "shared", false)}
                >
                  <span style={{ fontSize: 20 }}>🔕</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      Silent pin
                    </div>
                    <div style={{ fontSize: 12, color: t.textMuted }}>
                      Pin without sending a notification
                    </div>
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
                    fontWeight: 500,
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
}
