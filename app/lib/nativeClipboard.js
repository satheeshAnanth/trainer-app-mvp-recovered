/**
 * Native-safe clipboard write. Uses Capacitor on device, browser API on web.
 */
export async function writeClipboard(text) {
  const value = String(text ?? "");
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      const { Clipboard } = await import("@capacitor/clipboard");
      await Clipboard.write({ string: value });
      return true;
    }
  } catch {
    /* fall through to web */
  }

  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}
