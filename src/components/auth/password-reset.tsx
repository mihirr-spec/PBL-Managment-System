"use client";

import { useState, type FormEvent } from "react";
import { AlertCircle, CheckCircle2, KeyRound, MailCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { resetPasswordWithCode, sendPasswordCode } from "@/lib/data/repository";

/**
 * Sets a new password with a one-time code sent to the university email.
 * Used for "Forgot password?" on the sign-in page and for "Change password"
 * once signed in (then `email` is fixed to the account's address). The new
 * password replaces the old one, which stops working.
 */
export function PasswordReset({
  email: fixedEmail,
  initialEmail = "",
  onDone,
  onBack,
  backLabel = "Back",
}: {
  /** The signed-in account's email; the field is then not editable. */
  email?: string;
  initialEmail?: string;
  onDone: () => void;
  onBack?: () => void;
  backLabel?: string;
}) {
  const [email, setEmail] = useState(fixedEmail ?? initialEmail);
  const [step, setStep] = useState<"email" | "code" | "done">("email");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function send(event?: FormEvent) {
    event?.preventDefault();
    setError(null);
    setNotice(null);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError("Enter your university email address.");
    setBusy(true);
    const result = await sendPasswordCode(email);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setCode("");
    setStep("code");
    if (step === "code") setNotice("We sent a new code. Use the code in the latest email.");
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!/^\d{6,10}$/.test(code)) return setError("Enter the code from the email. It is made of digits only.");
    if (password.length < 8) return setError("The new password must be at least 8 characters.");
    if (password !== confirm) return setError("The two new passwords do not match.");
    setBusy(true);
    const result = await resetPasswordWithCode(email, code, password);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setStep("done");
  }

  const errorBox = error ? (
    <p role="alert" className="flex items-start gap-2 rounded-lg bg-clay-100/80 px-3.5 py-3 text-left text-[13.5px] text-clay-500">
      <AlertCircle className="mt-px size-4 shrink-0" />
      {error}
    </p>
  ) : null;

  if (step === "done") {
    return (
      <div className="space-y-4 text-center">
        <CheckCircle2 className="mx-auto size-10 text-sage-500" strokeWidth={1.5} />
        <p className="text-[15px] font-medium text-ink-900">Your password has been changed.</p>
        <p className="text-[13.5px] text-stone-600">Use the new password from now on. The old one no longer works.</p>
        <Button className="w-full" onClick={onDone}>
          Continue
        </Button>
      </div>
    );
  }

  if (step === "email") {
    return (
      <form onSubmit={send} className="space-y-4" noValidate>
        <div className="flex items-start gap-3">
          <KeyRound className="mt-0.5 size-5 shrink-0 text-azure-600" />
          <p className="text-[13.5px] text-stone-600">
            We will email a one-time code to {fixedEmail ? "your university address" : "your university email"}. Enter it
            with your new password to change it.
          </p>
        </div>
        <Field label="University email" htmlFor="reset-email">
          <Input
            id="reset-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={Boolean(fixedEmail)}
            placeholder="name.regno@muj.manipal.edu"
          />
        </Field>
        {errorBox}
        <Button type="submit" className="w-full" loading={busy}>
          Email me a code
        </Button>
        {onBack ? (
          <button type="button" onClick={onBack} className="block w-full text-center text-[13.5px] text-stone-500 hover:underline">
            {backLabel}
          </button>
        ) : null}
      </form>
    );
  }

  return (
    <form onSubmit={save} className="space-y-4" noValidate>
      <div className="flex items-start gap-3">
        <MailCheck className="mt-0.5 size-5 shrink-0 text-azure-600" />
        <p className="text-[13.5px] text-stone-600">
          We sent a code to <span className="font-semibold text-ink-900">{email.trim().toLowerCase()}</span>. Check your
          spam folder if it has not arrived in a few minutes.
        </p>
      </div>
      <Field label="Code from the email" htmlFor="reset-code">
        <Input
          id="reset-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={10}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, ""))}
          className="text-center text-[18px] font-semibold tracking-[0.35em]"
        />
      </Field>
      <Field label="New password" htmlFor="reset-new" help="At least 8 characters.">
        <Input
          id="reset-new"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      <Field label="Confirm new password" htmlFor="reset-confirm">
        <Input
          id="reset-confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </Field>
      {errorBox}
      {notice ? <p role="status" className="text-[13px] text-sage-500">{notice}</p> : null}
      <Button type="submit" className="w-full" loading={busy}>
        Change password
      </Button>
      <div className="flex items-center justify-center gap-4 text-[13.5px]">
        <button type="button" onClick={() => void send()} disabled={busy} className="text-azure-600 hover:underline">
          Send a new code
        </button>
        {onBack ? (
          <button type="button" onClick={onBack} className="text-stone-500 hover:underline">
            {backLabel}
          </button>
        ) : null}
      </div>
    </form>
  );
}
