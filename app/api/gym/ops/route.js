import { NextResponse } from "next/server";
import { requireGymAdmin } from "app/lib/gymAuth";
import {
  getGymOpsSnapshot,
  listGymInvitations,
  listGymMemberships,
  removeGymMembership,
} from "app/lib/gyms";

/** GET /api/gym/ops — dashboard aggregates + roster (no session payloads) */
export async function GET(request) {
  const { error, session } = await requireGymAdmin(request);
  if (error) return error;

  const [ops, memberships, invitations] = await Promise.all([
    getGymOpsSnapshot(session.gymId),
    listGymMemberships(session.gymId),
    listGymInvitations(session.gymId),
  ]);

  return NextResponse.json({
    ok: true,
    data: {
      gymName: session.gymName,
      role: session.role,
      ops,
      memberships,
      invitations,
      privacyNote: "You manage trainer seats. Client coaching data stays private to each trainer.",
    },
  });
}

/** DELETE /api/gym/ops?membershipId= — remove trainer from gym (keeps their clients) */
export async function DELETE(request) {
  const { error, session } = await requireGymAdmin(request);
  if (error) return error;

  const membershipId = request.nextUrl.searchParams.get("membershipId");
  if (!membershipId) {
    return NextResponse.json({ ok: false, message: "membershipId required." }, { status: 400 });
  }

  const result = await removeGymMembership({ gymId: session.gymId, membershipId });
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: "Membership not found." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    data: {
      removed: true,
      note: "Trainer removed from gym seats. Their clients remain with that trainer.",
    },
  });
}
