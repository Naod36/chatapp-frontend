import React from "react";
import { API_BASE } from "../services/api";

export const THEME = {
    light: {
        sidebarBg: "#f6f7f9",
        chatBg: "#eceef1",
        inspectorBg: "#ffffff",
        border: "1px solid rgba(0, 0, 0, 0.06)",
        cardBg: "#ffffff",
        text: "#14171a",
        textMuted: "#657786",
        accent: "#03346E",
        accentHover: "#022854",
        inputBg: "#ffffff",
        bubbleSent: "#03346E",
        bubbleSentText: "#ffffff",
        bubbleRecv: "#ffffff",
        bubbleRecvText: "#14171a",
        inputBorder: "1px solid rgba(0, 0, 0, 0.08)"
    },
    dark: {
        sidebarBg: "#121316",
        chatBg: "#16171b",
        inspectorBg: "#1a1c20",
        border: "1px solid rgba(255, 255, 255, 0.06)",
        cardBg: "#1e2126",
        text: "#e1e8ed",
        textMuted: "#8899a6",
        accent: "#03346E",
        accentHover: "#022854",
        inputBg: "#131417",
        bubbleSent: "#03346E",
        bubbleSentText: "#ffffff",
        bubbleRecv: "#1e2126",
        bubbleRecvText: "#e1e8ed",
        inputBorder: "1px solid rgba(255, 255, 255, 0.08)"
    }
};

export const formatTime = (timeStr) => {
    if (!timeStr) return "";
    try {
        const date = new Date(timeStr);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
        return "";
    }
};

export const formatLastSeen = (timestamp) => {
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
    } catch {
        return "offline";
    }
};

export const renderMessageStatus = (status, isSidebar = false) => {
    const strokeColor = status === "read"
        ? "#6366f1"
        : (isSidebar ? "rgba(120, 120, 120, 0.6)" : "rgba(180, 180, 180, 0.5)");

    const svgStyle = {
        display: "inline-block",
        verticalAlign: "middle",
        flexShrink: 0,
        marginLeft: isSidebar ? 0 : 4
    };

    if (status === "read" || status === "delivered") {
        return React.createElement(
            "svg",
            { width: "15", height: "15", viewBox: "0 0 24 24", fill: "none", stroke: strokeColor, strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round", style: svgStyle },
            React.createElement("path", { d: "M18 5L7 16l-5-5" }),
            React.createElement("path", { d: "M22 5l-11 11-3-3" })
        );
    }
    if (status === "sent") {
        return React.createElement(
            "svg",
            { width: "15", height: "15", viewBox: "0 0 24 24", fill: "none", stroke: strokeColor, strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round", style: svgStyle },
            React.createElement("path", { d: "M20 6L9 17l-5-5" })
        );
    }
    // Pending / Clock
    return React.createElement(
        "svg",
        { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: strokeColor, strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round", style: svgStyle },
        React.createElement("circle", { cx: "12", cy: "12", r: "10" }),
        React.createElement("polyline", { points: "12 6 12 12 16 14" })
    );
};

export const getAssetUrl = (url) => {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) return url;
    return `${API_BASE}${url}`;
};

export const getSenderNameColor = (senderId) => {
    const colors = ["#38bdf8", "#818cf8", "#f43f5e", "#fbbf24", "#34d399", "#a78bfa", "#f472b6"];
    if (!senderId) return colors[0];
    let hash = 0;
    for (let i = 0; i < senderId.length; i++) {
        hash = senderId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};
