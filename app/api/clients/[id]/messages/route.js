import { NextResponse } from "next/server";
import { hasDatabaseUrl, query } from "app/lib/db";
import { readTrainerPhone } from "app/lib/session";

const MAX_BODY_LENGTH = 2000;

function trainerPhone(request) {
  return readTrainerPhone(request.cookies.get("trainer_session")?.value) ?? null;
}

/** GET /api/clients/[id]/messages — list the thread, newest first */
export async function GET(request, { params }) {
  const phone = trainerPhone(request);
  if (!phone) {
    return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });
  }

  const { id: clientId } = params;

  if (!hasDatabaseUrl()) {
    return NextResponse.json({ ok: true, data: { messages: [], source: "mock" } });
  }

  // Verify trainer owns this client
  const ownership = await query(
    `SELECT id FROM clients WHERE id = $1 AND created_by_trainer = $2 LIMIT 1`,
    [clientId, phone]
  );
  if (!ownership[0]) {
    return NextResponse.json({ ok: false, message: "Client not found." }, { status: 404 });
  }

  // Mark trainer-side reads (messages sent by client that trainer hasn't read)
  await query(
    `UPDATE client_messages
     SET read_at = NOW()
     WHERE trainer_phone = $1 AND client_id = $2 AND sender_role = 'client' AND read_at IS NULL`,
    [phone, clientId]
  );

  const rows = await query(
    `SELECT id, sender_role, body, read_at, created_at
     FROM client_messages
     WHERE trainer_phone = $1 AND client_id = $2
     ORDER BY created_at ASC`,
    [phone, clientId]
  );

  return NextResponse.json({ ok: true, data: { messages: rows } });
}

/** POST /api/clients/[id]/messages — trainer sends a message */
export async function POST(request, { params }) {
  const phone = trainerPhone(request);
  if (!phone) {
    return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });
  }

  const { id: clientId } = params;
  const body = await request.json();
  const text = String(body?.body ?? "").trim();

  if (!text) {
    return NextResponse.json({ ok: false, message: "Message body is required." }, { status: 400 });
  }
  if (text.length > MAX_BODY_LENGTH) {
    return NextResponse.json({ ok: false, message: `Message must be under ${MAX_BODY_LENGTH} characters.` }, { status: 400 });
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json({
      ok: true,
      data: { message: { id: `mock-${Date.now()}`, sender_role: "trainer", body: text, created_at: new Date().toISOString() } },
    });
  }

  const ownership = await query(
    `SELECT id FROM clients WHERE id = $1 AND created_by_trainer = $2 LIMIT 1`,
    [clientId, phone]
  );
  if (!ownership[0]) {
    return NextResponse.json({ ok: false, message: "Client not found." }, { status: 404 });
  }

  const rows = await query(
    `INSERT INTO client_messages (trainer_phone, client_id, sender_role, body)
     VALUES ($1, $2, 'trainer', $3)
     RETURNING id, sender_role, body, read_at, created_at`,
    [phone, clientId, text]
  );

  return NextResponse.json({ ok: true, data: { message: rows[0] } }, { status: 201 });
}
