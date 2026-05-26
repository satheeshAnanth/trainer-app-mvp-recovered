import { randomInt } from "crypto";

const MSG91_SMS_API = "https://control.msg91.com/api/v5/flow/";

// MSG91 expects the number without +, e.g. 919876543210
function toMsg91Phone(phone) {
  return String(phone).replace(/^\+/, "");
}

export function generateOtpCode() {
  return String(randomInt(100000, 1000000));
}

export async function sendOtpViaMSG91(phone, code) {
  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_TEMPLATE_ID;

  if (!authKey || !templateId) {
    // Dev fallback: log so the developer sees the OTP without an SMS
    console.warn(`[MSG91] Keys not set — OTP for ${phone} is ${code} (dev only)`);
    return { ok: true, skipped: true };
  }

  let res;
  try {
    res = await fetch(MSG91_SMS_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authkey: authKey,
      },
      body: JSON.stringify({
        template_id: templateId,
        short_url: "0",
        recipients: [{ mobiles: toMsg91Phone(phone), VAR: code }],
      }),
    });
  } catch (err) {
    return { ok: false, error: `MSG91 network error: ${err.message}` };
  }

  let data = {};
  try {
    data = await res.json();
  } catch {
    // ignore json parse failure
  }

  if (!res.ok || data.type === "error") {
    return { ok: false, error: data.message ?? `MSG91 responded with HTTP ${res.status}` };
  }

  return { ok: true };
}
