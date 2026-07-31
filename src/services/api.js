export const API_BASE = "https://chatapp-backend-chyk.onrender.com";
export const WS_BASE = "wss://chatapp-backend-chyk.onrender.com";

/**
 * Standard fetch wrapper that automatically sets the Content-Type
 * and adds the JWT Authorization token from localStorage if available.
 */
export async function apiFetch(endpoint, options = {}) {
    const token = localStorage.getItem("chat_token");
    
    const headers = {
        ...options.headers,
    };

    if (!(options.body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
    }

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const config = {
        ...options,
        headers,
    };

    const response = await fetch(`${API_BASE}${endpoint}`, config);
    
    let data;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
        data = await response.json();
    } else {
        data = await response.text();
    }

    if (!response.ok) {
        const errMsg = typeof data === "string" ? data : (data.message || data.error || `HTTP error! Status: ${response.status}`);
        throw new Error(errMsg);
    }

    return data;
}
