import { apiFetch } from "./api";

export const organizationService = {
  get: () => apiFetch("/conversation-organization", { signal: AbortSignal.timeout(15000) }),
  update: (change) => apiFetch("/conversation-organization", {
    method: "PATCH",
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify(change),
  }),
};