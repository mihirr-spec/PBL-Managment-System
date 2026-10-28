"use client";

import { useState, type FormEvent } from "react";
import { ArrowRightLeft, MessageCircleQuestion, Send } from "lucide-react";

import { QueryList } from "@/components/shared/queries";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import * as repo from "@/lib/data/repository";
import { usePortal } from "@/lib/data/portal-store";
import type { TicketCategory } from "@/lib/types";
import { useLoad } from "@/lib/use-load";
import { cn } from "@/lib/utils";

export default function QueriesPage() {
  const { loading, student, group, mentor } = usePortal();
  const queries = useLoad(() => repo.listTickets(group!.id), group ? group.id : null);
  const [category, setCategory] = useState<TicketCategory>("general");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  if (loading || !student) return <PageSkeleton />;

  if (!group) {
    return (
      <div>
        <PageHeader eyebrow="Queries" title="Raise a" emphasis="query." scene="queries" />
        <Card>
          <EmptyState title="Join a group first" description="Queries go to your group's supervisor." scene="queries" />
          <div className="pb-6 text-center">
            <ButtonLink href="/student/group" size="sm">Go to my group</ButtonLink>
          </div>
        </Card>
      </div>
    );
  }

  const isChange = category === "supervisor_change";
  const changeInProgress = queries.data?.some(
    (q) => q.category === "supervisor_change" && (q.status === "open" || q.status === "forwarded"),
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSent(null);
    try {
      await repo.raiseTicket({
        groupId: group!.id,
        studentId: student!.id,
        subject: isChange ? "Change of supervisor" : subject.trim(),
        body: body.trim(),
        category,
      });
      setSubject("");
      setBody("");
      setSent(
        isChange
          ? `Sent to ${mentor?.fullName ?? "your supervisor"}. Once they approve it, the administrator chooses your new supervisor.`
          : "Query sent - your supervisor has been notified.",
      );
      setCategory("general");
      void queries.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the query.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Queries"
        title="Raise a"
        emphasis="query."
        description={
          mentor
            ? `Questions, blockers or requests go straight to ${mentor.fullName}.`
            : "Your group has no supervisor yet - the administrator will see your query."
        }
        scene="queries"
      />

      <Card>
        <CardHeader title="New query" />
        <form onSubmit={submit}>
          <CardBody className="space-y-4">
            <div role="radiogroup" aria-label="Kind of query" className="grid gap-2 sm:grid-cols-2">
              <KindOption
                active={!isChange}
                onPick={() => setCategory("general")}
                icon={<MessageCircleQuestion className="size-4" />}
                title="General query"
                note="A question, a blocker or anything you need help with."
              />
              <KindOption
                active={isChange}
                disabled={!mentor || changeInProgress}
                onPick={() => setCategory("supervisor_change")}
                icon={<ArrowRightLeft className="size-4" />}
                title="Change of supervisor"
                note={
                  !mentor
                    ? "Available once your group has a supervisor."
                    : changeInProgress
                      ? "A change request is already in progress."
                      : "Your supervisor approves it first, then the administrator decides."
                }
              />
            </div>

            {isChange ? null : (
              <Field label="Subject" htmlFor="q-subject">
                <Input id="q-subject" required maxLength={140} value={subject} onChange={(e) => setSubject(e.target.value)} />
              </Field>
            )}
            <Field
              label={isChange ? "Why do you want to change supervisor?" : "Details"}
              htmlFor="q-body"
              help={isChange ? "This becomes the recorded reason for the change, seen by your supervisor and the administrator." : undefined}
            >
              <Textarea id="q-body" rows={4} required={isChange} value={body} onChange={(e) => setBody(e.target.value)} />
            </Field>
            {error ? <p role="alert" className="text-[13px] text-clay-500">{error}</p> : null}
            {sent ? <p role="status" className="text-[13px] text-sage-500">{sent}</p> : null}
            <Button type="submit" loading={busy}>
              <Send className="size-3.5" />
              {isChange ? "Send change request" : "Raise query"}
            </Button>
          </CardBody>
        </form>
      </Card>

      <Card>
        <CardHeader title="Your group's queries" />
        {queries.data && queries.data.length > 0 ? (
          <QueryList queries={queries.data} />
        ) : (
          <EmptyState
            icon={<MessageCircleQuestion className="size-5" />}
            title={queries.data ? "No queries yet" : "Loading…"}
            scene="queries"
          />
        )}
      </Card>
    </div>
  );
}

function KindOption({
  active,
  disabled = false,
  onPick,
  icon,
  title,
  note,
}: {
  active: boolean;
  disabled?: boolean;
  onPick: () => void;
  icon: React.ReactNode;
  title: string;
  note: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onPick}
      className={cn(
        "flex gap-3 rounded-[14px] border px-3.5 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-55",
        active ? "border-azure-500 bg-azure-50/70 ring-2 ring-azure-100" : "border-sand-200 bg-white/70 hover:border-azure-100",
      )}
    >
      <span className={cn("mt-0.5 shrink-0", active ? "text-azure-600" : "text-stone-500")}>{icon}</span>
      <span>
        <span className="block text-[13.5px] font-semibold text-ink-900">{title}</span>
        <span className="block text-[12px] text-stone-500">{note}</span>
      </span>
    </button>
  );
}
