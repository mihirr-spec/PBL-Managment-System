"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Landmark,
  Loader2,
  Lock,
  Mail,
} from "lucide-react";

import { PasswordReset } from "@/components/auth/password-reset";
import { VerifyCode } from "@/components/auth/verify-code";
import { HOME_BY_ROLE, useSession } from "@/lib/auth/session";
import { resendConfirmation } from "@/lib/data/repository";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * One sign-in tab per kind of account. The domain is filled in, so people type
 * only the part before the @.
 */
const TABS = [
  {
    key: "student",
    label: "Student",
    roles: ["student"],
    domain: "muj.manipal.edu",
    placeholder: "name.regno",
  },
  {
    key: "teacher",
    label: "Team Supervisor",
    roles: ["faculty", "supervisor"],
    domain: "jaipur.manipal.edu",
    placeholder: "name",
  },
  {
    key: "admin",
    label: "Administrator",
    roles: ["admin"],
    domain: "jaipur.manipal.edu",
    placeholder: "name",
  },
] as const satisfies ReadonlyArray<{
  key: string;
  label: string;
  roles: readonly Role[];
  domain: string;
  placeholder: string;
}>;

type TabKey = (typeof TABS)[number]["key"];

const control =
  "h-11 w-full rounded-lg border border-[#c9d1dc] bg-white/90 pl-12 pr-4 text-[14.5px] text-ink-900 placeholder:text-stone-400 transition-colors hover:border-ink-400/60 focus:border-azure-500 focus:outline-none focus:ring-3 focus:ring-azure-100";

/** The email box: a bordered row holding the typed name and the fixed domain. */
const emailBox =
  "relative flex h-11 w-full items-center rounded-lg border border-[#c9d1dc] bg-white/90 pl-12 pr-4 transition-colors hover:border-ink-400/60 focus-within:border-azure-500 focus-within:ring-3 focus-within:ring-azure-100";

const fieldIcon =
  "pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-ink-800";

/** The sign-up page's name for each tab's kind of account. */
const SIGNUP_KIND: Record<TabKey, string> = { student: "student", teacher: "supervisor", admin: "admin" };

/**
 * `verified`: back from the confirmation link in the sign-up email.
 * `initialTab`: the tab to open on, e.g. when coming back from sign-up.
 */
