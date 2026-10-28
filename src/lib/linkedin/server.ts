
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server half of LinkedIn posting, used by the route handlers in
 * src/app/api/linkedin. Every post goes out from one central LinkedIn
 * account that the PBL office connects; its token is kept encrypted with a
 * key that only exists here, so no one in the portal can read or reuse it.
 * The LinkedIn app's client secret only lives here too.
 *
 * Every request carries the caller's Supabase access token, and the database
 * is queried as that user, so row-level security still decides what they may
 * read or change - no service-role key is needed.
 */

export const SCOPES = "openid profile w_member_social";

export function linkedInConfig() {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new HttpError(
      503,
      "LinkedIn posting is not set up yet: add LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET to the environment.",
    );
  }
  return { clientId, clientSecret };
}

/** Must match a redirect URL registered on the LinkedIn app exactly. */
export function redirectUri(request: Request): string {
  return process.env.LINKEDIN_REDIRECT_URI ?? `${new URL(request.url).origin}/linkedin/callback`;
}

/**
 * LinkedIn's versioned API wants a YYYYMM version; each is served for about a
 * year. Default to two months back so a fresh release is never asked for.
 */
function apiVersion(): string {
  if (process.env.LINKEDIN_API_VERSION) return process.env.LINKEDIN_API_VERSION;
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 2);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Turns a thrown error into the JSON reply the client expects. */
export function errorResponse(e: unknown): Response {
  const status = e instanceof HttpError ? e.status : 500;
  const message = e instanceof Error ? e.message : "Something went wrong.";
  return Response.json({ error: message }, { status });
}

/** The signed-in portal user behind the request, and a database client acting as them. */
export async function portalUser(request: Request): Promise<{ db: SupabaseClient; userId: string }> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new HttpError(401, "Sign in again to continue.");
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "Sign in again to continue.");
  return { db, userId: data.user.id };
}

/** The PBL office only: they connect and disconnect the central account. */
export async function requireAdmin(db: SupabaseClient, userId: string) {
  const { data } = await db.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (data?.role !== "admin") throw new HttpError(403, "Only the administrator can connect the portal's LinkedIn account.");
}

/* -------------------------------------------------------- token at rest */

/** AES-256-GCM key, from LINKEDIN_TOKEN_KEY or else derived from the client secret. */
function tokenKey(): Buffer {
  const base = process.env.LINKEDIN_TOKEN_KEY ?? linkedInConfig().clientSecret;
  return createHash("sha256").update(`linkedin-token:${base}`).digest();
}

export function sealToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", tokenKey(), iv);
  const data = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

