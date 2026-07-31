import { API_BASE } from "./api";

/**
 * Auth Service
 * -------------
 * Handles signin, signup, and token state.
 */
export const authService = {
    async login(identifier, password) {
        const response = await fetch(`${API_BASE}/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ identifier, password }),
        });

        const data = await response.json();
        if (!response.ok) {
            const errMsg = typeof data === "string" ? data : (data.message || data.error || "Login failed");
            throw new Error(errMsg);
        }

        // Persist session tokens
        localStorage.setItem("chat_token", data.token);
        localStorage.setItem("chat_userId", data.user_id);
        localStorage.setItem("chat_username", data.username);

        return data;
    },

    async signup(username, email, password) {
        const response = await fetch(`${API_BASE}/signup`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ username, email, password }),
        });

        const data = await response.json();
        if (!response.ok) {
            const errMsg = typeof data === "string" ? data : (data.message || data.error || "Signup failed");
            throw new Error(errMsg);
        }

        // Persist session tokens
        localStorage.setItem("chat_token", data.token);
        localStorage.setItem("chat_userId", data.user_id);
        localStorage.setItem("chat_username", data.username);

        return data;
    },

    logout() {
        localStorage.removeItem("chat_token");
        localStorage.removeItem("chat_userId");
        localStorage.removeItem("chat_username");
    },

    isAuthenticated() {
        return !!localStorage.getItem("chat_token");
    },

    getCurrentUser() {
        return {
            userId: localStorage.getItem("chat_userId"),
            username: localStorage.getItem("chat_username"),
            token: localStorage.getItem("chat_token")
        };
    }
};
