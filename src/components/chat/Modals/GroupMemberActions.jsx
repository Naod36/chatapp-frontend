import { groupMemberActions } from "../../../utils/groupPolicy.js";
import ChoiceMenu from "../../ChoiceMenu.jsx";

export default function GroupMemberActions({ conversation, actorId, member, pending, onChange, themeTokens: t }) {
  const memberId = member.user_id || member.id;
  const actions = groupMemberActions(conversation, actorId, memberId);
  if (!actions.length) return null;
  const name = member.display_name || member.username || "member";
  return (
    <ChoiceMenu
      label={`Actions for ${name}`}
      value=""
      disabled={pending}
      placeholder="Member actions"
      actions
      themeTokens={t}
      options={actions.map((action) => ({ value: action.action, label: action.label }))}
      onChange={(value) => {
        const selected = actions.find((action) => action.action === value);
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
    />
  );
}