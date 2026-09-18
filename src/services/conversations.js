import { apiFetch, uploadFileWithProgress } from "./api";
import { validateUploadSize } from "../utils/uploadLimits.js";

/**
 * Conversations Service
 * ----------------------
 * Handles starting conversations, fetching chat histories, and loading historical streams.
 */
export const conversationService = {
  async createConversation(recipientId) {
    return apiFetch("/conversations", {
      method: "POST",
      body: JSON.stringify({ recipient_id: recipientId }),
    });
  },

  async createGroup(title, participantIds, avatarUrl = null) {
    return apiFetch("/conversations/group", {
      method: "POST",
      body: JSON.stringify({
        title,
        participant_ids: participantIds,
        avatar_url: avatarUrl,
      }),
    });
  },

  async listConversations() {
    return apiFetch("/conversations", { signal: AbortSignal.timeout(20000) });
  },

  async getMessages(conversationId, around = null) {
    return apiFetch(
      `/conversations/${conversationId}/messages?mark_read=false${around ? `&around=${encodeURIComponent(around)}` : ""}`,
    );
  },

  async searchMessages(query, filters = {}) {
    const params = new URLSearchParams({ q: query });
    for (const key of ["sender", "from", "to", "offset"]) {
      if (filters[key]) params.set(key, String(filters[key]));
    }
    return apiFetch(`/search/messages?${params}`, {
      signal: AbortSignal.timeout(15000),
    });
  },

  async sendMessage(conversationId, message) {
    const { client_message_id, ...payload } = message;
    return apiFetch(
      `/conversations/${conversationId}/messages${client_message_id ? `/${client_message_id}` : ""}`,
      {
        method: client_message_id ? "PUT" : "POST",
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify(payload),
      },
    );
  },

  async getPinnedMessages(conversationId) {
    return apiFetch(`/conversations/${conversationId}/pins`);
  },

  async pinMessage(conversationId, messageId, scope = "personal") {
    return apiFetch(`/conversations/${conversationId}/pin`, {
      method: "POST",
      body: JSON.stringify({ message_id: messageId, scope }),
    });
  },

  async unpinMessage(conversationId, messageId) {
    return apiFetch(`/conversations/${conversationId}/pin/${messageId}`, {
      method: "DELETE",
    });
  },

  async uploadFile(file, onProgress) {
    validateUploadSize(file);
    if (onProgress) {
      return uploadFileWithProgress(file, onProgress);
    }
    const formData = new FormData();
    formData.append("file", file);
    return apiFetch("/upload", {
      method: "POST",
      body: formData,
    });
  },

  async updateGroup(conversationId, data) {
    return apiFetch(`/conversations/${conversationId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },
  async updateMembers(conversationId, data) {
    return apiFetch(`/conversations/${conversationId}/members`, {
      method: "POST",
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify(data),
    });
  },
};
