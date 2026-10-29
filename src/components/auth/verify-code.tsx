"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AlertCircle, Loader2, MailCheck } from "lucide-react";

import { HOME_BY_ROLE } from "@/lib/auth/session";
import { resendConfirmation, verifySignupCode } from "@/lib/data/repository";

/**
 * Asks for the code from the verification email. A correct code verifies the
 * account and signs it in, then opens that role's dashboard.
 */
export function VerifyCode({ email, onBack }: { email: string; onBack?: () => void }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!/^\d{6,10}$/.test(code.replace(/\s/g, ""))) {
      setError("Enter the code from the email. It is made of digits only.");
      return;
    }
    setBusy(true);
    const result = await verifySignupCode(email, code);
    if (result.ok) {
      router.replace(HOME_BY_ROLE[result.user.role]);
      return;
    }
    setBusy(false);
    setError(result.error);
  }

  async function resend() {
    setError(null);
    const result = await resendConfirmation(email);
    if (result.ok) {
      setCode("");
      setNotice("We sent a new code. Use the code in the latest email.");
    } else {
      setError(result.error);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4 text-center" noValidate>
      <MailCheck className="mx-auto size-10 text-azure-600" strokeWidth={1.5} />
      <p className="text-[15px] text-ink-900">
        We sent a verification code to <span className="font-semibold">{email}</span>.
      </p>
      <p className="text-[13.5px] text-stone-600">
        Enter it below to activate your account. Check your spam folder if it has not arrived in a few minutes.
      </p>

      <input
        aria-label="Verification code"
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        maxLength={10}
        placeholder="Code"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, ""))}
        className="h-12 w-full rounded-lg border border-[#c9d1dc] bg-white/90 px-4 text-center text-[20px] font-semibold tracking-[0.4em] text-ink-900 placeholder:text-[15px] placeholder:font-normal placeholder:tracking-normal placeholder:text-stone-400 focus:border-azure-500 focus:outline-none focus:ring-3 focus:ring-azure-100"
      />

      {error ? (
        <p role="alert" className="flex items-start gap-2 rounded-lg bg-clay-100/80 px-3.5 py-3 text-left text-[14px] text-clay-500">
          <AlertCircle className="mt-px size-4 shrink-0" />
          {error}
        </p>
      ) : null}
      {notice ? <p role="status" className="text-[13.5px] text-sage-500">{notice}</p> : null}

      <button
        type="submit"
        disabled={busy}
        className="flex h-11 w-full items-center justify-center gap-2.5 rounded-lg bg-[linear-gradient(90deg,#173b7e_0%,#1d4b93_55%,#2f62a6_100%)] text-[16px] font-medium text-white shadow-[0_14px_30px_-18px_rgba(13,31,63,0.95)] transition-[filter,transform] hover:brightness-110 active:translate-y-px disabled:pointer-events-none disabled:opacity-70"
      >
        {busy ? (
          <>
            <Loader2 className="size-[18px] animate-spin" aria-hidden />
            Verifying
          </>
        ) : (
          "Verify and sign in"
        )}
      </button>

      <div className="flex items-center justify-center gap-4 text-[13.5px]">
        <button type="button" onClick={() => void resend()} className="text-azure-600 hover:underline">
          Send a new code
        </button>
        {onBack ? (
          <button type="button" onClick={onBack} className="text-stone-500 hover:underline">
            Back
          </button>
        ) : null}
      </div>
    </form>
  );
}
