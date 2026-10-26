import type { Metadata } from "next";

import { LinkedInCallback } from "@/components/achievements/linkedin-callback";

export const metadata: Metadata = { title: "Connecting LinkedIn" };

/** LinkedIn sends the browser back here after "Connect LinkedIn" (register this URL on the LinkedIn app). */
export default async function LinkedInCallbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { code, state, error_description } = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  return <LinkedInCallback code={one(code)} state={one(state)} denied={one(error_description)} />;
}
