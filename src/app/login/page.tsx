import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { verified, as } = await searchParams;
  return (
    <AuthShell title="Welcome" emphasis="back" subtitle="Sign in with your university email and password.">
      <LoginForm verified={verified != null} initialTab={typeof as === "string" ? as : undefined} />
    </AuthShell>
  );
}
