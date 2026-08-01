import { API_BASE } from "./api";

/**
 * Auth Service
 * -------------
 * Handles signin, signup, and token state.
 */
async function handleResponse(response, defaultMsg) {
    let data;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
        try {
            data = await response.json();
        } catch {
            data = null;
        }
    } else {
        await response.text().catch(() => "");
        data = null;
    }

    if (!response.ok) {
        if (!data) {
            throw new Error("Unable to connect to the authentication server. Please check your backend connection.");
        }
        const errMsg = typeof data === "string" ? data : (data.message || data.error || defaultMsg);
        throw new Error(errMsg);
    }

    return data;
}

export const authService = {
    async login(identifier, password) {
        try {
            const response = await fetch(`${API_BASE}/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ identifier, password }),
            });

            const data = await handleResponse(response, "Invalid credentials. Please try again.");

            // Persist session tokens
            localStorage.setItem("chat_token", data.token);
            localStorage.setItem("chat_userId", data.user_id);
            localStorage.setItem("chat_username", data.username);

            return data;
        } catch (err) {
            if (err.name === "TypeError" || (err.message && (err.message.includes("NetworkError") || err.message.includes("Failed to fetch")))) {
                throw new Error(`Unable to reach the backend server at ${API_BASE}. Please verify the backend service is running.`);
            }
            throw err;
        }
    },

    async signup(username, email, password) {
        try {
            const response = await fetch(`${API_BASE}/signup`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ username, email, password }),
            });

            const data = await handleResponse(response, "Could not create account. Please check your details.");

            // Persist session tokens
            localStorage.setItem("chat_token", data.token);
            localStorage.setItem("chat_userId", data.user_id);
            localStorage.setItem("chat_username", data.username);

            return data;
        } catch (err) {
            if (err.name === "TypeError" || (err.message && (err.message.includes("NetworkError") || err.message.includes("Failed to fetch")))) {
                throw new Error(`Unable to reach the backend server at ${API_BASE}. Please verify the backend service is running.`);
            }
            throw err;
        }
    },

    async googleLogin(credential) {
        try {
            const response = await fetch(`${API_BASE}/auth/google`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ credential }),
            });

            const data = await handleResponse(response, "Google sign-in failed. Please try again.");

            // Persist session tokens
            localStorage.setItem("chat_token", data.token);
            localStorage.setItem("chat_userId", data.user_id);
            localStorage.setItem("chat_username", data.username);

            return data;
        } catch (err) {
            if (err.name === "TypeError" || (err.message && (err.message.includes("NetworkError") || err.message.includes("Failed to fetch")))) {
                throw new Error(`Unable to reach the backend server at ${API_BASE}. Please verify the backend service is running.`);
            }
            throw err;
        }
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