export function openToken(sealed: string): string {
  try {
    const [iv, tag, data] = sealed.split(".").map((p) => Buffer.from(p, "base64url"));
    const decipher = createDecipheriv("aes-256-gcm", tokenKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    throw new HttpError(401, "The portal's LinkedIn connection can no longer be read. The administrator needs to connect LinkedIn again.");
  }
}

/** The central account's member id and usable token, for posting. */
export async function centralAccount(db: SupabaseClient): Promise<{ memberUrn: string; accessToken: string }> {
  const { data, error } = await db.rpc("linkedin_credentials");
  if (error) throw new HttpError(500, error.message);
  const row = (data as { member_urn: string; token_enc: string; expires_at: string }[] | null)?.[0];
  if (!row) throw new HttpError(412, "The portal's LinkedIn account is not connected yet. The administrator connects it.");
  if (new Date(row.expires_at) <= new Date()) {
    throw new HttpError(401, "The portal's LinkedIn connection has expired. The administrator needs to connect LinkedIn again.");
  }
  return { memberUrn: row.member_urn, accessToken: openToken(row.token_enc) };
}

/* ------------------------------------------------------------- state */

const b64 = (s: string) => Buffer.from(s).toString("base64url");
const sign = (payload: string, secret: string) => createHmac("sha256", secret).update(payload).digest("base64url");

/** OAuth `state`: who started the connection and where to return, signed and valid for 10 minutes. */
export function makeState(userId: string, returnTo: string, secret: string): string {
  const payload = b64(JSON.stringify({ u: userId, r: returnTo, e: Date.now() + 10 * 60_000 }));
  return `${payload}.${sign(payload, secret)}`;
}

export function readState(state: string, secret: string): { userId: string; returnTo: string } {
  const [payload, mac] = state.split(".");
  const expected = payload ? sign(payload, secret) : "";
  if (!mac || mac.length !== expected.length || !timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) {
    throw new HttpError(400, "The LinkedIn sign-in could not be verified. Try connecting again.");
  }
  const { u, r, e } = JSON.parse(Buffer.from(payload, "base64url").toString());
  if (Date.now() > e) throw new HttpError(400, "The LinkedIn sign-in took too long. Try connecting again.");
  return { userId: u, returnTo: r };
}

/** Only paths inside the portal, so the state can't send anyone elsewhere. */
export const safeReturnTo = (path: unknown) =>
  typeof path === "string" && path.startsWith("/") && !path.startsWith("//") ? path : "/";

/* ----------------------------------------------------------- LinkedIn */

async function linkedInError(response: Response, doing: string): Promise<HttpError> {
  const body = await response.text();
  let detail = body;
  try {
    detail = JSON.parse(body).message ?? JSON.parse(body).error_description ?? body;
  } catch {}
  if (response.status === 401) {
    return new HttpError(401, "The portal's LinkedIn connection has expired. The administrator needs to connect LinkedIn again.");
  }
  return new HttpError(502, `LinkedIn could not ${doing} (${response.status}): ${detail}`.slice(0, 400));
}

export async function exchangeCode(code: string, request: Request) {
  const { clientId, clientSecret } = linkedInConfig();
  const response = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(request),
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!response.ok) throw await linkedInError(response, "finish the sign-in");
  return (await response.json()) as { access_token: string; expires_in: number };
}

export async function memberProfile(accessToken: string) {
  const response = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw await linkedInError(response, "read your profile");
  return (await response.json()) as { sub: string; name?: string; picture?: string };
}

const restHeaders = (accessToken: string) => ({
  Authorization: `Bearer ${accessToken}`,
  "LinkedIn-Version": apiVersion(),
  "X-Restli-Protocol-Version": "2.0.0",
});

/** Uploads one image and returns its urn:li:image id for a post. */
export async function uploadImage(accessToken: string, owner: string, bytes: ArrayBuffer, contentType: string) {
  const init = await fetch("https://api.linkedin.com/rest/images?action=initializeUpload", {
    method: "POST",
    headers: { ...restHeaders(accessToken), "Content-Type": "application/json" },
    body: JSON.stringify({ initializeUploadRequest: { owner } }),
  });
  if (!init.ok) throw await linkedInError(init, "prepare the image upload");
  const { value } = (await init.json()) as { value: { uploadUrl: string; image: string } };

  const put = await fetch(value.uploadUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": contentType },
    body: bytes,
  });
  if (!put.ok) throw await linkedInError(put, "upload the image");
  return value.image;
}

/** Publishes a public post on the member's feed and returns its URN. */
export async function createPost(
  accessToken: string,
  author: string,
  text: string,
  image?: { urn: string; altText: string },
): Promise<string> {
  const response = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: { ...restHeaders(accessToken), "Content-Type": "application/json" },
    body: JSON.stringify({
      author,
      commentary: toCommentary(text),
      visibility: "PUBLIC",
      distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
      ...(image ? { content: { media: { id: image.urn, altText: image.altText.slice(0, 4000) } } } : {}),
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
  });
  if (!response.ok) throw await linkedInError(response, "publish the post");
  const urn = response.headers.get("x-restli-id");
  if (!urn) throw new HttpError(502, "LinkedIn accepted the post but did not return its id.");
  return urn;
}

/**
 * Post text is LinkedIn "little text": its reserved characters must be
 * escaped, and hashtags are written as {hashtag|\#|Tag} so they stay links.
 */
export function toCommentary(text: string): string {
  return text
    .split(/(#[\p{L}\p{N}]+)/u)
    .map((part, i) => (i % 2 ? `{hashtag|\\#|${part.slice(1)}}` : part.replace(/[\\|{}@[\]()<>#*_~]/g, "\\$&")))
    .join("");
}
