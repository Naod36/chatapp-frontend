import { groupMemberActions } from "../../../utils/groupPolicy.js";

export default function GroupMemberActions({ conversation, actorId, member, pending, onChange, themeTokens: t }) {
  const memberId = member.user_id || member.id;
  const actions = groupMemberActions(conversation, actorId, memberId);
  if (!actions.length) return null;
  const name = member.display_name || member.username || "member";
  return (
    <select
      aria-label={`Actions for ${name}`}
      value=""
      disabled={pending}
      style={{ maxWidth: "100%", minWidth: 0, width: 145, background: t.inputBg, color: t.text, border: t.inputBorder, borderRadius: 6, padding: 6, fontSize: 12 }}
      onChange={(event) => {
        const selected = actions.find((action) => action.action === event.target.value);
        if (!selected) return;
        const warning = selected.action === "transfer_ownership"
          ? `Transfer ownership to ${name}? You will remain an admin and only the new owner can transfer ownership again.`
          : selected.action === "remove_member"
            ? `Remove ${name} from this group? They will lose access to its messages.`
            : `${selected.label}: ${name}?`;
        if (window.confirm(warning)) {
          const { label, ...payload } = selected;
          onChange(conversation.id, { ...payload, target_user_id: memberId });
        }
      }}
    >
      <option value="">Member actions</option>
      {actions.map((action) => <option key={action.action} value={action.action}>{action.label}</option>)}
    </select>
  );
}