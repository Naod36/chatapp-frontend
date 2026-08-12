import { apiFetch, uploadFileWithProgress } from "./api";

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
        return apiFetch("/conversations");
    },

    async getMessages(conversationId) {
        return apiFetch(`/conversations/${conversationId}/messages`);
    },

    async uploadFile(file, onProgress) {
        if (onProgress) {
            return uploadFileWithProgress(file, onProgress);
        }
        const formData = new FormData();
        formData.append("file", file);
        return apiFetch("/upload", {
            method: "POST",
            body: formData,
        });
    }
};
