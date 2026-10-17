"use client";

import { useState, type FormEvent } from "react";
import { AlertCircle, Check, KeyRound, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { DetailRow, PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import { useSession } from "@/lib/auth/session";
import { changePassword } from "@/lib/data/repository";
import { usePortal } from "@/lib/data/portal-store";
import { formatDateTime } from "@/lib/utils";

export default function SettingsPage() {
  const { user, signOut } = useSession();
  const { loading, student } = usePortal();

  const [status, setStatus] = useState<
    { kind: "error"; message: string } | { kind: "success" } | null
  >(null);
  const [saving, setSaving] = useState(false);

  async function handlePasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;

    const form = new FormData(event.currentTarget);
    const current = String(form.get("currentPassword"));
    const next = String(form.get("newPassword"));
    const confirm = String(form.get("confirmPassword"));

    if (next !== confirm) {
      setStatus({ kind: "error", message: "The new passwords do not match." });
      return;
    }

    setSaving(true);
    const result = await changePassword(user.email, current, next);
    setSaving(false);

    if (!result.ok) {
      setStatus({ kind: "error", message: result.error });
      return;
    }

    setStatus({ kind: "success" });
    event.currentTarget.reset();
  }

  if (loading || !student || !user) return <PageSkeleton />;

  return (
    <div>
      <PageHeader
        eyebrow="Settings"
        title="Account"
        emphasis="settings."
        scene="settings"
        description="Manage your sign-in credentials and review your account details."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Change password"
            description="Use at least eight characters."
          />
          <form onSubmit={handlePasswordChange}>
            <CardBody className="space-y-4">
              <Field label="Current password" htmlFor="currentPassword">
                <Input
                  id="currentPassword"
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </Field>
              <Field label="New password" htmlFor="newPassword">
                <Input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </Field>
              <Field label="Confirm new password" htmlFor="confirmPassword">
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </Field>

              {status?.kind === "error" ? (
                <p
                  role="alert"
                  className="flex items-start gap-2 rounded-lg bg-clay-100/70 px-3 py-2.5 text-[13px] text-clay-500"
                >
                  <AlertCircle className="mt-px size-4 shrink-0" />
                  {status.message}
                </p>
              ) : null}

              {status?.kind === "success" ? (
                <p className="flex items-start gap-2 rounded-lg bg-sage-100 px-3 py-2.5 text-[13px] text-sage-500">
                  <Check className="mt-px size-4 shrink-0" />
                  Password updated.
                </p>
              ) : null}
            </CardBody>

            <div className="flex justify-end border-t border-sand-200/60 bg-white/40 px-5 py-3.5">
              <Button type="submit" size="sm" loading={saving}>
                <KeyRound className="size-3.5" />
                {saving ? "Updating" : "Update password"}
              </Button>
            </div>
          </form>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Account" />
            <CardBody>
              <dl>
                <DetailRow label="University email">
                  {student.universityEmail}
                </DetailRow>
                <DetailRow label="Registration number">
                  <span className="tnum">{student.registrationNumber}</span>
                </DetailRow>
                <DetailRow label="Role">Student</DetailRow>
                <DetailRow label="Signed in">
                  <span className="tnum">
                    {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "-"}
                  </span>
                </DetailRow>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Session"
              description="Sign out of this device."
            />
            <CardBody>
              <Button variant="danger" size="sm" onClick={signOut}>
                <LogOut className="size-3.5" />
                Log out
              </Button>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
