"use client";

import { useEffect, useState } from "react";
import { KeyRound, X } from "lucide-react";

import { PasswordReset } from "@/components/auth/password-reset";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth/session";

/** "Change password" for any signed-in user: a code is emailed, then the new password is set. */
export function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const { user } = useSession();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!user) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-password-title"
        className="animate-fade-rise w-full max-w-md rounded-2xl border border-white bg-white p-6 shadow-[0_24px_60px_-24px_rgba(13,31,63,0.55)]"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="change-password-title" className="font-display text-xl tracking-tight text-ink-900">
            Change password
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-stone-400 hover:text-ink-800">
            <X className="size-4" />
          </button>
        </div>
        <PasswordReset email={user.email} onDone={onClose} onBack={onClose} backLabel="Cancel" />
      </div>
    </div>
  );
}

/** A button that opens the Change password dialog. */
export function ChangePasswordButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" size="sm" className="bg-white/70 backdrop-blur-md" onClick={() => setOpen(true)}>
        <KeyRound className="size-3.5" />
        Change password
      </Button>
      {open ? <ChangePasswordDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}
