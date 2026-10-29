"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { AlertCircle, ArrowRight, Loader2 } from "lucide-react";

import { FacultyNameField } from "@/components/auth/faculty-name-field";
import { VerifyCode } from "@/components/auth/verify-code";
import { HOME_BY_ROLE } from "@/lib/auth/session";
import { STAFF_DOMAIN, STUDENT_DOMAIN, signUp, type DirectoryMatch } from "@/lib/data/repository";
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

type AccountKind = "student" | "supervisor" | "admin";

const KINDS: { kind: AccountKind; label: string }[] = [
  { kind: "student", label: "Student" },
  { kind: "supervisor", label: "Team supervisor" },
  { kind: "admin", label: "Administrator" },
];

/** Name without a title, as lower-case letters: "Dr. Preeti Narooka" -> ["preeti", "narooka"]. */
function nameWords(name: string): string[] {
  return name
    .replace(/^\s*((dr|mr|mrs|ms|prof)\.?\s+)+/i, "")
    .split(/\s+/)
    .map((w) => w.toLowerCase().replace(/[^a-z]/g, ""))
    .filter(Boolean);
}

/** The part before the @ of a faculty member's address, from the list or guessed as first.last. */
function staffLocalPart(match: DirectoryMatch): string {
  const listed = match.email.trim().toLowerCase();
  if (listed.includes("@")) return listed.split("@")[0];
  const words = nameWords(match.fullName);
  return words.length > 1 ? `${words[0]}.${words[words.length - 1]}` : (words[0] ?? "");
}

/** MUJ student addresses are first name, a dot, then the registration number. */
function studentLocalPart(name: string, registration: string): string {
  const first = nameWords(name)[0] ?? "";
  const reg = registration.replace(/\s/g, "");
  return first && reg ? `${first}.${reg}` : "";
}

/** Email box that shows the fixed university domain after what is typed. */
function EmailBox({
  id,
  value,
  onChange,
  domain,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  domain: string;
  placeholder: string;
}) {
  return (
    <div className="flex h-11 w-full items-center rounded-lg border border-[#c9d1dc] bg-white/90 pl-4 pr-2 transition-colors hover:border-ink-400/60 focus-within:border-azure-500 focus-within:ring-3 focus-within:ring-azure-100">
      <input
        id={id}
        type="text"
        inputMode="email"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-full min-w-0 flex-1 bg-transparent text-[14.5px] text-ink-900 placeholder:text-stone-400 focus:outline-none"
        required
      />
      {value.includes("@") ? null : (
        <label htmlFor={id} className="shrink-0 cursor-text pl-1 pr-2 text-[14.5px] text-stone-500 select-none">
          {domain}
        </label>
      )}
    </div>
  );
}

/**
 * Account creation. The person first says whether they are a student, a team
 * supervisor or an administrator. Staff find their name in the MUJ faculty
 * list, which fills in their email; students give their name and
 * registration number and their email is suggested from those. Either email
 * can still be changed. Supabase emails a code to verify the address.
 */
