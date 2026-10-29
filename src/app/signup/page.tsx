import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <AuthShell
      title="Create your"
      emphasis="account"
      subtitle="Use your MUJ email. We will send a code to verify it."
    >
      <SignupForm />
    </AuthShell>
  );
}
