export const MAX_UPLOAD_BYTES = 50_000_000;
export const MAX_UPLOAD_LABEL = "50 MB";
export const UPLOAD_SIZE_ERROR = `Attachments must be ${MAX_UPLOAD_LABEL} or smaller.`;
export const UPLOAD_REJECTED_ERROR = `The server rejected this upload as too large. The app limit is ${MAX_UPLOAD_LABEL}; the hosting or storage service may enforce a lower limit.`;

export function validateUploadSize(file) {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error(UPLOAD_SIZE_ERROR);
}