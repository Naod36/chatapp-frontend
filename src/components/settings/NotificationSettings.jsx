import { useEffect, useState } from "react";
import MuteControl from "./MuteControl.jsx";

export default function NotificationSettings({ hidePreviews, setHidePreviews, folders, scopes, setScopeMute, themeTokens: t }) {
  const permission = () => "Notification" in window ? window.Notification.permission : "unsupported";
  const [status, setStatus] = useState(permission);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    const refresh = () => setStatus(permission());
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);
  const enable = async () => {
    setPending(true);
    setError(null);
    try { setStatus(await window.Notification.requestPermission()); }
    catch { setError("Could not request notification permission."); }
    finally { setPending(false); }
  };
  return <section aria-label="Notifications" style={{ color: t.text, display: "grid", gap: 12, minWidth: 0 }}>
    <h3 style={{ margin: 0, fontSize: 14 }}>Notifications</h3>
    <div role="status" style={{ fontSize: 12, color: t.textMuted }}>Browser permission: {status === "default" ? "Not requested" : status}</div>
    {status === "default" && <button type="button" disabled={pending} onClick={enable} style={{ padding: 8, borderRadius: 6, background: t.inputBg, color: t.text, border: t.inputBorder }}>{pending ? "Requesting..." : "Enable notifications"}</button>}
    {error && <p role="alert">{error}</p>}
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
      <input type="checkbox" checked={hidePreviews} onChange={(event) => setHidePreviews(event.target.checked)} />Hide notification previews
    </label>
    <div style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 13 }}>Mute all</span>
      <MuteControl label="Mute all notifications" until={scopes.all} onChange={(until) => setScopeMute("all", until)} themeTokens={t} />
    </div>
    <h4 style={{ margin: "8px 0 0", fontSize: 13 }}>Mute folders</h4>
    {!folders.length && <span style={{ fontSize: 12, color: t.textMuted }}>No folders</span>}
    {folders.map((folder) => <div key={folder.id} style={{ display: "grid", gap: 6, minWidth: 0 }}>
      <span style={{ overflowWrap: "anywhere", fontSize: 12 }}>{folder.name}</span>
      <MuteControl label={`Mute folder ${folder.name}`} until={scopes[`folder:${folder.id}`]} onChange={(until) => setScopeMute(`folder:${folder.id}`, until)} themeTokens={t} />
    </div>)}
  </section>;
}