"use client";

import { useState, type FormEvent } from "react";
import { ArrowRightLeft, Clock, Mail, MessageCircleQuestion, Paperclip, Send, UsersRound, MoreHorizontal } from "lucide-react";

import { FileLink } from "@/components/shared/file-link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { FileDrop } from "@/components/ui/file-drop";
import { Field, Input, Textarea } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import * as repo from "@/lib/data/repository";
import { usePortal } from "@/lib/data/portal-store";
import type { Ticket, TicketCategory } from "@/lib/types";
import { useLoad } from "@/lib/use-load";
import { formatDateTime, timeAgo, cn, initials } from "@/lib/utils";

export default function QueriesPage() {
  const { loading, student, group, mentor } = usePortal();
  const queries = useLoad(() => repo.listTickets(group!.id), group ? group.id : null);
  const [category, setCategory] = useState<TicketCategory>("general");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

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
  const shown = (queries.data ?? []).filter((q) => q.studentId === student.id);

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
        files: isChange ? [] : files,
      });
      setSubject("");
      setBody("");
      setFiles([]);
      setCategory("general");
      setSent(
        isChange
          ? `Sent to ${mentor?.fullName ?? "your supervisor"}. Once they approve it, the administrator chooses your new supervisor.`
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
        title="Student"
        emphasis="queries."
        description="Raise a question, report a blocker, or request a change to your assigned supervisor."
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
                <span className="block text-[11.5px] text-stone-500">on response via portal and email</span>
              </span>
            </span>
          </div>
        }
      />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* ------------------------- the student's queries ------------------------- */}
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Your queries"
              description="View and track all the queries you have raised."
            />
            {shown.length === 0 ? (
              <EmptyState
                icon={<MessageCircleQuestion className="size-5" />}
                title="No queries yet"
                description="Questions you raise will appear here with their responses."
                scene="queries"
              />
            ) : (
              <ul className="divide-y divide-sand-200/70">
                {shown.map((q) => (
                  <QueryItem key={q.id} query={q} open={openId === q.id} onToggle={() => setOpenId(openId === q.id ? null : q.id)} />
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* ------------------------ raise a new query ------------------------ */}
        <Card>
          <CardHeader
            title="Raise a New Query"
            description="Select the type of query and provide the required details."
          />
          <form onSubmit={submit} className="space-y-4 px-5 py-4">
            <div role="radiogroup" aria-label="Kind of query" className="grid gap-3 sm:grid-cols-2">
              <KindOption
                active={!isChange}
                onPick={() => setCategory("general")}
                icon={<MessageCircleQuestion className="size-4" />}
                title="General Query"
                note="Questions, clarifications, or any academic/project related issues."
              />
              <KindOption
                active={isChange}
                disabled={!mentor || changeInProgress}
                onPick={() => setCategory("supervisor_change")}
                icon={<ArrowRightLeft className="size-4" />}
                title="Change of Supervisor"
                note={
                  !mentor
                    ? "Available once your group has a supervisor."
                    : changeInProgress
                      ? "A change request is already in progress."
                      : "Request a change of supervisor. (Requires valid reason and will be approved by administrator.)"
                }
              />
            </div>

            {isChange ? null : (
              <Field
                label="Subject"
                htmlFor="q-subject"
                help="Examples: Regarding ETE Evaluation · Clarification on Milestone 2 · Issue with Submission Portal"
              >
                <Input
                  id="q-subject"
                  required
                  maxLength={150}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Write a short and specific subject for your query"
                />
              </Field>
            )}

            <Field
              label="Query Details"
              htmlFor="q-body"
              help={
                isChange
                  ? "Explain the reason for the change. This becomes the recorded reason, seen by your supervisor and the administrator."
                  : "Describe your query in detail. Please include all relevant information (dates, context, subject, etc.) so that your supervisor can understand and respond effectively."
              }
            >
              <Textarea
                id="q-body"
                rows={4}
                required={isChange}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </Field>

            {isChange ? null : (
              <div>
                <p className="text-[13px] font-medium text-ink-800">
                  Attach Supporting Documents <span className="font-normal text-stone-500">(Optional)</span>
                </p>
                <FileDrop
                  id="q-files"
                  files={files}
                  onChange={setFiles}
                  multiple
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.zip,image/png,image/jpeg"
                  specs="PDF, DOC, PPT, ZIP · up to 25 MB per file"
                  disabled={busy}
                />
              </div>
            )}

            {error ? <p role="alert" className="text-[13px] text-clay-500">{error}</p> : null}
            {sent ? <p role="status" className="text-[13px] text-sage-500">{sent}</p> : null}
            <div className="flex justify-end">
              <Button type="submit" loading={busy}>
                <Send className="size-3.5" />
                {isChange ? "Send change request" : "Submit Query"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}

/** One raised query: the header row, a preview, and its conversation when expanded. */
function QueryItem({ query: q, open, onToggle }: { query: Ticket; open: boolean; onToggle: () => void }) {
  const isChange = q.category === "supervisor_change";
  return (
    <li className="px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14.5px] font-semibold text-ink-900">{q.subject}</p>
          <p className="mt-0.5 text-[12px] text-stone-500">
            {isChange ? "Change of Supervisor" : "General Query"} · Submitted on {formatDateTime(q.createdAt)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-[12px] text-stone-400" title={formatDateTime(q.createdAt)}>
            {timeAgo(q.createdAt)}
          </span>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-label={open ? "Hide conversation" : "View conversation"}
            className="rounded p-1 text-stone-400 hover:bg-white/70 hover:text-ink-800"
          >
            <MoreHorizontal className="size-4" />
          </button>
        </div>
      </div>

      <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-stone-600">{q.body}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        {q.attachments.length > 0 ? (
          <span className="flex items-center gap-1.5 text-[12px] text-stone-500">
            <Paperclip className="size-3.5" />
            {q.attachments.length} attachment{q.attachments.length > 1 ? "s" : ""}
          </span>
        ) : null}
        <button
          type="button"
          onClick={onToggle}
          className="ml-auto text-[13px] font-medium text-azure-600 hover:underline"
        >
          {open ? "Hide conversation" : "View conversation"}
        </button>
      </div>

      {open ? (
        <div className="mt-3 space-y-3 rounded-[14px] bg-ivory-200/50 p-3.5 ring-1 ring-sand-200/70">
          {q.attachments.map((a) => (
            <FileKeyRow key={a.filePath} file={a} />
          ))}
          {q.reply ? (
            <p className="text-[13px] leading-relaxed text-ink-800">
              <span className="font-semibold text-azure-600">Supervisor&apos;s response: </span>
              {q.reply}
              {q.repliedAt ? <span className="text-[11.5px] text-stone-500"> · {timeAgo(q.repliedAt)}</span> : null}
            </p>
          ) : null}
          {q.adminReply ? (
            <p className="text-[13px] leading-relaxed text-ink-800">
              <span className="font-semibold text-sage-500">Administrator: </span>
              {q.adminReply}
              {q.adminRepliedAt ? <span className="text-[11.5px] text-stone-500"> · {timeAgo(q.adminRepliedAt)}</span> : null}
            </p>
          ) : null}
          {!q.reply && !q.adminReply ? (
            <p className="flex items-center gap-1.5 text-[12.5px] text-stone-500">
              <Clock className="size-3.5" />
              Waiting for a response from your supervisor.
            </p>
          ) : null}
          <div className="flex justify-end">
            <Badge tone={q.status === "open" ? "gold" : "sage"} dot>
              {q.status === "resolved" ? "Resolved" : "Open"}
            </Badge>
          </div>
        </div>
      ) : null}
    </li>
  );
}

/** An attached file, opening in the in-portal viewer. */
function FileKeyRow({ file }: { file: { filePath: string; fileName: string } }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[10px] bg-white/80 px-3 py-2 ring-1 ring-sand-200/70">
      <span className="flex min-w-0 items-center gap-2">
        <Paperclip className="size-3.5 shrink-0 text-azure-600" />
        <span className="truncate text-[12.5px] font-medium text-ink-900">{file.fileName}</span>
      </span>
      <FileLink bucket="submissions" path={file.filePath} name={file.fileName} />
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
        "relative flex gap-3 rounded-[14px] border px-3.5 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-55",
        active ? "border-azure-500 bg-azure-50/70 ring-2 ring-azure-100" : "border-sand-200 bg-white/70 hover:border-azure-100",
      )}
    >
      <span className="absolute top-3 right-3 flex size-4 items-center justify-center rounded-full border-2 border-transparent bg-white">
        {active ? <span className="size-4 rounded-full bg-azure-600" /> : null}
      </span>
      <span className={cn("mt-0.5 shrink-0", active ? "text-azure-600" : "text-stone-500")}>{icon}</span>
      <span>
        <span className="block pr-6 text-[13.5px] font-semibold text-ink-900">{title}</span>
        <span className="block pr-6 text-[12px] text-stone-500">{note}</span>
      </span>
    </button>
  );
}
