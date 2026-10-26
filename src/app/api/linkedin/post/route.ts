import { createPost, errorResponse, HttpError, portalUser, uploadImage } from "@/lib/linkedin/server";

/** LinkedIn takes JPG, PNG and GIF images in a post. */
const IMAGE_TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif" };

/** LinkedIn's limit on post text. */
const MAX_LENGTH = 3000;

/**
 * Publishes an approved achievement's post on the caller's LinkedIn, with an
 * optional image from its proof documents, and records it on the achievement.
 */
export async function POST(request: Request) {
  try {
    const { db, userId } = await portalUser(request);
    const { achievementId, text, imagePath } = (await request.json()) as {
      achievementId?: string;
      text?: string;
      imagePath?: string;
    };
    const body = (text ?? "").trim();
    if (!achievementId) throw new HttpError(400, "Which achievement should be posted?");
    if (!body) throw new HttpError(400, "Write the post first.");
    if (body.length > MAX_LENGTH) throw new HttpError(400, `LinkedIn posts can be at most ${MAX_LENGTH} characters.`);

    // Read as the caller: row-level security hides achievements they don't review.
    const { data: achievement } = await db
      .from("achievements")
      .select("id, title, status, documents, linkedin_post_urn")
      .eq("id", achievementId)
      .maybeSingle();
    if (!achievement) throw new HttpError(404, "That achievement was not found.");
    if (achievement.status !== "approved") throw new HttpError(409, "Only approved achievements can be posted.");
    if (achievement.linkedin_post_urn) throw new HttpError(409, "This achievement is already on LinkedIn.");

    const { data: account } = await db
      .from("linkedin_accounts")
      .select("member_urn, access_token, expires_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (!account) throw new HttpError(412, "Connect your LinkedIn account first.");
    if (new Date(account.expires_at) <= new Date()) {
      throw new HttpError(401, "Your LinkedIn connection has expired. Connect LinkedIn again.");
    }

    let image: { urn: string; altText: string } | undefined;
    if (imagePath) {
      const doc = (achievement.documents as { path: string; name: string }[]).find((d) => d.path === imagePath);
      const type = IMAGE_TYPES[doc?.name.split(".").pop()?.toLowerCase() ?? ""];
      if (!doc || !type) throw new HttpError(400, "Pick a JPG, PNG or GIF from the achievement's documents.");
      const { data: file, error } = await db.storage.from("achievements").download(doc.path);
      if (error || !file) throw new HttpError(500, "Could not read the image from storage.");
      const urn = await uploadImage(account.access_token, account.member_urn, await file.arrayBuffer(), type);
      image = { urn, altText: achievement.title };
    }

    const urn = await createPost(account.access_token, account.member_urn, body, image);

    const { error } = await db.rpc("record_linkedin_post", { p_achievement: achievementId, p_urn: urn });
    // Already live on LinkedIn, so report success with the link either way.
    if (error) console.error("record_linkedin_post", error.message);

    return Response.json({ urn, url: `https://www.linkedin.com/feed/update/${urn}/` });
  } catch (e) {
    return errorResponse(e);
  }
}
