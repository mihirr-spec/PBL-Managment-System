"use client";

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { AlertCircle, ArrowRight, Loader2, MailCheck } from "lucide-react";

import {
  STAFF_DOMAIN,
  STUDENT_DOMAIN,
  registrationFromEmail,
  resendConfirmation,
  signUp,
} from "@/lib/data/repository";
import { cn } from "@/lib/utils";

const control =
  "h-11 w-full rounded-lg border border-[#c9d1dc] bg-white/90 px-4 text-[14.5px] text-ink-900 placeholder:text-stone-400 transition-colors hover:border-ink-400/60 focus:border-azure-500 focus:outline-none focus:ring-3 focus:ring-azure-100";

function Row({ label, htmlFor, help, children }: { label: string; htmlFor: string; help?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[14px] font-medium text-ink-900">
        {label}
      </label>
      {children}
      {help ? <p className="mt-1 text-[12px] text-stone-500">{help}</p> : null}
    </div>
  );
}

/**
 * Account creation. Students give their academic details (used only if the
 * university roster has no record for them yet); teachers and the PBL office
 * need nothing but their address. Supabase emails a link to verify it.
 */
export function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fullName, setFullName] = useState("");
  const [registration, setRegistration] = useState("");
  const [programme, setProgramme] = useState("B.Tech");
  const [branch, setBranch] = useState("Computer Science & Engineering");
  const [semester, setSemester] = useState("5");
  const [section, setSection] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  const address = email.trim().toLowerCase();
  const isStudent = address.endsWith(STUDENT_DOMAIN);
  const isStaff = address.endsWith(STAFF_DOMAIN);
  const emailReg = isStudent ? registrationFromEmail(address) : null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!isStudent && !isStaff) {
      setError(`Use your university email - students ${STUDENT_DOMAIN}, supervisors ${STAFF_DOMAIN}.`);
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    if (isStudent && !fullName.trim()) {
      setError("Enter your full name.");
      return;
    }
    if (isStudent && !emailReg && !registration.trim()) {
      setError("Enter your registration number.");
      return;
    }
    setBusy(true);
    const result = await signUp({
      email: address,
      password,
      ...(isStudent
        ? {
            fullName,
            registrationNumber: emailReg ?? registration,
            programme,
            branch,
            semester: Number(semester),
            section,
          }
        : {}),
    });
    setBusy(false);
    if (result.ok) setSentTo(address);
    else setError(result.error);
  }

  if (sentTo) {
    return (
      <div className="mt-6 space-y-4 text-center">
        <MailCheck className="mx-auto size-10 text-azure-600" strokeWidth={1.5} />
        <p className="text-[15px] text-ink-900">
          We sent a verification link to <span className="font-semibold">{sentTo}</span>.
        </p>
        <p className="text-[13.5px] text-stone-600">
          Open it to activate your account, then sign in. Check your spam folder if it has not arrived in a few minutes.
        </p>
        <button
          type="button"
          disabled={resent}
          onClick={async () => {
            const r = await resendConfirmation(sentTo);
            if (r.ok) setResent(true);
            else setError(r.error);
          }}
          className="text-[13.5px] text-azure-600 hover:underline disabled:text-stone-400 disabled:no-underline"
        >
          {resent ? "Sent again" : "Resend the link"}
        </button>
        {error ? <p className="text-[13px] text-clay-500">{error}</p> : null}
        <Link
          href="/login"
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-ink-800/70 bg-white text-[15px] font-medium text-ink-900 hover:bg-azure-50"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-3.5" noValidate>
      <Row
        label="University email"
        htmlFor="su-email"
        help={
          isStudent
            ? emailReg
              ? `Registration number ${emailReg}`
              : undefined
            : isStaff
              ? "Team supervisor or administrator account - matched to the MUJ faculty list."
              : `Students ${STUDENT_DOMAIN} · supervisors ${STAFF_DOMAIN}`
        }
      >
        <input
          id="su-email"
          type="email"
          autoComplete="username"
          placeholder="name.regno@muj.manipal.edu"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={control}
          required
        />
      </Row>

      {isStudent ? (
        <>
          <Row label="Full name" htmlFor="su-name">
            <input id="su-name" value={fullName} onChange={(e) => setFullName(e.target.value)} className={control} autoComplete="name" />
          </Row>
          {emailReg ? null : (
            <Row label="Registration number" htmlFor="su-reg">
              <input id="su-reg" value={registration} onChange={(e) => setRegistration(e.target.value)} className={control} inputMode="numeric" />
            </Row>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Row label="Programme" htmlFor="su-prog">
              <input id="su-prog" value={programme} onChange={(e) => setProgramme(e.target.value)} className={control} />
            </Row>
            <Row label="Semester" htmlFor="su-sem">
              <select id="su-sem" value={semester} onChange={(e) => setSemester(e.target.value)} className={control}>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>Semester {n}</option>
                ))}
              </select>
            </Row>
          </div>
          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <Row label="Branch" htmlFor="su-branch">
              <input id="su-branch" value={branch} onChange={(e) => setBranch(e.target.value)} className={control} />
            </Row>
            <Row label="Section" htmlFor="su-sec">
              <input id="su-sec" value={section} onChange={(e) => setSection(e.target.value)} className={control} maxLength={3} />
            </Row>
          </div>
        </>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Row label="Password" htmlFor="su-pass">
          <input
            id="su-pass"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={control}
            required
          />
        </Row>
        <Row label="Confirm password" htmlFor="su-confirm">
          <input
            id="su-confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={control}
            required
          />
        </Row>
      </div>

      {error ? (
        <p role="alert" className="flex items-start gap-2 rounded-lg bg-clay-100/80 px-3.5 py-3 text-[14px] text-clay-500">
          <AlertCircle className="mt-px size-4 shrink-0" />
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className={cn(
          "flex h-11 w-full items-center justify-center gap-2.5 rounded-lg bg-[linear-gradient(90deg,#173b7e_0%,#1d4b93_55%,#2f62a6_100%)] text-[16px] font-medium text-white shadow-[0_14px_30px_-18px_rgba(13,31,63,0.95)] transition-[filter,transform] hover:brightness-110 active:translate-y-px disabled:pointer-events-none disabled:opacity-70",
        )}
      >
        {busy ? (
          <>
            <Loader2 className="size-[18px] animate-spin" aria-hidden />
            Creating account
          </>
        ) : (
          <>
            Create account
            <ArrowRight className="size-[18px]" strokeWidth={1.8} />
          </>
        )}
      </button>

      <p className="text-center text-[13.5px] text-stone-500">
        Already have an account?{" "}
        <Link href="/login" className="text-azure-600 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
