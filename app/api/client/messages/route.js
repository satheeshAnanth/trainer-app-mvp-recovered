import { NextResponse } from "next/server";
import { hasDatabaseUrl, query } from "app/lib/db";
import { readClientSession } from "app/lib/session";

const MAX_BODY_LENGTH = 2000;

function clientSession(request) {
  return readClientSession(request.cookies.get("client_session")?.value) ?? null;
}

/** GET /api/client/messages — client fetches their thread with their trainer */
export async function GET(request) {
  const session = clientSession(request);
  if (!session?.clientId) {
    return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json({ ok: true, data: { messages: [], source: "mock" } });
  }

  // Resolve trainer phone from the client record
  const clientRows = await query(
    `SELECT id, created_by_trainer AS trainer_phone FROM clients WHERE id = $1 LIMIT 1`,
    [session.clientId]
  );
  const client = clientRows[0];
  if (!client?.trainer_phone) {
    return NextResponse.json({ ok: false, message: "Client record not found." }, { status: 404 });
  }

  // Mark client-side reads (messages sent by trainer that client hasn't read)
  await query(
    `UPDATE client_messages
     SET read_at = NOW()
     WHERE trainer_phone = $1 AND client_id = $2 AND sender_role = 'trainer' AND read_at IS NULL`,
    [client.trainer_phone, session.clientId]
  );

  const rows = await query(
    `SELECT id, sender_role, body, read_at, created_at
     FROM client_messages
     WHERE trainer_phone = $1 AND client_id = $2
     ORDER BY created_at ASC`,
    [client.trainer_phone, session.clientId]
  );

  return NextResponse.json({ ok: true, data: { messages: rows, trainerPhone: client.trainer_phone } });
}

/** POST /api/client/messages — client sends a message to their trainer */
export async function POST(request) {
  const session = clientSession(request);
  if (!session?.clientId) {
    return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });
  }

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
      data: { message: { id: `mock-${Date.now()}`, sender_role: "client", body: text, created_at: new Date().toISOString() } },
    });
  }

  const clientRows = await query(
    `SELECT id, created_by_trainer AS trainer_phone FROM clients WHERE id = $1 LIMIT 1`,
    [session.clientId]
  );
  const client = clientRows[0];
  if (!client?.trainer_phone) {
    return NextResponse.json({ ok: false, message: "Client record not found." }, { status: 404 });
  }

  const rows = await query(
    `INSERT INTO client_messages (trainer_phone, client_id, sender_role, body)
     VALUES ($1, $2, 'client', $3)
     RETURNING id, sender_role, body, read_at, created_at`,
    [client.trainer_phone, session.clientId, text]
  );

  return NextResponse.json({ ok: true, data: { message: rows[0] } }, { status: 201 });
}
