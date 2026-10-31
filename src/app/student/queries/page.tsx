"use client";

import { useEffect, useRef, useState } from "react";
import { Clock, MessageCircleQuestion, Paperclip, Plus } from "lucide-react";

import { FileChips } from "@/components/shared/file-link";
import { ChangeProgress, statusOf } from "@/components/shared/queries";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import * as repo from "@/lib/data/repository";
import { usePortal } from "@/lib/data/portal-store";
import type { Ticket } from "@/lib/types";
import { useLoad } from "@/lib/use-load";
import { RichText, plainText } from "@/components/shared/rich-text";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";

/** The latest thing that happened on a query: a reply, an approval or the outcome. */
function lastActivity(q: Ticket): string {
  return [q.createdAt, q.repliedAt, q.adminRepliedAt, q.currentApprovedAt, q.targetApprovedAt, q.forwardedAt]
    .filter((t): t is string => Boolean(t))
    .sort()
    .pop()!;
}

/**
 * Your Queries: every query the group has raised, newest activity first, with
 * its conversation. Opening the page clears the query badge in the sidebar;
 * queries with activity since then are tagged New.
 */
export default function YourQueriesPage() {
  const { loading, student, group, notifications, markNotificationRead } = usePortal();
  const queries = useLoad(() => repo.listTickets(group!.id), group ? group.id : null);
  const [openId, setOpenId] = useState<string | null>(null);
  // Snapshot of when the oldest unread query notification arrived, taken once
  // the portal has loaded and before those notifications are marked read.
  // undefined = not taken yet; null = nothing was unread.
  const [newSince, setNewSince] = useState<string | null | undefined>(undefined);
  const cleared = useRef(false);

  if (!loading && newSince === undefined) {
    const unread = notifications.filter((n) => n.kind === "ticket" && !n.read);
    const oldest = unread.map((n) => n.createdAt).sort()[0];
    // Allow a minute: the notification is written just after the change it reports.
    setNewSince(oldest ? new Date(new Date(oldest).getTime() - 60_000).toISOString() : null);
  }

  useEffect(() => {
    if (newSince === undefined || cleared.current) return;
    cleared.current = true;
    notifications
      .filter((n) => n.kind === "ticket" && !n.read)
      .forEach((n) => void markNotificationRead(n.id));
  }, [newSince, notifications, markNotificationRead]);

  if (loading || !student) return <PageSkeleton />;

  if (!group) {
    return (
      <div>
        <PageHeader eyebrow="Queries" title="Your" emphasis="queries." scene="queries" />
        <Card>
          <EmptyState title="Join a group first" description="Queries go to your group's supervisor." scene="queries" />
          <div className="pb-6 text-center">
            <ButtonLink href="/student/group" size="sm">Go to my group</ButtonLink>
          </div>
        </Card>
      </div>
    );
  }

  if (queries.error) return <p role="alert" className="text-[13px] text-clay-500">{queries.error}</p>;
  if (!queries.data) return <PageSkeleton />;

  const list = [...queries.data].sort((a, b) => lastActivity(b).localeCompare(lastActivity(a)));
  const isNew = (q: Ticket) => newSince != null && lastActivity(q) >= newSince && lastActivity(q) !== q.createdAt;
  const newCount = list.filter(isNew).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Queries"
        title="Your"
        emphasis="queries."
        description="Every query your group has raised, with the replies and decisions on it. New activity shows a badge in the sidebar."
        scene="queries"
        action={
          <ButtonLink href="/student/queries/new" size="sm">
            <Plus className="size-3.5" />
            Raise a query
          </ButtonLink>
        }
      />

      <Card>
        <CardHeader
          title={`Past queries (${list.length})`}
          description={
            newCount > 0
              ? `${newCount} ${newCount === 1 ? "query has" : "queries have"} new activity since you last looked.`
              : "Open a query to read the conversation."
          }
        />
        {list.length === 0 ? (
          <EmptyState
            icon={<MessageCircleQuestion className="size-5" />}
            title="No queries yet"
            description="Questions your group raises will appear here with their responses."
            scene="queries"
          />
        ) : (
          <ul className="divide-y divide-sand-200/70">
            {list.map((q) => (
              <QueryItem
                key={q.id}
                query={q}
                mine={q.studentId === student.id}
                fresh={isNew(q)}
                open={openId === q.id}
                onToggle={() => setOpenId(openId === q.id ? null : q.id)}
              />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/** One raised query: the header row, a preview, and its conversation when expanded. */
function QueryItem({
  query: q,
  mine,
  fresh,
  open,
  onToggle,
}: {
  query: Ticket;
  mine: boolean;
  fresh: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const isChange = q.category === "supervisor_change";
  const status = statusOf(q);
  return (
    <li className={cn("px-5 py-4", fresh ? "bg-azure-50/40" : "")}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="block w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-[14.5px] font-semibold text-ink-900">
              {q.subject}
              {fresh ? (
                <span className="rounded-full bg-azure-600 px-2 py-0.5 text-[10.5px] font-semibold tracking-wide text-white uppercase">
                  New
                </span>
              ) : null}
            </p>
            <p className="mt-0.5 text-[12px] text-stone-500">
              {isChange ? "Change of supervisor" : "General query"} · {mine ? "Raised by you" : `Raised by ${q.studentName ?? "a teammate"}`} ·{" "}
              {formatDateTime(q.createdAt)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge tone={status.tone} dot>{status.label}</Badge>
          </div>
        </div>

        <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-stone-600">{plainText(q.body)}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {q.attachments.length > 0 ? (
            <span className="flex items-center gap-1.5 text-[12px] text-stone-500">
              <Paperclip className="size-3.5" />
              {q.attachments.length} attachment{q.attachments.length > 1 ? "s" : ""}
            </span>
          ) : null}
          <span className="text-[12px] text-stone-400">Last activity {timeAgo(lastActivity(q))}</span>
          <span className="ml-auto text-[13px] font-medium text-azure-600">
            {open ? "Hide conversation" : "View conversation"}
          </span>
        </div>
      </button>

      {open ? (
        <div className="mt-3 space-y-3 rounded-[14px] bg-ivory-200/50 p-3.5 ring-1 ring-sand-200/70">
          <RichText text={q.body} className="text-[13px] text-ink-800" />
          {isChange ? <ChangeProgress query={q} /> : null}
          {q.attachments.length > 0 ? (
            <FileChips bucket="submissions" files={q.attachments.map((a) => ({ path: a.filePath, name: a.fileName }))} />
          ) : null}
          {q.reply ? (
            <div className="rounded-[12px] bg-azure-50/70 px-3.5 py-3 ring-1 ring-azure-100">
              <p className="text-[12px] font-semibold text-azure-600">
                Supervisor&apos;s response{q.repliedAt ? <span className="font-normal text-stone-500"> · {timeAgo(q.repliedAt)}</span> : null}
              </p>
              <RichText text={q.reply} className="mt-1 text-[13px] text-ink-800" />
            </div>
          ) : null}
          {q.adminReply ? (
            <p className="text-[13px] leading-relaxed text-ink-800">
              <span className="font-semibold text-sage-500">{isChange ? "Outcome: " : "Administrator: "}</span>
              {q.adminReply}
              {q.adminRepliedAt ? <span className="text-[11.5px] text-stone-500"> · {timeAgo(q.adminRepliedAt)}</span> : null}
            </p>
          ) : null}
          {!q.reply && !q.adminReply ? (
            <p className="flex items-center gap-1.5 text-[12.5px] text-stone-500">
              <Clock className="size-3.5" />
              {isChange
                ? q.status === "forwarded"
                  ? "Both supervisors approved. Waiting for the PBL office."
                  : "Waiting for both supervisors to respond."
                : "Waiting for a response from your supervisor."}
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
