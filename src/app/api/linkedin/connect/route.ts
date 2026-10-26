import { errorResponse, linkedInConfig, makeState, portalUser, redirectUri, safeReturnTo, SCOPES } from "@/lib/linkedin/server";

/** Starts "Connect LinkedIn": returns the LinkedIn sign-in URL to send the browser to. */
export async function POST(request: Request) {
  try {
    const { clientId, clientSecret } = linkedInConfig();
    const { userId } = await portalUser(request);
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
