import { centralAccount, errorResponse, portalUser, postStatus } from "@/lib/linkedin/server";

/** At most this many posts are checked per request, newest first. */
const LIMIT = 25;

/**
 * Checks the caller's posted achievements against LinkedIn. Any whose post
 * was deleted there go back to the supervisor's "Action needed" list.
 * Returns the ids that were put back.
 */
export async function POST(request: Request) {
  try {
    const { db } = await portalUser(request);
    // Read as the caller: only achievements they review (or all, for the administrator).
    const { data: posted } = await db
      .from("achievements")
      .select("id, linkedin_post_urn")
      .not("linkedin_post_urn", "is", null)
      .order("linkedin_posted_at", { ascending: false })
      .limit(LIMIT);
    if (!posted?.length) return Response.json({ removed: [] });

    let account: Awaited<ReturnType<typeof centralAccount>>;
    try {
      account = await centralAccount(db);
    } catch {
      // Not connected or expired: nothing can be checked, and that's not an error here.
      return Response.json({ removed: [] });
    }

    const statuses = await Promise.all(
      posted.map(async (a) => ({ id: a.id as string, status: await postStatus(account.accessToken, a.linkedin_post_urn) })),
    );
    const removed: string[] = [];
    for (const { id, status } of statuses) {
      if (status !== "gone") continue;
      const { error } = await db.rpc("unrecord_linkedin_post", { p_achievement: id, p_note: "Deleted on LinkedIn" });
      if (!error) removed.push(id);
    }
    return Response.json({ removed });
  } catch (e) {
    return errorResponse(e);
  }
}
