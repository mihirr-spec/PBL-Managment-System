"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

import { finishLinkedInConnect } from "@/lib/data/repository";

/** Swaps LinkedIn's sign-in code for a saved connection, then goes back to where it started. */
export function LinkedInCallback({ code, state, denied }: { code: string; state: string; denied: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(
    denied ? `LinkedIn was not connected: ${denied}` : !code ? "LinkedIn did not send back a sign-in code." : null,
  );
  // The code works once; React's dev double-effect must not send it twice.
  const sent = useRef(false);

  useEffect(() => {
    if (error || sent.current) return;
    sent.current = true;
    finishLinkedInConnect(code, state).then(
      (returnTo) => router.replace(returnTo),
      (e: unknown) => setError(e instanceof Error ? e.message : "Could not connect LinkedIn."),
    );
  }, [code, state, error, router]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-ivory-100 p-6">
      <div className="w-full max-w-sm rounded-[20px] bg-white p-6 text-center shadow-[0_30px_80px_-40px_rgba(13,31,63,0.5)]">
        {error ? (
          <>
            <AlertCircle className="mx-auto size-6 text-clay-500" />
            <p role="alert" className="mt-3 text-[14px] text-ink-800">{error}</p>
            <Link href="/" className="mt-4 inline-block text-[13.5px] text-azure-600 hover:underline">
              Back to the portal
            </Link>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto size-6 animate-spin text-azure-600" />
            <p className="mt-3 text-[14px] text-ink-800">Connecting your LinkedIn account…</p>
          </>
        )}
      </div>
    </main>
  );
}
