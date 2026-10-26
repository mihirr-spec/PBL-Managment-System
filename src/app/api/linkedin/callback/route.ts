import {
  errorResponse,
  exchangeCode,
  HttpError,
  linkedInConfig,
  memberProfile,
  portalUser,
  readState,
  requireAdmin,
  sealToken,
} from "@/lib/linkedin/server";

/**
 * Finishes "Connect LinkedIn". The /linkedin/callback page posts the code
 * LinkedIn sent back; it is swapped for an access token here (the client
 * secret stays on the server), and the token is saved encrypted as the
 * portal's central account.
 */
export async function POST(request: Request) {
  try {
    const { clientSecret } = linkedInConfig();
    const { db, userId } = await portalUser(request);
    await requireAdmin(db, userId);
    const { code, state } = (await request.json()) as { code?: string; state?: string };
    if (!code || !state) throw new HttpError(400, "LinkedIn did not send back a sign-in code.");

    const { userId: startedBy, returnTo } = readState(state, clientSecret);
    if (startedBy !== userId) throw new HttpError(403, "This LinkedIn sign-in was started from another portal account.");

    const token = await exchangeCode(code, request);
    const member = await memberProfile(token.access_token);

    const { error } = await db.rpc("save_linkedin_account", {
      p_member_urn: `urn:li:person:${member.sub}`,
      p_name: member.name ?? "",
      p_picture: member.picture ?? null,
      p_token_enc: sealToken(token.access_token),
      p_expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
    });
    if (error) throw new HttpError(500, error.message);

    return Response.json({ returnTo, name: member.name ?? "" });
  } catch (e) {
    return errorResponse(e);
  }
}
