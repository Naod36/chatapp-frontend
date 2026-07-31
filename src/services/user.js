import { apiFetch } from "./api";

/**
 * User Service
 * -------------
 * Handles current user info retrieval, profile edits, and public searches.
 */
export const userService = {
    async getProfile() {
        return apiFetch("/me");
    },

    async updateProfile(profileData) {
        // profileData: { display_name, bio, avatar_url, status, is_public }
        return apiFetch("/users/profile", {
            method: "PUT",
            body: JSON.stringify(profileData),
        });
    },

    async searchUsers(query) {
        return apiFetch(`/users/search?query=${encodeURIComponent(query)}`);
    }
};
