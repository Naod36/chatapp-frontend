import ChoiceMenu from "../ChoiceMenu.jsx";
import { isMutedUntil } from "../../utils/notificationPreferences.js";

export const muteOptions = [
  { value: "off", label: "Not muted" },
  { value: "3600000", label: "For 1 hour" },
  { value: "28800000", label: "For 8 hours" },
  { value: "86400000", label: "For 24 hours" },
  { value: "forever", label: "Until unmuted" },
];
export const muteValue = (choice) => choice === "off" ? false : choice === "forever" ? true : Date.now() + Number(choice);

export default function MuteControl({ label, until, onChange, themeTokens }) {
  const value = !isMutedUntil(until) ? "off" : until === true ? "forever" : "current";
  const options = value === "current" ? [{ value: "current", label: `Until ${new Date(until).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`, disabled: true }, ...muteOptions] : muteOptions;
  return <ChoiceMenu label={label} value={value} options={options} onChange={(choice) => onChange(muteValue(choice))} themeTokens={themeTokens} />;
}