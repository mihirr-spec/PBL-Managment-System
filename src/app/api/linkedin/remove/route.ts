import { centralAccount, deletePost, errorResponse, HttpError, portalUser } from "@/lib/linkedin/server";

/**
 * Takes an achievement's post down from LinkedIn and puts the achievement back
 * in the supervisor's "Action needed" list. Called by the reviewing
 * supervisor or the administrator.
 */
export async function POST(request: Request) {
  try {
    const { db } = await portalUser(request);
    const { achievementId } = (await request.json()) as { achievementId?: string };
    if (!achievementId) throw new HttpError(400, "Which achievement's post should be removed?");

    // Read as the caller: row-level security hides achievements they don't review.
    const { data: achievement } = await db
      .from("achievements")
      .select("id, linkedin_post_urn")
      .eq("id", achievementId)
      .maybeSingle();
    if (!achievement) throw new HttpError(404, "That achievement was not found.");
    if (!achievement.linkedin_post_urn) return Response.json({ removed: true });

    const account = await centralAccount(db);
    await deletePost(account.accessToken, achievement.linkedin_post_urn);

    const { error } = await db.rpc("unrecord_linkedin_post", { p_achievement: achievementId, p_note: "Removed from LinkedIn" });
    if (error) throw new HttpError(500, error.message);
    return Response.json({ removed: true });
  } catch (e) {
    return errorResponse(e);
  }
}
