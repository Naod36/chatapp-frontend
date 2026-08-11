export const API_BASE = import.meta.env.VITE_API_URL || "https://chatapp-backend-chyk.onrender.com";
export const WS_BASE = import.meta.env.VITE_WS_URL || "wss://chatapp-backend-chyk.onrender.com";

/**
 * Formats raw server responses (including HTML status pages) into clean, human-readable error messages.
 */
function parseErrorMessage(response, data) {
    if (response.status === 413) {
        return "The attachment size is too large. Please select a smaller file (under 25MB).";
    }
    if (response.status === 422) {
        return "Invalid request payload or form formatting. Please check your details and try again.";
    }
    if (response.status === 401) {
        return "Your session has expired. Please log in again.";
    }
    if (response.status === 403) {
        return "Access denied. You do not have permission for this request.";
    }
    if (response.status === 404) {
        return "The requested backend route or resource was not found.";
    }
    if (response.status >= 500) {
        return "A backend server error occurred. Please try again in a few moments.";
    }

    if (data && typeof data === "object") {
        if (data.message) return data.message;
        if (data.error) return data.error;
    }

    if (typeof data === "string" && data.trim()) {
        // Strip raw HTML markup if returned by server/proxy
        if (data.includes("<html") || data.includes("<!DOCTYPE")) {
            const titleMatch = data.match(/<title>(.*?)<\/title>/i);
            if (titleMatch && titleMatch[1]) {
                return `Server Error: ${titleMatch[1].trim()}`;
            }
            return `Request failed with server status code ${response.status}.`;
        }
        return data.trim();
    }

    return `Request failed with status ${response.status}. Please try again.`;
}

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

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, config);
        
        let data;
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            try {
                data = await response.json();
            } catch {
                data = null;
            }
        } else {
            data = await response.text().catch(() => "");
        }

        if (!response.ok) {
            const errMsg = parseErrorMessage(response, data);
            throw new Error(errMsg);
        }

        return data;
    } catch (err) {
        if (err.name === "TypeError" || err.message?.includes("Failed to fetch") || err.message?.includes("NetworkError")) {
            throw new Error("Unable to connect to the FlowChat server. Please check your internet connection or try again later.");
        }
        throw err;
    }
}

/**
 * Uploads a file using XMLHttpRequest to provide real-time progress callbacks:
 * onProgress({ loaded, total, percentage, loadedFormatted, totalFormatted })
 */
export function uploadFileWithProgress(file, onProgress) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        formData.append("file", file);

        const token = localStorage.getItem("chat_token");

        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable && onProgress) {
                const loaded = event.loaded;
                const total = event.total;
                const percentage = Math.round((loaded / total) * 100);
                const loadedMB = (loaded / (1024 * 1024)).toFixed(1);
                const totalMB = (total / (1024 * 1024)).toFixed(1);

                onProgress({
                    loaded,
                    total,
                    percentage,
                    loadedFormatted: `${loadedMB} MB`,
                    totalFormatted: `${totalMB} MB`
                });
            }
        };

        xhr.onload = () => {
            let data;
            const contentType = xhr.getResponseHeader("content-type");
            if (contentType && contentType.includes("application/json")) {
                try {
                    data = JSON.parse(xhr.responseText);
                } catch {
                    data = null;
                }
            } else {
                data = xhr.responseText;
            }

            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(data);
            } else {
                const errMsg = parseErrorMessage({ status: xhr.status }, data);
                reject(new Error(errMsg));
            }
        };

        xhr.onerror = () => {
            reject(new Error("Network error during file upload. Please check your connection."));
        };

        xhr.open("POST", `${API_BASE}/upload`);
        if (token) {
            xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        }
        xhr.send(formData);
    });
}
