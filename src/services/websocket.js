import { WS_BASE } from "./api";

/**
 * WebSocket Service
 * ------------------
 * Handles initializing the real-time websocket connection with JWT authentication.
 */
export const websocketService = {
    connect(token, onMessage, onOpen, onClose, onError) {
        if (!token) {
            console.error("WebSocket connection requires an auth token.");
            return null;
        }

        // Connect with JWT passed inside query parameter
        const socket = new WebSocket(`${WS_BASE}/ws?token=${encodeURIComponent(token)}`);

        socket.onopen = (event) => {
            console.log("WebSocket connected.");
            if (onOpen) onOpen(event);
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (onMessage) onMessage(data);
            } catch (err) {
                console.error("Failed to parse WebSocket message:", err);
            }
        };

        socket.onclose = (event) => {
            console.log("WebSocket disconnected.");
            if (onClose) onClose(event);
        };

        socket.onerror = (error) => {
            console.error("WebSocket error:", error);
            if (onError) onError(error);
        };

        return socket;
    }
};
