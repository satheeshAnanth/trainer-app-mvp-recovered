import { hasDatabaseUrl, query } from "app/lib/db";

// Max OTP sends per phone per hour
const OTP_SEND_LIMIT = 5;
// Max OTP verify attempts per phone per hour (across all codes)
const OTP_VERIFY_LIMIT = 10;

/**
 * Check whether a phone has hit the OTP send rate limit.
 * Uses the existing otp_codes table — no new table required.
 * Returns { limited: true, retryAfterSeconds } when over limit.
 */
export async function checkOtpSendLimit(phone) {
  if (!hasDatabaseUrl()) return { limited: false };

  const rows = await query(
    `SELECT COUNT(*)::int AS cnt,
            MIN(created_at) AS oldest
     FROM otp_codes
     WHERE phone = $1
       AND created_at > NOW() - INTERVAL '1 hour'`,
    [phone]
  );

  const { cnt, oldest } = rows[0] ?? { cnt: 0, oldest: null };
  if (cnt >= OTP_SEND_LIMIT) {
    const retryAfterSeconds = oldest
      ? Math.ceil(3600 - (Date.now() - new Date(oldest).getTime()) / 1000)
      : 3600;
    return { limited: true, retryAfterSeconds: Math.max(0, retryAfterSeconds) };
  }

  return { limited: false };
}

/**
 * Check whether a phone has hit the OTP verify rate limit.
 * Counts total attempts across all codes in the last hour.
 */
export async function checkOtpVerifyLimit(phone) {
  if (!hasDatabaseUrl()) return { limited: false };

  const rows = await query(
    `SELECT COALESCE(SUM(attempts), 0)::int AS total_attempts,
            MIN(created_at) AS oldest
     FROM otp_codes
     WHERE phone = $1
       AND created_at > NOW() - INTERVAL '1 hour'`,
    [phone]
  );

  const { total_attempts, oldest } = rows[0] ?? { total_attempts: 0, oldest: null };
  if (total_attempts >= OTP_VERIFY_LIMIT) {
    const retryAfterSeconds = oldest
      ? Math.ceil(3600 - (Date.now() - new Date(oldest).getTime()) / 1000)
      : 3600;
    return { limited: true, retryAfterSeconds: Math.max(0, retryAfterSeconds) };
  }

  return { limited: false };
}
