import {
  errorResponse,
  linkedInConfig,
  makeState,
  portalUser,
  redirectUri,
  requireAdmin,
  safeReturnTo,
  SCOPES,
} from "@/lib/linkedin/server";

/**
 * PBL office starts "Connect LinkedIn" for the portal's central account:
 * returns the LinkedIn sign-in URL to send the browser to. They sign in there
 * with the central account, so its password never passes through the portal.
 */
export async function POST(request: Request) {
  try {
    const { clientId, clientSecret } = linkedInConfig();
    const { db, userId } = await portalUser(request);
    await requireAdmin(db, userId);
    const { returnTo } = (await request.json().catch(() => ({}))) as { returnTo?: string };

    const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
    url.search = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri(request),
      state: makeState(userId, safeReturnTo(returnTo), clientSecret),
      scope: SCOPES,
    }).toString();
    return Response.json({ url: url.toString() });
  } catch (e) {
    return errorResponse(e);
  }
}
