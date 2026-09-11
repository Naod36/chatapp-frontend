import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { apiFetch, API_BASE } from "../services/api";
import { SunIcon, MoonIcon } from "./AuthScreen";

const THEME = {
  light: {
    pageBg: "radial-gradient(circle at 50% 50%, #f4f7fb 0%, #e2e8f0 100%)",
    cardBg: "rgba(255, 255, 255, 0.9)",
    cardBorder: "1.5px solid rgba(3, 52, 110, 0.12)",
    cardShadow:
      "0 25px 65px rgba(2, 21, 38, 0.08), 0 5px 15px rgba(2, 21, 38, 0.04)",
    text: "#021526",
    textMuted: "#64748b",
    inputBorder: "rgba(3, 52, 110, 0.15)",
    innerCardBg: "#ffffff",
    innerCardBorder: "1px solid rgba(0, 0, 0, 0.06)",
  },
  dark: {
    pageBg: "radial-gradient(circle at 50% 50%, #031c33 0%, #021526 100%)",
    cardBg: "rgba(2, 21, 38, 0.9)",
    cardBorder: "1.5px solid rgba(110, 172, 218, 0.2)",
    cardShadow: "0 25px 65px rgba(0, 0, 0, 0.6)",
    text: "#e2e8f0",
    textMuted: "#94a3b8",
    inputBorder: "rgba(110, 172, 218, 0.2)",
    innerCardBg: "#1a1c20",
    innerCardBorder: "1px solid rgba(255, 255, 255, 0.06)",
  },
};

/**
 * Full-screen gate shown to mobile-device visitors, pointing them to the
 * native FlowChat app instead of the desktop-oriented web chat UI.
 * Reuses the same latest-release/QR pipeline as the desktop sidebar's
 * "Download App" panel.
 */
export default function MobileAppGate({ onContinueAnyway }) {
  const [theme, setTheme] = useState("light");
  const [latestRelease, setLatestRelease] = useState(null);
  const [isLoadingRelease, setIsLoadingRelease] = useState(true);
  const t = THEME[theme];

  const rootRef = useRef(null);

  useEffect(() => {
    apiFetch("/releases/latest?platform=android")
      .then((data) => setLatestRelease(data))
      .catch(() => setLatestRelease(null))
      .finally(() => setIsLoadingRelease(false));
  }, []);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(".fx-stagger", {
        opacity: 0,
        y: 16,
        duration: 0.6,
        stagger: 0.08,
        ease: "power3.out",
      });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  const downloadUrl = latestRelease
    ? `${API_BASE}/releases/${latestRelease.id}/download`
    : null;

  return (
    <div
      ref={rootRef}
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
        background: t.pageBg,
        fontFamily:
          "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 420,
          background: t.cardBg,
          borderRadius: 24,
          border: t.cardBorder,
          boxShadow: t.cardShadow,
          padding: "36px 28px",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
      >
        <button
          onClick={() => setTheme((cur) => (cur === "light" ? "dark" : "light"))}
          style={{
            position: "absolute",
            top: 20,
            right: 20,
            border: `1.5px solid ${t.inputBorder}`,
            background: t.cardBg,
            color: t.text,
            borderRadius: "50%",
            width: 38,
            height: 38,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          {theme === "light" ? (
            <MoonIcon color={t.text} />
          ) : (
            <SunIcon color={t.text} />
          )}
        </button>

        <div
          className="fx-stagger"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 20,
          }}
        >
          <svg
            width="30"
            height="30"
            viewBox="0 0 24 24"
            fill="none"
            style={{ color: t.text }}
          >
            <path d="M5.5 17L9.5 7H13.5L9.5 17H5.5Z" fill="currentColor" />
            <path d="M12.5 17L16.5 7H20.5L16.5 17H12.5Z" fill="currentColor" />
          </svg>
          <span style={{ fontSize: 20, fontWeight: 800, color: t.text }}>
            FlowChat
          </span>
        </div>

        <h1
          className="fx-stagger"
          style={{
            margin: "0 0 8px",
            color: t.text,
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: "-0.3px",
          }}
        >
          Get the FlowChat app
        </h1>
        <p
          className="fx-stagger"
          style={{
            margin: "0 0 24px",
            color: t.textMuted,
            fontSize: 14,
            lineHeight: 1.5,
          }}
        >
          You're on a mobile device. The web app is built for desktop, so for
          the best chat experience, install our native Android app instead.
        </p>

        <div
          className="fx-stagger"
          style={{
            background: t.innerCardBg,
            borderRadius: 16,
            border: t.innerCardBorder,
            padding: 20,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 14,
          }}
        >
          {isLoadingRelease ? (
            <div style={{ padding: "20px 0", color: t.textMuted, fontSize: 13 }}>
              Loading latest release...
            </div>
          ) : latestRelease ? (
            <>
              <div
                style={{
                  background: "#ffffff",
                  padding: 10,
                  borderRadius: 16,
                  boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
                }}
              >
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(downloadUrl)}`}
                  alt="Scan to download the FlowChat Android app"
                  style={{ width: 150, height: 150, display: "block" }}
                />
              </div>
              <div style={{ fontSize: 12, color: t.textMuted, textAlign: "center" }}>
                Scan with your phone's camera, or tap below
              </div>
              <a
                href={downloadUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  width: "100%",
                  padding: "13px",
                  borderRadius: 9999,
                  background: "linear-gradient(135deg, #10b981, #059669)",
                  color: "#ffffff",
                  fontWeight: 800,
                  fontSize: 14,
                  textDecoration: "none",
                  boxShadow: "0 6px 20px rgba(16, 185, 129, 0.3)",
                }}
              >
                <svg
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                <span>Download APK (v{latestRelease.version})</span>
              </a>
            </>
          ) : (
            <div style={{ padding: "12px 0", color: t.textMuted, fontSize: 13, textAlign: "center" }}>
              No Android release is currently published. Please check back
              soon.
            </div>
          )}
        </div>

        <button
          className="fx-stagger"
          onClick={onContinueAnyway}
          style={{
            display: "block",
            width: "100%",
            marginTop: 20,
            padding: "12px",
            borderRadius: 9999,
            background: "transparent",
            border: `1.5px solid ${t.inputBorder}`,
            color: t.textMuted,
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Continue to the desktop site anyway
        </button>
      </div>
    </div>
  );
}
