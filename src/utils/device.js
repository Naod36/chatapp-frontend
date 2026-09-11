// Real phone-sized mobile devices, not just narrow desktop windows.
const MOBILE_UA_REGEX =
  /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Windows Phone/i;

/**
 * Detects whether the current client is a mobile phone, using the
 * User-Agent Client Hints API where available and falling back to
 * user-agent sniffing. Deliberately ignores viewport width so that
 * resizing a desktop browser window doesn't trigger a false positive.
 */
export function isMobileDevice() {
  if (typeof navigator === "undefined") return false;

  const uaData = navigator.userAgentData;
  if (uaData && typeof uaData.mobile === "boolean") {
    return uaData.mobile;
  }

  const ua = navigator.userAgent || navigator.vendor || "";
  if (MOBILE_UA_REGEX.test(ua)) return true;

  // iPadOS 13+ reports as "Macintosh" in the UA string; treat as tablet, not phone.
  return false;
}