export function SignupForm() {
  const router = useRouter();
  const [kind, setKind] = useState<AccountKind | null>(null);
  const [fullName, setFullName] = useState("");
  const [picked, setPicked] = useState<DirectoryMatch | null>(null);
  const [registration, setRegistration] = useState("");
  // Null until the person edits the email themselves; until then it is suggested.
  const [emailEdit, setEmailEdit] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [programme, setProgramme] = useState("B.Tech");
  const [branch, setBranch] = useState("Computer Science & Engineering");
  const [semester, setSemester] = useState("5");
  const [section, setSection] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const isStudent = kind === "student";
  const domain = isStudent ? STUDENT_DOMAIN : STAFF_DOMAIN;
  const suggested = isStudent ? studentLocalPart(fullName, registration) : picked ? staffLocalPart(picked) : "";
  const email = emailEdit ?? suggested;
  // People type only the part before the @; a full address typed in is kept as is.
  const typed = email.trim().toLowerCase();
  const address = typed.includes("@") ? typed : typed ? `${typed}${domain}` : "";

  function choose(next: AccountKind) {
    if (next === kind) return;
    setKind(next);
    setPicked(null);
    setEmailEdit(null);
    setError(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!kind) return;
    if (!fullName.trim()) {
      setError("Enter your full name.");
      return;
    }
    if (isStudent && !registration.trim()) {
      setError("Enter your registration number.");
      return;
    }
    if (!address.endsWith(domain)) {
      setError(
        isStudent
          ? `Students use their ${STUDENT_DOMAIN} address.`
          : `Team supervisors and administrators use their ${STAFF_DOMAIN} address.`,
      );
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setBusy(true);
    const result = await signUp({
      email: address,
      password,
      fullName,
      ...(isStudent
        ? { registrationNumber: registration, programme, branch, semester: Number(semester), section }
        : { facultyId: picked?.id }),
    });
    if (result.ok && result.user) {
      router.replace(HOME_BY_ROLE[result.user.role]);
      return;
    }
    setBusy(false);
    if (result.ok) setSentTo(address);
    else setError(result.error);
  }

  if (sentTo) return <VerifyCode email={sentTo} />;

  return (
    <form onSubmit={submit} className="mt-5 space-y-3.5" noValidate>
      <div>
        <p id="su-kind" className="mb-1.5 text-[14px] font-medium text-ink-900">
          I am a
        </p>
        <div role="radiogroup" aria-labelledby="su-kind" className="grid grid-cols-3 gap-1 rounded-lg bg-[#e8edf4] p-1">
          {KINDS.map((k) => (
            <button
              key={k.kind}
              type="button"
              role="radio"
              aria-checked={kind === k.kind}
              onClick={() => choose(k.kind)}
              className={cn(
                "h-9 rounded-md px-1 text-[13.5px] font-medium transition-colors",
                kind === k.kind ? "bg-white text-ink-900 shadow-sm" : "text-stone-500 hover:text-ink-900",
              )}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>

      {kind === null ? (
        <p className="text-center text-[13.5px] text-stone-500">Choose who the account is for to continue.</p>
      ) : null}

      {kind && !isStudent ? (
        <>
          <Row
            label="Full name"
            htmlFor="su-name"
            help={picked ? picked.department : "Pick your name from the MUJ faculty list to fill in your email."}
          >
            <FacultyNameField
              key={kind}
              id="su-name"
              value={fullName}
              onChange={setFullName}
              onPick={(match) => {
                setPicked(match);
                setEmailEdit(null);
              }}
              adminsOnly={kind === "admin"}
              className={control}
            />
          </Row>
          <Row label="University email" htmlFor="su-email" help="Change it if your address is different.">
            <EmailBox id="su-email" value={email} onChange={setEmailEdit} domain={STAFF_DOMAIN} placeholder="first.last" />
          </Row>
        </>
      ) : null}

      {isStudent ? (
        <>
          <Row label="Full name" htmlFor="su-name">
            <input id="su-name" value={fullName} onChange={(e) => setFullName(e.target.value)} className={control} autoComplete="name" />
          </Row>
          <Row label="Registration number" htmlFor="su-reg">
            <input
              id="su-reg"
              value={registration}
              onChange={(e) => setRegistration(e.target.value)}
              className={control}
              inputMode="numeric"
            />
          </Row>
          <Row
            label="University email"
            htmlFor="su-email"
            help="Filled in from your name and registration number. Change it if yours is different."
          >
            <EmailBox id="su-email" value={email} onChange={setEmailEdit} domain={STUDENT_DOMAIN} placeholder="name.regno" />
          </Row>
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

      {kind ? (
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
      ) : null}

      {error ? (
        <p role="alert" className="flex items-start gap-2 rounded-lg bg-clay-100/80 px-3.5 py-3 text-[14px] text-clay-500">
          <AlertCircle className="mt-px size-4 shrink-0" />
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy || !kind}
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
