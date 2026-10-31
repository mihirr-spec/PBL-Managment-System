"use client";

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { ArrowRightLeft, FileText, Info, Mail, MessageCircle, Send, UserRound, UsersRound } from "lucide-react";

import { Button, ButtonLink } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { FileDrop } from "@/components/ui/file-drop";
import { Input } from "@/components/ui/field";
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
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <Card>
        <form onSubmit={submit} noValidate>
          {/* ----------------------------- heading ----------------------------- */}
          <div className="space-y-4 px-6 pt-5 pb-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="font-display text-[2.3rem] leading-tight tracking-tight text-ink-900">New Query</h1>
                <p className="mt-1 text-[14px] text-stone-600">
                  Submit a question, report a blocker, or request a change to your assigned supervisor.
                </p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-1.5 text-[13px] text-stone-600 ring-1 ring-sand-200">
                <UsersRound className="size-4" />
                Group {group.number}
              </span>
            </div>
            <div className="grid divide-sand-200 rounded-xl bg-white ring-1 ring-sand-200 sm:grid-cols-2 sm:divide-x">
              <InfoCell
                icon={<UserRound className="size-5" />}
                title={mentor?.fullName ?? "No supervisor yet"}
                note="Your assigned supervisor"
              />
              <InfoCell icon={<Mail className="size-5" />} title="You will be notified" note="when your supervisor responds" />
            </div>
          </div>

          <div className="space-y-5 border-t border-sand-200/70 px-6 py-5">
            {/* ---------------------------- query type ---------------------------- */}
            <div>
              <h2 className="font-display text-[1.15rem] text-ink-900">Query type</h2>
              <p className="text-[13px] text-stone-500">Select the type of query you want to raise.</p>
              <div role="radiogroup" aria-label="Kind of query" className="mt-3 grid gap-3 sm:grid-cols-2">
                <KindOption
                  active={!isChange}
                  onPick={() => setCategory("general")}
                  icon={<MessageCircle className="size-5" />}
                  title="General Query"
                  note="Questions, clarifications, or any academic or project related issues."
                />
                <KindOption
                  active={isChange}
                  disabled={!mentor || !isLeader || changeInProgress}
                  onPick={() => setCategory("supervisor_change")}
                  icon={<ArrowRightLeft className="size-5" />}
                  title="Change of Supervisor"
                  note={
                    !mentor
                      ? "Available once your group has a supervisor."
                      : !isLeader
                        ? "Only your team lead can ask to change supervisor."
                        : changeInProgress
                          ? "A change request is already in progress."
                          : "Request a change to your supervisor. Your current and new supervisor both have to approve."
                  }
                />
              </div>
            </div>

            {/* ------------------------- subject or target ------------------------- */}
            {isChange ? (
              <div>
                <RequiredLabel htmlFor="q-target">Move to</RequiredLabel>
                <select
                  id="q-target"
                  required
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  className="h-11 w-full rounded-lg border border-sand-200 bg-white px-3 text-[14px] text-ink-900 focus:border-azure-500 focus:ring-3 focus:ring-azure-100 focus:outline-none"
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
                <p className="mt-1.5 text-[12.5px] text-stone-500">
                  {target && target.groupCount >= target.maxGroups
                    ? `${target.fullName} already has ${target.groupCount} of ${target.maxGroups} groups, so the PBL office also has to approve.`
                    : "Supervisors with a portal account. Both they and your current supervisor are asked."}
                </p>
              </div>
            ) : (
              <div>
                <RequiredLabel htmlFor="q-subject">Subject</RequiredLabel>
                <Input
                  id="q-subject"
                  required
                  maxLength={150}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Write a short and specific subject for your query"
                />
                <p className="mt-1.5 text-[12.5px] text-stone-500">
                  Examples: Regarding ETE Evaluation <span className="mx-1.5 text-sand-200">|</span> Clarification on Milestone 2
                  <span className="mx-1.5 text-sand-200">|</span> Issue with Submission Portal
                </p>
              </div>
            )}

            {/* ------------------------------ details ------------------------------ */}
            <div>
              <RequiredLabel htmlFor="q-body">{isChange ? "Reason for the change" : "Query details"}</RequiredLabel>
              <RichEditor
                id="q-body"
                rows={5}
                maxLength={1000}
                value={body}
                onChange={setBody}
                placeholder={
                  isChange
                    ? "Explain why you want to change supervisor. This becomes the recorded reason, seen by both supervisors and the PBL office."
                    : "Describe your query in detail. Include all relevant information such as dates, context, subject, etc. so that your supervisor can understand and respond effectively."
                }
                hint="Please provide sufficient details for your supervisor."
              />
            </div>

            {/* ----------------------------- documents ----------------------------- */}
            <div>
              <p className="text-[14px] font-semibold text-ink-900">
                Supporting documents <span className="font-normal text-stone-500">(Optional)</span>
              </p>
              <p className="mb-2 text-[12.5px] text-stone-500">You can attach screenshots, PDFs, or any relevant files.</p>
              <FileDrop
                id="q-files"
                files={files}
                onChange={setFiles}
                multiple
                accept=".pdf,.doc,.docx,.ppt,.pptx,.zip,image/png,image/jpeg"
                specs="PDF, DOC, DOCX, PPT, JPG, PNG · up to 25 MB per file"
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

            {/* ------------------------------ actions ------------------------------ */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <p className="flex items-center gap-2 text-[13px] text-stone-500">
                <Info className="size-4 text-azure-600" />
                {isChange ? "Both supervisors will be notified after submission." : "Your supervisor will be notified after submission."}
              </p>
              <div className="flex gap-2">
                <ButtonLink href="/student/queries" variant="secondary">
                  Cancel
                </ButtonLink>
                <Button type="submit" loading={busy}>
                  <Send className="size-4" />
                  {isChange ? "Send request" : "Send query"}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </Card>

      {/* ------------------------------ guidelines ------------------------------ */}
      <Card className="bg-azure-50/40">
        <div className="space-y-3 px-5 py-5">
          <h2 className="flex items-center gap-2.5 font-display text-[1.15rem] text-ink-900">
            <FileText className="size-5 text-azure-600" />
            Guidelines
          </h2>
          <ul className="list-disc space-y-2.5 pl-5 text-[13.5px] leading-relaxed text-stone-600 marker:text-azure-500">
            <li>Be clear and specific in your subject and details.</li>
            <li>Include all relevant dates, context and supporting documents.</li>
            <li>Your query will be visible to your assigned supervisor and the administrator if required.</li>
            <li>You will be notified on the portal when there is a response. Track it under Your Queries.</li>
          </ul>
        </div>
      </Card>
    </div>
  );
}

/** One fact in the strip under the heading. */
function InfoCell({ icon, title, note }: { icon: ReactNode; title: string; note: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-azure-50 text-azure-600">{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-[13.5px] font-semibold text-ink-900">{title}</span>
        <span className="block text-[12.5px] text-stone-500">{note}</span>
      </span>
    </div>
  );
}

/** A field label with a red asterisk. */
function RequiredLabel({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[14px] font-semibold text-ink-900">
      {children} <span className="text-clay-500">*</span>
    </label>
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
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full",
          active ? "bg-azure-100/70 text-azure-600" : "bg-ivory-200/80 text-stone-600",
        )}
      >
        {icon}
      </span>
      <span>
        <span className="block pr-6 text-[13.5px] font-semibold text-ink-900">{title}</span>
        <span className="block pr-6 text-[12px] text-stone-500">{note}</span>
      </span>
    </button>
  );
}
