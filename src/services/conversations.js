import { apiFetch } from "./api";

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

    async listConversations() {
        return apiFetch("/conversations");
    },

    async getMessages(conversationId) {
        return apiFetch(`/conversations/${conversationId}/messages`);
    },

    async uploadFile(file) {
        const formData = new FormData();
        formData.append("file", file);
        return apiFetch("/upload", {
            method: "POST",
            body: formData,
        });
    }
};