export function LoginForm({ verified = false, initialTab }: { verified?: boolean; initialTab?: string }) {
  const { signIn, user, loading } = useSession();
  const router = useRouter();

  const [tabKey, setTabKey] = useState<TabKey>(
    () => TABS.find((t) => t.key === initialTab)?.key ?? "student",
  );
  const tab = TABS.find((t) => t.key === tabKey) ?? TABS[0];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // While setting a new password the code signs the person in; stay here until it is saved.
  const [resetting, setResetting] = useState(false);
  const [unverified, setUnverified] = useState(false);
  /** Address waiting for its verification code, if any. */
  const [verifying, setVerifying] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(
    verified ? "Email verified. Sign in to continue." : null,
  );

  // Already signed in - go straight to the role's home.
  useEffect(() => {
    // Not while a submit is in flight: a wrong-tab sign-in is briefly signed
    // in before it is rejected and signed out again.
    if (!loading && user && !submitting && !resetting) router.replace(HOME_BY_ROLE[user.role]);
  }, [loading, user, submitting, resetting, router]);

  /** The full address: what was typed plus the tab's domain, unless they typed one. */
  const fullEmail = (typed: string) => (typed.includes("@") ? typed.trim() : `${typed.trim()}@${tab.domain}`);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void signInWith(fullEmail(email), password);
  }

  async function signInWith(address: string, secret: string) {
    setError(null);
    setNotice(null);
    setUnverified(false);
    setSubmitting(true);

    const result = await signIn(address, secret, [...tab.roles]);
    if (result.ok) {
      router.replace(HOME_BY_ROLE[result.user.role]);
      return;
    }

    setError(result.error);
    setUnverified(result.error.startsWith("Verify your email"));
    setSubmitting(false);
  }

  /** Sends a fresh code and switches to the code box. */
  async function resend() {
    const result = await resendConfirmation(fullEmail(email));
    setUnverified(false);
    if (result.ok) {
      setError(null);
      setVerifying(fullEmail(email).toLowerCase());
    } else {
      setError(result.error);
    }
  }


  function chooseTab(key: TabKey) {
    setTabKey(key);
    setEmail("");
    setPassword("");
    setError(null);
    setUnverified(false);
  }

  if (verifying) return <VerifyCode email={verifying} onBack={() => setVerifying(null)} />;

  if (resetting) {
    return (
      <div className="mt-6">
        <PasswordReset
          initialEmail={email.trim() ? fullEmail(email) : ""}
          onDone={() => setResetting(false)}
          onBack={() => setResetting(false)}
          backLabel="Back to sign in"
        />
      </div>
    );
  }

  return (
    <>
      <div
        role="tablist"
        aria-label="Account type"
        className="mt-5 grid grid-cols-3 gap-1 rounded-xl bg-ink-900/[0.06] p-1"
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={t.key === tabKey}
            onClick={() => chooseTab(t.key)}
            className={cn(
              "rounded-lg px-2 py-2 text-[13px] font-medium transition-colors",
              t.key === tabKey
                ? "bg-white text-ink-900 shadow-[0_4px_12px_-6px_rgba(13,31,63,0.45)]"
                : "text-stone-600 hover:text-ink-800",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3.5" noValidate>
        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-[14px] font-medium text-ink-900"
          >
            University Email
          </label>
          <div className={emailBox}>
            <Mail className={fieldIcon} strokeWidth={1.6} aria-hidden />
            <input
              id="email"
              type="text"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder={tab.placeholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-full min-w-0 flex-1 bg-transparent text-[14.5px] text-ink-900 placeholder:text-stone-400 focus:outline-none"
              required
            />
            {email.includes("@") ? null : (
              <label htmlFor="email" className="shrink-0 cursor-text pl-1 text-[14.5px] text-stone-500 select-none">
                @{tab.domain}
              </label>
            )}
          </div>
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1.5 block text-[14px] font-medium text-ink-900"
          >
            Password
          </label>
          <div className="relative">
            <Lock className={fieldIcon} strokeWidth={1.6} aria-hidden />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={cn(control, "pr-14")}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute top-1/2 right-3.5 -translate-y-1/2 rounded-md p-1.5 text-ink-800 transition-colors hover:text-azure-600"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="size-5" strokeWidth={1.6} />
              ) : (
                <Eye className="size-5" strokeWidth={1.6} />
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <label className="flex cursor-pointer items-center gap-2.5 text-[14px] text-stone-700">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="size-4 cursor-pointer rounded border-ink-400 accent-ink-800"
            />
            Remember me
          </label>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setResetting(true);
            }}
            className="text-[14px] text-azure-600 hover:underline"
          >
            Forgot password?
          </button>
        </div>

        {error ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg bg-clay-100/80 px-3.5 py-3 text-[14px] text-clay-500"
          >
            <AlertCircle className="mt-px size-4 shrink-0" />
            <span>
              {error}
              {unverified ? (
                <button type="button" onClick={() => void resend()} className="ml-1 font-medium text-azure-600 underline">
                  Send a code
                </button>
              ) : null}
            </span>
          </p>
        ) : null}

        {notice ? (
          <p
            role="status"
            className="flex items-start gap-2 rounded-lg bg-sage-100/80 px-3.5 py-3 text-[14px] text-sage-500"
          >
            <CheckCircle2 className="mt-px size-4 shrink-0" />
            {notice}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="flex h-11 w-full items-center justify-center gap-2.5 rounded-lg bg-[linear-gradient(90deg,#173b7e_0%,#1d4b93_55%,#2f62a6_100%)] text-[16px] font-medium text-white shadow-[0_14px_30px_-18px_rgba(13,31,63,0.95)] transition-[filter,transform] hover:brightness-110 active:translate-y-px disabled:pointer-events-none disabled:opacity-70"
        >
          {submitting ? (
            <>
              <Loader2 className="size-[18px] animate-spin" aria-hidden />
              Signing in
            </>
          ) : (
            <>
              Sign In
              <ArrowRight className="size-[18px]" strokeWidth={1.8} />
            </>
          )}
        </button>
      </form>

      <div className="mt-4 flex items-center gap-5">
        <span className="h-px flex-1 bg-[#c9d1dc]" />
        <span className="text-[13px] tracking-wide text-stone-500">OR</span>
        <span className="h-px flex-1 bg-[#c9d1dc]" />
      </div>

      <button
        type="button"
        onClick={() =>
          setError(
            "University single sign-on arrives in a later release. Sign in with your email and password for now.",
          )
        }
        className="mt-4 flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-ink-800/70 bg-white px-3 text-[14px] whitespace-nowrap sm:gap-4 sm:text-[15px] font-medium text-ink-900 transition-colors hover:bg-azure-50"
      >
        <Landmark className="size-5 shrink-0 text-ink-800 sm:size-6" strokeWidth={1.5} aria-hidden />
        Continue with University Account
      </button>

      <div className="mt-4 text-center">
        <p className="text-[13.5px] text-stone-500">
          New to the portal?{" "}
          <Link href={`/signup?as=${SIGNUP_KIND[tab.key]}`} className="text-azure-600 hover:underline">
            Create your account
          </Link>
        </p>
      </div>
    </>
  );
}
