/**
 * Fixed-OTP and platform-admin phone helpers.
 * Login UI is +91 + 10 digits → canonical form +91XXXXXXXXXX.
 */

function digitsOnly(phone = "") {
  return String(phone).replace(/\D/g, "");
}

export function normalizeIndiaPhone(phone = "") {
  const digits = digitsOnly(phone);
  if (!digits) return "";
  // Explicit alias for requested admin number with an extra trailing 0
  if (digits === "93401500000" || digits === "9193401500000") {
    return "+919340150000";
  }
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  // 11-digit typos like 93401500000 → treat as +91 + first 10 when valid Indian mobile
  if (digits.length === 11 && /^[6-9]\d{9}\d$/.test(digits) && /^[6-9]\d{9}$/.test(digits.slice(0, 10))) {
    return `+91${digits.slice(0, 10)}`;
  }
  if (String(phone).startsWith("+")) return String(phone);
  return `+${digits}`;
}

function last10(phone) {
  return digitsOnly(phone).slice(-10);
}

function envPhoneLast10List(envKey) {
  return String(process.env[envKey] ?? "")
    .split(",")
    .map((p) => last10(p))
    .filter((d) => d.length === 10);
}

/** Platform ops console (/admin) phones — system record/allowlist, not URL. */
const HARDCODED_PLATFORM_ADMIN_LAST10 = [
  "9340150000", // requested platform admin (OTP 123456)
];

export function isPlatformAdminPhone(phone) {
  const d10 = last10(phone);
  if (!d10) return false;
  if (HARDCODED_PLATFORM_ADMIN_LAST10.includes(d10)) return true;
  return envPhoneLast10List("PLATFORM_ADMIN_PHONES").includes(d10);
}

/** Phones that always use OTP 123456 and skip SMS. */
export function isFixedOtpPhone(phone) {
  const digits = digitsOnly(phone);
  const d10 = last10(phone);
  if (!d10) return false;
  if (isPlatformAdminPhone(phone)) return true;
  // Legacy trainer test range +919900000…
  if (digits.startsWith("919900000") || d10.startsWith("9900000")) return true;
  // Legacy client test range +919911000…
  if (digits.startsWith("919911000") || d10.startsWith("9911000")) return true;
  return envPhoneLast10List("FIXED_OTP_PHONES").includes(d10);
}

export function fixedOtpCode() {
  return "123456";
}
