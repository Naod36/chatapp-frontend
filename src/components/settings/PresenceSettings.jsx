import { useEffect, useState } from "react";
import { userService } from "../../services/user";
import { presenceFields, statusExpiry } from "../../utils/presence";
import ChoiceMenu from "../ChoiceMenu";

export default function PresenceSettings({ profile, onSaved, themeTokens: theme }) {
  const [draft, setDraft] = useState(() => presenceFields(profile));
  const [expiry, setExpiry] = useState("keep");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    setDraft(presenceFields(profile));
    setExpiry("keep");
  }, [profile.presence_visibility, profile.custom_status, profile.status_emoji, profile.status_expires_at]);
  const fieldStyle = { background: theme.inputBg, border: theme.inputBorder, color: theme.text, width: "100%", minWidth: 0 };
  const save = async () => {
    setSaving(true);
    setMessage("");
    try {
      const result = await userService.updatePresence({
        presence_visibility: draft.presence_visibility || "default",
        custom_status: draft.custom_status || "",
        status_emoji: draft.status_emoji || "",
        status_expires_at: statusExpiry(expiry, draft.status_expires_at),
      });
      onSaved(result);
      setMessage("Status saved");
    } catch (error) {
      setMessage(error.message || "Unable to save status");
    } finally {
      setSaving(false);
    }
  };
  return (
    <section aria-label="Presence and status" style={{ display: "grid", gap: 12, padding: "16px 0", color: theme.text }}>
      <h3 style={{ margin: 0, fontSize: 16 }}>Presence and status</h3>
      <label className="ht-form-label">Visibility
        <ChoiceMenu label="Presence visibility" themeTokens={theme} disabled={saving} value={draft.presence_visibility || "default"} onChange={(value) => setDraft({ ...draft, presence_visibility: value })} options={[{ value: "default", label: "Default (online and last seen)" }, { value: "invisible", label: "Invisible (hide online and last seen)" }]} />
      </label>
      <label className="ht-form-label">Status
        <ChoiceMenu label="Status preset" themeTokens={theme} disabled={saving} value={["", "Busy", "Sleeping", "Away"].includes(draft.custom_status || "") ? draft.custom_status || "" : "custom"} onChange={(value) => setDraft({ ...draft, custom_status: value === "custom" ? "Custom status" : value, status_emoji: "" })} options={[{ value: "", label: "None" }, ...["Busy", "Sleeping", "Away"].map((value) => ({ value, label: value })), { value: "custom", label: "Custom" }]} />
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "72px minmax(0, 1fr)", gap: 8 }}>
        <input aria-label="Status emoji" placeholder="Emoji" className="ht-form-input" style={fieldStyle} disabled={saving} maxLength={16} value={draft.status_emoji || ""} onChange={(event) => setDraft({ ...draft, status_emoji: event.target.value })} />
        <input aria-label="Custom status" placeholder="Custom status" className="ht-form-input" style={fieldStyle} disabled={saving} maxLength={80} value={draft.custom_status || ""} onChange={(event) => setDraft({ ...draft, custom_status: event.target.value })} />
      </div>
      <label className="ht-form-label">Clear status after
        <ChoiceMenu label="Clear status after" themeTokens={theme} disabled={saving} value={expiry} onChange={setExpiry} options={[{ value: "keep", label: draft.status_expires_at ? "Keep current expiry" : "Never" }, { value: "1", label: "1 hour" }, { value: "8", label: "8 hours" }, { value: "today", label: "Today" }, { value: "never", label: "Never" }]} />
      </label>
      <button type="button" disabled={saving} onClick={save} style={{ padding: 10, borderRadius: 6, border: theme.border, background: theme.accent, color: "white", cursor: "pointer" }}>{saving ? "Saving..." : "Save status"}</button>
      {!!message && <span role="status" style={{ fontSize: 13 }}>{message}</span>}
    </section>
  );
}