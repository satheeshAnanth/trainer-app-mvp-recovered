import { acceptGymInvitation } from "app/lib/gymInviteAccept";

/** POST /api/gym-invitations/[token]/accept */
export async function POST(request, { params }) {
  return acceptGymInvitation(request, params.token);
}
