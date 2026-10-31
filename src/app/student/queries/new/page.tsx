"use client";

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { ArrowRightLeft, Mail, MessageCircleQuestion, Send, UsersRound } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { FileDrop } from "@/components/ui/file-drop";
import { Field, Input } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import * as repo from "@/lib/data/repository";
import { usePortal } from "@/lib/data/portal-store";
import type { TicketCategory } from "@/lib/types";
import { useLoad } from "@/lib/use-load";
import { RichEditor } from "@/components/shared/rich-editor";
import { cn } from "@/lib/utils";

/**
 * Raising a query: a general question for the supervisor, or (team lead only)
 * a request to move to another supervisor. Past queries live on Your Queries.
 */
export default function RaiseQueryPage() {
  const { loading, student, group, mentor } = usePortal();
  const queries = useLoad(() => repo.listTickets(group!.id), group ? group.id : null);
  const [category, setCategory] = useState<TicketCategory>("general");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [targetId, setTargetId] = useState("");
  const teachers = useLoad(() => repo.listPortalTeachers(), category === "supervisor_change" ? "portal-teachers" : null);

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
  const isLeader = group.leaderStudentId === student.id;
  const choices = (teachers.data ?? []).filter((t) => t.id !== group.mentorId);
  const target = choices.find((t) => t.id === targetId);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSent(null);
    try {
      if (isChange) {
        if (!targetId) throw new Error("Choose the supervisor you want to move to.");
        await repo.raiseSupervisorChange({ groupId: group!.id, targetId, reason: body.trim(), files });
      } else {
        await repo.raiseTicket({
          groupId: group!.id,
          studentId: student!.id,
          subject: subject.trim(),
          body: body.trim(),
          category,
          files,
        });
      }
      setSubject("");
      setBody("");
      setFiles([]);
      setTargetId("");
      setCategory("general");
      setSent(
        isChange
          ? `Sent to ${mentor?.fullName ?? "your supervisor"} and ${target?.fullName ?? "the supervisor you chose"}. The move happens once both approve.`
          : "Query sent - your supervisor has been notified.",
      );
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
        description="Ask your supervisor a question, report a blocker, or ask to change your supervisor. Replies show up under Your Queries."
        scene="queries"
        action={
          <div className="hidden flex-wrap items-center gap-4 sm:flex">
            <span className="flex items-center gap-2 text-[12.5px] text-stone-600">
              <Avatar name={mentor?.fullName ?? "Supervisor"} src={mentor?.avatarUrl} size="sm" />
              <span>
                <span className="block font-semibold text-ink-900">{mentor?.fullName ?? "No supervisor yet"}</span>
                <span className="block text-[11.5px] text-stone-500">Assigned Supervisor</span>
              </span>
            </span>
            <span className="h-9 w-px bg-sand-200" aria-hidden />
            <span className="flex items-center gap-2 text-[12.5px] text-stone-600">
              <UsersRound className="size-4 text-stone-400" />
              <span>
                <span className="block font-semibold text-ink-900">Group {group.number}</span>
                <span className="block text-[11.5px] text-stone-500">Your Group</span>
              </span>
            </span>
            <span className="h-9 w-px bg-sand-200" aria-hidden />
            <span className="flex items-center gap-2 text-[12.5px] text-stone-600">
              <Mail className="size-4 text-stone-400" />
              <span>
                <span className="block font-semibold text-ink-900">You will be notified</span>
                <span className="block text-[11.5px] text-stone-500">when someone responds</span>
              </span>
            </span>
          </div>
        }
      />

      <Card className="mx-auto max-w-3xl">
        <CardHeader
          title="New query"
          description="Pick the kind of query and fill in the details."
          action={
            <Link href="/student/queries" className="text-[13px] font-medium text-azure-600 hover:underline">
              Your queries →
            </Link>
          }
        />
        <form onSubmit={submit} className="space-y-4 px-5 py-4">
          <div role="radiogroup" aria-label="Kind of query" className="grid gap-3 sm:grid-cols-2">
            <KindOption
              active={!isChange}
              onPick={() => setCategory("general")}
              icon={<MessageCircleQuestion className="size-4" />}
              title="General query"
              note="Questions, clarifications, or any academic or project issue."
            />
            <KindOption
              active={isChange}
              disabled={!mentor || !isLeader || changeInProgress}
              onPick={() => setCategory("supervisor_change")}
              icon={<ArrowRightLeft className="size-4" />}
              title="Change of supervisor"
              note={
                !mentor
                  ? "Available once your group has a supervisor."
                  : !isLeader
                    ? "Only your team lead can ask to change supervisor."
                    : changeInProgress
                      ? "A change request is already in progress."
                      : "Move to a supervisor you choose. Your current and new supervisor both have to approve."
              }
            />
          </div>

          {isChange ? (
            <Field
              label="Move to"
              htmlFor="q-target"
              help={
                target && target.groupCount >= target.maxGroups
                  ? `${target.fullName} already has ${target.groupCount} of ${target.maxGroups} groups, so the PBL office also has to approve.`
                  : "Supervisors with a portal account. Both they and your current supervisor are asked."
              }
            >
              <select
                id="q-target"
                required
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="h-10 w-full rounded-lg border border-sand-200 bg-white px-3 text-[13.5px] text-ink-900 focus:border-azure-500 focus:ring-3 focus:ring-azure-100 focus:outline-none"
              >
                <option value="">
                  {teachers.error ? "Could not load supervisors" : teachers.data ? "Choose a supervisor..." : "Loading supervisors..."}
                </option>
                {choices.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.fullName} - {t.groupCount}/{t.maxGroups} groups{t.groupCount >= t.maxGroups ? " (full)" : ""}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <Field
              label="Subject"
              htmlFor="q-subject"
              help="For example: Regarding ETE evaluation · Clarification on milestone 2 · Issue with the submission portal"
            >
              <Input
                id="q-subject"
                required
                maxLength={150}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="A short, specific subject"
              />
            </Field>
          )}

          <Field
            label={isChange ? "Reason for the change" : "Details"}
            htmlFor="q-body"
            help={
              isChange
                ? "This becomes the recorded reason, seen by both supervisors and the PBL office."
                : "Include dates and context so your supervisor can answer in one go."
            }
          >
            <RichEditor id="q-body" rows={6} value={body} onChange={setBody} hint="" />
          </Field>

          <div>
            <p className="text-[13px] font-medium text-ink-800">
              Supporting documents <span className="font-normal text-stone-500">(optional)</span>
            </p>
            <FileDrop
              id="q-files"
              files={files}
              onChange={setFiles}
              multiple
              accept=".pdf,.doc,.docx,.ppt,.pptx,.zip,image/png,image/jpeg"
              specs="PDF, DOC, PPT, ZIP, images · up to 25 MB per file"
              disabled={busy}
            />
          </div>

          {error ? <p role="alert" className="text-[13px] text-clay-500">{error}</p> : null}
          {sent ? (
            <p role="status" className="text-[13px] text-sage-500">
              {sent}{" "}
              <Link href="/student/queries" className="font-medium text-azure-600 hover:underline">
                Track it in Your Queries
              </Link>
            </p>
          ) : null}
          <div className="flex justify-end">
            <Button type="submit" loading={busy}>
              <Send className="size-3.5" />
              {isChange ? "Send change request" : "Send query"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

/** One kind of query as a radio card. */
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
  icon: ReactNode;
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
        "relative flex gap-3 rounded-[14px] border px-3.5 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-55",
        active ? "border-azure-500 bg-azure-50/70 ring-2 ring-azure-100" : "border-sand-200 bg-white/70 hover:border-azure-100",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-3 right-3 flex size-4 shrink-0 items-center justify-center rounded-full border-2 bg-white",
          active ? "border-azure-600" : "border-sand-200",
        )}
      >
        {active ? <span className="size-2 rounded-full bg-azure-600" /> : null}
      </span>
      <span className={cn("mt-0.5 shrink-0", active ? "text-azure-600" : "text-stone-500")}>{icon}</span>
      <span>
        <span className="block pr-6 text-[13.5px] font-semibold text-ink-900">{title}</span>
        <span className="block pr-6 text-[12px] text-stone-500">{note}</span>
      </span>
    </button>
  );
}
