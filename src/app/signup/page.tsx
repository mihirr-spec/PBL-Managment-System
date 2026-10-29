import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm, type AccountKind } from "@/components/auth/signup-form";

export const metadata: Metadata = { title: "Create account" };

const SUBTITLE: Record<AccountKind, string> = {
  student: "Student account. Use your MUJ email to get started.",
  supervisor: "Team supervisor account. Find your name in the MUJ faculty list.",
  admin: "Administrator account. Find your name in the MUJ faculty list.",
};

/** `?as=student|supervisor|admin` comes from the tab chosen on the sign-in page. */
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { as } = await searchParams;
  const kind: AccountKind = as === "supervisor" || as === "admin" ? as : "student";
  return (
    <AuthShell title="Create your" emphasis="account" subtitle={SUBTITLE[kind]}>
      <SignupForm key={kind} kind={kind} />
    </AuthShell>
  );
}
